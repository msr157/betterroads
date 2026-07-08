import { useEffect } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { VIDEO_URL } from '@/lib/constants';

type Props = {
  open: boolean;
  onClose: () => void;
};

/**
 * Turn a YouTube / Vimeo share or watch URL into its embeddable form.
 * Returns null for anything we don't recognise (→ placeholder card).
 */
function toEmbedUrl(raw: string): string | null {
  const url = raw.trim();
  if (!url) return null;

  // YouTube: youtu.be/ID, youtube.com/watch?v=ID, youtube.com/embed/ID, /shorts/ID
  const yt =
    url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/|shorts\/))([\w-]{6,})/i);
  if (yt) {
    return `https://www.youtube.com/embed/${yt[1]}?autoplay=1&rel=0&modestbranding=1`;
  }

  // Vimeo: vimeo.com/ID or player.vimeo.com/video/ID
  const vimeo = url.match(/vimeo\.com\/(?:video\/)?(\d+)/i);
  if (vimeo) {
    return `https://player.vimeo.com/video/${vimeo[1]}?autoplay=1&title=0&byline=0&portrait=0`;
  }

  return null;
}

/**
 * Lightweight video lightbox for the hero's "What is BetterRoads?" button.
 * Fades a dark backdrop over the page and scales in a 16:9 embed. Closes on
 * backdrop click or Escape. When VIDEO_URL is empty (or unrecognised), shows a
 * "trailer dropping soon" card instead of a broken iframe.
 */
export default function VideoModal({ open, onClose }: Props) {
  const embed = toEmbedUrl(VIDEO_URL);

  // Lock body scroll + Escape to close while open.
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = 'hidden';
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label="What is BetterRoads"
          onClick={onClose}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 9000,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '1.5rem',
            background: 'rgba(10,10,10,0.82)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <motion.div
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.94, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{ width: '100%', maxWidth: '64rem' }}
          >
            {/* Close button */}
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '0.75rem' }}>
              <button
                onClick={onClose}
                aria-label="Close video"
                className="font-display"
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                  padding: '0.5rem 1rem',
                  borderRadius: '999px',
                  border: '1px solid rgba(255,255,255,0.25)',
                  background: 'transparent',
                  color: 'var(--color-paper)',
                  fontSize: '0.85rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                Close
                <span style={{ fontSize: '1.1rem', lineHeight: 1 }}>×</span>
              </button>
            </div>

            {/* 16:9 stage */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                aspectRatio: '16 / 9',
                borderRadius: '14px',
                overflow: 'hidden',
                background: '#0a0a0a',
                boxShadow: '0 40px 120px -30px rgba(0,0,0,0.8)',
                border: '1px solid rgba(224,97,28,0.25)',
              }}
            >
              {embed ? (
                <iframe
                  src={embed}
                  title="What is BetterRoads"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; fullscreen"
                  allowFullScreen
                  style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0 }}
                />
              ) : (
                <div
                  style={{
                    position: 'absolute',
                    inset: 0,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '0.9rem',
                    textAlign: 'center',
                    color: 'var(--color-paper)',
                    padding: '2rem',
                  }}
                >
                  <span
                    className="eyebrow"
                    style={{ color: 'var(--color-saffron)', letterSpacing: '0.22em' }}
                  >
                    Coming soon
                  </span>
                  <p
                    className="font-display"
                    style={{ fontSize: 'clamp(1.5rem, 3vw, 2.4rem)', fontWeight: 700, lineHeight: 1.1 }}
                  >
                    The trailer is dropping soon.
                  </p>
                  <p style={{ fontSize: '0.95rem', color: 'rgba(245,245,244,0.55)', maxWidth: '28rem' }}>
                    We&apos;re keeping the full story under wraps until 15&nbsp;August. Join the
                    movement to be the first to see it.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
