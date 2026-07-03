import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import ScrollTrigger from 'gsap/ScrollTrigger';
import MotionPathPlugin from 'gsap/MotionPathPlugin';
import DrawSVGPlugin from 'gsap/DrawSVGPlugin';
import { STEPS } from '@/lib/constants';

gsap.registerPlugin(ScrollTrigger, MotionPathPlugin, DrawSVGPlugin, useGSAP);

const ROAD_D =
  'M 300 20 C 300 210 140 250 160 460 C 178 650 470 640 440 860 C 415 1055 150 1050 165 1260 C 176 1425 300 1440 300 1585';

const POTHOLE_FRACTIONS = [0.16, 0.32, 0.47, 0.62, 0.78, 0.9];

export default function RoadJourney() {
  const scopeRef  = useRef<HTMLDivElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const basePathRef = useRef<SVGPathElement>(null);

  useGSAP(() => {
    const basePath = basePathRef.current;
    if (!basePath) return;

    const totalLen = basePath.getTotalLength();
    const potholes = gsap.utils.toArray<SVGGElement>('.br-pothole');
    potholes.forEach((g, i) => {
      const f = POTHOLE_FRACTIONS[i] ?? (i + 1) / (potholes.length + 1);
      const pt = basePath.getPointAtLength(totalLen * f);
      g.setAttribute('transform', `translate(${pt.x} ${pt.y})`);
    });

    const steps = gsap.utils.toArray<HTMLLIElement>('.br-step');

    const mm = gsap.matchMedia();
    mm.add(
      {
        isStatic: '(prefers-reduced-motion: reduce), (max-height: 580px)',
        isAnimated: '(prefers-reduced-motion: no-preference) and (min-height: 581px)',
      },
      (ctx) => {
        if (ctx.conditions?.isStatic) {
          gsap.set('.br-road-surface', { drawSVG: '100%' });
          gsap.set('.br-lane', { opacity: 0.95 });
          gsap.set('.br-broken', { opacity: 0 });
          gsap.set('.br-fixed', { opacity: 1, scale: 1, transformOrigin: 'center' });
          gsap.set('.br-repair-ring', { opacity: 0 });
          gsap.set('.br-truck', { opacity: 0 });
          gsap.set(steps, { opacity: 1 });
          return;
        }

        gsap.set('.br-road-surface', { drawSVG: '0%' });
        gsap.set('.br-lane', { opacity: 0 });
        gsap.set('.br-broken', { opacity: 1, transformOrigin: 'center' });
        gsap.set('.br-fixed', { opacity: 0, scale: 0.4, transformOrigin: 'center' });
        gsap.set('.br-repair-ring', { opacity: 0, scale: 0.2, transformOrigin: 'center' });
        gsap.set('.br-truck', { opacity: 1 });
        gsap.set(steps, { opacity: 0.35 });

        const DUR = 10;

        const tl = gsap.timeline({
          defaults: { ease: 'none' },
          scrollTrigger: { trigger: sectionRef.current, start: 'top top', end: 'bottom bottom', scrub: 1 },
        });

        tl.to('.br-road-surface', { drawSVG: '100%', duration: DUR }, 0)
          .to('.br-lane', { opacity: 0.95, duration: DUR }, 0)
          .to('.br-truck', {
            duration: DUR, immediateRender: true,
            motionPath: { path: '.br-road-surface', align: '.br-road-surface', alignOrigin: [0.5, 0.5], autoRotate: true },
          }, 0);

        potholes.forEach((g, i) => {
          const f = POTHOLE_FRACTIONS[i] ?? (i + 1) / (potholes.length + 1);
          const at = f * DUR;
          const broken = g.querySelector('.br-broken');
          const fixed  = g.querySelector('.br-fixed');
          const ring   = g.querySelector('.br-repair-ring');
          tl.to(broken, { opacity: 0, scale: 0.3, duration: 0.5 }, at)
            .to(ring, { opacity: 0.9, scale: 1.8, duration: 0.5 }, at)
            .to(ring, { opacity: 0, duration: 0.4 }, at + 0.4)
            .to(fixed, { opacity: 1, scale: 1, duration: 0.5, ease: 'back.out(2)' }, at + 0.15);
        });

        steps.forEach((card, i) => {
          const at = i * (DUR / 3) + 0.4;
          tl.to(card, { opacity: 1, duration: 0.8 }, at);
        });
      },
    );
  }, { scope: scopeRef });

  return (
    <section
      id="journey"
      ref={sectionRef}
      className="road-stage"
      aria-label="How BetterRoads works: detect, report, repair"
    >
      <div ref={scopeRef} className="road-pin">
        <div style={{
          display: 'grid', height: '100%', maxWidth: '72rem', margin: '0 auto',
          gridTemplateRows: 'auto minmax(0,1fr) auto', gap: '0.75rem',
          padding: '4.75rem 2.5rem 2rem',
        }}>
          {/* Heading */}
          <div style={{ textAlign: 'center', alignSelf: 'start' }}>
            <p className="eyebrow">How it works</p>
            <h2
              className="font-display"
              style={{ marginTop: '0.75rem', fontSize: 'clamp(1.6rem, 5.2vw, 3rem)', fontWeight: 700, lineHeight: 1.05, letterSpacing: '-0.02em', color: 'var(--color-ink)' }}
            >
              You just drive.<br />Your phone does <span style={{ color: 'var(--color-green)' }}>the rest.</span>
            </h2>
          </div>

          {/* Road SVG */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg
              viewBox="0 0 600 1600"
              preserveAspectRatio="xMidYMid meet"
              className="road-svg"
              aria-hidden
            >
              <path d={ROAD_D} fill="none" stroke="#d8cfbd" strokeWidth={94} strokeLinecap="round" strokeLinejoin="round" />
              <path ref={basePathRef} className="br-road-surface" d={ROAD_D} fill="none" stroke="#26221c" strokeWidth={90} strokeLinecap="round" strokeLinejoin="round" />
              <path className="br-lane" d={ROAD_D} fill="none" stroke="#e0611c" strokeWidth={5} strokeLinecap="round" strokeDasharray="2 34" />

              {POTHOLE_FRACTIONS.map((_, i) => (
                <g key={i} className="br-pothole">
                  <g className="br-broken">
                    <ellipse rx={30} ry={15} fill="#0c0a08" />
                    <path d="M -22 -4 L -6 2 L -14 9" fill="none" stroke="#5b5248" strokeWidth={2} />
                    <path d="M 20 -6 L 6 -1 L 16 6" fill="none" stroke="#5b5248" strokeWidth={2} />
                  </g>
                  <circle className="br-repair-ring" r={26} fill="none" stroke="#1b7a43" strokeWidth={4} />
                  <g className="br-fixed">
                    <ellipse rx={32} ry={16} fill="#39342c" />
                    <ellipse rx={32} ry={16} fill="none" stroke="#1b7a43" strokeWidth={2.5} opacity={0.8} />
                    <path d="M -8 0 L -2 6 L 10 -6" fill="none" stroke="#22c55e" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round" />
                  </g>
                </g>
              ))}

              {/* Repair truck */}
              <g className="br-truck">
                <ellipse cx={0} cy={17} rx={26} ry={6} fill="#17140f" opacity={0.22} />
                <rect x={-26} y={-15} width={52} height={30} rx={7} fill="#e0611c" />
                <rect x={6} y={-11} width={14} height={22} rx={3} fill="#26221c" />
                <circle cx={22} cy={-9} r={2.4} fill="#f4f0e8" />
                <circle cx={22} cy={9} r={2.4} fill="#f4f0e8" />
              </g>
            </svg>
          </div>

          {/* Steps list */}
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <ol style={{ width: '100%', margin: 0, padding: 0, listStyle: 'none' }}>
              {STEPS.map((step) => (
                <li
                  key={step.id}
                  className="br-step"
                  style={{
                    display: 'flex', gap: '1rem',
                    borderTop: '1px solid var(--color-line)', padding: '0.75rem 0',
                  }}
                >
                  <span className="font-display" style={{ fontWeight: 700, fontSize: '1.125rem', color: 'var(--color-saffron)', flexShrink: 0 }}>
                    {step.index}
                  </span>
                  <div>
                    <h3 className="font-display" style={{ fontSize: 'clamp(1.1rem, 4.4vw, 1.6rem)', fontWeight: 700, lineHeight: 1.2, letterSpacing: '-0.01em', color: 'var(--color-ink)' }}>
                      {step.title}
                    </h3>
                    <p style={{ marginTop: '0.25rem', maxWidth: '28rem', fontSize: '0.9375rem', lineHeight: 1.6, color: 'var(--color-ink-2)' }}>
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
