import { useEffect } from 'react';
import { SITE, LEGAL } from '@/lib/constants';

type Props = {
  title: string;
  /** Short one-line summary shown under the title. */
  intro: string;
  children: React.ReactNode;
};

/**
 * Shared shell for the Terms and Privacy pages. Editorial, matches the site's
 * white / ink / saffron system. Scrolls to top on mount and provides a plain
 * "← Back to home" link (the pages are reached via full navigation, no router).
 */
export default function LegalLayout({ title, intro, children }: Props) {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-viewport bg-paper text-ink">
      {/* Header */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <a href="/" className="font-display text-lg font-bold tracking-tight text-ink">
            {SITE.wordmark}
            <span className="text-saffron">.</span>
          </a>
          <a
            href="/"
            className="link-underline text-sm font-medium text-ink-2 transition-colors hover:text-ink"
          >
            ← Back to home
          </a>
        </div>
      </header>

      {/* Document */}
      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="eyebrow mb-4">Legal</p>
        <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">
          {title}
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2">{intro}</p>
        <p className="mt-4 text-sm text-ink-3">
          Effective date: {LEGAL.effectiveDate}
        </p>

        <div className="legal-prose mt-12">{children}</div>

        {/* Cross-link + footer */}
        <div className="mt-16 border-t border-line pt-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="/terms" className="link-underline font-medium text-ink-2 hover:text-ink">
              Terms of Service
            </a>
            <a href="/privacy" className="link-underline font-medium text-ink-2 hover:text-ink">
              Privacy Policy
            </a>
            <a href="/delete-account" className="link-underline font-medium text-ink-2 hover:text-ink">
              Delete account
            </a>
          </div>
          <p className="mt-6 text-sm text-ink-3">
            © {new Date().getFullYear()} {LEGAL.companyName}. Made in India.
          </p>
        </div>
      </main>
    </div>
  );
}

/** Section heading inside a legal document. */
export function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="mb-10">
      <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
        <span className="text-saffron">{n}.</span> {title}
      </h2>
      <div className="mt-3 space-y-3 text-[0.975rem] leading-relaxed text-ink-2">{children}</div>
    </section>
  );
}
