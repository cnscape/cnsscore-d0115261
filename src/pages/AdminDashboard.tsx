import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { StatCard } from '@/components/ui/stat-card';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { format, subDays } from 'date-fns';
import { 
  Download, Loader2, MessageSquare, UserCheck, DollarSign, Users, 
  TrendingUp, AlertTriangle, CheckCircle, XCircle, Briefcase, FileText, Phone
} from 'lucide-react';
import { toast } from 'sonner';
import { PipelineVelocityChart } from '@/components/analytics/PipelineVelocityChart';

interface DealRow {
  id: string;
  status: string;
  channel: string | null;
  revenue: number | null;
  rep_commission: number | null;
  created_at: string;
  rep_id: string;
  lead_name: string | null;
  campaign: string | null;
  expected_close_date: string | null;
  close_date_pushed_count: number | null;
  discount_percent: number | null;
}

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
  level: number;
  current_streak: number;
}

export default function AdminDashboard() {
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const today = new Date();
  const weekAgo = subDays(today, 7);
  const weekAgoStr = format(weekAgo, 'yyyy-MM-dd');

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      const [dealsRes, profilesRes] = await Promise.all([
        supabase.from('deals').select('id, status, channel, revenue, rep_commission, created_at, rep_id, lead_name, campaign, expected_close_date, close_date_pushed_count, discount_percent'),
        supabase.from('profiles').select('id, user_id, full_name, is_active, level, current_streak').eq('is_active', true),
      ]);
      if (dealsRes.data) setDeals(dealsRes.data as DealRow[]);
      if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
      setIsLoading(false);
    };
    fetchAll();
  }, []);

  // 7-day rolling metrics from deals
  const recentDeals = deals.filter(d => d.created_at >= weekAgoStr);
  const totalDeals = recentDeals.length;
  const callDeals = recentDeals.filter(d => d.channel === 'call' || d.channel === 'phone').length;
  const wonDeals = recentDeals.filter(d => d.status === 'won');
  const wonRevenue = wonDeals.reduce((s, d) => s + (d.revenue || 0), 0);
  const paidRegs = wonDeals.length;
  
  const days = 7;
  const avgConversations = (totalDeals / days).toFixed(1);
  const avgCalls = (callDeals / days).toFixed(1);
  const avgRevenue = (wonRevenue / days).toFixed(0);
  const avgPaidRegs = (paidRegs / days).toFixed(1);

  // All-time stats
  const allOpen = deals.filter(d => d.status === 'open').length;
  const allWon = deals.filter(d => d.status === 'won');
  const allRevenue = allWon.reduce((s, d) => s + (d.revenue || 0), 0);
  const allCommission = allWon.reduce((s, d) => s + (d.rep_commission || 0), 0);

  // Per-rep stats (7-day)
  const repStats = profiles.map(p => {
    const repDeals = recentDeals.filter(d => d.rep_id === p.user_id);
    const repWon = repDeals.filter(d => d.status === 'won');
    return {
      profile: p,
      conversations: repDeals.length,
      won: repWon.length,
      revenue: repWon.reduce((s, d) => s + (d.revenue || 0), 0),
      commission: repWon.reduce((s, d) => s + (d.rep_commission || 0), 0),
    };
  }).sort((a, b) => b.conversations - a.conversations);

  const escapeCSV = (val: unknown): string => {
    const s = String(val ?? '');
    const escaped = s.replace(/"/g, '""');
    const safe = /^[=+\-@\t\r]/.test(escaped) ? `'${escaped}` : escaped;
    return `"${safe}"`;
  };

  const handleExport = () => {
    const headers = ['Name', '7d Conversations', '7d Won', '7d Revenue', '7d Commission'];
    const rows = repStats.map(r => [
      r.profile.full_name, r.conversations, r.won, r.revenue, r.commission
    ]);
    const csv = [headers, ...rows].map(row => row.map(escapeCSV).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `team-report-${format(today, 'yyyy-MM-dd')}.csv`;
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
            <h1 className="text-3xl font-bold">Command Center</h1>
            <p className="text-muted-foreground">{format(today, 'EEEE, MMMM d, yyyy')}</p>
          </div>
          <Button variant="outline" onClick={handleExport}>
            <Download className="h-4 w-4 mr-2" /> Export
          </Button>
        </div>

        {/* Tabs */}
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="rolling">7-Day Rolling</TabsTrigger>
            <TabsTrigger value="team">Team Performance</TabsTrigger>
          </TabsList>

          {/* OVERVIEW TAB */}
          <TabsContent value="overview" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
              <StatCard title="Total Deals" value={deals.length} subtitle="All time" icon={<Briefcase className="h-5 w-5" />} />
              <StatCard title="Open Pipeline" value={allOpen} subtitle="Active deals" icon={<FileText className="h-5 w-5" />} />
              <StatCard title="Won Deals" value={allWon.length} subtitle="Closed won" icon={<UserCheck className="h-5 w-5" />} variant="gold" />
              <StatCard title="Total Revenue" value={`R${allRevenue.toLocaleString()}`} subtitle="Won deals" icon={<DollarSign className="h-5 w-5" />} variant="glow" />
              <StatCard title="Total Commission" value={`R${allCommission.toLocaleString()}`} subtitle="10% of revenue" icon={<TrendingUp className="h-5 w-5" />} />
            </div>

            <PipelineVelocityChart />

            {/* Recent deals */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Recent Deals (Last 7 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="rounded-xl border border-border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/50">
                        <TableHead>Lead</TableHead>
                        <TableHead>Rep</TableHead>
                        <TableHead>Channel</TableHead>
                        <TableHead className="text-center">Status</TableHead>
                        <TableHead className="text-right">Revenue</TableHead>
                        <TableHead className="text-right">Commission</TableHead>
                        <TableHead>Date</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentDeals.slice(0, 20).map(deal => {
                        const rep = profiles.find(p => p.user_id === deal.rep_id);
                        return (
                          <TableRow key={deal.id}>
                            <TableCell className="font-medium">{deal.lead_name || '—'}</TableCell>
                            <TableCell>{rep?.full_name || '—'}</TableCell>
                            <TableCell className="capitalize">{deal.channel?.replace('_', ' ') || '—'}</TableCell>
                            <TableCell className="text-center">
                              <Badge variant="outline" className={
                                deal.status === 'won' ? 'bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))]' :
                                deal.status === 'lost' ? 'bg-destructive/20 text-destructive' :
                                deal.status === 'stalled' ? 'bg-secondary/20 text-secondary' :
                                'bg-accent/20 text-accent-foreground'
                              }>
                                {deal.status}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-right font-mono">R{(deal.revenue || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-right font-mono text-primary">R{(deal.rep_commission || 0).toLocaleString()}</TableCell>
                            <TableCell className="text-muted-foreground text-sm">{format(new Date(deal.created_at), 'dd MMM')}</TableCell>
                          </TableRow>
                        );
                      })}
                      {recentDeals.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No deals in the last 7 days</TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* 7-DAY ROLLING TAB */}
          <TabsContent value="rolling" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <StatCard title="Avg Conversations/Day" value={avgConversations} subtitle={`${totalDeals} total this week`} icon={<MessageSquare className="h-5 w-5" />} variant="glow" />
              <StatCard title="Avg Calls/Day" value={avgCalls} subtitle={`${callDeals} total`} icon={<Phone className="h-5 w-5" />} />
              <StatCard title="Avg Revenue/Day" value={`R${Number(avgRevenue).toLocaleString()}`} subtitle={`R${wonRevenue.toLocaleString()} total`} icon={<DollarSign className="h-5 w-5" />} variant="gold" />
              <StatCard title="Avg Paid Regs/Day" value={avgPaidRegs} subtitle={`${paidRegs} won deals`} icon={<UserCheck className="h-5 w-5" />} />
            </div>

            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5 text-primary" />
                  7-Day Summary
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Conversations</span>
                      <span className="font-mono">{totalDeals}</span>
                    </div>
                    <Progress value={Math.min(totalDeals * 2, 100)} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Won Deals</span>
                      <span className="font-mono">{paidRegs}</span>
                    </div>
                    <Progress value={totalDeals > 0 ? (paidRegs / totalDeals) * 100 : 0} className="h-2" />
                  </div>
                  <div>
                    <div className="flex justify-between text-sm mb-1">
                      <span>Revenue</span>
                      <span className="font-mono">R{wonRevenue.toLocaleString()}</span>
                    </div>
                    <Progress value={Math.min(wonRevenue / 500, 100)} className="h-2" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* TEAM TAB */}
          <TabsContent value="team" className="space-y-6">
            <div className="grid gap-4 md:grid-cols-4">
              <StatCard title="Active Reps" value={profiles.length} icon={<Users className="h-5 w-5" />} />
              <StatCard title="Team Conversations" value={totalDeals} subtitle="Last 7 days" icon={<MessageSquare className="h-5 w-5" />} variant="glow" />
              <StatCard title="Team Revenue" value={`R${wonRevenue.toLocaleString()}`} subtitle="Last 7 days" icon={<DollarSign className="h-5 w-5" />} />
              <StatCard title="Team Commission" value={`R${repStats.reduce((s, r) => s + r.commission, 0).toLocaleString()}`} subtitle="Last 7 days" icon={<TrendingUp className="h-5 w-5" />} />
            </div>

            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Rep</TableHead>
                    <TableHead className="text-right">7d Conversations</TableHead>
                    <TableHead className="text-right">7d Won</TableHead>
                    <TableHead className="text-right">7d Revenue</TableHead>
                    <TableHead className="text-right">7d Commission</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repStats.map(rep => (
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
                      <TableCell className="text-right font-mono">{rep.conversations}</TableCell>
                      <TableCell className="text-right font-mono">{rep.won}</TableCell>
                      <TableCell className="text-right font-mono">R{rep.revenue.toLocaleString()}</TableCell>
                      <TableCell className="text-right font-mono text-primary">R{rep.commission.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
