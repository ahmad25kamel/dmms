import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthContext, useAuthState, useAuth } from './store/authStore';
import { AppShell } from './components/layout/AppShell';
import { LoginPage } from './pages/auth/LoginPage';
import { RegisterPage } from './pages/auth/RegisterPage';
import { DashboardPage } from './pages/dashboard/DashboardPage';
import { ProjectsPage } from './pages/projects/ProjectsPage';
import { ProjectDetailPage } from './pages/projects/ProjectDetailPage';
import { DeliverableTreePage } from './pages/deliverables/DeliverableTreePage';
import { MarketplacePage } from './pages/marketplace/MarketplacePage';
import { ProposalsPage } from './pages/proposals/ProposalsPage';
import { ProposalReviewPage } from './pages/proposals/ProposalReviewPage';
import { WorkspaceListPage } from './pages/workspace/WorkspaceListPage';
import { WorkspacePage } from './pages/workspace/WorkspacePage';
import { ReviewCenterPage } from './pages/review/ReviewCenterPage';
import { LedgerPage } from './pages/ledger/LedgerPage';
import { BudgetPage } from './pages/budget/BudgetPage';
import { AdminPage } from './pages/admin/AdminPage';
import { KanbanPage } from './pages/kanban/KanbanPage';
import { Spinner } from './components/ui';
import type { ReactNode } from 'react';

function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function PublicOnly({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return <Spinner />;
  if (user) return <Navigate to="/dashboard" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><LoginPage /></PublicOnly>} />
      <Route path="/register" element={<PublicOnly><RegisterPage /></PublicOnly>} />
      <Route element={<RequireAuth><AppShell /></RequireAuth>}>
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route path="/projects/:projectId/tree" element={<DeliverableTreePage />} />
        <Route path="/deliverables" element={<Navigate to="/projects" replace />} />
        <Route path="/marketplace" element={<MarketplacePage />} />
        <Route path="/proposals" element={<ProposalsPage />} />
        <Route path="/proposals/review/:deliverableId" element={<ProposalReviewPage />} />
        <Route path="/workspace" element={<WorkspaceListPage />} />
        <Route path="/workspace/:id" element={<WorkspacePage />} />
        <Route path="/review" element={<ReviewCenterPage />} />
        <Route path="/ledger" element={<LedgerPage />} />
        <Route path="/budget" element={<BudgetPage />} />
        <Route path="/kanban" element={<KanbanPage />} />
        <Route path="/admin" element={<AdminPage />} />
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
      </Route>
    </Routes>
  );
}

export default function App() {
  const authState = useAuthState();
  return (
    <AuthContext.Provider value={authState}>
      <BrowserRouter>
        <AppRoutes />
      </BrowserRouter>
    </AuthContext.Provider>
  );
}
