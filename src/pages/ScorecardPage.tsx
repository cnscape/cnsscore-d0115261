import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, MessageSquare, UserCheck, Phone, DollarSign, FileText, Sparkles } from 'lucide-react';
import { Campaign, Scorecard } from '@/lib/supabase-types';
import { format } from 'date-fns';

export default function ScorecardPage() {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('');
  const [existingScorecard, setExistingScorecard] = useState<Scorecard | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Form fields
  const [conversationsStarted, setConversationsStarted] = useState(0);
  const [followUpsSent, setFollowUpsSent] = useState(0);
  const [paidRegistrations, setPaidRegistrations] = useState(0);
  const [callsMade, setCallsMade] = useState(0);
  const [revenueCollected, setRevenueCollected] = useState(0);
  const [notes, setNotes] = useState('');

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true);
      
      if (data) {
        setCampaigns(data as Campaign[]);
        if (data.length > 0) {
          setSelectedCampaign(data[0].id);
        }
      }
      setIsLoading(false);
    };
    
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (!user || !selectedCampaign) return;
    
    const fetchExisting = async () => {
      const { data } = await supabase
        .from('scorecards')
        .select('*')
        .eq('user_id', user.id)
        .eq('campaign_id', selectedCampaign)
        .eq('date', today)
        .maybeSingle();
      
      if (data) {
        const scorecard = data as Scorecard;
        setExistingScorecard(scorecard);
        setConversationsStarted(scorecard.conversations_started);
        setFollowUpsSent(scorecard.follow_ups_sent);
        setPaidRegistrations(scorecard.paid_registrations);
        setCallsMade(scorecard.calls_made || 0);
        setRevenueCollected(scorecard.revenue_collected || 0);
        setNotes(scorecard.notes || '');
      } else {
        setExistingScorecard(null);
        setConversationsStarted(0);
        setFollowUpsSent(0);
        setPaidRegistrations(0);
        setCallsMade(0);
        setRevenueCollected(0);
        setNotes('');
      }
    };
    
    fetchExisting();
  }, [user, selectedCampaign, today]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !selectedCampaign) return;
    
    setIsSubmitting(true);
    
    const scorecardData = {
      user_id: user.id,
      campaign_id: selectedCampaign,
      date: today,
      conversations_started: conversationsStarted,
      follow_ups_sent: followUpsSent,
      paid_registrations: paidRegistrations,
      calls_made: callsMade || null,
      revenue_collected: revenueCollected || null,
      notes: notes || null
    };
    
    let error;
    
    if (existingScorecard) {
      const result = await supabase
        .from('scorecards')
        .update(scorecardData)
        .eq('id', existingScorecard.id);
      error = result.error;
    } else {
      const result = await supabase
        .from('scorecards')
        .insert(scorecardData);
      error = result.error;
    }
    
    if (error) {
      toast.error('Failed to save scorecard: ' + error.message);
    } else {
      toast.success(
        existingScorecard 
          ? 'Scorecard updated! Keep crushing it! 🔥' 
          : 'Scorecard submitted! +50 XP earned! 🎯'
      );
      
      // Refresh the existing scorecard
      const { data } = await supabase
        .from('scorecards')
        .select('*')
        .eq('user_id', user.id)
        .eq('campaign_id', selectedCampaign)
        .eq('date', today)
        .maybeSingle();
      
      if (data) {
        setExistingScorecard(data as Scorecard);
      }
    }
    
    setIsSubmitting(false);
  };

  const selectedCampaignData = campaigns.find(c => c.id === selectedCampaign);

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
      <div className="p-6 lg:p-8 max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Today's Scorecard</h1>
          <p className="text-muted-foreground">
            {format(new Date(), 'EEEE, MMMM d, yyyy')}
          </p>
        </div>

        <Card className="border-border">
          <CardHeader>
            <div className="flex items-center gap-3">
              <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
                <SelectTrigger className="w-48">
                  <SelectValue placeholder="Select campaign" />
                </SelectTrigger>
                <SelectContent>
                  {campaigns.map(campaign => (
                    <SelectItem key={campaign.id} value={campaign.id}>
                      <div className="flex items-center gap-2">
                        <span 
                          className="h-2 w-2 rounded-full" 
                          style={{ backgroundColor: campaign.color }}
                        />
                        {campaign.name}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {existingScorecard && (
                <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
                  Already submitted • Editing
                </span>
              )}
            </div>
            <CardDescription className="mt-2">
              {selectedCampaignData?.description || 'Log your daily metrics for this campaign'}
            </CardDescription>
          </CardHeader>
          
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* Required Fields */}
              <div className="space-y-4">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Required Metrics
                </h3>
                
                <div className="space-y-2">
                  <Label htmlFor="conversations" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4 text-primary" />
                    Conversations Started
                  </Label>
                  <Input
                    id="conversations"
                    type="text"
                    inputMode="numeric"
                    value={conversationsStarted || ''}
                    onChange={(e) => setConversationsStarted(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="text-lg font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    A conversation counts only if you message and the lead replies at least once.
                  </p>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="followups" className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-secondary" />
                    Follow-ups Sent
                  </Label>
                  <Input
                    id="followups"
                    type="text"
                    inputMode="numeric"
                    value={followUpsSent || ''}
                    onChange={(e) => setFollowUpsSent(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="text-lg font-mono"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="registrations" className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4 text-status-green" />
                    Paid Registrations
                  </Label>
                  <Input
                    id="registrations"
                    type="text"
                    inputMode="numeric"
                    value={paidRegistrations || ''}
                    onChange={(e) => setPaidRegistrations(parseInt(e.target.value) || 0)}
                    placeholder="0"
                    className="text-lg font-mono"
                  />
                </div>
              </div>

              {/* Optional Fields */}
              <div className="space-y-4 pt-4 border-t border-border">
                <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                  Optional
                </h3>
                
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="calls" className="flex items-center gap-2">
                      <Phone className="h-4 w-4" />
                      Calls Made
                    </Label>
                    <Input
                      id="calls"
                      type="text"
                      inputMode="numeric"
                      value={callsMade || ''}
                      onChange={(e) => setCallsMade(parseInt(e.target.value) || 0)}
                      placeholder="0"
                      className="font-mono"
                    />
                  </div>
                  
                  <div className="space-y-2">
                    <Label htmlFor="revenue" className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4" />
                      Revenue (ZAR)
                    </Label>
                    <Input
                      id="revenue"
                      type="text"
                      inputMode="decimal"
                      value={revenueCollected || ''}
                      onChange={(e) => setRevenueCollected(parseFloat(e.target.value) || 0)}
                      placeholder="0.00"
                      className="font-mono"
                    />
                  </div>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="notes" className="flex items-center gap-2">
                    <FileText className="h-4 w-4" />
                    Notes
                  </Label>
                  <Textarea
                    id="notes"
                    placeholder="Any wins, blockers, or observations..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                  />
                </div>
              </div>

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : existingScorecard ? (
                  'Update Scorecard'
                ) : (
                  'Submit Scorecard'
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
