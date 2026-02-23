import { useState, useMemo } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator } from '@/components/ui/command';
import { Check, ChevronsUpDown, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface ClientOption {
  id: string;
  name: string;
}

interface SearchableClientSelectProps {
  clients: ClientOption[];
  value: string;
  onValueChange: (value: string) => void;
  onCreateClient?: (name: string, industry: string, revenueModel: string, revenueSharePercent: number) => Promise<string | null>;
  allowCreate?: boolean;
  placeholder?: string;
}

export function SearchableClientSelect({
  clients,
  value,
  onValueChange,
  onCreateClient,
  allowCreate = false,
  placeholder = 'Search clients...',
}: SearchableClientSelectProps) {
  const [open, setOpen] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [newClientName, setNewClientName] = useState('');
  const [newClientIndustry, setNewClientIndustry] = useState('');
  const [newRevenueModel, setNewRevenueModel] = useState('revenue_share');
  const [newRevenueSharePercent, setNewRevenueSharePercent] = useState(30);
  const [isCreating, setIsCreating] = useState(false);

  const selectedClient = useMemo(
    () => clients.find((c) => c.id === value),
    [clients, value]
  );

  const handleCreate = async () => {
    if (!onCreateClient || !newClientName.trim()) return;
    setIsCreating(true);
    const newId = await onCreateClient(newClientName.trim(), newClientIndustry, newRevenueModel, newRevenueSharePercent);
    if (newId) {
      onValueChange(newId);
    }
    setIsCreating(false);
    setShowCreateDialog(false);
    setNewClientName('');
    setNewClientIndustry('');
  };

  return (
    <>
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between font-normal bg-input border-border text-foreground"
          >
            {selectedClient ? selectedClient.name : placeholder}
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-popover border-border z-50" align="start">
          <Command className="bg-popover">
            <CommandInput placeholder="Search clients..." className="text-foreground" />
            <CommandList>
              <CommandEmpty>No clients found.</CommandEmpty>
              <CommandGroup>
                {clients.map((client) => (
                  <CommandItem
                    key={client.id}
                    value={client.name}
                    onSelect={() => {
                      onValueChange(client.id);
                      setOpen(false);
                    }}
                    className="text-foreground"
                  >
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        value === client.id ? 'opacity-100' : 'opacity-0'
                      )}
                    />
                    {client.name}
                  </CommandItem>
                ))}
              </CommandGroup>
              {allowCreate && onCreateClient && (
                <>
                  <CommandSeparator />
                  <CommandGroup>
                    <CommandItem
                      onSelect={() => {
                        setOpen(false);
                        setShowCreateDialog(true);
                      }}
                      className="text-primary"
                    >
                      <Plus className="mr-2 h-4 w-4" />
                      Create new client
                    </CommandItem>
                  </CommandGroup>
                </>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quick-Create Client</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label>Client Name</Label>
              <Input
                value={newClientName}
                onChange={(e) => setNewClientName(e.target.value)}
                placeholder="e.g. Acme Corp"
              />
            </div>
            <div className="space-y-2">
              <Label>Industry</Label>
              <Input
                value={newClientIndustry}
                onChange={(e) => setNewClientIndustry(e.target.value)}
                placeholder="e.g. SaaS, E-commerce"
              />
            </div>
            <div className="space-y-2">
              <Label>Revenue Model</Label>
              <Select value={newRevenueModel} onValueChange={setNewRevenueModel}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="revenue_share">Revenue Share %</SelectItem>
                  <SelectItem value="flat_commission">Flat Commission</SelectItem>
                  <SelectItem value="tiered">Tiered</SelectItem>
                  <SelectItem value="hybrid">Hybrid</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {(newRevenueModel === 'revenue_share' || newRevenueModel === 'hybrid') && (
              <div className="space-y-2">
                <Label>Revenue Share %</Label>
                <Input
                  type="number"
                  value={newRevenueSharePercent}
                  onChange={(e) => setNewRevenueSharePercent(Number(e.target.value))}
                />
              </div>
            )}
            <Button
              onClick={handleCreate}
              className="w-full"
              disabled={!newClientName.trim() || isCreating}
            >
              {isCreating ? 'Creating...' : 'Create Client'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
