"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Loader2,
} from "lucide-react";
import { formatTimestamp } from "@/lib/meetings";

interface HighlightClipPlayerProps {
  playbackUrl: string;
  mimeType?: string;
  startTimeSec: number;
  endTimeSec: number;
  clipTitle?: string;
}

export function HighlightClipPlayer({
  playbackUrl,
  startTimeSec,
  endTimeSec,
}: HighlightClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const playPromiseRef = useRef<Promise<void> | null>(null);
  const hasCuedRef = useRef(false);

  const clipDuration = Math.max(1, Math.round(endTimeSec - startTimeSec));
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipCurrentTime, setClipCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isBuffering, setIsBuffering] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Safe pause that respects in-flight play promises to avoid AbortError
  const safePause = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (playPromiseRef.current) {
      playPromiseRef.current
        .then(() => {
          video.pause();
          setIsPlaying(false);
        })
        .catch(() => {
          video.pause();
          setIsPlaying(false);
        });
    } else {
      video.pause();
      setIsPlaying(false);
    }
  }, []);

  // Safe play that queues properly and catches AbortError
  const safePlay = useCallback(async () => {
    const video = videoRef.current;
    if (!video) return;

    // Reposition to start if past clip end or before clip start
    if (video.currentTime >= endTimeSec - 0.2 || video.currentTime < startTimeSec - 0.5) {
      video.currentTime = startTimeSec;
      setClipCurrentTime(0);
    }

    try {
      const promise = video.play();
      playPromiseRef.current = promise;
      await promise;
      setIsPlaying(true);
      setIsBuffering(false);
    } catch (err: unknown) {
      const isAbort =
        err instanceof Error &&
        (err.name === "AbortError" || err.message?.includes("interrupted by a call to pause"));
      if (!isAbort) {
        console.error("Playback error:", err);
      }
    } finally {
      playPromiseRef.current = null;
    }
  }, [startTimeSec, endTimeSec]);

  const togglePlay = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!video.paused && isPlaying) {
      safePause();
    } else {
      safePlay();
    }
  }, [isPlaying, safePause, safePlay]);

  // Initial cue to startTimeSec on metadata load
  const handleLoadedMetadata = useCallback(() => {
    const video = videoRef.current;
    if (!video) return;

    if (!hasCuedRef.current) {
      hasCuedRef.current = true;
      try {
        video.currentTime = startTimeSec;
      } catch {}
    }
    setIsLoaded(true);
  }, [startTimeSec]);

  // Reset cue state when URL or startTime changes
  useEffect(() => {
    hasCuedRef.current = false;
    const video = videoRef.current;
    if (video && video.readyState >= 1) {
      handleLoadedMetadata();
    }
  }, [playbackUrl, startTimeSec, handleLoadedMetadata]);

  // Handle timeupdate strictly to update timer and enforce end boundary
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video || video.seeking) return;

    const current = video.currentTime;

    // Enforce clip end boundary: pause and reset to start
    if (current >= endTimeSec) {
      safePause();
      video.currentTime = startTimeSec;
      setClipCurrentTime(0);
      return;
    }

    if (current >= startTimeSec) {
      const elapsed = Math.max(0, Math.min(clipDuration, current - startTimeSec));
      setClipCurrentTime(elapsed);
    }
  };

  const handleSeeked = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;
    const elapsed = Math.max(0, Math.min(clipDuration, current - startTimeSec));
    setClipCurrentTime(elapsed);
    setIsBuffering(false);
  };

  const handleReplay = () => {
    const video = videoRef.current;
    if (!video) return;

    video.currentTime = startTimeSec;
    setClipCurrentTime(0);
    safePlay();
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const targetClipOffset = parseFloat(e.target.value);
    setClipCurrentTime(targetClipOffset);
    const newVideoTime = startTimeSec + targetClipOffset;
    video.currentTime = Math.max(startTimeSec, Math.min(endTimeSec, newVideoTime));
  };

  const toggleMute = () => {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !isMuted;
    setIsMuted(!isMuted);
  };

  const handleVolumeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;
    const val = parseFloat(e.target.value);
    video.volume = val;
    setVolume(val);
    if (val === 0) {
      video.muted = true;
      setIsMuted(true);
    } else if (isMuted) {
      video.muted = false;
      setIsMuted(false);
    }
  };

  const toggleFullscreen = () => {
    const container = containerRef.current;
    if (!container) return;

    if (!document.fullscreenElement) {
      container.requestFullscreen().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  const handleMouseMove = () => {
    setShowControls(true);
    if (hideControlsTimeout.current) clearTimeout(hideControlsTimeout.current);
    if (isPlaying) {
      hideControlsTimeout.current = setTimeout(() => setShowControls(false), 3000);
    }
  };

  const progressPercent = Math.min(100, Math.max(0, (clipCurrentTime / clipDuration) * 100));

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-[#223347] bg-[#080d14] shadow-2xl select-none"
    >
      <video
        ref={videoRef}
        src={playbackUrl}
        playsInline
        preload="auto"
        onLoadedMetadata={handleLoadedMetadata}
        onLoadedData={() => {
          setIsLoaded(true);
          setIsBuffering(false);
        }}
        onCanPlay={() => {
          setIsLoaded(true);
          setIsBuffering(false);
        }}
        onSeeking={() => setIsBuffering(true)}
        onSeeked={handleSeeked}
        onWaiting={() => setIsBuffering(true)}
        onPlaying={() => {
          setIsBuffering(false);
          setIsPlaying(true);
        }}
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={(e) => {
          e.stopPropagation();
          togglePlay();
        }}
        className="h-full w-full object-contain cursor-pointer"
      >
        Your browser does not support HTML5 video playback.
      </video>

      {/* Top Clip Badge Overlay */}
      <div
        className={`absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 rounded-lg bg-[#0a111a]/85 px-3 py-1.5 backdrop-blur-md border border-white/10 text-xs text-white">
          <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
          <span className="font-semibold text-brand">Highlight Clip</span>
          <span className="text-white/40">·</span>
          <span className="font-mono text-white/90">
            {formatTimestamp(startTimeSec)} – {formatTimestamp(endTimeSec)}
          </span>
          <span className="rounded bg-brand/20 px-1.5 py-0.5 text-[10px] font-bold text-brand">
            {clipDuration}s
          </span>
        </div>
      </div>

      {/* Center Big Play / Replay / Buffering Overlay Button */}
      {(!isPlaying || isBuffering) && (
        <div
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              togglePlay();
            }
          }}
          className="absolute inset-0 flex items-center justify-center bg-black/25 backdrop-blur-[2px] transition-all cursor-pointer"
        >
          {isBuffering && isPlaying ? (
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#0e1724]/90 text-brand shadow-xl border border-white/15">
              <Loader2 size={30} className="animate-spin text-brand" />
            </div>
          ) : (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-xl shadow-brand/35 transition-transform duration-200 hover:scale-110 active:scale-95 border border-white/20"
              aria-label={isPlaying ? "Pause highlight" : "Play highlight"}
            >
              {clipCurrentTime >= clipDuration - 0.2 ? (
                <RotateCcw size={26} className="text-white" />
              ) : (
                <Play size={28} fill="white" className="ml-1 text-white" />
              )}
            </button>
          )}
        </div>
      )}

      {/* Bottom Custom Highlight Scrubber & Control Bar */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/90 via-black/60 to-transparent p-4 transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0 pointer-events-none"
        }`}
      >
        {/* Scoped Clip Progress Bar */}
        <div className="relative mb-3 flex items-center group/scrubber">
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/20 backdrop-blur">
            <div
              className="h-full bg-brand transition-all duration-75"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={clipDuration}
            step={0.1}
            value={clipCurrentTime}
            onChange={handleSeek}
            aria-label="Seek highlight clip"
            className="absolute inset-0 h-4 w-full cursor-pointer opacity-0"
          />
        </div>

        {/* Action Controls */}
        <div className="flex items-center justify-between text-xs text-white">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                togglePlay();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              aria-label={isPlaying ? "Pause highlight" : "Play highlight"}
            >
              {isPlaying ? <Pause size={15} fill="white" /> : <Play size={15} fill="white" className="ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleReplay();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              title="Replay highlight from start"
              aria-label="Replay highlight"
            >
              <RotateCcw size={14} />
            </button>

            {/* Time Indicator: Clip elapsed / Clip total (with meeting clock) */}
            <div className="flex items-center gap-1.5 font-mono text-[11px] font-semibold text-white/90">
              <span className="text-white">{formatTimestamp(clipCurrentTime)}</span>
              <span className="text-white/40">/</span>
              <span className="text-white/70">{formatTimestamp(clipDuration)}</span>
              <span className="ml-1.5 hidden sm:inline-block rounded bg-white/10 px-1.5 py-0.5 text-[10px] text-white/60 font-sans">
                at {formatTimestamp(startTimeSec + clipCurrentTime)}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Volume Control */}
            <div className="flex items-center gap-1.5 group/volume">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  toggleMute();
                }}
                className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
                aria-label={isMuted ? "Unmute" : "Mute"}
              >
                {isMuted || volume === 0 ? <VolumeX size={16} /> : <Volume2 size={16} />}
              </button>
              <input
                type="range"
                min={0}
                max={1}
                step={0.05}
                value={isMuted ? 0 : volume}
                onChange={handleVolumeChange}
                aria-label="Volume"
                className="h-1 w-14 cursor-pointer accent-brand transition-all hidden sm:block opacity-70 group-hover/volume:opacity-100"
              />
            </div>

            {/* Fullscreen */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                toggleFullscreen();
              }}
              className="flex h-8 w-8 items-center justify-center rounded-lg hover:bg-white/10 text-white/80 hover:text-white transition"
              title="Fullscreen"
              aria-label="Toggle fullscreen"
            >
              {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
