import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, History, Trophy, Settings, Users, Target,
  LogOut, ChevronLeft, ChevronRight, Briefcase, TrendingUp, DollarSign, 
  FileText, FolderKanban, Send, Kanban, BookOpen, GraduationCap, UserPlus, Phone, CalendarDays, Wallet
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { XPProgress } from '@/components/ui/xp-progress';
import { StreakBadge } from '@/components/ui/streak-badge';
import { Separator } from '@/components/ui/separator';

export function Sidebar() {
  const location = useLocation();
  const { profile, isAdmin, roles, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const isGrowthTeam = roles.includes('growth_team' as any);
  const isScout = roles.includes('scout' as any);

  const salesLinks = [
    { href: '/daily-work', label: 'Daily Work', icon: LayoutDashboard },
    { href: '/crm', label: 'CRM Pipeline', icon: Kanban },
    { href: '/scorecard', label: "Today's Scorecard", icon: ClipboardList },
    { href: '/deals', label: 'My Deals', icon: Briefcase },
    { href: '/my-commission', label: 'My Commission', icon: DollarSign },
    { href: '/collections', label: 'Collections', icon: Wallet },
    { href: '/playbook', label: 'Playbook', icon: BookOpen },
    { href: '/training', label: 'Training & SOPs', icon: GraduationCap },
    { href: '/history', label: 'My History', icon: History },
    { href: '/achievements', label: 'Achievements', icon: Trophy },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const scoutLinks = [
    { href: '/daily-work', label: 'Daily Work', icon: LayoutDashboard },
    { href: '/book-call', label: 'Book a Call', icon: Phone },
    { href: '/crm', label: 'CRM Pipeline', icon: Kanban },
    { href: '/deals', label: 'My Deals', icon: Briefcase },
    { href: '/my-commission', label: 'My Commission', icon: DollarSign },
    { href: '/collections', label: 'Collections', icon: Wallet },
    { href: '/playbook', label: 'Playbook', icon: BookOpen },
    { href: '/training', label: 'Training & SOPs', icon: GraduationCap },
    { href: '/achievements', label: 'Achievements', icon: Trophy },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const growthLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/daily-update', label: 'Daily Update', icon: Send },
    { href: '/projects', label: 'My Projects', icon: FolderKanban },
    { href: '/playbook', label: 'Playbook', icon: BookOpen },
    { href: '/training', label: 'Training & SOPs', icon: GraduationCap },
    { href: '/achievements', label: 'Achievements', icon: Trophy },
  ];

  const adminMainLinks = [
    { href: '/admin', label: 'Command Center', icon: LayoutDashboard },
    { href: '/admin/leads', label: 'Lead Distribution', icon: UserPlus },
    { href: '/admin/deals', label: 'All Deals', icon: FileText },
    { href: '/admin/campaigns', label: 'Campaigns', icon: Target },
    { href: '/admin/clients', label: 'Clients & Offers', icon: Briefcase },
    { href: '/admin/team', label: 'Team', icon: Users },
    { href: '/admin/calendars', label: 'Booking System', icon: CalendarDays },
    { href: '/admin/performance', label: 'Team Performance', icon: TrendingUp },
    { href: '/admin/collections', label: 'Collections CRM', icon: Wallet },
  ];

  const adminToolLinks = [
    { href: '/admin/playbook', label: 'Playbook', icon: BookOpen },
    { href: '/admin/training', label: 'Training & SOPs', icon: GraduationCap },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const links = isAdmin ? adminMainLinks : isGrowthTeam ? growthLinks : isScout ? scoutLinks : salesLinks;
  const roleLabel = isAdmin ? 'Admin' : isGrowthTeam ? 'Growth Team' : isScout ? 'Scout' : 'Sales Rep';

  return (
    <aside className={cn(
      "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">NH</div>
            <span className="font-semibold text-foreground">NetoHub</span>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="h-8 w-8">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {!collapsed && profile && !isAdmin && (
        <div className="border-b border-border p-4 space-y-4">
          <XPProgress currentXP={profile.total_xp} level={profile.level} />
          <StreakBadge streak={profile.current_streak} longestStreak={profile.longest_streak} />
        </div>
      )}

      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {links.map(link => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;
            return (
              <li key={link.href}>
                <Link to={link.href} className={cn(
                  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                  isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}>
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>

        {/* Admin extra section */}
        {isAdmin && (
          <>
            {!collapsed && <Separator className="my-3" />}
            <ul className="space-y-1">
              {adminToolLinks.map(link => {
                const Icon = link.icon;
                const isActive = location.pathname === link.href;
                return (
                  <li key={link.href}>
                    <Link to={link.href} className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      isActive ? "bg-primary/15 text-primary border-l-2 border-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground"
                    )}>
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      {!collapsed && <span>{link.label}</span>}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </nav>

      <div className="border-t border-border p-4">
        {!collapsed && profile && (
          <div className="mb-3 flex items-center gap-3">
            {profile.avatar_url ? (
              <img src={profile.avatar_url} alt="" className="h-8 w-8 rounded-full object-cover" />
            ) : (
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
                {profile.full_name.charAt(0).toUpperCase()}
              </div>
            )}
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        )}
        <Button variant="ghost" className={cn("w-full justify-start text-muted-foreground hover:text-foreground", collapsed && "justify-center px-2")} onClick={signOut}>
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-3">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
