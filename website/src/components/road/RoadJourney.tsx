
import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { STEPS } from "@/lib/constants";

// Winding road drawn in a 600 x 1600 viewBox (tall, centered ribbon).
const ROAD_D =
  "M 300 20 C 300 210 140 250 160 460 C 178 650 470 640 440 860 C 415 1055 150 1050 165 1260 C 176 1425 300 1440 300 1585";

const POTHOLE_FRACTIONS = [0.16, 0.32, 0.47, 0.62, 0.78, 0.9];

export default function RoadJourney() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const basePathRef = useRef<SVGPathElement>(null);

  useGSAP(
    () => {
      const basePath = basePathRef.current;
      if (!basePath) return;

      const totalLen = basePath.getTotalLength();
      const potholes = gsap.utils.toArray<SVGGElement>(".br-pothole");
      potholes.forEach((g, i) => {
        const f = POTHOLE_FRACTIONS[i] ?? (i + 1) / (potholes.length + 1);
        const pt = basePath.getPointAtLength(totalLen * f);
        g.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      });

      const steps = gsap.utils.toArray<HTMLDivElement>(".br-step");

      // matchMedia (not a one-time check) so rotating a phone between
      // portrait and landscape tears down / rebuilds the right mode.
      const mm = gsap.matchMedia();
      mm.add(
        {
          isStatic: "(prefers-reduced-motion: reduce), (max-height: 580px)",
          isAnimated:
            "(prefers-reduced-motion: no-preference) and (min-height: 581px)",
        },
        (ctx) => {
          if (ctx.conditions?.isStatic) {
            gsap.set(".br-road-surface", { drawSVG: "100%" });
            gsap.set(".br-lane", { opacity: 0.95 });
            gsap.set(".br-broken", { opacity: 0 });
            gsap.set(".br-fixed", { opacity: 1, scale: 1, transformOrigin: "center" });
            gsap.set(".br-repair-ring", { opacity: 0 });
            gsap.set(".br-truck", { opacity: 0 });
            gsap.set(steps, { opacity: 1 });
            return;
          }

          gsap.set(".br-road-surface", { drawSVG: "0%" });
          gsap.set(".br-lane", { opacity: 0 });
          gsap.set(".br-broken", { opacity: 1, transformOrigin: "center" });
          gsap.set(".br-fixed", { opacity: 0, scale: 0.4, transformOrigin: "center" });
          gsap.set(".br-repair-ring", { opacity: 0, scale: 0.2, transformOrigin: "center" });
          gsap.set(".br-truck", { opacity: 1 });
          gsap.set(steps, { opacity: 0.35 });

          const DUR = 10;

          const tl = gsap.timeline({
            defaults: { ease: "none" },
            scrollTrigger: {
              trigger: sectionRef.current,
              start: "top top",
              end: "bottom bottom",
              scrub: 1,
            },
          });

          tl.to(".br-road-surface", { drawSVG: "100%", duration: DUR }, 0)
            .to(".br-lane", { opacity: 0.95, duration: DUR }, 0)
            .to(
              ".br-truck",
              {
                duration: DUR,
                immediateRender: true,
                motionPath: {
                  path: ".br-road-surface",
                  align: ".br-road-surface",
                  alignOrigin: [0.5, 0.5],
                  autoRotate: true,
                },
              },
              0
            );

          potholes.forEach((g, i) => {
            const f = POTHOLE_FRACTIONS[i] ?? (i + 1) / (potholes.length + 1);
            const at = f * DUR;
            const broken = g.querySelector(".br-broken");
            const fixed = g.querySelector(".br-fixed");
            const ring = g.querySelector(".br-repair-ring");
            tl.to(broken, { opacity: 0, scale: 0.3, duration: 0.5 }, at)
              .to(ring, { opacity: 0.9, scale: 1.8, duration: 0.5 }, at)
              .to(ring, { opacity: 0, duration: 0.4 }, at + 0.4)
              .to(
                fixed,
                { opacity: 1, scale: 1, duration: 0.5, ease: "back.out(2)" },
                at + 0.15
              );
          });

          // Each step illuminates as the truck reaches its stretch of road,
          // and stays lit — so by the end all three read clearly.
          steps.forEach((card, i) => {
            const at = i * (DUR / 3) + 0.4;
            tl.to(card, { opacity: 1, duration: 0.8 }, at);
          });
        }
      );
    },
    { scope: scopeRef }
  );

  return (
    <section
      id="journey"
      ref={sectionRef}
      className="road-stage relative h-[420vh] bg-paper"
      aria-label="How BetterRoads works: detect, report, repair"
    >
      <div
        ref={scopeRef}
        className="road-pin h-viewport sticky top-0 w-full overflow-hidden"
      >
        <div className="mx-auto grid h-full max-w-6xl grid-rows-[auto_minmax(0,1fr)_auto] gap-3 px-6 pb-8 pt-[4.75rem] sm:gap-4 sm:pb-12 lg:grid-cols-[1.05fr_0.95fr] lg:gap-x-16 lg:px-10 lg:py-14">
          {/* heading — top on mobile, top-right on desktop */}
          <div className="row-start-1 self-start text-center lg:col-start-2 lg:row-start-1 lg:pt-8 lg:text-left">
            <p className="eyebrow">How it works</p>
            <h2 className="mt-3 font-display text-[clamp(1.6rem,5.2vw,3rem)] font-bold leading-[1.05] tracking-[-0.02em] text-ink lg:text-[clamp(1.9rem,4.3vh,3rem)]">
              You just drive.
              <br />
              Your phone does <span className="text-green">the rest.</span>
            </h2>
          </div>

          {/* road — middle on mobile, full-height left column on desktop */}
          <div className="row-start-2 flex min-h-0 items-center justify-center lg:col-start-1 lg:row-start-1 lg:row-end-4">
            <svg
              viewBox="0 0 600 1600"
              preserveAspectRatio="xMidYMid meet"
              className="road-svg h-full max-h-full w-auto"
              aria-hidden
            >
              {/* faint upcoming-route guide */}
              <path
                d={ROAD_D}
                fill="none"
                stroke="#d8cfbd"
                strokeWidth={94}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* road surface (drawn on scroll) */}
              <path
                ref={basePathRef}
                className="br-road-surface"
                d={ROAD_D}
                fill="none"
                stroke="#26221c"
                strokeWidth={90}
                strokeLinecap="round"
                strokeLinejoin="round"
              />

              {/* saffron centerline (fades in with the road) */}
              <path
                className="br-lane"
                d={ROAD_D}
                fill="none"
                stroke="#e0611c"
                strokeWidth={5}
                strokeLinecap="round"
                strokeDasharray="2 34"
              />

              {/* potholes */}
              {POTHOLE_FRACTIONS.map((_, i) => (
                <g key={i} className="br-pothole">
                  <g className="br-broken">
                    <ellipse rx={30} ry={15} fill="#0c0a08" />
                    <path d="M -22 -4 L -6 2 L -14 9" fill="none" stroke="#5b5248" strokeWidth={2} />
                    <path d="M 20 -6 L 6 -1 L 16 6" fill="none" stroke="#5b5248" strokeWidth={2} />
                  </g>
                  <circle
                    className="br-repair-ring"
                    r={26}
                    fill="none"
                    stroke="#1b7a43"
                    strokeWidth={4}
                  />
                  <g className="br-fixed">
                    <ellipse rx={32} ry={16} fill="#39342c" />
                    <ellipse rx={32} ry={16} fill="none" stroke="#1b7a43" strokeWidth={2.5} opacity={0.8} />
                    <path d="M -8 0 L -2 6 L 10 -6" fill="none" stroke="#22c55e" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>
              ))}

              {/* repair truck — soft shadow is a plain ellipse; SVG filters
                  are CPU-rasterized every frame and stutter on weak GPUs */}
              <g className="br-truck">
                <ellipse cx={0} cy={17} rx={26} ry={6} fill="#17140f" opacity={0.22} />
                <rect x={-26} y={-15} width={52} height={30} rx={7} fill="#e0611c" />
                <rect x={6} y={-11} width={14} height={22} rx={3} fill="#26221c" />
                <circle cx={22} cy={-9} r={2.4} fill="#f4f0e8" />
                <circle cx={22} cy={9} r={2.4} fill="#f4f0e8" />
              </g>
            </svg>
          </div>

          {/* steps — bottom on mobile, right column on desktop.
              A big, boxless editorial list that lights up with the road. */}
          <div className="row-start-3 flex items-center lg:col-start-2 lg:row-start-2 lg:row-end-4">
            <ol className="w-full">
              {STEPS.map((step) => (
                <li
                  key={step.id}
                  className="br-step flex gap-4 border-t border-line py-3 last:border-b sm:gap-7 sm:py-5 lg:py-[clamp(1rem,2.4vh,1.75rem)]"
                >
                  <span className="font-display text-base font-bold text-saffron sm:text-xl">
                    {step.index}
                  </span>
                  <div>
                    <h3 className="font-display text-[clamp(1.1rem,4.4vw,1.6rem)] font-bold leading-tight tracking-[-0.01em] text-ink lg:text-[clamp(1.35rem,3.3vh,2rem)]">
                      {step.title}
                    </h3>
                    <p className="mt-1 max-w-md text-sm leading-relaxed text-ink-2 sm:mt-2 sm:text-base lg:text-[clamp(0.95rem,2vh,1.125rem)]">
                      {step.body}
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </div>
        </div>
      </div>
    </section>
  );
}
