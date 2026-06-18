import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Plus, Loader2, User, MessageSquare, Phone, ArrowRight, X, Clock, Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';

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
  call_outcome: string | null;
  notes: string | null;
  deal_id: string | null;
  last_activity_at: string;
  created_at: string;
}

interface LeadActivity {
  id: string;
  lead_id: string;
  user_id: string;
  activity_type: string;
  description: string | null;
  created_at: string;
}

interface RepProfile {
  user_id: string;
  full_name: string;
}

// Deterministic avatar color from a string
const avatarColor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  const hue = h % 360;
  return `hsl(${hue} 70% 45%)`;
};

const initialsOf = (name: string) =>
  name.split(/\s+/).filter(Boolean).slice(0, 2).map(s => s[0]?.toUpperCase() ?? '').join('') || '?';

const STAGES = [
  { key: 'new_lead', label: 'New Lead', color: 'bg-muted' },
  { key: 'dm_sent', label: 'DM Sent', color: 'bg-accent/20' },
  { key: 'responded', label: 'Responded', color: 'bg-[hsl(var(--status-green))]/20' },
  { key: 'discovery_booked', label: 'Discovery Booked', color: 'bg-primary/20' },
  { key: 'presentation', label: 'Presentation', color: 'bg-secondary/20' },
  { key: 'follow_up', label: 'Follow-Up', color: 'bg-[hsl(var(--status-amber))]/20' },
  { key: 'closed_won', label: 'Closed Won', color: 'bg-[hsl(var(--status-green))]/30' },
  { key: 'closed_lost', label: 'Closed Lost', color: 'bg-destructive/20' },
];

