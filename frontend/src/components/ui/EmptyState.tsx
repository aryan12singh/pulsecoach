import { ReactNode } from "react";
import { Activity, LucideIcon } from "lucide-react";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  body?: string;
  action?: ReactNode;
}

export default function EmptyState({ icon: Icon = Activity, title, body, action }: EmptyStateProps) {
  return (
    <div className="text-center py-11 px-5">
      <div className="w-[52px] h-[52px] rounded-[14px] bg-surface-2 border border-border grid place-items-center mx-auto mb-3.5 text-faint">
        <Icon size={22} />
      </div>
      <div className="font-display font-semibold text-[16px]">{title}</div>
      {body && (
        <div className="text-muted text-sm mt-1.5 max-w-[320px] mx-auto">{body}</div>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
