import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { RAGStatusBadge, calculateRAGStatus } from '@/components/ui/rag-status';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Campaign, Profile, Scorecard, Target } from '@/lib/supabase-types';
import { format, subDays } from 'date-fns';
import { Download, Loader2, MessageSquare, UserCheck, DollarSign, Users } from 'lucide-react';
import { toast } from 'sonner';

interface RepData {
  profile: Profile;
  todayScorecard: Scorecard | null;
  weekConversations: number;
  weekPaidRegs: number;
  weekRevenue: number;
}

export default function AdminDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [targets, setTargets] = useState<Target[]>([]);
  const [repData, setRepData] = useState<RepData[]>([]);
  const [teamTotals, setTeamTotals] = useState({
    totalConversations: 0,
    totalPaidRegs: 0,
    totalRevenue: 0,
    activeReps: 0
  });
  const [isLoading, setIsLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchInitialData = async () => {
      const [campaignsRes, targetsRes] = await Promise.all([
        supabase.from('campaigns').select('*').eq('is_active', true),
        supabase.from('targets').select('*').eq('role', 'sales_rep')
      ]);
      
      if (campaignsRes.data) setCampaigns(campaignsRes.data as Campaign[]);
      if (targetsRes.data) setTargets(targetsRes.data as Target[]);
    };
    
    fetchInitialData();
  }, []);

  useEffect(() => {
    const fetchRepData = async () => {
      setIsLoading(true);
      
      // Fetch all active profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true);
      
      if (!profilesData) {
        setIsLoading(false);
        return;
      }
      
      const profiles = profilesData as Profile[];
      
      // Fetch today's scorecards
      let todayQuery = supabase
        .from('scorecards')
        .select('*')
        .eq('date', today);
      
      if (selectedCampaign !== 'all') {
        todayQuery = todayQuery.eq('campaign_id', selectedCampaign);
      }
      
      const { data: todayScorecards } = await todayQuery;
      
      // Fetch week scorecards
      let weekQuery = supabase
        .from('scorecards')
        .select('*')
        .gte('date', weekAgo);
      
      if (selectedCampaign !== 'all') {
        weekQuery = weekQuery.eq('campaign_id', selectedCampaign);
      }
      
      const { data: weekScorecards } = await weekQuery;
      
      // Aggregate data per rep
      const repDataMap: RepData[] = profiles.map(profile => {
        const todayCards = (todayScorecards as Scorecard[])?.filter(s => s.user_id === profile.user_id) || [];
        const weekCards = (weekScorecards as Scorecard[])?.filter(s => s.user_id === profile.user_id) || [];
        
        const todayAggregated = todayCards.reduce((acc, s) => ({
          conversations_started: acc.conversations_started + s.conversations_started,
          paid_registrations: acc.paid_registrations + s.paid_registrations,
          revenue_collected: acc.revenue_collected + (s.revenue_collected || 0)
        }), { conversations_started: 0, paid_registrations: 0, revenue_collected: 0 });
        
        return {
          profile,
          todayScorecard: todayCards.length > 0 
            ? { ...todayCards[0], ...todayAggregated } as Scorecard
            : null,
          weekConversations: weekCards.reduce((sum, s) => sum + s.conversations_started, 0),
          weekPaidRegs: weekCards.reduce((sum, s) => sum + s.paid_registrations, 0),
          weekRevenue: weekCards.reduce((sum, s) => sum + (s.revenue_collected || 0), 0)
        };
      });
      
      setRepData(repDataMap);
      
      // Calculate team totals for today
      const todayTotals = (todayScorecards as Scorecard[] || []).reduce((acc, s) => ({
        conversations: acc.conversations + s.conversations_started,
        paidRegs: acc.paidRegs + s.paid_registrations,
        revenue: acc.revenue + (s.revenue_collected || 0)
      }), { conversations: 0, paidRegs: 0, revenue: 0 });
      
      setTeamTotals({
        totalConversations: todayTotals.conversations,
        totalPaidRegs: todayTotals.paidRegs,
        totalRevenue: todayTotals.revenue,
        activeReps: repDataMap.filter(r => r.todayScorecard).length
      });
      
      setIsLoading(false);
    };
    
    fetchRepData();
  }, [selectedCampaign, today, weekAgo]);

  const getTargetForCampaign = (campaignId: string): Target | undefined => {
    return targets.find(t => 
      t.campaign_id === campaignId &&
      t.start_date <= today &&
      (!t.end_date || t.end_date >= today)
    );
  };

  const defaultTarget: Target = {
    id: '',
    campaign_id: '',
    role: 'sales_rep',
    conversations_target: 15,
    paid_registrations_target: 0.5,
    start_date: today,
    end_date: null,
    created_at: '',
    updated_at: ''
  };

  const handleExport = () => {
    const headers = ['Name', 'Conversations (Today)', 'Paid Regs (Today)', 'Revenue (Today)', 'Status', 'Week Conversations', 'Week Paid Regs'];
    const rows = repData.map(rep => {
      const target = selectedCampaign !== 'all' 
        ? getTargetForCampaign(selectedCampaign) || defaultTarget
        : defaultTarget;
      const status = rep.todayScorecard
        ? calculateRAGStatus(
            rep.todayScorecard.conversations_started,
            target.conversations_target,
            rep.todayScorecard.paid_registrations,
            target.paid_registrations_target
          )
        : 'N/A';
      
      return [
        rep.profile.full_name,
        rep.todayScorecard?.conversations_started || 0,
        rep.todayScorecard?.paid_registrations || 0,
        rep.todayScorecard?.revenue_collected || 0,
        status,
        rep.weekConversations,
        rep.weekPaidRegs
      ];
    });
    
    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-report-${today}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('Report exported!');
  };

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
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Team Dashboard</h1>
            <p className="text-muted-foreground">
              {format(new Date(), 'EEEE, MMMM d, yyyy')}
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
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" />
              Export
            </Button>
          </div>
        </div>

        {/* Team Totals */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Total Conversations"
            value={teamTotals.totalConversations}
            subtitle="Today's team total"
            icon={<MessageSquare className="h-5 w-5" />}
            variant="glow"
          />
          <StatCard
            title="Total Paid Registrations"
            value={teamTotals.totalPaidRegs}
            subtitle="Today's team total"
            icon={<UserCheck className="h-5 w-5" />}
            variant="gold"
          />
          <StatCard
            title="Total Revenue"
            value={`R${teamTotals.totalRevenue.toLocaleString()}`}
            subtitle="Today's team total"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <StatCard
            title="Reps Submitted"
            value={`${teamTotals.activeReps}/${repData.length}`}
            subtitle="Submitted today"
            icon={<Users className="h-5 w-5" />}
          />
        </div>

        {/* Rep Table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Rep</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Conversations</TableHead>
                <TableHead className="text-right">Paid Regs</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">7d Conv.</TableHead>
                <TableHead className="text-right">7d Regs</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {repData.map(rep => {
                const target = selectedCampaign !== 'all' 
                  ? getTargetForCampaign(selectedCampaign) || defaultTarget
                  : defaultTarget;
                const status = rep.todayScorecard
                  ? calculateRAGStatus(
                      rep.todayScorecard.conversations_started,
                      target.conversations_target,
                      rep.todayScorecard.paid_registrations,
                      target.paid_registrations_target
                    )
                  : null;
                
                return (
                  <TableRow key={rep.profile.id}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-sm font-medium">
                          {rep.profile.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium">{rep.profile.full_name}</p>
                          <p className="text-xs text-muted-foreground">
                            Level {rep.profile.level} • {rep.profile.current_streak}🔥
                          </p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      {status ? (
                        <RAGStatusBadge status={status} showLabel />
                      ) : (
                        <span className="text-xs text-muted-foreground">No submission</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rep.todayScorecard?.conversations_started || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rep.todayScorecard?.paid_registrations || '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {rep.todayScorecard?.revenue_collected 
                        ? `R${rep.todayScorecard.revenue_collected.toLocaleString()}`
                        : '-'}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {rep.weekConversations}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {rep.weekPaidRegs}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
