import { useState, useEffect } from "react";
import { motion, type Variants } from "framer-motion";
import MagneticButton from "@/components/ui/MagneticButton";
import { SocialIcon } from "@/components/ui/SocialIcons";
import Countdown from "@/components/countdown/Countdown";
import VideoModal from "@/components/ui/VideoModal";
import { useWaitlist } from "@/components/providers/WaitlistProvider";
import { useReducedMotion } from "@/hooks/useReducedMotion";
import { SITE, SOCIALS, LEGAL, LAUNCH_DATE_ISO } from "@/lib/constants";
import Confetti from "@/components/ui/Confetti";
import Flag from "@/components/ui/Flag";


const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.1, delayChildren: 0.05 } },
};

const line: Variants = {
  hidden: { y: "110%" },
  show: { y: "0%", transition: { duration: 0.95, ease: [0.22, 1, 0.36, 1] } },
};

const fade: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: [0.22, 1, 0.36, 1] } },
};

/** Mask-reveal wrapper — the line rises up from behind an overflow-clip. */
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
  const [videoOpen, setVideoOpen] = useState(false);

  return (
    <section className="relative flex min-h-viewport flex-col overflow-hidden px-6 pb-8 pt-7 sm:px-10">
      <motion.div
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col"
        variants={container}
        initial={reduced ? false : "hidden"}
        animate="show"
      >
        {/* ── Masthead: wordmark · launch eyebrow · socials ─────────────── */}
        <motion.header
          variants={fade}
          className="flex items-center gap-4 border-b border-line pb-5"
        >
          <a href="#top" className="font-display text-lg font-bold tracking-tight text-ink">
            {SITE.wordmark}
            <span className="text-saffron">.</span>
          </a>

          <span className="eyebrow ml-auto hidden sm:inline">
            {SITE.launchLabel}
          </span>

          <div className="flex items-center gap-3 sm:ml-6 sm:pl-6 sm:border-l sm:border-line">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                aria-label={s.label}
                target="_blank"
                rel="noreferrer"
                className="text-ink-3 transition-colors hover:text-ink"
              >
                <SocialIcon label={s.label} className="h-[1.15rem] w-[1.15rem]" />
              </a>
            ))}
          </div>
        </motion.header>

        {/* ── The anticipation core, centered in the fold ──────────────── */}
        <div className="flex flex-1 flex-col items-center justify-center py-8 text-center">
          {/* quiet intrigue — the mother tongue whisper */}
          <motion.p
            variants={fade}
            className="font-hindi mb-6 text-[clamp(1rem,2.2vw,1.4rem)] font-medium tracking-tight text-ink-2"
          >
            {SITE.taglineHindi}
          </motion.p>

          {/* the statement — one monumental line. Breaks OUT of the max-w-6xl
              column to span nearly the full viewport, so the words stretch wide
              across the screen. Sized in container units (cqi) against that
              viewport-wide box, so it always fills the width on one line at any
              laptop size / aspect ratio and can never run off-screen. Wraps to
              two lines only on phones. Uses the macOS-native display stack
              (San Francisco) per the requested look. */}
          <div
            className="w-screen px-4 text-center sm:px-8"
            style={{ containerType: 'inline-size' }}
          >
            <h1
              className="text-center font-extrabold leading-[0.92] tracking-[-0.04em] text-ink whitespace-normal sm:whitespace-nowrap"
              style={{ fontFamily: 'var(--font-system)', fontSize: 'clamp(2.75rem, 8.5cqi, 12rem)' }}
            >
              <Line>
                Freedom from <span className="text-saffron">Potholes.</span>
              </Line>
            </h1>
          </div>

          {/* the promise — small, so the headline breathes */}
          <motion.p
            variants={fade}
            className="mt-7 max-w-md font-display text-[clamp(1rem,1.6vw,1.2rem)] font-semibold leading-snug tracking-[-0.01em] text-ink-2"
          >
            To fix the roads, let&apos;s fix the system.
          </motion.p>

          {/* ── Dynamic Launch Content ────────────────── */}
          <LaunchContent openWaitlist={open} setVideoOpen={setVideoOpen} />
        </div>

        {/* ── Footer hairline — the single recurring tricolor motif ────── */}
        <motion.footer variants={fade} className="mt-auto">
          <div className="flag-rule h-px w-full opacity-70" />
          <div className="flex flex-wrap items-center justify-between gap-3 pt-4">
            <span className="eyebrow">A citizen movement for India&apos;s roads</span>
            <div className="flex items-center gap-5">
              <a href="/privacy" className="eyebrow transition-colors hover:text-ink">
                Privacy
              </a>
              <a href="/terms" className="eyebrow transition-colors hover:text-ink">
                Terms
              </a>
              <span className="eyebrow hidden sm:inline">© {SITE.name}</span>
            </div>
          </div>
          <p className="pt-3 text-xs leading-relaxed text-ink-3">
            Better Roads is a civic initiative operated by {LEGAL.companyName}.
          </p>
        </motion.footer>
      </motion.div>

      <VideoModal open={videoOpen} onClose={() => setVideoOpen(false)} />
    </section>
  );
}

