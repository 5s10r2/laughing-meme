"use client";

import { type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "../../lib/cn";

type CardVariant = "summary" | "action" | "status";
type StatusType = "success" | "warning" | "error" | "info";

interface CardProps {
  variant?: CardVariant;
  status?: StatusType;
  animate?: boolean;
  className?: string;
  children: ReactNode;
}

const statusStyles: Record<StatusType, string> = {
  success: "border-l-[3px] border-l-success bg-success-surface",
  warning: "border-l-[3px] border-l-warning bg-warning-surface",
  error: "border-l-[3px] border-l-error bg-error-surface",
  info: "border-l-[3px] border-l-accent bg-info-surface",
};

const variantStyles: Record<CardVariant, string> = {
  summary: "border border-glass-border bg-glass",
  action: "border-l-[3px] border-l-accent border border-glass-border bg-glass",
  status: "", // handled dynamically via statusStyles
};

export function Card({
  variant = "summary",
  status,
  animate = true,
  className,
  children,
}: CardProps) {
  const baseStyles = "rounded-[var(--radius-card)] p-3 my-2";

  const variantClass =
    variant === "status" && status
      ? statusStyles[status]
      : variantStyles[variant];

  const Wrapper = animate ? motion.div : "div";
  const motionProps = animate
    ? {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2, ease: "easeOut" as const },
      }
    : {};

  return (
    <Wrapper className={cn(baseStyles, variantClass, className)} {...motionProps}>
      {children}
    </Wrapper>
  );
}
