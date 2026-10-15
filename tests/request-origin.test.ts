import { describe, expect, it } from "vitest";
import { hasAllowedOrigin } from "@/lib/http/origin";

function request(
  origin?: string,
  headers: Record<string, string> = {},
  url = "http://localhost:3000/api/youtube",
) {
  return new Request(url, {
    headers: { ...headers, ...(origin ? { origin } : {}) },
  });
}

describe("request origins on deployed hosts", () => {
  it("allows clients without an Origin header", () => {
    expect(hasAllowedOrigin(request())).toBe(true);
  });
  it("uses the request URL when host headers are unavailable", () => {
    expect(hasAllowedOrigin(request("http://localhost:3000"))).toBe(true);
  });
  it("matches the browser host even when the request URL is internal", () => {
    expect(
      hasAllowedOrigin(
        request("https://progressly.example", { host: "progressly.example" }),
      ),
    ).toBe(true);
  });
  it("matches the public host forwarded by a reverse proxy", () => {
    expect(
      hasAllowedOrigin(
        request("https://progressly.example", {
          host: "localhost:3000",
          "x-forwarded-host": "progressly.example, internal.example",
        }),
      ),
    ).toBe(true);
  });
  it("rejects a foreign origin", () => {
    expect(
      hasAllowedOrigin(
        request("https://another.example", { host: "progressly.example" }),
      ),
    ).toBe(false);
  });
  it("does not trust the internal URL when a public host is present", () => {
    expect(
      hasAllowedOrigin(
        request("http://localhost:3000", { host: "progressly.example" }),
      ),
    ).toBe(false);
  });
  it("does not accept another entry in a forwarded host chain", () => {
    expect(
      hasAllowedOrigin(
        request("https://another.example", {
          host: "localhost:3000",
          "x-forwarded-host": "progressly.example, another.example",
        }),
      ),
    ).toBe(false);
  });
  it("requires an exact host including a non-default port", () => {
    expect(
      hasAllowedOrigin(
        request("http://localhost:3001", { host: "localhost:3000" }),
      ),
    ).toBe(false);
  });
  it.each(["null", "invalid-origin", "ftp://progressly.example"])(
    "rejects invalid origin %s",
    (origin) => {
      expect(
        hasAllowedOrigin(request(origin, { host: "progressly.example" })),
      ).toBe(false);
    },
  );
});
