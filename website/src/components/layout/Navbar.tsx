
import { useEffect, useState } from "react";
import { useWaitlist } from "@/components/providers/WaitlistProvider";
import { NAV_LINKS, SITE } from "@/lib/constants";

export default function Navbar() {
  const { open } = useWaitlist();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
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
          className="rounded-full border border-ink px-5 py-2 font-display text-sm font-semibold text-ink transition-colors hover:bg-ink hover:text-paper"
        >
          Join us
        </button>
      </nav>
    </header>
  );
}
