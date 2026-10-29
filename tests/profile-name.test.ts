import { describe, expect, it } from "vitest";
import { profileName } from "@/lib/profile-name";

describe("default signed-in profile name", () => {
  it("uses the Clerk full name or separate name fields", () => {
    expect(profileName({ fullName: "  Alex Taylor " })).toBe("Alex Taylor");
    expect(profileName({ firstName: "Alex", lastName: "Taylor" })).toBe(
      "Alex Taylor",
    );
  });
  it("falls back to username and then the email local part", () => {
    expect(profileName({ username: "alex" })).toBe("alex");
    expect(
      profileName({
        primaryEmailAddress: { emailAddress: "alex@example.com" },
      }),
    ).toBe("alex");
    expect(profileName(null)).toBe("");
  });
  it("limits names to the workspace field length", () => {
    expect(profileName({ fullName: "A".repeat(120) })).toHaveLength(100);
  });
});
