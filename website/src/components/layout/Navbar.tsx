
import { useEffect, useState } from "react";
import { useWaitlist } from "@/components/providers/WaitlistProvider";
import { NAV_LINKS, SITE } from "@/lib/constants";

export default function Navbar() {
  const { open } = useWaitlist();
  const [scrolled, setScrolled] = useState(false);
  // True once the user has scrolled roughly past the full-height hero — used to
  // grow + highlight the "Join us" button so it stays prominent down the page.
  const [pastHero, setPastHero] = useState(false);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setScrolled(y > 24);
      setPastHero(y > window.innerHeight * 0.85);
    };
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", onScroll);
    };
  }, []);

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-colors duration-300 ${
        scrolled
          ? "border-b border-line bg-paper/95 md:bg-paper/85 md:backdrop-blur-md"
          : "border-b border-transparent"
      }`}
    >
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-6 sm:px-10">
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-ink"
        >
          {SITE.wordmark}
          <span className="text-saffron">.</span>
        </a>

        <div className="hidden items-center gap-9 md:flex">
          {NAV_LINKS.map((link) => (
            <a
              key={link.href}
              href={link.href}
              className="link-underline text-sm font-medium text-ink-2 transition-colors hover:text-ink"
            >
              {link.label}
            </a>
          ))}
        </div>

        <button
          onClick={open}
          className={`rounded-full font-display font-semibold text-paper transition-all duration-300 ease-out ${
            pastHero
              ? "scale-105 bg-saffron px-7 py-2.5 text-base shadow-[0_10px_28px_-8px_rgba(224,97,28,0.7)] hover:bg-ink"
              : "bg-ink px-5 py-2 text-sm hover:bg-saffron"
          }`}
        >
          Join us
        </button>
      </nav>
    </header>
  );
}
