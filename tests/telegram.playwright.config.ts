import { defineConfig } from "@playwright/test";
import base from "../playwright.config";
export default defineConfig({
  ...base,
  webServer: undefined,
  testDir: "./e2e",
  testMatch: "telegram.spec.ts",
  use: { ...base.use, baseURL: "http://localhost:3300" },
});
