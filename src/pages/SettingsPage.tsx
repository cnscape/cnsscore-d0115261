import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, User } from 'lucide-react';
import { toast } from 'sonner';

interface ProfileData {
  full_name: string;
  phone: string;
  city: string;
  province: string;
  country: string;
  avatar_url: string;
}

const SA_PROVINCES = [
  'Eastern Cape', 'Free State', 'Gauteng', 'KwaZulu-Natal',
  'Limpopo', 'Mpumalanga', 'North West', 'Northern Cape', 'Western Cape'
];

export default function SettingsPage() {
  const { user, profile, roles } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState<ProfileData>({
    full_name: '',
    phone: '',
    city: '',
    province: '',
    country: 'South Africa',
    avatar_url: '',
  });

  useEffect(() => {
    if (!user) return;
    
    const fetchProfile = async () => {
      setIsLoading(true);
      const { data } = await supabase
        .from('profiles')
        .select('full_name, phone, city, province, country, avatar_url')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (data) {
        const d = data as any;
        setFormData({
          full_name: d.full_name || '',
          phone: d.phone || '',
          city: d.city || '',
          province: d.province || '',
          country: d.country || 'South Africa',
          avatar_url: d.avatar_url || '',
        });
      }
      setIsLoading(false);
    };
    
    fetchProfile();
  }, [user]);

  const handleSave = async () => {
    if (!user) return;
    setIsSaving(true);
    
    const { error } = await supabase
      .from('profiles')
      .update({
        full_name: formData.full_name.trim(),
        phone: formData.phone.trim() || null,
        city: formData.city.trim() || null,
        province: formData.province || null,
        country: formData.country || 'South Africa',
        avatar_url: formData.avatar_url.trim() || null,
      } as any)
      .eq('user_id', user.id);
    
    setIsSaving(false);
    
    if (error) {
      toast.error('Failed to save: ' + error.message);
    } else {
      toast.success('Profile updated!');
    }
  };

  const roleLabel = roles.includes('admin') ? 'Admin' : roles.includes('team_lead') ? 'Team Lead' : 'Sales Rep';

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
      <div className="p-6 lg:p-8 space-y-8 max-w-2xl">
        <div>
          <h1 className="text-3xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Manage your profile and preferences</p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="h-5 w-5" />
              Profile Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {/* Name */}
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input
                value={formData.full_name}
                onChange={e => setFormData(prev => ({ ...prev, full_name: e.target.value }))}
                placeholder="Your full name"
              />
            </div>

            {/* Email (read-only) */}
            <div className="space-y-2">
              <Label>Email</Label>
              <Input value={user?.email || ''} disabled className="bg-muted" />
              <p className="text-xs text-muted-foreground">Email cannot be changed here</p>
            </div>

            {/* Phone */}
            <div className="space-y-2">
              <Label>Phone Number</Label>
              <Input
                type="tel"
                value={formData.phone}
                onChange={e => setFormData(prev => ({ ...prev, phone: e.target.value }))}
                placeholder="+27 xxx xxx xxxx"
              />
            </div>

            {/* Role (read-only) */}
            <div className="space-y-2">
              <Label>Role</Label>
              <Input value={roleLabel} disabled className="bg-muted" />
            </div>

            {/* Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>City</Label>
                <Input
                  value={formData.city}
                  onChange={e => setFormData(prev => ({ ...prev, city: e.target.value }))}
                  placeholder="e.g. Cape Town"
                />
              </div>
              <div className="space-y-2">
                <Label>Province</Label>
                <Select value={formData.province} onValueChange={v => setFormData(prev => ({ ...prev, province: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select province" /></SelectTrigger>
                  <SelectContent>
                    {SA_PROVINCES.map(p => (
                      <SelectItem key={p} value={p}>{p}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Country</Label>
              <Input
                value={formData.country}
                onChange={e => setFormData(prev => ({ ...prev, country: e.target.value }))}
                placeholder="South Africa"
              />
            </div>

            {/* Avatar URL */}
            <div className="space-y-2">
              <Label>Profile Picture URL</Label>
              <Input
                type="url"
                value={formData.avatar_url}
                onChange={e => setFormData(prev => ({ ...prev, avatar_url: e.target.value }))}
                placeholder="https://..."
              />
            </div>

            <Button onClick={handleSave} disabled={isSaving || !formData.full_name.trim()} className="w-full">
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
