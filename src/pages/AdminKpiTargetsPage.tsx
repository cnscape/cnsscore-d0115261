import { useEffect, useMemo, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Sparkles, RefreshCw, Target, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';

interface Profile { user_id: string; full_name: string }
interface Client { id: string; name: string }
interface Assignment {
  id: string; rep_id: string; client_id: string; week_start: string;
  outreach_dms_target: number; calls_booked_target: number;
  conversion_rate_target: number; closed_deals_target: number;
  carried_outreach: number; carried_calls: number; carried_deals: number;
}
interface Actuals { dms: number; calls: number; deals: number; closeRate: number }

function mondayOf(d: Date): string {
  const day = d.getUTCDay() || 7;
  const m = new Date(d);
  m.setUTCDate(d.getUTCDate() - (day - 1));
  m.setUTCHours(0,0,0,0);
  return m.toISOString().slice(0,10);
}
function addDays(date: string, n: number) {
  const d = new Date(date + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0,10);
}

export default function AdminKpiTargetsPage() {
  const { user } = useAuth();
  const [reps, setReps] = useState<Profile[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [weekStart, setWeekStart] = useState<string>(mondayOf(new Date()));
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [actualsMap, setActualsMap] = useState<Record<string, Actuals>>({});
  const [todoStats, setTodoStats] = useState<Record<string, { total: number; done: number }>>({});
  const [loading, setLoading] = useState(true);

  // form
  const [fRep, setFRep] = useState('');
  const [fClient, setFClient] = useState('');
  const [fDms, setFDms] = useState('30');
  const [fCalls, setFCalls] = useState('6');
  const [fConv, setFConv] = useState('15');
  const [fDeals, setFDeals] = useState('4');
  const [saving, setSaving] = useState(false);

  // roadblocks
  const [roadblocks, setRoadblocks] = useState<any[]>([]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [{ data: pr }, { data: cl }, { data: as }, { data: rb }] = await Promise.all([
      supabase.from('profiles').select('user_id, full_name').order('full_name'),
      supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
      supabase.from('weekly_kpi_assignments').select('*').eq('week_start', weekStart),
      supabase.from('rep_roadblocks').select('id, rep_id, role, message, suggestion, created_at').order('created_at', { ascending: false }).limit(40),
    ]);
    setReps((pr || []) as Profile[]);
    setClients((cl || []) as Client[]);
    const list = (as || []) as Assignment[];
    setAssignments(list);
    setRoadblocks(rb || []);

    // load actuals + todo stats per assignment
    const weekEnd = addDays(weekStart, 7);
    const aMap: Record<string, Actuals> = {};
    const tMap: Record<string, { total: number; done: number }> = {};
    await Promise.all(list.map(async (a) => {
      const [{ data: acts }, { data: deals }, { data: todos }] = await Promise.all([
        supabase.from('lead_activities').select('activity_type').eq('user_id', a.rep_id)
          .gte('created_at', weekStart).lt('created_at', weekEnd),
        supabase.from('deals').select('status').eq('rep_id', a.rep_id).eq('client_id', a.client_id)
          .gte('created_at', weekStart).lt('created_at', weekEnd),
        supabase.from('weekly_todos').select('is_done').eq('assignment_id', a.id),
      ]);
      const dms = (acts || []).filter((x: any) => x.activity_type === 'dm_sent').length;
      const calls = (acts || []).filter((x: any) => ['call_made','meeting_booked'].includes(x.activity_type)).length;
      const won = (deals || []).filter((d: any) => d.status === 'won').length;
      const totalDeals = (deals || []).length;
      aMap[a.id] = { dms, calls, deals: won, closeRate: totalDeals ? Math.round((won/totalDeals)*100) : 0 };
      tMap[a.id] = { total: (todos || []).length, done: (todos || []).filter((t: any) => t.is_done).length };
    }));
    setActualsMap(aMap); setTodoStats(tMap);
    setLoading(false);
  }, [weekStart]);

  useEffect(() => { loadAll(); }, [loadAll]);

  const repName = (id: string) => reps.find(r => r.user_id === id)?.full_name || 'Unknown';
  const clientName = (id: string) => clients.find(c => c.id === id)?.name || 'Unknown';

  const handleSave = async () => {
    if (!fRep || !fClient) return toast.error('Pick a rep and a client');
    setSaving(true);
    const { error } = await supabase.from('weekly_kpi_assignments').upsert({
      rep_id: fRep, client_id: fClient, week_start: weekStart,
      outreach_dms_target: Number(fDms) || 0,
      calls_booked_target: Number(fCalls) || 0,
      conversion_rate_target: Number(fConv) || 0,
      closed_deals_target: Number(fDeals) || 0,
      created_by: user?.id,
    }, { onConflict: 'rep_id,client_id,week_start' });
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success('Targets saved');
    loadAll();
  };

  const handleGenerate = async (assignment_id: string) => {
    const t = toast.loading('AI is drafting the weekly plan…');
    const { error } = await supabase.functions.invoke('generate-weekly-todos', { body: { assignment_id } });
    toast.dismiss(t);
    if (error) return toast.error(error.message);
    toast.success('Weekly to-dos generated');
    loadAll();
  };

  const handleCarryOver = async (a: Assignment) => {
    const t = toast.loading('Rolling over to next week…');
    const { error } = await supabase.functions.invoke('carry-over-kpis', {
      body: { rep_id: a.rep_id, client_id: a.client_id, week_start: a.week_start },
    });
    toast.dismiss(t);
    if (error) return toast.error(error.message);
    toast.success('Carried over. Switch to next week to see it.');
  };

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><Target className="h-7 w-7 text-primary" /> KPI Targets & AI Plans</h1>
            <p className="text-muted-foreground">Assign weekly targets, auto-generate daily to-dos, and track roadblocks.</p>
          </div>
          <div className="flex items-end gap-2">
            <div>
              <Label className="text-xs">Week starting (Mon)</Label>
              <Input type="date" value={weekStart} onChange={(e) => setWeekStart(mondayOf(new Date(e.target.value + 'T00:00:00Z')))} />
            </div>
            <Button variant="outline" onClick={loadAll}><RefreshCw className="h-4 w-4 mr-2" />Refresh</Button>
          </div>
        </div>

        <Tabs defaultValue="assign">
          <TabsList>
            <TabsTrigger value="assign">Assign Targets</TabsTrigger>
            <TabsTrigger value="dashboard">Dashboard ({assignments.length})</TabsTrigger>
            <TabsTrigger value="roadblocks">Roadblocks ({roadblocks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="assign" className="mt-4">
            <Card>
              <CardHeader><CardTitle>Assign weekly KPIs</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <div>
                  <Label>Team member</Label>
                  <Select value={fRep} onValueChange={setFRep}>
                    <SelectTrigger><SelectValue placeholder="Select rep" /></SelectTrigger>
                    <SelectContent>{reps.map(r => <SelectItem key={r.user_id} value={r.user_id}>{r.full_name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Client</Label>
                  <Select value={fClient} onValueChange={setFClient}>
                    <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                    <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div><Label>Outreach (DMs)</Label><Input inputMode="decimal" value={fDms} onChange={(e) => setFDms(e.target.value)} /></div>
                <div><Label>Calls booked</Label><Input inputMode="decimal" value={fCalls} onChange={(e) => setFCalls(e.target.value)} /></div>
                <div><Label>Conversion rate (%)</Label><Input inputMode="decimal" value={fConv} onChange={(e) => setFConv(e.target.value)} /></div>
                <div><Label>Closed deals</Label><Input inputMode="decimal" value={fDeals} onChange={(e) => setFDeals(e.target.value)} /></div>
                <div className="md:col-span-2 flex justify-end">
                  <Button onClick={handleSave} disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                    Save targets
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="dashboard" className="mt-4 space-y-4">
            {loading ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> :
              assignments.length === 0 ? (
                <Card><CardContent className="py-10 text-center text-muted-foreground">No assignments yet for this week.</CardContent></Card>
              ) : assignments.map(a => {
                const act = actualsMap[a.id] || { dms: 0, calls: 0, deals: 0, closeRate: 0 };
                const stats = todoStats[a.id] || { total: 0, done: 0 };
                const todoPct = stats.total ? Math.round((stats.done/stats.total)*100) : 0;
                const totDm = a.outreach_dms_target + a.carried_outreach;
                const totCalls = a.calls_booked_target + a.carried_calls;
                const totDeals = a.closed_deals_target + a.carried_deals;
                const miss = act.deals < totDeals || act.dms < totDm || act.calls < totCalls;
                return (
                  <Card key={a.id}>
                    <CardHeader className="pb-3 flex flex-row items-start justify-between">
                      <div>
                        <CardTitle className="text-lg">{repName(a.rep_id)} → {clientName(a.client_id)}</CardTitle>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant={miss ? 'destructive' : 'default'} className="gap-1">
                            {miss ? <AlertTriangle className="h-3 w-3" /> : <CheckCircle2 className="h-3 w-3" />}
                            {miss ? 'Behind' : 'On track'}
                          </Badge>
                          {(a.carried_outreach || a.carried_calls || a.carried_deals) > 0 && (
                            <Badge variant="outline">Carry-over active</Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleGenerate(a.id)}>
                          <Sparkles className="h-4 w-4 mr-1" />Generate To-Dos
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => handleCarryOver(a)}>
                          Roll over
                        </Button>
                      </div>
                    </CardHeader>
                    <CardContent className="grid gap-4 md:grid-cols-4">
                      <KpiTile label="Outreach DMs" actual={act.dms} target={totDm} />
                      <KpiTile label="Calls booked" actual={act.calls} target={totCalls} />
                      <KpiTile label="Closed deals" actual={act.deals} target={totDeals} />
                      <KpiTile label="Conversion %" actual={act.closeRate} target={a.conversion_rate_target} suffix="%" />
                      <div className="md:col-span-4">
                        <div className="flex items-center justify-between text-xs mb-1">
                          <span className="text-muted-foreground">To-Do completion</span>
                          <span>{stats.done}/{stats.total} ({todoPct}%)</span>
                        </div>
                        <Progress value={todoPct} />
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
          </TabsContent>

          <TabsContent value="roadblocks" className="mt-4 space-y-3">
            {roadblocks.length === 0 ? (
              <Card><CardContent className="py-10 text-center text-muted-foreground">No roadblocks reported yet.</CardContent></Card>
            ) : roadblocks.map(r => (
              <Card key={r.id}>
                <CardContent className="py-3">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="font-medium">{repName(r.rep_id)}</span>
                    <Badge variant={r.role === 'assistant' ? 'default' : 'outline'}>{r.role === 'assistant' ? 'AI suggestion' : 'Rep'}</Badge>
                  </div>
                  <p className="text-sm whitespace-pre-line">{r.message}</p>
                </CardContent>
              </Card>
            ))}
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}

function KpiTile({ label, actual, target, suffix = '' }: { label: string; actual: number; target: number; suffix?: string }) {
  const pct = target > 0 ? Math.min(100, Math.round((actual/target)*100)) : 0;
  return (
    <div className="rounded-lg border border-border p-3 bg-card">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-xl font-bold mt-1">{actual}{suffix} <span className="text-sm font-normal text-muted-foreground">/ {target}{suffix}</span></p>
      <Progress value={pct} className="mt-2 h-1.5" />
    </div>
  );
}