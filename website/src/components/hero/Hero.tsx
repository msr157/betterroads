import { motion, type Variants } from 'framer-motion';
import MagneticButton from '@/components/ui/MagneticButton';
import Flag from '@/components/ui/Flag';
import Countdown from '@/components/countdown/Countdown';
import { useWaitlist } from '@/components/providers/WaitlistProvider';
import { useReducedMotion } from '@/hooks/useReducedMotion';

const container: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.05 } },
};

const line: Variants = {
  hidden: { y: '110%' },
  show: { y: '0%', transition: { duration: 0.9, ease: [0.22, 1, 0.36, 1] } },
};

const fade: Variants = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1] } },
};

function Line({ children }: { children: React.ReactNode }) {
  return (
    <span style={{ display: 'block', overflow: 'hidden', paddingBottom: '0.06em' }}>
      <motion.span variants={line} style={{ display: 'block' }}>{children}</motion.span>
    </span>
  );
}

export default function Hero() {
  const { open } = useWaitlist();
  const reduced = useReducedMotion();

  return (
    <section
      className="min-h-viewport"
      style={{
        position: 'relative', display: 'flex', flexDirection: 'column',
        overflow: 'hidden', padding: '6rem 2.5rem 4rem',
      }}
    >
      <motion.div
        style={{ display: 'flex', width: '100%', maxWidth: '72rem', margin: '0 auto', flex: 1, flexDirection: 'column' }}
        variants={container}
        initial={reduced ? false : 'hidden'}
        animate="show"
      >
        {/* Masthead */}
        <motion.div
          variants={fade}
          style={{
            display: 'flex', alignItems: 'center', gap: '1rem',
            borderBottom: '1px solid var(--color-line)', paddingBottom: '1.5rem',
          }}
        >
          <Flag style={{ height: '1rem', width: '1.5rem', flexShrink: 0 } as React.CSSProperties} />
          <span className="eyebrow">A citizen movement for India's roads</span>
          <span style={{
            marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem',
            borderRadius: '9999px', background: 'rgba(224,97,28,0.15)',
            padding: '0.375rem 0.875rem', fontSize: '0.875rem', fontWeight: 600, color: 'var(--color-saffron)',
          }}>
            <span style={{ position: 'relative', display: 'flex', height: '0.375rem', width: '0.375rem' }}>
              <span style={{ position: 'absolute', display: 'inline-flex', height: '100%', width: '100%', borderRadius: '9999px', background: 'var(--color-saffron)', opacity: 0.6, animation: 'ping 1s cubic-bezier(0,0,0.2,1) infinite' }} />
              <span style={{ position: 'relative', display: 'inline-flex', height: '0.375rem', width: '0.375rem', borderRadius: '9999px', background: 'var(--color-saffron)' }} />
            </span>
            This 15th August
          </span>
        </motion.div>

        {/* Headline + CTA */}
        <div style={{
          display: 'grid', flex: 1, alignContent: 'center', gap: '2.5rem',
          padding: '2rem 0', gridTemplateColumns: '1fr',
        }}>
          <h1
            className="font-display"
            style={{
              fontSize: 'clamp(2.6rem, min(11vw, 15vh), 8.5rem)',
              fontWeight: 800, lineHeight: 0.92, letterSpacing: '-0.03em', color: 'var(--color-ink)',
            }}
          >
            <Line>Freedom from</Line>
            <Line><span style={{ color: 'var(--color-saffron)' }}>potholes.</span></Line>
          </h1>

          <motion.div variants={fade} style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: '1.75rem' }}>
            <p
              className="font-display"
              style={{ fontSize: 'clamp(1.25rem, 1.8vw, 1.6rem)', fontWeight: 600, lineHeight: 1.3, letterSpacing: '-0.01em', color: 'var(--color-saffron)' }}
            >
              To fix the roads,<br />let's fix the system.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', gap: '1.75rem 1rem' }}>
              <MagneticButton
                onClick={open}
                aria-label="Join the movement"
                className="font-display"
                style={{
                  borderRadius: '9999px', background: 'var(--color-saffron)',
                  padding: '1rem 2.25rem', fontWeight: 600, fontSize: '1.125rem',
                  color: 'var(--color-paper)', border: 'none', cursor: 'pointer',
                  boxShadow: '0 14px 34px -12px rgba(224,97,28,0.6)',
                  transition: 'background 0.2s',
                } as React.CSSProperties}
              >
                Join the movement
              </MagneticButton>
              <a
                href="#journey"
                className="link-underline font-display"
                style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--color-ink)', textDecoration: 'none' }}
              >
                See how it works
              </a>
            </div>
          </motion.div>
        </div>

        {/* Countdown */}
        <motion.div variants={fade} style={{ borderTop: '1px solid var(--color-line)', paddingTop: '1.75rem' }}>
          <p className="eyebrow" style={{ marginBottom: '1.25rem' }}>15th August</p>
          <Countdown />
        </motion.div>
      </motion.div>

      <style>{`
        @keyframes ping {
          75%, 100% { transform: scale(2); opacity: 0; }
        }
      `}</style>
    </section>
  );
}
