"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "../../lib/cn";
import { CARD } from "./primitives";
import { motion, AnimatePresence } from "framer-motion";

interface CollapsibleSectionProps {
  title: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
}

export function CollapsibleSection({
  title,
  defaultExpanded = false,
  children,
}: CollapsibleSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="bg-bg-surface border border-border rounded-2xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-medium text-content hover:bg-bg-elevated transition-colors cursor-pointer"
      >
        {title}
        <ChevronDown
          className={cn(
            "w-4 h-4 text-content-tertiary transition-transform duration-200",
            expanded && "rotate-180"
          )}
        />
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <div className="px-5 pb-4">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
