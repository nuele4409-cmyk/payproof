"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import Button from "@/components/Button";
import { Field } from "@/components/Field";
import { useDemo } from "@/lib/store";

function safeRedirect(raw) {
  // Only allow same-origin, absolute paths — never external URLs (would be
  // an open redirect: attacker sends /login?redirect=https://evil.com and
  // steals a click after login).
  if (!raw || typeof raw !== "string") return null;
  if (!raw.startsWith("/") || raw.startsWith("//")) return null;
  return raw;
}

function LoginInner() {
  const router = useRouter();
  const params = useSearchParams();
  const redirect = safeRedirect(params.get("redirect"));
  const { login } = useDemo();
  const [contact, setContact]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  const submit = (e) => {
    e.preventDefault();
    if (!contact.trim() || !password) {
      setError("Enter your email and password.");
      return;
    }
    setError(null);
    setBusy(true);
    login({ contact: contact.trim(), password })
      .then((data) => {
        // Redirect target wins if present, else fall back to the role's
        // home page.
        const dest = redirect ?? (data.user.role === "seller" ? "/seller" : "/buyer");
        router.push(dest);
      })
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

        <p className="mt-7 border-t border-ink/12 pt-5 text-sm text-ink/60">
          New here?{" "}
          <Link
            href={redirect ? `/register?redirect=${encodeURIComponent(redirect)}` : "/register"}
            className="font-medium text-bottle underline-offset-2 hover:underline"
          >
            Create your account
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  return (
    <Suspense fallback={null}>
      <LoginInner />
    </Suspense>
  );
}
