import { cn } from "@/lib/utils";

type BadgeVariant = "default" | "success" | "warning" | "destructive" | "outline";

interface BadgeProps {
  children: React.ReactNode;
  variant?: BadgeVariant;
  color?: { bg: string; text: string };
  className?: string;
}

const variantStyles: Record<BadgeVariant, string> = {
  default: "bg-muted text-muted-foreground",
  success: "bg-primary-subtle text-accent-foreground",
  warning: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  destructive: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  outline: "border border-border text-foreground-secondary bg-transparent",
};

export function Badge({ children, variant = "default", color, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        !color && variantStyles[variant],
        className
      )}
      style={color ? { backgroundColor: color.bg, color: color.text } : undefined}
    >
      {children}
    </span>
  );
}
