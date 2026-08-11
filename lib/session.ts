import { cookies } from "next/headers";

export const SESSION_COOKIE = "rtc_session";
const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;

/**
 * Anonymous identity: a random id in an httpOnly cookie, no account, no email.
 * It exists only so a person can come back to their own report and so one
 * browser can't read another's — not to identify anyone.
 */
export async function ensureSessionId(): Promise<string> {
  const store = await cookies();
  const existing = store.get(SESSION_COOKIE)?.value;
  if (existing) return existing;

  const id = newId("s");
  store.set(SESSION_COOKIE, id, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: SESSION_MAX_AGE_SECONDS,
  });
  return id;
}

export async function readSessionId(): Promise<string | null> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value ?? null;
}

/** URL-safe, short enough to read aloud, random enough not to be guessed. */
export function newId(prefix: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(12));
  const body = Array.from(bytes, (byte) => byte.toString(36).padStart(2, "0")).join("");
  return `${prefix}_${body.slice(0, 20)}`;
}
