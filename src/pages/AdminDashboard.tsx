import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { RAGStatusBadge, calculateRAGStatus } from '@/components/ui/rag-status';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Campaign, Profile, Scorecard, Target } from '@/lib/supabase-types';
import { format, subDays } from 'date-fns';
import { 
  Download, Loader2, MessageSquare, UserCheck, DollarSign, Users, 
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Briefcase, FileText
} from 'lucide-react';
import { toast } from 'sonner';

interface RepData {
  profile: Profile;
  todayScorecard: Scorecard | null;
  weekConversations: number;
  weekPaidRegs: number;
  weekRevenue: number;
}

interface DailyUpdateSummary {
  user_id: string;
  full_name: string;
  status: string;
  did_today: string;
  blockers: string;
  admin_comment: string | null;
}

export default function AdminDashboard() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [targets, setTargets] = useState<Target[]>([]);
  const [repData, setRepData] = useState<RepData[]>([]);
  const [dailyUpdates, setDailyUpdates] = useState<DailyUpdateSummary[]>([]);
  const [allProfiles, setAllProfiles] = useState<Profile[]>([]);
  const [teamTotals, setTeamTotals] = useState({
    totalConversations: 0,
    totalPaidRegs: 0,
    totalRevenue: 0,
    activeReps: 0
  });
  const [dealStats, setDealStats] = useState({ total: 0, open: 0, won: 0, revenue: 0, cnsShare: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const today = format(new Date(), 'yyyy-MM-dd');
  const weekAgo = format(subDays(new Date(), 7), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);

      const [campaignsRes, targetsRes, profilesRes, dealsRes, dailyUpdatesRes] = await Promise.all([
        supabase.from('campaigns').select('*').eq('is_active', true),
        supabase.from('targets').select('*').eq('role', 'sales_rep'),
        supabase.from('profiles').select('*').eq('is_active', true),
        supabase.from('deals').select('*'),
        (supabase as any).from('daily_updates').select('*').eq('date', today),
      ]);

      if (campaignsRes.data) setCampaigns(campaignsRes.data as Campaign[]);
      if (targetsRes.data) setTargets(targetsRes.data as Target[]);

      const profiles = (profilesRes.data || []) as Profile[];
      setAllProfiles(profiles);

      // Process deals
      const deals = (dealsRes.data || []) as any[];
      setDealStats({
        total: deals.length,
        open: deals.filter(d => d.status === 'open').length,
        won: deals.filter(d => d.status === 'won').length,
        revenue: deals.filter(d => d.status === 'won').reduce((s: number, d: any) => s + (d.gross_revenue || 0), 0),
        cnsShare: deals.filter(d => d.status === 'won').reduce((s: number, d: any) => s + (d.cape_neto_share || 0), 0),
      });

      // Process daily updates
      const updates = (dailyUpdatesRes.data || []) as any[];
      const updateSummaries: DailyUpdateSummary[] = updates.map((u: any) => {
        const profile = profiles.find(p => p.user_id === u.user_id);
        return {
          user_id: u.user_id,
          full_name: profile?.full_name || 'Unknown',
          status: u.status,
          did_today: u.did_today,
          blockers: u.blockers,
          admin_comment: u.admin_comment,
        };
      });
      setDailyUpdates(updateSummaries);

      // Process scorecards
      let todayQuery = supabase.from('scorecards').select('*').eq('date', today);
      if (selectedCampaign !== 'all') todayQuery = todayQuery.eq('campaign_id', selectedCampaign);
      const { data: todayScorecards } = await todayQuery;

      let weekQuery = supabase.from('scorecards').select('*').gte('date', weekAgo);
      if (selectedCampaign !== 'all') weekQuery = weekQuery.eq('campaign_id', selectedCampaign);
      const { data: weekScorecards } = await weekQuery;

      const repDataMap: RepData[] = profiles.map(profile => {
        const todayCards = (todayScorecards as Scorecard[])?.filter(s => s.user_id === profile.user_id) || [];
        const weekCards = (weekScorecards as Scorecard[])?.filter(s => s.user_id === profile.user_id) || [];

        const todayAgg = todayCards.reduce((acc, s) => ({
          conversations_started: acc.conversations_started + s.conversations_started,
          paid_registrations: acc.paid_registrations + s.paid_registrations,
          revenue_collected: acc.revenue_collected + (s.revenue_collected || 0)
        }), { conversations_started: 0, paid_registrations: 0, revenue_collected: 0 });

        return {
          profile,
          todayScorecard: todayCards.length > 0 ? { ...todayCards[0], ...todayAgg } as Scorecard : null,
          weekConversations: weekCards.reduce((sum, s) => sum + s.conversations_started, 0),
          weekPaidRegs: weekCards.reduce((sum, s) => sum + s.paid_registrations, 0),
          weekRevenue: weekCards.reduce((sum, s) => sum + (s.revenue_collected || 0), 0)
        };
      });

      setRepData(repDataMap);

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

    fetchAll();
  }, [selectedCampaign, today, weekAgo]);

  const getTargetForCampaign = (campaignId: string): Target | undefined => {
    return targets.find(t => t.campaign_id === campaignId && t.start_date <= today && (!t.end_date || t.end_date >= today));
  };

  const defaultTarget: Target = {
    id: '', campaign_id: '', role: 'sales_rep',
    conversations_target: 15, paid_registrations_target: 0.5,
    start_date: today, end_date: null, created_at: '', updated_at: ''
  };

  const handleExport = () => {
    const headers = ['Name', 'Conversations', 'Paid Regs', 'Revenue', 'Status', '7d Conv.', '7d Regs'];
    const rows = repData.map(rep => {
      const target = selectedCampaign !== 'all' ? getTargetForCampaign(selectedCampaign) || defaultTarget : defaultTarget;
      const status = rep.todayScorecard
        ? calculateRAGStatus(rep.todayScorecard.conversations_started, target.conversations_target, rep.todayScorecard.paid_registrations, target.paid_registrations_target)
        : 'N/A';
      return [rep.profile.full_name, rep.todayScorecard?.conversations_started || 0, rep.todayScorecard?.paid_registrations || 0, rep.todayScorecard?.revenue_collected || 0, status, rep.weekConversations, rep.weekPaidRegs];
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

  // Missing submissions
  const submittedUserIds = new Set(repData.filter(r => r.todayScorecard).map(r => r.profile.user_id));
  const dailyUpdateUserIds = new Set(dailyUpdates.map(u => u.user_id));
  const missingKPI = allProfiles.filter(p => !submittedUserIds.has(p.user_id));
  const blockedUpdates = dailyUpdates.filter(u => u.status === 'blocked');

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
            <h1 className="text-3xl font-bold">Command Center</h1>
            <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
              <SelectTrigger className="w-40"><SelectValue placeholder="All Campaigns" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Campaigns</SelectItem>
                {campaigns.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Button variant="outline" onClick={handleExport}>
              <Download className="h-4 w-4 mr-2" /> Export
            </Button>
          </div>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="sales">Sales Analytics</TabsTrigger>
            <TabsTrigger value="growth">Growth Team</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            {/* Top-level stats */}
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <StatCard title="KPI Submissions" value={`${teamTotals.activeReps}/${allProfiles.length}`} subtitle="Today" icon={<MessageSquare className="h-5 w-5" />} />
              <StatCard title="Conversations" value={teamTotals.totalConversations} subtitle="Today's total" icon={<MessageSquare className="h-5 w-5" />} variant="glow" />
              <StatCard title="Paid Registrations" value={teamTotals.totalPaidRegs} subtitle="Today" icon={<UserCheck className="h-5 w-5" />} variant="gold" />
              <StatCard title="Pipeline Deals" value={dealStats.open} subtitle={`${dealStats.total} total`} icon={<Briefcase className="h-5 w-5" />} />
              <StatCard title="Won Revenue" value={`R${dealStats.revenue.toLocaleString()}`} subtitle={`CNS: R${dealStats.cnsShare.toLocaleString()}`} icon={<DollarSign className="h-5 w-5" />} />
            </div>

            {/* Missing submissions + Blockers */}
            <div className="grid gap-6 lg:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <AlertTriangle className="h-5 w-5 text-secondary" />
                    Missing Submissions ({missingKPI.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {missingKPI.length > 0 ? (
                    <div className="space-y-2">
                      {missingKPI.map(p => (
                        <div key={p.id} className="flex items-center gap-2 p-2 rounded-lg bg-muted/30">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-destructive/20 text-destructive text-xs font-bold">
                            {p.full_name.charAt(0)}
                          </div>
                          <span className="text-sm">{p.full_name}</span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-[hsl(var(--status-green))] flex items-center gap-2">
                      <CheckCircle className="h-4 w-4" /> Everyone has submitted!
                    </p>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <XCircle className="h-5 w-5 text-destructive" />
                    Blockers ({blockedUpdates.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {blockedUpdates.length > 0 ? (
                    <div className="space-y-3">
                      {blockedUpdates.map((u, i) => (
                        <div key={i} className="p-3 rounded-lg border border-destructive/30 bg-destructive/5">
                          <p className="text-sm font-medium">{u.full_name}</p>
                          <p className="text-xs text-muted-foreground mt-1">{u.blockers}</p>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No blockers reported today</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </TabsContent>

          {/* SALES TAB */}
          <TabsContent value="sales" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Conversations" value={teamTotals.totalConversations} subtitle="Today" icon={<MessageSquare className="h-5 w-5" />} variant="glow" />
              <StatCard title="Paid Regs" value={teamTotals.totalPaidRegs} subtitle="Today" icon={<UserCheck className="h-5 w-5" />} variant="gold" />
              <StatCard title="Revenue" value={`R${teamTotals.totalRevenue.toLocaleString()}`} subtitle="Today" icon={<DollarSign className="h-5 w-5" />} />
              <StatCard title="Reps Active" value={`${teamTotals.activeReps}/${repData.length}`} subtitle="Submitted" icon={<Users className="h-5 w-5" />} />
            </div>

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
                    const target = selectedCampaign !== 'all' ? getTargetForCampaign(selectedCampaign) || defaultTarget : defaultTarget;
                    const status = rep.todayScorecard
                      ? calculateRAGStatus(rep.todayScorecard.conversations_started, target.conversations_target, rep.todayScorecard.paid_registrations, target.paid_registrations_target)
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
                              <p className="text-xs text-muted-foreground">Level {rep.profile.level} • {rep.profile.current_streak}🔥</p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell className="text-center">
                          {status ? <RAGStatusBadge status={status} showLabel /> : <span className="text-xs text-muted-foreground">—</span>}
                        </TableCell>
                        <TableCell className="text-right font-mono">{rep.todayScorecard?.conversations_started || '-'}</TableCell>
                        <TableCell className="text-right font-mono">{rep.todayScorecard?.paid_registrations || '-'}</TableCell>
                        <TableCell className="text-right font-mono">{rep.todayScorecard?.revenue_collected ? `R${rep.todayScorecard.revenue_collected.toLocaleString()}` : '-'}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{rep.weekConversations}</TableCell>
                        <TableCell className="text-right font-mono text-muted-foreground">{rep.weekPaidRegs}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* GROWTH TEAM TAB */}
          <TabsContent value="growth" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-3">
              <StatCard title="Daily Updates" value={dailyUpdates.length} subtitle="Submitted today" icon={<FileText className="h-5 w-5" />} />
              <StatCard 
                title="On Track" 
                value={dailyUpdates.filter(u => u.status === 'on_track').length} 
                subtitle="Projects on track" 
                icon={<CheckCircle className="h-5 w-5" />}
                variant="glow"
              />
              <StatCard 
                title="Blocked" 
                value={blockedUpdates.length} 
                subtitle="Need attention"
                icon={<XCircle className="h-5 w-5" />}
              />
            </div>

            {dailyUpdates.length > 0 ? (
              <div className="space-y-3">
                {dailyUpdates.map((update, i) => (
                  <Card key={i}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
                            {update.full_name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium">{update.full_name}</p>
                            <p className="text-sm text-muted-foreground mt-1">{update.did_today}</p>
                          </div>
                        </div>
                        <Badge variant="outline" className={
                          update.status === 'on_track' ? 'text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]' :
                          update.status === 'blocked' ? 'text-destructive border-destructive' :
                          'text-secondary border-secondary'
                        }>
                          {update.status === 'on_track' ? 'On Track' : update.status === 'blocked' ? 'Blocked' : 'At Risk'}
                        </Badge>
                      </div>
                      {update.blockers && (
                        <div className="mt-3 rounded-lg bg-destructive/5 border border-destructive/20 p-2">
                          <p className="text-xs font-medium text-destructive">Blocker:</p>
                          <p className="text-xs text-muted-foreground">{update.blockers}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No daily updates submitted today yet.
                </CardContent>
              </Card>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
