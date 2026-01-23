import type { Session } from "./types";
import { fromBase64, toBase64 } from "./crypto/base64";

const STORAGE_KEY = "passkeys_session";
const KEY_CACHE = "passkeys_crypto_key";
const KEY_CACHE_TTL_MS = 5 * 60 * 1000;

const hasChromeStorage = () =>
  typeof chrome !== "undefined" && !!chrome.storage?.local;

const getStorageArea = () =>
  typeof chrome !== "undefined" && chrome.storage?.session
    ? chrome.storage.session
    : null;

export const getStoredSession = async (): Promise<Session | null> => {
  if (hasChromeStorage()) {
    const result = await chrome.storage.local.get(STORAGE_KEY);
    return (result[STORAGE_KEY] as Session | undefined) ?? null;
  }

  const raw = localStorage.getItem(STORAGE_KEY);
  return raw ? (JSON.parse(raw) as Session) : null;
};

export const setStoredSession = async (session: Session): Promise<void> => {
  if (hasChromeStorage()) {
    await chrome.storage.local.set({ [STORAGE_KEY]: session });
    return;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
};

export const clearStoredSession = async (): Promise<void> => {
  if (hasChromeStorage()) {
    await chrome.storage.local.remove(STORAGE_KEY);
    return;
  }
  localStorage.removeItem(STORAGE_KEY);
};

type CachedKeyPayload = {
  key: string;
  expiresAt: number;
};

export const cacheCryptoKey = async (key: CryptoKey): Promise<void> => {
  const raw = await crypto.subtle.exportKey("raw", key);
  const payload: CachedKeyPayload = {
    key: toBase64(new Uint8Array(raw)),
    expiresAt: Date.now() + KEY_CACHE_TTL_MS
  };

  const area = getStorageArea();
  if (area) {
    await area.set({ [KEY_CACHE]: payload });
    return;
  }

  localStorage.setItem(KEY_CACHE, JSON.stringify(payload));
};

export const loadCachedCryptoKey = async (): Promise<CryptoKey | null> => {
  const area = getStorageArea();
  let payload: CachedKeyPayload | null = null;

  if (area) {
    const result = await area.get(KEY_CACHE);
    payload = (result[KEY_CACHE] as CachedKeyPayload | undefined) ?? null;
  } else {
    const raw = localStorage.getItem(KEY_CACHE);
    payload = raw ? (JSON.parse(raw) as CachedKeyPayload) : null;
  }

  if (!payload) {
    return null;
  }
  if (payload.expiresAt < Date.now()) {
    await clearCachedCryptoKey();
    return null;
  }

  return crypto.subtle.importKey(
    "raw",
    fromBase64(payload.key),
    { name: "AES-GCM" },
    true,
    ["encrypt", "decrypt"]
  );
};

export const clearCachedCryptoKey = async (): Promise<void> => {
  const area = getStorageArea();
  if (area) {
    await area.remove(KEY_CACHE);
    return;
  }
  localStorage.removeItem(KEY_CACHE);
};
