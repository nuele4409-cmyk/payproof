"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/Button";
import { Field } from "@/components/Field";
import SegmentedControl from "@/components/SegmentedControl";
import { useDemo } from "@/lib/store";

export default function Register() {
  const router = useRouter();
  const { register } = useDemo();
  const [role, setRole]         = useState("seller");
  const [name, setName]         = useState("");
  const [contact, setContact]   = useState("");
  const [password, setPassword] = useState("");
  const [bvn, setBvn]           = useState("");
  const [error, setError]       = useState(null);
  const [busy, setBusy]         = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!name.trim() || !contact.trim() || !password) {
      setError("Please fill in name, email, and password.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setBusy(true);
    try {
      await register({
        name: name.trim(),
        contact: contact.trim(),
        password,
        role,
        bvn: role === "seller" && bvn.trim() ? bvn.trim() : undefined,
      });
      router.push(role === "seller" ? "/seller/welcome" : "/buyer");
    } catch (e) {
      setError(e.message || "Sign-up failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="min-h-screen">
      <div className="mx-auto w-full max-w-[420px] px-4 py-10 sm:py-16">
        <Link href="/" className="font-display text-[19px] font-semibold tracking-tight">
          PayProof
        </Link>
        <h1 className="display-l mt-8">Create your account</h1>

        <form onSubmit={submit} className="mt-7 space-y-5">
          <div>
            <span className="text-sm font-medium text-ink/80">I’m here to</span>
            <SegmentedControl
              className="mt-1.5"
              value={role}
              onChange={setRole}
              options={[
                { value: "seller", label: "Sell" },
                { value: "buyer", label: "Buy" },
              ]}
            />
            <p className="mt-2 text-[13px] leading-relaxed text-ink/55">
              {role === "seller"
                ? "You’ll get a Monnify reserved account the moment you sign up — it’s the account your buyers pay into."
                : "Your payments are held by Monnify until you confirm delivery. Sellers never see a kobo before then."}
            </p>
          </div>

          <Field
            label="Full name"
            name="name"
            placeholder={role === "seller" ? "Ada Okafor" : "Tobi Adeyemi"}
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <Field
            label="Email"
            name="contact"
            type="email"
            placeholder="you@example.com"
            autoComplete="email"
            value={contact}
            onChange={(e) => setContact(e.target.value)}
          />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />

          {role === "seller" && (
            <Field
              label="BVN (optional in sandbox)"
              name="bvn"
              inputMode="numeric"
              placeholder="11-digit BVN"
              autoComplete="off"
              value={bvn}
              onChange={(e) => setBvn(e.target.value)}
              hint="Required by Monnify to open a real reserved account in production. Skip to use the sandbox test BVN."
            />
          )}

          {error && (
            <p role="alert" className="text-sm text-rust">{error}</p>
          )}

          <Button type="submit" className="w-full" disabled={busy}>
            {busy ? "Creating your account…" : "Create account"}
          </Button>
          {role === "seller" && (
            <p className="caption text-center text-ink/45">
              Your reserved account is created instantly
            </p>
          )}
        </form>

        <p className="mt-7 border-t border-ink/12 pt-5 text-sm text-ink/60">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-bottle underline-offset-2 hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </div>
  );
}
