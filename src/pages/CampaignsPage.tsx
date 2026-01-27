import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Campaign, Target } from '@/lib/supabase-types';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { Loader2, Plus, Pencil, Target as TargetIcon } from 'lucide-react';

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingCampaign, setIsAddingCampaign] = useState(false);
  const [isAddingTarget, setIsAddingTarget] = useState(false);
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null);
  
  // Campaign form
  const [campaignName, setCampaignName] = useState('');
  const [campaignDescription, setCampaignDescription] = useState('');
  const [campaignColor, setCampaignColor] = useState('#06b6d4');
  
  // Target form
  const [targetConversations, setTargetConversations] = useState(15);
  const [targetRegistrations, setTargetRegistrations] = useState(0.5);
  const [targetStartDate, setTargetStartDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [targetEndDate, setTargetEndDate] = useState('');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setIsLoading(true);
    
    const [campaignsRes, targetsRes] = await Promise.all([
      supabase.from('campaigns').select('*').order('name'),
      supabase.from('targets').select('*').order('start_date', { ascending: false })
    ]);
    
    if (campaignsRes.data) setCampaigns(campaignsRes.data as Campaign[]);
    if (targetsRes.data) setTargets(targetsRes.data as Target[]);
    
    setIsLoading(false);
  };

  const handleAddCampaign = async () => {
    if (!campaignName.trim()) {
      toast.error('Campaign name is required');
      return;
    }
    
    const { error } = await supabase.from('campaigns').insert({
      name: campaignName.trim(),
      description: campaignDescription.trim() || null,
      color: campaignColor
    });
    
    if (error) {
      toast.error('Failed to create campaign: ' + error.message);
    } else {
      toast.success('Campaign created!');
      setCampaignName('');
      setCampaignDescription('');
      setCampaignColor('#06b6d4');
      setIsAddingCampaign(false);
      fetchData();
    }
  };

  const handleAddTarget = async () => {
    if (!selectedCampaign) return;
    
    const { error } = await supabase.from('targets').insert({
      campaign_id: selectedCampaign.id,
      role: 'sales_rep',
      conversations_target: targetConversations,
      paid_registrations_target: targetRegistrations,
      start_date: targetStartDate,
      end_date: targetEndDate || null
    });
    
    if (error) {
      toast.error('Failed to create target: ' + error.message);
    } else {
      toast.success('Target created!');
      setIsAddingTarget(false);
      setSelectedCampaign(null);
      fetchData();
    }
  };

  const getTargetsForCampaign = (campaignId: string) => {
    return targets.filter(t => t.campaign_id === campaignId);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Campaigns & Targets</h1>
            <p className="text-muted-foreground">Manage campaigns and set performance targets</p>
          </div>
          
          <Dialog open={isAddingCampaign} onOpenChange={setIsAddingCampaign}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                Add Campaign
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Campaign</DialogTitle>
                <DialogDescription>Create a new campaign for your team to track.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Campaign Name</Label>
                  <Input 
                    value={campaignName} 
                    onChange={(e) => setCampaignName(e.target.value)}
                    placeholder="e.g. Premium Plus"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Description (optional)</Label>
                  <Input 
                    value={campaignDescription} 
                    onChange={(e) => setCampaignDescription(e.target.value)}
                    placeholder="Brief description"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Color</Label>
                  <div className="flex items-center gap-3">
                    <Input 
                      type="color"
                      value={campaignColor} 
                      onChange={(e) => setCampaignColor(e.target.value)}
                      className="w-16 h-10 p-1"
                    />
                    <span className="text-sm text-muted-foreground">{campaignColor}</span>
                  </div>
                </div>
                <Button onClick={handleAddCampaign} className="w-full">
                  Create Campaign
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Campaigns Grid */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {campaigns.map(campaign => {
            const campaignTargets = getTargetsForCampaign(campaign.id);
            const activeTarget = campaignTargets.find(t => 
              t.start_date <= format(new Date(), 'yyyy-MM-dd') &&
              (!t.end_date || t.end_date >= format(new Date(), 'yyyy-MM-dd'))
            );
            
            return (
              <Card key={campaign.id} className="border-border">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div 
                        className="h-4 w-4 rounded-full"
                        style={{ backgroundColor: campaign.color }}
                      />
                      <CardTitle className="text-lg">{campaign.name}</CardTitle>
                    </div>
                    <span className={`text-xs px-2 py-1 rounded ${campaign.is_active ? 'bg-status-green/20 text-status-green' : 'bg-muted text-muted-foreground'}`}>
                      {campaign.is_active ? 'Active' : 'Inactive'}
                    </span>
                  </div>
                  {campaign.description && (
                    <CardDescription>{campaign.description}</CardDescription>
                  )}
                </CardHeader>
                <CardContent className="space-y-4">
                  {activeTarget ? (
                    <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                      <div className="flex items-center gap-2 text-sm font-medium">
                        <TargetIcon className="h-4 w-4 text-primary" />
                        Current Target
                      </div>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div>
                          <span className="text-muted-foreground">Conversations:</span>
                          <span className="ml-2 font-mono">{activeTarget.conversations_target}/day</span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Paid Regs:</span>
                          <span className="ml-2 font-mono">{activeTarget.paid_registrations_target}/day</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">No active target set</p>
                  )}
                  
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="w-full"
                    onClick={() => {
                      setSelectedCampaign(campaign);
                      setIsAddingTarget(true);
                    }}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    {activeTarget ? 'Add New Target' : 'Set Target'}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {/* Target History */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Target History</h2>
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Campaign</TableHead>
                  <TableHead>Conversations/Day</TableHead>
                  <TableHead>Paid Regs/Day</TableHead>
                  <TableHead>Start Date</TableHead>
                  <TableHead>End Date</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {targets.map(target => {
                  const campaign = campaigns.find(c => c.id === target.campaign_id);
                  return (
                    <TableRow key={target.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <div 
                            className="h-2 w-2 rounded-full"
                            style={{ backgroundColor: campaign?.color }}
                          />
                          {campaign?.name}
                        </div>
                      </TableCell>
                      <TableCell className="font-mono">{target.conversations_target}</TableCell>
                      <TableCell className="font-mono">{target.paid_registrations_target}</TableCell>
                      <TableCell>{format(new Date(target.start_date), 'MMM d, yyyy')}</TableCell>
                      <TableCell>
                        {target.end_date 
                          ? format(new Date(target.end_date), 'MMM d, yyyy')
                          : <span className="text-muted-foreground">Ongoing</span>
                        }
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        </div>

        {/* Add Target Dialog */}
        <Dialog open={isAddingTarget} onOpenChange={setIsAddingTarget}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Set Target for {selectedCampaign?.name}</DialogTitle>
              <DialogDescription>Define daily targets for sales reps on this campaign.</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 pt-4">
              <div className="space-y-2">
                <Label>Conversations per Day</Label>
                <Input 
                  type="number"
                  min="1"
                  value={targetConversations} 
                  onChange={(e) => setTargetConversations(parseInt(e.target.value) || 0)}
                />
              </div>
              <div className="space-y-2">
                <Label>Paid Registrations per Day</Label>
                <Input 
                  type="number"
                  min="0"
                  step="0.1"
                  value={targetRegistrations} 
                  onChange={(e) => setTargetRegistrations(parseFloat(e.target.value) || 0)}
                />
                <p className="text-xs text-muted-foreground">
                  0.5 = 1 registration every 2 days
                </p>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Start Date</Label>
                  <Input 
                    type="date"
                    value={targetStartDate} 
                    onChange={(e) => setTargetStartDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>End Date (optional)</Label>
                  <Input 
                    type="date"
                    value={targetEndDate} 
                    onChange={(e) => setTargetEndDate(e.target.value)}
                  />
                </div>
              </div>
              <Button onClick={handleAddTarget} className="w-full">
                Save Target
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
