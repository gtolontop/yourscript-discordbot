interface BadgeProps {
  children: string;
  variant?: "default" | "success" | "warning" | "danger" | "info";
}

const variantStyles: Record<string, string> = {
  default: "bg-discord-border text-discord-text",
  success: "bg-discord-green/20 text-discord-green",
  warning: "bg-discord-yellow/20 text-discord-yellow",
  danger: "bg-discord-red/20 text-discord-red",
  info: "bg-discord-blurple/20 text-discord-blurple",
};

export default function Badge({ children, variant = "default" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
