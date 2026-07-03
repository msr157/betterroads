import { useRef } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import ScrollTrigger from 'gsap/ScrollTrigger';
import DrawSVGPlugin from 'gsap/DrawSVGPlugin';
import Reveal from '@/components/ui/Reveal';

gsap.registerPlugin(ScrollTrigger, DrawSVGPlugin, useGSAP);

const LOOP_D = 'M 400 160 C 360 70 200 70 200 160 C 200 250 360 250 400 160 C 440 70 600 70 600 160 C 600 250 440 250 400 160 Z';

export default function TheProblem() {
  const scopeRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLDivElement>(null);
  const imgWrapRef = useRef<HTMLDivElement>(null);
  const loopRef = useRef<HTMLDivElement>(null);

  useGSAP(() => {
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (!reduced && imgRef.current) {
      gsap.fromTo(
        imgRef.current,
        { yPercent: -8 },
        {
          yPercent: 8, ease: 'none',
          scrollTrigger: { trigger: imgWrapRef.current, start: 'top bottom', end: 'bottom top', scrub: true },
        },
      );
    }

    const labels = gsap.utils.toArray<SVGElement>('.loop-label');
    if (reduced) {
      gsap.set(['.loop-path', '.loop-break'], { drawSVG: '100%' });
      gsap.set([labels, '.loop-break-label'], { opacity: 1 });
      return;
    }

    gsap.set('.loop-path', { drawSVG: '0%' });
    gsap.set('.loop-break', { drawSVG: '0%' });
    gsap.set([labels, '.loop-break-label'], { opacity: 0 });

    const tl = gsap.timeline({ scrollTrigger: { trigger: loopRef.current, start: 'top 72%', once: true } });
    tl.to('.loop-path', { drawSVG: '100%', duration: 1.5, ease: 'power1.inOut' })
      .to(labels, { opacity: 1, duration: 0.6, stagger: 0.08 }, '-=0.6')
      .to('.loop-break', { drawSVG: '100%', duration: 0.5, ease: 'power2.in' }, '+=0.3')
      .to('.loop-break-label', { opacity: 1, duration: 0.5 }, '-=0.1');

    return () => ScrollTrigger.getAll().forEach((s) => s.kill());
  }, { scope: scopeRef });

  return (
    <section id="problem" ref={scopeRef} style={{ position: 'relative', background: '#161310', color: 'var(--color-paper)' }}>
      {/* Intro */}
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '10rem 2.5rem 4rem' }}>
        <Reveal><p className="eyebrow" style={{ color: 'var(--color-saffron)' }}>The problem</p></Reveal>
        <Reveal delay={0.05}>
          <h2
            className="font-display"
            style={{ marginTop: '1.5rem', maxWidth: '52rem', fontSize: 'clamp(2.3rem, 5.8vw, 4.5rem)', fontWeight: 700, lineHeight: 1.04, letterSpacing: '-0.02em' }}
          >
            The pothole is not the problem.<br />
            <span style={{ opacity: 0.45 }}>It's the symptom.</span>
          </h2>
        </Reveal>
      </div>

      {/* Full-bleed photo */}
      <div ref={imgWrapRef} className="h-photo-band" style={{ position: 'relative', width: '100%', overflow: 'hidden' }}>
        <div ref={imgRef} style={{ position: 'absolute', inset: '-9%', willChange: 'transform' }}>
          <div style={{
            height: '118%', width: '100%', background: 'linear-gradient(135deg, #2a1f14 0%, #161310 40%, #1a1208 100%)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            <div style={{ textAlign: 'center', opacity: 0.3 }}>
              <div style={{ fontSize: '5rem' }}>🛣️</div>
              <p style={{ color: 'var(--color-paper)', fontFamily: 'var(--font-display)', fontSize: '1rem', letterSpacing: '0.2em', textTransform: 'uppercase' }}>
                Crumbling infrastructure
              </p>
            </div>
          </div>
        </div>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, #161310, transparent, #161310)' }} />
        <p className="eyebrow" style={{ position: 'absolute', bottom: '1.5rem', left: '2.5rem', color: 'rgba(244,240,232,0.6)' }}>
          The problem we see
        </p>
      </div>

      {/* The deeper truth */}
      <div style={{ maxWidth: '72rem', margin: '0 auto', padding: '6rem 2.5rem 10rem' }}>
        <div style={{ display: 'grid', gap: '2.5rem', gridTemplateColumns: 'auto 1fr' }}>
          <Reveal>
            <p className="eyebrow" style={{ whiteSpace: 'nowrap', color: 'rgba(244,240,232,0.45)' }}>The problem we don't see</p>
          </Reveal>
          <div>
            <Reveal>
              <h3 className="font-display" style={{ maxWidth: '40rem', fontSize: 'clamp(1.8rem, 3.6vw, 3rem)', fontWeight: 700, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
                The real damage is invisible.
              </h3>
            </Reveal>
            <Reveal delay={0.05}>
              <p style={{ marginTop: '1.5rem', maxWidth: '36rem', fontSize: '1.125rem', lineHeight: 1.7, color: 'rgba(244,240,232,0.6)' }}>
                A rigid system. No accountability. No memory. And a whole generation, quietly taught the same lesson — that nothing will ever change.
              </p>
            </Reveal>
          </div>
        </div>

        {/* The broken loop SVG */}
        <div ref={loopRef} style={{ marginTop: '6rem' }}>
          <svg viewBox="0 0 800 320" style={{ display: 'block', width: '100%', maxWidth: '48rem', margin: '0 auto' }} aria-hidden>
            <path className="loop-path" d={LOOP_D} fill="none" stroke="#5b5348" strokeWidth={3} strokeLinecap="round" />
            <text className="loop-label" x="300" y="150" textAnchor="middle" fill="#f4f0e8" fontSize="19" fontWeight="700" fontFamily="var(--font-display)">Government</text>
            <text className="loop-label" x="300" y="178" textAnchor="middle" fill="#8a8175" fontSize="12" letterSpacing="2">RIGID · OPAQUE</text>
            <text className="loop-label" x="500" y="150" textAnchor="middle" fill="#f4f0e8" fontSize="19" fontWeight="700" fontFamily="var(--font-display)">Citizens</text>
            <text className="loop-label" x="500" y="178" textAnchor="middle" fill="#8a8175" fontSize="12" letterSpacing="2">TIRED · HELPLESS</text>
            <path className="loop-break" d="M 330 92 L 470 228" fill="none" stroke="#e0611c" strokeWidth={5} strokeLinecap="round" />
            <text className="loop-break-label" x="400" y="300" textAnchor="middle" fill="#e0611c" fontSize="13" fontWeight="600" letterSpacing="3">BETTERROADS BREAKS THE LOOP</text>
          </svg>
          <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.875rem', color: 'rgba(244,240,232,0.4)' }}>
            Each side trained the other. No pressure. No progress.
          </p>
        </div>

        {/* Gut-punch */}
        <div style={{ marginTop: '7rem', textAlign: 'center' }}>
          <Reveal>
            <h3 className="font-display" style={{ fontSize: 'clamp(2.7rem, 7.5vw, 6rem)', fontWeight: 800, letterSpacing: '-0.02em' }}>
              Helplessness. <span style={{ opacity: 0.4 }}>Inherited.</span>
            </h3>
          </Reveal>
          <Reveal delay={0.08}>
            <p style={{ margin: '2rem auto 0', maxWidth: '36rem', fontSize: 'clamp(1rem, 2vw, 1.25rem)', lineHeight: 1.7, color: 'rgba(244,240,232,0.6)' }}>
              We didn't lose the roads. We lost the belief that they could be fixed.
            </p>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
