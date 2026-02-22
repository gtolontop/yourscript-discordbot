import type { ReactNode } from "react";

interface CardProps {
  title?: string;
  description?: string;
  children: ReactNode;
  className?: string;
  actions?: ReactNode;
}

export default function Card({
  title,
  description,
  children,
  className = "",
  actions,
}: CardProps) {
  return (
    <div
      className={`bg-discord-card border border-discord-border rounded-xl ${className}`}
    >
      {(title || actions) && (
        <div className="flex items-center justify-between p-4 border-b border-discord-border">
          <div>
            {title && <h3 className="font-semibold">{title}</h3>}
            {description && (
              <p className="text-sm text-discord-muted mt-0.5">{description}</p>
            )}
          </div>
          {actions && <div className="flex items-center gap-2">{actions}</div>}
        </div>
      )}
      <div className="p-4">{children}</div>
    </div>
  );
}
