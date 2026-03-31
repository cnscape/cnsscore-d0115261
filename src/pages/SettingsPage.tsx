import { useEffect, useState, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Save, User, Upload, Image } from 'lucide-react';
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
  const { user, profile, roles, isAdmin } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isUploadingLogo, setIsUploadingLogo] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoUrl, setLogoUrl] = useState('');
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
      const [profileRes, logoRes] = await Promise.all([
        supabase.from('profiles').select('full_name, phone, city, province, country, avatar_url').eq('user_id', user.id).maybeSingle(),
        supabase.from('app_settings' as any).select('value').eq('key', 'logo_url').maybeSingle(),
      ]);
      
      if (profileRes.data) {
        const d = profileRes.data as any;
        setFormData({
          full_name: d.full_name || '',
          phone: d.phone || '',
          city: d.city || '',
          province: d.province || '',
          country: d.country || 'South Africa',
          avatar_url: d.avatar_url || '',
        });
      }
      if (logoRes.data) {
        setLogoUrl((logoRes.data as any).value || '');
      }
      setIsLoading(false);
    };
    
    fetchProfile();
  }, [user]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    setIsUploading(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `avatars/${user.id}.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast.error('Upload failed: ' + uploadError.message);
      setIsUploading(false);
      return;
    }
    
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const url = urlData.publicUrl + '?t=' + Date.now();
    setFormData(prev => ({ ...prev, avatar_url: url }));
    
    await supabase.from('profiles').update({ avatar_url: url } as any).eq('user_id', user.id);
    toast.success('Profile picture uploaded!');
    setIsUploading(false);
  };

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setIsUploadingLogo(true);
    const fileExt = file.name.split('.').pop();
    const filePath = `logos/app-logo.${fileExt}`;
    
    const { error: uploadError } = await supabase.storage.from('avatars').upload(filePath, file, { upsert: true });
    if (uploadError) {
      toast.error('Logo upload failed: ' + uploadError.message);
      setIsUploadingLogo(false);
      return;
    }
    
    const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(filePath);
    const url = urlData.publicUrl + '?t=' + Date.now();
    
    await (supabase as any).from('app_settings').upsert({ key: 'logo_url', value: url, updated_at: new Date().toISOString() }, { onConflict: 'key' });
    setLogoUrl(url);
    toast.success('App logo updated!');
    setIsUploadingLogo(false);
  };

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

  const roleLabel = roles.includes('admin') ? 'Admin' : roles.includes('team_lead') ? 'Team Lead' : roles.includes('scout') ? 'Scout' : 'Sales Rep';

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
            {/* Profile Picture Upload */}
            <div className="space-y-2">
              <Label>Profile Picture</Label>
              <div className="flex items-center gap-4">
                {formData.avatar_url ? (
                  <img src={formData.avatar_url} alt="Avatar" className="h-16 w-16 rounded-full object-cover border-2 border-border" />
                ) : (
                  <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary text-xl font-bold">
                    {formData.full_name.charAt(0).toUpperCase()}
                  </div>
                )}
                <div>
                  <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleAvatarUpload} />
                  <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={isUploading}>
                    {isUploading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {isUploading ? 'Uploading...' : 'Upload Photo'}
                  </Button>
                </div>
              </div>
            </div>

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

            <Button onClick={handleSave} disabled={isSaving || !formData.full_name.trim()} className="w-full">
              {isSaving ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Saving...</>
              ) : (
                <><Save className="mr-2 h-4 w-4" /> Save Changes</>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Admin Logo Control */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Image className="h-5 w-5" />
                App Logo (Admin)
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">Upload a logo that appears across the sidebar, header, and login page.</p>
              <div className="flex items-center gap-4">
                {logoUrl ? (
                  <img src={logoUrl} alt="App Logo" className="h-12 w-12 rounded-lg object-contain border border-border" />
                ) : (
                  <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">NH</div>
                )}
                <div>
                  <input ref={logoInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
                  <Button variant="outline" size="sm" onClick={() => logoInputRef.current?.click()} disabled={isUploadingLogo}>
                    {isUploadingLogo ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Upload className="h-4 w-4 mr-2" />}
                    {isUploadingLogo ? 'Uploading...' : logoUrl ? 'Replace Logo' : 'Upload Logo'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
}
