"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const [sessionChecked, setSessionChecked] = useState(false);
  const [session, setSession] = useState<any>(null);

  const [email, setEmail] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [status, setStatus] = useState<"idle" | "sending" | "verifying" | "error">("idle");
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setSessionChecked(true);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s ?? null);
      setSessionChecked(true);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  async function sendCode() {
    setErr(null);
    setStatus("sending");
    const e = email.trim();
    if (!e) {
      setErr("Enter an email.");
      setStatus("error");
      return;
    }

    const { error } = await supabase.auth.signInWithOtp({
      email: e,
      options: {
        shouldCreateUser: true,
      },
    });

    if (error) {
      setErr(error.message);
      setStatus("error");
      return;
    }

    setSentTo(e);
    setStatus("idle");
  }

  async function verifyCode() {
    setErr(null);
    setStatus("verifying");
    const e = (sentTo ?? email).trim();
    const c = code.trim();

    if (!e || !c) {
      setErr("Enter the code.");
      setStatus("error");
      return;
    }

    const { error } = await supabase.auth.verifyOtp({
      email: e,
      token: c,
      type: "email",
    });

    if (error) {
      setErr(error.message);
      setStatus("error");
      return;
    }

    setStatus("idle");
  }

  if (!sessionChecked) {
    return (
      <main className="min-h-screen bg-gradient-to-b from-black to-zinc-950 px-5 py-10 text-white">
        <div className="mx-auto w-full max-w-md text-center text-white/70">Loading…</div>
      </main>
    );
  }

  if (session) return <>{children}</>;

  return (
    <main className="min-h-screen bg-gradient-to-b from-black to-zinc-950 px-5 py-10 text-white">
      <div className="mx-auto w-full max-w-md">
        <h1 className="text-3xl font-semibold tracking-tight text-center">Trich Tracker</h1>

        <div className="mt-8 rounded-2xl border border-white/10 bg-white/5 p-4">
          <div className="text-sm text-white/70 text-center">
            Enter your email, then the code you receive.
          </div>

          <div className="mt-4 space-y-3">
            <input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              inputMode="email"
              placeholder="you@email.com"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 outline-none focus:border-white/20 focus:bg-black/40"
            />

            <button
              onClick={sendCode}
              disabled={status === "sending"}
              className="h-12 w-full rounded-xl bg-white text-black font-semibold disabled:opacity-60"
            >
              {status === "sending" ? "Sending…" : "Send code"}
            </button>

            <input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              inputMode="numeric"
              placeholder="Code"
              className="h-12 w-full rounded-xl border border-white/10 bg-black/30 px-4 outline-none focus:border-white/20 focus:bg-black/40"
            />

            <button
              onClick={verifyCode}
              disabled={status === "verifying"}
              className="h-12 w-full rounded-xl bg-emerald-400 text-black font-semibold disabled:opacity-60"
            >
              {status === "verifying" ? "Verifying…" : "Verify code"}
            </button>

            {err && <div className="text-center text-sm text-red-300">{err}</div>}
          </div>
        </div>
      </div>
    </main>
  );
}
