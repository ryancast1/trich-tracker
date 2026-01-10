"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [err, setErr] = useState<string | null>(null);

  const [t1, setT1] = useState(0);
  const [t2, setT2] = useState(0);

  const today = useMemo(() => todayISODate(), []);

  useEffect(() => {
    (async () => {
      setErr(null);
      setStatus("loading");

      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setErr(error.message);
        setStatus("error");
        return;
      }

      const id = data.user?.id ?? null;
      setUserId(id);

      if (!id) {
        setErr("Not logged in.");
        setStatus("error");
        return;
      }

      await loadTotals(id);
      setStatus("idle");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadTotals(uid: string) {
    const { data, error } = await supabase
      .from("trich_events")
      .select("trich")
      .eq("user_id", uid)
      .eq("occurred_on", today)
      .limit(5000);

    if (error) {
      setErr(error.message);
      setStatus("error");
      return;
    }

    const rows = (data ?? []) as { trich: number }[];
    let a = 0;
    let b = 0;
    for (const r of rows) {
      if (Number(r.trich) === 1) a += 1;
      else if (Number(r.trich) === 2) b += 1;
    }
    setT1(a);
    setT2(b);
  }

  async function log(n: 1 | 2) {
    if (!userId) return;

    setErr(null);
    setStatus("saving");

    const { error } = await supabase.from("trich_events").insert({
      user_id: userId,
      trich: n,
      occurred_on: today, // force "today" in your local sense
    });

    if (error) {
      setErr(error.message);
      setStatus("error");
      return;
    }

    await loadTotals(userId);
    setStatus("idle");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-center">Trich Tracker</h1>
          <div className="mt-2 text-center text-sm text-white/60">{today}</div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => log(1)}
              disabled={!userId || status === "saving" || status === "loading"}
              className="h-28 rounded-2xl bg-white text-black text-3xl font-semibold disabled:opacity-60 active:scale-[0.99] transition"
            >
              T1
            </button>

            <button
              onClick={() => log(2)}
              disabled={!userId || status === "saving" || status === "loading"}
              className="h-28 rounded-2xl bg-white text-black text-3xl font-semibold disabled:opacity-60 active:scale-[0.99] transition"
            >
              T2
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <div className="rounded-2xl border border-white/10 bg-black/20 py-4 text-center">
              <div className="text-xs text-white/60">Today T1</div>
              <div className="mt-1 text-3xl font-semibold">{t1}</div>
            </div>

            <div className="rounded-2xl border border-white/10 bg-black/20 py-4 text-center">
              <div className="text-xs text-white/60">Today T2</div>
              <div className="mt-1 text-3xl font-semibold">{t2}</div>
            </div>
          </div>

          {err && <div className="mt-4 text-center text-sm text-red-300">{err}</div>}
          <div className="mt-3 text-center text-xs text-white/50">
            {status === "loading" ? "Loading…" : status === "saving" ? "Saving…" : ""}
          </div>
        </section>
      </div>
    </main>
  );
}


