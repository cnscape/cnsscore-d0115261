import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Plus, Briefcase, Loader2, Pencil } from 'lucide-react';
import { toast } from 'sonner';

interface Client {
  id: string;
  name: string;
  industry: string | null;
  start_date: string;
  revenue_model: string;
  revenue_share_percent: number;
  flat_commission_amount: number;
  is_active: boolean;
  notes: string | null;
  created_at: string;
}

interface Offer {
  id: string;
  client_id: string;
  name: string;
  ticket_size: number;
  default_commission_percent: number;
  campaign_source: string | null;
  is_active: boolean;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddClient, setShowAddClient] = useState(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [showAddOffer, setShowAddOffer] = useState(false);

  // Form state
  const [clientName, setClientName] = useState('');
  const [clientIndustry, setClientIndustry] = useState('');
  const [revenueModel, setRevenueModel] = useState('revenue_share');
  const [revenueSharePercent, setRevenueSharePercent] = useState(30);
  const [flatCommission, setFlatCommission] = useState(0);

  // Offer form state
  const [offerName, setOfferName] = useState('');
  const [ticketSize, setTicketSize] = useState(0);
  const [offerCommission, setOfferCommission] = useState(10);

  const fetchClients = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('clients').select('*').order('created_at', { ascending: false });
    if (data) setClients(data as Client[]);
    setIsLoading(false);
  };

  const fetchOffers = async (clientId: string) => {
    const { data } = await supabase.from('offers').select('*').eq('client_id', clientId);
    if (data) setOffers(data as Offer[]);
  };

  useEffect(() => { fetchClients(); }, []);

  useEffect(() => {
    if (selectedClient) fetchOffers(selectedClient.id);
  }, [selectedClient]);

  const handleAddClient = async () => {
    const { error } = await supabase.from('clients').insert([{
      name: clientName,
      industry: clientIndustry || null,
      revenue_model: revenueModel as 'revenue_share' | 'flat_commission' | 'tiered' | 'hybrid',
      revenue_share_percent: revenueSharePercent,
      flat_commission_amount: flatCommission,
    }]);

    if (error) {
      toast.error('Failed to add client');
      return;
    }

    toast.success('Client added!');
    setShowAddClient(false);
    setClientName('');
    setClientIndustry('');
    fetchClients();
  };

  const handleAddOffer = async () => {
    if (!selectedClient) return;

    const { error } = await supabase.from('offers').insert([{
      client_id: selectedClient.id,
      name: offerName,
      ticket_size: ticketSize,
      default_commission_percent: offerCommission,
    }]);

    if (error) {
      toast.error('Failed to add offer');
      return;
    }

    toast.success('Offer added!');
    setShowAddOffer(false);
    setOfferName('');
    setTicketSize(0);
    fetchOffers(selectedClient.id);
  };

  const revenueModelLabels: Record<string, string> = {
    revenue_share: 'Revenue Share',
    flat_commission: 'Flat Commission',
    tiered: 'Tiered',
    hybrid: 'Hybrid',
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
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Clients</h1>
            <p className="text-muted-foreground">Manage your client portfolio and revenue models</p>
          </div>
          <Dialog open={showAddClient} onOpenChange={setShowAddClient}>
            <DialogTrigger asChild>
              <Button><Plus className="h-4 w-4 mr-2" /> Add Client</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add New Client</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-4">
                <div className="space-y-2">
                  <Label>Client Name</Label>
                  <Input value={clientName} onChange={e => setClientName(e.target.value)} placeholder="e.g. Acme Corp" />
                </div>
                <div className="space-y-2">
                  <Label>Industry</Label>
                  <Input value={clientIndustry} onChange={e => setClientIndustry(e.target.value)} placeholder="e.g. SaaS, E-commerce" />
                </div>
                <div className="space-y-2">
                  <Label>Revenue Model</Label>
                  <Select value={revenueModel} onValueChange={setRevenueModel}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="revenue_share">Revenue Share %</SelectItem>
                      <SelectItem value="flat_commission">Flat Commission</SelectItem>
                      <SelectItem value="tiered">Tiered</SelectItem>
                      <SelectItem value="hybrid">Hybrid</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {(revenueModel === 'revenue_share' || revenueModel === 'hybrid') && (
                  <div className="space-y-2">
                    <Label>Revenue Share % (Cape Neto)</Label>
                    <Input type="number" value={revenueSharePercent} onChange={e => setRevenueSharePercent(Number(e.target.value))} />
                  </div>
                )}
                {(revenueModel === 'flat_commission' || revenueModel === 'hybrid') && (
                  <div className="space-y-2">
                    <Label>Flat Commission Amount (ZAR)</Label>
                    <Input type="number" value={flatCommission} onChange={e => setFlatCommission(Number(e.target.value))} />
                  </div>
                )}
                <Button onClick={handleAddClient} className="w-full" disabled={!clientName}>Add Client</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {/* Client List */}
          <div className="lg:col-span-1 space-y-3">
            {clients.map(client => (
              <Card
                key={client.id}
                className={`cursor-pointer card-hover ${selectedClient?.id === client.id ? 'border-primary' : ''}`}
                onClick={() => setSelectedClient(client)}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <Briefcase className="h-5 w-5" />
                      </div>
                      <div>
                        <p className="font-semibold">{client.name}</p>
                        <p className="text-xs text-muted-foreground">{client.industry || 'No industry'}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {revenueModelLabels[client.revenue_model] || client.revenue_model}
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
            {clients.length === 0 && (
              <Card>
                <CardContent className="p-8 text-center text-muted-foreground">
                  No clients yet. Add your first client to get started.
                </CardContent>
              </Card>
            )}
          </div>

          {/* Client Detail */}
          <div className="lg:col-span-2">
            {selectedClient ? (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle>{selectedClient.name}</CardTitle>
                      <Badge>{selectedClient.is_active ? 'Active' : 'Inactive'}</Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <p className="text-xs text-muted-foreground">Revenue Model</p>
                        <p className="font-medium">{revenueModelLabels[selectedClient.revenue_model]}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Cape Neto Share</p>
                        <p className="font-medium text-primary">{selectedClient.revenue_share_percent}%</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Industry</p>
                        <p className="font-medium">{selectedClient.industry || '—'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">Start Date</p>
                        <p className="font-medium">{selectedClient.start_date}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Offers */}
                <Card>
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">Offers</CardTitle>
                      <Dialog open={showAddOffer} onOpenChange={setShowAddOffer}>
                        <DialogTrigger asChild>
                          <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Add Offer</Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Add Offer to {selectedClient.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 pt-4">
                            <div className="space-y-2">
                              <Label>Offer Name</Label>
                              <Input value={offerName} onChange={e => setOfferName(e.target.value)} placeholder="e.g. Premium Package" />
                            </div>
                            <div className="space-y-2">
                              <Label>Ticket Size (ZAR)</Label>
                              <Input type="number" value={ticketSize} onChange={e => setTicketSize(Number(e.target.value))} />
                            </div>
                            <div className="space-y-2">
                              <Label>Default Commission %</Label>
                              <Input type="number" value={offerCommission} onChange={e => setOfferCommission(Number(e.target.value))} />
                            </div>
                            <Button onClick={handleAddOffer} className="w-full" disabled={!offerName}>Add Offer</Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </CardHeader>
                  <CardContent>
                    {offers.length > 0 ? (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Offer</TableHead>
                            <TableHead className="text-right">Ticket Size</TableHead>
                            <TableHead className="text-right">Commission</TableHead>
                            <TableHead className="text-center">Status</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {offers.map(offer => (
                            <TableRow key={offer.id}>
                              <TableCell className="font-medium">{offer.name}</TableCell>
                              <TableCell className="text-right font-mono">R{offer.ticket_size.toLocaleString()}</TableCell>
                              <TableCell className="text-right font-mono">{offer.default_commission_percent}%</TableCell>
                              <TableCell className="text-center">
                                <Badge variant={offer.is_active ? 'default' : 'secondary'}>
                                  {offer.is_active ? 'Active' : 'Inactive'}
                                </Badge>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    ) : (
                      <p className="text-sm text-muted-foreground text-center py-4">No offers yet for this client.</p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="p-12 text-center text-muted-foreground">
                  <Briefcase className="h-12 w-12 mx-auto mb-4 opacity-30" />
                  <p>Select a client to view details and manage offers</p>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </AppLayout>
  );
}
