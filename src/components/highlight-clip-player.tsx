"use client";

import { useRef, useState, useEffect } from "react";
import {
  Play,
  Pause,
  RotateCcw,
  Volume2,
  VolumeX,
  Maximize2,
  Minimize2,
  Clock,
  Sparkles,
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
  mimeType = "video/mp4",
  startTimeSec,
  endTimeSec,
  clipTitle,
}: HighlightClipPlayerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const clipDuration = Math.max(1, Math.round(endTimeSec - startTimeSec));
  const [isPlaying, setIsPlaying] = useState(false);
  const [clipCurrentTime, setClipCurrentTime] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [volume, setVolume] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const hideControlsTimeout = useRef<NodeJS.Timeout | null>(null);

  // Cue video to startTimeSec when media loads or URL changes
  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const cueToStart = () => {
      if (Math.abs(video.currentTime - startTimeSec) > 0.3) {
        try {
          video.currentTime = startTimeSec;
        } catch {}
      }
      setIsLoaded(true);
    };

    video.addEventListener("loadedmetadata", cueToStart);
    video.addEventListener("canplay", cueToStart);

    if (video.readyState >= 1) {
      cueToStart();
    }

    return () => {
      video.removeEventListener("loadedmetadata", cueToStart);
      video.removeEventListener("canplay", cueToStart);
    };
  }, [playbackUrl, startTimeSec]);

  // Handle timeupdate and enforce clip boundary
  const handleTimeUpdate = () => {
    const video = videoRef.current;
    if (!video) return;

    const current = video.currentTime;

    // Enforce clip end boundary
    if (current >= endTimeSec) {
      video.pause();
      setIsPlaying(false);
      video.currentTime = startTimeSec;
      setClipCurrentTime(0);
      return;
    }

    // Clamp before start boundary
    if (current < startTimeSec - 0.5) {
      video.currentTime = startTimeSec;
      setClipCurrentTime(0);
      return;
    }

    const elapsed = Math.max(0, Math.min(clipDuration, current - startTimeSec));
    setClipCurrentTime(elapsed);
  };

  const togglePlay = () => {
    const video = videoRef.current;
    if (!video) return;

    if (isPlaying) {
      video.pause();
      setIsPlaying(false);
    } else {
      // If at or past end, restart from clip start
      if (video.currentTime >= endTimeSec || video.currentTime < startTimeSec) {
        video.currentTime = startTimeSec;
      }
      video.play().then(() => setIsPlaying(true)).catch(() => {});
    }
  };

  const handleReplay = () => {
    const video = videoRef.current;
    if (!video) return;
    video.currentTime = startTimeSec;
    setClipCurrentTime(0);
    video.play().then(() => setIsPlaying(true)).catch(() => {});
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const video = videoRef.current;
    if (!video) return;

    const targetClipOffset = parseFloat(e.target.value);
    const newVideoTime = startTimeSec + targetClipOffset;
    video.currentTime = Math.max(startTimeSec, Math.min(endTimeSec, newVideoTime));
    setClipCurrentTime(targetClipOffset);
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

  // Append media fragment for browsers that optimize byte ranges
  const mediaFragmentUrl = `${playbackUrl}#t=${startTimeSec},${endTimeSec}`;

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      className="group relative aspect-video w-full overflow-hidden rounded-2xl border border-[#223347] bg-[#080d14] shadow-2xl select-none"
    >
      <video
        ref={videoRef}
        src={mediaFragmentUrl}
        playsInline
        preload="auto"
        onTimeUpdate={handleTimeUpdate}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onClick={togglePlay}
        className="h-full w-full object-contain cursor-pointer"
      >
        <source src={mediaFragmentUrl} type={mimeType} />
        Your browser does not support HTML5 video playback.
      </video>

      {/* Top Clip Badge Overlay */}
      <div
        className={`absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-none transition-opacity duration-300 ${
          showControls || !isPlaying ? "opacity-100" : "opacity-0"
        }`}
      >
        <div className="flex items-center gap-2 rounded-lg bg-[#0a111a]/80 px-3 py-1.5 backdrop-blur-md border border-white/10 text-xs text-white">
          <span className="flex h-2 w-2 rounded-full bg-brand animate-pulse" />
          <span className="font-semibold text-brand">Highlight Clip</span>
          <span className="text-white/40">·</span>
          <span className="font-mono text-white/80">
            {formatTimestamp(startTimeSec)} – {formatTimestamp(endTimeSec)}
          </span>
          <span className="rounded bg-brand/20 px-1.5 py-0.2 text-[10px] font-bold text-brand">
            {clipDuration}s
          </span>
        </div>
      </div>

      {/* Center Big Play / Replay Overlay Button */}
      {(!isPlaying || !isLoaded) && (
        <div
          onClick={togglePlay}
          className="absolute inset-0 flex items-center justify-center bg-black/30 backdrop-blur-[2px] transition-all cursor-pointer"
        >
          <button
            type="button"
            className="flex h-16 w-16 items-center justify-center rounded-2xl bg-brand text-white shadow-xl shadow-brand/30 transition-transform duration-200 hover:scale-110 active:scale-95 border border-white/20"
            aria-label={isPlaying ? "Pause highlight" : "Play highlight"}
          >
            {clipCurrentTime >= clipDuration ? (
              <RotateCcw size={26} className="text-white" />
            ) : (
              <Play size={28} fill="white" className="ml-1 text-white" />
            )}
          </button>
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
              onClick={togglePlay}
              className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 hover:bg-white/20 text-white transition active:scale-95"
              title={isPlaying ? "Pause (Space)" : "Play (Space)"}
              aria-label={isPlaying ? "Pause highlight" : "Play highlight"}
            >
              {isPlaying ? <Pause size={15} fill="white" /> : <Play size={15} fill="white" className="ml-0.5" />}
            </button>

            <button
              type="button"
              onClick={handleReplay}
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
                onClick={toggleMute}
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
              onClick={toggleFullscreen}
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
