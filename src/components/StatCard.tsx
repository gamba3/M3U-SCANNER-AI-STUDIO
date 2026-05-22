import { cn } from "../lib/utils";

interface StatCardProps {
  label: string;
  value: string | number;
  variant?: "green" | "red" | "cyan" | "yellow" | "orange" | "gold" | "white";
}

const StatCard = ({ label, value, variant = "green" }: StatCardProps) => {
  const variantClasses = {
    green: "text-primary glow-green border-primary",
    red: "text-destructive glow-red border-destructive",
    cyan: "text-accent glow-cyan border-accent",
    yellow: "text-warning glow-yellow border-warning",
    orange: "text-[hsl(var(--neon-orange))] glow-orange border-[hsl(var(--neon-orange))]",
    gold: "text-[hsl(var(--neon-gold))] glow-gold border-[hsl(var(--neon-gold))]",
    white: "text-foreground glow-white border-foreground",
  };

  return (
    <div className={cn("flex flex-col items-center justify-center rounded-md border-2 bg-black/45 backdrop-blur-sm p-2 sm:p-3 transition-all duration-200 hover:scale-105", variantClasses[variant])}>
      <span className="text-[9px] sm:text-xs font-medium uppercase tracking-wider opacity-80">{label}</span>
      <span className="text-base sm:text-lg md:text-2xl font-bold">{value}</span>
    </div>
  );
};

export default StatCard;
