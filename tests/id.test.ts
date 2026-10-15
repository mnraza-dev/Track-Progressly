import { afterEach, expect, it, vi } from "vitest";
import { z } from "zod";
import { createId } from "@/lib/id";

afterEach(() => vi.unstubAllGlobals());

it("creates distinct UUIDs accepted by workspace validation", () => {
  const first = createId();
  const second = createId();
  expect(z.uuidv4().safeParse(first).success).toBe(true);
  expect(z.uuidv4().safeParse(second).success).toBe(true);
  expect(first).not.toBe(second);
});

it("creates valid UUIDs when only getRandomValues is available", () => {
  const getRandomValues = crypto.getRandomValues.bind(crypto);
  vi.stubGlobal("crypto", { getRandomValues });
  const first = createId();
  const second = createId();
  expect(z.uuidv4().safeParse(first).success).toBe(true);
  expect(z.uuidv4().safeParse(second).success).toBe(true);
  expect(first).not.toBe(second);
});

it("explains when a browser has no random number support", () => {
  vi.stubGlobal("crypto", undefined);
  expect(() => createId()).toThrow(/Try an updated browser/);
});