function LaunchContent({ openWaitlist, setVideoOpen }: { openWaitlist: () => void; setVideoOpen: (v: boolean) => void }) {
  const [isLaunched, setIsLaunched] = useState(() => Date.now() >= new Date(LAUNCH_DATE_ISO).getTime());

  useEffect(() => {
    if (isLaunched) return;
    const interval = setInterval(() => {
      if (Date.now() >= new Date(LAUNCH_DATE_ISO).getTime()) setIsLaunched(true);
    }, 1000);
    return () => clearInterval(interval);
  }, [isLaunched]);

  if (isLaunched) {
    return (
      <motion.div variants={fade} className="mt-12 flex w-full flex-col items-center">
        <Confetti trigger={1} />
        <div className="flex items-center gap-4">
          <Flag className="w-12 h-8 rounded-sm shadow-sm" />
          <p className="font-display text-[clamp(1.5rem,4vw,2.5rem)] font-bold text-ink">
            Happy Independence Day!
          </p>
          <Flag className="w-12 h-8 rounded-sm shadow-sm" />
        </div>
        <p className="mt-4 max-w-lg text-center font-medium text-ink-2">
          We are officially live. Join the citizen movement to fix India's roads today.
        </p>
        <div className="mt-8 flex flex-col items-center gap-6 sm:flex-row sm:gap-8">
          <a
            href="/app"
            className="rounded-full bg-saffron px-11 py-4.5 font-display text-lg font-semibold text-paper shadow-[0_18px_44px_-14px_rgba(224,97,28,0.7)] transition-colors hover:bg-ink"
          >
            Download the App
          </a>
          <a
            href="/map"
            className="font-medium text-ink-2 transition-colors hover:text-ink"
          >
            Explore the public map →
          </a>
        </div>
      </motion.div>
    );
  }

  return (
    <>
      <motion.div variants={fade} className="mt-12 w-full max-w-3xl">
        <p className="eyebrow mb-4">Launching 15 August 2026</p>
        <Countdown />
      </motion.div>

      <motion.div
        variants={fade}
        className="mt-12 flex flex-col items-center gap-6 sm:flex-row sm:gap-8"
      >
        <span className="relative">
          <span
            aria-hidden
            className="pointer-events-none absolute inset-0 -z-10 rounded-full bg-saffron/30 blur-2xl"
          />
          <MagneticButton
            onClick={openWaitlist}
            aria-label="Join the movement"
            className="rounded-full bg-saffron px-11 py-4.5 font-display text-lg font-semibold text-paper shadow-[0_18px_44px_-14px_rgba(224,97,28,0.7)] transition-colors hover:bg-ink"
          >
            Join the movement
          </MagneticButton>
        </span>

        <button
          onClick={() => setVideoOpen(true)}
          className="group inline-flex items-center gap-3 font-display text-base font-semibold text-ink transition-colors hover:text-saffron"
        >
          <span className="flex h-11 w-11 items-center justify-center rounded-full border border-line-strong text-ink transition-colors group-hover:border-saffron group-hover:text-saffron">
            <svg viewBox="0 0 24 24" fill="currentColor" className="ml-0.5 h-4 w-4">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
          What is BetterRoads?
        </button>
      </motion.div>

      <motion.div
        variants={fade}
        className="mt-9 flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
      >
        <a href="/app" className="link-underline text-sm font-semibold text-saffron">
          Download the Android app →
        </a>
        <a
          href="/map"
          className="link-underline text-sm font-medium text-ink-2 transition-colors hover:text-ink"
        >
          Explore the public panel →
        </a>
      </motion.div>
    </>
  );
}
