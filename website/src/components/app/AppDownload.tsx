import { useEffect } from 'react';
import { APP_DOWNLOAD, LEGAL, SITE } from '@/lib/constants';

/**
 * /app — the Android app download page. The APK is distributed straight
 * from betterroads.org (early access) while the Play Store listing clears
 * review; the page explains sideloading in three steps and stays honest
 * about the permissions the app asks for.
 */
export default function AppDownload() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-viewport bg-paper text-ink">
      {/* Header — same shell as the legal pages */}
      <header className="border-b border-line">
        <div className="mx-auto flex h-16 max-w-3xl items-center justify-between px-6">
          <a href="/" className="font-display text-lg font-bold tracking-tight text-ink">
            {SITE.wordmark}
            <span className="text-saffron">.</span>
          </a>
          <div className="flex items-center gap-5">
            <a
              href="/map"
              className="link-underline text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              Public panel
            </a>
            <a
              href="/"
              className="link-underline text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              ← Home
            </a>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-6 py-16 sm:py-20">
        <p className="eyebrow mb-4">The app</p>
        <h1 className="font-display text-[clamp(2rem,5vw,3.25rem)] font-extrabold leading-[1.02] tracking-[-0.03em] text-ink">
          Every ride scores the road<span className="text-saffron">.</span>
        </h1>
        <p className="mt-5 max-w-2xl text-base leading-relaxed text-ink-2">
          Mount your phone, start a journey, and drive like you always do. The
          BetterRoads app reads the bumps your vehicle feels and turns them into
          a public, undeniable map of India&apos;s road quality.
        </p>

        {/* Download card */}
        <div className="mt-10 rounded-2xl border border-line bg-paper-2 p-8">
          <div className="flex flex-wrap items-center gap-x-8 gap-y-4">
            <a
              href={APP_DOWNLOAD.apkUrl}
              download={APP_DOWNLOAD.apkName}
              className="rounded-full bg-saffron px-9 py-4 font-display text-lg font-semibold text-paper shadow-[0_18px_44px_-14px_rgba(224,97,28,0.7)] transition-colors hover:bg-ink"
            >
              Download for Android
            </a>
            <div className="text-sm leading-relaxed text-ink-2">
              <p>
                Version {APP_DOWNLOAD.version} · early access APK ·{' '}
                {APP_DOWNLOAD.requirement}
              </p>
              <p className="text-ink-3">
                Free, no email or Google account needed.{' '}
                {APP_DOWNLOAD.playStoreUrl
                  ? ''
                  : 'Coming to Google Play soon.'}
              </p>
            </div>
          </div>
        </div>

        {/* Install steps */}
        <section className="mt-14">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            <span className="text-saffron">1.</span> Install
          </h2>
          <div className="mt-3 space-y-3 text-[0.975rem] leading-relaxed text-ink-2">
            <p>
              Open the downloaded <strong className="text-ink">{APP_DOWNLOAD.apkName}</strong>{' '}
              from your notifications or Files app. Android will ask you to allow
              installs from your browser the first time — that prompt exists because
              this build comes straight from us instead of the Play Store.
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            <span className="text-saffron">2.</span> Mount &amp; ride
          </h2>
          <div className="mt-3 space-y-3 text-[0.975rem] leading-relaxed text-ink-2">
            <p>
              Fix your phone to a dashboard or handlebar holder, pick your vehicle,
              and tap <strong className="text-ink">Start journey</strong>. Recording
              runs while the app is open — end the journey when you arrive and it
              uploads itself (or waits for network).
            </p>
          </div>
        </section>

        <section className="mt-10">
          <h2 className="font-display text-xl font-bold tracking-tight text-ink sm:text-2xl">
            <span className="text-saffron">3.</span> Watch the map fill in
          </h2>
          <div className="mt-3 space-y-3 text-[0.975rem] leading-relaxed text-ink-2">
            <p>
              Every journey paints the{' '}
              <a href="/map" className="link-underline font-medium text-saffron">
                public panel
              </a>{' '}
              with scored road segments and detected potholes — building the
              public record, ride by ride.
            </p>
          </div>
        </section>

        {/* Privacy note */}
        <div className="mt-14 rounded-2xl border border-line p-6 text-sm leading-relaxed text-ink-2">
          <p className="eyebrow mb-2">What it collects</p>
          <p>
            Location while a journey you started is running, motion-sensor
            readings, a random install ID, and a private contributor ID with a
            unique username. No email, phone number, or contacts are required.
            Full details in the{' '}
            <a href="/privacy" className="link-underline font-medium text-ink">
              Privacy Policy
            </a>
            .
          </p>
        </div>

        {/* Footer */}
        <div className="mt-16 border-t border-line pt-8">
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a href="/terms" className="link-underline font-medium text-ink-2 hover:text-ink">
              Terms of Service
            </a>
            <a href="/privacy" className="link-underline font-medium text-ink-2 hover:text-ink">
              Privacy Policy
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
