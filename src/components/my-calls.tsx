"use client";

import { useState, useRef, useEffect } from "react";
import { Search, Upload, LoaderCircle, Check, AlertCircle } from "lucide-react";
import { meetings as sampleMeetings, type Meeting } from "@/lib/sample-data";
import { mapDbMeetingToMeeting, type DbMeetingRecord } from "@/lib/meetings";
import { MeetingList } from "@/components/meeting-list";
import { Button, Dropdown, EmptyState } from "@/components/ui";

type TypeFilter = "all" | "Upload" | "Internal" | "Customer" | "Planning";

type UploadState =
  | { status: "idle" }
  | { status: "uploading"; progress: number; filename: string }
  | { status: "success"; filename: string }
  | { status: "error"; message: string };

function readMediaDurationSeconds(file: File): Promise<number | undefined> {
  return new Promise((resolve) => {
    const isAudio = file.type.startsWith("audio/") || /\.(mp3|wav|ogg|m4a|aac|flac)$/i.test(file.name);
    const media = document.createElement(isAudio ? "audio" : "video");
    const objectUrl = URL.createObjectURL(file);
    let settled = false;
    const timeout = window.setTimeout(() => finish(), 8000);

    function finish(duration?: number) {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      media.onloadedmetadata = null;
      media.ondurationchange = null;
      media.ontimeupdate = null;
      media.onerror = null;
      media.removeAttribute("src");
      media.load();
      URL.revokeObjectURL(objectUrl);
      resolve(duration);
    }

    media.onloadedmetadata = () => {
      const duration = media.duration;
      if (Number.isFinite(duration) && duration > 0) {
        finish(Math.max(1, Math.round(duration)));
        return;
      }
      // Fragmented MP4 and WebM recordings often report duration as Infinity in Chromium
      if (duration === Infinity) {
        media.currentTime = 1e101;
        media.ontimeupdate = () => {
          media.ontimeupdate = null;
          const dur = media.duration === Infinity ? media.currentTime : media.duration;
          finish(Number.isFinite(dur) && dur > 0 ? Math.max(1, Math.round(dur)) : undefined);
        };
      }
    };
    media.onerror = () => finish();
    media.preload = "metadata";
    media.src = objectUrl;
  });
}

