import { useState, useRef, useEffect } from 'react';
import gsap from 'gsap';
import { useGSAP } from '@gsap/react';
import { useUnveil } from '../providers/UnveilProvider';
import { API_URL } from '@/lib/constants';

gsap.registerPlugin(useGSAP);

export default function Veil() {
  const { isUnveiled } = useUnveil();
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [shouldRender, setShouldRender] = useState(true);
  
  const containerRef = useRef<HTMLDivElement>(null);
  const leftPanelRef = useRef<HTMLDivElement>(null);
  const rightPanelRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);

  // When isUnveiled changes to true, trigger animation
  useGSAP(() => {
    if (isUnveiled === true && shouldRender) {
      const tl = gsap.timeline({
        onComplete: () => {
          setShouldRender(false);
        }
      });
      
      // Fade out content
      tl.to(contentRef.current, { opacity: 0, duration: 0.3, ease: 'power2.out' })
        // Split panels
        .to(leftPanelRef.current, { xPercent: -100, duration: 1.2, ease: 'power3.inOut' }, '+=0.2')
        .to(rightPanelRef.current, { xPercent: 100, duration: 1.2, ease: 'power3.inOut' }, '<');
    }
  }, [isUnveiled, shouldRender]);

  // If already unveiled on initial load, just don't render (skip animation to save time)
  useEffect(() => {
    if (isUnveiled === true && document.readyState === 'complete') {
      // Actually, we want to animate even if it's true on load? No, if someone refreshes after it's unlocked, they just see the site.
      // But if it JUST became true, it animates.
      // We handle this by checking if the initial load was true.
    }
  }, []);

  if (!shouldRender || isUnveiled === null) return null;

  // If it's already unveiled initially before we even mounted, we shouldn't render
  // Wait, if isUnveiled is true initially, it will animate. That's a fun effect. 
  // Let's just let it animate every time if they refresh within the first few seconds?
  // No, to avoid annoyance, if we want to skip animation on hard refresh when unveiled:
  // We can't easily know if it's a hard refresh vs live push without extra state. 
  // Actually, animating once on load is fine. It acts as an "intro".

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_URL}/api/launch/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: code }),
      });
      if (!res.ok) {
        setError('Incorrect access code');
      }
      // If ok, the SSE will automatically flip `isUnveiled` to true and trigger animation!
    } catch (err) {
      setError('Connection error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div 
      ref={containerRef}
      style={{
        position: 'fixed', inset: 0, zIndex: 99999, 
        display: 'flex', overflow: 'hidden',
        pointerEvents: 'auto'
      }}
    >
      {/* Left Panel */}
      <div 
        ref={leftPanelRef}
        style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: '50vw',
          backgroundColor: '#0a0a0a', borderRight: '1px solid rgba(224,97,28,0.2)',
          willChange: 'transform'
        }}
      />
      
      {/* Right Panel */}
      <div 
        ref={rightPanelRef}
        style={{
          position: 'absolute', right: 0, top: 0, bottom: 0, width: '50vw',
          backgroundColor: '#0a0a0a', borderLeft: '1px solid rgba(224,97,28,0.2)',
          willChange: 'transform'
        }}
      />

      {/* Content Container (centered over the split) */}
      <div 
        ref={contentRef}
        style={{
          position: 'absolute', inset: 0, display: 'flex', 
          flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          color: 'var(--color-paper)'
        }}
      >
        <div style={{ maxWidth: '400px', width: '90%', textAlign: 'center' }}>
          <p className="eyebrow" style={{ color: 'var(--color-saffron)', marginBottom: '1.5rem' }}>
            Classified Access
          </p>
          <h1 className="font-display" style={{ fontSize: '2.5rem', fontWeight: 700, marginBottom: '2rem' }}>
            The Loop is Currently Locked.
          </h1>
          
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
            <input
              type="password"
              placeholder="Enter Access Key"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              style={{
                width: '100%', padding: '1rem 1.5rem', fontSize: '1.125rem',
                backgroundColor: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                color: 'white', borderRadius: '8px', outline: 'none', textAlign: 'center'
              }}
              disabled={loading || isUnveiled === true}
            />
            {error && <p style={{ color: '#ef4444', fontSize: '0.875rem' }}>{error}</p>}
            <button
              type="submit"
              disabled={loading || isUnveiled === true || !code}
              className="font-display"
              style={{
                padding: '1rem', background: 'var(--color-paper)', color: 'var(--color-ink)',
                border: 'none', borderRadius: '8px', fontSize: '1.125rem', fontWeight: 600,
                cursor: (loading || isUnveiled === true || !code) ? 'not-allowed' : 'pointer',
                opacity: (loading || isUnveiled === true || !code) ? 0.5 : 1,
                transition: 'opacity 0.2s'
              }}
            >
              {loading ? 'Verifying...' : 'Unlock'}
            </button>
          </form>

          <p style={{ marginTop: '2rem', fontSize: '0.875rem', color: 'rgba(244,240,232,0.4)' }}>
            Awaiting global authorization...
          </p>
        </div>
      </div>
    </div>
  );
}
