import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase, LayoutDashboard, Loader2 } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';

interface Client { id: string; name: string; industry: string | null; revenue_model: string; }

export default function MyClientsPage() {
  const { user } = useAuth();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      if (!user) return;
      const { data: assigns } = await supabase
        .from('rep_client_assignments')
        .select('client_id')
        .eq('rep_id', user.id)
        .eq('is_active', true);
      const ids = (assigns ?? []).map(a => a.client_id);
      let list: Client[] = [];
      if (ids.length) {
        const { data } = await supabase
          .from('clients')
          .select('id,name,industry,revenue_model')
          .in('id', ids)
          .eq('is_active', true)
          .order('name');
        list = (data as any) ?? [];
      } else {
        const { data } = await supabase
          .from('clients')
          .select('id,name,industry,revenue_model')
          .eq('is_active', true)
          .order('name');
        list = (data as any) ?? [];
      }
      setClients(list);
      setLoading(false);
    })();
  }, [user]);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2"><Briefcase className="h-7 w-7 text-primary" />My Clients</h1>
          <p className="text-muted-foreground text-sm mt-1">Open a client to log contacted leads, notes, and outreach activity.</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : clients.length === 0 ? (
          <Card><CardContent className="p-10 text-center text-muted-foreground">No clients assigned yet. Ask your admin to assign you to a client.</CardContent></Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {clients.map(c => (
              <Card key={c.id} className="hover:border-primary/50 transition">
                <CardHeader className="pb-2">
                  <CardTitle className="text-lg">{c.name}</CardTitle>
                  <p className="text-xs text-muted-foreground">{c.industry || 'No industry'} · {c.revenue_model}</p>
                </CardHeader>
                <CardContent>
                  <Link to={`/clients/${c.id}/dashboard`}>
                    <Button className="w-full" size="sm"><LayoutDashboard className="h-4 w-4 mr-2" />Open Dashboard</Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}