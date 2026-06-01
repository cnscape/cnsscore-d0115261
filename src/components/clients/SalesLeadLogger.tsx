import { useEffect, useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Plus, Upload, MessageSquarePlus, Send, Loader2, Linkedin } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { format } from 'date-fns';

const CHANNELS = ['LinkedIn DM', 'Cold Email', 'Warm Introduction', 'Cold Call', 'Instagram DM'];
const STATUSES = [
  { value: 'discovery_scheduled', label: 'Discovery Call Scheduled' },
  { value: 'follow_up_pending', label: 'Follow-up Pending' },
  { value: 'closed_won', label: 'Closed-Won' },
  { value: 'closed_lost', label: 'Closed-Lost' },
];
const STATUS_COLORS: Record<string, string> = {
  discovery_scheduled: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
  follow_up_pending: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
  closed_won: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
  closed_lost: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
};

interface ClientOpt { id: string; name: string; }
interface Lead {
  id: string; client_id: string; rep_id: string; lead_name: string; company_name: string | null;
  linkedin_url: string | null; outreach_channel: string | null; deal_value: number | null;
  deal_status: string; assigned_closer_id: string | null; contacted_at: string;
}
interface Note { id: string; lead_id: string; rep_id: string; rep_name: string | null; note: string; created_at: string; }

