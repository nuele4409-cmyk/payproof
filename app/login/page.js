"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import Button from "@/components/Button";
import { Field } from "@/components/Field";

export default function Login() {
  const router = useRouter();

  const submit = (e) => {
    e.preventDefault();
    router.push("/seller");
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
            label="Phone or email"
            name="contact"
            placeholder="0803 123 4567"
            autoComplete="username"
          />
          <Field
            label="Password"
            name="password"
            type="password"
            placeholder="Your password"
            autoComplete="current-password"
          />
          <Button type="submit" className="w-full">
            Sign in
          </Button>
        </form>

        <div className="mt-7 border-t border-ink/12 pt-5">
          <p className="caption text-ink/45">Demo accounts</p>
          <div className="mt-3 grid gap-2.5">
            <Button href="/seller" variant="secondary" className="w-full">
              Continue as Ada — seller
            </Button>
            <Button href="/buyer" variant="secondary" className="w-full">
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