export default function CRMPipelinePage({ embedded = false }: { embedded?: boolean }) {
  const { user, isAdmin } = useAuth();
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddLead, setShowAddLead] = useState(false);
  const [selectedLead, setSelectedLead] = useState<PipelineLead | null>(null);
  const [draggedLead, setDraggedLead] = useState<string | null>(null);
  const [reps, setReps] = useState<RepProfile[]>([]);
  const [filterRepId, setFilterRepId] = useState<string>('all');

  // Form state
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadContact, setNewLeadContact] = useState('');
  const [newPlatform, setNewPlatform] = useState('LinkedIn');
  const [newLeadScore, setNewLeadScore] = useState('B');
  const [newNotes, setNewNotes] = useState('');

  // Activity form
  const [activityType, setActivityType] = useState('note');
  const [activityDesc, setActivityDesc] = useState('');

  const fetchLeads = useCallback(async () => {
    setIsLoading(true);
    let query = supabase.from('pipeline_leads').select('*').order('last_activity_at', { ascending: false });
    if (!isAdmin && user) query = query.eq('owner_id', user.id);
    const { data } = await query;
    if (data) setLeads(data as PipelineLead[]);
    setIsLoading(false);
  }, [user, isAdmin]);

  // Fetch all assignable reps (admin only)
  useEffect(() => {
    if (!isAdmin) return;
    (async () => {
      const [{ data: profiles }, { data: roles }] = await Promise.all([
        supabase.from('profiles').select('user_id, full_name').eq('is_active', true),
        supabase.from('user_roles').select('user_id, role'),
      ]);
      const allowed = new Set(
        (roles ?? [])
          .filter((r: any) => ['sales_rep', 'team_lead', 'scout'].includes(r.role))
          .map((r: any) => r.user_id)
      );
      const list = (profiles ?? [])
        .filter((p: any) => allowed.has(p.user_id))
        .map((p: any) => ({ user_id: p.user_id, full_name: p.full_name || 'Unnamed' }));
      setReps(list as RepProfile[]);
    })();
  }, [isAdmin]);

  const repById = (id?: string | null) => reps.find(r => r.user_id === id);

  const handleAssignRep = async (leadId: string, newOwnerId: string | null) => {
    const { error } = await supabase
      .from('pipeline_leads')
      .update({ owner_id: newOwnerId } as any)
      .eq('id', leadId);
    if (error) { toast.error('Failed to assign rep'); return; }
    toast.success(newOwnerId ? `Assigned to ${repById(newOwnerId)?.full_name ?? 'rep'}` : 'Unassigned');
    // Optimistic update
    setLeads(prev => prev.map(l => (l.id === leadId ? { ...l, owner_id: newOwnerId as any } : l)));
    if (selectedLead?.id === leadId) {
      setSelectedLead({ ...selectedLead, owner_id: newOwnerId as any });
    }
  };

  const fetchActivities = useCallback(async (leadId: string) => {
    const { data } = await supabase.from('lead_activities').select('*').eq('lead_id', leadId).order('created_at', { ascending: false });
    if (data) setActivities(data as LeadActivity[]);
  }, []);

  useEffect(() => { fetchLeads(); }, [fetchLeads]);

  useEffect(() => {
    if (selectedLead) fetchActivities(selectedLead.id);
  }, [selectedLead, fetchActivities]);

  const handleAddLead = async () => {
    if (!user || !newLeadName.trim()) return;
    const { error } = await supabase.from('pipeline_leads').insert([{
      owner_id: user.id,
      lead_name: newLeadName.trim(),
      lead_contact: newLeadContact.trim() || null,
      platform: newPlatform,
      lead_score: newLeadScore,
      notes: newNotes.trim() || null,
    }] as any);
    if (error) { toast.error('Failed to add lead'); return; }
    toast.success('Lead added!');
    setShowAddLead(false);
    setNewLeadName(''); setNewLeadContact(''); setNewNotes('');
    fetchLeads();
  };

  const handleStageChange = async (leadId: string, newStage: string) => {
    const { error } = await supabase.from('pipeline_leads').update({
      stage: newStage, last_activity_at: new Date().toISOString(), updated_at: new Date().toISOString()
    } as any).eq('id', leadId);
    if (error) { toast.error('Failed to move lead'); return; }

    if (user) {
      await supabase.from('lead_activities').insert([{
        lead_id: leadId, user_id: user.id, activity_type: 'stage_change',
        description: `Moved to ${STAGES.find(s => s.key === newStage)?.label || newStage}`
      }] as any);
    }

    // Count as conversation if moved to responded
    toast.success(`Lead moved to ${STAGES.find(s => s.key === newStage)?.label}`);
    fetchLeads();
  };

  const handleLogActivity = async () => {
    if (!selectedLead || !user) return;
    const updates: any = { last_activity_at: new Date().toISOString() };
    if (activityType === 'follow_up') {
      updates.follow_ups_completed = (selectedLead.follow_ups_completed || 0) + 1;
    }
    await supabase.from('pipeline_leads').update(updates).eq('id', selectedLead.id);
    await supabase.from('lead_activities').insert([{
      lead_id: selectedLead.id, user_id: user.id,
      activity_type: activityType, description: activityDesc.trim() || null,
    }] as any);
    toast.success('Activity logged');
    setActivityDesc('');
    fetchLeads();
    fetchActivities(selectedLead.id);
    // Refresh selected lead
    const { data } = await supabase.from('pipeline_leads').select('*').eq('id', selectedLead.id).single();
    if (data) setSelectedLead(data as PipelineLead);
  };

  const handleDragStart = (leadId: string) => setDraggedLead(leadId);
  const handleDragOver = (e: React.DragEvent) => e.preventDefault();
  const handleDrop = (stageKey: string) => {
    if (draggedLead) {
      handleStageChange(draggedLead, stageKey);
      setDraggedLead(null);
    }
  };

  const visibleLeads = (() => {
    if (!isAdmin || filterRepId === 'all') return leads;
    if (filterRepId === '__unassigned__') return leads.filter(l => !l.owner_id);
    return leads.filter(l => l.owner_id === filterRepId);
  })();
  const getLeadsByStage = (stage: string) => visibleLeads.filter(l => l.stage === stage);

  const activityIcon = (type: string) => {
    switch (type) {
      case 'dm_sent': return <MessageSquare className="h-3 w-3" />;
      case 'call_made': return <Phone className="h-3 w-3" />;
      case 'follow_up': return <ArrowRight className="h-3 w-3" />;
      default: return <Clock className="h-3 w-3" />;
    }
  };

  if (isLoading) {
    const loader = <div className="flex items-center justify-center h-full py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
    return embedded ? loader : <AppLayout>{loader}</AppLayout>;
  }

  const body = (
    <div className={embedded ? 'space-y-6' : 'p-6 lg:p-8 space-y-6'}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">CRM Pipeline</h1>
            <p className="text-muted-foreground">{visibleLeads.length} leads in pipeline</p>
          </div>
          <div className="flex items-center gap-3">
            {isAdmin && (
              <Select value={filterRepId} onValueChange={setFilterRepId}>
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All Reps" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reps</SelectItem>
                  <SelectItem value="__unassigned__">Unassigned</SelectItem>
                  {reps.map(r => (
                    <SelectItem key={r.user_id} value={r.user_id}>{r.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
            <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> New Lead</Button></DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Add New Lead</DialogTitle></DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Lead Name *</Label>
                  <Input value={newLeadName} onChange={e => setNewLeadName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Contact Info</Label>
                  <Input value={newLeadContact} onChange={e => setNewLeadContact(e.target.value)} placeholder="Email or phone" />
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Platform</Label>
                    <Select value={newPlatform} onValueChange={setNewPlatform}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LinkedIn">LinkedIn</SelectItem>
                        <SelectItem value="Instagram">Instagram</SelectItem>
                        <SelectItem value="Twitter">Twitter</SelectItem>
                        <SelectItem value="Email">Email</SelectItem>
                        <SelectItem value="Phone">Phone</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Score</Label>
                    <Select value={newLeadScore} onValueChange={setNewLeadScore}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="A">A — Hot</SelectItem>
                        <SelectItem value="B">B — Warm</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Notes</Label>
                  <Textarea value={newNotes} onChange={e => setNewNotes(e.target.value)} placeholder="Initial notes..." />
                </div>
                <Button onClick={handleAddLead} className="w-full" disabled={!newLeadName.trim()}>Add Lead</Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>
        </div>

        {/* Pipeline Kanban */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1400px]">
            {STAGES.map(stage => {
              const stageLeads = getLeadsByStage(stage.key);
              return (
                <div
                  key={stage.key}
                  className="flex-1 min-w-[170px]"
                  onDragOver={handleDragOver}
                  onDrop={() => handleDrop(stage.key)}
                >
                  <div className={`rounded-lg border border-border ${stage.color} p-3`}>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="text-sm font-semibold">{stage.label}</h3>
                      <Badge variant="outline" className="text-xs">{stageLeads.length}</Badge>
                    </div>
                    <div className="space-y-2 min-h-[100px]">
                      {stageLeads.map(lead => (
                        <Card
                          key={lead.id}
                          className="cursor-pointer hover:border-primary/50 transition-colors"
                          draggable
                          onDragStart={() => handleDragStart(lead.id)}
                          onClick={() => setSelectedLead(lead)}
                        >
                          <CardContent className="p-3 space-y-2">
                            <div className="flex items-center justify-between">
                              <p className="font-medium text-sm truncate">{lead.lead_name}</p>
                              <Badge variant="outline" className={lead.lead_score === 'A' ? 'text-[hsl(var(--status-green))] border-[hsl(var(--status-green))]' : 'text-secondary border-secondary'}>
                                {lead.lead_score}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Linkedin className="h-3 w-3" />
                              <span>{lead.platform}</span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-muted-foreground">
                              <span>{formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true })}</span>
                              {lead.stage === 'follow_up' && (
                                <span className="text-[hsl(var(--status-amber))]">{lead.follow_ups_completed}/{lead.max_follow_ups}</span>
                              )}
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Lead Detail Drawer */}
        <Dialog open={!!selectedLead} onOpenChange={(o) => { if (!o) setSelectedLead(null); }}>
          <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/20 text-primary font-bold">
                  {selectedLead?.lead_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p>{selectedLead?.lead_name}</p>
                  <p className="text-sm text-muted-foreground font-normal">{selectedLead?.lead_contact || 'No contact info'}</p>
                </div>
              </DialogTitle>
            </DialogHeader>

            <Tabs defaultValue="details" className="flex-1 overflow-hidden flex flex-col">
              <TabsList className="w-full">
                <TabsTrigger value="details" className="flex-1">Details</TabsTrigger>
                <TabsTrigger value="activity" className="flex-1">Activity</TabsTrigger>
                <TabsTrigger value="actions" className="flex-1">Actions</TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="flex-1 overflow-y-auto space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Stage</p>
                    <Select value={selectedLead?.stage} onValueChange={(v) => { if (selectedLead) handleStageChange(selectedLead.id, v); }}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {STAGES.map(s => <SelectItem key={s.key} value={s.key}>{s.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Lead Score</p>
                    <Badge variant="outline" className={selectedLead?.lead_score === 'A' ? 'text-[hsl(var(--status-green))]' : ''}>
                      {selectedLead?.lead_score === 'A' ? 'A — Hot' : 'B — Warm'}
                    </Badge>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Platform</p>
                    <p className="text-sm">{selectedLead?.platform}</p>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Follow-ups</p>
                    <p className="text-sm">{selectedLead?.follow_ups_completed} / {selectedLead?.max_follow_ups}</p>
                  </div>
                </div>
                {selectedLead?.notes && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Notes</p>
                    <p className="text-sm whitespace-pre-wrap">{selectedLead.notes}</p>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="activity" className="flex-1 overflow-y-auto">
                <ScrollArea className="h-[400px]">
                  <div className="space-y-3">
                    {activities.map(a => (
                      <div key={a.id} className="flex gap-3 items-start">
                        <div className="mt-1 flex h-6 w-6 items-center justify-center rounded-full bg-muted text-muted-foreground">
                          {activityIcon(a.activity_type)}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm font-medium capitalize">{a.activity_type.replace('_', ' ')}</p>
                          {a.description && <p className="text-sm text-muted-foreground">{a.description}</p>}
                          <p className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}</p>
                        </div>
                      </div>
                    ))}
                    {activities.length === 0 && <p className="text-center text-muted-foreground py-8">No activity yet</p>}
                  </div>
                </ScrollArea>
              </TabsContent>

              <TabsContent value="actions" className="flex-1 overflow-y-auto space-y-4">
                <div className="space-y-3">
                  <Label>Log Activity</Label>
                  <Select value={activityType} onValueChange={setActivityType}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="dm_sent">Mark DM Sent</SelectItem>
                      <SelectItem value="reply_received">Log Reply</SelectItem>
                      <SelectItem value="call_made">Log Call</SelectItem>
                      <SelectItem value="follow_up">Add Follow-up</SelectItem>
                      <SelectItem value="meeting_booked">Schedule Call/Meeting</SelectItem>
                      <SelectItem value="meeting_held">Meeting Held</SelectItem>
                      <SelectItem value="note">Add Note</SelectItem>
                    </SelectContent>
                  </Select>
                  <Textarea value={activityDesc} onChange={e => setActivityDesc(e.target.value)} placeholder="Description (optional)" />
                  <Button onClick={handleLogActivity} className="w-full">Log Activity</Button>
                </div>

                <Separator />

                <div className="space-y-2">
                  <Label>Call Outcome</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <Button variant="outline" className="border-[hsl(var(--status-green))] text-[hsl(var(--status-green))]" size="sm"
                      onClick={() => { if (selectedLead) handleStageChange(selectedLead.id, 'closed_won'); }}>Won</Button>
                    <Button variant="outline" className="border-secondary text-secondary" size="sm"
                      onClick={() => { if (selectedLead) handleStageChange(selectedLead.id, 'follow_up'); }}>Follow-up</Button>
                    <Button variant="outline" className="border-destructive text-destructive" size="sm"
                      onClick={() => { if (selectedLead) handleStageChange(selectedLead.id, 'closed_lost'); }}>Lost</Button>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
    </div>
  );
  return embedded ? body : <AppLayout>{body}</AppLayout>;
}
