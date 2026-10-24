"use client";

import { useState } from "react";
import {
  Download,
  FileText,
  FileSpreadsheet,
  FileJson,
  Printer,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { WorkspaceDialog } from "@/components/ui/workspace-dialog";
import { useWorkspace } from "@/stores/workspace";
import { createExport, exportFormats, type ExportFormat } from "@/lib/exports";
import { downloadText } from "@/lib/utils";

const icons = {
  notes: FileText,
  progress: FileSpreadsheet,
  activity: FileSpreadsheet,
  backup: FileJson,
  report: Printer,
};
export function ExportDialog({ compact = false }: { compact?: boolean }) {
  const [open, setOpen] = useState(false);
  const [format, setFormat] = useState<ExportFormat>("notes");
  const [courseId, setCourseId] = useState("all");
  const [error, setError] = useState("");
  const { data, loaded, notify } = useWorkspace();
  const scoped = format !== "backup" && format !== "activity";
  const courses = data.courses.filter(
    (c) => courseId === "all" || c.id === courseId,
  );
  const notes = courses.flatMap((c) => c.videos.flatMap((v) => v.notes)).length;
  const lessons = courses.flatMap((c) => c.videos).length;
  const empty =
    format === "notes"
      ? !notes
      : format === "progress"
        ? !lessons
        : format === "activity"
          ? !data.activity.length
          : format === "report"
            ? !courses.length
            : false;
  function runExport() {
    setError("");
    try {
      const file = createExport(data, format, scoped ? courseId : "all");
      if (format === "report") {
        const report = window.open("", "_blank");
        if (!report)
          throw new Error(
            "Allow pop-ups for Progressly to open the print report, then try again.",
          );
        report.opener = null;
        report.document.write(file.content);
        report.document.close();
        report.focus();
        report.print();
        notify("Report opened. Choose Save as PDF to keep a copy.");
      } else {
        downloadText(file.content, file.filename, file.mime);
        notify(
          `${exportFormats.find((f) => f.id === format)!.title} exported.`,
        );
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Export failed. Please try again.",
      );
    }
  }
  return (
    <>
      <WorkspaceDialog
        trigger={
          <Button
            variant="outline"
            className={compact ? "workspace-export-trigger" : undefined}
            disabled={!loaded}
            aria-label="Export workspace"
          >
            <Download size={16} aria-hidden="true" />
            <span>{compact ? "Export" : "Open export options"}</span>
          </Button>
        }
        open={open}
        onOpenChange={setOpen}
        title="Your learning. To go."
        description="Take your knowledge anywhere. Choose what you want to keep."
      >
        <div className="export-center">
          <fieldset className="export-formats">
            <legend className="sr-only">Export format</legend>
            {exportFormats.map((item) => {
              const Icon = icons[item.id];
              return (
                <label
                  className={`export-format ${format === item.id ? "selected" : ""}`}
                  key={item.id}
                >
                  <input
                    type="radio"
                    name="export-format"
                    value={item.id}
                    checked={format === item.id}
                    onChange={() => {
                      setFormat(item.id);
                      setError("");
                    }}
                  />
                  <Icon size={20} aria-hidden="true" />
                  <span>
                    <strong>{item.title}</strong>
                    <small>{item.description}</small>
                  </span>
                  <span className="export-extension">{item.extension}</span>
                </label>
              );
            })}
          </fieldset>
          {scoped ? (
            <label className="export-scope">
              Include courses
              <select
                aria-label="Export course"
                value={courseId}
                onChange={(e) => setCourseId(e.target.value)}
              >
                <option value="all">All courses (including archived)</option>
                {data.courses.map((c) => (
                  <option value={c.id} key={c.id}>
                    {c.title}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <p className="export-scope-note">
              {format === "backup"
                ? "Complete workspace backup. Includes every course and your preferences."
                : "Full workspace activity history. Activity is recorded across all courses."}
            </p>
          )}
          <p className="export-summary" role="status">
            {format === "notes"
              ? `${notes} notes across ${courses.length} courses`
              : format === "progress"
                ? `${lessons} lessons across ${courses.length} courses`
                : format === "activity"
                  ? `${data.activity.length} days of activity`
                  : format === "backup"
                    ? `${data.courses.length} courses · ${data.goals.length} goals · complete history`
                    : `${courses.length} courses · progress and practice summary`}
          </p>
          {empty && (
            <p className="muted">
              Nothing to export in this selection yet. Choose another course or
              format.
            </p>
          )}
          {error && (
            <p className="export-error" role="alert">
              {error}
            </p>
          )}
          <div className="export-footer">
            <span>Created on your device.</span>
            <Button onClick={runExport} disabled={empty}>
              {format === "report" ? (
                <Printer size={16} />
              ) : (
                <Download size={16} />
              )}
              {format === "report" ? "Print / save PDF" : "Download export"}
              <ArrowUpRight size={15} />
            </Button>
          </div>
        </div>
      </WorkspaceDialog>
    </>
  );
}
