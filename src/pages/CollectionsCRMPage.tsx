import { useEffect, useState, useCallback, useMemo } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from '@/components/ui/command';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Plus, Loader2, Search, Calendar, FileText, Receipt, User,
  TrendingUp, Wallet, CheckCircle2, Clock, AlertTriangle, Upload, Trash2, Check
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { format, formatDistanceToNow } from 'date-fns';

interface DebtRecord {
  id: string;
  client_name: string;
  contact: string | null;
  description: string | null;
  original_amount: number;
  amount_paid: number;
  outstanding_amount: number;
  commission_percentage: number;
  commission_amount: number;
  assignee_id: string | null;
  assignee_name: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: string;
  next_follow_up: string | null;
  created_at: string;
}

interface DebtPayment {
  id: string;
  debt_record_id: string;
  payment_amount: number;
  payment_date: string;
  payment_method: string | null;
  payment_reference: string | null;
  payment_note: string | null;
  proof_url: string | null;
  collected_by: string | null;
  created_at: string;
}

interface TeamMember {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
}

const STAGES = [
  { key: 'unpaid',       label: 'Unpaid',       accent: 'from-slate-500/10 to-transparent' },
  { key: 'in_progress',  label: 'In Progress',  accent: 'from-amber-500/10 to-transparent' },
  { key: 'partial_paid', label: 'Partial Paid', accent: 'from-orange-500/10 to-transparent' },
  { key: 'paid',         label: 'Paid',         accent: 'from-emerald-500/10 to-transparent' },
];

