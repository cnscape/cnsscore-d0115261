import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Loader2, Trophy, Target, Flame, Users, Briefcase, Shield } from 'lucide-react';

export default function AuthPage() {
  const { user, isLoading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (user) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex min-h-screen">
      {/* Left side - Branding */}
      <div className="hidden lg:flex lg:w-1/2 flex-col justify-center p-12 bg-card relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-1/4 left-1/4 h-64 w-64 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-1/4 right-1/4 h-48 w-48 rounded-full bg-secondary blur-3xl" />
        </div>
        
        <div className="relative z-10 max-w-md">
          <div className="flex items-center gap-3 mb-8">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-primary-foreground text-xl font-bold">
              CN
            </div>
            <span className="text-2xl font-bold">Cape Neto Solutions</span>
          </div>
          
          <h1 className="text-4xl font-bold mb-4 gradient-text">
            Track. Compete. Win.
          </h1>
          
          <p className="text-lg text-muted-foreground mb-12">
            Your performance operating system. 
            Hit targets, build streaks, close deals, and track projects.
          </p>
          
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/20 text-primary">
                <Target className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Daily Scorecard</p>
                <p className="text-sm text-muted-foreground">Quick 30-second daily check-in</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-gold/20 text-gold">
                <Trophy className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Earn Achievements</p>
                <p className="text-sm text-muted-foreground">Unlock badges and level up</p>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-streak/20 text-streak">
                <Flame className="h-6 w-6" />
              </div>
              <div>
                <p className="font-semibold">Build Streaks</p>
                <p className="text-sm text-muted-foreground">Consistency is rewarded</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right side - Auth forms */}
      <div className="flex w-full lg:w-1/2 items-center justify-center p-8">
        <Card className="w-full max-w-md border-border bg-card">
          <CardHeader className="text-center">
            <div className="flex lg:hidden items-center justify-center gap-2 mb-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold">
                CN
              </div>
              <span className="text-xl font-bold">Cape Neto</span>
            </div>
            <CardTitle className="text-2xl">Welcome</CardTitle>
            <CardDescription>Sign in to your account or create a new one</CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">Sign In</TabsTrigger>
                <TabsTrigger value="signup">Sign Up</TabsTrigger>
              </TabsList>
              
              <TabsContent value="signin">
                <SignInForm isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} />
              </TabsContent>
              
              <TabsContent value="signup">
                <SignUpForm isSubmitting={isSubmitting} setIsSubmitting={setIsSubmitting} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function SignInForm({ isSubmitting, setIsSubmitting }: { isSubmitting: boolean; setIsSubmitting: (v: boolean) => void }) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    const { error } = await signIn(email, password);
    
    if (error) {
      toast.error(error.message || 'Failed to sign in');
    } else {
      toast.success('Welcome back!');
    }
    
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signin-email">Email</Label>
        <Input id="signin-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signin-password">Password</Label>
        <Input id="signin-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required />
      </div>
      <Button type="submit" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Signing in...</>) : 'Sign In'}
      </Button>
    </form>
  );
}

function SignUpForm({ isSubmitting, setIsSubmitting }: { isSubmitting: boolean; setIsSubmitting: (v: boolean) => void }) {
  const { signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [teamType, setTeamType] = useState<string>('');

  const teamOptions = [
    { value: 'sales', label: 'Growth Sales Team', description: 'Sales reps — KPIs, deals, commissions', icon: Briefcase },
    { value: 'growth', label: 'Growth Team', description: 'Interns & projects — daily updates, tasks', icon: Users },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!teamType) {
      toast.error('Please select your team');
      return;
    }
    
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    
    setIsSubmitting(true);
    
    const { error } = await signUp(email, password, fullName);
    
    if (error) {
      if (error.message.includes('already registered')) {
        toast.error('This email is already registered. Try signing in instead.');
      } else {
        toast.error(error.message || 'Failed to create account');
      }
    } else {
      // Store team type in profile after signup
      // The profile will be created by the trigger, we'll update team_type
      toast.success('Account created! Check your email to verify, then sign in.');
    }
    
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="signup-name">Full Name</Label>
        <Input id="signup-name" type="text" placeholder="John Smith" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-email">Email</Label>
        <Input id="signup-email" type="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </div>
      <div className="space-y-2">
        <Label htmlFor="signup-password">Password</Label>
        <Input id="signup-password" type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
        <p className="text-xs text-muted-foreground">At least 6 characters</p>
      </div>

      {/* Team Type Selection */}
      <div className="space-y-2">
        <Label>Your Team <span className="text-destructive">*</span></Label>
        <div className="grid grid-cols-1 gap-2">
          {teamOptions.map(option => {
            const Icon = option.icon;
            const isSelected = teamType === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => setTeamType(option.value)}
                className={`flex items-center gap-3 p-3 rounded-lg border text-left transition-all ${
                  isSelected 
                    ? 'border-primary bg-primary/10 text-foreground' 
                    : 'border-border bg-muted/30 text-muted-foreground hover:border-primary/50'
                }`}
              >
                <Icon className={`h-5 w-5 flex-shrink-0 ${isSelected ? 'text-primary' : ''}`} />
                <div>
                  <p className="text-sm font-medium">{option.label}</p>
                  <p className="text-xs opacity-70">{option.description}</p>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={isSubmitting || !teamType}>
        {isSubmitting ? (<><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating account...</>) : 'Create Account'}
      </Button>
    </form>
  );
}
