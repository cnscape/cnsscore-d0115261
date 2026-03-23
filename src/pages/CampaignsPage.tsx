import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Plus, Pencil, Target as TargetIcon, MessageSquare, Phone, DollarSign, UserCheck, Trash2, Pause, Play } from 'lucide-react';

interface ClientOption {
  id: string;
  name: string;
}

interface CampaignRow {
  id: string;
  name: string;
  description: string | null;
  color: string;
  is_active: boolean;
  client_id: string | null;
  paused_at: string | null;
  created_at: string;
  clients?: { name: string } | null;
}

interface TargetRow {
  id: string;
  campaign_id: string;
  conversations_target: number | null;
  paid_registrations_target: number | null;
  start_date: string;
  end_date: string | null;
}

interface DealRow {
  id: string;
  status: string;
  channel: string | null;
  revenue: number | null;
  campaign: string | null;
}

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [targets, setTargets] = useState<TargetRow[]>([]);
  const [deals, setDeals] = useState<DealRow[]>([]);
  const [clients, setClients] = useState<ClientOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [isAddingTarget, setIsAddingTarget] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<CampaignRow | null>(null);

  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignColor, setCampaignColor] = useState('#06b6d4');
  const [campaignClientId, setCampaignClientId] = useState('');

  // Target form
  const [targetConversations, setTargetConversations] = useState(15);
  const [targetRegistrations, setTargetRegistrations] = useState(1);
  const [targetRevenue, setTargetRevenue] = useState(20000);
  const [targetCalls, setTargetCalls] = useState(10);
  const [targetStartDate, setTargetStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [targetEndDate, setTargetEndDate] = useState('');

  useEffect(() => { fetchData(); }, []);

  const fetchData = async () => {
    setIsLoading(true);
    const [campaignsRes, targetsRes, dealsRes, clientsRes] = await Promise.all([
      supabase.from('campaigns').select('*, clients(name)').order('is_active', { ascending: false }).order('name'),
      supabase.from('targets').select('*').order('start_date', { ascending: false }),
      supabase.from('deals').select('id, status, channel, revenue, campaign'),
      supabase.from('clients').select('id, name').eq('is_active', true).order('name'),
    ]);
    if (campaignsRes.data) setCampaigns(campaignsRes.data as unknown as CampaignRow[]);
    if (targetsRes.data) setTargets(targetsRes.data as TargetRow[]);
    if (dealsRes.data) setDeals(dealsRes.data as DealRow[]);
    if (clientsRes.data) setClients(clientsRes.data as ClientOption[]);
    setIsLoading(false);
  };

  // Sort: active first, then paused, then inactive
  const sortedCampaigns = [...campaigns].sort((a, b) => {
    const statusOrder = (c: CampaignRow) => {
      if (c.is_active && !c.paused_at) return 0; // active
      if (c.is_active && c.paused_at) return 1;   // paused
      return 2; // inactive
    };
    return statusOrder(a) - statusOrder(b);
  });

  const handleAddCampaign = async () => {
    if (!campaignName.trim()) { toast.error('Campaign name is required'); return; }
    const { error } = await supabase.from('campaigns').insert({
      name: campaignName.trim(),
      description: campaignDescription.trim() || null,
      color: campaignColor,
      client_id: campaignClientId || null,
    } as any);
    if (error) { toast.error('Failed to create campaign: ' + error.message); return; }
    toast.success('Campaign created!');
    setCampaignName(''); setCampaignDescription(''); setCampaignColor('#06b6d4'); setCampaignClientId('');
    setIsAddingCampaign(false);
    fetchData();
  };

  const handlePauseCampaign = async (campaign: CampaignRow) => {
    const isPaused = !!campaign.paused_at;
    const { error } = await supabase.from('campaigns').update({
      paused_at: isPaused ? null : new Date().toISOString(),
    } as any).eq('id', campaign.id);
    if (error) { toast.error('Failed to update campaign'); return; }
    toast.success(isPaused ? 'Campaign reactivated!' : 'Campaign paused');
    fetchData();
  };

  const handleDeleteCampaign = async (campaignId: string) => {
    if (!confirm('Are you sure you want to delete this campaign? This cannot be undone.')) return;
    const { error } = await supabase.from('campaigns').delete().eq('id', campaignId);
    if (error) { toast.error('Failed to delete campaign: ' + error.message); return; }
    toast.success('Campaign deleted');
    fetchData();
  };

  const handleAddTarget = async () => {
    if (!selectedCampaign) return;
    const { error } = await supabase.from('targets').insert({
      campaign_id: selectedCampaign.id,
      role: 'sales_rep',
      conversations_target: targetConversations,
      paid_registrations_target: targetRegistrations,
      start_date: targetStartDate,
      end_date: targetEndDate || null,
    });
    if (error) { toast.error('Failed to create target: ' + error.message); return; }
    toast.success('Target created!');
    setIsAddingTarget(false); setSelectedCampaign(null);
    fetchData();
  };

  const getCampaignProgress = (campaignId: string) => {
    const campaign = campaigns.find(c => c.id === campaignId);
    const campaignDeals = deals.filter(d => d.campaign === campaignId || d.campaign === campaign?.name);
    const wonDeals = campaignDeals.filter(d => d.status === 'won');
    return {
      conversations: campaignDeals.length,
      calls: campaignDeals.filter(d => d.channel === 'call' || d.channel === 'phone').length,
      revenue: wonDeals.reduce((s, d) => s + (d.revenue || 0), 0),
      paidRegistrations: wonDeals.length,
    };
  };

  const getActiveTarget = (campaignId: string) => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return targets.find(t =>
      t.campaign_id === campaignId && t.start_date <= today && (!t.end_date || t.end_date >= today)
    );
  };

  const getCampaignStatusLabel = (c: CampaignRow) => {
    if (!c.is_active) return 'Inactive';
    if (c.paused_at) return 'Paused';
    return 'Active';
  };

  const getCampaignStatusStyle = (c: CampaignRow) => {
    if (!c.is_active) return 'bg-muted text-muted-foreground';
    if (c.paused_at) return 'bg-secondary/20 text-secondary-foreground';
    return 'bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))]';
  };

  if (isLoading) {
    return (<AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>);
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campaigns</h1>
            <p className="text-muted-foreground">Live campaign tracking powered by deals data</p>
          </div>
          <Dialog open={isAddingCampaign} onOpenChange={setIsAddingCampaign}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" />Add Campaign</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Campaign</DialogTitle>
                <DialogDescription>Create a new campaign to track.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input value={campaignName} onChange={(e) => setCampaignName(e.target.value)} placeholder="e.g. Premium Plus" />
                </div>
                <div className="space-y-2">
                  <Label>Client</Label>
                  <Select value={campaignClientId} onValueChange={setCampaignClientId}>
                    <SelectTrigger><SelectValue placeholder="Select a client (optional)" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No Client</SelectItem>
                      {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input value={campaignDescription} onChange={(e) => setCampaignDescription(e.target.value)} placeholder="Brief description" />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex items-center gap-3">
                    <Input type="color" value={campaignColor} onChange={(e) => setCampaignColor(e.target.value)} className="w-16 h-10 p-1" />
                    <span className="text-sm text-muted-foreground">{campaignColor}</span>
                  </div>
                </div>
                <Button onClick={handleAddCampaign} className="w-full">Create Campaign</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Campaigns Grid */}
        <div className="grid gap-6 md:grid-cols-2">
          {sortedCampaigns.map(campaign => {
            const progress = getCampaignProgress(campaign.id);
            const target = getActiveTarget(campaign.id);
            const convTarget = target?.conversations_target || targetConversations;
            const regTarget = target?.paid_registrations_target || targetRegistrations;
            const revTarget = targetRevenue;
            const callTarget = targetCalls;
            const convPercent = Math.min((progress.conversations / (convTarget || 1)) * 100, 100);
            const callPercent = Math.min((progress.calls / (callTarget || 1)) * 100, 100);
            const revPercent = Math.min((progress.revenue / (revTarget || 1)) * 100, 100);
            const regPercent = Math.min((progress.paidRegistrations / (regTarget || 1)) * 100, 100);

            return (
              <Card key={campaign.id} className={`border-border ${campaign.paused_at ? 'opacity-75' : ''}`}>
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-4 w-4 rounded-full" style={{ backgroundColor: campaign.color }} />
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-xs px-2 py-1 rounded ${getCampaignStatusStyle(campaign)}`}>
                        {getCampaignStatusLabel(campaign)}
                      </span>
                    </div>
                  </div>
                  {campaign.description && <CardDescription>{campaign.description}</CardDescription>}
                  {(campaign as any).clients?.name && (
                    <p className="text-xs text-muted-foreground">Client: {(campaign as any).clients.name}</p>
                  )}
                  {campaign.paused_at && (
                    <p className="text-xs text-secondary-foreground">Paused: {format(new Date(campaign.paused_at), 'dd MMM yyyy')}</p>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {/* Live Progress Bars */}
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5"><MessageSquare className="h-3.5 w-3.5 text-muted-foreground" /> Conversations</span>
                        <span className="font-mono text-xs">{progress.conversations} / {convTarget}</span>
                      </div>
                      <Progress value={convPercent} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5 text-muted-foreground" /> Calls</span>
                        <span className="font-mono text-xs">{progress.calls} / {callTarget}</span>
                      </div>
                      <Progress value={callPercent} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5"><DollarSign className="h-3.5 w-3.5 text-muted-foreground" /> Revenue</span>
                        <span className="font-mono text-xs">R{progress.revenue.toLocaleString()} / R{revTarget.toLocaleString()}</span>
                      </div>
                      <Progress value={revPercent} className="h-2" />
                    </div>
                    <div>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="flex items-center gap-1.5"><UserCheck className="h-3.5 w-3.5 text-muted-foreground" /> Paid Registrations</span>
                        <span className="font-mono text-xs">{progress.paidRegistrations} / {regTarget}</span>
                      </div>
                      <Progress value={regPercent} className="h-2" />
                    </div>
                  </div>

                  {target && (
                    <div className="p-2 rounded-lg bg-muted/50 text-xs text-muted-foreground flex items-center gap-2">
                      <TargetIcon className="h-3.5 w-3.5 text-primary" />
                      Target: {target.conversations_target} conv/day, {target.paid_registrations_target} regs/day
                    </div>
                  )}

                  {/* Admin Actions */}
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="flex-1" onClick={() => { setSelectedCampaign(campaign); setIsAddingTarget(true); }}>
                      <Pencil className="h-4 w-4 mr-2" />{target ? 'Update Target' : 'Set Target'}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handlePauseCampaign(campaign)} title={campaign.paused_at ? 'Reactivate' : 'Pause'}>
                      {campaign.paused_at ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                    </Button>
                    <Button variant="outline" size="sm" onClick={() => handleDeleteCampaign(campaign.id)} className="text-destructive hover:text-destructive" title="Delete">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
          {campaigns.length === 0 && (
            <Card className="md:col-span-2">
              <CardContent className="p-12 text-center text-muted-foreground">
                No campaigns yet. Create your first campaign to start tracking.
              </CardContent>
            </Card>
          )}
        </div>

        {/* Add Target Dialog */}
        <Dialog open={isAddingTarget} onOpenChange={setIsAddingTarget}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Target for {selectedCampaign?.name}</DialogTitle>
              <DialogDescription>Define targets for this campaign.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Conversations Target</Label>
                  <Input type="number" min="1" value={targetConversations} onChange={(e) => setTargetConversations(parseInt(e.target.value) || 0)} />
                </div>
                <div className="space-y-2">
                  <Label>Paid Registrations Target</Label>
                  <Input type="number" min="0" value={targetRegistrations} onChange={(e) => setTargetRegistrations(parseFloat(e.target.value) || 0)} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input type="date" value={targetStartDate} onChange={(e) => setTargetStartDate(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input type="date" value={targetEndDate} onChange={(e) => setTargetEndDate(e.target.value)} />
                </div>
              </div>
              <Button onClick={handleAddTarget} className="w-full">Save Target</Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
