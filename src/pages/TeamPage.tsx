import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Switch } from '@/components/ui/switch';
import { AppRole, Profile } from '@/lib/supabase-types';
import { toast } from 'sonner';
import { Loader2, Plus, UserPlus } from 'lucide-react';

interface UserData {
  profile: Profile;
  roles: AppRole[];
}

export default function TeamPage() {
  const [users, setUsers] = useState<UserData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingUser, setIsAddingUser] = useState(false);
  
  // Form state
  const [newEmail, setNewEmail] = useState('');
  const [newName, setNewName] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [newRole, setNewRole] = useState<AppRole>('sales_rep');

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    
    // Fetch all profiles
    const { data: profilesData } = await supabase
      .from('profiles')
      .select('*')
      .order('full_name');
    
    if (!profilesData) {
      setIsLoading(false);
      return;
    }
    
    // Fetch all roles
    const { data: rolesData } = await supabase
      .from('user_roles')
      .select('*');
    
    const profiles = profilesData as Profile[];
    const rolesList = (rolesData || []) as { user_id: string; role: AppRole }[];
    
    const usersData: UserData[] = profiles.map(profile => ({
      profile,
      roles: rolesList
        .filter(r => r.user_id === profile.user_id)
        .map(r => r.role)
    }));
    
    setUsers(usersData);
    setIsLoading(false);
  };

  const handleToggleActive = async (profile: Profile) => {
    const { error } = await supabase
      .from('profiles')
      .update({ is_active: !profile.is_active })
      .eq('id', profile.id);
    
    if (error) {
      toast.error('Failed to update user');
    } else {
      toast.success(`User ${profile.is_active ? 'deactivated' : 'activated'}`);
      fetchUsers();
    }
  };

  const handleUpdateRole = async (userId: string, currentRoles: AppRole[], newRole: AppRole) => {
    // Remove existing role and add new one
    if (currentRoles.includes(newRole)) return;
    
    // Delete old role
    await supabase
      .from('user_roles')
      .delete()
      .eq('user_id', userId);
    
    // Add new role
    const { error } = await supabase
      .from('user_roles')
      .insert({ user_id: userId, role: newRole });
    
    if (error) {
      toast.error('Failed to update role');
    } else {
      toast.success('Role updated');
      fetchUsers();
    }
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Team Management</h1>
            <p className="text-muted-foreground">Manage team members and their roles</p>
          </div>
          <p className="text-sm text-muted-foreground">
            New users can sign up at the login page
          </p>
        </div>

        {/* Users Table */}
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
              {users.map(user => (
                <TableRow key={user.profile.id}>
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
                    <Select 
                      value={user.roles[0] || 'sales_rep'} 
                      onValueChange={(value) => handleUpdateRole(user.profile.user_id, user.roles, value as AppRole)}
                    >
                      <SelectTrigger className="w-32">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="team_lead">Team Lead</SelectItem>
                        <SelectItem value="sales_rep">Sales Rep</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {user.profile.level}
                  </TableCell>
                  <TableCell className="text-center font-mono">
                    {user.profile.total_xp.toLocaleString()}
                  </TableCell>
                  <TableCell className="text-center">
                    {user.profile.current_streak}🔥
                  </TableCell>
                  <TableCell className="text-center">
                    <Switch
                      checked={user.profile.is_active}
                      onCheckedChange={() => handleToggleActive(user.profile)}
                    />
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
