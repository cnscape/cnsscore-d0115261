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
import { Loader2, Plus, BookOpen, Pencil, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface PlaybookSection {
  id: string;
  title: string;
  category: string;
  content: string;
  sort_order: number;
  created_at: string;
}

const CATEGORIES = [
  { key: 'outreach', label: 'Outreach Strategy' },
  { key: 'messaging', label: 'Messaging Frameworks' },
  { key: 'qualification', label: 'Qualification Criteria' },
  { key: 'call_structure', label: 'Call Structure' },
  { key: 'closing', label: 'Closing Methods' },
  { key: 'follow_up', label: 'Follow-Up Strategy' },
];

export default function PlaybookPage() {
  const { isAdmin } = useAuth();
  const [sections, setSections] = useState<PlaybookSection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [editingSection, setEditingSection] = useState<PlaybookSection | null>(null);
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('outreach');
  const [content, setContent] = useState('');

  const fetchSections = async () => {
    setIsLoading(true);
    const { data } = await supabase.from('playbook_sections').select('*').order('sort_order', { ascending: true });
    if (data) setSections(data as PlaybookSection[]);
    setIsLoading(false);
  };

  useEffect(() => { fetchSections(); }, []);

  const handleSave = async () => {
    if (!title.trim() || !content.trim()) { toast.error('Title and content are required'); return; }
    if (editingSection) {
      const { error } = await supabase.from('playbook_sections').update({
        title: title.trim(), category, content: content.trim(), updated_at: new Date().toISOString()
      } as any).eq('id', editingSection.id);
      if (error) { toast.error('Failed to update'); return; }
      toast.success('Section updated');
    } else {
      const { error } = await supabase.from('playbook_sections').insert([{
        title: title.trim(), category, content: content.trim(), sort_order: sections.length
      }] as any);
      if (error) { toast.error('Failed to create'); return; }
      toast.success('Section created');
    }
    setShowAdd(false); setEditingSection(null);
    setTitle(''); setContent(''); setCategory('outreach');
    fetchSections();
  };

  const handleDelete = async (id: string) => {
    const { error } = await supabase.from('playbook_sections').delete().eq('id', id);
    if (error) { toast.error('Failed to delete'); return; }
    toast.success('Section deleted');
    fetchSections();
  };

  const openEdit = (section: PlaybookSection) => {
    setEditingSection(section);
    setTitle(section.title);
    setCategory(section.category);
    setContent(section.content);
    setShowAdd(true);
  };

  if (isLoading) {
    return <AppLayout><div className="flex items-center justify-center h-full"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div></AppLayout>;
  }

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2"><BookOpen className="h-8 w-8 text-primary" /> Sales Playbook</h1>
            <p className="text-muted-foreground">Curated strategies and frameworks — no AI, purely human-crafted</p>
          </div>
          {isAdmin && (
            <Dialog open={showAdd} onOpenChange={(o) => { setShowAdd(o); if (!o) { setEditingSection(null); setTitle(''); setContent(''); } }}>
              <DialogTrigger asChild><Button><Plus className="h-4 w-4 mr-2" /> Add Section</Button></DialogTrigger>
              <DialogContent className="max-w-2xl">
                <DialogHeader><DialogTitle>{editingSection ? 'Edit Section' : 'Add Playbook Section'}</DialogTitle></DialogHeader>
                <div className="space-y-4 pt-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Title</Label>
                      <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Section title" />
                    </div>
                    <div className="space-y-2">
                      <Label>Category</Label>
                      <Select value={category} onValueChange={setCategory}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {CATEGORIES.map(c => <SelectItem key={c.key} value={c.key}>{c.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Content</Label>
                    <Textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Write the playbook content..." className="min-h-[300px]" />
                  </div>
                  <Button onClick={handleSave} className="w-full">{editingSection ? 'Update Section' : 'Add Section'}</Button>
                </div>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <Tabs defaultValue={CATEGORIES[0].key}>
          <TabsList className="flex-wrap h-auto gap-1">
            {CATEGORIES.map(c => {
              const count = sections.filter(s => s.category === c.key).length;
              return (
                <TabsTrigger key={c.key} value={c.key} className="text-xs">
                  {c.label} {count > 0 && <Badge variant="outline" className="ml-1 text-xs">{count}</Badge>}
                </TabsTrigger>
              );
            })}
          </TabsList>

          {CATEGORIES.map(cat => (
            <TabsContent key={cat.key} value={cat.key} className="space-y-4">
              {sections.filter(s => s.category === cat.key).length === 0 ? (
                <Card><CardContent className="py-12 text-center text-muted-foreground">
                  No content in {cat.label} yet.{isAdmin && ' Click "Add Section" to create content.'}
                </CardContent></Card>
              ) : (
                sections.filter(s => s.category === cat.key).map(section => (
                  <Card key={section.id}>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle className="text-lg">{section.title}</CardTitle>
                        {isAdmin && (
                          <div className="flex gap-1">
                            <Button variant="ghost" size="sm" onClick={() => openEdit(section)}><Pencil className="h-4 w-4" /></Button>
                            <Button variant="ghost" size="sm" className="text-destructive" onClick={() => handleDelete(section.id)}><Trash2 className="h-4 w-4" /></Button>
                          </div>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent>
                      <div className="prose prose-invert max-w-none whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
                        {section.content}
                      </div>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </AppLayout>
  );
}
