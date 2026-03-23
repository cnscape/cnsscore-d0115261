import { Link, useLocation } from 'react-router-dom';
import { 
  LayoutDashboard, ClipboardList, History, Trophy, Settings, Users, Target,
  LogOut, ChevronLeft, ChevronRight, Briefcase, TrendingUp, DollarSign, 
  FileText, FolderKanban, Send
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { XPProgress } from '@/components/ui/xp-progress';
import { StreakBadge } from '@/components/ui/streak-badge';

export function Sidebar() {
  const location = useLocation();
  const { profile, isAdmin, roles, signOut } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  // Determine team type from roles
  const isGrowthTeam = roles.includes('growth_team' as any);
  const isSalesRep = roles.includes('sales_rep');

  const salesLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/scorecard', label: "Today's Scorecard", icon: ClipboardList },
    { href: '/deals', label: 'My Deals', icon: Briefcase },
    { href: '/history', label: 'My History', icon: History },
    { href: '/achievements', label: 'Achievements', icon: Trophy },
    { href: '/settings', label: 'Settings', icon: Settings },
  ];

  const growthLinks = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/daily-update', label: 'Daily Update', icon: Send },
    { href: '/projects', label: 'My Projects', icon: FolderKanban },
    { href: '/achievements', label: 'Achievements', icon: Trophy },
  ];

  const adminLinks = [
    { href: '/admin', label: 'Command Center', icon: LayoutDashboard },
    { href: '/admin/clients', label: 'Clients & Offers', icon: Briefcase },
    { href: '/admin/deals', label: 'All Deals', icon: FileText },
    { href: '/admin/campaigns', label: 'Campaigns', icon: Target },
    { href: '/admin/team', label: 'Team', icon: Users },
    { href: '/admin/commissions', label: 'Commissions', icon: DollarSign },
    { href: '/admin/funnel', label: 'Funnel Analytics', icon: TrendingUp },
    { href: '/admin/settings', label: 'Settings', icon: Settings },
  ];

  const links = isAdmin ? adminLinks : isGrowthTeam ? growthLinks : salesLinks;
  const roleLabel = isAdmin ? 'Admin' : isGrowthTeam ? 'Growth Team' : 'Sales Rep';

  return (
    <aside className={cn(
      "flex h-screen flex-col border-r border-border bg-sidebar transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      {/* Logo */}
      <div className="flex h-16 items-center justify-between border-b border-border px-4">
        {!collapsed && (
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground font-bold text-xs">
              CNS
            </div>
            <span className="font-semibold text-foreground">Cape Neto</span>
          </div>
        )}
        <Button variant="ghost" size="icon" onClick={() => setCollapsed(!collapsed)} className="h-8 w-8">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* User Stats (non-admin) */}
      {!collapsed && profile && !isAdmin && (
        <div className="border-b border-border p-4 space-y-4">
          <XPProgress currentXP={profile.total_xp} level={profile.level} />
          <StreakBadge streak={profile.current_streak} longestStreak={profile.longest_streak} />
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-3">
        <ul className="space-y-1">
          {links.map(link => {
            const Icon = link.icon;
            const isActive = location.pathname === link.href;
            return (
              <li key={link.href}>
                <Link
                  to={link.href}
                  className={cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary/15 text-primary border-l-2 border-primary" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-5 w-5 flex-shrink-0" />
                  {!collapsed && <span>{link.label}</span>}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Sign Out */}
      <div className="border-t border-border p-4">
        {!collapsed && profile && (
          <div className="mb-3 flex items-center gap-3">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/20 text-primary text-sm font-bold">
              {profile.full_name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 truncate">
              <p className="text-sm font-medium truncate">{profile.full_name}</p>
              <p className="text-xs text-muted-foreground">{roleLabel}</p>
            </div>
          </div>
        )}
        <Button
          variant="ghost"
          className={cn("w-full justify-start text-muted-foreground hover:text-foreground", collapsed && "justify-center px-2")}
          onClick={signOut}
        >
          <LogOut className="h-5 w-5" />
          {!collapsed && <span className="ml-3">Sign Out</span>}
        </Button>
      </div>
    </aside>
  );
}
