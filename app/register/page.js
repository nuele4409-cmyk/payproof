"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import Button from "@/components/Button";
import { Field } from "@/components/Field";
import SegmentedControl from "@/components/SegmentedControl";

export default function Register() {
  const router = useRouter();
  const [role, setRole] = useState("seller");

  const submit = (e) => {
    e.preventDefault();
    router.push(role === "seller" ? "/seller/welcome" : "/buyer");
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
          />
          <Field
            label="Phone or email"
            name="contact"
            placeholder="0803 123 4567"
            autoComplete="tel"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder="At least 8 characters"
            autoComplete="new-password"
          />

          <Button type="submit" className="w-full">
            Create account
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
