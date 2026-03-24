import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { StatCard } from '@/components/ui/stat-card';
import { Loader2, MessageSquare, Clock, AlertTriangle, ArrowRight, Phone, Send, CheckCircle } from 'lucide-react';
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
