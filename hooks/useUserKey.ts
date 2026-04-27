"use client";

import { useState, useCallback, useEffect } from "react";
import type { Provider } from "@/lib/gemini";

const STORAGE_KEY = "spotify-graph-explorer:user-api";

interface StoredCredentials {
  key: string;
  provider: Provider;
}

export function useUserKey() {
  const [userKey, setUserKeyState] = useState<string | null>(null);
  const [userProvider, setUserProviderState] = useState<Provider>("groq");

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed: StoredCredentials = JSON.parse(raw);
        if (parsed.key) setUserKeyState(parsed.key);
        if (parsed.provider) setUserProviderState(parsed.provider);
      }
    } catch {
      /* localStorage blocked or malformed JSON — ignore */
    }
  }, []);

  const setCredentials = useCallback((key: string | null, provider: Provider = "groq") => {
    try {
      if (key) {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ key, provider }));
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* localStorage blocked — still update state */
    }
    setUserKeyState(key);
    setUserProviderState(provider);
  }, []);

  return { userKey, userProvider, setCredentials };
}
