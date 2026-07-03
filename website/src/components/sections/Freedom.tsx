
import Reveal from "@/components/ui/Reveal";
import Flag from "@/components/ui/Flag";
import { SITE } from "@/lib/constants";

export default function Freedom() {
  return (
    <section
      id="freedom"
      className="relative overflow-hidden bg-paper px-6 py-36 sm:px-10 sm:py-52"
    >
      {/* faint warm glow — a soft radial gradient, no blur filter (a 130px
          blur forces expensive re-rasterization on weak GPUs) */}
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-1/2 h-[620px] w-[1100px] max-w-[95vw] -translate-x-1/2 -translate-y-1/2"
        style={{
          background:
            "radial-gradient(closest-side, rgba(224,97,28,0.1), rgba(224,97,28,0.04) 55%, transparent 75%)",
        }}
      />

      <div className="relative mx-auto max-w-5xl text-center">
        <Reveal>
          <p className="eyebrow">A second freedom · 15 August 2026</p>
        </Reveal>

        <Reveal delay={0.05}>
          <h2 className="mt-10 font-display text-[clamp(2.4rem,6.8vw,6rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
            In 1947, we won a country.
          </h2>
        </Reveal>

        <Reveal delay={0.1}>
          <Flag className="mx-auto my-9 h-11 w-[4.125rem] shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)] sm:my-11" />
        </Reveal>

        <Reveal delay={0.12}>
          <h2 className="font-display text-[clamp(2.4rem,6.8vw,6rem)] font-extrabold leading-[0.98] tracking-[-0.03em] text-ink">
            This year, we take back{" "}
            <span className="text-tricolor">our streets.</span>
          </h2>
        </Reveal>

        <Reveal delay={0.18}>
          <p className="mt-12 font-hindi text-2xl text-ink sm:text-3xl" lang="hi">
            {SITE.taglineHindi}
          </p>
        </Reveal>
      </div>
    </section>
  );
}
