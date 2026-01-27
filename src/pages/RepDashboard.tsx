import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { RAGStatusCard, calculateRAGStatus } from '@/components/ui/rag-status';
import { MessageSquare, UserCheck, DollarSign, Phone, TrendingUp } from 'lucide-react';
import { Campaign, Scorecard, Target } from '@/lib/supabase-types';
import { format, subDays } from 'date-fns';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Link } from 'react-router-dom';

export default function RepDashboard() {
  const { user, profile } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [todayScorecard, setTodayScorecard] = useState<Scorecard | null>(null);
  const [weekStats, setWeekStats] = useState({
    totalConversations: 0,
    totalPaidRegs: 0,
    totalRevenue: 0,
    totalCalls: 0,
    avgConversations: 0,
    avgPaidRegs: 0
  });
  const [currentTarget, setCurrentTarget] = useState<Target | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      
      // Fetch campaigns
      const { data: campaignsData } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true);
      
      if (campaignsData) {
        setCampaigns(campaignsData as Campaign[]);
      }
      
      // Fetch today's scorecard
      const today = format(new Date(), 'yyyy-MM-dd');
      const { data: todayData } = await supabase
        .from('scorecards')
        .select('*')
        .eq('user_id', user.id)
        .eq('date', today)
        .maybeSingle();
      
      if (todayData) {
        setTodayScorecard(todayData as Scorecard);
      }
      
      // Fetch last 7 days stats
      const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');
      let query = supabase
        .from('scorecards')
        .select('*')
        .eq('user_id', user.id)
        .gte('date', weekAgo);
      
      if (selectedCampaign !== 'all') {
        query = query.eq('campaign_id', selectedCampaign);
      }
      
      const { data: weekData } = await query;
      
      if (weekData && weekData.length > 0) {
        const scorecards = weekData as Scorecard[];
        const totalConversations = scorecards.reduce((sum, s) => sum + s.conversations_started, 0);
        const totalPaidRegs = scorecards.reduce((sum, s) => sum + s.paid_registrations, 0);
        const totalRevenue = scorecards.reduce((sum, s) => sum + (s.revenue_collected || 0), 0);
        const totalCalls = scorecards.reduce((sum, s) => sum + (s.calls_made || 0), 0);
        
        setWeekStats({
          totalConversations,
          totalPaidRegs,
          totalRevenue,
          totalCalls,
          avgConversations: Math.round(totalConversations / scorecards.length),
          avgPaidRegs: Math.round((totalPaidRegs / scorecards.length) * 10) / 10
        });
      } else {
        setWeekStats({
          totalConversations: 0,
          totalPaidRegs: 0,
          totalRevenue: 0,
          totalCalls: 0,
          avgConversations: 0,
          avgPaidRegs: 0
        });
      }
      
      // Fetch current target
      if (selectedCampaign !== 'all') {
        const { data: targetData } = await supabase
          .from('targets')
          .select('*')
          .eq('campaign_id', selectedCampaign)
          .eq('role', 'sales_rep')
          .lte('start_date', today)
          .or(`end_date.is.null,end_date.gte.${today}`)
          .order('start_date', { ascending: false })
          .limit(1)
          .maybeSingle();
        
        if (targetData) {
          setCurrentTarget(targetData as Target);
        }
      }
      
      setIsLoading(false);
    };
    
    fetchData();
  }, [user, selectedCampaign]);

  const ragStatus = todayScorecard && currentTarget
    ? calculateRAGStatus(
        todayScorecard.conversations_started,
        currentTarget.conversations_target,
        todayScorecard.paid_registrations,
        currentTarget.paid_registrations_target
      )
    : 'red';

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground">
              Welcome back, {profile?.full_name || 'Rep'}! Track your daily performance.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="All Campaigns" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map(campaign => (
                  <SelectItem key={campaign.id} value={campaign.id}>
                    {campaign.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button asChild>
              <Link to="/scorecard">Log Today</Link>
            </Button>
          </div>
        </div>

        {/* Today's Status */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Conversations Today"
            value={todayScorecard?.conversations_started || 0}
            subtitle={currentTarget ? `Target: ${currentTarget.conversations_target}` : undefined}
            icon={<MessageSquare className="h-5 w-5" />}
            variant={todayScorecard && currentTarget && todayScorecard.conversations_started >= currentTarget.conversations_target ? 'glow' : 'default'}
          />
          <StatCard
            title="Paid Registrations"
            value={todayScorecard?.paid_registrations || 0}
            subtitle={currentTarget ? `Target: ${currentTarget.paid_registrations_target}` : undefined}
            icon={<UserCheck className="h-5 w-5" />}
            variant={todayScorecard && todayScorecard.paid_registrations > 0 ? 'gold' : 'default'}
          />
          <StatCard
            title="Revenue Today"
            value={`R${(todayScorecard?.revenue_collected || 0).toLocaleString()}`}
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatCard
            title="Calls Made"
            value={todayScorecard?.calls_made || 0}
            icon={<Phone className="h-5 w-5" />}
          />
        </div>

        {/* Status Card */}
        {todayScorecard && currentTarget && (
          <RAGStatusCard status={ragStatus} />
        )}
        
        {!todayScorecard && (
          <div className="rounded-xl border border-border bg-card p-6 text-center">
            <p className="text-muted-foreground mb-4">You haven't logged today's scorecard yet.</p>
            <Button asChild>
              <Link to="/scorecard">Submit Today's Scorecard</Link>
            </Button>
          </div>
        )}

        {/* 7-Day Stats */}
        <div>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-primary" />
            7-Day Rolling Average
          </h2>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <StatCard
              title="Total Conversations"
              value={weekStats.totalConversations}
              subtitle={`~${weekStats.avgConversations} per day`}
            />
            <StatCard
              title="Total Paid Registrations"
              value={weekStats.totalPaidRegs}
              subtitle={`~${weekStats.avgPaidRegs} per day`}
            />
            <StatCard
              title="Total Revenue"
              value={`R${weekStats.totalRevenue.toLocaleString()}`}
            />
            <StatCard
              title="Total Calls"
              value={weekStats.totalCalls}
            />
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
