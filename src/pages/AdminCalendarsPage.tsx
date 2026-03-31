import { useEffect, useState, useCallback } from 'react';
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Loader2, Plus, Calendar, Users, Settings2, Pencil, Trash2, CheckCircle2, XCircle } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Profile { user_id: string; full_name: string; }
interface CalendarEntry { id: string; user_id: string; calendar_name: string; calendar_link: string; is_active: boolean; round_robin_order: number; total_bookings: number; }
interface ScoutLimit { id: string; scout_id: string; daily_limit: number; }
interface Booking {
  id: string; scout_id: string; salesperson_id: string; lead_name: string; lead_email: string | null;
  status: string; show_up: boolean; closed: boolean; scout_percentage: number; salesperson_percentage: number;
  booked_at: string;
}

export default function AdminCalendarsPage() {
  const { isAdmin } = useAuth();
  const [calendars, setCalendars] = useState<CalendarEntry[]>([]);
  const [scoutLimits, setScoutLimits] = useState<ScoutLimit[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Calendar form
  const [showAddCalendar, setShowAddCalendar] = useState(false);
  const [calUserId, setCalUserId] = useState('');
  const [calName, setCalName] = useState('');
  const [calLink, setCalLink] = useState('');
  const [calOrder, setCalOrder] = useState(0);

  // Limit form
  const [showAddLimit, setShowAddLimit] = useState(false);
  const [limitScoutId, setLimitScoutId] = useState('');
  const [limitValue, setLimitValue] = useState(6);

  // Edit booking
  const [editingBooking, setEditingBooking] = useState<Booking | null>(null);
  const [editStatus, setEditStatus] = useState('');
  const [editShowUp, setEditShowUp] = useState(false);
  const [editClosed, setEditClosed] = useState(false);
  const [editScoutPct, setEditScoutPct] = useState(0);
  const [editSpPct, setEditSpPct] = useState(0);

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    const [calsRes, limitsRes, bookingsRes, profilesRes] = await Promise.all([
      supabase.from('salesperson_calendars').select('*').order('round_robin_order'),
      supabase.from('scout_limits').select('*'),
      supabase.from('scout_bookings').select('*').order('created_at', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name'),
    ]);
    if (calsRes.data) setCalendars(calsRes.data as unknown as CalendarEntry[]);
    if (limitsRes.data) setScoutLimits(limitsRes.data as unknown as ScoutLimit[]);
    if (bookingsRes.data) setBookings(bookingsRes.data as unknown as Booking[]);
    if (profilesRes.data) setProfiles(profilesRes.data as Profile[]);
    setIsLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const getName = (userId: string) => profiles.find(p => p.user_id === userId)?.full_name || userId.slice(0, 8);

  const handleAddCalendar = async () => {
    if (!calUserId || !calName.trim() || !calLink.trim()) { toast.error('All fields required'); return; }
    const { error } = await supabase.from('salesperson_calendars').insert([{
      user_id: calUserId, calendar_name: calName.trim(), calendar_link: calLink.trim(), round_robin_order: calOrder,
    }] as any);
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success('Calendar added!');
    setShowAddCalendar(false); setCalUserId(''); setCalName(''); setCalLink(''); setCalOrder(0);
    fetchData();
  };

  const handleToggleCalendar = async (id: string, active: boolean) => {
    await supabase.from('salesperson_calendars').update({ is_active: active } as any).eq('id', id);
    fetchData();
  };

  const handleDeleteCalendar = async (id: string) => {
    await supabase.from('salesperson_calendars').delete().eq('id', id);
    toast.success('Calendar removed');
    fetchData();
  };

  const handleAddLimit = async () => {
    if (!limitScoutId) { toast.error('Select a scout'); return; }
    const { error } = await supabase.from('scout_limits').upsert([{
      scout_id: limitScoutId, daily_limit: limitValue,
    }] as any, { onConflict: 'scout_id' });
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success('Limit set!');
    setShowAddLimit(false); setLimitScoutId(''); setLimitValue(6);
    fetchData();
  };

  const handleUpdateBooking = async () => {
    if (!editingBooking) return;
    const { error } = await supabase.from('scout_bookings').update({
      status: editStatus, show_up: editShowUp, closed: editClosed,
      scout_percentage: editScoutPct, salesperson_percentage: editSpPct,
    } as any).eq('id', editingBooking.id);
    if (error) { toast.error('Failed: ' + error.message); return; }
    toast.success('Booking updated');
    setEditingBooking(null);
    fetchData();
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">Booking System</h1>
          <p className="text-muted-foreground">Manage calendars, scout limits, and booking outcomes</p>
        </div>

        <Tabs defaultValue="calendars">
          <TabsList>
            <TabsTrigger value="calendars"><Calendar className="h-4 w-4 mr-2" />Calendars</TabsTrigger>
            <TabsTrigger value="limits"><Settings2 className="h-4 w-4 mr-2" />Scout Limits</TabsTrigger>
            <TabsTrigger value="bookings"><Users className="h-4 w-4 mr-2" />All Bookings</TabsTrigger>
          </TabsList>

          {/* CALENDARS TAB */}
          <TabsContent value="calendars" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAddCalendar} onOpenChange={setShowAddCalendar}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Add Calendar</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Add Salesperson Calendar</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Salesperson</Label>
                      <Select value={calUserId} onValueChange={setCalUserId}>
                        <SelectTrigger><SelectValue placeholder="Select salesperson" /></SelectTrigger>
                        <SelectContent>
                          {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Calendar Name</Label>
                      <Input value={calName} onChange={e => setCalName(e.target.value)} placeholder="Discovery Core CMS" />
                    </div>
                    <div className="space-y-2">
                      <Label>Calendly Link</Label>
                      <Input value={calLink} onChange={e => setCalLink(e.target.value)} placeholder="https://calendly.com/..." />
                    </div>
                    <div className="space-y-2">
                      <Label>Round Robin Order</Label>
                      <Input type="number" value={calOrder} onChange={e => setCalOrder(Number(e.target.value))} />
                    </div>
                    <Button onClick={handleAddCalendar} className="w-full">Add Calendar</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Salesperson</TableHead>
                    <TableHead>Calendar</TableHead>
                    <TableHead>Link</TableHead>
                    <TableHead className="text-center">Order</TableHead>
                    <TableHead className="text-center">Bookings</TableHead>
                    <TableHead className="text-center">Active</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {calendars.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="font-medium">{getName(c.user_id)}</TableCell>
                      <TableCell>{c.calendar_name}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">{c.calendar_link}</TableCell>
                      <TableCell className="text-center">{c.round_robin_order}</TableCell>
                      <TableCell className="text-center font-mono">{c.total_bookings}</TableCell>
                      <TableCell className="text-center">
                        <Switch checked={c.is_active} onCheckedChange={(v) => handleToggleCalendar(c.id, v)} />
                      </TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => handleDeleteCalendar(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {calendars.length === 0 && <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">No calendars configured yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* SCOUT LIMITS TAB */}
          <TabsContent value="limits" className="space-y-4">
            <div className="flex justify-end">
              <Dialog open={showAddLimit} onOpenChange={setShowAddLimit}>
                <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" />Set Limit</Button></DialogTrigger>
                <DialogContent>
                  <DialogHeader><DialogTitle>Set Scout Daily Limit</DialogTitle></DialogHeader>
                  <div className="space-y-4 pt-4">
                    <div className="space-y-2">
                      <Label>Scout</Label>
                      <Select value={limitScoutId} onValueChange={setLimitScoutId}>
                        <SelectTrigger><SelectValue placeholder="Select scout" /></SelectTrigger>
                        <SelectContent>
                          {profiles.map(p => <SelectItem key={p.user_id} value={p.user_id}>{p.full_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Daily Booking Limit</Label>
                      <Input type="number" value={limitValue} onChange={e => setLimitValue(Number(e.target.value))} min={1} max={50} />
                    </div>
                    <Button onClick={handleAddLimit} className="w-full">Save Limit</Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Scout</TableHead>
                    <TableHead className="text-center">Daily Limit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {scoutLimits.map(l => (
                    <TableRow key={l.id}>
                      <TableCell className="font-medium">{getName(l.scout_id)}</TableCell>
                      <TableCell className="text-center font-mono">{l.daily_limit}</TableCell>
                    </TableRow>
                  ))}
                  {scoutLimits.length === 0 && <TableRow><TableCell colSpan={2} className="text-center py-8 text-muted-foreground">No limits set. Default is 6/day.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          {/* BOOKINGS TAB */}
          <TabsContent value="bookings" className="space-y-4">
            {/* Edit Booking Dialog */}
            <Dialog open={!!editingBooking} onOpenChange={(o) => { if (!o) setEditingBooking(null); }}>
              <DialogContent>
                <DialogHeader><DialogTitle>Edit Booking — {editingBooking?.lead_name}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Status</Label>
                    <Select value={editStatus} onValueChange={setEditStatus}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="booked">Booked</SelectItem>
                        <SelectItem value="showed_up">Showed Up</SelectItem>
                        <SelectItem value="no_show">No Show</SelectItem>
                        <SelectItem value="closed_won">Closed Won</SelectItem>
                        <SelectItem value="closed_lost">Closed Lost</SelectItem>
                        <SelectItem value="rescheduled">Rescheduled</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-4">
                    <Label className="flex items-center gap-2"><Switch checked={editShowUp} onCheckedChange={setEditShowUp} /> Show Up</Label>
                    <Label className="flex items-center gap-2"><Switch checked={editClosed} onCheckedChange={setEditClosed} /> Closed</Label>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Scout %</Label>
                      <Input type="number" value={editScoutPct} onChange={e => setEditScoutPct(Number(e.target.value))} min={0} max={100} />
                    </div>
                    <div className="space-y-2">
                      <Label>Salesperson %</Label>
                      <Input type="number" value={editSpPct} onChange={e => setEditSpPct(Number(e.target.value))} min={0} max={100} />
                    </div>
                  </div>
                  <Button onClick={handleUpdateBooking} className="w-full">Save Changes</Button>
                </div>
              </DialogContent>
            </Dialog>

            <div className="rounded-xl border border-border overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/50">
                    <TableHead>Lead</TableHead>
                    <TableHead>Scout</TableHead>
                    <TableHead>Salesperson</TableHead>
                    <TableHead className="text-center">Status</TableHead>
                    <TableHead className="text-center">Show Up</TableHead>
                    <TableHead className="text-center">Closed</TableHead>
                    <TableHead className="text-center">Scout %</TableHead>
                    <TableHead className="text-center">SP %</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {bookings.map(b => (
                    <TableRow key={b.id}>
                      <TableCell className="font-medium">{b.lead_name}</TableCell>
                      <TableCell className="text-sm">{getName(b.scout_id)}</TableCell>
                      <TableCell className="text-sm">{getName(b.salesperson_id)}</TableCell>
                      <TableCell className="text-center">
                        <Badge variant="outline" className="capitalize">{b.status.replace('_', ' ')}</Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {b.show_up ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))] mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center">
                        {b.closed ? <CheckCircle2 className="h-4 w-4 text-[hsl(var(--status-green))] mx-auto" /> : <XCircle className="h-4 w-4 text-muted-foreground mx-auto" />}
                      </TableCell>
                      <TableCell className="text-center font-mono">{b.scout_percentage}%</TableCell>
                      <TableCell className="text-center font-mono">{b.salesperson_percentage}%</TableCell>
                      <TableCell className="text-muted-foreground text-sm">{format(new Date(b.booked_at), 'dd MMM')}</TableCell>
                      <TableCell>
                        <Button variant="ghost" size="sm" onClick={() => {
                          setEditingBooking(b); setEditStatus(b.status); setEditShowUp(b.show_up);
                          setEditClosed(b.closed); setEditScoutPct(b.scout_percentage); setEditSpPct(b.salesperson_percentage);
                        }}><Pencil className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {bookings.length === 0 && <TableRow><TableCell colSpan={10} className="text-center py-8 text-muted-foreground">No bookings yet.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
