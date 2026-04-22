"use client";

import { useState, useCallback, useEffect } from "react";

const STORAGE_KEY = "spotify-graph-explorer:gemini-key";

export function useUserKey() {
  const [userKey, setUserKeyState] = useState<string | null>(null);

  // Hydrate from localStorage after mount — avoids SSR/CSR mismatch.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setUserKeyState(stored);
    } catch {
      /* localStorage blocked — ignore */
    }
  }, []);

  const setUserKey = useCallback((key: string | null) => {
    try {
      if (key) {
        window.localStorage.setItem(STORAGE_KEY, key);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch {
      /* localStorage blocked — still update state */
    }
    setUserKeyState(key);
  }, []);

  return { userKey, setUserKey };
}
