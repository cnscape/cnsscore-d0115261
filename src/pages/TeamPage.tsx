import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { AppRole, Profile } from '@/lib/supabase-types';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';

interface UserData {
  profile: Profile;
  roles: AppRole[];
}

const ROLE_LABELS: Record<string, string> = {
  admin: 'Admin',
  team_lead: 'Team Lead',
  sales_rep: 'Sales Rep',
  scout: 'Scout',
};

export default function TeamPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => { fetchUsers(); }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    const { data: profilesData } = await supabase.from('profiles').select('*').order('full_name');
    if (!profilesData) { setIsLoading(false); return; }
    const { data: rolesData } = await supabase.from('user_roles').select('*');
    const profiles = profilesData as Profile[];
    const rolesList = (rolesData || []) as { user_id: string; role: AppRole }[];
    const usersData: UserData[] = profiles.map(profile => ({
      profile,
      roles: rolesList.filter(r => r.user_id === profile.user_id).map(r => r.role),
    }));
    setUsers(usersData);
    setIsLoading(false);
  };

  // Sort: active first, then inactive
  const sortedUsers = [...users].sort((a, b) => {
    if (a.profile.is_active && !b.profile.is_active) return -1;
    if (!a.profile.is_active && b.profile.is_active) return 1;
    return a.profile.full_name.localeCompare(b.profile.full_name);
  });

  const handleToggleActive = async (profile: Profile) => {
    const { error } = await supabase.from('profiles').update({ is_active: !profile.is_active }).eq('id', profile.id);
    if (error) { toast.error('Failed to update user'); return; }
    toast.success(`User ${profile.is_active ? 'deactivated' : 'activated'}`);
    fetchUsers();
  };

  const handleUpdateRole = async (userId: string, currentRoles: AppRole[], newRole: AppRole) => {
    if (currentRoles.includes(newRole)) return;
    await supabase.from('user_roles').delete().eq('user_id', userId);
    const { error } = await supabase.from('user_roles').insert({ user_id: userId, role: newRole } as any);
    if (error) { toast.error('Failed to update role'); return; }
    toast.success('Role updated');
    fetchUsers();
  };

  if (isLoading) {
    return (<AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>);
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground">Manage team members and their roles</p>
          </div>
          <p className="text-sm text-muted-foreground">New users can sign up at the login page</p>
        </div>

        <div className="rounded-xl border border-border overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/50">
                <TableHead>Name</TableHead>
                <TableHead>Role</TableHead>
                <TableHead className="text-center">Level</TableHead>
                <TableHead className="text-center">XP</TableHead>
                <TableHead className="text-center">Streak</TableHead>
                <TableHead className="text-center">Active</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedUsers.map(user => (
                <TableRow key={user.profile.id} className={!user.profile.is_active ? 'opacity-50' : ''}>
                  <TableCell>
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium">
                        {user.profile.full_name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium">{user.profile.full_name}</p>
                      </div>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Select value={user.roles[0] || 'sales_rep'} onValueChange={(value) => handleUpdateRole(user.profile.user_id, user.roles, value as AppRole)}>
                      <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="team_lead">Team Lead</SelectItem>
                        <SelectItem value="sales_rep">Sales Rep</SelectItem>
                        <SelectItem value="scout">Scout</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center font-mono">{user.profile.level}</TableCell>
                  <TableCell className="text-center font-mono">{user.profile.total_xp.toLocaleString()}</TableCell>
                  <TableCell className="text-center">{user.profile.current_streak}🔥</TableCell>
                  <TableCell className="text-center">
                    <Switch checked={user.profile.is_active} onCheckedChange={() => handleToggleActive(user.profile)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </AppLayout>
  );
}
