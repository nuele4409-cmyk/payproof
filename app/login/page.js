"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/Button";
import { Field } from "@/components/Field";
import { useDemo } from "@/lib/store";

// Kept in sync with prisma/seed.js — the quick-links let a judge walk the
// demo without typing credentials, and only work if the seed has been run.
const DEMO_SELLER = { contact: "ada@payproof.demo",  password: "payproof-demo" };
const DEMO_BUYER  = { contact: "tobi@payproof.demo", password: "payproof-demo" };

export default function Login() {
  const router = useRouter();
  const { login } = useDemo();
  const [contact, setContact]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  const go = async (creds, dest) => {
    setError(null);
    setBusy(true);
    try {
      await login(creds);
      router.push(dest);
    } catch (e) {
      setError(e.message || "Sign-in failed.");
    } finally {
      setBusy(false);
    }
  };

  const submit = (e) => {
    e.preventDefault();
    if (!contact.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    // Role-based redirect happens after we know the response.
    setError(null);
    setBusy(true);
    login({ contact: contact.trim(), password })
      .then((data) => router.push(data.user.role === "seller" ? "/seller" : "/buyer"))
      .catch((e) => setError(e.message || "Sign-in failed."))
      .finally(() => setBusy(false));
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[420px] px-4 py-10 sm:py-16">
        <Link href="/" className="font-display text-[19px] font-semibold tracking-tight">
          PayProof
        </Link>
        <h1 className="display-l mt-8">Sign in</h1>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <Field
            label="Email"
            name="contact"
            type="email"
            placeholder="you@example.com"
            autoComplete="username"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          {error && (
            <p role="alert" className="text-sm text-rust">{error}</p>
          )}
          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>

        <div className="mt-7 border-t border-ink/12 pt-5">
          <p className="caption text-ink/45">Demo accounts</p>
          <div className="mt-3 grid gap-2.5">
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => go(DEMO_SELLER, "/seller")}
            >
              Continue as Ada — seller
            </Button>
            <Button
              variant="secondary"
              className="w-full"
              disabled={busy}
              onClick={() => go(DEMO_BUYER, "/buyer")}
            >
              Continue as Tobi — buyer
            </Button>
          </div>
        </div>

        <p className="mt-7 text-sm text-ink/60">
          New here?{" "}
          <Link href="/register" className="font-medium text-bottle underline-offset-2 hover:underline">
            Create your account
          </Link>
        </p>
      </div>
    </div>
  );
}
