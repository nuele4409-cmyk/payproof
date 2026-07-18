import Link from "next/link";
import Amount from "@/components/Amount";
import Button from "@/components/Button";
import Icon from "@/components/Icon";
import Seal from "@/components/Seal";
import StatusChip from "@/components/StatusChip";

function ChatMock() {
  return (
    <div className="relative w-full max-w-[340px] rotate-[-3deg] rounded-card border border-ink/12 bg-[#e7dfd0] p-3 opacity-95">
      <div className="flex items-center gap-2.5 border-b border-ink/10 pb-2.5">
        <span className="h-8 w-8 rounded-full bg-ink/10" />
        <div>
          <div className="text-[13px] font-medium text-ink/80">Buyer · +234 803 ••• ••21</div>
          <div className="text-[11px] text-ink/45">last seen today at 14:31</div>
        </div>
      </div>
      <div className="space-y-2 pt-3">
        <div className="max-w-[80%] rounded-card rounded-tl-[3px] bg-white/75 px-3 py-2 text-[13px] text-ink/80">
          Don’t ship yet o, have you seen the money?
        </div>
        <div className="ml-auto max-w-[85%] rounded-card rounded-tr-[3px] bg-[#d5e4cd] px-3 py-2">
          <div className="rounded-[6px] bg-white/90 p-2.5">
            <div className="space-y-1.5 blur-[2px]" aria-hidden="true">
              <div className="h-2 w-3/4 rounded-full bg-ink/15" />
              <div className="h-2 w-1/2 rounded-full bg-ink/15" />
              <div className="h-3.5 w-2/3 rounded-full bg-bottle/25" />
              <div className="h-2 w-4/5 rounded-full bg-ink/10" />
            </div>
            <div className="mt-2 text-[11px] text-ink/45">screenshot_2201.jpg</div>
          </div>
          <div className="mt-1.5 text-[13px] text-ink/80">I’ve sent it ✅ check the screenshot</div>
        </div>
        <div className="max-w-[80%] rounded-card rounded-tl-[3px] bg-white/75 px-3 py-2 text-[13px] text-ink/80">
          Abeg I no see any alert 😭
        </div>
      </div>
      <div className="pointer-events-none absolute left-1/2 top-[46%] -translate-x-1/2 rotate-[-9deg]">
        <span className="caption whitespace-nowrap rounded-[4px] border-2 border-rust/80 px-3 py-1.5 text-rust">
          Unverified — anyone can fake this
        </span>
      </div>
    </div>
  );
}

function ProofMock() {
  return (
    <div className="w-full max-w-[330px] rounded-card border border-ink/12 bg-paper p-5">
      <div className="flex justify-center py-2">
        <Seal size={168}>
          <span className="caption text-ink/55">Payment</span>
          <span className="font-display text-[30px] font-semibold leading-none text-brass">PAID</span>
          <span className="caption mt-1 text-ink/45">14:32</span>
        </Seal>
      </div>
      <div className="mt-3 space-y-2 border-t border-ink/12 pt-3">
        <div className="flex items-center justify-between">
          <span className="caption text-ink/45">Reference</span>
          <span className="data text-[13px]">MNFY-88024471</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="caption text-ink/45">Amount</span>
          <Amount className="data text-[13px]" value={48500} />
        </div>
        <div className="flex items-center justify-between">
          <span className="caption text-ink/45">Status</span>
          <StatusChip state="Paid" />
        </div>
      </div>
      <p className="mt-3 border-t border-ink/12 pt-3 text-[13px] leading-relaxed text-ink/60">
        Confirmed by Wema Bank via Monnify — not by a screenshot.
      </p>
    </div>
  );
}

