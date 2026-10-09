import {
  AlertCircle,
  CheckCircle2,
  Inbox,
  LoaderCircle,
  type LucideIcon,
} from 'lucide-react';
import type { ReactNode } from 'react';

type FeedbackTone = 'empty' | 'loading' | 'error' | 'success';

interface FeedbackStateProps {
  tone: FeedbackTone;
  title: string;
  description?: string;
  action?: ReactNode;
}

const stateStyles: Record<
  FeedbackTone,
  { icon: LucideIcon; iconClass: string; containerClass: string }
> = {
  empty: {
    icon: Inbox,
    iconClass: 'text-slate-500',
    containerClass: 'bg-slate-100',
  },
  loading: {
    icon: LoaderCircle,
    iconClass: 'animate-spin text-teal-700',
    containerClass: 'bg-teal-50',
  },
  error: {
    icon: AlertCircle,
    iconClass: 'text-rose-700',
    containerClass: 'bg-rose-50',
  },
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-700',
    containerClass: 'bg-emerald-50',
  },
};

export function FeedbackState({
  tone,
  title,
  description,
  action,
}: FeedbackStateProps) {
  const { icon: Icon, iconClass, containerClass } = stateStyles[tone];

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className="flex min-h-48 flex-col items-center justify-center px-6 py-10 text-center"
    >
      <span
        className={`flex h-11 w-11 items-center justify-center rounded-xl ${containerClass}`}
      >
        <Icon size={20} className={iconClass} />
      </span>
      <h3 className="mt-4 text-sm font-semibold text-slate-800">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-6 text-slate-500">
          {description}
        </p>
      )}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}
