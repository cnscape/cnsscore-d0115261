import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Loader2, Users, Shuffle, ArrowRight, MessageSquare, DollarSign, TrendingUp } from 'lucide-react';
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

export default function AdminLeadsPage() {
  const [leads, setLeads] = useState<PipelineLead[]>([]);
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const fetchData = async () => {
    setIsLoading(true);
    const [leadsRes, profilesRes] = await Promise.all([
      supabase.from('pipeline_leads').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('id, user_id, full_name, is_active').eq('is_active', true),
    ]);
    if (leadsRes.data) setLeads(leadsRes.data as PipelineLead[]);
    if (profilesRes.data) setProfiles(profilesRes.data as ProfileRow[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

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

  const getRepName = (ownerId: string) => profiles.find(p => p.user_id === ownerId)?.full_name || 'Unassigned';

  // Performance stats
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Lead Distribution</h1>
            <p className="text-muted-foreground">{leads.length} total leads across {profiles.length} reps</p>
          </div>
          <Button onClick={handleRandomSplit} variant="outline">
            <Shuffle className="h-4 w-4 mr-2" /> Random Split
          </Button>
        </div>

        {/* Performance Overview */}
        <div className="grid gap-4 md:grid-cols-4">
          <StatCard title="Total Leads" value={leads.length} icon={<Users className="h-5 w-5" />} />
          <StatCard title="Conversations" value={leads.filter(l => !['new_lead', 'dm_sent'].includes(l.stage)).length} icon={<MessageSquare className="h-5 w-5" />} />
          <StatCard title="Deals Won" value={leads.filter(l => l.stage === 'closed_won').length} icon={<TrendingUp className="h-5 w-5" />} variant="glow" />
          <StatCard title="Active Pipeline" value={leads.filter(l => !['closed_won', 'closed_lost'].includes(l.stage)).length} icon={<ArrowRight className="h-5 w-5" />} />
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
                    <TableRow key={r.profile.id}>
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
          <CardHeader><CardTitle className="text-lg">All Leads</CardTitle></CardHeader>
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
                  {leads.map(lead => (
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
                  {leads.length === 0 && (
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
