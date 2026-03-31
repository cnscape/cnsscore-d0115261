import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Loader2, Calendar, Phone, CheckCircle2, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface SalespersonCalendar {
  id: string;
  user_id: string;
  calendar_name: string;
  calendar_link: string;
}

interface Booking {
  id: string;
  lead_name: string;
  lead_email: string | null;
  lead_contact: string | null;
  salesperson_id: string;
  status: string;
  show_up: boolean;
  closed: boolean;
  booked_at: string;
  calendar_id: string;
}

export default function ScoutBookingPage() {
  const { user } = useAuth();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBooking, setShowBooking] = useState(false);
  const [assignedCalendar, setAssignedCalendar] = useState<SalespersonCalendar | null>(null);
  const [assignedSalesperson, setAssignedSalesperson] = useState<string>('');
  const [leadName, setLeadName] = useState('');
  const [leadEmail, setLeadEmail] = useState('');
  const [leadContact, setLeadContact] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCalendly, setShowCalendly] = useState(false);
  const [dailyCount, setDailyCount] = useState(0);
  const [dailyLimit, setDailyLimit] = useState(6);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);

    const { data: bookingsData } = await (supabase as any)
      .from('scout_bookings')
      .select('*')
      .eq('scout_id', user.id)
      .order('created_at', { ascending: false });
    if (bookingsData) setBookings(bookingsData as Booking[]);

    const today = new Date().toISOString().split('T')[0];
    const { count } = await (supabase as any)
      .from('scout_bookings')
      .select('*', { count: 'exact', head: true })
      .eq('scout_id', user.id)
      .gte('booked_at', today + 'T00:00:00')
      .lte('booked_at', today + 'T23:59:59');
    setDailyCount(count || 0);

    const { data: limitData } = await (supabase as any)
      .from('scout_limits')
      .select('daily_limit')
      .eq('scout_id', user.id)
      .single();
    if (limitData) setDailyLimit(limitData.daily_limit);

    setIsLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleStartBooking = async () => {
    if (dailyCount >= dailyLimit) {
      toast.error(`Daily booking limit reached (${dailyLimit}). Try again tomorrow.`);
      return;
    }
    const { data: nextSp } = await (supabase as any).rpc('get_next_salesperson');
    if (!nextSp) {
      toast.error('No salesperson available. Contact admin.');
      return;
    }

    const { data: calData } = await (supabase as any)
      .from('salesperson_calendars')
      .select('*')
      .eq('user_id', nextSp)
      .eq('is_active', true)
      .single();
    if (!calData) {
      toast.error('No calendar configured for assigned salesperson.');
      return;
    }

    const { data: profileData } = await supabase
      .from('profiles')
      .select('full_name')
      .eq('user_id', nextSp)
      .single();

    setAssignedCalendar(calData as SalespersonCalendar);
    setAssignedSalesperson(profileData?.full_name || 'Salesperson');
    setShowBooking(true);
  };

  const handleConfirmAndBook = async () => {
    if (!leadName.trim()) { toast.error('Lead name is required'); return; }
    if (!user || !assignedCalendar) return;
    setShowCalendly(true);
  };

  const handleBookingComplete = async () => {
    if (!user || !assignedCalendar) return;
    setIsSubmitting(true);

    const { error } = await (supabase as any).from('scout_bookings').insert([{
      scout_id: user.id,
      salesperson_id: assignedCalendar.user_id,
      calendar_id: assignedCalendar.id,
      lead_name: leadName.trim(),
      lead_email: leadEmail.trim() || null,
      lead_contact: leadContact.trim() || null,
      status: 'booked',
    }]);

    setIsSubmitting(false);
    if (error) { toast.error('Failed to log booking: ' + error.message); return; }
    toast.success('Booking logged! 🎯');
    setShowBooking(false);
    setShowCalendly(false);
    setLeadName(''); setLeadEmail(''); setLeadContact('');
    setAssignedCalendar(null);
    fetchData();
  };

  const statusConfig: Record<string, { color: string; icon: typeof CheckCircle2 }> = {
    booked: { color: 'bg-accent/20 text-accent-foreground', icon: Calendar },
    showed_up: { color: 'bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))]', icon: CheckCircle2 },
    no_show: { color: 'bg-destructive/20 text-destructive', icon: XCircle },
    closed_won: { color: 'bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))]', icon: CheckCircle2 },
    closed_lost: { color: 'bg-destructive/20 text-destructive', icon: XCircle },
    rescheduled: { color: 'bg-secondary/20 text-secondary-foreground', icon: Clock },
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">Book a Call</h1>
            <p className="text-muted-foreground">Book discovery calls for the sales team</p>
          </div>
          <Button onClick={handleStartBooking} size="lg" disabled={dailyCount >= dailyLimit}>
            <Phone className="h-4 w-4 mr-2" /> Book Call
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-4">
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Today's Bookings</p>
            <p className="text-2xl font-bold">{dailyCount} <span className="text-sm text-muted-foreground font-normal">/ {dailyLimit}</span></p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Total Bookings</p>
            <p className="text-2xl font-bold">{bookings.length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Show-ups</p>
            <p className="text-2xl font-bold text-[hsl(var(--status-green))]">{bookings.filter(b => b.show_up).length}</p>
          </CardContent></Card>
          <Card><CardContent className="p-4">
            <p className="text-xs text-muted-foreground">Closed Deals</p>
            <p className="text-2xl font-bold text-primary">{bookings.filter(b => b.closed).length}</p>
          </CardContent></Card>
        </div>

        <Dialog open={showBooking} onOpenChange={(o) => { if (!o) { setShowBooking(false); setShowCalendly(false); } }}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{showCalendly ? 'Book on Calendar' : 'New Booking'}</DialogTitle>
            </DialogHeader>

            {!showCalendly ? (
              <div className="space-y-4 pt-4">
                {assignedCalendar && (
                  <Card className="border-primary/30 bg-primary/5">
                    <CardContent className="p-4">
                      <p className="text-sm text-muted-foreground">Auto-assigned salesperson</p>
                      <p className="text-lg font-semibold">{assignedSalesperson}</p>
                      <p className="text-sm text-muted-foreground mt-1">{assignedCalendar.calendar_name}</p>
                    </CardContent>
                  </Card>
                )}
                <div className="space-y-2">
                  <Label>Lead Name <span className="text-destructive">*</span></Label>
                  <Input value={leadName} onChange={e => setLeadName(e.target.value)} placeholder="Full name" />
                </div>
                <div className="space-y-2">
                  <Label>Lead Email</Label>
                  <Input type="email" value={leadEmail} onChange={e => setLeadEmail(e.target.value)} placeholder="email@example.com" />
                </div>
                <div className="space-y-2">
                  <Label>Lead Contact (Phone/WhatsApp)</Label>
                  <Input value={leadContact} onChange={e => setLeadContact(e.target.value)} placeholder="+27..." />
                </div>
                <Button onClick={handleConfirmAndBook} className="w-full">
                  Continue to Calendar →
                </Button>
              </div>
            ) : (
              <div className="space-y-4 pt-4">
                <p className="text-sm text-muted-foreground">
                  Book the call below for <strong>{leadName}</strong> with <strong>{assignedSalesperson}</strong>
                </p>
                {assignedCalendar && (
                  <div className="w-full rounded-lg overflow-hidden border border-border" style={{ minHeight: '600px' }}>
                    <iframe
                      src={assignedCalendar.calendar_link}
                      width="100%"
                      height="600"
                      frameBorder="0"
                      title="Calendly Booking"
                      className="w-full"
                    />
                  </div>
                )}
                <Button onClick={handleBookingComplete} className="w-full" disabled={isSubmitting}>
                  {isSubmitting ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</> : '✅ I\'ve Booked the Call'}
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Card>
          <CardHeader><CardTitle>My Bookings</CardTitle></CardHeader>
          <CardContent>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Lead</TableHead>
                    <TableHead>Contact</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Show Up</TableHead>
                    <TableHead className="text-center">Closed</TableHead>
                    <TableHead>Booked</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map(b => {
                    const sc = statusConfig[b.status] || statusConfig.booked;
                    return (
                      <TableRow key={b.id}>
                        <TableCell className="font-medium">{b.lead_name}</TableCell>
                        <TableCell className="text-muted-foreground text-sm">{b.lead_email || b.lead_contact || '—'}</TableCell>
                        <TableCell className="text-center">
                          <Badge className={sc.color} variant="outline">{b.status.replace('_', ' ')}</Badge>
                        </TableCell>
                        <TableCell className="text-center">
                          {b.show_up ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))] mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </TableCell>
                        <TableCell className="text-center">
                          {b.closed ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))] mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                        </TableCell>
                        <TableCell className="text-muted-foreground text-sm">{format(new Date(b.booked_at), 'dd MMM HH:mm')}</TableCell>
                      </TableRow>
                    );
                  })}
                  {bookings.length === 0 && (
                    <TableRow><TableCell colSpan={6} className="text-center py-8 text-muted-foreground">No bookings yet. Click "Book Call" to get started!</TableCell></TableRow>
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
