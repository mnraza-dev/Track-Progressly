import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import ts from "typescript";
import { test, expect, type Page } from "@playwright/test";

// Exercise the storage adapter with real browser quotas and IDB transactions,
// without requiring a signed-in account or mocking the database implementation.
const source = readFileSync(
  resolve(__dirname, "../../lib/workspace-storage.ts"),
  "utf8",
);
const script = `(() => { const exports = {}; ${
  ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
    },
  }).outputText
}; window.workspaceStorage = exports; })();`;

declare global {
  interface Window {
    workspaceStorage: typeof import("../../lib/workspace-storage");
    storageChanges: string[];
  }
}

const key = "learntrack-workspace-v2:user_alice";
async function openStorage(page: Page) {
  await page.addInitScript({ content: script });
  await page.route("**/storage-test", (route) =>
    route.fulfill({
      contentType: "text/html",
      body: "<!doctype html><title>Storage test</title>",
    }),
  );
  await page.goto("/storage-test");
}
test.beforeEach(async ({ page }) => {
  await openStorage(page);
});

test("reads existing localStorage caches and keeps small writes compatible", async ({
  page,
}) => {
  expect(
    await page.evaluate(async (key) => {
      localStorage.setItem(key, "existing workspace");
      const before = await window.workspaceStorage.readWorkspaceStorage(key);
      await window.workspaceStorage.writeWorkspaceStorage(
        key,
        "updated workspace",
      );
      return { before, after: localStorage.getItem(key) };
    }, key),
  ).toEqual({ before: "existing workspace", after: "updated workspace" });
});

test("persists a workspace beyond the real localStorage quota across reloads", async ({
  page,
}) => {
  const size = 6 * 1024 * 1024;
  expect(
    await page.evaluate(
      async ({ key, size }) => {
        localStorage.setItem(key, "previous workspace");
        localStorage.setItem("unrelated-setting", "keep me");
        localStorage.setItem(
          "learntrack-workspace-v2:user_bob",
          "Bob's workspace",
        );
        const large = "x".repeat(size);
        await window.workspaceStorage.writeWorkspaceStorage(key, large);
        return {
          matches:
            (await window.workspaceStorage.readWorkspaceStorage(key)) === large,
          previousRemoved: localStorage.getItem(key) === null,
          unrelated: localStorage.getItem("unrelated-setting"),
          otherAccount: localStorage.getItem(
            "learntrack-workspace-v2:user_bob",
          ),
        };
      },
      { key, size },
    ),
  ).toEqual({
    matches: true,
    previousRemoved: true,
    unrelated: "keep me",
    otherAccount: "Bob's workspace",
  });
  await page.reload();
  expect(
    await page.evaluate(async (key) => {
      const value = await window.workspaceStorage.readWorkspaceStorage(key);
      return value?.length;
    }, key),
  ).toBe(size);
  // Even a later small save stays in IDB; stale localStorage cannot win.
  expect(
    await page.evaluate(async (key) => {
      localStorage.setItem(key, "stale copy");
      await window.workspaceStorage.writeWorkspaceStorage(key, "latest edit");
      return window.workspaceStorage.readWorkspaceStorage(key);
    }, key),
  ).toBe("latest edit");
  await page.reload();
  expect(
    await page.evaluate(
      (key) => window.workspaceStorage.readWorkspaceStorage(key),
      key,
    ),
  ).toBe("latest edit");
});

test("does not discard the previous cache when the IndexedDB transaction aborts", async ({
  page,
}) => {
  expect(
    await page.evaluate(async (key) => {
      localStorage.setItem(key, "previous workspace");
      const put = IDBObjectStore.prototype.put;
      IDBObjectStore.prototype.put = function (...args) {
        const request = put.apply(this, args);
        this.transaction.abort();
        return request;
      };
      let failed = false;
      try {
        await window.workspaceStorage.writeWorkspaceStorage(
          key,
          "x".repeat(6 * 1024 * 1024),
        );
      } catch {
        failed = true;
      }
      IDBObjectStore.prototype.put = put;
      return {
        failed,
        value: await window.workspaceStorage.readWorkspaceStorage(key),
      };
    }, key),
  ).toEqual({ failed: true, value: "previous workspace" });
});

test("reports exhausted storage without replacing the previous cache", async ({
  page,
}) => {
  expect(
    await page.evaluate(async (key) => {
      localStorage.setItem(key, "previous workspace");
      IDBObjectStore.prototype.put = function () {
        throw new DOMException("Disk full", "QuotaExceededError");
      };
      let message = "";
      try {
        await window.workspaceStorage.writeWorkspaceStorage(
          key,
          "x".repeat(6 * 1024 * 1024),
        );
      } catch (error) {
        message = (error as Error).message;
      }
      return {
        message,
        value: await window.workspaceStorage.readWorkspaceStorage(key),
      };
    }, key),
  ).toEqual({
    message: expect.stringContaining("browser storage is full or unavailable"),
    value: "previous workspace",
  });
});

test("notifies another tab about successive IndexedDB saves", async ({
  page,
  context,
}) => {
  const other = await context.newPage();
  await openStorage(other);
  await other.evaluate(() => {
    window.storageChanges = [];
    window.workspaceStorage.subscribeWorkspaceStorage((key) =>
      window.storageChanges.push(key),
    );
  });
  await page.evaluate(
    (key) =>
      window.workspaceStorage.writeWorkspaceStorage(
        key,
        "x".repeat(6 * 1024 * 1024),
      ),
    key,
  );
  await expect
    .poll(() => other.evaluate(() => window.storageChanges))
    .toContain(key);
  await other.evaluate(() => {
    window.storageChanges = [];
  });
  await page.evaluate(
    (key) =>
      window.workspaceStorage.writeWorkspaceStorage(
        key,
        "edited in another tab",
      ),
    key,
  );
  await expect
    .poll(() => other.evaluate(() => window.storageChanges))
    .toContain(key);
  expect(
    await other.evaluate(
      (key) => window.workspaceStorage.readWorkspaceStorage(key),
      key,
    ),
  ).toBe("edited in another tab");
});

test("does not use a stale localStorage copy when IndexedDB is unreadable", async ({
  page,
}) => {
  expect(
    await page.evaluate(async (key) => {
      await window.workspaceStorage.writeWorkspaceStorage(
        key,
        "x".repeat(6 * 1024 * 1024),
      );
      localStorage.setItem(key, "stale workspace");
      indexedDB.open = () => {
        throw new DOMException("Unavailable", "SecurityError");
      };
      try {
        await window.workspaceStorage.readWorkspaceStorage(key);
        return "incorrectly read stale data";
      } catch (error) {
        return (error as Error).name;
      }
    }, key),
  ).toBe("SecurityError");
});
