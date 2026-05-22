import { cn } from "../lib/utils";
import { ReactNode } from "react";

type CardVariant = "cyan" | "green" | "gold" | "orange" | "red" | "yellow" | "accent" | "primary";

interface HackerCardProps {
  title: string;
  icon?: string;
  children: ReactNode;
  className?: string;
  variant?: CardVariant;
}

const variantStyles: Record<CardVariant, { border: string; text: string; glow: string }> = {
  cyan:    { border: "border-[hsl(var(--neon-cyan)/0.5)]",   text: "text-[hsl(var(--neon-cyan))]",   glow: "glow-cyan" },
  green:   { border: "border-[hsl(var(--matrix-green)/0.55)]", text: "text-[hsl(var(--matrix-green))]", glow: "glow-green" },
  gold:    { border: "border-[hsl(var(--neon-gold)/0.55)]",  text: "text-[hsl(var(--neon-gold))]",  glow: "glow-gold" },
  orange:  { border: "border-[hsl(var(--neon-orange)/0.55)]",text: "text-[hsl(var(--neon-orange))]",glow: "glow-orange" },
  red:     { border: "border-destructive/55",                text: "text-destructive",              glow: "glow-red" },
  yellow:  { border: "border-warning/55",                    text: "text-warning",                  glow: "glow-yellow" },
  accent:  { border: "border-accent/55",                     text: "text-accent",                   glow: "glow-cyan" },
  primary: { border: "border-primary/55",                    text: "text-primary",                  glow: "glow-cyan" },
};

const HackerCard = ({ title, icon, children, className, variant = "primary" }: HackerCardProps) => {
  const v = variantStyles[variant];
  return (
    <div className={cn("relative rounded-lg border-2 bg-black/45 backdrop-blur-sm p-3 sm:p-4 transition-all duration-200", v.border, className)}>
      <div className="absolute -top-3 left-3 sm:left-4 bg-black/80 backdrop-blur-sm px-1.5 sm:px-2 rounded">
        <h3 className={cn("text-[10px] sm:text-sm font-bold uppercase tracking-wider", v.text, v.glow)}>
          {icon && <span className="mr-1 sm:mr-2">{icon}</span>}
          {title}
        </h3>
      </div>
      <div className="pt-1.5 sm:pt-2">{children}</div>
    </div>
  );
};

export default HackerCard;