const STEPS = [
  {
    n: "01",
    title: "Reserved Account",
    body:
      "Sign up and Monnify creates a dedicated bank account in your name. It’s the only account you ever share.",
  },
  {
    n: "02",
    title: "Monnify Confirms",
    body:
      "Your buyer pays by ordinary transfer. The bank reports the payment to PayProof — no screenshots, no “check your alerts”.",
  },
  {
    n: "03",
    title: "Funds Release",
    body:
      "The money is held until your buyer confirms delivery, then settles to your own bank account automatically.",
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen">
      <header>
        <div className="mx-auto flex h-16 w-full max-w-[1100px] items-center justify-between px-4 sm:px-6">
          <span className="font-display text-[21px] font-semibold tracking-tight">PayProof</span>
          <nav className="flex items-center gap-2 sm:gap-5">
            <a href="#how" className="hidden text-sm text-ink/65 transition-colors hover:text-ink sm:block">
              How it works
            </a>
            <Link href="/login" className="text-sm text-ink/65 transition-colors hover:text-ink">
              Sign in
            </Link>
            <Button href="/register" size="sm">
              Get your account
            </Button>
          </nav>
        </div>
      </header>

      <main className="mx-auto w-full max-w-[1100px] px-4 sm:px-6">
        {/* hero — the argument, made visual */}
        <section className="grid items-center gap-12 pb-20 pt-10 sm:pt-14 lg:grid-cols-[1.05fr_1fr]">
          <div>
            <p className="caption text-brass">For WhatsApp &amp; Instagram sellers</p>
            <h1 className="display-2xl mt-4 max-w-[13ch]">
              Screenshots can be faked. Bank records can’t.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg leading-relaxed text-ink/70">
              PayProof gives every seller a real Monnify reserved account, confirms every transfer
              with the bank, and releases the money only when the buyer confirms delivery.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button href="/register" size="lg">
                Get your reserved account
                <Icon name="arrow-right" size={16} />
              </Button>
              <Button href="#how" variant="secondary" size="lg">
                See how it works
              </Button>
            </div>
          </div>

          <div className="relative mx-auto w-full max-w-[430px]">
            <div className="relative flex flex-col items-center gap-6 lg:block lg:h-[560px]">
              <div className="relative lg:absolute lg:left-0 lg:top-0 lg:w-[76%]">
                <ChatMock />
              </div>
              <div className="relative lg:absolute lg:bottom-0 lg:right-0 lg:w-[74%]">
                <ProofMock />
              </div>
            </div>
          </div>
        </section>

        {/* how it works — a real sequence, numbered */}
        <section id="how" className="border-t border-ink/12 py-20">
          <p className="caption text-brass">How it works</p>
          <h2 className="display-xl mt-3 max-w-[16ch]">Three steps. Zero screenshots.</h2>
          <ol className="mt-12 grid gap-10 md:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n}>
                <div className="font-display text-[32px] font-semibold text-brass">{s.n}</div>
                <h3 className="heading mt-3">{s.title}</h3>
                <p className="mt-2 leading-relaxed text-ink/70">{s.body}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* the ledger, in miniature */}
        <section className="border-t border-ink/12 py-20">
          <div className="rounded-card border border-ink/12 bg-paper p-6 sm:p-8">
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="display-l">Every sale, on the record.</h2>
              <span className="caption text-ink/45">Ada’s ledger — live example</span>
            </div>
            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <tbody>
                  {[
                    { id: "PP-3102-88", item: "Air Max 97 (silver, 43)", amount: 18500, state: "Completed" },
                    { id: "PP-3419-12", item: "Ultraboost Light (core black, 44)", amount: 22500, state: "Shipped" },
                    { id: "PP-3557-04", item: "iPhone 13 Pro (128GB)", amount: 250000, state: "Awaiting Shipment" },
                  ].map((r) => (
                    <tr key={r.id} className="border-b border-ink/12 last:border-b-0">
                      <td className="data py-3.5 pr-4">{r.id}</td>
                      <td className="py-3.5 pr-4 text-sm text-ink/70">{r.item}</td>
                      <td className="py-3.5 pr-4 text-right">
                        <Amount className="data" value={r.amount} />
                      </td>
                      <td className="py-3.5 text-right">
                        <StatusChip state={r.state} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* closing */}
        <section className="border-t border-ink/12 py-20 text-center">
          <h2 className="display-xl mx-auto max-w-[18ch]">Give every sale a paper trail.</h2>
          <p className="mx-auto mt-4 max-w-[42ch] leading-relaxed text-ink/70">
            Free during the pilot. Works with the WhatsApp you already use — you just change the
            account number you share.
          </p>
          <div className="mt-8 flex justify-center">
            <Button href="/register" size="lg">
              Get your reserved account
            </Button>
          </div>
        </section>
      </main>

      <footer className="border-t border-ink/12">
        <div className="mx-auto flex w-full max-w-[1100px] flex-wrap items-center justify-between gap-3 px-4 py-10 sm:px-6">
          <div>
            <span className="font-display text-[18px] font-semibold">PayProof</span>
            <p className="caption mt-1 text-ink/40">Built for people who sell in chats</p>
          </div>
          <span className="caption text-ink/40">Powered by Monnify</span>
        </div>
      </footer>
    </div>
  );
}
