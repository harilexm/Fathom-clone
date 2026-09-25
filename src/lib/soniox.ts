/**
 * Soniox Speech-to-Text client for asynchronous transcription.
 * Permanent API credentials remain strictly server-side.
 */

export interface SonioxTranscriptionRequest {
  audioUrl: string;
  clientReferenceId?: string;
  model?: string;
  enableSpeakerDiarization?: boolean;
  webhookUrl?: string;
  webhookAuthHeaderName?: string;
  webhookAuthHeaderValue?: string;
}

export interface SonioxTranscriptionResponse {
  id: string;
  status: string;
  created_at?: string;
  model?: string;
  error?: string;
  message?: string;
}

const SONIOX_API_BASE = "https://api.soniox.com/v1";

/**
 * Retrieves the Soniox API key from server environment variables.
 * Never expose this key to client-side code.
 */
export function getSonioxApiKey(): string {
  const apiKey = process.env.SONIOX_API_KEY;
  if (!apiKey || !apiKey.trim()) {
    throw new Error("SONIOX_API_KEY is not configured on the server");
  }
  return apiKey.trim();
}

/**
 * Submits an audio/video recording (via a signed URL) to Soniox async Speech-to-Text.
 * Automatically enables speaker diarization and token timestamps.
 */
export async function submitSonioxAsyncTranscription(
  options: SonioxTranscriptionRequest
): Promise<SonioxTranscriptionResponse> {
  const apiKey = getSonioxApiKey();

  if (!options.audioUrl || !options.audioUrl.trim()) {
    throw new Error("Audio URL is required for Soniox async transcription");
  }

  const payload: Record<string, unknown> = {
    model: options.model || "stt-async-v5",
    audio_url: options.audioUrl,
    enable_speaker_diarization: options.enableSpeakerDiarization ?? true,
  };

  if (options.clientReferenceId) {
    payload.client_reference_id = options.clientReferenceId;
  }

  if (options.webhookUrl) {
    payload.webhook_url = options.webhookUrl;
    if (options.webhookAuthHeaderName && options.webhookAuthHeaderValue) {
      payload.webhook_auth_header_name = options.webhookAuthHeaderName;
      payload.webhook_auth_header_value = options.webhookAuthHeaderValue;
    }
  }

  const response = await fetch(`${SONIOX_API_BASE}/transcriptions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      parsedMessage = json.message || json.error || errorBody;
    } catch {
      // Use raw errorBody if not json
    }
    throw new Error(`Soniox API error (${response.status}): ${parsedMessage}`);
  }

  const result = (await response.json()) as SonioxTranscriptionResponse;
  return result;
}

/**
 * Checks the status of an asynchronous transcription job in Soniox.
 */
export async function getSonioxTranscriptionStatus(
  jobId: string
): Promise<SonioxTranscriptionResponse> {
  const apiKey = getSonioxApiKey();

  if (!jobId || !jobId.trim()) {
    throw new Error("Job ID is required to query Soniox transcription status");
  }

  const response = await fetch(`${SONIOX_API_BASE}/transcriptions/${encodeURIComponent(jobId)}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
  });

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      parsedMessage = json.message || json.error || errorBody;
    } catch {
      // Use raw errorBody
    }
    throw new Error(`Soniox API error (${response.status}): ${parsedMessage}`);
  }

  const result = (await response.json()) as SonioxTranscriptionResponse;
  return result;
}

/* ---------- Transcript retrieval ---------- */

export interface SonioxToken {
  text: string;
  start_ms: number;
  end_ms: number;
  confidence: number;
  speaker: string | null;
  language?: string | null;
  is_audio_event?: boolean | null;
}

export interface SonioxTranscriptResponse {
  id: string;
  text: string;
  tokens: SonioxToken[];
}

/**
 * Fetches the full transcript for a completed Soniox transcription job.
 * Only callable when the job status is "completed".
 */
export async function getSonioxTranscript(
  jobId: string
): Promise<SonioxTranscriptResponse> {
  const apiKey = getSonioxApiKey();

  if (!jobId || !jobId.trim()) {
    throw new Error("Job ID is required to fetch Soniox transcript");
  }

  const response = await fetch(
    `${SONIOX_API_BASE}/transcriptions/${encodeURIComponent(jobId)}/transcript`,
    {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
    }
  );

  if (!response.ok) {
    const errorBody = await response.text();
    let parsedMessage = errorBody;
    try {
      const json = JSON.parse(errorBody);
      parsedMessage = json.message || json.error || errorBody;
    } catch {
      // Use raw errorBody
    }
    throw new Error(
      `Soniox transcript fetch error (${response.status}): ${parsedMessage}`
    );
  }

  return (await response.json()) as SonioxTranscriptResponse;
}

/* ---------- Token-to-segment aggregation ---------- */

export interface TranscriptSegment {
  speaker: string;
  text: string;
  start_time: number; // seconds (3 decimal places)
  end_time: number;   // seconds (3 decimal places)
  sequence: number;
}

/**
 * Aggregates word-level Soniox tokens into contiguous speaker turn segments.
 * Adjacent tokens from the same speaker are merged into a single segment.
 */
export function aggregateTokensToSegments(
  tokens: SonioxToken[]
): TranscriptSegment[] {
  if (!tokens || tokens.length === 0) return [];

  const segments: TranscriptSegment[] = [];
  let currentSpeaker: string | null = null;
  let currentText = "";
  let startMs = 0;
  let endMs = 0;
  let sequence = 0;

  for (const token of tokens) {
    const speaker = token.speaker ?? "0";

    // Speaker changed → flush current segment
    if (speaker !== currentSpeaker && currentSpeaker !== null) {
      const trimmed = currentText.trim();
      if (trimmed) {
        segments.push({
          speaker: `Speaker ${currentSpeaker}`,
          text: trimmed,
          start_time: Math.round(startMs) / 1000,
          end_time: Math.round(endMs) / 1000,
          sequence,
        });
        sequence++;
      }
      currentText = "";
      startMs = token.start_ms;
    }

    if (currentSpeaker === null) {
      startMs = token.start_ms;
    }

    currentSpeaker = speaker;
    currentText += token.text;
    endMs = token.end_ms;
  }

  // Flush last segment
  const trimmed = currentText.trim();
  if (trimmed && currentSpeaker !== null) {
    segments.push({
      speaker: `Speaker ${currentSpeaker}`,
      text: trimmed,
      start_time: Math.round(startMs) / 1000,
      end_time: Math.round(endMs) / 1000,
      sequence,
    });
  }

  return segments;
}