export function SalesLeadLogger({ clientId, onChanged }: { clientId: string; onChanged?: () => void }) {
  const { user, profile } = useAuth();
  const [clients, setClients] = useState<ClientOpt[]>([]);
  const [reps, setReps] = useState<{ user_id: string; full_name: string }[]>([]);
  const [leads, setLeads] = useState<Lead[]>([]);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [closerFilter, setCloserFilter] = useState<string>('all');
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [form, setForm] = useState({
    client_id: clientId,
    lead_name: '',
    company_name: '',
    linkedin_url: '',
    outreach_channel: 'LinkedIn DM',
    deal_value: '',
    deal_status: 'discovery_scheduled',
  });

  const [notesLead, setNotesLead] = useState<Lead | null>(null);
  const [notes, setNotes] = useState<Note[]>([]);
  const [newNote, setNewNote] = useState('');

  const fetchLeads = async () => {
    const { data } = await supabase
      .from('client_contacted_leads' as any)
      .select('*')
      .eq('client_id', clientId)
      .order('contacted_at', { ascending: false });
    setLeads((data as unknown as Lead[]) ?? []);
  };

  useEffect(() => {
    (async () => {
      const [c, p] = await Promise.all([
        supabase.from('clients').select('id,name').eq('is_active', true).order('name'),
        supabase.from('profiles').select('user_id,full_name').eq('is_active', true).order('full_name'),
      ]);
      setClients((c.data as any) ?? []);
      setReps((p.data as any) ?? []);
    })();
  }, []);

  useEffect(() => { fetchLeads(); setForm(f => ({ ...f, client_id: clientId })); }, [clientId]);

  const openNotes = async (lead: Lead) => {
    setNotesLead(lead); setNotes([]);
    const { data } = await supabase
      .from('client_lead_notes' as any)
      .select('*')
      .eq('lead_id', lead.id)
      .order('created_at', { ascending: true });
    setNotes((data as unknown as Note[]) ?? []);
  };

  const submitNote = async () => {
    if (!newNote.trim() || !notesLead || !user) return;
    const payload = {
      lead_id: notesLead.id, rep_id: user.id,
      rep_name: profile?.full_name ?? 'Rep', note: newNote.trim(),
    };
    const { data, error } = await supabase.from('client_lead_notes' as any).insert([payload] as any).select().single();
    if (error) return toast.error(error.message);
    setNotes(n => [...n, data as unknown as Note]); setNewNote('');
  };

  const submitLead = async () => {
    if (!user || !form.lead_name.trim() || !form.client_id) {
      return toast.error('Lead name and client are required');
    }
    setBusy(true);
    const { error } = await supabase.from('client_contacted_leads' as any).insert([{
      client_id: form.client_id,
      rep_id: user.id,
      lead_name: form.lead_name.trim(),
      company_name: form.company_name.trim() || null,
      linkedin_url: form.linkedin_url.trim() || null,
      outreach_channel: form.outreach_channel,
      deal_value: form.deal_value ? Number(form.deal_value) : 0,
      deal_status: form.deal_status,
    }] as any);
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success('Lead logged');
    setOpen(false);
    setForm({ ...form, lead_name: '', company_name: '', linkedin_url: '', deal_value: '' });
    fetchLeads(); onChanged?.();
  };

  const onCsv = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file || !user) return;
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter(l => l.trim());
    if (lines.length < 2) { toast.error('CSV is empty'); return; }
    const headers = lines[0].split(',').map(h => h.trim().toLowerCase());
    const idx = (k: string) => headers.findIndex(h => h.includes(k));
    const nameI = idx('name'), companyI = idx('company'), liI = idx('linkedin'),
      chI = idx('channel'), valI = idx('value'), stI = idx('status');
    const rows = lines.slice(1).map(l => {
      const cols = l.split(',').map(c => c.trim());
      return {
        client_id: clientId,
        rep_id: user.id,
        lead_name: cols[nameI] || 'Unnamed',
        company_name: companyI >= 0 ? cols[companyI] : null,
        linkedin_url: liI >= 0 ? cols[liI] : null,
        outreach_channel: chI >= 0 ? cols[chI] || 'LinkedIn DM' : 'LinkedIn DM',
        deal_value: valI >= 0 ? Number(cols[valI]) || 0 : 0,
        deal_status: stI >= 0 ? (cols[stI] || 'discovery_scheduled') : 'discovery_scheduled',
      };
    }).filter(r => r.lead_name && r.lead_name !== 'Unnamed' || true);
    const { error } = await supabase.from('client_contacted_leads' as any).insert(rows as any);
    if (error) return toast.error(error.message);
    toast.success(`Uploaded ${rows.length} leads`);
    if (fileRef.current) fileRef.current.value = '';
    fetchLeads(); onChanged?.();
  };

  const filtered = leads.filter(l =>
    (statusFilter === 'all' || l.deal_status === statusFilter) &&
    (closerFilter === 'all' || l.assigned_closer_id === closerFilter)
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-lg">Sales Team · Contacted Leads</CardTitle>
            <p className="text-xs text-muted-foreground mt-0.5">Log every prospect your team reaches out to — auto-feeds the metrics above.</p>
          </div>
          <div className="flex gap-2">
            <input ref={fileRef} type="file" accept=".csv" className="hidden" onChange={onCsv} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
              <Upload className="h-4 w-4 mr-1" />Upload CSV
            </Button>
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-primary"><Plus className="h-4 w-4 mr-1" />Input Contacted Leads</Button>
              </DialogTrigger>
              <DialogContent className="max-w-lg">
                <DialogHeader><DialogTitle>Log Contacted Lead</DialogTitle></DialogHeader>
                <div className="space-y-3 pt-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1 col-span-2">
                      <Label>Target Client *</Label>
                      <Select value={form.client_id} onValueChange={v => setForm({ ...form, client_id: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Lead Name *</Label><Input value={form.lead_name} onChange={e => setForm({ ...form, lead_name: e.target.value })} /></div>
                    <div className="space-y-1"><Label>Company</Label><Input value={form.company_name} onChange={e => setForm({ ...form, company_name: e.target.value })} /></div>
                    <div className="space-y-1 col-span-2"><Label>LinkedIn URL</Label><Input value={form.linkedin_url} onChange={e => setForm({ ...form, linkedin_url: e.target.value })} placeholder="https://linkedin.com/in/..." /></div>
                    <div className="space-y-1">
                      <Label>Outreach Channel</Label>
                      <Select value={form.outreach_channel} onValueChange={v => setForm({ ...form, outreach_channel: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{CHANNELS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1"><Label>Deal Value (R)</Label><Input inputMode="decimal" value={form.deal_value} onChange={e => setForm({ ...form, deal_value: e.target.value })} placeholder="0" /></div>
                    <div className="space-y-1 col-span-2">
                      <Label>Deal Status</Label>
                      <Select value={form.deal_status} onValueChange={v => setForm({ ...form, deal_status: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{STATUSES.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button className="w-full" onClick={submitLead} disabled={busy}>
                    {busy ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
                    Save Lead
                  </Button>
                  <p className="text-[11px] text-muted-foreground">
                    CSV columns supported: lead_name, company, linkedin, channel, value, status
                  </p>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList>
              <TabsTrigger value="all">All ({leads.length})</TabsTrigger>
              {STATUSES.map(s => (
                <TabsTrigger key={s.value} value={s.value}>
                  {s.label} ({leads.filter(l => l.deal_status === s.value).length})
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Select value={closerFilter} onValueChange={setCloserFilter}>
            <SelectTrigger className="sm:w-48"><SelectValue placeholder="Assigned closer" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All closers</SelectItem>
              {reps.map(r => <SelectItem key={r.user_id} value={r.user_id}>{r.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/40 text-xs uppercase text-muted-foreground">
              <tr>
                <th className="text-left p-3">Date</th>
                <th className="text-left p-3">Lead</th>
                <th className="text-left p-3 hidden md:table-cell">Company</th>
                <th className="text-left p-3 hidden md:table-cell">Channel</th>
                <th className="text-left p-3">Value</th>
                <th className="text-left p-3">Status</th>
                <th className="text-right p-3">Notes</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">No leads logged yet. Hit "Input Contacted Leads" to start.</td></tr>
              )}
              {filtered.map(l => (
                <tr key={l.id} className="border-t border-border hover:bg-muted/20">
                  <td className="p-3 text-xs whitespace-nowrap">{format(new Date(l.contacted_at), 'MMM d, HH:mm')}</td>
                  <td className="p-3 font-medium flex items-center gap-2">
                    {l.lead_name}
                    {l.linkedin_url && <a href={l.linkedin_url} target="_blank" rel="noreferrer" className="text-muted-foreground hover:text-primary"><Linkedin className="h-3.5 w-3.5" /></a>}
                  </td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{l.company_name || '—'}</td>
                  <td className="p-3 hidden md:table-cell text-muted-foreground">{l.outreach_channel || '—'}</td>
                  <td className="p-3">R{Number(l.deal_value ?? 0).toLocaleString()}</td>
                  <td className="p-3">
                    <Badge variant="outline" className={STATUS_COLORS[l.deal_status]}>
                      {STATUSES.find(s => s.value === l.deal_status)?.label ?? l.deal_status}
                    </Badge>
                  </td>
                  <td className="p-3 text-right">
                    <Button variant="ghost" size="sm" onClick={() => openNotes(l)}>
                      <MessageSquarePlus className="h-4 w-4 mr-1" />Add Notes
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>

      <Dialog open={!!notesLead} onOpenChange={(v) => !v && setNotesLead(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Sales Activity & Execution Notes</DialogTitle>
            <p className="text-xs text-muted-foreground">{notesLead?.lead_name} · {notesLead?.company_name || 'No company'}</p>
          </DialogHeader>
          <div className="space-y-3">
            <div className="max-h-72 overflow-y-auto space-y-2 rounded-md border border-border p-3 bg-muted/20">
              {notes.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">No notes yet — log the first update.</p>}
              {notes.map(n => (
                <div key={n.id} className="text-sm">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-semibold text-primary">{n.rep_name || 'Rep'}</span>
                    <span className="text-[10px] text-muted-foreground">{format(new Date(n.created_at), 'MMM d, HH:mm')}</span>
                  </div>
                  <p className="text-foreground/90 whitespace-pre-wrap">{n.note}</p>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <Textarea rows={2} value={newNote} onChange={e => setNewNote(e.target.value)} placeholder="e.g. Sent personalized video pitch to CEO; waiting on reply." />
              <Button onClick={submitNote} disabled={!newNote.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
}