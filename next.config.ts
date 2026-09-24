import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";

export default function nextConfig(phase: string): NextConfig {
  return {
    // Keep a running dev server from overwriting a production build during review.
    distDir: phase === PHASE_DEVELOPMENT_SERVER ? ".next" : ".next-prod",
  };
}
