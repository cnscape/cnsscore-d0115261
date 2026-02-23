import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Loader2, Send, CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';

interface DailyUpdate {
  id: string;
  user_id: string;
  date: string;
  did_today: string;
  doing_next: string;
  blockers: string;
  links: string;
  status: string;
  admin_comment: string | null;
  created_at: string;
}

export default function DailyUpdatePage() {
  const { user } = useAuth();
  const [existingUpdate, setExistingUpdate] = useState<DailyUpdate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [didToday, setDidToday] = useState('');
  const [doingNext, setDoingNext] = useState('');
  const [blockers, setBlockers] = useState('');
  const [links, setLinks] = useState('');
  const [status, setStatus] = useState('on_track');

  const today = format(new Date(), 'yyyy-MM-dd');

  useEffect(() => {
    if (!user) return;
    const fetchExisting = async () => {
      setIsLoading(true);
      try {
        const { data } = await (supabase as any)
          .from('daily_updates')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();

        if (data) {
          const update = data as DailyUpdate;
          setExistingUpdate(update);
          setDidToday(update.did_today);
          setDoingNext(update.doing_next || '');
          setBlockers(update.blockers || '');
          setLinks(update.links || '');
          setStatus(update.status);
        }
      } catch (e) {
        // Table may not exist yet
      }
      setIsLoading(false);
    };
    fetchExisting();
  }, [user, today]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !didToday.trim()) {
      toast.error('Please fill in what you did today');
      return;
    }

    setIsSubmitting(true);

    const updateData = {
      user_id: user.id,
      date: today,
      did_today: didToday.trim(),
      doing_next: doingNext.trim(),
      blockers: blockers.trim(),
      links: links.trim(),
      status,
    };

    try {
      let error;
      if (existingUpdate) {
        const result = await (supabase as any)
          .from('daily_updates')
          .update(updateData)
          .eq('id', existingUpdate.id);
        error = result.error;
      } else {
        const result = await (supabase as any)
          .from('daily_updates')
          .insert(updateData);
        error = result.error;
      }

      if (error) {
        toast.error('Failed to save: ' + error.message);
      } else {
        toast.success(existingUpdate ? 'Update saved! ✅' : 'Daily update submitted! 🎯');
        const { data } = await (supabase as any)
          .from('daily_updates')
          .select('*')
          .eq('user_id', user.id)
          .eq('date', today)
          .maybeSingle();
        if (data) setExistingUpdate(data as DailyUpdate);
      }
    } catch (e) {
      toast.error('Daily updates table not available yet. Please contact admin.');
    }

    setIsSubmitting(false);
  };

  const statusOptions = [
    { value: 'on_track', label: 'On Track', icon: CheckCircle, color: 'text-[hsl(var(--status-green))]' },
    { value: 'at_risk', label: 'At Risk', icon: AlertTriangle, color: 'text-secondary' },
    { value: 'blocked', label: 'Blocked', icon: XCircle, color: 'text-destructive' },
  ];

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
          <h1 className="text-3xl font-bold mb-2">Daily Update</h1>
          <p className="text-muted-foreground">{format(new Date(), 'EEEE, MMMM d, yyyy')}</p>
          {existingUpdate && (
            <Badge variant="outline" className="mt-2 text-xs">Already submitted • Editing</Badge>
          )}
        </div>

        <Card className="border-border">
          <CardContent className="pt-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label>Status</Label>
                <div className="flex gap-2">
                  {statusOptions.map(opt => {
                    const Icon = opt.icon;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        onClick={() => setStatus(opt.value)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                          status === opt.value
                            ? 'border-primary bg-primary/10'
                            : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                        }`}
                      >
                        <Icon className={`h-4 w-4 ${opt.color}`} />
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <Label>What I did today <span className="text-destructive">*</span></Label>
                <Textarea value={didToday} onChange={(e) => setDidToday(e.target.value)} placeholder="List your key accomplishments..." rows={4} />
              </div>

              <div className="space-y-2">
                <Label>What I'm doing next</Label>
                <Textarea value={doingNext} onChange={(e) => setDoingNext(e.target.value)} placeholder="What's on your plate for tomorrow..." rows={3} />
              </div>

              <div className="space-y-2">
                <Label>Blockers</Label>
                <Textarea value={blockers} onChange={(e) => setBlockers(e.target.value)} placeholder="Anything blocking your progress?" rows={2} />
              </div>

              <div className="space-y-2">
                <Label>Links / References</Label>
                <Textarea value={links} onChange={(e) => setLinks(e.target.value)} placeholder="Paste any relevant links..." rows={2} />
              </div>

              {existingUpdate?.admin_comment && (
                <div className="rounded-lg border border-primary/30 bg-primary/5 p-4">
                  <p className="text-xs font-medium text-primary mb-1">Admin Response</p>
                  <p className="text-sm">{existingUpdate.admin_comment}</p>
                </div>
              )}

              <Button type="submit" className="w-full" size="lg" disabled={isSubmitting}>
                {isSubmitting ? (
                  <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
                ) : (
                  <><Send className="mr-2 h-4 w-4" /> {existingUpdate ? 'Update' : 'Submit'} Daily Update</>
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
