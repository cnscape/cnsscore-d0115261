import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Loader2, MessageSquare, Clock, AlertTriangle, ArrowRight, Phone, Send, CheckCircle } from 'lucide-react';
import { Sparkles, RefreshCw } from 'lucide-react';
import { MessageCircle, ListChecks } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { formatDistanceToNow, differenceInHours } from 'date-fns';
import { useNavigate } from 'react-router-dom';

interface PipelineLead {
  id: string;
  owner_id: string;
  lead_name: string;
  lead_contact: string | null;
  platform: string;
  lead_score: string;
  stage: string;
  follow_ups_completed: number;
  max_follow_ups: number;
  last_activity_at: string;
  created_at: string;
}

export default function DailyWorkPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [plan, setPlan] = useState<string>('');
  const [planLoading, setPlanLoading] = useState(false);
  const [todos, setTodos] = useState<any[]>([]);
  const [coachOpen, setCoachOpen] = useState(false);
  const [coachThread, setCoachThread] = useState<any[]>([]);
  const [coachInput, setCoachInput] = useState('');
  const [coachSending, setCoachSending] = useState(false);

  const db: any = supabase;

  const loadTodos = useCallback(async () => {
    if (!user) return;
    const today = new Date();
    const dow = today.getDay(); // 0=Sun .. 6=Sat
    const { data } = await db.from('weekly_todos').select('*')
      .eq('rep_id', user.id).eq('day_of_week', dow)
      .order('created_at');
    setTodos(data || []);
  }, [user]);

  const loadCoach = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from('rep_roadblocks').select('*')
      .eq('rep_id', user.id).order('created_at').limit(50);
    setCoachThread(data || []);
  }, [user]);

  useEffect(() => { loadTodos(); loadCoach(); }, [loadTodos, loadCoach]);

  const toggleTodo = async (t: any) => {
    const next = !t.is_done;
    await db.from('weekly_todos').update({ is_done: next, completed_count: next ? (t.target_count || 1) : 0 }).eq('id', t.id);
    loadTodos();
  };

  const sendCoach = async () => {
    if (!coachInput.trim() || !user) return;
    setCoachSending(true);
    const msg = coachInput.trim();
    setCoachInput('');
    setCoachThread(prev => [...prev, { id: 'temp-' + Date.now(), role: 'user', message: msg, created_at: new Date().toISOString() }]);
    try {
      const { data, error } = await supabase.functions.invoke('rep-roadblock-chat', { body: { message: msg } });
      if (error) throw error;
      const reply = (data as any)?.reply || '...';
      setCoachThread(prev => [...prev, { id: 'temp-r-' + Date.now(), role: 'assistant', message: reply, created_at: new Date().toISOString() }]);
    } catch (e: any) {
      toast.error(e?.message || 'Coach unavailable');
    } finally {
      setCoachSending(false);
      loadCoach();
    }
  };

  const fetchPlan = useCallback(async () => {
    if (!user) return;
    setPlanLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('daily-work-coach', { body: {} });
      if (error) throw error;
      const text = (data as any)?.plan || (data as any)?.error || 'No plan available.';
      setPlan(text);
      localStorage.setItem(`plan_${user.id}_${new Date().toDateString()}`, text);
    } catch (e: any) {
      setPlan('Could not generate plan right now. ' + (e?.message || ''));
    } finally {
      setPlanLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    const cached = localStorage.getItem(`plan_${user.id}_${new Date().toDateString()}`);
    if (cached) setPlan(cached);
    else fetchPlan();
  }, [user, fetchPlan]);

  const fetchLeads = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    const { data } = await supabase.from('pipeline_leads').select('*')
      .eq('owner_id', user.id)
      .not('stage', 'in', '("closed_won","closed_lost")')
      .order('last_activity_at', { ascending: true });
    if (data) setLeads(data as PipelineLead[]);
    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  const now = new Date();
  const toMessage = leads.filter(l => l.stage === 'new_lead');
  const toFollowUp = leads.filter(l => l.stage === 'follow_up');
  const waitingReply = leads.filter(l => l.stage === 'dm_sent');
  const inactive48h = leads.filter(l => differenceInHours(now, new Date(l.last_activity_at)) >= 48);

  const handleQuickAction = async (leadId: string, action: string) => {
    if (!user) return;
    const updates: any = { last_activity_at: new Date().toISOString() };
    let actType = 'note';
    let newStage: string | null = null;

    switch (action) {
      case 'dm_sent':
        newStage = 'dm_sent'; actType = 'dm_sent'; break;
      case 'reply':
        newStage = 'responded'; actType = 'reply_received'; break;
      case 'schedule':
        newStage = 'discovery_booked'; actType = 'meeting_booked'; break;
      case 'follow_up':
        actType = 'follow_up';
        updates.follow_ups_completed = (leads.find(l => l.id === leadId)?.follow_ups_completed || 0) + 1;
        break;
    }
    if (newStage) updates.stage = newStage;

    await supabase.from('pipeline_leads').update(updates).eq('id', leadId);
    await supabase.from('lead_activities').insert([{
      lead_id: leadId, user_id: user.id, activity_type: actType,
      description: `Quick action: ${action.replace('_', ' ')}`,
    }] as any);
    toast.success('Action logged!');
    fetchLeads();
  };

  const LeadActionCard = ({ lead, actions }: { lead: PipelineLead; actions: { label: string; action: string; icon: React.ReactNode }[] }) => (
    <Card className="card-hover">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
              {lead.lead_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <p className="font-medium text-sm">{lead.lead_name}</p>
              <p className="text-xs text-muted-foreground">{lead.platform} • {lead.lead_score}</p>
            </div>
          </div>
          <Badge variant="outline" className="text-xs">
            {formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true })}
          </Badge>
        </div>
        <div className="flex gap-2 mt-3">
          {actions.map(a => (
            <Button key={a.action} variant="outline" size="sm" className="flex-1 text-xs" onClick={() => handleQuickAction(lead.id, a.action)}>
              {a.icon}
              <span className="ml-1">{a.label}</span>
            </Button>
          ))}
          <Button variant="ghost" size="sm" className="text-xs" onClick={() => navigate('/crm')}>View</Button>
        </div>
      </CardContent>
    </Card>
  );

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Daily Work</h1>
          <p className="text-muted-foreground">Your task engine — take action on your leads</p>
        </div>

        {/* This Week's AI Plan + Coach */}
        <Card>
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2"><ListChecks className="h-5 w-5 text-primary" /> Today's AI To-Dos</CardTitle>
            <Sheet open={coachOpen} onOpenChange={setCoachOpen}>
              <SheetTrigger asChild>
                <Button size="sm" variant="outline"><MessageCircle className="h-4 w-4 mr-2" />Talk to AI Coach</Button>
              </SheetTrigger>
              <SheetContent className="w-[420px] sm:w-[480px] flex flex-col">
                <SheetHeader><SheetTitle>AI Coach</SheetTitle></SheetHeader>
                <div className="flex-1 overflow-y-auto py-4 space-y-3">
                  {coachThread.length === 0 && <p className="text-sm text-muted-foreground">Tell the coach what's blocking you. Logged for your admin.</p>}
                  {coachThread.map(m => (
                    <div key={m.id} className={`rounded-lg p-3 text-sm ${m.role === 'assistant' ? 'bg-primary/10 border border-primary/30' : 'bg-muted'}`}>
                      <div className="text-[10px] uppercase tracking-wide text-muted-foreground mb-1">{m.role === 'assistant' ? 'Coach' : 'You'}</div>
                      <div className="whitespace-pre-line">{m.message}</div>
                    </div>
                  ))}
                </div>
                <div className="border-t pt-3 flex gap-2">
                  <Input placeholder="e.g. Leads aren't responding…" value={coachInput} onChange={(e) => setCoachInput(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') sendCoach(); }} disabled={coachSending} />
                  <Button onClick={sendCoach} disabled={coachSending || !coachInput.trim()}>
                    {coachSending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Send'}
                  </Button>
                </div>
              </SheetContent>
            </Sheet>
          </CardHeader>
          <CardContent>
            {todos.length === 0 ? (
              <p className="text-sm text-muted-foreground">No AI to-dos for today. Your admin can generate them from KPI Targets.</p>
            ) : (
              <ul className="space-y-2">
                {todos.map(t => (
                  <li key={t.id} className="flex items-start gap-3 rounded-md border border-border p-2">
                    <Checkbox checked={t.is_done} onCheckedChange={() => toggleTodo(t)} className="mt-0.5" />
                    <div className="flex-1">
                      <p className={`text-sm ${t.is_done ? 'line-through text-muted-foreground' : ''}`}>{t.task_text}</p>
                      <Badge variant="outline" className="text-[10px] mt-1">{t.task_type} · target {t.target_count}</Badge>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        {/* AI Plan of Action */}
        <Card className="border-primary/40 bg-gradient-to-br from-primary/10 via-background to-background">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" /> AI Plan of Action
              </CardTitle>
              <Button variant="ghost" size="sm" onClick={fetchPlan} disabled={planLoading}>
                {planLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                <span className="ml-2">Refresh</span>
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {planLoading && !plan ? (
              <div className="text-sm text-muted-foreground">Coaching you to hit your KPIs…</div>
            ) : (
              <div className="text-sm whitespace-pre-line leading-relaxed">{plan}</div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="To Message" value={toMessage.length} icon={<Send className="h-5 w-5" />} variant={toMessage.length > 0 ? 'glow' : 'default'} />
          <StatCard title="To Follow Up" value={toFollowUp.length} icon={<ArrowRight className="h-5 w-5" />} />
          <StatCard title="Waiting Reply" value={waitingReply.length} icon={<Clock className="h-5 w-5" />} />
          <StatCard title="Inactive 48h" value={inactive48h.length} icon={<AlertTriangle className="h-5 w-5" />} variant={inactive48h.length > 0 ? 'gold' : 'default'} />
        </div>

        {/* Leads to Message */}
        {toMessage.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Send className="h-5 w-5 text-primary" /> Leads to Message</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {toMessage.map(lead => (
                <LeadActionCard key={lead.id} lead={lead} actions={[
                  { label: 'DM Sent', action: 'dm_sent', icon: <MessageSquare className="h-3 w-3" /> },
                ]} />
              ))}
            </div>
          </div>
        )}

        {/* Leads to Follow Up */}
        {toFollowUp.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><ArrowRight className="h-5 w-5 text-secondary" /> Follow-Ups Due</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {toFollowUp.map(lead => (
                <LeadActionCard key={lead.id} lead={lead} actions={[
                  { label: 'Follow Up', action: 'follow_up', icon: <ArrowRight className="h-3 w-3" /> },
                  { label: 'Call', action: 'schedule', icon: <Phone className="h-3 w-3" /> },
                ]} />
              ))}
            </div>
          </div>
        )}

        {/* Waiting for Reply */}
        {waitingReply.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><Clock className="h-5 w-5 text-muted-foreground" /> Waiting for Reply</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {waitingReply.map(lead => (
                <LeadActionCard key={lead.id} lead={lead} actions={[
                  { label: 'Got Reply', action: 'reply', icon: <CheckCircle className="h-3 w-3" /> },
                  { label: 'Follow Up', action: 'follow_up', icon: <ArrowRight className="h-3 w-3" /> },
                ]} />
              ))}
            </div>
          </div>
        )}

        {/* Inactive Leads */}
        {inactive48h.length > 0 && (
          <div className="space-y-3">
            <h2 className="text-lg font-semibold flex items-center gap-2"><AlertTriangle className="h-5 w-5 text-destructive" /> Inactive 48h+</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {inactive48h.map(lead => (
                <LeadActionCard key={lead.id} lead={lead} actions={[
                  { label: 'DM', action: 'dm_sent', icon: <MessageSquare className="h-3 w-3" /> },
                  { label: 'Call', action: 'schedule', icon: <Phone className="h-3 w-3" /> },
                ]} />
              ))}
            </div>
          </div>
        )}

        {leads.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">No active leads. Add leads from the CRM Pipeline.</p>
              <Button onClick={() => navigate('/crm')}>Go to CRM</Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
