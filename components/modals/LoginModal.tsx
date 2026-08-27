"use client";

import React, { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, KeyRound } from "lucide-react";

import { useHydrated } from "@/hooks/useHydrated";

/**
 * Placeholder sign-in shell.
 *
 * Deliberately has no fields and no auth. It exists so the nav's Login control
 * has somewhere real to land, and so the shell, portal target, stacking, and
 * dismissal behaviour are settled before any credential UI is designed.
 *
 * Portals itself
 * --------------
 * Unlike the service modals — which are portalled by whichever parent renders
 * them — this one calls `createPortal` internally, because it is opened from the
 * fixed `z-50` header and from page content. Escaping to `document.body` means
 * it never inherits a parent stacking context, and `z-[60]` keeps it above the
 * nav rather than behind the bar that launched it.
 *
 * Exit animation comes from the caller's `<AnimatePresence>`, matching the
 * pattern the other modals use: mount with `isOpen`, unmount to dismiss.
 */

interface LoginModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function LoginModal({ isOpen, onClose }: LoginModalProps) {
  const isHydrated = useHydrated();

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // `document.body` is only safe to reach for after hydration.
  if (!isOpen || !isHydrated) return null;

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 select-none">
      {/* Dim frosted backdrop — same treatment as the service modals. */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 bg-slate-950/70 backdrop-blur-xl"
      />

      <motion.div
        role="dialog"
        aria-modal="true"
        aria-labelledby="login-modal-title"
        initial={{ opacity: 0, scale: 0.94, y: 20 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.94, y: 20 }}
        transition={{ type: "spring", stiffness: 280, damping: 26 }}
        className="relative z-10 w-full max-w-md rounded-3xl bg-slate-50 border border-white/90 shadow-2xl overflow-hidden text-slate-900"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-200/80 bg-white/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600">
              <KeyRound className="w-5 h-5" />
            </div>
            <div>
              <p className="text-[10px] font-mono font-bold tracking-widest text-amber-600 uppercase">
                Government of Maharashtra
              </p>
              <h2
                id="login-modal-title"
                className="text-sm font-extrabold tracking-wide text-slate-800"
              >
                Login / साइन इन
              </h2>
            </div>
          </div>

          <button
            onClick={onClose}
            autoFocus
            aria-label="Close login"
            className="flex items-center justify-center w-9 h-9 rounded-full bg-slate-100 border border-slate-200 text-slate-500 hover:bg-slate-200 hover:text-slate-800 active:scale-95 transition-all cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-6 py-8">
          <p className="text-sm font-semibold text-slate-700">
            Sign-in is not connected yet.
          </p>
          <p className="text-xs text-slate-500 font-medium leading-relaxed mt-2">
            This is the shell for the citizen login flow. Drop the ABHA ID and
            mobile OTP steps in here when the auth endpoint is ready.
          </p>
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
