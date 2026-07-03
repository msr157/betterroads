import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import Confetti from '@/components/ui/Confetti';
import { SocialIcon } from '@/components/ui/SocialIcons';
import { API_URL, SOCIALS } from '@/lib/constants';

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

/** Small uppercase field label with an optional required asterisk. */
function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
      <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-ink-2)' }}>
        {label}
        {required && <span style={{ color: 'var(--color-saffron)' }}> *</span>}
      </span>
      {children}
    </label>
  );
}

export default function WaitlistModal({ isOpen, onClose, currentCount, onJoined }: Props) {
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [city, setCity] = useState('');
  const [contributions, setContributions] = useState<string[]>([]);
  const [whatsapp, setWhatsapp] = useState('');
  const [helpMessage, setHelpMessage] = useState('');
  const [company, setCompany] = useState(''); // honeypot
  const [status, setStatus] = useState<Status>('idle');
  const [message, setMessage] = useState('');
  const [burst, setBurst] = useState(0);
  const firstFieldRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  function toggleContribution(value: string) {
    setContributions((prev) =>
      prev.includes(value) ? prev.filter((v) => v !== value) : [...prev, value],
    );
  }

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
        body: JSON.stringify({ email, name, city, contributions, whatsapp, message: helpMessage, company }),
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
        setEmail(''); setName(''); setCity(''); setContributions([]); setWhatsapp(''); setHelpMessage('');
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
    background: '#fafaf9',
    padding: '0.7rem 0.9rem',
    color: 'var(--color-ink)',
    outline: 'none',
    fontFamily: 'var(--font-body)',
    fontSize: '0.95rem',
    transition: 'border-color .18s, box-shadow .18s, background .18s',
  };
  // Shared focus animation: saffron border + soft ring, brighten background.
  const focusProps = {
    onFocus: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = 'var(--color-saffron)';
      e.currentTarget.style.boxShadow = '0 0 0 3px rgba(224,97,28,0.12)';
      e.currentTarget.style.background = 'var(--color-paper)';
    },
    onBlur: (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      e.currentTarget.style.borderColor = 'var(--color-line)';
      e.currentTarget.style.boxShadow = 'none';
      e.currentTarget.style.background = '#fafaf9';
    },
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
                  {/* Social icons — follow the movement */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', marginBottom: '1.25rem' }}>
                    {SOCIALS.map((s, i) => (
                      <motion.a
                        key={s.label}
                        href={s.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={s.label}
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.08 + i * 0.06, duration: 0.3 }}
                        whileHover={{ y: -3, backgroundColor: 'var(--color-saffron)', borderColor: 'var(--color-saffron)', color: '#fff' }}
                        whileTap={{ scale: 0.92 }}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '2.3rem', height: '2.3rem', borderRadius: '9999px',
                          border: '1px solid var(--color-line)', background: 'var(--color-paper)',
                          color: 'var(--color-ink-2)',
                        }}
                      >
                        <SocialIcon label={s.label} width={17} height={17} />
                      </motion.a>
                    ))}
                  </div>

                  <h2 style={{ fontFamily: 'var(--font-display)', fontSize: '1.75rem', fontWeight: 700, color: 'var(--color-ink)', margin: 0, letterSpacing: '-0.01em' }}>
                    Join the movement
                  </h2>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.9rem', lineHeight: 1.6, color: 'var(--color-ink-2)' }}>
                    Be first through the gate when BetterRoads launches on{' '}
                    <strong style={{ color: 'var(--color-ink)' }}>15 August</strong>. No spam — just the launch.
                  </p>

                  <form onSubmit={handleSubmit} style={{ marginTop: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.1rem' }}>
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

                    <Field label="Full Name" required>
                      <input
                        ref={firstFieldRef}
                        type="text"
                        required
                        placeholder="Your full name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        style={inputStyle}
                        {...focusProps}
                      />
                    </Field>

                    <Field label="Email Address" required>
                      <input
                        type="email"
                        required
                        placeholder="you@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        style={inputStyle}
                        {...focusProps}
                      />
                    </Field>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                      <Field label="City">
                        <input
                          type="text"
                          placeholder="e.g. Mumbai"
                          value={city}
                          onChange={(e) => setCity(e.target.value)}
                          style={inputStyle}
                          {...focusProps}
                        />
                      </Field>
                      <Field label="WhatsApp">
                        <input
                          type="tel"
                          placeholder="Optional"
                          value={whatsapp}
                          onChange={(e) => setWhatsapp(e.target.value)}
                          style={inputStyle}
                          {...focusProps}
                        />
                      </Field>
                    </div>

                    {/* Contribution — multi-select checklist */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
                        <span style={{ fontSize: '0.68rem', fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase', color: 'var(--color-ink-2)' }}>
                          I would like to contribute by
                        </span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--color-ink-3)' }}>
                          {contributions.length > 0 ? `${contributions.length} selected` : 'Select all that apply'}
                        </span>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                        {CONTRIBUTION_OPTIONS.map((opt) => {
                          const selected = contributions.includes(opt.value);
                          return (
                            <motion.button
                              type="button"
                              key={opt.value}
                              onClick={() => toggleContribution(opt.value)}
                              aria-pressed={selected}
                              whileTap={{ scale: 0.985 }}
                              animate={{
                                backgroundColor: selected ? 'var(--color-saffron-soft)' : 'rgba(0,0,0,0)',
                                borderColor: selected ? 'var(--color-saffron)' : 'var(--color-line)',
                              }}
                              transition={{ duration: 0.18 }}
                              style={{
                                display: 'flex', alignItems: 'center', gap: '0.7rem',
                                width: '100%', textAlign: 'left', cursor: 'pointer',
                                padding: '0.6rem 0.7rem', borderRadius: '0.7rem',
                                border: '1px solid var(--color-line)',
                                color: 'var(--color-ink)', fontFamily: 'var(--font-body)', fontSize: '0.9rem',
                                lineHeight: 1.3,
                              }}
                            >
                              <motion.span
                                animate={{
                                  backgroundColor: selected ? 'var(--color-saffron)' : 'rgba(0,0,0,0)',
                                  borderColor: selected ? 'var(--color-saffron)' : 'var(--color-line-strong)',
                                }}
                                transition={{ duration: 0.15 }}
                                style={{
                                  flexShrink: 0, width: '1.2rem', height: '1.2rem', borderRadius: '0.4rem',
                                  border: '1.5px solid var(--color-line-strong)',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                }}
                              >
                                <AnimatePresence>
                                  {selected && (
                                    <motion.svg
                                      key="check" width="12" height="12" viewBox="0 0 24 24" fill="none"
                                      stroke="#fff" strokeWidth={3.5} strokeLinecap="round" strokeLinejoin="round"
                                      initial={{ scale: 0, opacity: 0 }}
                                      animate={{ scale: 1, opacity: 1 }}
                                      exit={{ scale: 0, opacity: 0 }}
                                      transition={{ type: 'spring', stiffness: 500, damping: 22 }}
                                    >
                                      <path d="M20 6 9 17l-5-5" />
                                    </motion.svg>
                                  )}
                                </AnimatePresence>
                              </motion.span>
                              <span>{opt.label}</span>
                            </motion.button>
                          );
                        })}
                      </div>
                    </div>

                    <Field label="Message / How can you help?">
                      <textarea
                        placeholder="Anything you'd like to add (optional)"
                        value={helpMessage}
                        onChange={(e) => setHelpMessage(e.target.value)}
                        rows={3}
                        maxLength={1000}
                        style={{ ...inputStyle, resize: 'vertical', minHeight: '4.5rem' }}
                        {...focusProps}
                      />
                    </Field>

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
