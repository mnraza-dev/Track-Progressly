import { describe, expect, it } from "vitest";
import { createExport, csvCell } from "@/lib/exports";
import { parseWorkspaceBackup } from "@/lib/workspace-backup";
import { chartWorkspace } from "./fixtures/workspace";
import { emptyWorkspace } from "@/types";
const now = new Date("2026-10-24T20:00:00Z");

function workspace() {
  const data = chartWorkspace();
  data.courses[0].title = '=HYPERLINK("https://example.com","React")';
  data.courses[0].videos[0].notes.push({
    id: "note",
    content: 'A note, with "quotes"\nand a new line.',
    timestamp_seconds: 75,
    is_revision_required: true,
    updated_at: now.toISOString(),
  });
  return data;
}
describe("learning exports", () => {
  it("quotes CSV delimiters and neutralizes formula injection", () => {
    expect(csvCell('hello, "world"\nnext')).toBe('"hello, ""world""\nnext"');
    for (const value of ["=1+1", " +SUM(1)", "\t@SUM(1)", "-1+2", "\r=1"])
      expect(csvCell(value)).toMatch(/^"'/);
    expect(csvCell(42)).toBe('"42"');
  });
  it("exports lesson rows with correct scope, counts, URLs, and a UTF-8 BOM", () => {
    const file = createExport(workspace(), "progress", "react", now);
    expect(file.mime).toBe("text/csv;charset=utf-8");
    expect(file.filename).toBe("progressly-progress-course-2026-10-25.csv");
    expect(file.content.charCodeAt(0)).toBe(0xfeff);
    expect(file.content).toContain(
      '"\'=HYPERLINK(""https://example.com"",""React"")"',
    );
    expect(file.content).toContain('"unavailable"');
    expect(file.content).not.toContain("Python for curious minds");
    expect(file.content).toContain(
      "https://www.youtube.com/watch?v=j942wKiXFu8",
    );
    expect(file.content.split("\r\n")).toHaveLength(8);
  });
  it("keeps note content, revision flags, and timestamped video links", () => {
    const file = createExport(workspace(), "notes", "react", now);
    expect(file.content).toContain("&t=75s");
    expect(file.content).toContain("1:15");
    expect(file.content).toContain("Needs revision");
    expect(file.content).toContain('A note, with "quotes"\nand a new line.');
    expect(
      createExport(workspace(), "notes", "python", now).content,
    ).not.toContain("A note,");
  });
  it("exports all activity and backup data even when a course was selected", () => {
    const data = workspace();
    expect(
      createExport(data, "activity", "python", now).content.split("\r\n"),
    ).toHaveLength(data.activity.length + 1);
    expect(
      parseWorkspaceBackup(createExport(data, "backup", "python", now).content),
    ).toEqual(data);
  });
  it("escapes user content in printable reports", () => {
    const data = workspace();
    data.profile.display_name = '<script>alert("x")</script>';
    data.courses[0].title = "<img src=x onerror=alert(1)>";
    const file = createExport(data, "report", "react", now);
    expect(file.content).not.toContain("<script>");
    expect(file.content).not.toContain("<img");
    expect(file.content).toContain("&lt;script&gt;");
    expect(file.content).not.toContain("Python for curious minds");
  });
  it("handles an empty workspace", () => {
    expect(
      createExport(emptyWorkspace, "progress", "all", now).content.split(
        "\r\n",
      ),
    ).toHaveLength(1);
    expect(createExport(emptyWorkspace, "notes", "all", now).content).toContain(
      "No notes",
    );
    expect(
      parseWorkspaceBackup(
        createExport(emptyWorkspace, "backup", "all", now).content,
      ),
    ).toEqual(emptyWorkspace);
  });
});
describe("backup validation", () => {
  it("accepts complete legacy workspace snapshots", () => {
    const data = workspace();
    expect(parseWorkspaceBackup(JSON.stringify(data))).toEqual(data);
  });
  it("rejects malformed, incomplete, future-version, and invalid-timezone backups", () => {
    for (const content of [
      "{",
      '{"courses":[]}',
      JSON.stringify({ version: 2, app: "progressly", workspace: workspace() }),
      JSON.stringify({
        ...workspace(),
        profile: { ...workspace().profile, timezone: "invalid-zone" },
      }),
    ])
      expect(() => parseWorkspaceBackup(content)).toThrow();
  });
});
