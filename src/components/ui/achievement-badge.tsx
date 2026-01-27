import { cn } from '@/lib/utils';
import { Achievement } from '@/lib/supabase-types';

interface AchievementBadgeProps {
  achievement: Achievement;
  earned?: boolean;
  earnedAt?: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeConfig = {
  sm: 'h-10 w-10 text-lg',
  md: 'h-14 w-14 text-2xl',
  lg: 'h-20 w-20 text-4xl'
};

export function AchievementBadge({ 
  achievement, 
  earned = false, 
  earnedAt,
  size = 'md',
  className 
}: AchievementBadgeProps) {
  return (
    <div className={cn(
      "flex flex-col items-center gap-2",
      !earned && "opacity-40 grayscale",
      className
    )}>
      <div 
        className={cn(
          "flex items-center justify-center rounded-full",
          sizeConfig[size],
          earned ? "achievement-badge" : "bg-muted"
        )}
        style={earned ? { background: `linear-gradient(135deg, ${achievement.badge_color}, ${achievement.badge_color}dd)` } : undefined}
      >
        <span>{achievement.icon}</span>
      </div>
      <div className="text-center">
        <p className={cn(
          "text-sm font-semibold",
          earned ? "text-foreground" : "text-muted-foreground"
        )}>
          {achievement.name}
        </p>
        {earned && earnedAt && (
          <p className="text-xs text-muted-foreground">
            Earned {new Date(earnedAt).toLocaleDateString()}
          </p>
        )}
        {!earned && (
          <p className="text-xs text-muted-foreground">
            +{achievement.xp_reward} XP
          </p>
        )}
      </div>
    </div>
  );
}

interface AchievementGridProps {
  achievements: Achievement[];
  earnedIds: Set<string>;
  earnedDates?: Record<string, string>;
  className?: string;
}

export function AchievementGrid({ 
  achievements, 
  earnedIds, 
  earnedDates = {},
  className 
}: AchievementGridProps) {
  return (
    <div className={cn("grid grid-cols-4 gap-4 sm:grid-cols-6 md:grid-cols-8", className)}>
      {achievements.map(achievement => (
        <AchievementBadge
          key={achievement.id}
          achievement={achievement}
          earned={earnedIds.has(achievement.id)}
          earnedAt={earnedDates[achievement.id]}
          size="sm"
        />
      ))}
    </div>
  );
}
