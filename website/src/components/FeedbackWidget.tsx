import { useState, type FormEvent } from 'react';

const API_URL = 'https://betterroads.org/api/public';

export default function FeedbackWidget() {
  const [open, setOpen] = useState(false);
  const [category, setCategory] = useState('Suggestion');
  const [categoryOpen, setCategoryOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [captchaNum1, setCaptchaNum1] = useState(Math.floor(Math.random() * 9) + 1);
  const [captchaNum2, setCaptchaNum2] = useState(Math.floor(Math.random() * 9) + 1);
  const [captchaAnswer, setCaptchaAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!description.trim()) return;
    if (parseInt(captchaAnswer) !== captchaNum1 + captchaNum2) {
      alert('Incorrect math answer. Please try again.');
      return;
    }

    setSubmitting(true);
    try {
      let deviceOs = 'Unknown';
      const ua = navigator.userAgent.toLowerCase();
      if (ua.includes('win')) deviceOs = 'Windows';
      else if (ua.includes('mac')) deviceOs = 'macOS';
      else if (ua.includes('linux')) deviceOs = 'Linux';
      else if (ua.includes('android')) deviceOs = 'Android';
      else if (ua.includes('ios') || ua.includes('iphone') || ua.includes('ipad')) deviceOs = 'iOS';
      
      let location = 'Unknown';
      try { location = Intl.DateTimeFormat().resolvedOptions().timeZone; } catch(err) {}

      const res = await fetch(`${API_URL}/feedback`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, category, description, source: 'website', deviceOs, location })
      });
      if (!res.ok) throw new Error('Failed to submit');
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setDescription('');
        setCaptchaAnswer('');
        setCaptchaNum1(Math.floor(Math.random() * 9) + 1);
        setCaptchaNum2(Math.floor(Math.random() * 9) + 1);
        setOpen(false);
      }, 3000);
    } catch {
      alert('Failed to send feedback. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-6 right-6 z-50 rounded-full bg-ink px-5 py-3 text-sm font-medium tracking-wide text-paper shadow-lg transition-transform hover:-translate-y-1 hover:shadow-xl"
      >
        Send Feedback
      </button>

      {open && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/20 p-4 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setOpen(false)} />
          <div className="relative w-full max-w-md rounded-2xl bg-paper p-6 shadow-2xl">
            {success ? (
              <div className="py-12 text-center">
                <h3 className="mb-2 text-2xl font-bold tracking-tight text-ink">Thank you!</h3>
                <p className="text-ink-2">Your feedback has been submitted successfully.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                <h3 className="text-xl font-bold tracking-tight text-ink">Send Feedback</h3>
                
                <div className="relative">
                  <label className="mb-1 block text-sm font-medium text-ink-2">Category</label>
                  <button
                    type="button"
                    onClick={() => setCategoryOpen(!categoryOpen)}
                    className="flex w-full items-center justify-between rounded-xl border border-line bg-transparent px-3 py-2 text-ink focus:border-ink focus:outline-none"
                  >
                    {category}
                    <span className="text-xs text-ink-3">▼</span>
                  </button>
                  {categoryOpen && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 overflow-hidden rounded-xl border border-line bg-paper shadow-lg">
                      {['Suggestion', 'Bug Report', 'General'].map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => {
                            setCategory(cat);
                            setCategoryOpen(false);
                          }}
                          className="block w-full px-3 py-2 text-left text-sm text-ink hover:bg-paper-2"
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-2">Description</label>
                  <textarea
                    required
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    className="h-32 w-full resize-none rounded-xl border border-line bg-transparent px-3 py-2 text-ink focus:border-ink focus:outline-none"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink-2">Name (optional)</label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-ink focus:border-ink focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-ink-2">Email (optional)</label>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-ink focus:border-ink focus:outline-none"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-sm font-medium text-ink-2">Spam Check: What is {captchaNum1} + {captchaNum2}?</label>
                  <input
                    type="number"
                    required
                    value={captchaAnswer}
                    onChange={(e) => setCaptchaAnswer(e.target.value)}
                    placeholder="Enter the sum"
                    className="w-full rounded-xl border border-line bg-transparent px-3 py-2 text-ink focus:border-ink focus:outline-none"
                  />
                </div>

                <div className="mt-6 flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-4 py-2 font-medium text-ink-2 hover:bg-ink/5 hover:text-ink"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="rounded-xl bg-ink px-6 py-2 font-medium text-paper disabled:opacity-50"
                  >
                    {submitting ? 'Sending...' : 'Send'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  );
}
