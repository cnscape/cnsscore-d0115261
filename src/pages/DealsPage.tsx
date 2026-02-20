import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Plus, Loader2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Deal {
  id: string;
  client_id: string;
  offer_id: string;
  rep_id: string;
  status: string;
  channel: string;
  campaign: string | null;
  revenue: number;
  gross_revenue: number;
  client_share: number;
  cape_neto_share: number;
  rep_commission: number;
  lead_name: string | null;
  lead_contact: string | null;
  notes: string | null;
  lost_reason: string | null;
  created_at: string;
  clients?: { name: string };
  offers?: { name: string; ticket_size: number };
}

interface Client {
  id: string;
  name: string;
  revenue_share_percent: number;
}

interface Offer {
  id: string;
  client_id: string;
  name: string;
  ticket_size: number;
  default_commission_percent: number;
}

export default function DealsPage({ adminView = false }: { adminView?: boolean }) {
  const { user } = useAuth();
  const [deals, setDeals] = useState<Deal[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDeal, setShowAddDeal] = useState(false);
  const [filterClient, setFilterClient] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');

  // Form
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedOfferId, setSelectedOfferId] = useState('');
  const [channel, setChannel] = useState('organic');
  const [leadName, setLeadName] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [dealNotes, setDealNotes] = useState('');

  const fetchData = async () => {
    setIsLoading(true);

    const [clientsRes, offersRes] = await Promise.all([
      supabase.from('clients').select('id, name, revenue_share_percent').eq('is_active', true),
      supabase.from('offers').select('id, client_id, name, ticket_size, default_commission_percent').eq('is_active', true),
    ]);

    if (clientsRes.data) setClients(clientsRes.data as Client[]);
    if (offersRes.data) setOffers(offersRes.data as Offer[]);

    let dealsQuery = supabase
      .from('deals')
      .select('*, clients(name), offers(name, ticket_size)')
      .order('created_at', { ascending: false });

    if (!adminView && user) {
      dealsQuery = dealsQuery.eq('rep_id', user.id);
    }

    const { data: dealsData } = await dealsQuery;
    if (dealsData) setDeals(dealsData as Deal[]);

    setIsLoading(false);
  };

  useEffect(() => { fetchData(); }, [user, adminView]);

  const filteredDeals = deals.filter(d => {
    if (filterClient !== 'all' && d.client_id !== filterClient) return false;
    if (filterStatus !== 'all' && d.status !== filterStatus) return false;
    return true;
  });

  const handleAddDeal = async () => {
    if (!user || !selectedClientId || !selectedOfferId) return;

    const client = clients.find(c => c.id === selectedClientId);
    const offer = offers.find(o => o.id === selectedOfferId);
    if (!client || !offer) return;

    const grossRevenue = offer.ticket_size;
    const capeNetoShare = grossRevenue * (client.revenue_share_percent / 100);
    const clientShare = grossRevenue - capeNetoShare;
    const repCommission = capeNetoShare * (offer.default_commission_percent / 100);

    const { error } = await supabase.from('deals').insert([{
      client_id: selectedClientId,
      offer_id: selectedOfferId,
      rep_id: user.id,
      channel: channel as 'organic' | 'paid' | 'dream_100' | 'event' | 'affiliate' | 'referral' | 'other',
      lead_name: leadName || null,
      lead_contact: leadContact || null,
      notes: dealNotes || null,
      revenue: grossRevenue,
      gross_revenue: grossRevenue,
      client_share: clientShare,
      cape_neto_share: capeNetoShare,
      rep_commission: repCommission,
    }]);

    if (error) {
      toast.error('Failed to create deal');
      return;
    }

    toast.success('Deal created!');
    setShowAddDeal(false);
    resetForm();
    fetchData();
  };

  const resetForm = () => {
    setSelectedClientId('');
    setSelectedOfferId('');
    setChannel('organic');
    setLeadName('');
    setLeadContact('');
    setDealNotes('');
  };

  const statusColors: Record<string, string> = {
    open: 'bg-accent/20 text-accent-foreground',
    won: 'bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))]',
    lost: 'bg-destructive/20 text-destructive',
    stalled: 'bg-secondary/20 text-secondary',
  };

  const clientOffers = offers.filter(o => o.client_id === selectedClientId);

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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{adminView ? 'All Deals' : 'My Deals'}</h1>
            <p className="text-muted-foreground">
              {adminView ? 'Overview of all deals across reps' : 'Track and manage your deals'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <Select value={filterClient} onValueChange={setFilterClient}>
              <SelectTrigger className="w-36"><SelectValue placeholder="All Clients" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Clients</SelectItem>
                {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-32"><SelectValue placeholder="All Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="open">Open</SelectItem>
                <SelectItem value="won">Won</SelectItem>
                <SelectItem value="lost">Lost</SelectItem>
                <SelectItem value="stalled">Stalled</SelectItem>
              </SelectContent>
            </Select>
            {!adminView && (
              <Dialog open={showAddDeal} onOpenChange={setShowAddDeal}>
                <DialogTrigger asChild>
                  <Button><Plus className="h-4 w-4 mr-2" /> New Deal</Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Create New Deal</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Client</Label>
                      <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue placeholder="Select client" /></SelectTrigger>
                        <SelectContent>
                          {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    {selectedClientId && (
                      <div className="space-y-2">
                        <Label>Offer</Label>
                        <Select value={selectedOfferId} onValueChange={setSelectedOfferId}>
                          <SelectTrigger><SelectValue placeholder="Select offer" /></SelectTrigger>
                          <SelectContent>
                            {clientOffers.map(o => (
                              <SelectItem key={o.id} value={o.id}>{o.name} — R{o.ticket_size.toLocaleString()}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                    <div className="space-y-2">
                      <Label>Channel</Label>
                      <Select value={channel} onValueChange={setChannel}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="organic">Organic</SelectItem>
                          <SelectItem value="paid">Paid</SelectItem>
                          <SelectItem value="dream_100">Dream 100</SelectItem>
                          <SelectItem value="event">Event</SelectItem>
                          <SelectItem value="affiliate">Affiliate</SelectItem>
                          <SelectItem value="referral">Referral</SelectItem>
                          <SelectItem value="other">Other</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-2">
                        <Label>Lead Name</Label>
                        <Input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Contact name" />
                      </div>
                      <div className="space-y-2">
                        <Label>Lead Contact</Label>
                        <Input value={leadContact} onChange={e => setLeadContact(e.target.value)} placeholder="Email/phone" />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>Notes</Label>
                      <Textarea value={dealNotes} onChange={e => setDealNotes(e.target.value)} placeholder="Deal notes..." />
                    </div>
                    <Button onClick={handleAddDeal} className="w-full" disabled={!selectedClientId || !selectedOfferId}>
                      Create Deal
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Deals</p>
              <p className="text-2xl font-bold">{filteredDeals.length}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Revenue</p>
              <p className="text-2xl font-bold text-primary">
                R{filteredDeals.filter(d => d.status === 'won').reduce((s, d) => s + (d.gross_revenue || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">CNS Share</p>
              <p className="text-2xl font-bold">
                R{filteredDeals.filter(d => d.status === 'won').reduce((s, d) => s + (d.cape_neto_share || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">My Commission</p>
              <p className="text-2xl font-bold text-primary">
                R{filteredDeals.filter(d => d.status === 'won').reduce((s, d) => s + (d.rep_commission || 0), 0).toLocaleString()}
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Deals table */}
        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Lead</TableHead>
                <TableHead>Client</TableHead>
                <TableHead>Offer</TableHead>
                <TableHead>Channel</TableHead>
                <TableHead className="text-center">Status</TableHead>
                <TableHead className="text-right">Revenue</TableHead>
                <TableHead className="text-right">Commission</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredDeals.map(deal => (
                <TableRow key={deal.id}>
                  <TableCell className="font-medium">{deal.lead_name || '—'}</TableCell>
                  <TableCell>{deal.clients?.name || '—'}</TableCell>
                  <TableCell>{deal.offers?.name || '—'}</TableCell>
                  <TableCell className="capitalize">{deal.channel?.replace('_', ' ')}</TableCell>
                  <TableCell className="text-center">
                    <Badge className={statusColors[deal.status] || ''} variant="outline">
                      {deal.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right font-mono">R{(deal.gross_revenue || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-right font-mono text-primary">R{(deal.rep_commission || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-muted-foreground text-sm">
                    {format(new Date(deal.created_at), 'dd MMM')}
                  </TableCell>
                </TableRow>
              ))}
              {filteredDeals.length === 0 && (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-30" />
                    No deals found
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
