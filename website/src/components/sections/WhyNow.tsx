
import Reveal from "@/components/ui/Reveal";

export default function WhyNow() {
  return (
    <section id="why" className="bg-paper px-6 py-32 sm:px-10 sm:py-48">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="eyebrow">Why now</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-10 max-w-4xl font-display text-[clamp(2.3rem,5.8vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            A whole generation is watching the same broken loop.
          </h2>
        </Reveal>

        {/* the beat — inverted black panel */}
        <div className="my-24 rounded-[2.5rem] bg-ink px-6 py-20 sm:my-36 sm:py-28">
          <div className="flex flex-col items-center gap-3 text-center sm:gap-4">
            <Reveal>
              <p className="font-display text-[clamp(2.1rem,4.8vw,3.75rem)] font-bold tracking-[-0.02em] text-paper">
                Purpose exists.
              </p>
            </Reveal>
            <Reveal delay={0.08}>
              <p className="font-display text-[clamp(2.1rem,4.8vw,3.75rem)] font-bold tracking-[-0.02em] text-paper">
                Outrage exists.
              </p>
            </Reveal>
            <Reveal delay={0.16}>
              <p className="font-display text-[clamp(2.1rem,4.8vw,3.75rem)] font-bold tracking-[-0.02em] text-paper">
                Direction is <span className="text-saffron">missing.</span>
              </p>
            </Reveal>
          </div>
        </div>

        <Reveal>
          <h2 className="ml-auto max-w-4xl text-right font-display text-[clamp(2.3rem,5.8vw,4.5rem)] font-bold leading-[1.05] tracking-[-0.02em] text-ink">
            So let&apos;s give it direction — before helplessness is inherited.
          </h2>
        </Reveal>
      </div>
    </section>
  );
}
