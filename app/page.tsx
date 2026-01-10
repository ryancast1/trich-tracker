"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

type TrichEvent = {
  id: string;
  occurred_on: string; // YYYY-MM-DD
  trich: number; // 1 | 2
  submitted_at: string;
};

function todayISODate() {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function isoToMDY(iso: string) {
  // iso: YYYY-MM-DD
  const [y, m, d] = iso.split("-");
  return `${Number(m)}/${Number(d)}/${y}`;
}

export default function Home() {
  const [userId, setUserId] = useState<string | null>(null);
  const [date, setDate] = useState<string>(todayISODate());
  const [events, setEvents] = useState<TrichEvent[]>([]);
  const [status, setStatus] = useState<"idle" | "loading" | "saving" | "error">("loading");
  const [err, setErr] = useState<string | null>(null);

  const total = useMemo(() => {
    return events.reduce((sum, e) => sum + (Number(e.trich) || 0), 0);
  }, [events]);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setErr(error.message);
        setStatus("error");
        return;
      }
      setUserId(data.user?.id ?? null);
    })();
  }, []);

  async function load() {
    if (!userId) return;
    setErr(null);
    setStatus("loading");

    const { data, error } = await supabase
      .from("trich_events")
      .select("id, occurred_on, trich, submitted_at")
      .eq("user_id", userId)
      .eq("occurred_on", date)
      .order("submitted_at", { ascending: false })
      .limit(200);

    if (error) {
      setErr(error.message);
      setStatus("error");
      return;
    }

    setEvents((data as TrichEvent[]) ?? []);
    setStatus("idle");
  }

  useEffect(() => {
    if (!userId) return;
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId, date]);

  async function addEvent(n: 1 | 2) {
    if (!userId) return;
    setErr(null);
    setStatus("saving");

    // occurred_on defaults to current_date in DB; we only set it explicitly if user chose a different date.
    const payload: any = {
      user_id: userId,
      trich: n,
    };
    if (date !== todayISODate()) payload.occurred_on = date;

    const { error } = await supabase.from("trich_events").insert(payload);

    if (error) {
      setErr(error.message);
      setStatus("error");
      return;
    }

    await load();
    setStatus("idle");
  }

  async function deleteEvent(id: string) {
    if (!userId) return;
    setErr(null);
    setStatus("saving");

    const { error } = await supabase
      .from("trich_events")
      .delete()
      .eq("id", id)
      .eq("user_id", userId);

    if (error) {
      setErr(error.message);
      setStatus("error");
      return;
    }

    await load();
    setStatus("idle");
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-zinc-950 px-5 py-8 text-white">
      <div className="mx-auto w-full max-w-md">
        <header className="mb-6">
          <h1 className="text-3xl font-semibold tracking-tight text-center">Trich Tracker</h1>
          <div className="mt-2 text-center text-sm text-white/70">
            Today’s total for <span className="text-white/90 font-semibold">{isoToMDY(date)}</span>
          </div>
        </header>

        <section className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="flex items-center justify-between gap-3">
            <label className="block w-full">
              <span className="mb-1 block text-center text-xs text-white/60">Date</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="h-11 w-full rounded-xl border border-white/10 bg-black/30 px-3 text-white outline-none focus:border-white/20 focus:bg-black/40"
              />
            </label>

            <div className="w-28">
              <div className="mb-1 text-center text-xs text-white/60">Total</div>
              <div className="h-11 w-full rounded-xl border border-white/10 bg-black/30 flex items-center justify-center text-xl font-semibold">
                {total}
              </div>
            </div>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => addEvent(1)}
              disabled={!userId || status === "saving"}
              className="h-14 w-full rounded-xl bg-white text-black text-lg font-semibold disabled:opacity-60"
            >
              +1
            </button>
            <button
              onClick={() => addEvent(2)}
              disabled={!userId || status === "saving"}
              className="h-14 w-full rounded-xl bg-emerald-400 text-black text-lg font-semibold disabled:opacity-60"
            >
              +2
            </button>
          </div>

          {err && (
            <div className="mt-3 text-center text-sm text-red-300">{err}</div>
          )}
          <div className="mt-2 text-center text-xs text-white/50">
            {status === "loading" ? "Loading…" : status === "saving" ? "Saving…" : ""}
          </div>
        </section>

        <section className="mt-6">
          <div className="mb-2 text-center text-xs text-white/60">Entries (most recent first)</div>

          <div className="space-y-2">
            {events.length === 0 ? (
              <div className="rounded-2xl border border-white/10 bg-white/5 p-4 text-center text-white/60">
                No entries for this date.
              </div>
            ) : (
              events.map((e) => (
                <div
                  key={e.id}
                  className="rounded-2xl border border-white/10 bg-white/5 p-3 flex items-center justify-between"
                >
                  <div>
                    <div className="text-lg font-semibold">{e.trich}</div>
                    <div className="text-xs text-white/50">
                      {new Date(e.submitted_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </div>
                  </div>

                  <button
                    onClick={() => deleteEvent(e.id)}
                    disabled={status === "saving"}
                    className="h-10 px-4 rounded-xl border border-white/10 bg-black/20 text-white/80 hover:bg-black/30 disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              ))
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
