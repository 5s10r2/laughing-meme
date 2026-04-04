"use client";

import { useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "../../lib/cn";
import { createPortal } from "react-dom";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
}

export function BottomSheet({ open, onClose, title, children }: BottomSheetProps) {
  // Close on Escape key
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = "";
    };
  }, [open, handleKeyDown]);

  const content = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
          />

          {/* Mobile: bottom sheet / Desktop: centered modal */}
          <motion.div
            initial={{ y: "100%", opacity: 0.8 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: "100%", opacity: 0 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className={cn(
              "fixed z-50",
              // Mobile: bottom sheet
              "bottom-0 left-0 right-0 max-h-[70vh]",
              "rounded-t-2xl",
              // Desktop: centered modal
              "md:bottom-auto md:left-1/2 md:top-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
              "md:max-h-[80vh] md:w-full md:max-w-lg md:rounded-2xl",
              "bg-bg-surface border border-border shadow-2xl",
              "flex flex-col"
            )}
          >
            {/* Drag handle (mobile only) */}
            <div className="flex justify-center pt-2 md:hidden">
              <div className="w-10 h-1 rounded-full bg-bg-subtle" />
            </div>

            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-3.5 pb-2">
              {title ? (
                <h3 className="text-sm font-semibold text-content">{title}</h3>
              ) : (
                <div />
              )}
              <button
                onClick={onClose}
                className="w-8 h-8 rounded-full flex items-center justify-center text-content-tertiary hover:text-content hover:bg-bg-elevated transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto px-5 pb-5 overscroll-contain">
              {children}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

  // Render via portal to escape chat bubble constraints
  if (typeof window === "undefined") return null;
  return createPortal(content, document.body);
}
