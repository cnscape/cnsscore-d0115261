import { cn } from '@/lib/utils';
import { RAGStatus } from '@/lib/supabase-types';

interface RAGStatusBadgeProps {
  status: RAGStatus;
  size?: 'sm' | 'md' | 'lg';
  showLabel?: boolean;
  className?: string;
}

const statusConfig = {
  green: {
    label: 'On Track',
    description: 'Hitting volume & conversion targets',
    bgClass: 'bg-status-green',
    textClass: 'text-status-green',
    borderClass: 'border-status-green/30',
    bgMutedClass: 'bg-status-green/20'
  },
  amber: {
    label: 'Review Script',
    description: 'Volume OK, conversion needs work',
    bgClass: 'bg-status-amber',
    textClass: 'text-status-amber',
    borderClass: 'border-status-amber/30',
    bgMutedClass: 'bg-status-amber/20'
  },
  red: {
    label: 'Volume Issue',
    description: 'Not hitting conversation targets',
    bgClass: 'bg-status-red',
    textClass: 'text-status-red',
    borderClass: 'border-status-red/30',
    bgMutedClass: 'bg-status-red/20'
  }
};

const sizeConfig = {
  sm: 'h-2 w-2',
  md: 'h-3 w-3',
  lg: 'h-4 w-4'
};

export function RAGStatusBadge({ status, size = 'md', showLabel = false, className }: RAGStatusBadgeProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn("flex items-center gap-2", className)}>
      <span className={cn(
        "rounded-full",
        sizeConfig[size],
        config.bgClass
      )} />
      {showLabel && (
        <span className={cn("text-sm font-medium", config.textClass)}>
          {config.label}
        </span>
      )}
    </div>
  );
}

interface RAGStatusCardProps {
  status: RAGStatus;
  className?: string;
}

export function RAGStatusCard({ status, className }: RAGStatusCardProps) {
  const config = statusConfig[status];
  
  return (
    <div className={cn(
      "rounded-lg border p-3",
      config.borderClass,
      config.bgMutedClass,
      className
    )}>
      <div className="flex items-center gap-2">
        <span className={cn("h-3 w-3 rounded-full", config.bgClass)} />
        <span className={cn("font-medium", config.textClass)}>
          {config.label}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        {config.description}
      </p>
    </div>
  );
}

export function calculateRAGStatus(
  conversations: number,
  conversationsTarget: number,
  paidRegistrations: number,
  registrationsTarget: number
): RAGStatus {
  const hittingVolume = conversations >= conversationsTarget;
  const hittingConversion = paidRegistrations >= registrationsTarget;

  if (hittingVolume && hittingConversion) return 'green';
  if (hittingVolume && !hittingConversion) return 'amber';
  return 'red';
}