const PRIORITIES = [
  { key: 'low',    label: 'Low',    cls: 'bg-slate-500/15 text-slate-300 border-slate-500/30' },
  { key: 'medium', label: 'Medium', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/30' },
  { key: 'high',   label: 'High',   cls: 'bg-amber-500/15 text-amber-300 border-amber-500/30' },
  { key: 'urgent', label: 'Urgent', cls: 'bg-rose-500/15 text-rose-300 border-rose-500/30' },
];

const initials = (n: string) => n.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();

export default function CollectionsCRMPage() {
  const { user, isAdmin } = useAuth();
  const [debts, setDebts] = useState<DebtRecord[]>([]);
  const [paymentsByDebt, setPaymentsByDebt] = useState<Record<string, DebtPayment[]>>({});
  const [team, setTeam] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<DebtRecord | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [showPayment, setShowPayment] = useState(false);
  const [draggedId, setDraggedId] = useState<string | null>(null);

  // New debt form
  const [nClient, setNClient] = useState('');
  const [nContact, setNContact] = useState('');
  const [nAmount, setNAmount] = useState('');
  const [nCommission, setNCommission] = useState('10');
  const [nDesc, setNDesc] = useState('');
  const [nAssignee, setNAssignee] = useState<string | null>(null);
  const [nPriority, setNPriority] = useState<string>('medium');
  const [nFollowUp, setNFollowUp] = useState('');

  // Payment form
  const [pAmount, setPAmount] = useState('');
  const [pDate, setPDate] = useState(format(new Date(), 'yyyy-MM-dd'));
  const [pMethod, setPMethod] = useState('eft');
  const [pRef, setPRef] = useState('');
  const [pNotes, setPNotes] = useState('');
  const [pFile, setPFile] = useState<File | null>(null);
  const [pSaving, setPSaving] = useState(false);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    const [{ data: d }, { data: p }, { data: t }] = await Promise.all([
      supabase.from('debt_records' as any).select('*').order('created_at', { ascending: false }),
      supabase.from('debt_payments' as any).select('*').order('payment_date', { ascending: false }),
      supabase.from('profiles').select('user_id, full_name, avatar_url').eq('is_active', true),
    ]);
    setDebts((d as any) || []);
    const grouped: Record<string, DebtPayment[]> = {};
    ((p as any) || []).forEach((row: DebtPayment) => {
      (grouped[row.debt_record_id] ||= []).push(row);
    });
    setPaymentsByDebt(grouped);
    setTeam((t as any) || []);
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const calc = (debt: DebtRecord) => {
    const list = paymentsByDebt[debt.id] || [];
    const paid = list.reduce((s, x) => s + Number(x.payment_amount || 0), 0);
    const remaining = Math.max(0, Number(debt.original_amount) - paid);
    const progress = debt.original_amount > 0 ? Math.min(100, (paid / Number(debt.original_amount)) * 100) : 0;
    const commission = paid * (Number(debt.commission_percentage) / 100);
    const status: 'unpaid' | 'partial' | 'paid' =
      paid <= 0 ? 'unpaid' : remaining <= 0.001 ? 'paid' : 'partial';
    return { paid, remaining, progress, commission, status };
  };

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim();
    if (!q) return debts;
    return debts.filter(d =>
      d.client_name.toLowerCase().includes(q) ||
      (d.description || '').toLowerCase().includes(q) ||
      (d.contact || '').toLowerCase().includes(q)
    );
  }, [debts, search]);

  const totals = useMemo(() => {
    let owed = 0, paid = 0;
    debts.forEach(d => {
      const c = calc(d);
      owed += Number(d.original_amount);
      paid += c.paid;
    });
    return { owed, paid, remaining: owed - paid, count: debts.length };
  }, [debts, paymentsByDebt]);

  // Mutations
  const createDebt = async () => {
    if (!user || !nClient.trim() || !nAmount) return;
    const { error } = await (supabase as any).from('debt_records').insert([{
      client_name: nClient.trim(),
      contact: nContact.trim() || null,
      description: nDesc.trim() || null,
      original_amount: Number(nAmount),
      commission_percentage: Number(nCommission || 10),
      assignee_id: nAssignee,
      assignee_name: memberById(nAssignee)?.full_name || null,
      priority: nPriority,
      next_follow_up: nFollowUp || null,
      created_by: user.id,
    }]);
    if (error) { toast.error(error.message); return; }
    toast.success('Debt record created');
    setShowNew(false);
    setNClient(''); setNContact(''); setNAmount(''); setNDesc('');
    setNAssignee(null); setNPriority('medium'); setNFollowUp(''); setNCommission('10');
    fetchAll();
  };

  const updateDebt = async (id: string, patch: Partial<DebtRecord>) => {
    const { error } = await (supabase as any).from('debt_records').update(patch).eq('id', id);
    if (error) { toast.error(error.message); return; }
    fetchAll();
  };

  const recomputeStage = async (debt: DebtRecord) => {
    const c = calc(debt);
    let status = debt.status;
    if (c.status === 'paid') status = 'paid';
    else if (c.status === 'partial' && debt.status === 'unpaid') status = 'partial_paid';
    if (status !== debt.status) await updateDebt(debt.id, { status } as any);
  };

  const addPayment = async () => {
    if (!selected || !pAmount) return;
    setPSaving(true);
    let proof_url: string | null = null;
    if (pFile) {
      const path = `${selected.id}/${Date.now()}-${pFile.name}`;
      const { error: upErr } = await supabase.storage.from('payment-proofs').upload(path, pFile);
      if (upErr) { toast.error('Proof upload failed: ' + upErr.message); setPSaving(false); return; }
      proof_url = path;
    }
    const { error } = await (supabase as any).from('debt_payments').insert([{
      debt_record_id: selected.id,
      payment_amount: Number(pAmount),
      payment_date: pDate,
      payment_method: pMethod,
      payment_reference: pRef || null,
      payment_note: pNotes || null,
      proof_url,
      collected_by: user?.id,
    }]);
    if (error) { toast.error(error.message); setPSaving(false); return; }
    toast.success('Payment recorded');
    setPAmount(''); setPRef(''); setPNotes(''); setPFile(null);
    setShowPayment(false);
    await fetchAll();
    // Auto-update stage
    const refreshed = await (supabase as any).from('debt_records').select('*').eq('id', selected.id).single();
    if (refreshed.data) await recomputeStage(refreshed.data as DebtRecord);
    setPSaving(false);
  };

  const deletePayment = async (id: string) => {
    if (!confirm('Delete this payment?')) return;
    const { error } = await (supabase as any).from('debt_payments').delete().eq('id', id);
    if (error) { toast.error(error.message); return; }
    toast.success('Payment removed');
    fetchAll();
  };

  const handleDrop = async (stageKey: string) => {
    if (!draggedId) return;
    await updateDebt(draggedId, { status: stageKey } as any);
    setDraggedId(null);
  };

  const renderStatusChip = (status: 'unpaid' | 'partial' | 'paid') => {
    if (status === 'paid') return <Badge className="bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 gap-1"><CheckCircle2 className="h-3 w-3" />Paid</Badge>;
    if (status === 'partial') return <Badge className="bg-amber-500/15 text-amber-300 border border-amber-500/30 gap-1"><Clock className="h-3 w-3" />Partial</Badge>;
    return <Badge className="bg-slate-500/15 text-slate-300 border border-slate-500/30 gap-1"><AlertTriangle className="h-3 w-3" />Unpaid</Badge>;
  };

  const memberById = (id: string | null) => team.find(t => t.user_id === id);

  if (loading) {
    return <AppLayout><div className="flex h-full items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Collections</h1>
            <p className="text-sm text-muted-foreground">Track setup fees, batch payments and outstanding balances.</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Search clients, references…"
                className="w-72 pl-9"
              />
            </div>
            {isAdmin && (
              <Button onClick={() => setShowNew(true)} className="rounded-full"><Plus className="mr-2 h-4 w-4" />New debt</Button>
            )}
          </div>
        </div>

        {/* Summary cards */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {[
            { label: 'Total owed', value: totals.owed, icon: FileText, accent: 'text-foreground' },
            { label: 'Collected',  value: totals.paid, icon: Wallet, accent: 'text-emerald-400' },
            { label: 'Outstanding', value: totals.remaining, icon: TrendingUp, accent: 'text-amber-400' },
            { label: 'Active records', value: totals.count, icon: Receipt, accent: 'text-primary', raw: true },
          ].map((s) => (
            <Card key={s.label} className="border-border/60 bg-card/60 backdrop-blur">
              <CardContent className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-xs uppercase tracking-wider text-muted-foreground">{s.label}</p>
                  <s.icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <p className={cn("mt-3 text-2xl font-semibold", s.accent)}>
                  {s.raw ? s.value : `R${Number(s.value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Kanban */}
        <div className="overflow-x-auto pb-4">
          <div className="flex gap-4 min-w-[1400px]">
            {STAGES.map(stage => {
              const stageDebts = filtered.filter(d => d.stage === stage.key);
              return (
                <div
                  key={stage.key}
                  className="flex-1 min-w-[260px]"
                  onDragOver={e => e.preventDefault()}
                  onDrop={() => handleDrop(stage.key)}
                >
                  <div className={cn("rounded-2xl border border-border/60 bg-gradient-to-b p-3", stage.accent)}>
                    <div className="mb-3 flex items-center justify-between px-1">
                      <h3 className="text-sm font-semibold tracking-wide">{stage.label}</h3>
                      <Badge variant="outline" className="rounded-full text-xs">{stageDebts.length}</Badge>
                    </div>
                    <div className="space-y-2 min-h-[120px]">
                      {stageDebts.map(debt => {
                        const c = calc(debt);
                        const m = memberById(debt.assigned_to);
                        const prio = PRIORITIES.find(p => p.key === debt.priority) || PRIORITIES[1];
                        return (
                          <Card
                            key={debt.id}
                            draggable={isAdmin}
                            onDragStart={() => setDraggedId(debt.id)}
                            onClick={() => setSelected(debt)}
                            className="cursor-pointer border-border/60 bg-card/80 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg"
                          >
                            <CardContent className="p-4 space-y-3">
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0">
                                  <p className="truncate font-medium">{debt.client_name}</p>
                                  {debt.description && <p className="truncate text-xs text-muted-foreground">{debt.description}</p>}
                                </div>
                                <Badge variant="outline" className={cn("rounded-full text-[10px] uppercase", prio.cls)}>{prio.label}</Badge>
                              </div>

                              <div className="space-y-1.5">
                                <div className="flex items-baseline justify-between text-xs">
                                  <span className="text-muted-foreground">R{c.paid.toLocaleString()} / R{Number(debt.original_amount).toLocaleString()}</span>
                                  <span className="font-medium">{Math.round(c.progress)}%</span>
                                </div>
                                <Progress value={c.progress} className="h-1.5" />
                              </div>

                              <div className="flex items-center justify-between">
                                {renderStatusChip(c.status)}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  {debt.next_follow_up && (
                                    <span className="flex items-center gap-1"><Calendar className="h-3 w-3" />{format(new Date(debt.next_follow_up), 'd MMM')}</span>
                                  )}
                                  {m ? (
                                    <Avatar className="h-6 w-6 border border-border">
                                      <AvatarFallback className="bg-primary/20 text-[10px] text-primary">{initials(m.full_name)}</AvatarFallback>
                                    </Avatar>
                                  ) : (
                                    <Badge variant="outline" className="rounded-full text-[10px]">Unassigned</Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                      {stageDebts.length === 0 && (
                        <div className="flex h-24 items-center justify-center rounded-xl border border-dashed border-border/50 text-xs text-muted-foreground">
                          Nothing here yet
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Detail slide-over */}
      <Sheet open={!!selected} onOpenChange={(o) => { if (!o) setSelected(null); }}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-xl">
          {selected && (() => {
            const c = calc(selected);
            const list = paymentsByDebt[selected.id] || [];
            const m = memberById(selected.assigned_to);
            return (
              <div className="space-y-6">
                <SheetHeader>
                  <SheetTitle className="flex items-center gap-3">
                    <Avatar className="h-10 w-10 border border-border">
                      <AvatarFallback className="bg-primary/15 text-primary">{initials(selected.client_name)}</AvatarFallback>
                    </Avatar>
                    <div className="text-left">
                      <p className="text-base">{selected.client_name}</p>
                      <p className="text-xs font-normal text-muted-foreground">{selected.client_contact || 'No contact info'}</p>
                    </div>
                  </SheetTitle>
                </SheetHeader>

                {/* Stage chips */}
                <div className="flex flex-wrap gap-1.5">
                  {STAGES.map(s => (
                    <button
                      key={s.key}
                      disabled={!isAdmin}
                      onClick={() => updateDebt(selected.id, { stage: s.key } as any)}
                      className={cn(
                        "rounded-full border px-3 py-1 text-xs transition-all",
                        selected.stage === s.key
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                        !isAdmin && "cursor-default opacity-70"
                      )}
                    >
                      {selected.stage === s.key && <Check className="mr-1 inline h-3 w-3" />}
                      {s.label}
                    </button>
                  ))}
                </div>

                {/* Money block */}
                <Card className="border-border/60 bg-gradient-to-br from-primary/5 to-transparent">
                  <CardContent className="space-y-4 p-5">
                    <div className="grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Owed</p>
                        <p className="mt-1 text-lg font-semibold">R{Number(selected.original_amount).toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Paid</p>
                        <p className="mt-1 text-lg font-semibold text-emerald-400">R{c.paid.toLocaleString()}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Remaining</p>
                        <p className="mt-1 text-lg font-semibold text-amber-400">R{c.remaining.toLocaleString()}</p>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">Progress</span>
                        <span className="font-medium">{Math.round(c.progress)}%</span>
                      </div>
                      <Progress value={c.progress} />
                    </div>
                    <div className="flex items-center justify-between border-t border-border/40 pt-3 text-xs">
                      <span className="text-muted-foreground">Commission earned ({selected.commission_percent}%)</span>
                      <span className="font-semibold text-primary">R{c.commission.toLocaleString(undefined, { maximumFractionDigits: 2 })}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Meta */}
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Assigned to</p>
                    {isAdmin ? (
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button variant="outline" className="w-full justify-start gap-2">
                            {m ? (
                              <><Avatar className="h-5 w-5"><AvatarFallback className="bg-primary/20 text-[10px] text-primary">{initials(m.full_name)}</AvatarFallback></Avatar>{m.full_name}</>
                            ) : (<><User className="h-4 w-4" />Unassigned</>)}
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-64 p-0" align="start">
                          <Command>
                            <CommandInput placeholder="Search team…" />
                            <CommandList>
                              <CommandEmpty>No matches</CommandEmpty>
                              <CommandGroup>
                                <CommandItem onSelect={() => updateDebt(selected.id, { assigned_to: null } as any)}>Unassigned</CommandItem>
                                {team.map(t => (
                                  <CommandItem key={t.user_id} onSelect={() => updateDebt(selected.id, { assigned_to: t.user_id } as any)}>
                                    <Avatar className="mr-2 h-5 w-5"><AvatarFallback className="bg-primary/20 text-[10px] text-primary">{initials(t.full_name)}</AvatarFallback></Avatar>
                                    {t.full_name}
                                  </CommandItem>
                                ))}
                              </CommandGroup>
                            </CommandList>
                          </Command>
                        </PopoverContent>
                      </Popover>
                    ) : (
                      <p>{m?.full_name || 'Unassigned'}</p>
                    )}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Priority</p>
                    <div className="flex flex-wrap gap-1">
                      {PRIORITIES.map(p => (
                        <button
                          key={p.key}
                          disabled={!isAdmin}
                          onClick={() => updateDebt(selected.id, { priority: p.key } as any)}
                          className={cn(
                            "rounded-full border px-2.5 py-1 text-[11px] transition-all",
                            selected.priority === p.key ? p.cls : "border-border/60 text-muted-foreground hover:border-primary/40",
                            !isAdmin && "cursor-default"
                          )}
                        >{p.label}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Next follow-up</p>
                    {isAdmin ? (
                      <Input type="date" value={selected.next_follow_up || ''} onChange={(e) => updateDebt(selected.id, { next_follow_up: e.target.value || null } as any)} />
                    ) : (<p>{selected.next_follow_up ? format(new Date(selected.next_follow_up), 'PPP') : '—'}</p>)}
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs uppercase text-muted-foreground">Commission %</p>
                    {isAdmin ? (
                      <Input type="number" defaultValue={selected.commission_percent} onBlur={(e) => updateDebt(selected.id, { commission_percent: Number(e.target.value) } as any)} />
                    ) : (<p>{selected.commission_percent}%</p>)}
                  </div>
                </div>

                {selected.description && (
                  <div className="space-y-1 text-sm">
                    <p className="text-xs uppercase text-muted-foreground">Description</p>
                    <p>{selected.description}</p>
                  </div>
                )}

                <Separator />

                {/* Payment timeline */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium">Payment history</h4>
                    {isAdmin && (
                      <Button size="sm" onClick={() => setShowPayment(true)} className="rounded-full"><Plus className="mr-1 h-4 w-4" />Add payment</Button>
                    )}
                  </div>
                  {list.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
                      No payments recorded yet.
                    </div>
                  ) : (
                    <ScrollArea className="max-h-72 pr-2">
                      <ol className="relative space-y-3 border-l border-border/60 pl-5">
                        {list.map((p) => (
                          <li key={p.id} className="relative">
                            <span className="absolute -left-[27px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500/20 ring-2 ring-background">
                              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                            </span>
                            <div className="rounded-xl border border-border/60 bg-card/60 p-3">
                              <div className="flex items-start justify-between">
                                <div>
                                  <p className="font-semibold text-emerald-400">+R{Number(p.amount).toLocaleString()}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {format(new Date(p.payment_date), 'PPP')} · {p.payment_method || 'method n/a'}
                                  </p>
                                </div>
                                {isAdmin && (
                                  <Button variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => deletePayment(p.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                )}
                              </div>
                              {p.payment_reference && <p className="mt-1 text-xs">Ref: {p.payment_reference}</p>}
                              {p.notes && <p className="mt-1 text-xs text-muted-foreground">{p.notes}</p>}
                              {p.proof_url && (
                                <a
                                  href="#"
                                  onClick={async (e) => {
                                    e.preventDefault();
                                    const { data } = await supabase.storage.from('payment-proofs').createSignedUrl(p.proof_url!, 60);
                                    if (data?.signedUrl) window.open(data.signedUrl, '_blank');
                                  }}
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  <FileText className="h-3 w-3" /> View proof
                                </a>
                              )}
                              <p className="mt-1 text-[10px] text-muted-foreground">{formatDistanceToNow(new Date(p.created_at), { addSuffix: true })}</p>
                            </div>
                          </li>
                        ))}
                      </ol>
                    </ScrollArea>
                  )}
                </div>
              </div>
            );
          })()}
        </SheetContent>
      </Sheet>

      {/* Add payment dialog */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Record payment</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Amount (R) *</Label>
                <Input type="number" value={pAmount} onChange={e => setPAmount(e.target.value)} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label>Date *</Label>
                <Input type="date" value={pDate} onChange={e => setPDate(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Method</Label>
              <div className="flex flex-wrap gap-1.5">
                {['eft', 'card', 'cash', 'paypal', 'other'].map(m => (
                  <button key={m} type="button" onClick={() => setPMethod(m)}
                    className={cn("rounded-full border px-3 py-1 text-xs capitalize transition-all",
                      pMethod === m ? "border-primary bg-primary text-primary-foreground" : "border-border/60 text-muted-foreground hover:border-primary/40")}>{m}</button>
                ))}
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Reference</Label>
              <Input value={pRef} onChange={e => setPRef(e.target.value)} placeholder="Transaction / invoice ref" />
            </div>
            <div className="space-y-1.5">
              <Label>Notes</Label>
              <Textarea value={pNotes} onChange={e => setPNotes(e.target.value)} rows={2} />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Upload className="h-3.5 w-3.5" />Proof of payment</Label>
              <Input type="file" accept="image/*,application/pdf" onChange={e => setPFile(e.target.files?.[0] || null)} />
            </div>
            <Button onClick={addPayment} disabled={!pAmount || pSaving} className="w-full rounded-full">
              {pSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
              Save payment
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* New debt dialog */}
      <Dialog open={showNew} onOpenChange={setShowNew}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>New debt record</DialogTitle></DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5"><Label>Client name *</Label><Input value={nClient} onChange={e => setNClient(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Contact</Label><Input value={nContact} onChange={e => setNContact(e.target.value)} placeholder="Email / phone" /></div>
              <div className="space-y-1.5"><Label>Original amount (R) *</Label><Input type="number" value={nAmount} onChange={e => setNAmount(e.target.value)} /></div>
              <div className="space-y-1.5"><Label>Commission %</Label><Input type="number" value={nCommission} onChange={e => setNCommission(e.target.value)} /></div>
            </div>
            <div className="space-y-1.5">
              <Label>Description</Label>
              <Textarea value={nDesc} onChange={e => setNDesc(e.target.value)} rows={2} placeholder="Setup fee for…" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>Assignee</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className="w-full justify-start gap-2">
                      {nAssignee
                        ? <>{(() => { const m = memberById(nAssignee); return m ? <><Avatar className="h-5 w-5"><AvatarFallback className="bg-primary/20 text-[10px] text-primary">{initials(m.full_name)}</AvatarFallback></Avatar>{m.full_name}</> : 'Pick'; })()}</>
                        : <><User className="h-4 w-4" />Unassigned</>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-64 p-0" align="start">
                    <Command>
                      <CommandInput placeholder="Search team…" />
                      <CommandList>
                        <CommandEmpty>No matches</CommandEmpty>
                        <CommandGroup>
                          <CommandItem onSelect={() => setNAssignee(null)}>Unassigned</CommandItem>
                          {team.map(t => (
                            <CommandItem key={t.user_id} onSelect={() => setNAssignee(t.user_id)}>
                              <Avatar className="mr-2 h-5 w-5"><AvatarFallback className="bg-primary/20 text-[10px] text-primary">{initials(t.full_name)}</AvatarFallback></Avatar>
                              {t.full_name}
                            </CommandItem>
                          ))}
                        </CommandGroup>
                      </CommandList>
                    </Command>
                  </PopoverContent>
                </Popover>
              </div>
              <div className="space-y-1.5">
                <Label>Next follow-up</Label>
                <Input type="date" value={nFollowUp} onChange={e => setNFollowUp(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label>Priority</Label>
              <div className="flex flex-wrap gap-1.5">
                {PRIORITIES.map(p => (
                  <button key={p.key} type="button" onClick={() => setNPriority(p.key)}
                    className={cn("rounded-full border px-3 py-1 text-xs transition-all",
                      nPriority === p.key ? p.cls : "border-border/60 text-muted-foreground hover:border-primary/40")}>{p.label}</button>
                ))}
              </div>
            </div>
            <Button onClick={createDebt} disabled={!nClient.trim() || !nAmount} className="w-full rounded-full"><Plus className="mr-2 h-4 w-4" />Create debt record</Button>
          </div>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
}
