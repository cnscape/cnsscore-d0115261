import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { RAGStatusBadge, calculateRAGStatus } from '@/components/ui/rag-status';
import { Campaign, ScorecardWithCampaign, Target } from '@/lib/supabase-types';
import { format, subDays } from 'date-fns';
import { Loader2 } from 'lucide-react';

export default function HistoryPage({ embedded = false }: { embedded?: boolean }) {
  const { user } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState<string>('all');
  const [scorecards, setScorecards] = useState<ScorecardWithCampaign[]>([]);
  const [targets, setTargets] = useState<Target[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchCampaigns = async () => {
      const { data } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true);
      
      if (data) {
        setCampaigns(data as Campaign[]);
      }
    };
    
    fetchCampaigns();
  }, []);

  useEffect(() => {
    if (!user) return;
    
    const fetchData = async () => {
      setIsLoading(true);
      
      // Fetch scorecards with campaign info
      const thirtyDaysAgo = format(subDays(new Date(), 30), 'yyyy-MM-dd');
      let query = supabase
        .from('scorecards')
        .select('*, campaigns(*)')
        .eq('user_id', user.id)
        .gte('date', thirtyDaysAgo)
        .order('date', { ascending: false });
      
      if (selectedCampaign !== 'all') {
        query = query.eq('campaign_id', selectedCampaign);
      }
      
      const { data: scorecardsData } = await query;
      
      if (scorecardsData) {
        setScorecards(scorecardsData as unknown as ScorecardWithCampaign[]);
      }
      
      // Fetch targets
      const { data: targetsData } = await supabase
        .from('targets')
        .select('*')
        .eq('role', 'sales_rep');
      
      if (targetsData) {
        setTargets(targetsData as Target[]);
      }
      
      setIsLoading(false);
    };
    
    fetchData();
  }, [user, selectedCampaign]);

  const getTargetForDate = (campaignId: string, date: string): Target | undefined => {
    return targets.find(t => 
      t.campaign_id === campaignId &&
      t.start_date <= date &&
      (!t.end_date || t.end_date >= date)
    );
  };

  if (isLoading) {
    const loader = (
      <div className="flex items-center justify-center h-full py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
    return embedded ? loader : <AppLayout>{loader}</AppLayout>;
  }

  const body = (
    <div className={embedded ? 'space-y-6' : 'p-6 lg:p-8 space-y-6'}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">My History</h1>
            <p className="text-muted-foreground">Last 30 days of scorecards</p>
          </div>
          <Select value={selectedCampaign} onValueChange={setSelectedCampaign}>
            <SelectTrigger className="w-40">
              <SelectValue placeholder="All Campaigns" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Campaigns</SelectItem>
              {campaigns.map(campaign => (
                <SelectItem key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {scorecards.length === 0 ? (
          <div className="rounded-xl border border-border bg-card p-12 text-center">
            <p className="text-muted-foreground">No scorecards found for the selected period.</p>
          </div>
        ) : (
          <div className="rounded-xl border border-border overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead>Date</TableHead>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Conversations</TableHead>
                  <TableHead className="text-right">Follow-ups</TableHead>
                  <TableHead className="text-right">Paid Regs</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-center">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {scorecards.map(scorecard => {
                  const target = getTargetForDate(scorecard.campaign_id, scorecard.date);
                  const status = target
                    ? calculateRAGStatus(
                        scorecard.conversations_started,
                        target.conversations_target,
                        scorecard.paid_registrations,
                        target.paid_registrations_target
                      )
                    : 'amber';
                  
                  return (
                    <TableRow key={scorecard.id}>
                      <TableCell className="font-medium">
                        {format(new Date(scorecard.date), 'MMM d, yyyy')}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <span 
                            className="h-2 w-2 rounded-full" 
                            style={{ backgroundColor: scorecard.campaigns?.color }}
                          />
                          {scorecard.campaigns?.name}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {scorecard.conversations_started}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {scorecard.follow_ups_sent}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {scorecard.paid_registrations}
                      </TableCell>
                      <TableCell className="text-right font-mono">
                        {scorecard.revenue_collected 
                          ? `R${scorecard.revenue_collected.toLocaleString()}` 
                          : '-'}
                      </TableCell>
                      <TableCell className="text-center">
                        <RAGStatusBadge status={status} showLabel />
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
    </div>
  );
  return embedded ? body : <AppLayout>{body}</AppLayout>;
}
