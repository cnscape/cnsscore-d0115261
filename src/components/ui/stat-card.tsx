import { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface StatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: ReactNode;
  trend?: 'up' | 'down' | 'neutral';
  trendValue?: string;
  variant?: 'default' | 'glow' | 'gold';
  className?: string;
}

export function StatCard({
  title,
  value,
  subtitle,
  icon,
  trend,
  trendValue,
  variant = 'default',
  className
}: StatCardProps) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl border border-border bg-card p-6 card-hover",
        variant === 'glow' && "border-primary/30 animate-pulse-glow",
        variant === 'gold' && "border-gold/30",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={cn(
            "text-3xl font-bold tracking-tight",
            variant === 'glow' && "text-glow text-primary",
            variant === 'gold' && "text-glow-gold text-gold"
          )}>
            {value}
          </p>
          {subtitle && (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          )}
          {trend && trendValue && (
            <div className="flex items-center gap-1">
              <span className={cn(
                "text-sm font-medium",
                trend === 'up' && "text-status-green",
                trend === 'down' && "text-status-red",
                trend === 'neutral' && "text-muted-foreground"
              )}>
                {trend === 'up' && '↑'}
                {trend === 'down' && '↓'}
                {trendValue}
              </span>
            </div>
          )}
        </div>
        {icon && (
          <div className={cn(
            "flex h-12 w-12 items-center justify-center rounded-lg",
            variant === 'default' && "bg-muted text-muted-foreground",
            variant === 'glow' && "bg-primary/20 text-primary",
            variant === 'gold' && "bg-gold/20 text-gold"
          )}>
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
