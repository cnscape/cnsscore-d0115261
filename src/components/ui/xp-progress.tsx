import { cn } from '@/lib/utils';

interface XPProgressProps {
  currentXP: number;
  level: number;
  className?: string;
}

const XP_PER_LEVEL = 500;

export function XPProgress({ currentXP, level, className }: XPProgressProps) {
  const xpInCurrentLevel = currentXP % XP_PER_LEVEL;
  const progressPercent = (xpInCurrentLevel / XP_PER_LEVEL) * 100;
  const xpToNextLevel = XP_PER_LEVEL - xpInCurrentLevel;

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-sm font-bold text-primary level-glow">
            {level}
          </div>
          <span className="text-sm font-medium text-muted-foreground">Level {level}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {xpToNextLevel} XP to next level
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full xp-bar-fill transition-all duration-500 ease-out"
          style={{ width: `${progressPercent}%` }}
        />
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{xpInCurrentLevel} XP</span>
        <span>{XP_PER_LEVEL} XP</span>
      </div>
    </div>
  );
}
