
import { motion, type Variants } from "framer-motion";
import MagneticButton from "@/components/ui/MagneticButton";
import Flag from "@/components/ui/Flag";
import Countdown from "@/components/countdown/Countdown";
import { useWaitlist } from "@/components/providers/WaitlistProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const line: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

const fade: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

function Line({ children }: { children: React.ReactNode }) {
  return (
    <span className="block overflow-hidden pb-[0.06em]">
      <motion.span variants={line} className="block">
        {children}
      </motion.span>
    </span>
  );
}

export default function Hero() {
  const { open } = useWaitlist();
  const reduced = useReducedMotion();

  return (
    <section className="relative flex min-h-viewport flex-col overflow-hidden px-6 pb-16 pt-24 sm:px-10 sm:pt-28">
      <motion.div
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col"
        variants={container}
        initial={reduced ? false : "hidden"}
        animate="show"
      >
        {/* masthead */}
        <motion.div
          variants={fade}
          className="flex items-center gap-4 border-b border-line pb-6"
        >
          <Flag className="h-4 w-6 shrink-0" />
          <span className="eyebrow">A citizen movement for India&apos;s roads</span>
          <span className="ml-auto hidden items-center gap-2 rounded-full bg-ink px-3.5 py-1.5 text-sm font-semibold text-paper sm:flex">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-saffron opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-saffron" />
            </span>
            This 15th August
          </span>
        </motion.div>

        {/* headline spread: statement left, thesis + CTA right */}
        <div className="grid flex-1 content-center gap-10 py-8 lg:grid-cols-[1.5fr_1fr] lg:items-end lg:gap-16">
          <h1 className="font-display text-[clamp(2.6rem,min(11vw,15vh),8.5rem)] font-extrabold leading-[0.92] tracking-[-0.03em] text-ink lg:whitespace-nowrap lg:text-[clamp(3rem,min(6.2vw,14vh),6.75rem)]">
            <Line>Freedom from</Line>
            <Line>
              <span className="text-saffron">potholes.</span>
            </Line>
          </h1>

          <motion.div variants={fade} className="flex flex-col items-start gap-7 lg:pb-3">
            <p className="font-display text-[clamp(1.25rem,1.8vw,1.6rem)] font-semibold leading-snug tracking-[-0.01em] text-saffron">
              To fix the roads,
              <br />
              let&apos;s fix the system.
            </p>
            <div className="flex flex-wrap items-center gap-x-7 gap-y-4">
              <MagneticButton
                onClick={open}
                aria-label="Join the movement"
                className="rounded-full bg-saffron px-9 py-4 font-display text-lg font-semibold text-paper shadow-[0_14px_34px_-12px_rgba(224,97,28,0.6)] transition-colors hover:bg-ink"
              >
                Join the movement
              </MagneticButton>
              <a
                href="#journey"
                className="link-underline font-display text-base font-semibold text-ink"
              >
                See how it works
              </a>
            </div>
          </motion.div>
        </div>

        {/* the countdown — monumental, anchoring the fold */}
        <motion.div variants={fade} className="border-t border-line pt-7">
          <p className="eyebrow mb-5">15th August</p>
          <Countdown />
        </motion.div>
      </motion.div>
    </section>
  );
}
