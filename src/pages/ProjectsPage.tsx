import { useEffect, useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FolderKanban, CheckCircle, AlertTriangle, XCircle, Calendar } from 'lucide-react';

interface Project {
  id: string;
  name: string;
  description: string;
  status: string;
  due_date: string | null;
  notes: string;
  created_at: string;
}

interface Task {
  id: string;
  project_id: string;
  title: string;
  status: string;
  due_date: string | null;
  description: string;
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const [projects, setProjects] = useState<Project[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const { data: projectsData } = await (supabase as any)
          .from('projects')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (projectsData) setProjects(projectsData as Project[]);

        const { data: tasksData } = await (supabase as any)
          .from('tasks')
          .select('*')
          .order('created_at', { ascending: false });

        if (tasksData) setTasks(tasksData as Task[]);
      } catch (e) {
        // Tables may not exist yet
      }
      setIsLoading(false);
    };
    fetchData();
  }, [user]);

  const statusIcon = (status: string) => {
    switch (status) {
      case 'on_track': return <CheckCircle className="h-4 w-4 text-[hsl(var(--status-green))]" />;
      case 'at_risk': return <AlertTriangle className="h-4 w-4 text-secondary" />;
      case 'blocked': return <XCircle className="h-4 w-4 text-destructive" />;
      default: return null;
    }
  };

  const statusLabel: Record<string, string> = { on_track: 'On Track', at_risk: 'At Risk', blocked: 'Blocked' };
  const taskStatusColors: Record<string, string> = {
    todo: 'bg-muted text-muted-foreground',
    in_progress: 'bg-primary/20 text-primary',
    done: 'bg-[hsl(var(--status-green))]/20 text-[hsl(var(--status-green))]',
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

  const projectTasks = selectedProject ? tasks.filter(t => t.project_id === selectedProject) : [];
  const selected = projects.find(p => p.id === selectedProject);

  return (
    <AppLayout>
      <div className="p-6 lg:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold">My Projects</h1>
          <p className="text-muted-foreground">Track your assigned projects and tasks</p>
        </div>

        {projects.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
              <p>No projects assigned yet. Your admin will assign projects to you.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 lg:grid-cols-3">
            <div className="lg:col-span-1 space-y-3">
              {projects.map(project => (
                <Card
                  key={project.id}
                  className={`cursor-pointer card-hover ${selectedProject === project.id ? 'border-primary' : ''}`}
                  onClick={() => setSelectedProject(project.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        {statusIcon(project.status)}
                        <p className="font-semibold">{project.name}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {statusLabel[project.status] || project.status}
                      </Badge>
                    </div>
                    {project.due_date && (
                      <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> Due: {project.due_date}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="lg:col-span-2">
              {selected ? (
                <div className="space-y-6">
                  <Card>
                    <CardHeader>
                      <div className="flex items-center justify-between">
                        <CardTitle>{selected.name}</CardTitle>
                        <Badge>{statusLabel[selected.status]}</Badge>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <p className="text-sm text-muted-foreground">{selected.description || 'No description'}</p>
                      {selected.notes && (
                        <div className="mt-4 rounded-lg border border-border p-3 bg-muted/30">
                          <p className="text-xs font-medium text-muted-foreground mb-1">Notes</p>
                          <p className="text-sm">{selected.notes}</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader><CardTitle className="text-lg">Tasks</CardTitle></CardHeader>
                    <CardContent>
                      {projectTasks.length > 0 ? (
                        <div className="space-y-2">
                          {projectTasks.map(task => (
                            <div key={task.id} className="flex items-center justify-between p-3 rounded-lg border border-border bg-muted/20">
                              <div>
                                <p className="font-medium text-sm">{task.title}</p>
                                {task.due_date && <p className="text-xs text-muted-foreground">Due: {task.due_date}</p>}
                              </div>
                              <Badge className={taskStatusColors[task.status] || ''} variant="outline">
                                {task.status.replace('_', ' ')}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground text-center py-4">No tasks yet.</p>
                      )}
                    </CardContent>
                  </Card>
                </div>
              ) : (
                <Card>
                  <CardContent className="p-12 text-center text-muted-foreground">
                    <FolderKanban className="h-12 w-12 mx-auto mb-4 opacity-30" />
                    <p>Select a project to view details and tasks</p>
                  </CardContent>
                </Card>
              )}
            </div>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
