"use client";

import Image from "next/image";
import Link from "next/link";
import { useRef, useState } from "react";
import { useAdmin } from "@/lib/client";

const SECRET_TAPS = 5;
const TAP_WINDOW_MS = 1500;

export function AppHeader() {
  const { admin, toggle, hydrated } = useAdmin();
  const [toast, setToast] = useState<string | null>(null);

  const tapCount = useRef(0);
  const tapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleLogoClick() {
    tapCount.current += 1;
    if (tapTimer.current) clearTimeout(tapTimer.current);
    tapTimer.current = setTimeout(() => {
      tapCount.current = 0;
    }, TAP_WINDOW_MS);
    if (tapCount.current >= SECRET_TAPS) {
      tapCount.current = 0;
      if (tapTimer.current) clearTimeout(tapTimer.current);
      toggle();
      flashToast(admin ? "관리자 모드 해제" : "🛠 관리자 모드 진입");
    }
  }

  function flashToast(msg: string) {
    setToast(msg);
    setTimeout(() => setToast(null), 1800);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-zinc-200 dark:border-zinc-800 bg-zinc-50/90 dark:bg-zinc-950/90 backdrop-blur pt-safe">
      <div className="max-w-3xl mx-auto px-4 h-14 flex items-center justify-between gap-3">
        <Link
          href="/"
          onClick={(e) => {
            handleLogoClick();
            // 빠른 연타 동안엔 네비게이션 막아 시크릿 활성화 도움
            if (tapCount.current > 1) e.preventDefault();
          }}
          aria-label="홈"
          className="select-none flex items-center gap-2"
        >
          <Image
            src="/logo.png"
            alt="Bolic"
            width={1024}
            height={1024}
            priority
            unoptimized
            className="h-10 w-auto"
          />
          <span className="text-xl font-extrabold tracking-tight">BOLIC</span>
        </Link>

        {hydrated && admin && (
          <button
            onClick={() => {
              if (confirm("관리자 모드를 해제할까요?")) {
                toggle();
                flashToast("관리자 모드 해제");
              }
            }}
            className="text-xs font-semibold px-2.5 py-1.5 rounded-full bg-amber-500 text-white"
          >
            🛠 관리자
          </button>
        )}
      </div>

      {toast && (
        <div className="absolute left-1/2 -translate-x-1/2 top-16 bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-sm px-3 py-1.5 rounded-full shadow-lg">
          {toast}
        </div>
      )}
    </header>
  );
}
