
import Countdown from "@/components/countdown/Countdown";
import MagneticButton from "@/components/ui/MagneticButton";
import Reveal from "@/components/ui/Reveal";
import { useWaitlist } from "@/components/providers/WaitlistProvider";

export default function JoinSection() {
  const { open, count } = useWaitlist();

  return (
    <section id="movement" className="px-6 py-28 sm:px-10 sm:py-40">
      <div className="mx-auto max-w-6xl">
        <Reveal>
          <p className="eyebrow">The countdown</p>
        </Reveal>

        <div className="mt-10 flex flex-col gap-6 border-b border-line pb-12 sm:flex-row sm:items-end sm:justify-between">
          <Reveal>
            <h2 className="font-display text-[clamp(2.3rem,5.8vw,4.5rem)] font-bold leading-[1.02] tracking-[-0.02em] text-ink">
              Mumbai first.
              <br />
              15 August 2026.
            </h2>
          </Reveal>
          <Reveal delay={0.05}>
            <p className="text-ink-2 sm:text-right">
              Independence Day · 00:00 IST
              <br />
              <span className="font-semibold text-saffron">#FreedomFromPotholes</span>
            </p>
          </Reveal>
        </div>

        {/* countdown */}
        <Reveal delay={0.1}>
          <div className="border-b border-line py-14">
            <Countdown />
          </div>
        </Reveal>

        {/* CTA */}
        <Reveal delay={0.1}>
          <div className="mt-12 flex flex-col items-start gap-6 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-md text-lg text-ink-2">
              {typeof count === "number" && count > 0 ? (
                <>
                  Every phone makes the proof harder to ignore.{" "}
                  <span className="font-semibold text-ink">
                    {count.toLocaleString("en-IN")}
                  </span>{" "}
                  have added theirs. Add yours.
                </>
              ) : (
                <>
                  Every phone makes the proof harder to ignore. Add yours — and
                  help end the age of helplessness.
                </>
              )}
            </p>
            <MagneticButton
              onClick={open}
              aria-label="Join the movement"
              strength={0.4}
              className="rounded-full bg-ink px-9 py-4 font-display text-lg font-semibold text-paper shadow-[0_14px_34px_-12px_rgba(10,10,10,0.55)] transition-colors hover:bg-saffron"
            >
              Join the movement
            </MagneticButton>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
