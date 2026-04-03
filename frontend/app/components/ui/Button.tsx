"use client";

import { type ButtonHTMLAttributes, type ReactNode } from "react";
import { cn } from "../../lib/cn";

type ButtonTier = "primary" | "secondary" | "tertiary";
type ButtonSize = "sm" | "md";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tier?: ButtonTier;
  size?: ButtonSize;
  children: ReactNode;
}

const tierStyles: Record<ButtonTier, string> = {
  primary: [
    "text-white font-medium",
    "bg-[var(--accent-500)]",
    "hover:bg-[var(--accent-400)]",
    "active:bg-[var(--accent-600)]",
    "shadow-[0_2px_8px_rgba(155,27,66,0.25)]",
    "hover:shadow-[0_4px_12px_rgba(155,27,66,0.35)]",
  ].join(" "),
  secondary: [
    "text-accent-light font-medium",
    "border border-accent/30",
    "bg-transparent",
    "hover:bg-accent/10",
    "active:bg-accent/15",
  ].join(" "),
  tertiary: [
    "text-accent-lighter font-medium",
    "bg-transparent",
    "hover:text-accent-light",
    "hover:underline",
    "p-0",
  ].join(" "),
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "text-xs px-2.5 py-1.5",
  md: "text-sm px-4 py-2",
};

export function Button({
  tier = "primary",
  size = "md",
  className,
  children,
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "rounded-[var(--radius-button)] transition-all duration-150 cursor-pointer",
        "active:scale-[0.97]",
        "disabled:opacity-40 disabled:cursor-not-allowed disabled:active:scale-100",
        tierStyles[tier],
        tier !== "tertiary" && sizeStyles[size],
        className,
      )}
      disabled={disabled}
      {...props}
    >
      {children}
    </button>
  );
}
