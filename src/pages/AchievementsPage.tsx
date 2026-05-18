import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { AchievementBadge } from '@/components/ui/achievement-badge';
import { XPProgress } from '@/components/ui/xp-progress';
import { Achievement, UserAchievement } from '@/lib/supabase-types';
import { Loader2, Trophy } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import HistoryPage from './HistoryPage';

export default function AchievementsPage() {
  const { user, profile } = useAuth();
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      
      const [achievementsRes, userAchievementsRes] = await Promise.all([
        supabase.from('achievements').select('*').order('xp_reward', { ascending: true }),
        supabase.from('user_achievements').select('*').eq('user_id', user.id)
      ]);
      
      if (achievementsRes.data) {
        setAchievements(achievementsRes.data as Achievement[]);
      }
      
      if (userAchievementsRes.data) {
        setUserAchievements(userAchievementsRes.data as UserAchievement[]);
      }
      
      setIsLoading(false);
    };
    
    fetchData();
  }, [user]);

  const earnedIds = new Set(userAchievements.map(ua => ua.achievement_id));
  const earnedDates: Record<string, string> = {};
  userAchievements.forEach(ua => {
    earnedDates[ua.achievement_id] = ua.earned_at;
  });

  const earnedAchievements = achievements.filter(a => earnedIds.has(a.id));
  const lockedAchievements = achievements.filter(a => !earnedIds.has(a.id));

  if (isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center h-full">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header with XP */}
        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <Trophy className="h-8 w-8 text-gold" />
              Achievements
            </h1>
            <p className="text-muted-foreground mt-1">
              {earnedAchievements.length} of {achievements.length} unlocked
            </p>
          </div>
          
          {profile && (
            <div className="w-full lg:w-80 p-4 rounded-xl border border-border bg-card">
              <XPProgress currentXP={profile.total_xp} level={profile.level} />
            </div>
          )}
        </div>

        <Tabs defaultValue="achievements" className="space-y-6">
          <TabsList>
            <TabsTrigger value="achievements">Achievements</TabsTrigger>
            <TabsTrigger value="history">My History</TabsTrigger>
          </TabsList>

          <TabsContent value="achievements" className="space-y-8">
        {/* Earned Achievements */}
        {earnedAchievements.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-status-green">
              🏆 Unlocked ({earnedAchievements.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {earnedAchievements.map(achievement => (
                <AchievementBadge
                  key={achievement.id}
                  achievement={achievement}
                  earned
                  earnedAt={earnedDates[achievement.id]}
                  size="md"
                />
              ))}
            </div>
          </div>
        )}

        {/* Locked Achievements */}
        {lockedAchievements.length > 0 && (
          <div>
            <h2 className="text-xl font-semibold mb-4 text-muted-foreground">
              🔒 Locked ({lockedAchievements.length})
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-6">
              {lockedAchievements.map(achievement => (
                <div key={achievement.id} className="text-center">
                  <AchievementBadge
                    achievement={achievement}
                    earned={false}
                    size="md"
                  />
                  <p className="mt-2 text-xs text-muted-foreground px-2">
                    {achievement.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
          </TabsContent>

          <TabsContent value="history">
            <HistoryPage embedded />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
