"use client";

import { useState, useRef } from "react";
import { Search, Upload, LoaderCircle, Check, AlertCircle } from "lucide-react";
import { meetings } from "@/lib/sample-data";
import { MeetingList } from "@/components/meeting-list";
import { Button, Dropdown, EmptyState } from "@/components/ui";

type Scope = "all" | "shared";
type TypeFilter = "all" | "Internal" | "Customer" | "Planning";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; filename: string }
  | { status: "success"; filename: string }
  | { status: "error"; message: string };

export function MyCalls() {
  const [scope, setScope] = useState<Scope>("all");
  const [type, setType] = useState<TypeFilter>("all");
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const visible = scope === "shared" ? [] : meetings.filter((meeting) => {
    const matchesType = type === "all" || meeting.category === type;
    return matchesType;
  });

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so selecting the same file triggers change event
    event.target.value = "";

    setUploadState({ status: "uploading", progress: 0, filename: file.name });

    try {
      // 1. Request short-lived presigned upload URL from server
      const res = await fetch("/api/recordings/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: file.type || "video/mp4",
        }),
      });

      if (!res.ok) {
        if (res.status === 401) {
          throw new Error("Please sign in to upload recordings.");
        }
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || `Upload request failed (${res.status})`);
      }

      const { uploadUrl, objectKey } = await res.json();
      if (!uploadUrl || !objectKey) {
        throw new Error("Invalid upload session returned by server");
      }

      // 2. Direct upload to Cloudflare R2 bucket with real-time progress
      await new Promise<void>((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open("PUT", uploadUrl, true);

        if (file.type) {
          xhr.setRequestHeader("Content-Type", file.type);
        }

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
            setUploadState({ status: "uploading", progress: percent, filename: file.name });
          }
        };

        xhr.onload = () => {
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage rejected upload (${xhr.status})`));
          }
        };

        xhr.onerror = () => {
          reject(new Error("Network error during upload to storage"));
        };

        xhr.onabort = () => {
          reject(new Error("Upload cancelled"));
        };

        xhr.send(file);
      });

      // 3. Persist meeting and recording records for authenticated user only after successful upload
      const completeRes = await fetch("/api/recordings/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objectKey,
          filename: file.name,
          mimeType: file.type || "video/mp4",
          size: file.size,
        }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to persist meeting record");
      }

      // 4. Success state
      setUploadState({ status: "success", filename: file.name });
      setTimeout(() => {
        setUploadState((prev) => (prev.status === "success" ? { status: "idle" } : prev));
      }, 4000);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploadState({ status: "error", message });
      setTimeout(() => {
        setUploadState((prev) => (prev.status === "error" ? { status: "idle" } : prev));
      }, 6000);
    }
  }

  return (
    <section aria-label="My Calls" className="fade-in min-w-0">
      <h1 className="sr-only">My Calls</h1>
      <input
        ref={fileInputRef}
        type="file"
        accept="video/*,audio/*,.mp4,.webm,.mov,.mkv,.m4a,.mp3,.wav,.ogg,.aac"
        className="hidden"
        aria-hidden="true"
        onChange={handleFileSelect}
      />
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setScope("all")} aria-pressed={scope === "all"} className={"rounded-md border px-3 py-2 text-xs font-semibold " + (scope === "all" ? "border-[#1e2a3a] bg-[#0f1520] text-ink" : "border-[#1a2433] bg-transparent text-muted hover:text-ink")}>All calls</button>
        <button type="button" onClick={() => setScope("shared")} aria-pressed={scope === "shared"} className={"rounded-md border px-3 py-2 text-xs font-semibold " + (scope === "shared" ? "border-[#1e2a3a] bg-[#0f1520] text-ink" : "border-[#1a2433] bg-transparent text-muted hover:text-ink")}>Shared with me</button>
        <Dropdown
          label={<><span>Filters</span>{type !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}</>}
          items={[
            { label: "All types", onClick: () => setType("all") },
            { label: "Internal", onClick: () => setType("Internal") },
            { label: "Customer", onClick: () => setType("Customer") },
            { label: "Planning", onClick: () => setType("Planning") }
          ]}
        />
        {uploadState.status === "uploading" ? (
          <Button size="sm" disabled className="ml-auto min-w-[140px]">
            <LoaderCircle size={14} className="animate-spin" /> Uploading {uploadState.progress}%
          </Button>
        ) : uploadState.status === "success" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto text-emerald-400 border-emerald-500/30 bg-emerald-500/10"
            title={`Successfully uploaded ${uploadState.filename}`}
          >
            <Check size={14} /> Uploaded!
          </Button>
        ) : uploadState.status === "error" ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto text-rose-400 border-rose-500/30 bg-rose-500/10"
            title={uploadState.message}
          >
            <AlertCircle size={14} /> Failed (Retry)
          </Button>
        ) : (
          <Button
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            className="ml-auto"
          >
            <Upload size={14} /> Upload recording
          </Button>
        )}
      </div>

      {visible.length ? <MeetingList meetings={visible} /> : (
        <EmptyState
          icon={<Search size={20} />}
          title={scope === "shared" ? "No shared calls yet" : "No meetings found"}
          description={scope === "shared" ? "Meetings shared with you will appear here when sharing is connected." : "Try another search or filter."}
          action={scope === "shared"
            ? <Button variant="secondary" size="sm" onClick={() => setScope("all")}>View all calls</Button>
            : <Button variant="secondary" size="sm" onClick={() => setType("all")}>Clear filters</Button>}
        />
      )}
    </section>
  );
}
