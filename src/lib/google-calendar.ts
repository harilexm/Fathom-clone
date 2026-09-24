import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";
export const CALENDAR_STATE_COOKIE = "calendar_oauth_state";
const STATE_MAX_AGE_MS = 10 * 60 * 1000;

export type CalendarReturnTo = "onboarding" | "settings";
type OAuthAttempt = { userId: string; state: string; verifier: string; returnTo: CalendarReturnTo; createdAt: number };
type GoogleConfig = { clientId: string; clientSecret: string; redirectUri: string; key: Buffer };

export function calendarOAuthConfigured() {
  const key = process.env.GOOGLE_CALENDAR_TOKEN_KEY;
  return Boolean(
    process.env.GOOGLE_CALENDAR_CLIENT_ID &&
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET &&
    process.env.NEXT_PUBLIC_SITE_URL &&
    key && Buffer.from(key, "base64").length === 32,
  );
}

function config(): GoogleConfig {
  if (!calendarOAuthConfigured()) throw new Error("Google Calendar connection is not configured");
  return {
    clientId: process.env.GOOGLE_CALENDAR_CLIENT_ID!,
    clientSecret: process.env.GOOGLE_CALENDAR_CLIENT_SECRET!,
    redirectUri: new URL("/onboarding/calendar/callback", process.env.NEXT_PUBLIC_SITE_URL!).toString(),
    key: Buffer.from(process.env.GOOGLE_CALENDAR_TOKEN_KEY!, "base64"),
  };
}

function seal(value: string, purpose: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", config().key, iv);
  cipher.setAAD(Buffer.from(purpose));
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), encrypted].map((part) => part.toString("base64url")).join(".");
}

function unseal(value: string, purpose: string) {
  const parts = value.split(".");
  if (parts.length !== 3) throw new Error("Invalid Calendar state");
  const [iv, tag, encrypted] = parts.map((part) => Buffer.from(part, "base64url"));
  if (iv.length !== 12 || tag.length !== 16) throw new Error("Invalid Calendar state");
  const decipher = createDecipheriv("aes-256-gcm", config().key, iv);
  decipher.setAAD(Buffer.from(purpose));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

export function createCalendarOAuthAttempt(userId: string, returnTo: CalendarReturnTo = "onboarding") {
  const state = randomBytes(32).toString("base64url");
  const verifier = randomBytes(32).toString("base64url");
  const challenge = createHash("sha256").update(verifier).digest("base64url");
  const cookieValue = seal(JSON.stringify({ userId, state, verifier, returnTo, createdAt: Date.now() } satisfies OAuthAttempt), "calendar-oauth-state");
  const { clientId, redirectUri } = config();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", CALENDAR_SCOPE);
  url.searchParams.set("access_type", "offline");
  url.searchParams.set("prompt", "consent");
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  return { url, cookieValue };
}

export function verifyCalendarOAuthAttempt(cookieValue: string, returnedState: string, userId: string) {
  const attempt = JSON.parse(unseal(cookieValue, "calendar-oauth-state")) as OAuthAttempt;
  const expected = Buffer.from(attempt.state ?? "");
  const actual = Buffer.from(returnedState);
  if (
    attempt.userId !== userId ||
    !Number.isFinite(attempt.createdAt) ||
    Date.now() - attempt.createdAt < 0 ||
    Date.now() - attempt.createdAt > STATE_MAX_AGE_MS ||
    expected.length !== actual.length ||
    !timingSafeEqual(expected, actual) ||
    typeof attempt.verifier !== "string" ||
    attempt.verifier.length < 43
  ) throw new Error("Invalid Calendar state");
  return { verifier: attempt.verifier, returnTo: attempt.returnTo === "settings" ? "settings" as const : "onboarding" as const };
}

export function encryptCalendarRefreshToken(token: string) {
  return seal(token, "calendar-refresh-token");
}

export async function exchangeCalendarCode(code: string, verifier: string, fetcher: typeof fetch = fetch) {
  const { clientId, clientSecret, redirectUri } = config();
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: clientId, client_secret: clientSecret, redirect_uri: redirectUri, grant_type: "authorization_code", code_verifier: verifier }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Calendar authorization failed");
  const tokens = await response.json() as { access_token?: string; refresh_token?: string; scope?: string };
  if (!tokens.access_token || !tokens.refresh_token || !tokens.scope?.split(" ").includes(CALENDAR_SCOPE)) {
    throw new Error("Google Calendar read-only access was not granted");
  }
  const verification = await fetcher("https://www.googleapis.com/calendar/v3/users/me/calendarList?maxResults=1", {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
    cache: "no-store",
  });
  if (!verification.ok) throw new Error("Google Calendar access could not be verified");
  let accountEmail: string | null = null;
  try {
    accountEmail = await readPrimaryCalendarEmail(tokens.access_token, fetcher);
  } catch {
    // The connection still works when Google cannot return a primary Calendar email.
  }
  return { encryptedRefreshToken: encryptCalendarRefreshToken(tokens.refresh_token), scope: tokens.scope, accountEmail };
}

async function readPrimaryCalendarEmail(accessToken: string, fetcher: typeof fetch) {
  const response = await fetcher("https://www.googleapis.com/calendar/v3/users/me/calendarList/primary", {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Calendar access could not be verified");
  const calendar = await response.json() as { primary?: boolean; id?: string };
  if (calendar.primary !== true) throw new Error("Primary Google Calendar was not verified");
  const id = calendar.id?.trim();
  return id && id.length <= 320 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(id) ? id : null;
}

export async function readConnectedCalendarEmail(encryptedRefreshToken: string, fetcher: typeof fetch = fetch) {
  const { clientId, clientSecret } = config();
  const refreshToken = unseal(encryptedRefreshToken, "calendar-refresh-token");
  const response = await fetcher("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: clientId, client_secret: clientSecret, refresh_token: refreshToken, grant_type: "refresh_token" }),
    cache: "no-store",
  });
  if (!response.ok) throw new Error("Google Calendar credential could not be refreshed");
  const tokens = await response.json() as { access_token?: string };
  if (!tokens.access_token) throw new Error("Google Calendar credential could not be refreshed");
  return readPrimaryCalendarEmail(tokens.access_token, fetcher);
}