export function MyCalls({ initialMeetings = [] }: { initialMeetings?: Meeting[] }) {
  const [type, setType] = useState<TypeFilter>("all");
  const [realMeetings, setRealMeetings] = useState<Meeting[]>(initialMeetings);
  const [uploadState, setUploadState] = useState<UploadState>({ status: "idle" });
  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeXhrRef = useRef<XMLHttpRequest | null>(null);

  // Clean up active upload on component unmount
  useEffect(() => {
    return () => {
      if (activeXhrRef.current) {
        activeXhrRef.current.abort();
        activeXhrRef.current = null;
      }
    };
  }, []);

  // Load authenticated user's real meetings from Supabase if not pre-fetched on server
  useEffect(() => {
    if (initialMeetings && initialMeetings.length > 0) {
      setRealMeetings(initialMeetings);
      return;
    }

    let isMounted = true;
    async function loadUserMeetings() {
      try {
        const res = await fetch("/api/meetings");
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.meetings)) {
            const mapped = data.meetings.map((m: DbMeetingRecord) => mapDbMeetingToMeeting(m));
            setRealMeetings(mapped);
          }
        }
      } catch {
        // Fallback to initialMeetings on error
      }
    }
    loadUserMeetings();
    return () => {
      isMounted = false;
    };
  }, [initialMeetings]);

  // Static sample meetings retained as separate demo items
  const demoMeetings: Meeting[] = sampleMeetings.map((m) => ({
    ...m,
    isDemo: true,
  }));

  // Real user meetings appear first, followed by static demo meeting(s)
  const allMeetings = [...realMeetings, ...demoMeetings];

  const visible = allMeetings.filter((meeting) => {
    const matchesType = type === "all" || meeting.category === type;
    return matchesType;
  });

  async function handleFileSelect(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    // Reset input so selecting the same file triggers change event
    event.target.value = "";

    setUploadState({ status: "uploading", progress: 0, filename: file.name });
    // Probe media duration in parallel with the upload network requests
    const durationPromise = readMediaDurationSeconds(file).catch(() => undefined);

    try {
      const effectiveContentType = file.type || "video/mp4";

      // 1. Request short-lived presigned upload URL from server
      const res = await fetch("/api/recordings/upload-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: file.name,
          contentType: effectiveContentType,
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
        activeXhrRef.current = xhr;
        xhr.open("PUT", uploadUrl, true);

        // Always set the exact same Content-Type that was signed to prevent 403 SignatureDoesNotMatch
        xhr.setRequestHeader("Content-Type", effectiveContentType);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable) {
            const percent = Math.min(100, Math.round((evt.loaded / evt.total) * 100));
            setUploadState({ status: "uploading", progress: percent, filename: file.name });
          }
        };

        xhr.onload = () => {
          activeXhrRef.current = null;
          if (xhr.status >= 200 && xhr.status < 300) {
            resolve();
          } else {
            reject(new Error(`Storage rejected upload (${xhr.status})`));
          }
        };

        xhr.onerror = () => {
          activeXhrRef.current = null;
          reject(new Error("Network error during upload to storage"));
        };

        xhr.onabort = () => {
          activeXhrRef.current = null;
          reject(new Error("Upload cancelled"));
        };

        xhr.send(file);
      });

      // 3. Persist meeting and recording records for authenticated user only after successful upload
      const durationSeconds = await durationPromise;
      const completeRes = await fetch("/api/recordings/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          objectKey,
          filename: file.name,
          mimeType: effectiveContentType,
          size: file.size,
          durationSeconds,
        }),
      });

      if (!completeRes.ok) {
        const errData = await completeRes.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to persist meeting record");
      }

      const completeData = await completeRes.json();
      if (completeData.meeting) {
        const newMeeting = mapDbMeetingToMeeting({
          ...completeData.meeting,
          recordings: completeData.recording ? [completeData.recording] : [],
        });
        setRealMeetings((prev) => [newMeeting, ...prev.filter((m) => m.id !== newMeeting.id)]);
      }

      if (typeof window !== "undefined" && typeof completeData.creditsBalance === "number") {
        window.dispatchEvent(
          new CustomEvent("fathom:credits-updated", {
            detail: { credits: completeData.creditsBalance, balance: completeData.creditsBalance },
          })
        );
      }

      // 4. Success state
      setUploadState({ status: "success", filename: file.name });
      setTimeout(() => {
        setUploadState((prev) => (prev.status === "success" ? { status: "idle" } : prev));
      }, 4000);
    } catch (err) {
      activeXhrRef.current = null;
      const message = err instanceof Error ? err.message : "Upload failed";
      setUploadState({ status: "error", message });
      setTimeout(() => {
        setUploadState((prev) => (prev.status === "error" ? { status: "idle" } : prev));
      }, 7000);
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
        <span className="rounded-md border border-[#1e2a3a] bg-[#0f1520] px-3 py-2 text-xs font-semibold text-ink">All calls</span>
        <Dropdown
          label={<><span>Filters</span>{type !== "all" && <span className="h-1.5 w-1.5 rounded-full bg-brand" />}</>}
          items={[
            { label: "All types", onClick: () => setType("all") },
            { label: "Uploads", onClick: () => setType("Upload") },
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

      {uploadState.status === "error" && (
        <div role="alert" className="mb-4 flex items-center justify-between gap-3 rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs text-rose-300">
          <div className="flex items-center gap-2">
            <AlertCircle size={15} className="shrink-0 text-rose-400" />
            <span>{uploadState.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setUploadState({ status: "idle" })}
            className="text-rose-400 hover:text-rose-200 text-xs font-semibold"
            aria-label="Dismiss upload error"
          >
            Dismiss
          </button>
        </div>
      )}

      {visible.length ? <MeetingList meetings={visible} /> : (
        <EmptyState
          icon={<Search size={20} />}
          title="No meetings found"
          description={type === "all" ? "Upload a recording to get started." : "No calls match this filter."}
          action={type !== "all" ? <Button variant="secondary" size="sm" onClick={() => setType("all")}>Clear filters</Button> : undefined}
        />
      )}
    </section>
  );
}
