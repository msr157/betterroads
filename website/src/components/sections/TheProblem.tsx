
import { useRef } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import Reveal from "@/components/ui/Reveal";

// Figure-8 (the broken loop between governance and citizens).
const LOOP_D =
  "M 400 160 C 360 70 200 70 200 160 C 200 250 360 250 400 160 C 440 70 600 70 600 160 C 600 250 440 250 400 160 Z";

export default function TheProblem() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<HTMLDivElement>(null);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Parallax on the photo
      if (!reduced && imgRef.current) {
        gsap.fromTo(
          imgRef.current,
          { yPercent: -8 },
          {
            yPercent: 8,
            ease: "none",
            scrollTrigger: {
              trigger: imgWrapRef.current,
              start: "top bottom",
              end: "bottom top",
              scrub: true,
            },
          }
        );
      }

      // The loop draws, then BetterRoads breaks it
      const labels = gsap.utils.toArray<SVGElement>(".loop-label");
      if (reduced) {
        gsap.set([".loop-path", ".loop-break"], { drawSVG: "100%" });
        gsap.set([labels, ".loop-break-label"], { opacity: 1 });
        return;
      }

      gsap.set(".loop-path", { drawSVG: "0%" });
      gsap.set(".loop-break", { drawSVG: "0%" });
      gsap.set([labels, ".loop-break-label"], { opacity: 0 });

      const tl = gsap.timeline({
        scrollTrigger: { trigger: loopRef.current, start: "top 72%", once: true },
      });
      tl.to(".loop-path", { drawSVG: "100%", duration: 1.5, ease: "power1.inOut" })
        .to(labels, { opacity: 1, duration: 0.6, stagger: 0.08 }, "-=0.6")
        .to(".loop-break", { drawSVG: "100%", duration: 0.5, ease: "power2.in" }, "+=0.3")
        .to(".loop-break-label", { opacity: 1, duration: 0.5 }, "-=0.1");

      return () => ScrollTrigger.getAll().forEach((s) => s.kill());
    },
    { scope: scopeRef }
  );

  return (
    <section
      id="problem"
      ref={scopeRef}
      className="relative bg-ink text-paper"
    >
      {/* intro */}
      <div className="mx-auto max-w-6xl px-6 pt-28 pb-16 sm:px-10 sm:pt-40 sm:pb-24">
        <Reveal>
          <p className="eyebrow text-saffron">The problem</p>
        </Reveal>
        <Reveal delay={0.05}>
          <h2 className="mt-6 max-w-4xl font-display text-[clamp(2.3rem,5.8vw,4.5rem)] font-bold leading-[1.04] tracking-[-0.02em]">
            The pothole is not the problem.
            <br />
            <span className="text-paper/45">It&apos;s the symptom.</span>
          </h2>
        </Reveal>
      </div>

      {/* full-bleed photo */}
      <div ref={imgWrapRef} className="h-photo-band relative w-full overflow-hidden">
        <div ref={imgRef} className="absolute inset-[-9%] will-change-transform">
          {/* plain img + srcset: works identically on the static Netlify
              export and the self-hosted server (no optimizer dependency) */}
          <img
            src="/images/broken-road-1400.jpg"
            srcSet="/images/broken-road-800.jpg 800w, /images/broken-road-1400.jpg 1400w, /images/broken-road.jpg 2400w"
            sizes="100vw"
            alt="A cracked, pothole-ridden flyover above an Indian city skyline under a monsoon sky"
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </div>
        {/* mood overlays */}
        <div className="absolute inset-0 bg-gradient-to-b from-ink via-transparent to-ink" />
        <div className="absolute inset-0 bg-ink/25" />
        <p className="absolute bottom-6 left-6 eyebrow text-paper/60 sm:left-10">
          The problem we see
        </p>
      </div>

      {/* the deeper truth */}
      <div className="mx-auto max-w-6xl px-6 pt-24 pb-28 sm:px-10 sm:pt-32 sm:pb-40">
        <div className="grid gap-10 sm:grid-cols-[auto_1fr] sm:gap-20">
          <Reveal>
            <p className="eyebrow whitespace-nowrap text-paper/45">
              The problem we don&apos;t see
            </p>
          </Reveal>
          <div>
            <Reveal>
              <h3 className="max-w-2xl font-display text-[clamp(1.8rem,3.6vw,3rem)] font-bold leading-[1.1] tracking-[-0.02em]">
                The real damage is invisible.
              </h3>
            </Reveal>
            <Reveal delay={0.05}>
              <p className="mt-6 max-w-xl text-lg leading-relaxed text-paper/60">
                A rigid system. No accountability. No memory. And a whole
                generation, quietly taught the same lesson — that nothing will
                ever change.
              </p>
            </Reveal>
          </div>
        </div>

        {/* the broken loop */}
        <div ref={loopRef} className="mt-24 sm:mt-32">
          <svg viewBox="0 0 800 320" className="mx-auto w-full max-w-3xl" aria-hidden>
            {/* the loop */}
            <path
              className="loop-path"
              d={LOOP_D}
              fill="none"
              stroke="#4a4a4a"
              strokeWidth={3}
              strokeLinecap="round"
            />
            {/* lobe labels */}
            <text className="loop-label" x="300" y="150" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="700" fontFamily="var(--font-bricolage)">Government</text>
            <text className="loop-label" x="300" y="178" textAnchor="middle" fill="#8c8c8c" fontSize="12" letterSpacing="2">RIGID · OPAQUE</text>
            <text className="loop-label" x="500" y="150" textAnchor="middle" fill="#ffffff" fontSize="19" fontWeight="700" fontFamily="var(--font-bricolage)">Citizens</text>
            <text className="loop-label" x="500" y="178" textAnchor="middle" fill="#8c8c8c" fontSize="12" letterSpacing="2">TIRED · HELPLESS</text>
            {/* the break */}
            <path
              className="loop-break"
              d="M 330 92 L 470 228"
              fill="none"
              stroke="#e0611c"
              strokeWidth={5}
              strokeLinecap="round"
            />
            <text className="loop-break-label" x="400" y="300" textAnchor="middle" fill="#e0611c" fontSize="13" fontWeight="600" letterSpacing="3">BETTERROADS BREAKS THE LOOP</text>
          </svg>
          <p className="mt-6 text-center text-sm text-paper/40">
            Each side trained the other. No pressure. No progress.
          </p>
        </div>

        {/* the gut-punch */}
        <div className="mt-28 text-center sm:mt-36">
          <Reveal>
            <h3 className="font-display text-[clamp(2.7rem,7.5vw,6rem)] font-extrabold tracking-[-0.02em]">
              Helplessness. <span className="text-paper/40">Inherited.</span>
            </h3>
          </Reveal>
          <Reveal delay={0.08}>
            <p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-paper/60 sm:text-xl">
              We didn&apos;t lose the roads. We lost the belief that they could be
              fixed.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
