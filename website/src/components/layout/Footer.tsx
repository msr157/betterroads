import { SITE, SOCIALS } from "@/lib/constants";
import Flag from "@/components/ui/Flag";

export default function Footer() {
  return (
    <footer className="bg-ink px-6 py-16 text-paper sm:px-10">
      <div className="mx-auto max-w-6xl">
        {/* big wordmark line */}
        <div className="flex flex-col gap-8 border-b border-white/10 pb-12 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <a
              href="#top"
              className="font-display text-4xl font-bold tracking-tight text-paper sm:text-5xl"
            >
              {SITE.wordmark}
              <span className="text-saffron">.</span>
            </a>
            <p className="mt-4 max-w-xs leading-relaxed text-paper/60">
              {SITE.tagline} · <span className="font-hindi">{SITE.taglineHindi}</span>
            </p>
            <p className="mt-3 max-w-xs text-xs leading-relaxed text-paper/40">
              {SITE.methodline}
            </p>
          </div>

          <div className="flex flex-wrap gap-x-8 gap-y-3">
            {SOCIALS.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noopener noreferrer"
                className="link-underline text-sm font-medium text-paper/60 transition-colors hover:text-paper"
              >
                {s.label}
              </a>
            ))}
          </div>
        </div>

        <div className="flex flex-col justify-between gap-3 pt-8 text-sm text-paper/40 sm:flex-row sm:items-center">
          <div className="flex items-center gap-3">
            <Flag className="h-4 w-6 shrink-0" />
            <span>© {new Date().getFullYear()} {SITE.name}. A citizen movement.</span>
          </div>
          <p>Made in India</p>
        </div>
      </div>
    </footer>
  );
}
