import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";
import { describe, expect, it, vi } from "vitest";

const script = readFileSync(
  new URL("../public/service-worker.js", import.meta.url),
  "utf8",
);
function worker() {
  const listeners: Record<string, (event: unknown) => void> = {};
  const cache = {
    match: vi.fn().mockResolvedValue(undefined),
    put: vi.fn().mockResolvedValue(undefined),
  };
  const caches = {
    open: vi.fn().mockResolvedValue(cache),
    keys: vi
      .fn()
      .mockResolvedValue([
        "progressly-v1",
        "progressly-static-v2",
        "unrelated-cache",
      ]),
    delete: vi.fn().mockResolvedValue(true),
  };
  const fetch = vi.fn().mockResolvedValue(new Response("asset"));
  const claim = vi.fn().mockResolvedValue(undefined);
  runInNewContext(script, {
    URL,
    Response,
    caches,
    fetch,
    self: {
      location: { origin: "http://localhost:3000" },
      addEventListener: (name: string, callback: (event: unknown) => void) => {
        listeners[name] = callback;
      },
      skipWaiting: vi.fn().mockResolvedValue(undefined),
      clients: { claim },
    },
  });
  return { listeners, cache, caches, fetch, claim };
}

describe("service worker authentication and network isolation", () => {
  it.each([
    ["/dashboard", "GET", "navigate"],
    ["/login", "GET", "navigate"],
    ["/api/workspace", "GET", "cors"],
    ["/api/workspace", "POST", "cors"],
    ["/dashboard?_rsc=example", "GET", "cors"],
    ["https://example.clerk.accounts.dev/v1/client", "GET", "cors"],
  ])("leaves %s to the browser network", (path, method, mode) => {
    const { listeners, caches, fetch } = worker();
    const respondWith = vi.fn();
    listeners.fetch({
      request: {
        url: new URL(path, "http://localhost:3000").href,
        method,
        mode,
      },
      respondWith,
    });
    expect(respondWith).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
    expect(caches.open).not.toHaveBeenCalled();
  });
  it("returns an offline response instead of rejecting a static asset FetchEvent", async () => {
    const { listeners, fetch } = worker();
    fetch.mockRejectedValue(new TypeError("Failed to fetch"));
    const respondWith = vi.fn();
    listeners.fetch({
      request: {
        url: "http://localhost:3000/icons/icon-192x192.png",
        method: "GET",
        mode: "cors",
      },
      respondWith,
    });
    expect((await respondWith.mock.calls[0][0]).status).toBe(503);
  });
  it("removes the old cached homepage without removing unrelated caches", async () => {
    const { listeners, caches, claim } = worker();
    const waitUntil = vi.fn();
    listeners.activate({ waitUntil });
    await waitUntil.mock.calls[0][0];
    expect(caches.delete.mock.calls).toEqual([["progressly-v1"]]);
    expect(claim).toHaveBeenCalledOnce();
  });
  it("unregisters the old worker during development and reloads once to release its control", async () => {
    const unregister = vi.fn().mockResolvedValue(true);
    const reload = vi.fn();
    const caches = {
      keys: vi.fn().mockResolvedValue(["progressly-v1", "unrelated-cache"]),
      delete: vi.fn().mockResolvedValue(true),
    };
    const current = { scriptURL: "http://localhost:3000/service-worker.js" };
    const register = vi.fn();
    runInNewContext(
      readFileSync(
        new URL("../public/sw-register.js", import.meta.url),
        "utf8",
      ),
      {
        URL,
        console,
        caches,
        document: {
          currentScript: { dataset: { enabled: "false" } },
          readyState: "complete",
        },
        window: { caches, location: { reload } },
        navigator: {
          serviceWorker: {
            controller: current,
            register,
            getRegistrations: vi
              .fn()
              .mockResolvedValue([{ active: current, unregister }]),
          },
        },
      },
    );
    await vi.waitFor(() => expect(reload).toHaveBeenCalledOnce());
    expect(unregister).toHaveBeenCalledOnce();
    expect(register).not.toHaveBeenCalled();
    expect(caches.delete.mock.calls).toEqual([["progressly-v1"]]);
  });
});
