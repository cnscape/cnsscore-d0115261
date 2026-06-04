import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { StatCard } from '@/components/ui/stat-card';
import { StreakBadge } from '@/components/ui/streak-badge';
import { XPProgress } from '@/components/ui/xp-progress';
import { Loader2, DollarSign, Briefcase, Users, Trophy, Flame, Star } from 'lucide-react';
import { format } from 'date-fns';
import { Achievement, UserAchievement } from '@/lib/supabase-types';

interface DealRow {
  id: string;
  status: string;
  revenue: number | null;
  rep_commission: number | null;
  commission_percent: number | null;
  lead_name: string | null;
  created_at: string;
  closed_at: string | null;
  client_id: string;
  expected_close_date: string | null;
  close_date_pushed_count: number | null;
  discount_percent: number | null;
  clients?: { name: string };
}

export default function MyCommissionPage() {
  const { user, profile } = useAuth();
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [userAchievements, setUserAchievements] = useState<UserAchievement[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setIsLoading(true);
      const [dealsRes, achievementsRes, uaRes] = await Promise.all([
        supabase.from('deals').select('id, status, revenue, rep_commission, commission_percent, lead_name, created_at, closed_at, client_id, expected_close_date, close_date_pushed_count, discount_percent, clients(name)').eq('rep_id', user.id).order('created_at', { ascending: false }),
        supabase.from('achievements').select('*').order('xp_reward', { ascending: true }),
        supabase.from('user_achievements').select('*').eq('user_id', user.id),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as unknown as DealRow[]);
      if (achievementsRes.data) setAchievements(achievementsRes.data as Achievement[]);
      if (uaRes.data) setUserAchievements(uaRes.data as UserAchievement[]);
      setIsLoading(false);
    };
    fetchData();
  }, [user]);

  const wonDeals = deals.filter(d => d.status === 'won');
  const totalCommission = wonDeals.reduce((s, d) => s + (d.rep_commission || 0), 0);
  const totalRevenue = wonDeals.reduce((s, d) => s + (d.revenue || 0), 0);
  const totalReachOuts = deals.length;
  const earnedIds = new Set(userAchievements.map(ua => ua.achievement_id));

  // Group commission by client
  const clientCommissions = wonDeals.reduce<Record<string, { name: string; total: number; count: number }>>((acc, d) => {
    const name = d.clients?.name || 'Unknown';
    if (!acc[d.client_id]) acc[d.client_id] = { name, total: 0, count: 0 };
    acc[d.client_id].total += d.rep_commission || 0;
    acc[d.client_id].count += 1;
    return acc;
  }, {});

  if (isLoading) {
    return (<AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>);
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Commission</h1>
          <p className="text-muted-foreground">Your personal earnings, performance, and achievements</p>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Total Commission" value={`R${totalCommission.toLocaleString()}`} subtitle="From won deals" icon={<DollarSign className="h-5 w-5" />} variant="glow" />
          <StatCard title="Total Revenue" value={`R${totalRevenue.toLocaleString()}`} subtitle="Won deals" icon={<Briefcase className="h-5 w-5" />} />
          <StatCard title="Won Deals" value={wonDeals.length} subtitle={`${totalReachOuts} total reach-outs`} icon={<Trophy className="h-5 w-5" />} variant="gold" />
          <StatCard title="People Contacted" value={totalReachOuts} subtitle="All deals" icon={<Users className="h-5 w-5" />} />
        </div>

        {/* Gamification - Level, XP, Streak, Achievements */}
        {profile && (
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Star className="h-5 w-5 text-primary" /> Level & XP</CardTitle></CardHeader>
              <CardContent>
                <XPProgress currentXP={profile.total_xp} level={profile.level} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Flame className="h-5 w-5 text-[hsl(var(--status-amber))]" /> Streak</CardTitle></CardHeader>
              <CardContent>
                <StreakBadge streak={profile.current_streak} longestStreak={profile.longest_streak} />
              </CardContent>
            </Card>
            <Card>
              <CardHeader><CardTitle className="text-lg flex items-center gap-2"><Trophy className="h-5 w-5 text-[hsl(var(--gold))]" /> Achievements</CardTitle></CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{userAchievements.length} <span className="text-sm font-normal text-muted-foreground">/ {achievements.length} unlocked</span></p>
                <div className="flex gap-1 mt-2 flex-wrap">
                  {achievements.filter(a => earnedIds.has(a.id)).slice(0, 6).map(a => (
                    <span key={a.id} className="text-lg" title={a.name}>{a.icon}</span>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Commission by Client */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Commission by Client</CardTitle></CardHeader>
          <CardContent>
            {Object.keys(clientCommissions).length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Deals Won</TableHead>
                    <TableHead className="text-right">Commission Earned</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {Object.values(clientCommissions).sort((a, b) => b.total - a.total).map((c, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-medium">{c.name}</TableCell>
                      <TableCell className="text-right font-mono">{c.count}</TableCell>
                      <TableCell className="text-right font-mono text-primary">R{c.total.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">No commissions earned yet. Close some deals!</p>
            )}
          </CardContent>
        </Card>

        {/* Recent Won Deals */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Recent Won Deals</CardTitle></CardHeader>
          <CardContent>
            {wonDeals.length > 0 ? (
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Lead</TableHead>
                    <TableHead>Client</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">Commission</TableHead>
                    <TableHead>Date Closed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {wonDeals.slice(0, 20).map(deal => (
                    <TableRow key={deal.id}>
                      <TableCell className="font-medium">{deal.lead_name || '—'}</TableCell>
                      <TableCell>{deal.clients?.name || '—'}</TableCell>
                      <TableCell className="text-right font-mono">R{(deal.revenue || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-primary">R{(deal.rep_commission || 0).toLocaleString()}</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{deal.closed_at ? format(new Date(deal.closed_at), 'dd MMM yyyy') : '—'}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            ) : (
              <p className="text-center text-muted-foreground py-4">No won deals yet.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
