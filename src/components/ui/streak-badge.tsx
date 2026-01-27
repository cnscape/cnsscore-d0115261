import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StreakBadgeProps {
  streak: number;
  longestStreak: number;
  className?: string;
}

export function StreakBadge({ streak, longestStreak, className }: StreakBadgeProps) {
  const isOnFire = streak >= 7;

  return (
    <div className={cn(
      "flex items-center gap-3 rounded-xl border border-border bg-card p-4",
      isOnFire && "border-streak/30",
      className
    )}>
      <div className={cn(
        "flex h-12 w-12 items-center justify-center rounded-full",
        isOnFire ? "bg-streak/20" : "bg-muted"
      )}>
        <Flame className={cn(
          "h-6 w-6",
          isOnFire ? "text-streak streak-flame" : "text-muted-foreground"
        )} />
      </div>
      <div>
        <div className="flex items-baseline gap-1">
          <span className={cn(
            "text-2xl font-bold",
            isOnFire && "text-streak"
          )}>
            {streak}
          </span>
          <span className="text-sm text-muted-foreground">day streak</span>
        </div>
        <p className="text-xs text-muted-foreground">
          Best: {longestStreak} days
        </p>
      </div>
    </div>
  );
}
