"use client";

import { useEffect, useState } from "react";
import {
  getActiveMatch,
  listMatchBowlers,
  listMatchTeams,
  updateBowler,
} from "@/lib/db";
import type { Bowler, Team } from "@/lib/types";

export function BowlerPickerModal({
  open,
  onClose,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  onPick: (bowlerId: string) => void;
}) {
  const [teams, setTeams] = useState<Team[]>([]);
  const [bowlers, setBowlers] = useState<Bowler[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [noMatch, setNoMatch] = useState(false);

  // 2단계 흐름: 볼러 선택 → 팀 배정(필요 시)
  const [step, setStep] = useState<"bowler" | "team">("bowler");
  const [pickedBowler, setPickedBowler] = useState<Bowler | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) {
      // 모달 닫힐 때 step 초기화
      setStep("bowler");
      setPickedBowler(null);
      return;
    }
    let mounted = true;
    setLoading(true);
    setNoMatch(false);
    (async () => {
      const match = await getActiveMatch();
      if (!mounted) return;
      if (!match) {
        setNoMatch(true);
        setTeams([]);
        setBowlers([]);
        return;
      }
      const [t, b] = await Promise.all([
        listMatchTeams(match.id),
        listMatchBowlers(match.id),
      ]);
      if (!mounted) return;
      setTeams(t);
      setBowlers(b);
    })()
      .catch((e) => mounted && setError(String((e as Error).message ?? e)))
      .finally(() => mounted && setLoading(false));
    return () => {
      mounted = false;
    };
  }, [open]);

  if (!open) return null;

  function pickBowler(b: Bowler) {
    setPickedBowler(b);
    setStep("team");
  }

  async function chooseTeam(teamId: string | null) {
    if (!pickedBowler) return;
    setBusy(true);
    try {
      if (teamId !== pickedBowler.team_id) {
        await updateBowler(pickedBowler.id, { team_id: teamId });
      }
      onPick(pickedBowler.id);
      onClose();
    } catch (e) {
      setError(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const grouped = teams
    .map((t) => ({ team: t, members: bowlers.filter((b) => b.team_id === t.id) }))
    .filter((g) => g.members.length > 0);
  const unassigned = bowlers.filter((b) => b.team_id === null);

  return (
    <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 sm:p-4">
      <div className="bg-white dark:bg-zinc-900 rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md max-h-[90dvh] flex flex-col pb-safe">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between">
          {step === "bowler" ? (
            <h3 className="font-semibold text-lg">누구신가요?</h3>
          ) : (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setStep("bowler")}
                aria-label="뒤로"
                className="text-zinc-500 text-sm"
              >
                ← 뒤로
              </button>
              <h3 className="font-semibold text-lg">팀 선택</h3>
            </div>
          )}
          <button
            onClick={onClose}
            aria-label="닫기"
            className="text-zinc-500 px-2 py-1 -mr-2"
          >
            ✕
          </button>
        </div>

        <div className="p-4 overflow-y-auto flex-1 space-y-4">
          {loading && <div className="text-zinc-500 text-sm">불러오는 중…</div>}
          {error && (
            <div className="rounded-lg bg-red-50 dark:bg-red-950 text-red-700 dark:text-red-300 px-3 py-2 text-sm">
              {error}
            </div>
          )}

          {step === "bowler" ? (
            <>
              {!loading && noMatch && (
                <div className="text-zinc-500 text-sm">
                  아직 진행 중인 경기가 없어요.
                </div>
              )}
              {!loading &&
                !noMatch &&
                grouped.length === 0 &&
                unassigned.length === 0 && (
                  <div className="text-zinc-500 text-sm">
                    아직 등록된 볼러가 없어요. 관리자가 볼러를 추가하면 표시됩니다.
                  </div>
                )}
              {unassigned.length > 0 && (
                <div>
                  <div className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
                    미배정
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {unassigned.map((b) => (
                      <BowlerCard key={b.id} bowler={b} onPick={pickBowler} />
                    ))}
                  </div>
                </div>
              )}
              {grouped.map((g) => (
                <div key={g.team.id}>
                  <div className="text-xs text-zinc-500 mb-2 font-medium uppercase tracking-wide">
                    {g.team.name}
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {g.members.map((b) => (
                      <BowlerCard key={b.id} bowler={b} onPick={pickBowler} />
                    ))}
                  </div>
                </div>
              ))}
            </>
          ) : (
            <>
              <div className="text-sm text-zinc-600 dark:text-zinc-300">
                <span className="font-semibold">{pickedBowler?.name}</span>님이
                들어갈 팀을 선택해주세요.
              </div>
              <div className="space-y-2">
                {teams.length === 0 && (
                  <div className="text-zinc-500 text-sm">
                    관리자가 만든 팀이 아직 없어요. 미배정으로 진행할 수 있어요.
                  </div>
                )}
                {teams.map((t) => {
                  const selected = pickedBowler?.team_id === t.id;
                  return (
                    <button
                      key={t.id}
                      onClick={() => chooseTeam(t.id)}
                      disabled={busy}
                      className={`w-full text-left rounded-xl border p-3 transition active:scale-[0.99] ${
                        selected
                          ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-950/30"
                          : "border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                      } disabled:opacity-50`}
                    >
                      <div className="font-semibold">{t.name}</div>
                      <div className="text-xs text-zinc-500 mt-0.5">
                        {bowlers.filter((b) => b.team_id === t.id).length}명
                      </div>
                    </button>
                  );
                })}
                <button
                  onClick={() => chooseTeam(null)}
                  disabled={busy}
                  className={`w-full text-left rounded-xl border p-3 transition active:scale-[0.99] ${
                    pickedBowler?.team_id === null
                      ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50 dark:bg-blue-950/30"
                      : "border-dashed border-zinc-300 dark:border-zinc-700"
                  } disabled:opacity-50`}
                >
                  <div className="font-semibold text-zinc-600 dark:text-zinc-300">
                    미배정으로 진행
                  </div>
                  <div className="text-xs text-zinc-500 mt-0.5">
                    팀 없이 개인으로만 점수 기록
                  </div>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function BowlerCard({
  bowler,
  onPick,
}: {
  bowler: Bowler;
  onPick: (b: Bowler) => void;
}) {
  return (
    <button
      onClick={() => onPick(bowler)}
      className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 p-3 text-left active:scale-[0.98] transition"
    >
      <div className="font-semibold">{bowler.name}</div>
      {bowler.handicap !== 0 && (
        <div className="text-xs text-zinc-500 mt-0.5">핸디 +{bowler.handicap}</div>
      )}
    </button>
  );
}
