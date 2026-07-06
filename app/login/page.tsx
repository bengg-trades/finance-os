"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import Logo from "@/components/Logo";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("error")) {
      setError(
        "That login link didn't work (expired or already used). Log in with your password instead."
      );
    }
  }, []);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });
    setBusy(false);
    if (error) setError(error.message);
    else {
      router.push("/");
      router.refresh();
    }
  }

  async function sendLink() {
    setError(null);
    if (!email) {
      setError("Enter your email first.");
      return;
    }
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/confirm` },
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-sm flex-col justify-center px-6">
      <div className="mb-4">
        <Logo size={56} />
      </div>
      <h1 className="mb-1 text-2xl font-bold">FINANCE OS</h1>
      <p className="mb-8 text-sm text-neutral-500">Personal spending tracker</p>

      <form onSubmit={signIn} className="flex flex-col gap-3">
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          autoComplete="email"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-base"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="password"
          autoComplete="current-password"
          className="rounded-lg border border-neutral-300 px-4 py-3 text-base"
        />
        <button
          type="submit"
          disabled={busy}
          className="rounded-lg bg-neutral-900 px-4 py-3 font-medium text-white disabled:opacity-50"
        >
          {busy ? "Signing in…" : "Sign in"}
        </button>
      </form>

      <button
        onClick={sendLink}
        className="mt-4 text-sm text-neutral-500 underline"
      >
        email me a login link instead
      </button>

      {sent && (
        <p className="mt-4 rounded-lg bg-green-50 p-3 text-sm text-green-800">
          Check your email for the login link.
        </p>
      )}
      {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
    </main>
  );
}
