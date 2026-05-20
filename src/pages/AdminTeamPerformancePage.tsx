import { useEffect, useState, useMemo, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ChartContainer, ChartTooltip, ChartTooltipContent } from '@/components/ui/chart';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, LineChart, Line, ResponsiveContainer } from 'recharts';
import { format, subDays, startOfWeek, endOfWeek, subWeeks, isWithinInterval } from 'date-fns';
import {
  Loader2, Users, Target, TrendingUp, Phone, MessageSquare,
  UserCheck, DollarSign, AlertTriangle, CheckCircle, XCircle, Calendar, Plus, Trash2, UserPlus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';

interface MemberProfile {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
  level: number | null;
  total_xp: number | null;
  current_streak: number | null;
  longest_streak: number | null;
  avatar_url: string | null;
}

interface MemberRole {
  user_id: string;
  role: string;
}

interface DealData {
  id: string;
  rep_id: string;
  lead_name: string | null;
  lead_contact: string | null;
  status: string;
  revenue: number | null;
  rep_commission: number | null;
  created_at: string;
  closed_at: string | null;
  channel: string | null;
}

interface BookingData {
  id: string;
  scout_id: string;
  salesperson_id: string;
  lead_name: string;
  status: string | null;
  show_up: boolean | null;
  closed: boolean | null;
  created_at: string | null;
}

interface PipelineData {
  id: string;
  owner_id: string;
  lead_name: string;
  stage: string;
  follow_ups_completed: number | null;
  last_activity_at: string | null;
  created_at: string | null;
}

// KPI targets
const SCOUT_KPIS = {
  outreach_weekly: { min: 25, max: 30, label: 'Outreach / DMs per week' },
  calls_booked_weekly: { min: 5, max: 8, label: 'Calls booked per week' },
  conversion_rate: { min: 15, max: 20, label: 'Conversion rate (%)' },
};

const REP_KPIS = {
  outreach_weekly: { min: 30, max: 40, label: 'Outreach / DMs per week' },
  calls_conducted_weekly: { min: 8, max: 12, label: 'Calls conducted per week' },
  deals_closed_weekly: { min: 2, max: 5, label: 'Deals closed per week' },
  conversion_rate: { min: 20, max: 30, label: 'Close rate (%)' },
};

function getStatusColor(actual: number, min: number, max: number): string {
  if (actual >= min) return 'text-[hsl(var(--status-green))]';
  if (actual >= min * 0.7) return 'text-yellow-500';
  return 'text-destructive';
}

function getStatusBadge(actual: number, min: number) {
  if (actual >= min) return <Badge className="bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))] border-0">On Target</Badge>;
  if (actual >= min * 0.7) return <Badge className="bg-yellow-500/20 text-yellow-500 border-0">Near Target</Badge>;
  return <Badge className="bg-destructive/20 text-destructive border-0">Behind</Badge>;
}

function getProgressPercent(actual: number, target: number) {
  return Math.min(Math.round((actual / target) * 100), 100);
}

export default function AdminTeamPerformancePage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<MemberProfile[]>([]);
  const [roles, setRoles] = useState<MemberRole[]>([]);
  const [deals, setDeals] = useState<DealData[]>([]);
  const [bookings, setBookings] = useState<BookingData[]>([]);
  const [leads, setLeads] = useState<PipelineData[]>([]);
  const [selectedUserId, setSelectedUserId] = useState<string>('');
  const [isLoading, setIsLoading] = useState(true);
  const [adminTodos, setAdminTodos] = useState<any[]>([]);
  const [newTodo, setNewTodo] = useState('');
  const [savingTodo, setSavingTodo] = useState(false);

  // Lead provisioning form
  const [lpLeadName, setLpLeadName] = useState('');
  const [lpLeadEmail, setLpLeadEmail] = useState('');
  const [lpSocials, setLpSocials] = useState('');
  const [lpPlatform, setLpPlatform] = useState('Instagram');
  const [lpTier, setLpTier] = useState('B');
  const [lpAngle, setLpAngle] = useState('');
  const [lpNotes, setLpNotes] = useState('');
  const [lpLoom, setLpLoom] = useState('');
  const [savingLead, setSavingLead] = useState(false);

  const db: any = supabase;

  useEffect(() => {
    const fetchAll = async () => {
      setIsLoading(true);
      const [profilesRes, rolesRes, dealsRes, bookingsRes, leadsRes] = await Promise.all([
        supabase.from('profiles').select('id, user_id, full_name, is_active, level, total_xp, current_streak, longest_streak, avatar_url').order('full_name'),
        supabase.from('user_roles').select('user_id, role'),
        supabase.from('deals').select('id, rep_id, lead_name, lead_contact, status, revenue, rep_commission, created_at, closed_at, channel'),
        supabase.from('scout_bookings').select('id, scout_id, salesperson_id, lead_name, status, show_up, closed, created_at'),
        supabase.from('pipeline_leads').select('id, owner_id, lead_name, stage, follow_ups_completed, last_activity_at, created_at'),
      ]);

      const p = (profilesRes.data || []) as MemberProfile[];
      const r = (rolesRes.data || []) as MemberRole[];
      setProfiles(p);
      setRoles(r);
      setDeals((dealsRes.data || []) as DealData[]);
      setBookings((bookingsRes.data || []) as BookingData[]);
      setLeads((leadsRes.data || []) as PipelineData[]);

      // auto-select first non-admin user
      const nonAdmin = p.find(pr => !r.find(rl => rl.user_id === pr.user_id && rl.role === 'admin'));
      if (nonAdmin) setSelectedUserId(nonAdmin.user_id);
      setIsLoading(false);
    };
    fetchAll();
  }, []);

  const loadAdminTodos = useCallback(async () => {
    if (!selectedUserId) return;
    const { data } = await db.from('admin_todos').select('*')
      .eq('rep_id', selectedUserId).order('created_at', { ascending: false }).limit(50);
    setAdminTodos(data || []);
  }, [selectedUserId]);

  useEffect(() => { loadAdminTodos(); }, [loadAdminTodos]);

  const handleAddTodo = async () => {
    if (!newTodo.trim() || !selectedUserId) return;
    setSavingTodo(true);
    const { error } = await db.from('admin_todos').insert([{
      rep_id: selectedUserId,
      task_text: newTodo.trim(),
      created_by: user?.id || null,
    }]);
    setSavingTodo(false);
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success('Objective pushed to agent');
    setNewTodo('');
    loadAdminTodos();
  };

  const handleDeleteTodo = async (id: string) => {
    await db.from('admin_todos').delete().eq('id', id);
    loadAdminTodos();
  };

  const handleProvisionLead = async () => {
    if (!selectedUserId || !lpLeadName.trim()) {
      toast.error('Select an agent and enter a lead name');
      return;
    }
    setSavingLead(true);
    const { error } = await db.from('pipeline_leads').insert([{
      owner_id: selectedUserId,
      lead_name: lpLeadName.trim(),
      lead_email: lpLeadEmail.trim() || null,
      lead_contact: lpLeadEmail.trim() || null,
      lead_socials: lpSocials.trim() || null,
      platform: lpPlatform,
      lead_score: lpTier,
      angle: lpAngle.trim() || null,
      notes: lpNotes.trim() || null,
      loom_link: lpLoom.trim() || null,
      stage: 'new_lead',
    }]);
    setSavingLead(false);
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success(`Lead "${lpLeadName}" routed to agent`);
    setLpLeadName(''); setLpLeadEmail(''); setLpSocials(''); setLpAngle(''); setLpNotes(''); setLpLoom('');
  };

  const selectedProfile = profiles.find(p => p.user_id === selectedUserId);
  const selectedRole = roles.find(r => r.user_id === selectedUserId)?.role || 'sales_rep';
  const isScout = selectedRole === 'scout';

  // Current week data
  const now = new Date();
  const weekStart = startOfWeek(now, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(now, { weekStartsOn: 1 });

  // Helper to get data for a given week
  const getWeekData = (weeksAgo: number) => {
    const ws = startOfWeek(subWeeks(now, weeksAgo), { weekStartsOn: 1 });
    const we = endOfWeek(subWeeks(now, weeksAgo), { weekStartsOn: 1 });
    const interval = { start: ws, end: we };

    if (isScout) {
      const weekBookings = bookings.filter(b => b.scout_id === selectedUserId && b.created_at && isWithinInterval(new Date(b.created_at), interval));
      const weekLeads = leads.filter(l => l.owner_id === selectedUserId && l.created_at && isWithinInterval(new Date(l.created_at), interval));
      const outreach = weekLeads.length + weekBookings.length;
      const callsBooked = weekBookings.length;
      const showed = weekBookings.filter(b => b.show_up).length;
      const conversionRate = outreach > 0 ? Math.round((callsBooked / outreach) * 100) : 0;
      return { outreach, callsBooked, showed, conversionRate, weekLabel: format(ws, 'dd MMM') };
    } else {
      const weekDeals = deals.filter(d => d.rep_id === selectedUserId && isWithinInterval(new Date(d.created_at), interval));
      const outreach = weekDeals.length;
      const callsConducted = weekDeals.filter(d => d.channel && ['organic', 'paid', 'dream_100', 'event', 'referral'].includes(d.channel)).length || weekDeals.length;
      const closed = weekDeals.filter(d => d.status === 'won').length;
      const revenue = weekDeals.filter(d => d.status === 'won').reduce((s, d) => s + (d.revenue || 0), 0);
      const conversionRate = callsConducted > 0 ? Math.round((closed / callsConducted) * 100) : 0;
      return { outreach, callsConducted, closed, revenue, conversionRate, weekLabel: format(ws, 'dd MMM') };
    }
  };

  const currentWeek = useMemo(() => getWeekData(0), [selectedUserId, deals, bookings, leads, isScout]);

  // Trend data (last 4 weeks)
  const trendData = useMemo(() => [3, 2, 1, 0].map(w => {
    const data = getWeekData(w);
    return { ...data, name: data.weekLabel };
  }), [selectedUserId, deals, bookings, leads, isScout]);

  // Lead activity log
  const memberLeads = useMemo(() => {
    if (isScout) {
      return bookings
        .filter(b => b.scout_id === selectedUserId)
        .sort((a, b) => new Date(b.created_at || '').getTime() - new Date(a.created_at || '').getTime())
        .slice(0, 50)
        .map(b => ({
          name: b.lead_name,
          date: b.created_at ? format(new Date(b.created_at), 'dd MMM yyyy') : '—',
          status: b.status || 'booked',
          outcome: b.closed ? 'Closed Won' : b.show_up ? 'Showed Up' : 'Pending',
        }));
    } else {
      return deals
        .filter(d => d.rep_id === selectedUserId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        .slice(0, 50)
        .map(d => ({
          name: d.lead_name || '—',
          date: format(new Date(d.created_at), 'dd MMM yyyy'),
          status: d.status,
          outcome: d.status === 'won' ? 'Closed Won' : d.status === 'lost' ? 'Lost' : 'Open',
        }));
    }
  }, [selectedUserId, deals, bookings, isScout]);

  // AI Summary
  const summary = useMemo(() => {
    if (!selectedProfile) return '';
    const name = selectedProfile.full_name.split(' ')[0];
    const lines: string[] = [];

    if (isScout) {
      const { outreach, callsBooked, conversionRate } = currentWeek as any;
      if (outreach >= SCOUT_KPIS.outreach_weekly.min) lines.push(`✅ ${name} is on target for outreach (${outreach} this week).`);
      else lines.push(`🔴 ${name} is behind on outreach — ${outreach}/${SCOUT_KPIS.outreach_weekly.min} target. Increase daily DM volume.`);
      if (callsBooked >= SCOUT_KPIS.calls_booked_weekly.min) lines.push(`✅ Calls booked on track (${callsBooked}).`);
      else lines.push(`🟡 Only ${callsBooked} calls booked — target is ${SCOUT_KPIS.calls_booked_weekly.min}+. Focus on follow-ups.`);
      if (conversionRate >= SCOUT_KPIS.conversion_rate.min) lines.push(`✅ Conversion rate healthy at ${conversionRate}%.`);
      else lines.push(`🟡 Conversion rate at ${conversionRate}% — below ${SCOUT_KPIS.conversion_rate.min}% target. Review messaging quality.`);
    } else {
      const { outreach, callsConducted, closed, conversionRate } = currentWeek as any;
      if (outreach >= REP_KPIS.outreach_weekly.min) lines.push(`✅ ${name} is on target for outreach (${outreach} this week).`);
      else lines.push(`🔴 ${name} is behind on outreach — ${outreach}/${REP_KPIS.outreach_weekly.min} target.`);
      if (closed >= REP_KPIS.deals_closed_weekly.min) lines.push(`✅ Deals closed on target (${closed}).`);
      else lines.push(`🟡 Only ${closed} deals closed — target is ${REP_KPIS.deals_closed_weekly.min}+. Push for closing.`);
      if (conversionRate >= REP_KPIS.conversion_rate.min) lines.push(`✅ Close rate is strong at ${conversionRate}%.`);
      else lines.push(`🟡 Close rate at ${conversionRate}% — needs improvement. Review pitch quality.`);
    }
    return lines.join('\n');
  }, [selectedProfile, currentWeek, isScout]);

  // Non-admin members for selection
  const selectableMembers = profiles.filter(p => {
    const r = roles.find(rl => rl.user_id === p.user_id);
    return r?.role !== 'admin';
  });

  const chartConfig = {
    outreach: { label: 'Outreach', color: 'hsl(var(--primary))' },
    calls: { label: isScout ? 'Calls Booked' : 'Calls Conducted', color: 'hsl(var(--accent))' },
    closed: { label: 'Deals Closed', color: 'hsl(142 76% 36%)' },
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Team Performance</h1>
            <p className="text-muted-foreground">Individual KPIs, trends & activity for each team member</p>
          </div>
          <Select value={selectedUserId} onValueChange={setSelectedUserId}>
            <SelectTrigger className="w-64">
              <SelectValue placeholder="Select team member" />
            </SelectTrigger>
            <SelectContent>
              {selectableMembers.map(m => {
                const r = roles.find(rl => rl.user_id === m.user_id);
                return (
                  <SelectItem key={m.user_id} value={m.user_id}>
                    {m.full_name} ({r?.role === 'scout' ? 'Scout' : 'Sales Rep'})
                  </SelectItem>
                );
              })}
            </SelectContent>
          </Select>
        </div>

        {selectedProfile && (
          <>
            {/* Profile Header */}
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/20 text-primary text-xl font-bold">
                    {selectedProfile.full_name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <h2 className="text-xl font-bold">{selectedProfile.full_name}</h2>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <Badge variant="outline">{isScout ? 'Scout' : 'Sales Rep'}</Badge>
                      <span>Level {selectedProfile.level || 1}</span>
                      <span>{(selectedProfile.total_xp || 0).toLocaleString()} XP</span>
                      <span>{selectedProfile.current_streak || 0}🔥 streak</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Tabs defaultValue="kpis" className="space-y-6">
              <TabsList>
                <TabsTrigger value="kpis">KPIs & Progress</TabsTrigger>
                <TabsTrigger value="trends">Weekly Trends</TabsTrigger>
                <TabsTrigger value="activity">Activity Log</TabsTrigger>
                <TabsTrigger value="manage">Manage Agent</TabsTrigger>
              </TabsList>

              {/* KPIs TAB */}
              <TabsContent value="kpis" className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {isScout ? (
                    <>
                      <KPICard
                        icon={<MessageSquare className="h-5 w-5" />}
                        title={SCOUT_KPIS.outreach_weekly.label}
                        actual={(currentWeek as any).outreach}
                        min={SCOUT_KPIS.outreach_weekly.min}
                        max={SCOUT_KPIS.outreach_weekly.max}
                      />
                      <KPICard
                        icon={<Phone className="h-5 w-5" />}
                        title={SCOUT_KPIS.calls_booked_weekly.label}
                        actual={(currentWeek as any).callsBooked}
                        min={SCOUT_KPIS.calls_booked_weekly.min}
                        max={SCOUT_KPIS.calls_booked_weekly.max}
                      />
                      <KPICard
                        icon={<TrendingUp className="h-5 w-5" />}
                        title={SCOUT_KPIS.conversion_rate.label}
                        actual={(currentWeek as any).conversionRate}
                        min={SCOUT_KPIS.conversion_rate.min}
                        max={SCOUT_KPIS.conversion_rate.max}
                        suffix="%"
                      />
                    </>
                  ) : (
                    <>
                      <KPICard
                        icon={<MessageSquare className="h-5 w-5" />}
                        title={REP_KPIS.outreach_weekly.label}
                        actual={(currentWeek as any).outreach}
                        min={REP_KPIS.outreach_weekly.min}
                        max={REP_KPIS.outreach_weekly.max}
                      />
                      <KPICard
                        icon={<Phone className="h-5 w-5" />}
                        title={REP_KPIS.calls_conducted_weekly.label}
                        actual={(currentWeek as any).callsConducted}
                        min={REP_KPIS.calls_conducted_weekly.min}
                        max={REP_KPIS.calls_conducted_weekly.max}
                      />
                      <KPICard
                        icon={<UserCheck className="h-5 w-5" />}
                        title={REP_KPIS.deals_closed_weekly.label}
                        actual={(currentWeek as any).closed}
                        min={REP_KPIS.deals_closed_weekly.min}
                        max={REP_KPIS.deals_closed_weekly.max}
                      />
                      <KPICard
                        icon={<TrendingUp className="h-5 w-5" />}
                        title={REP_KPIS.conversion_rate.label}
                        actual={(currentWeek as any).conversionRate}
                        min={REP_KPIS.conversion_rate.min}
                        max={REP_KPIS.conversion_rate.max}
                        suffix="%"
                      />
                    </>
                  )}
                </div>

                {/* Progress Chart */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">KPI Progress This Week</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[300px] w-full">
                      <BarChart data={isScout ? [
                        { name: 'Outreach', actual: (currentWeek as any).outreach, target: SCOUT_KPIS.outreach_weekly.min },
                        { name: 'Calls Booked', actual: (currentWeek as any).callsBooked, target: SCOUT_KPIS.calls_booked_weekly.min },
                      ] : [
                        { name: 'Outreach', actual: (currentWeek as any).outreach, target: REP_KPIS.outreach_weekly.min },
                        { name: 'Calls', actual: (currentWeek as any).callsConducted, target: REP_KPIS.calls_conducted_weekly.min },
                        { name: 'Closed', actual: (currentWeek as any).closed, target: REP_KPIS.deals_closed_weekly.min },
                      ]}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Bar dataKey="target" fill="hsl(var(--muted))" radius={[4, 4, 0, 0]} name="Target" />
                        <Bar dataKey="actual" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} name="Actual" />
                      </BarChart>
                    </ChartContainer>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* TRENDS TAB */}
              <TabsContent value="trends" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">4-Week Trend</CardTitle>
                    <CardDescription>Weekly performance over the last 4 weeks</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ChartContainer config={chartConfig} className="h-[350px] w-full">
                      <LineChart data={trendData}>
                        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                        <XAxis dataKey="name" className="text-xs" />
                        <YAxis className="text-xs" />
                        <ChartTooltip content={<ChartTooltipContent />} />
                        <Line type="monotone" dataKey="outreach" stroke="hsl(var(--primary))" strokeWidth={2} dot={{ r: 4 }} name="Outreach" />
                        {isScout ? (
                          <Line type="monotone" dataKey="callsBooked" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} name="Calls Booked" />
                        ) : (
                          <>
                            <Line type="monotone" dataKey="callsConducted" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 4 }} name="Calls" />
                            <Line type="monotone" dataKey="closed" stroke="hsl(142 76% 36%)" strokeWidth={2} dot={{ r: 4 }} name="Closed" />
                          </>
                        )}
                      </LineChart>
                    </ChartContainer>
                  </CardContent>
                </Card>

                {/* Weekly breakdown table */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Weekly Breakdown</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Week</TableHead>
                          <TableHead className="text-right">Outreach</TableHead>
                          <TableHead className="text-right">{isScout ? 'Calls Booked' : 'Calls'}</TableHead>
                          {!isScout && <TableHead className="text-right">Closed</TableHead>}
                          <TableHead className="text-right">{isScout ? 'Conv. Rate' : 'Close Rate'}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {trendData.map((w, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{w.name}</TableCell>
                            <TableCell className="text-right font-mono">{w.outreach}</TableCell>
                            <TableCell className="text-right font-mono">{isScout ? (w as any).callsBooked : (w as any).callsConducted}</TableCell>
                            {!isScout && <TableCell className="text-right font-mono">{(w as any).closed}</TableCell>}
                            <TableCell className="text-right font-mono">{w.conversionRate}%</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* ACTIVITY LOG TAB */}
              <TabsContent value="activity" className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Lead Activity Log</CardTitle>
                    <CardDescription>{memberLeads.length} leads tracked</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/50">
                          <TableHead>Lead Name</TableHead>
                          <TableHead>Contact Date</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Outcome</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {memberLeads.map((lead, i) => (
                          <TableRow key={i}>
                            <TableCell className="font-medium">{lead.name}</TableCell>
                            <TableCell className="text-muted-foreground">{lead.date}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className={
                                lead.status === 'won' || lead.status === 'closed_won' ? 'bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))]' :
                                lead.status === 'lost' || lead.status === 'closed_lost' ? 'bg-destructive/20 text-destructive' :
                                'bg-muted text-muted-foreground'
                              }>
                                {lead.status}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {lead.outcome === 'Closed Won' && <span className="flex items-center gap-1 text-[hsl(var(--status-green))]"><CheckCircle className="h-4 w-4" /> Closed Won</span>}
                              {lead.outcome === 'Lost' && <span className="flex items-center gap-1 text-destructive"><XCircle className="h-4 w-4" /> Lost</span>}
                              {lead.outcome === 'Showed Up' && <span className="flex items-center gap-1 text-yellow-500"><UserCheck className="h-4 w-4" /> Showed Up</span>}
                              {lead.outcome === 'Open' && <span className="text-muted-foreground">Open</span>}
                              {lead.outcome === 'Pending' && <span className="text-muted-foreground">Pending</span>}
                            </TableCell>
                          </TableRow>
                        ))}
                        {memberLeads.length === 0 && (
                          <TableRow>
                            <TableCell colSpan={4} className="text-center py-8 text-muted-foreground">No activity recorded yet</TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* MANAGE AGENT TAB — Custom To-Do Injector + Lead Provisioning */}
              <TabsContent value="manage" className="space-y-6">
                {/* Custom To-Do Injector */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <CheckCircle className="h-5 w-5 text-primary" />
                      Daily Objective Injector
                    </CardTitle>
                    <CardDescription>Push a direct objective onto {selectedProfile.full_name}'s dashboard</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex gap-2">
                      <Input
                        value={newTodo}
                        onChange={(e) => setNewTodo(e.target.value)}
                        placeholder="Enter custom daily objective for this agent..."
                        onKeyDown={(e) => { if (e.key === 'Enter') handleAddTodo(); }}
                      />
                      <Button onClick={handleAddTodo} disabled={!newTodo.trim() || savingTodo}>
                        {savingTodo ? <Loader2 className="h-4 w-4 animate-spin" /> : <><Plus className="h-4 w-4 mr-1" /> Add To-Do</>}
                      </Button>
                    </div>
                    {adminTodos.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No active objectives. Pushed objectives appear on the agent's Daily Work page.</p>
                    ) : (
                      <ul className="space-y-2">
                        {adminTodos.map(t => (
                          <li key={t.id} className="flex items-center gap-3 rounded-md border border-border p-2">
                            <Badge variant={t.is_done ? 'outline' : 'secondary'} className="text-[10px]">
                              {t.is_done ? 'Done' : 'Active'}
                            </Badge>
                            <p className={`flex-1 text-sm ${t.is_done ? 'line-through text-muted-foreground' : ''}`}>{t.task_text}</p>
                            <Button size="icon" variant="ghost" onClick={() => handleDeleteTodo(t.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </CardContent>
                </Card>

                {/* Advanced Lead Provisioning Form */}
                <Card className="border-primary/30">
                  <CardHeader>
                    <CardTitle className="text-lg flex items-center gap-2">
                      <UserPlus className="h-5 w-5 text-primary" />
                      Advanced Lead Provisioning
                    </CardTitle>
                    <CardDescription>Route a high-value lead directly into {selectedProfile.full_name}'s pipeline</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label>Lead Name *</Label>
                        <Input value={lpLeadName} onChange={(e) => setLpLeadName(e.target.value)} placeholder="Full name or creator brand" />
                      </div>
                      <div className="space-y-2">
                        <Label>Lead Email</Label>
                        <Input type="email" value={lpLeadEmail} onChange={(e) => setLpLeadEmail(e.target.value)} placeholder="lead@example.com" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Lead Socials (URL)</Label>
                        <Input value={lpSocials} onChange={(e) => setLpSocials(e.target.value)} placeholder="https://instagram.com/handle" />
                      </div>
                      <div className="space-y-2">
                        <Label>Platform</Label>
                        <Select value={lpPlatform} onValueChange={setLpPlatform}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Instagram">Instagram</SelectItem>
                            <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                            <SelectItem value="YouTube">YouTube</SelectItem>
                            <SelectItem value="Twitter">Twitter</SelectItem>
                            <SelectItem value="Email">Email</SelectItem>
                            <SelectItem value="Other">Other</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Lead Status</Label>
                        <Select value={lpTier} onValueChange={setLpTier}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="A">🟢 A-Tier (Confirmed Income)</SelectItem>
                            <SelectItem value="B">🟡 B-Tier (Nurture &lt; 10k/mo)</SelectItem>
                            <SelectItem value="C">🔴 C-Tier (Parked / Unqualified)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Angle / Botched System Spotted</Label>
                        <Input value={lpAngle} onChange={(e) => setLpAngle(e.target.value)} placeholder='e.g. "WhatsApp group chaos with no upsell"' />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>Strategic Notes / Pain Point</Label>
                        <Textarea value={lpNotes} onChange={(e) => setLpNotes(e.target.value)} placeholder="Specific bottleneck, business context, etc." className="min-h-[80px]" />
                      </div>
                      <div className="space-y-2 md:col-span-2">
                        <Label>CEO's Custom Loom Link</Label>
                        <Input value={lpLoom} onChange={(e) => setLpLoom(e.target.value)} placeholder="https://loom.com/share/..." />
                      </div>
                    </div>
                    <Button onClick={handleProvisionLead} disabled={savingLead || !lpLeadName.trim()} className="w-full">
                      {savingLead ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <UserPlus className="h-4 w-4 mr-2" />}
                      Route Lead to {selectedProfile.full_name}
                    </Button>
                  </CardContent>
                </Card>

                {/* XP & Gamification */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-lg">Gamification Stats</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid gap-4 sm:grid-cols-4">
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold text-primary">{selectedProfile.level || 1}</p>
                        <p className="text-xs text-muted-foreground">Level</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{(selectedProfile.total_xp || 0).toLocaleString()}</p>
                        <p className="text-xs text-muted-foreground">Total XP</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedProfile.current_streak || 0}🔥</p>
                        <p className="text-xs text-muted-foreground">Current Streak</p>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/50">
                        <p className="text-2xl font-bold">{selectedProfile.longest_streak || 0}</p>
                        <p className="text-xs text-muted-foreground">Best Streak</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </>
        )}
      </div>
    </AppLayout>
  );
}

// KPI Card Component
function KPICard({ icon, title, actual, min, max, suffix = '' }: {
  icon: React.ReactNode;
  title: string;
  actual: number;
  min: number;
  max: number;
  suffix?: string;
}) {
  const pct = getProgressPercent(actual, min);
  return (
    <Card>
      <CardContent className="p-5 space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-muted-foreground">
            {icon}
            <span className="text-sm font-medium">{title}</span>
          </div>
          {getStatusBadge(actual, min)}
        </div>
        <div className="flex items-baseline gap-1">
          <span className={`text-3xl font-bold ${getStatusColor(actual, min, max)}`}>{actual}{suffix}</span>
          <span className="text-sm text-muted-foreground">/ {min}–{max}{suffix}</span>
        </div>
        <Progress value={pct} className="h-2" />
        <p className="text-xs text-muted-foreground">{pct}% of minimum target</p>
      </CardContent>
    </Card>
  );
}
