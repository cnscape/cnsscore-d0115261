import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Loader2, Plus, GraduationCap, Pencil, Trash2, ExternalLink, Video, FileText, Link } from 'lucide-react';
import { toast } from 'sonner';

interface TrainingResource {
  id: string;
  title: string;
  description: string | null;
  category: string;
  content_type: string;
  content_url: string;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = [
  { key: 'sop', label: 'SOPs', icon: FileText },
  { key: 'training', label: 'Training', icon: GraduationCap },
  { key: 'call_review', label: 'Call Reviews', icon: Video },
  { key: 'onboarding', label: 'Onboarding', icon: Link },
];

export default function TrainingPage() {
  const { isAdmin } = useAuth();
  const [resources, setResources] = useState<TrainingResource[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editing, setEditing] = useState<TrainingResource | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('training');
  const [contentType, setContentType] = useState('link');
  const [contentUrl, setContentUrl] = useState('');

  const fetchResources = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('training_resources').select('*').order('sort_order', { ascending: true });
    if (data) setResources(data as TrainingResource[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchResources(); }, []);

  const handleSave = async () => {
    if (!title.trim() || !contentUrl.trim()) { toast.error('Title and URL are required'); return; }
    if (editing) {
      const { error } = await supabase.from('training_resources').update({
        title: title.trim(), description: description.trim() || null, category, content_type: contentType, content_url: contentUrl.trim(),
        updated_at: new Date().toISOString()
      } as any).eq('id', editing.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Resource updated');
    } else {
      const { error } = await supabase.from('training_resources').insert([{
        title: title.trim(), description: description.trim() || null, category, content_type: contentType, content_url: contentUrl.trim(),
        sort_order: resources.length
      }] as any);
      if (error) { toast.error('Failed to create'); return; }
      toast.success('Resource added');
    }
    setShowAdd(false); setEditing(null);
    setTitle(''); setDescription(''); setContentUrl(''); setCategory('training');
    fetchResources();
  };

  const handleDelete = async (id: string) => {
    await supabase.from('training_resources').delete().eq('id', id);
    toast.success('Deleted');
    fetchResources();
  };

  const openEdit = (r: TrainingResource) => {
    setEditing(r); setTitle(r.title); setDescription(r.description || '');
    setCategory(r.category); setContentType(r.content_type); setContentUrl(r.content_url);
    setShowAdd(true);
  };

  const isEmbeddable = (url: string) => {
    return url.includes('youtube.com') || url.includes('youtu.be') || url.includes('loom.com') || url.includes('docs.google.com');
  };

  const getEmbedUrl = (url: string) => {
    if (url.includes('youtube.com/watch')) return url.replace('watch?v=', 'embed/');
    if (url.includes('youtu.be/')) return url.replace('youtu.be/', 'www.youtube.com/embed/');
    if (url.includes('loom.com/share')) return url.replace('/share/', '/embed/');
    if (url.includes('docs.google.com')) return url.includes('/pub') ? url : url + '?embedded=true';
    return url;
  };

  const [viewingResource, setViewingResource] = useState<TrainingResource | null>(null);

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><GraduationCap className="h-8 w-8 text-primary" /> Training & SOPs</h1>
            <p className="text-muted-foreground">Resources, documents, and training materials</p>
          </div>
          {isAdmin && (
            <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setEditing(null); setTitle(''); setDescription(''); setContentUrl(''); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Resource</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? 'Edit Resource' : 'Add Training Resource'}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="space-y-2">
                    <Label>Title</Label>
                    <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Resource title" />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Textarea value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={contentType} onValueChange={setContentType}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="link">Link</SelectItem>
                          <SelectItem value="video">Video</SelectItem>
                          <SelectItem value="document">Document</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Content URL</Label>
                    <Input value={contentUrl} onChange={e => setContentUrl(e.target.value)} placeholder="https://..." />
                  </div>
                  <Button onClick={handleSave} className="w-full">{editing ? 'Update' : 'Add Resource'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue="training">
          <TabsList>
            {CATEGORIES.map(c => {
              const count = resources.filter(r => r.category === c.key).length;
              const Icon = c.icon;
              return (
                <TabsTrigger key={c.key} value={c.key} className="text-xs gap-1">
                  <Icon className="h-3 w-3" /> {c.label} {count > 0 && <Badge variant="outline" className="text-xs ml-1">{count}</Badge>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CATEGORIES.map(cat => (
            <TabsContent key={cat.key} value={cat.key} className="space-y-3">
              {resources.filter(r => r.category === cat.key).length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                  No {cat.label.toLowerCase()} added yet.{isAdmin && ' Click "Add Resource" to add content.'}
                </CardContent></Card>
              ) : (
                resources.filter(r => r.category === cat.key).map(resource => (
                  <Card key={resource.id} className="card-hover">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-start gap-3 flex-1">
                          <div className="mt-0.5">
                            {resource.content_type === 'video' ? <Video className="h-5 w-5 text-primary" /> :
                             resource.content_type === 'document' ? <FileText className="h-5 w-5 text-accent" /> :
                             <Link className="h-5 w-5 text-secondary" />}
                          </div>
                          <div className="flex-1">
                            <p className="font-medium">{resource.title}</p>
                            {resource.description && <p className="text-sm text-muted-foreground mt-1">{resource.description}</p>}
                            <div className="flex gap-2 mt-3">
                              {isEmbeddable(resource.content_url) ? (
                                <Button variant="outline" size="sm" onClick={() => setViewingResource(resource)}>
                                  View Inline
                                </Button>
                              ) : null}
                              <Button variant="ghost" size="sm" asChild>
                                <a href={resource.content_url} target="_blank" rel="noopener noreferrer">
                                  <ExternalLink className="h-3 w-3 mr-1" /> Open
                                </a>
                              </Button>
                            </div>
                          </div>
                        </div>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(resource)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(resource.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>

        {/* Inline Viewer */}
        <Dialog open={!!viewingResource} onOpenChange={(o) => { if (!o) setViewingResource(null); }}>
          <DialogContent className="max-w-4xl max-h-[85vh]">
            <DialogHeader><DialogTitle>{viewingResource?.title}</DialogTitle></DialogHeader>
            <div className="aspect-video w-full">
              <iframe src={viewingResource ? getEmbedUrl(viewingResource.content_url) : ''} className="w-full h-full rounded-lg border border-border" allowFullScreen />
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppLayout>
  );
}
