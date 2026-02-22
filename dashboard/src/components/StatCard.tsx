import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  color?: string;
}

export default function StatCard({
  label,
  value,
  icon: Icon,
  color = "text-discord-blurple",
}: StatCardProps) {
  return (
    <div className="bg-discord-card border border-discord-border rounded-xl p-4 flex items-center gap-4">
      <div className={`p-3 rounded-lg bg-discord-dark ${color}`}>
        <Icon size={24} />
      </div>
      <div>
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-sm text-discord-muted">{label}</p>
      </div>
    </div>
  );
}
