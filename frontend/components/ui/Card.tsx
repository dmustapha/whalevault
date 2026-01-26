"use client";

import { forwardRef, type ReactNode } from "react";
import { motion, type HTMLMotionProps } from "framer-motion";
import { cn } from "@/lib/utils";

interface CardProps extends Omit<HTMLMotionProps<"div">, "ref"> {
  children: ReactNode;
  gradient?: boolean;
  hover?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ className, children, gradient = false, hover = false, ...props }, ref) => {
    return (
      <motion.div
        ref={ref}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        whileHover={hover ? { scale: 1.02, y: -4 } : undefined}
        className={cn(
          "relative rounded-2xl backdrop-blur-xl",
          "border border-white/10",
          gradient
            ? "bg-gradient-to-br from-white/10 via-white/5 to-transparent"
            : "bg-white/5",
          hover && "cursor-pointer transition-shadow hover:shadow-xl hover:shadow-whale-500/10",
          className
        )}
        {...props}
      >
        {children}
      </motion.div>
    );
  }
);

Card.displayName = "Card";

interface CardHeaderProps {
  children: ReactNode;
  className?: string;
}

export function CardHeader({ children, className }: CardHeaderProps) {
  return (
    <div className={cn("px-6 py-4 border-b border-white/10", className)}>
      {children}
    </div>
  );
}

interface CardContentProps {
  children: ReactNode;
  className?: string;
}

export function CardContent({ children, className }: CardContentProps) {
  return <div className={cn("px-6 py-4", className)}>{children}</div>;
}

interface CardFooterProps {
  children: ReactNode;
  className?: string;
}

export function CardFooter({ children, className }: CardFooterProps) {
  return (
    <div className={cn("px-6 py-4 border-t border-white/10", className)}>
      {children}
    </div>
  );
}
