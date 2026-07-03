import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Confetti from '@/components/ui/Confetti';
import { API_URL } from '@/lib/constants';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  currentCount: number | null;
  onJoined: (count: number) => void;
};

type Status = 'idle' | 'loading' | 'success' | 'already' | 'error';

/** Optional ways a signup can offer to contribute. Values are the DB slugs. */
const CONTRIBUTION_OPTIONS = [
  { value: 'road_data', label: 'Collecting road data while commuting' },
  { value: 'authority_mapping', label: 'Helping map road authorities' },
  { value: 'verification', label: 'Verifying road issues in my area' },
  { value: 'tech', label: 'Supporting tech/product improvement' },
  { value: 'research_validation', label: 'Helping with research and data validation' },
  { value: 'cloud_ai', label: 'Donating cloud / AI / infrastructure credits' },
  { value: 'funding', label: 'Supporting funding, grants, or CSR' },
  { value: 'awareness', label: 'Helping with awareness campaigns' },
  { value: 'legal_policy', label: 'Supporting legal, policy, or RTI work' },
  { value: 'govt_connect', label: 'Connecting Better Roads with government / civic authorities' },
  { value: 'unsure', label: 'I’m not sure yet, but I want to help' },
] as const;

export default function WaitlistModal({ isOpen, onClose, currentCount, onJoined }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [contribution, setContribution] = useState('');
  const [whatsapp, setWhatsapp] = useState('');
  const [helpMessage, setHelpMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [burst, setBurst] = useState(0);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Lock body scroll and focus email on open
  useEffect(() => {
    if (!isOpen) return;
    document.body.style.overflow = 'hidden';
    const id = setTimeout(() => firstFieldRef.current?.focus(), 60);
    return () => {
      document.body.style.overflow = '';
      clearTimeout(id);
    };
  }, [isOpen]);

  // Keyboard: Escape to close, Tab trap
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return; }
      if (e.key === 'Tab' && dialogRef.current) {
        const focusables = dialogRef.current.querySelectorAll<HTMLElement>(
          'button, input, [href], [tabindex]:not([tabindex="-1"])',
        );
        if (focusables.length === 0) return;
        const first = focusables[0];
        const last = focusables[focusables.length - 1];
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault(); last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault(); first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [isOpen, onClose]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (status === 'loading') return;
    setStatus('loading');
    setMessage('');
    try {
      const res = await fetch(`${API_URL}/api/waitlist/join`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name, city, contribution, whatsapp, message: helpMessage, company }),
      });
      const json = await res.json() as { ok: boolean; already?: boolean; count?: number; error?: string };
      if (!res.ok || !json.ok) {
        setStatus('error');
        setMessage(json.error ?? 'Something went wrong. Try again.');
        return;
      }
      if (typeof json.count === 'number') onJoined(json.count);
      if (json.already) {
        setStatus('already');
        setMessage('You\'re already on the list. See you on 15 August!');
      } else {
        setStatus('success');
        setBurst((b) => b + 1);
      }
    } catch {
      setStatus('error');
      setMessage('Network error. Please try again.');
    }
  }

  function resetAndClose() {
    onClose();
    setTimeout(() => {
      if (status === 'success' || status === 'already') {
        setEmail(''); setName(''); setCity(''); setContribution(''); setWhatsapp(''); setHelpMessage('');
      }
      setStatus('idle');
      setMessage('');
    }, 300);
  }

  const joined = status === 'success' || status === 'already';

  const inputStyle: React.CSSProperties = {
    width: '100%',
    borderRadius: '0.75rem',
    border: '1px solid var(--color-line)',
    background: 'var(--color-paper)',
    padding: '0.75rem 1rem',
    color: 'var(--color-ink)',
    outline: 'none',
    fontFamily: 'var(--font-body)',
    fontSize: '1rem',
    transition: 'border-color 0.2s',
  };

  return (
    <>
      <Confetti trigger={burst} />
      <AnimatePresence>
        {isOpen && (
          <motion.div
            style={{
              position: 'fixed', inset: 0, zIndex: 90,
              display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '1rem',
            }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            aria-modal="true"
            role="dialog"
            aria-label="Join the BetterRoads movement"
          >
            {/* Backdrop */}
            <div
              onClick={resetAndClose}
              style={{
                position: 'absolute', inset: 0,
                background: 'rgba(0,0,0,0.45)',
                backdropFilter: 'blur(4px)',
              }}
            />

            {/* Dialog */}
            <motion.div
              ref={dialogRef}
              style={{
                position: 'relative',
                maxHeight: '85vh',
                width: '100%',
                maxWidth: '28rem',
                overflowY: 'auto',
                borderRadius: '1.5rem',
                border: '1px solid var(--color-line)',
                background: 'var(--color-paper)',
                padding: '2.25rem',
                boxShadow: '0 30px 80px -20px rgba(0,0,0,0.35)',
              }}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 260, damping: 26 }}
            >
              {/* Tricolor top bar */}
              <div className="flag-rule" style={{ position: 'absolute', inset: '0 0 auto 0', height: '4px', borderRadius: '1.5rem 1.5rem 0 0' }} />

              {/* Close */}
              <button
                onClick={resetAndClose}
                aria-label="Close"
                style={{
                  position: 'absolute', right: '1rem', top: '1rem',
                  width: '2.25rem', height: '2.25rem',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  borderRadius: '9999px', border: 'none', background: 'transparent',
                  color: 'var(--color-ink-2)', cursor: 'pointer', fontSize: '1rem',
                }}
              >
                ✕
              </button>

              {!joined ? (
                <>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>
                    Join the movement
                  </h2>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--color-ink-2)' }}>
                    Be first through the gate when BetterRoads launches on{' '}
                    <strong style={{ color: 'var(--color-ink)' }}>15 August</strong>. No spam — just the launch.
                  </p>

                  <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                    {/* Honeypot (hidden from humans, visible to bots) */}
                    <input
                      type="text"
                      name="company"
                      tabIndex={-1}
                      autoComplete="off"
                      value={company}
                      onChange={(e) => setCompany(e.target.value)}
                      style={{ display: 'none' }}
                      aria-hidden
                    />

                    <input
                      ref={firstFieldRef}
                      type="text"
                      required
                      placeholder="Full Name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={inputStyle}
                    />

                    <input
                      type="email"
                      required
                      placeholder="Email Address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      style={inputStyle}
                    />

                    <input
                      type="text"
                      placeholder="City"
                      value={city}
                      onChange={(e) => setCity(e.target.value)}
                      style={inputStyle}
                    />

                    <select
                      value={contribution}
                      onChange={(e) => setContribution(e.target.value)}
                      aria-label="I would like to contribute by"
                      style={{
                        ...inputStyle,
                        appearance: 'none',
                        cursor: 'pointer',
                        color: contribution ? 'var(--color-ink)' : 'var(--color-ink-3)',
                      }}
                    >
                      <option value="">I would like to contribute by…</option>
                      {CONTRIBUTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value} style={{ color: 'var(--color-ink)' }}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    <input
                      type="tel"
                      placeholder="WhatsApp Number (optional)"
                      value={whatsapp}
                      onChange={(e) => setWhatsapp(e.target.value)}
                      style={inputStyle}
                    />

                    <textarea
                      placeholder="Message / How can you help? (optional)"
                      value={helpMessage}
                      onChange={(e) => setHelpMessage(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      style={{ ...inputStyle, resize: 'vertical', minHeight: '4.5rem', fontFamily: 'var(--font-body)' }}
                    />

                    {status === 'error' && (
                      <p style={{ fontSize: '0.875rem', color: 'var(--color-saffron)', margin: 0 }}>{message}</p>
                    )}

                    <button
                      type="submit"
                      disabled={status === 'loading'}
                      style={{
                        width: '100%', borderRadius: '0.75rem',
                        background: 'var(--color-ink)', color: 'var(--color-paper)',
                        padding: '0.875rem 1.5rem',
                        fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '1rem',
                        border: 'none', cursor: status === 'loading' ? 'not-allowed' : 'pointer',
                        opacity: status === 'loading' ? 0.6 : 1,
                        transition: 'background 0.2s',
                      }}
                      onMouseEnter={(e) => { if (status !== 'loading') (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-saffron)'; }}
                      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--color-ink)'; }}
                    >
                      {status === 'loading' ? 'Joining…' : 'Count me in'}
                    </button>
                  </form>

                  {typeof currentCount === 'number' && currentCount > 0 && (
                    <p style={{ marginTop: '1rem', textAlign: 'center', fontSize: '0.75rem', color: 'var(--color-ink-3)' }}>
                      <strong style={{ color: 'var(--color-ink)' }}>{currentCount.toLocaleString('en-IN')}</strong>{' '}citizens already joined
                    </p>
                  )}
                </>
              ) : (
                <motion.div
                  style={{ padding: '1rem 0', textAlign: 'center' }}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                >
                  <div style={{
                    width: '3.5rem', height: '3.5rem', borderRadius: '9999px',
                    background: 'rgba(27,122,67,0.12)', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '1.5rem', color: 'var(--color-green)', margin: '0 auto 1.25rem',
                  }}>✓</div>
                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0 }}>
                    {status === 'already' ? 'Already in.' : 'You\'re in.'}
                  </h2>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.875rem', lineHeight: 1.6, color: 'var(--color-ink-2)' }}>
                    {message || 'Welcome to the movement. We\'ll email you the moment we go live on Independence Day.'}
                  </p>
                  {typeof currentCount === 'number' && (
                    <p style={{ marginTop: '1.25rem', fontSize: '0.875rem', color: 'var(--color-ink-2)' }}>
                      You're citizen #<strong style={{ color: 'var(--color-saffron)' }}>{currentCount.toLocaleString('en-IN')}</strong>
                    </p>
                  )}
                  <button
                    onClick={resetAndClose}
                    style={{
                      marginTop: '1.5rem',
                      borderRadius: '0.75rem',
                      border: '1px solid var(--color-line)',
                      padding: '0.75rem 1.5rem',
                      fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: '0.875rem',
                      color: 'var(--color-ink)', background: 'transparent', cursor: 'pointer',
                    }}
                  >
                    Done
                  </button>
                </motion.div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
