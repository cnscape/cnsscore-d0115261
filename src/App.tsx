import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { Loader2 } from "lucide-react";

// Pages
import AuthPage from "./pages/AuthPage";
import RepDashboard from "./pages/RepDashboard";
import ScorecardPage from "./pages/ScorecardPage";
import HistoryPage from "./pages/HistoryPage";
import AchievementsPage from "./pages/AchievementsPage";
import AdminDashboard from "./pages/AdminDashboard";
import CampaignsPage from "./pages/CampaignsPage";
import TeamPage from "./pages/TeamPage";
import ClientsPage from "./pages/ClientsPage";
import DealsPage from "./pages/DealsPage";
import DailyUpdatePage from "./pages/DailyUpdatePage";
import ProjectsPage from "./pages/ProjectsPage";
import SettingsPage from "./pages/SettingsPage";
import MyCommissionPage from "./pages/MyCommissionPage";
import DailyWorkPage from "./pages/DailyWorkPage";
import TrainingPage from "./pages/TrainingPage";
import AdminLeadsPage from "./pages/AdminLeadsPage";
import ScoutBookingPage from "./pages/ScoutBookingPage";
import AdminCalendarsPage from "./pages/AdminCalendarsPage";
import AdminTeamPerformancePage from "./pages/AdminTeamPerformancePage";
import CollectionsCRMPage from "./pages/CollectionsCRMPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!user) return <Navigate to="/auth" replace />;
  if (adminOnly && !isAdmin) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user, isAdmin, isLoading } = useAuth();
  if (isLoading) return <div className="flex min-h-screen items-center justify-center bg-background"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  return (
    <Routes>
      <Route path="/auth" element={<AuthPage />} />
      <Route path="/" element={user ? <Navigate to={isAdmin ? "/admin" : "/daily-work"} replace /> : <Navigate to="/auth" replace />} />
      
      {/* Shared routes */}
      <Route path="/dashboard" element={<ProtectedRoute><RepDashboard /></ProtectedRoute>} />
      <Route path="/daily-work" element={<ProtectedRoute><DailyWorkPage /></ProtectedRoute>} />
      <Route path="/crm" element={<ProtectedRoute><Navigate to="/deals" replace /></ProtectedRoute>} />
      <Route path="/book-call" element={<ProtectedRoute><ScoutBookingPage /></ProtectedRoute>} />
      <Route path="/scorecard" element={<ProtectedRoute><ScorecardPage /></ProtectedRoute>} />
      <Route path="/deals" element={<ProtectedRoute><DealsPage /></ProtectedRoute>} />
      <Route path="/my-commission" element={<ProtectedRoute><MyCommissionPage /></ProtectedRoute>} />
      <Route path="/training" element={<ProtectedRoute><TrainingPage /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      <Route path="/history" element={<ProtectedRoute><Navigate to="/achievements" replace /></ProtectedRoute>} />
      <Route path="/achievements" element={<ProtectedRoute><AchievementsPage /></ProtectedRoute>} />
      
      {/* Growth Team routes */}
      <Route path="/daily-update" element={<ProtectedRoute><DailyUpdatePage /></ProtectedRoute>} />
      <Route path="/projects" element={<ProtectedRoute><ProjectsPage /></ProtectedRoute>} />
      
      {/* Admin routes */}
      <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
      <Route path="/admin/clients" element={<ProtectedRoute adminOnly><ClientsPage /></ProtectedRoute>} />
      <Route path="/admin/deals" element={<ProtectedRoute adminOnly><DealsPage adminView /></ProtectedRoute>} />
      <Route path="/admin/campaigns" element={<ProtectedRoute adminOnly><CampaignsPage /></ProtectedRoute>} />
      <Route path="/admin/team" element={<ProtectedRoute adminOnly><TeamPage /></ProtectedRoute>} />
      <Route path="/admin/leads" element={<ProtectedRoute adminOnly><AdminLeadsPage /></ProtectedRoute>} />
      <Route path="/admin/training" element={<ProtectedRoute adminOnly><TrainingPage /></ProtectedRoute>} />
      <Route path="/admin/calendars" element={<ProtectedRoute adminOnly><AdminCalendarsPage /></ProtectedRoute>} />
      <Route path="/admin/performance" element={<ProtectedRoute adminOnly><AdminTeamPerformancePage /></ProtectedRoute>} />
      <Route path="/admin/collections" element={<ProtectedRoute adminOnly><CollectionsCRMPage /></ProtectedRoute>} />
      <Route path="/collections" element={<ProtectedRoute adminOnly><Navigate to="/admin/collections" replace /></ProtectedRoute>} />
      <Route path="/admin/settings" element={<ProtectedRoute adminOnly><SettingsPage /></ProtectedRoute>} />
      
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <AppRoutes />
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
