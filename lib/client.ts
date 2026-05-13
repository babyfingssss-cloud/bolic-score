"use client";

import { useEffect, useState } from "react";

const ADMIN_KEY = "bolic.admin";
const BOWLER_KEY = "bolic.bowlerId";

function readStorage(key: string): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string | null) {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, value);
  } catch {
    /* ignore */
  }
}

function useLocalString(key: string): [string | null, (v: string | null) => void, boolean] {
  const [value, setValue] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => {
    setValue(readStorage(key));
    setHydrated(true);
    function onStorage(e: StorageEvent) {
      if (e.key === key) setValue(e.newValue);
    }
    function onCustom(e: Event) {
      const detail = (e as CustomEvent<{ key: string; value: string | null }>).detail;
      if (detail?.key === key) setValue(detail.value);
    }
    window.addEventListener("storage", onStorage);
    window.addEventListener("bolic-storage", onCustom as EventListener);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener("bolic-storage", onCustom as EventListener);
    };
  }, [key]);

  const update = (v: string | null) => {
    setValue(v);
    writeStorage(key, v);
    if (typeof window !== "undefined") {
      window.dispatchEvent(
        new CustomEvent("bolic-storage", { detail: { key, value: v } }),
      );
    }
  };

  return [value, update, hydrated];
}

export function useAdmin() {
  const [raw, set, hydrated] = useLocalString(ADMIN_KEY);
  const admin = raw === "1";
  return {
    admin,
    hydrated,
    setAdmin: (v: boolean) => set(v ? "1" : null),
    toggle: () => set(admin ? null : "1"),
  };
}

export function useCurrentBowler() {
  const [bowlerId, setBowlerId, hydrated] = useLocalString(BOWLER_KEY);
  return { bowlerId, setBowlerId, hydrated };
}
