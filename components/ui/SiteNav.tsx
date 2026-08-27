"use client";

import React, { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Search, KeyRound, Menu, X } from "lucide-react";

import { ModeToggle } from "@/components/ui/ModeToggle";

/**
 * Site-wide government header.
 *
 * Glassmorphism, not opacity
 * --------------------------
 * The bar is `bg-white/60 backdrop-blur-md` rather than a solid fill so the
 * WebGL stage behind it — the hospital plate and the extruded "महाराष्ट्र" —
 * stays visible through the frost instead of being cropped off the top of the
 * viewport. That is the whole reason this is a blurred bar and not a solid one.
 *
 * Note the blur only has something to chew on in normal mode. `AiChamberView`
 * paints an opaque `#adadad` over the canvas, so in AI mode this reads as a
 * lightly tinted bar. That is expected: the chamber's flat backdrop is load
 * bearing for the avatar's feathered mask and is deliberately left alone.
 *
 * Stacking
 * --------
 * `z-40` sits above the chamber (`z-30` wrapper, `z-20` root) and deliberately
 * *below* the service modals (`z-50`) and `LoginModal` (`z-[60]`). Do not raise
 * it to `z-50`: the modals are centred with `max-h-[90vh]`, so a tall modal's
 * header and close button land inside this bar's 0–92px band, and at equal
 * z-index only DOM order would keep them clickable.
 *
 * Height is 28px (utility strip) + 64px (main row) = 92px, which is what the
 * chamber's top padding is budgeted against. Keep it under 96px or the avatar
 * starts to crowd the bar.
 */

interface SiteNavProps {
  isAiMode: boolean;
  onToggle: () => void;
  /** Opens the login modal. State lives with the modal's owner, not here. */
  onLoginClick: () => void;
}

/**
 * Every entry resolves to a real anchor rendered by `app/page.tsx`. Adding a
 * link here without adding the matching `id` gives the user a dead control.
 *
 * "Services" shares `#main-content` with the skip link on purpose — the
 * services grid *is* the page's main content.
 */
const NAV_LINKS: { label: string; href: string }[] = [
  { label: "Home", href: "#hero" },
  { label: "Services", href: "#main-content" },
  { label: "About", href: "#about" },
  { label: "Contact", href: "#contact" },
];

/** Sections only exist in normal mode, so AI mode has to stand down first. */
const EXIT_AI_SETTLE_MS = 120;

const MENU_PANEL_ID = "site-nav-menu-panel";

