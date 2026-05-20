import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Copy, Sparkles, RefreshCw, Check } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Lead {
  id: string;
  lead_name: string;
  platform?: string | null;
  angle?: string | null;
  notes?: string | null;
  lead_socials?: string | null;
  loom_link?: string | null;
  lead_email?: string | null;
  lead_contact?: string | null;
}

interface Scripts {
  stage1: string;
  stage2: string;
  stage3: string;
}

export function LeadScriptsDialog({ lead, open, onOpenChange }: {
  lead: Lead | null;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const [scripts, setScripts] = useState<Scripts | null>(null);
  const [loading, setLoading] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const generate = async () => {
    if (!lead) return;
    setLoading(true);
    setScripts(null);
    try {
      const { data, error } = await supabase.functions.invoke('lead-script-generator', {
        body: { lead_id: lead.id },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      setScripts({
        stage1: (data as any).stage1,
        stage2: (data as any).stage2,
        stage3: (data as any).stage3,
      });
    } catch (e: any) {
      toast.error(e?.message || 'Failed to generate scripts');
    } finally {
      setLoading(false);
    }
  };

  const copyText = async (text: string, key: string) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    toast.success('Copied to clipboard');
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { onOpenChange(v); if (!v) setScripts(null); }}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            CNS Outbound Scripts — {lead?.lead_name}
          </DialogTitle>
        </DialogHeader>

        {lead && (
          <Card className="bg-muted/30 border-border">
            <CardContent className="p-4 space-y-1 text-sm">
              <div className="flex items-center gap-2 flex-wrap">
                <Badge variant="outline">{lead.platform || '—'}</Badge>
                {lead.lead_socials && (
                  <a href={lead.lead_socials} target="_blank" rel="noreferrer" className="text-xs text-primary hover:underline">
                    {lead.lead_socials}
                  </a>
                )}
              </div>
              <p><span className="text-muted-foreground">Pain Angle:</span> <span className="font-medium">{lead.angle || '—'}</span></p>
              {lead.notes && <p className="text-muted-foreground text-xs">Notes: {lead.notes}</p>}
              {lead.loom_link && (
                <p className="text-xs">
                  <span className="text-muted-foreground">Loom:</span>{' '}
                  <a href={lead.loom_link} target="_blank" rel="noreferrer" className="text-primary hover:underline">{lead.loom_link}</a>
                </p>
              )}
            </CardContent>
          </Card>
        )}

        {!scripts && !loading && (
          <Button onClick={generate} className="w-full">
            <Sparkles className="h-4 w-4 mr-2" /> Generate CNS Scripts
          </Button>
        )}

        {loading && (
          <div className="flex flex-col items-center justify-center py-10 gap-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Generating CNS framework messages…</p>
          </div>
        )}

        {scripts && (
          <div className="space-y-4">
            {[
              { key: 'stage1', title: 'Stage 1 — Pattern Interrupt (DM)', body: scripts.stage1, hint: 'Send via Instagram / LinkedIn DM' },
              { key: 'stage2', title: 'Stage 2 — Vibe Window (After Loom Watched)', body: scripts.stage2, hint: 'Reply only after they say YES + watch Loom' },
              { key: 'stage3', title: 'Stage 3 — Call Booking Script', body: scripts.stage3, hint: 'Position Closer as Senior Growth Strategist' },
            ].map(s => (
              <Card key={s.key}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <CardTitle className="text-sm">{s.title}</CardTitle>
                      <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
                    </div>
                    <Button size="sm" variant="outline" onClick={() => copyText(s.body, s.key)}>
                      {copied === s.key ? <Check className="h-3 w-3 mr-1" /> : <Copy className="h-3 w-3 mr-1" />}
                      {copied === s.key ? 'Copied' : 'Copy'}
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  <p className="text-sm whitespace-pre-line leading-relaxed">{s.body}</p>
                </CardContent>
              </Card>
            ))}
            <Button variant="ghost" onClick={generate} className="w-full">
              <RefreshCw className="h-4 w-4 mr-2" /> Regenerate
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}