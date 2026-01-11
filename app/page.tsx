"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

const START_DATE = "2026-01-10";
const PACIFIC_TZ = "America/Los_Angeles";

type DailyRow = { date: string; t1: number; t2: number };

function pacificISODate(d = new Date()) {
  // en-CA => YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: PACIFIC_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

function isoToMDY(iso: string) {
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

function dateFromISO(iso: string) {
  // Noon UTC avoids DST edge weirdness while still mapping cleanly to the intended date label
  return new Date(`${iso}T12:00:00Z`);
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [status, setStatus] = useState<"loading" | "idle" | "saving" | "error">("loading");
  const [err, setErr] = useState<string | null>(null);

  const [today, setToday] = useState(() => pacificISODate());

  const [t1, setT1] = useState(0);
  const [t2, setT2] = useState(0);
  const [dailyRows, setDailyRows] = useState<DailyRow[]>([]);

  // Keep "today" updated (Pacific midnight boundary)
  useEffect(() => {
    const id = window.setInterval(() => {
      const t = pacificISODate();
      setToday((prev) => (prev === t ? prev : t));
    }, 30_000);
    return () => window.clearInterval(id);
  }, []);

  // Get user once
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

      setStatus("idle");
    })();
  }, []);

  // Load data whenever user or "today" changes (so it flips after Pacific midnight)
  useEffect(() => {
    if (!userId) return;
    loadDailyAndToday(userId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, today]);

  async function fetchAllEventsSince(uid: string) {
    const pageSize = 1000;
    let from = 0;

    const all: { occurred_on: string; trich: number }[] = [];

    while (true) {
      const { data, error } = await supabase
        .from("trich_events")
        .select("occurred_on, trich")
        .eq("user_id", uid)
        .gte("occurred_on", START_DATE)
        .order("occurred_on", { ascending: false })
        .range(from, from + pageSize - 1);

      if (error) throw error;

      const rows = (data ?? []) as { occurred_on: string; trich: number }[];
      all.push(...rows);

      if (rows.length < pageSize) break;
      from += pageSize;

      if (from > 50000) break; // safety valve
    }

    return all;
  }

  async function loadDailyAndToday(uid: string) {
    setErr(null);
    setStatus("loading");

    try {
      const events = await fetchAllEventsSince(uid);

      // Aggregate by occurred_on (Pacific-day bucket)
      const byDay = new Map<string, { t1: number; t2: number }>();
      for (const e of events) {
        const day = e.occurred_on;
        const cur = byDay.get(day) ?? { t1: 0, t2: 0 };
        if (Number(e.trich) === 1) cur.t1 += 1;
        else if (Number(e.trich) === 2) cur.t2 += 1;
        byDay.set(day, cur);
      }

      // Build continuous daily rows from Pacific "today" back to START_DATE
      const out: DailyRow[] = [];
      const start = dateFromISO(START_DATE);
      let d = dateFromISO(today);

      for (; d >= start; d = new Date(d.getTime() - 86400000)) {
        const iso = pacificISODate(d); // label each row in Pacific
        const agg = byDay.get(iso) ?? { t1: 0, t2: 0 };
        out.push({ date: iso, t1: agg.t1, t2: agg.t2 });
      }

      setDailyRows(out);

      const todayAgg = byDay.get(today) ?? { t1: 0, t2: 0 };
      setT1(todayAgg.t1);
      setT2(todayAgg.t2);

      setStatus("idle");
    } catch (e: any) {
      setErr(e?.message ?? "Failed to load data.");
      setStatus("error");
    }
  }

  async function log(n: 1 | 2) {
    if (!userId) return;

    setErr(null);
    setStatus("saving");

    const occurredOn = pacificISODate(); // compute at tap time (Pacific day boundary)

    // optimistic bump only if it’s for the currently displayed "today"
    if (occurredOn === today) {
      if (n === 1) setT1((x) => x + 1);
      if (n === 2) setT2((x) => x + 1);
    }

    const { error } = await supabase.from("trich_events").insert({
      user_id: userId,
      trich: n,
      occurred_on: occurredOn,
    });

    if (error) {
      if (occurredOn === today) {
        if (n === 1) setT1((x) => Math.max(0, x - 1));
        if (n === 2) setT2((x) => Math.max(0, x - 1));
      }
      setErr(error.message);
      setStatus("error");
      return;
    }

    await loadDailyAndToday(userId);
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-8">
          <h1 className="text-3xl font-semibold tracking-tight text-center">Trich Tracker</h1>
          <div className="mt-2 text-center text-xs text-white/50">
            {isoToMDY(today)}
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => log(1)}
              disabled={!userId || status === "saving" || status === "loading"}
              className="h-32 rounded-2xl bg-white text-black disabled:opacity-60 active:scale-[0.99] transition flex flex-col items-center justify-center"
            >
              <div className="text-3xl font-semibold">T1</div>
              <div className="mt-1 text-5xl font-bold tabular-nums">{t1}</div>
            </button>

            <button
              onClick={() => log(2)}
              disabled={!userId || status === "saving" || status === "loading"}
              className="h-32 rounded-2xl bg-white text-black disabled:opacity-60 active:scale-[0.99] transition flex flex-col items-center justify-center"
            >
              <div className="text-3xl font-semibold">T2</div>
              <div className="mt-1 text-5xl font-bold tabular-nums">{t2}</div>
            </button>
          </div>

          {err && <div className="mt-4 text-center text-sm text-red-300">{err}</div>}
          <div className="mt-3 text-center text-xs text-white/50">
            {status === "loading" ? "Loading…" : status === "saving" ? "Saving…" : ""}
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="mb-3 text-center text-xs text-white/60">Daily totals</div>

          <div className="max-h-[360px] overflow-y-auto rounded-xl border border-white/10">
            <table className="w-full border-collapse text-sm">
              <thead className="sticky top-0 bg-zinc-950/95 backdrop-blur border-b border-white/10">
                <tr>
                  <th className="px-3 py-2 text-left font-semibold text-white/70">Date</th>
                  <th className="px-3 py-2 text-right font-semibold text-white/70">T1</th>
                  <th className="px-3 py-2 text-right font-semibold text-white/70">T2</th>
                </tr>
              </thead>
              <tbody>
                {dailyRows.map((r) => (
                  <tr key={r.date} className="border-t border-white/5">
                    <td className="px-3 py-2 text-left text-white/80">{isoToMDY(r.date)}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/90">{r.t1}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-white/90">{r.t2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </main>
  );
}
