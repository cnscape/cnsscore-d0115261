import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Users, Shuffle, ArrowRight, MessageSquare, TrendingUp, Plus, Upload, UserPlus, FileText } from 'lucide-react';
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
  last_activity_at: string;
}

interface ProfileRow {
  id: string;
  user_id: string;
  full_name: string;
  is_active: boolean;
}

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'New Lead', dm_sent: 'DM Sent', responded: 'Responded',
  discovery_booked: 'Discovery', presentation: 'Presentation',
  follow_up: 'Follow-Up', closed_won: 'Won', closed_lost: 'Lost',
};

type Delimiter = 'comma' | 'semicolon' | 'tab' | 'newline' | 'pipe';

const DELIMITER_OPTIONS: { value: Delimiter; label: string; char: string }[] = [
  { value: 'comma', label: 'Comma (,)', char: ',' },
  { value: 'semicolon', label: 'Semicolon (;)', char: ';' },
  { value: 'tab', label: 'Tab', char: '\t' },
  { value: 'newline', label: 'New Line', char: '\n' },
  { value: 'pipe', label: 'Pipe (|)', char: '|' },
];

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedRepId, setSelectedRepId] = useState<string>('all');

  // Add lead dialog
  const [showAddLead, setShowAddLead] = useState(false);
  const [addLeadRepId, setAddLeadRepId] = useState('');
  const [newLeadName, setNewLeadName] = useState('');
  const [newLeadContact, setNewLeadContact] = useState('');
  const [newPlatform, setNewPlatform] = useState('LinkedIn');
  const [newLeadScore, setNewLeadScore] = useState('B');

  // Bulk import dialog
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [bulkRepId, setBulkRepId] = useState('');
  const [bulkImportMode, setBulkImportMode] = useState<'text' | 'csv'>('text');
  const [bulkText, setBulkText] = useState('');
  const [bulkDelimiter, setBulkDelimiter] = useState<Delimiter>('comma');
  const [bulkPlatform, setBulkPlatform] = useState('LinkedIn');
  const [bulkScore, setBulkScore] = useState('B');
  const [csvHasHeaders, setCsvHasHeaders] = useState(true);
  const [isImporting, setIsImporting] = useState(false);
  const [parsedPreview, setParsedPreview] = useState<{ name: string; contact: string }[]>([]);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from('pipeline_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, user_id, full_name, is_active').eq('is_active', true),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as PipelineLead[]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleAssign = async (leadId: string, newOwnerId: string) => {
    const { error } = await supabase.from('pipeline_leads').update({ owner_id: newOwnerId } as any).eq('id', leadId);
    if (error) { toast.error('Failed to reassign'); return; }
    toast.success('Lead reassigned');
    fetchData();
  };

  const handleRandomSplit = async () => {
    const unassignedOrAll = leads.filter(l => !['closed_won', 'closed_lost'].includes(l.stage));
    if (unassignedOrAll.length === 0 || profiles.length === 0) return;
    const shuffled = [...unassignedOrAll].sort(() => Math.random() - 0.5);
    for (let i = 0; i < shuffled.length; i++) {
      const rep = profiles[i % profiles.length];
      await supabase.from('pipeline_leads').update({ owner_id: rep.user_id } as any).eq('id', shuffled[i].id);
    }
    toast.success(`${shuffled.length} leads distributed across ${profiles.length} reps`);
    fetchData();
  };

  // Single lead add
  const handleAddSingleLead = async () => {
    if (!addLeadRepId || !newLeadName.trim()) return;
    const { error } = await supabase.from('pipeline_leads').insert([{
      owner_id: addLeadRepId,
      lead_name: newLeadName.trim(),
      lead_contact: newLeadContact.trim() || null,
      platform: newPlatform,
      lead_score: newLeadScore,
    }] as any);
    if (error) { toast.error('Failed to add lead'); return; }
    toast.success('Lead added and assigned!');
    setShowAddLead(false);
    setNewLeadName(''); setNewLeadContact('');
    fetchData();
  };

  // Parse bulk text for preview
  const parseBulkInput = useCallback((text: string, delimiter: Delimiter, mode: 'text' | 'csv', hasHeaders: boolean) => {
    if (!text.trim()) { setParsedPreview([]); return; }

    if (mode === 'csv') {
      const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean);
      const startIdx = hasHeaders ? 1 : 0;
      const results: { name: string; contact: string }[] = [];
      for (let i = startIdx; i < lines.length; i++) {
        // CSV: split by comma, first col = name, second col = contact (optional)
        const cols = lines[i].split(',').map(c => c.trim().replace(/^"|"$/g, ''));
        if (cols[0]) results.push({ name: cols[0], contact: cols[1] || '' });
      }
      setParsedPreview(results);
    } else {
      // Text mode: names only, separated by chosen delimiter
      const delimChar = DELIMITER_OPTIONS.find(d => d.value === delimiter)?.char || ',';
      let items: string[];
      if (delimiter === 'newline') {
        items = text.split('\n');
      } else {
        items = text.split(delimChar);
      }
      const results = items.map(s => s.trim()).filter(Boolean).map(name => ({ name, contact: '' }));
      setParsedPreview(results);
    }
  }, []);

  useEffect(() => {
    parseBulkInput(bulkText, bulkDelimiter, bulkImportMode, csvHasHeaders);
  }, [bulkText, bulkDelimiter, bulkImportMode, csvHasHeaders, parseBulkInput]);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setBulkText(text);
      setBulkImportMode('csv');
    };
    reader.readAsText(file);
  };

  const handleBulkImport = async () => {
    if (!bulkRepId || parsedPreview.length === 0) return;
    setIsImporting(true);
    const rows = parsedPreview.map(p => ({
      owner_id: bulkRepId,
      lead_name: p.name,
      lead_contact: p.contact || null,
      platform: bulkPlatform,
      lead_score: bulkScore,
    }));

    const { error } = await supabase.from('pipeline_leads').insert(rows as any);
    if (error) { toast.error('Import failed: ' + error.message); setIsImporting(false); return; }
    toast.success(`${rows.length} leads imported and assigned!`);
    setShowBulkImport(false);
    setBulkText('');
    setParsedPreview([]);
    setIsImporting(false);
    fetchData();
  };

  const filteredLeads = selectedRepId === 'all' ? leads : leads.filter(l => l.owner_id === selectedRepId);

  const repPerformance = profiles.map(p => {
    const repLeads = leads.filter(l => l.owner_id === p.user_id);
    return {
      profile: p,
      total: repLeads.length,
      conversations: repLeads.filter(l => !['new_lead', 'dm_sent'].includes(l.stage)).length,
      won: repLeads.filter(l => l.stage === 'closed_won').length,
    };
  }).sort((a, b) => b.won - a.won);

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-3xl font-bold">Lead Distribution</h1>
            <p className="text-muted-foreground">{leads.length} total leads across {profiles.length} reps</p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {/* Add Single Lead */}
            <Dialog open={showAddLead} onOpenChange={setShowAddLead}>
              <DialogTrigger asChild>
                <Button variant="outline"><UserPlus className="h-4 w-4 mr-2" /> Add Lead</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Add Lead to Rep</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Assign to Rep *</Label>
                    <Select value={addLeadRepId} onValueChange={setAddLeadRepId}>
                      <SelectTrigger><SelectValue placeholder="Select rep..." /></SelectTrigger>
                      <SelectContent>
                        {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Lead Name *</Label>
                    <Input value={newLeadName} onChange={e => setNewLeadName(e.target.value)} placeholder="Full name" />
                  </div>
                  <div className="space-y-2">
                    <Label>Contact Info</Label>
                    <Input value={newLeadContact} onChange={e => setNewLeadContact(e.target.value)} placeholder="Email, phone, or handle" />
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
                  <Button onClick={handleAddSingleLead} className="w-full" disabled={!addLeadRepId || !newLeadName.trim()}>
                    <Plus className="h-4 w-4 mr-2" /> Add Lead
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            {/* Bulk Import */}
            <Dialog open={showBulkImport} onOpenChange={setShowBulkImport}>
              <DialogTrigger asChild>
                <Button variant="outline"><Upload className="h-4 w-4 mr-2" /> Bulk Import</Button>
              </DialogTrigger>
              <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
                <DialogHeader><DialogTitle>Bulk Import Leads</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-2">
                  <div className="space-y-2">
                    <Label>Assign all leads to *</Label>
                    <Select value={bulkRepId} onValueChange={setBulkRepId}>
                      <SelectTrigger><SelectValue placeholder="Select rep..." /></SelectTrigger>
                      <SelectContent>
                        {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Platform</Label>
                      <Select value={bulkPlatform} onValueChange={setBulkPlatform}>
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
                      <Select value={bulkScore} onValueChange={setBulkScore}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="A">A — Hot</SelectItem>
                          <SelectItem value="B">B — Warm</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <Tabs value={bulkImportMode} onValueChange={v => setBulkImportMode(v as 'text' | 'csv')}>
                    <TabsList className="w-full">
                      <TabsTrigger value="text" className="flex-1"><FileText className="h-4 w-4 mr-1" /> Paste Names</TabsTrigger>
                      <TabsTrigger value="csv" className="flex-1"><Upload className="h-4 w-4 mr-1" /> CSV Upload</TabsTrigger>
                    </TabsList>

                    <TabsContent value="text" className="space-y-3">
                      <div className="space-y-2">
                        <Label>Delimiter</Label>
                        <Select value={bulkDelimiter} onValueChange={v => setBulkDelimiter(v as Delimiter)}>
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {DELIMITER_OPTIONS.map(d => <SelectItem key={d.value} value={d.value}>{d.label}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label>Paste lead names</Label>
                        <Textarea
                          value={bulkText}
                          onChange={e => setBulkText(e.target.value)}
                          placeholder={bulkDelimiter === 'newline'
                            ? "John Doe\nJane Smith\nBob Wilson"
                            : bulkDelimiter === 'comma'
                              ? "John Doe, Jane Smith, Bob Wilson"
                              : "John Doe; Jane Smith; Bob Wilson"}
                          className="min-h-[120px] font-mono text-sm"
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="csv" className="space-y-3">
                      <div className="space-y-2">
                        <Label>Upload CSV file</Label>
                        <Input type="file" accept=".csv,.txt" onChange={handleFileUpload} />
                        <p className="text-xs text-muted-foreground">CSV format: Name, Contact (one per line). First column = name, second = contact info (optional).</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          id="csvHeaders"
                          checked={csvHasHeaders}
                          onChange={e => setCsvHasHeaders(e.target.checked)}
                          className="rounded border-input"
                        />
                        <Label htmlFor="csvHeaders" className="text-sm font-normal">First row is headers (skip it)</Label>
                      </div>
                      {bulkText && (
                        <div className="space-y-2">
                          <Label>Or paste CSV content directly</Label>
                          <Textarea
                            value={bulkText}
                            onChange={e => setBulkText(e.target.value)}
                            placeholder="Name,Contact&#10;John Doe,john@email.com&#10;Jane Smith,jane@email.com"
                            className="min-h-[120px] font-mono text-sm"
                          />
                        </div>
                      )}
                    </TabsContent>
                  </Tabs>

                  {/* Preview */}
                  {parsedPreview.length > 0 && (
                    <div className="space-y-2">
                      <Label className="text-sm">Preview ({parsedPreview.length} leads)</Label>
                      <div className="rounded-lg border border-border max-h-[200px] overflow-y-auto">
                        <Table>
                          <TableHeader>
                            <TableRow className="bg-muted/50">
                              <TableHead className="text-xs">#</TableHead>
                              <TableHead className="text-xs">Name</TableHead>
                              <TableHead className="text-xs">Contact</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {parsedPreview.slice(0, 20).map((p, i) => (
                              <TableRow key={i}>
                                <TableCell className="text-xs text-muted-foreground py-1">{i + 1}</TableCell>
                                <TableCell className="text-xs py-1 font-medium">{p.name}</TableCell>
                                <TableCell className="text-xs py-1 text-muted-foreground">{p.contact || '—'}</TableCell>
                              </TableRow>
                            ))}
                            {parsedPreview.length > 20 && (
                              <TableRow>
                                <TableCell colSpan={3} className="text-xs text-center text-muted-foreground py-1">
                                  ...and {parsedPreview.length - 20} more
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  )}

                  <Button
                    onClick={handleBulkImport}
                    className="w-full"
                    disabled={!bulkRepId || parsedPreview.length === 0 || isImporting}
                  >
                    {isImporting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    Import {parsedPreview.length} Leads
                  </Button>
                </div>
              </DialogContent>
            </Dialog>

            <Button onClick={handleRandomSplit} variant="outline">
              <Shuffle className="h-4 w-4 mr-2" /> Random Split
            </Button>
          </div>
        </div>

        {/* Performance Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Total Leads" value={leads.length} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Conversations" value={leads.filter(l => !['new_lead', 'dm_sent'].includes(l.stage)).length} icon={<MessageSquare className="h-5 w-5" />} />
          <StatCard title="Deals Won" value={leads.filter(l => l.stage === 'closed_won').length} icon={<TrendingUp className="h-5 w-5" />} variant="glow" />
          <StatCard title="Active Pipeline" value={leads.filter(l => !['closed_won', 'closed_lost'].includes(l.stage)).length} icon={<ArrowRight className="h-5 w-5" />} />
        </div>

        {/* Rep filter */}
        <div className="flex items-center gap-3">
          <Label className="text-sm font-medium">View by Rep:</Label>
          <Select value={selectedRepId} onValueChange={setSelectedRepId}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Reps</SelectItem>
              {profiles.map(p => (
                <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedRepId !== 'all' && (
            <Badge variant="outline">{filteredLeads.length} leads</Badge>
          )}
        </div>

        {/* Rep Performance */}
        <Card>
          <CardHeader><CardTitle className="text-lg">Rep Performance</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Rep</TableHead>
                    <TableHead className="text-right">Total Leads</TableHead>
                    <TableHead className="text-right">Conversations</TableHead>
                    <TableHead className="text-right">Won</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {repPerformance.map(r => (
                    <TableRow
                      key={r.profile.id}
                      className={selectedRepId === r.profile.user_id ? 'bg-primary/5' : 'cursor-pointer hover:bg-muted/50'}
                      onClick={() => setSelectedRepId(r.profile.user_id)}
                    >
                      <TableCell className="font-medium">{r.profile.full_name}</TableCell>
                      <TableCell className="text-right font-mono">{r.total}</TableCell>
                      <TableCell className="text-right font-mono">{r.conversations}</TableCell>
                      <TableCell className="text-right font-mono text-primary">{r.won}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>

        {/* All Leads Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">
              {selectedRepId === 'all' ? 'All Leads' : `${profiles.find(p => p.user_id === selectedRepId)?.full_name}'s Leads`}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Lead</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead>Score</TableHead>
                    <TableHead>Assigned To</TableHead>
                    <TableHead>Last Activity</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredLeads.map(lead => (
                    <TableRow key={lead.id}>
                      <TableCell>
                        <p className="font-medium">{lead.lead_name}</p>
                        <p className="text-xs text-muted-foreground">{lead.platform}</p>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">{STAGE_LABELS[lead.stage] || lead.stage}</Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className={lead.lead_score === 'A' ? 'text-[hsl(var(--status-green))]' : ''}>
                          {lead.lead_score}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Select value={lead.owner_id} onValueChange={(v) => handleAssign(lead.id, v)}>
                          <SelectTrigger className="w-36 h-8 text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(lead.last_activity_at), { addSuffix: true })}
                      </TableCell>
                    </TableRow>
                  ))}
                  {filteredLeads.length === 0 && (
                    <TableRow><TableCell colSpan={5} className="text-center py-8 text-muted-foreground">No leads yet</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
