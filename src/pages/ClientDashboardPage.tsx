import { useEffect, useMemo, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Eye, EyeOff, Copy, Trash2, ExternalLink, Sparkles, Loader2, ArrowLeft, FileText, KeyRound, TrendingUp, Users, DollarSign } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import ReactMarkdown from 'react-markdown';

interface Credential { id: string; label: string; url: string | null; username: string | null; password: string | null; notes: string | null; }
interface DriveDoc { id: string; title: string; url: string; description: string | null; doc_type: string | null; }

export default function ClientDashboardPage() {
  const { id: clientId } = useParams();
  const { isAdmin } = useAuth();
  const [client, setClient] = useState<any>(null);
  const [creds, setCreds] = useState<Credential[]>([]);
  const [docs, setDocs] = useState<DriveDoc[]>([]);
  const [metrics, setMetrics] = useState({ revenue: 0, deals: 0, won: 0, leads: 0, openDeals: 0 });
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [aiLoading, setAiLoading] = useState(false);
  const [aiStrategy, setAiStrategy] = useState('');

  const [credOpen, setCredOpen] = useState(false);
  const [credForm, setCredForm] = useState({ label: '', url: '', username: '', password: '', notes: '' });
  const [docOpen, setDocOpen] = useState(false);
  const [docForm, setDocForm] = useState({ title: '', url: '', description: '' });

  const fetchAll = async () => {
    if (!clientId) return;
    const [c, cr, dd, deals, leads] = await Promise.all([
      supabase.from('clients').select('*').eq('id', clientId).maybeSingle(),
      supabase.from('client_credentials' as any).select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('client_drive_docs' as any).select('*').eq('client_id', clientId).order('created_at', { ascending: false }),
      supabase.from('deals').select('status,revenue').eq('client_id', clientId),
      supabase.from('pipeline_leads').select('id').limit(1000),
    ]);
    setClient(c.data);
    setCreds((cr.data as unknown as Credential[]) ?? []);
    setDocs((dd.data as unknown as DriveDoc[]) ?? []);
    const dlist = (deals.data ?? []) as any[];
    const won = dlist.filter(d => d.status === 'won');
    setMetrics({
      revenue: won.reduce((s, d) => s + Number(d.revenue || 0), 0),
      deals: dlist.length,
      won: won.length,
      openDeals: dlist.filter(d => d.status === 'open').length,
      leads: leads.data?.length ?? 0,
    });
  };

  useEffect(() => { fetchAll(); }, [clientId]);

  const addCred = async () => {
    if (!credForm.label.trim()) return;
    const { error } = await supabase.from('client_credentials' as any).insert([{ client_id: clientId, ...credForm }] as any);
    if (error) return toast.error(error.message);
    toast.success('Credential added');
    setCredOpen(false); setCredForm({ label: '', url: '', username: '', password: '', notes: '' }); fetchAll();
  };
  const delCred = async (id: string) => {
    if (!confirm('Delete this credential?')) return;
    await supabase.from('client_credentials' as any).delete().eq('id', id); fetchAll();
  };
  const addDoc = async () => {
    if (!docForm.title.trim() || !docForm.url.trim()) return;
    const { error } = await supabase.from('client_drive_docs' as any).insert([{ client_id: clientId, ...docForm }] as any);
    if (error) return toast.error(error.message);
    toast.success('Document added');
    setDocOpen(false); setDocForm({ title: '', url: '', description: '' }); fetchAll();
  };
  const delDoc = async (id: string) => {
    if (!confirm('Delete this document?')) return;
    await supabase.from('client_drive_docs' as any).delete().eq('id', id); fetchAll();
  };
  const copy = (text: string) => { navigator.clipboard.writeText(text); toast.success('Copied'); };

  const runAi = async () => {
    setAiLoading(true); setAiStrategy('');
    try {
      const { data, error } = await supabase.functions.invoke('client-strategy-coach', { body: { client_id: clientId } });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setAiStrategy(data?.strategy ?? '');
    } catch (e: any) { toast.error(e.message ?? 'AI failed'); }
    finally { setAiLoading(false); }
  };

  if (!client) return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link to="/admin/clients"><Button variant="ghost" size="sm"><ArrowLeft className="h-4 w-4 mr-1" />Clients</Button></Link>
            <div>
              <h1 className="text-3xl font-bold">{client.name}</h1>
              <p className="text-muted-foreground text-sm">{client.industry || 'No industry'} · <Badge variant="outline">{client.revenue_model}</Badge></p>
            </div>
          </div>
        </div>

        {/* KPI Strip */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Revenue</p><p className="text-2xl font-bold text-primary">R{metrics.revenue.toLocaleString()}</p></div><DollarSign className="h-8 w-8 text-primary/40" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Deals Won</p><p className="text-2xl font-bold">{metrics.won}/{metrics.deals}</p></div><TrendingUp className="h-8 w-8 text-primary/40" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Open Deals</p><p className="text-2xl font-bold">{metrics.openDeals}</p></div><TrendingUp className="h-8 w-8 text-primary/40" /></div></CardContent></Card>
          <Card><CardContent className="p-4"><div className="flex items-center justify-between"><div><p className="text-xs text-muted-foreground">Total Leads</p><p className="text-2xl font-bold">{metrics.leads}</p></div><Users className="h-8 w-8 text-primary/40" /></div></CardContent></Card>
        </div>

        {/* AI Coach */}
        <Card className="border-primary/40">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2"><Sparkles className="h-5 w-5 text-primary" />Admin AI · Blockers & Revenue Plan</CardTitle>
              <Button onClick={runAi} disabled={aiLoading}>
                {aiLoading ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Analyzing...</> : <><Sparkles className="h-4 w-4 mr-2" />Generate Plan</>}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {aiStrategy ? (
              <div className="prose prose-sm dark:prose-invert max-w-none">
                <ReactMarkdown>{aiStrategy}</ReactMarkdown>
              </div>
            ) : <p className="text-sm text-muted-foreground">Click "Generate Plan" — the AI analyses revenue, leads & lost reasons for this client, identifies blockers, and proposes mitigations + a 7-day revenue plan.</p>}
          </CardContent>
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          {/* Credentials */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg"><KeyRound className="h-5 w-5" />Shared Credentials</CardTitle>
                {isAdmin && (
                  <Dialog open={credOpen} onOpenChange={setCredOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Credential</DialogTitle></DialogHeader>
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1"><Label>Label *</Label><Input value={credForm.label} onChange={e => setCredForm({ ...credForm, label: e.target.value })} placeholder="e.g. Instagram, ClickFunnels" /></div>
                        <div className="space-y-1"><Label>URL</Label><Input value={credForm.url} onChange={e => setCredForm({ ...credForm, url: e.target.value })} placeholder="https://..." /></div>
                        <div className="space-y-1"><Label>Username / Email</Label><Input value={credForm.username} onChange={e => setCredForm({ ...credForm, username: e.target.value })} /></div>
                        <div className="space-y-1"><Label>Password</Label><Input value={credForm.password} onChange={e => setCredForm({ ...credForm, password: e.target.value })} /></div>
                        <div className="space-y-1"><Label>Notes</Label><Textarea value={credForm.notes} onChange={e => setCredForm({ ...credForm, notes: e.target.value })} rows={2} /></div>
                        <Button onClick={addCred} className="w-full">Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {creds.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No credentials yet.</p>}
              {creds.map(c => (
                <div key={c.id} className="p-3 rounded-lg border border-border space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="font-semibold">{c.label}</div>
                    <div className="flex gap-1">
                      {c.url && <a href={c.url} target="_blank" rel="noreferrer"><Button variant="ghost" size="sm"><ExternalLink className="h-4 w-4" /></Button></a>}
                      {isAdmin && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => delCred(c.id)}><Trash2 className="h-4 w-4" /></Button>}
                    </div>
                  </div>
                  {c.username && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-20">User</span>
                      <code className="flex-1 px-2 py-1 bg-muted rounded text-xs">{c.username}</code>
                      <Button variant="ghost" size="sm" onClick={() => copy(c.username!)}><Copy className="h-3 w-3" /></Button>
                    </div>
                  )}
                  {c.password && (
                    <div className="flex items-center gap-2 text-sm">
                      <span className="text-muted-foreground w-20">Pass</span>
                      <code className="flex-1 px-2 py-1 bg-muted rounded text-xs font-mono">{showPw[c.id] ? c.password : '••••••••••'}</code>
                      <Button variant="ghost" size="sm" onClick={() => setShowPw(s => ({ ...s, [c.id]: !s[c.id] }))}>{showPw[c.id] ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}</Button>
                      <Button variant="ghost" size="sm" onClick={() => copy(c.password!)}><Copy className="h-3 w-3" /></Button>
                    </div>
                  )}
                  {c.notes && <p className="text-xs text-muted-foreground">{c.notes}</p>}
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Drive Docs */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="flex items-center gap-2 text-lg"><FileText className="h-5 w-5" />Important Docs</CardTitle>
                {isAdmin && (
                  <Dialog open={docOpen} onOpenChange={setDocOpen}>
                    <DialogTrigger asChild><Button size="sm"><Plus className="h-4 w-4 mr-1" />Add</Button></DialogTrigger>
                    <DialogContent>
                      <DialogHeader><DialogTitle>Add Document Link</DialogTitle></DialogHeader>
                      <div className="space-y-3 pt-2">
                        <div className="space-y-1"><Label>Title *</Label><Input value={docForm.title} onChange={e => setDocForm({ ...docForm, title: e.target.value })} placeholder="e.g. Sales Script v2" /></div>
                        <div className="space-y-1"><Label>URL * (Google Drive / Docs)</Label><Input value={docForm.url} onChange={e => setDocForm({ ...docForm, url: e.target.value })} placeholder="https://drive.google.com/..." /></div>
                        <div className="space-y-1"><Label>Description</Label><Textarea value={docForm.description} onChange={e => setDocForm({ ...docForm, description: e.target.value })} rows={2} /></div>
                        <Button onClick={addDoc} className="w-full">Save</Button>
                      </div>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-2">
              {docs.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">No documents yet.</p>}
              {docs.map(d => (
                <div key={d.id} className="p-3 rounded-lg border border-border flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <a href={d.url} target="_blank" rel="noreferrer" className="font-semibold hover:text-primary flex items-center gap-1">
                      {d.title} <ExternalLink className="h-3 w-3" />
                    </a>
                    {d.description && <p className="text-xs text-muted-foreground mt-1">{d.description}</p>}
                  </div>
                  {isAdmin && <Button variant="ghost" size="sm" className="text-destructive" onClick={() => delDoc(d.id)}><Trash2 className="h-4 w-4" /></Button>}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      </div>
    </AppLayout>
  );
}