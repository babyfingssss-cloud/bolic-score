import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let _client: SupabaseClient | null = null;

function makeClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) {
    throw new Error(
      "Supabase 환경변수가 설정되지 않았습니다. .env.local에 NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY를 추가하세요.",
    );
  }
  return createClient(url, anon, {
    realtime: { params: { eventsPerSecond: 10 } },
  });
}

// 지연 초기화 — 빌드 시점이 아닌 첫 호출 시 에러가 나도록.
export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop, receiver) {
    if (!_client) _client = makeClient();
    const value = Reflect.get(_client as object, prop, receiver);
    return typeof value === "function" ? value.bind(_client) : value;
  },
});
