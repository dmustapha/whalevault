"use client";

import { forwardRef, type ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type ButtonVariant = "primary" | "secondary" | "outline" | "ghost";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  fullWidth?: boolean;
  disabled?: boolean;
  className?: string;
  children?: ReactNode;
  onClick?: () => void;
  type?: "button" | "submit" | "reset";
}

const variants: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-r from-whale-600 to-vault-600 hover:from-whale-500 hover:to-vault-500 text-white shadow-lg shadow-whale-500/25",
  secondary:
    "bg-white/10 hover:bg-white/20 text-white backdrop-blur-sm border border-white/10",
  outline:
    "border border-whale-500/50 hover:border-whale-500 text-whale-400 hover:text-whale-300 hover:bg-whale-500/10",
  ghost: "hover:bg-white/5 text-gray-300 hover:text-white",
};

const sizes: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-6 py-3 text-lg",
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className,
      variant = "primary",
      size = "md",
      loading = false,
      fullWidth = false,
      disabled,
      children,
      onClick,
      type = "button",
    },
    ref
  ) {
    return (
      <motion.button
        ref={ref}
        type={type}
        onClick={onClick}
        whileHover={{ scale: disabled || loading ? 1 : 1.02 }}
        whileTap={{ scale: disabled || loading ? 1 : 0.98 }}
        className={cn(
          "relative inline-flex items-center justify-center rounded-lg font-medium transition-colors duration-200",
          "focus:outline-none focus:ring-2 focus:ring-whale-500/50 focus:ring-offset-2 focus:ring-offset-gray-900",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          variants[variant],
          sizes[size],
          fullWidth && "w-full",
          className
        )}
        disabled={disabled || loading}
      >
        {loading && (
          <svg
            className="absolute left-1/2 -translate-x-1/2 h-5 w-5 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}
        <span className={cn(loading && "invisible")}>{children}</span>
      </motion.button>
    );
  }
);