export function SiteNav({ isAiMode, onToggle, onLoginClick }: SiteNavProps) {
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const headerRef = useRef<HTMLElement>(null);

  const isSomethingOpen = isMenuOpen || isSearchOpen;

  /**
   * Dismiss the menu and the search field on Escape or on a click anywhere
   * outside the header. Listeners are only registered while one of them is
   * open, and `headerRef` is read from the handler — after commit — never
   * during render.
   */
  useEffect(() => {
    if (!isSomethingOpen) return;

    const closeAll = () => {
      setIsMenuOpen(false);
      setIsSearchOpen(false);
    };

    const handlePointerDown = (event: PointerEvent) => {
      if (headerRef.current?.contains(event.target as Node)) return;
      closeAll();
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeAll();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isSomethingOpen]);

  /** The 3D lift. A real rotateX against the container's perspective, so the
   *  link tips toward the viewer rather than just getting bigger. */
  const lift = reduceMotion ? undefined : { y: -2, rotateX: -10, scale: 1.05 };
  const press = reduceMotion ? undefined : { scale: 0.96, y: 0, rotateX: 0 };

  const goTo = (href: string) => {
    setIsMenuOpen(false);
    setIsSearchOpen(false);

    const scrollToTarget = () => {
      document.querySelector(href)?.scrollIntoView({
        behavior: reduceMotion ? "auto" : "smooth",
        block: "start",
      });
    };

    // In AI mode the target section is unmounted. Leave AI mode, then scroll
    // once React has committed the sections back into the tree.
    if (isAiMode) {
      onToggle();
      window.setTimeout(scrollToTarget, EXIT_AI_SETTLE_MS);
      return;
    }
    scrollToTarget();
  };

  return (
    // `pointer-events-none` on the shell so the transparent gutter around the
    // compact menu panel does not swallow clicks aimed at the page.
    <header
      ref={headerRef}
      role="banner"
      className="fixed top-0 inset-x-0 z-40 select-none pointer-events-none"
    >
      {/* ---------- Utility strip ---------- */}
      <div className="flex items-center justify-between gap-4 h-7 px-4 sm:px-8 bg-white/55 backdrop-blur-md border-b border-white/40 text-[10px] font-mono font-semibold tracking-widest text-slate-600 pointer-events-auto">
        <span className="hidden sm:inline uppercase">
          भारत सरकार • Government of India
        </span>

        <div className="flex items-center gap-3">
          {/* Visible on purpose, and on every breakpoint: this is the standard
              Indian government portal affordance, not a screen-reader-only
              escape hatch. A real anchor, so assistive tech treats it as one. */}
          <a
            href="#main-content"
            onClick={(event) => {
              event.preventDefault();
              goTo("#main-content");
            }}
            className="uppercase rounded-sm hover:text-amber-700 hover:underline underline-offset-2 transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            Skip to Main Content
          </a>
          <span className="hidden md:inline text-slate-400" aria-hidden="true">
            |
          </span>
          <span className="hidden md:inline uppercase">महाराष्ट्र शासन</span>
        </div>
      </div>

      {/* ---------- Main bar ---------- */}
      <div className="relative flex items-center justify-between gap-4 h-16 px-4 sm:px-8 bg-white/60 backdrop-blur-md backdrop-saturate-150 border-b border-white/60 shadow-[0_4px_30px_rgb(15,23,42,0.06)] pointer-events-auto">
        {/* Lit top edge — sells the pane as glass rather than as a flat tint. */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/90 to-transparent"
        />

        {/* LEFT — state emblem and department */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-br from-amber-400/30 to-amber-500/10 border border-amber-500/30 flex items-center justify-center font-bold text-amber-700 shadow-[inset_0_1px_0_rgb(255,255,255,0.7)]">
            MH
          </div>
          <div className="min-w-0">
            <p className="text-[10px] font-bold tracking-widest text-amber-600 uppercase truncate">
              Government of Maharashtra
            </p>
            <h1 className="text-xs sm:text-sm font-extrabold tracking-wide text-slate-800 truncate">
              PUBLIC HEALTH DEPARTMENT • आरोग्य विभाग
            </h1>
          </div>
        </div>

        {/* CENTER — primary navigation */}
        <nav
          aria-label="Primary"
          className="hidden lg:flex items-center gap-1"
          style={{ perspective: "800px" }}
        >
          {NAV_LINKS.map((link) => (
            <motion.button
              key={link.href}
              onClick={() => goTo(link.href)}
              whileHover={lift}
              whileTap={press}
              transition={{ type: "spring", stiffness: 420, damping: 24 }}
              className="group relative px-4 py-2 rounded-xl text-xs font-bold tracking-wide text-slate-700 hover:text-amber-800 hover:bg-white/70 hover:shadow-[0_8px_20px_rgb(15,23,42,0.08)] transition-colors cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
            >
              {link.label}
              <span
                aria-hidden="true"
                className="absolute left-1/2 -translate-x-1/2 bottom-1 h-0.5 w-0 group-hover:w-5 rounded-full bg-gradient-to-r from-amber-500 to-amber-300 transition-all duration-300"
              />
            </motion.button>
          ))}
        </nav>

        {/* RIGHT — search, login, mode */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {/* Search is a deliberate stub: the field has no handler yet, so it
              lives in a form that swallows Enter rather than letting the
              keypress look like a broken submit. */}
          <form
            onSubmit={(event) => event.preventDefault()}
            className="hidden sm:flex items-center"
          >
            <AnimatePresence initial={false}>
              {isSearchOpen && (
                <motion.input
                  key="site-search"
                  type="search"
                  autoFocus
                  placeholder="Search services…"
                  aria-label="Search services"
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 176, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="mr-2 h-9 rounded-full bg-white/80 border border-white/80 px-4 text-xs font-semibold text-slate-800 placeholder:text-slate-400 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-400/20"
                />
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => setIsSearchOpen((prev) => !prev)}
              aria-label={isSearchOpen ? "Close search" : "Search services"}
              className="flex items-center justify-center w-10 h-10 rounded-full bg-white/70 border border-white/80 text-slate-600 hover:text-sky-700 hover:bg-white hover:scale-105 active:scale-95 shadow-sm transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-sky-500"
            >
              {isSearchOpen ? (
                <X className="w-4 h-4" />
              ) : (
                <Search className="w-4 h-4" />
              )}
            </button>
          </form>

          {/* Login — the one loud element in the bar. */}
          <motion.button
            onClick={onLoginClick}
            whileHover={reduceMotion ? undefined : { y: -2, scale: 1.04 }}
            whileTap={reduceMotion ? undefined : { scale: 0.96 }}
            transition={{ type: "spring", stiffness: 420, damping: 24 }}
            className="flex items-center gap-2 h-10 pl-2.5 pr-3 sm:pr-4 rounded-full bg-gradient-to-tr from-amber-500 to-amber-400 text-white text-xs font-extrabold tracking-wide shadow-lg shadow-amber-500/25 hover:shadow-xl hover:shadow-amber-500/35 transition-shadow cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-600"
          >
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-white/25 shadow-[inset_0_1px_0_rgb(255,255,255,0.5)]">
              <KeyRound className="w-3.5 h-3.5" />
            </span>
            <span className="hidden sm:inline">Login / साइन इन</span>
            <span className="sm:hidden">Login</span>
          </motion.button>

          {/* Shown exactly when the desktop links are, so the copy inside the
              compact menu is never on screen at the same time. */}
          <div className="hidden lg:block">
            <ModeToggle isAiMode={isAiMode} onToggle={onToggle} />
          </div>

          <button
            onClick={() => setIsMenuOpen((prev) => !prev)}
            aria-label={isMenuOpen ? "Close menu" : "Open menu"}
            aria-expanded={isMenuOpen}
            aria-controls={MENU_PANEL_ID}
            className="lg:hidden flex items-center justify-center w-10 h-10 rounded-full bg-white/70 border border-white/80 text-slate-700 hover:bg-white active:scale-95 shadow-sm transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            {isMenuOpen ? (
              <X className="w-4 h-4" />
            ) : (
              <Menu className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* ---------- Compact menu ---------- */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            key="site-nav-menu"
            id={MENU_PANEL_ID}
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="lg:hidden mx-4 mt-2 rounded-3xl bg-white/75 backdrop-blur-xl border border-white/70 shadow-[0_12px_40px_rgb(15,23,42,0.12)] overflow-hidden pointer-events-auto"
          >
            <nav aria-label="Primary, compact" className="flex flex-col p-3">
              {NAV_LINKS.map((link) => (
                <button
                  key={link.href}
                  onClick={() => goTo(link.href)}
                  className="text-left px-4 py-3 rounded-2xl text-sm font-bold text-slate-700 hover:text-amber-800 hover:bg-white/80 active:scale-[0.98] transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
                >
                  {link.label}
                </button>
              ))}

              <div className="mt-2 pt-3 border-t border-slate-200/70 flex items-center justify-between gap-3 px-1">
                <span className="text-[10px] font-mono font-bold tracking-widest text-slate-500 uppercase">
                  Interface
                </span>
                <ModeToggle isAiMode={isAiMode} onToggle={onToggle} />
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
