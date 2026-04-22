"use client";

import { useState, useEffect } from "react";

export function useIsPhone(): boolean {
  const [isPhone, setIsPhone] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 1023px)");
    setIsPhone(mq.matches);

    const handler = (e: MediaQueryListEvent) => setIsPhone(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  return isPhone;
}
