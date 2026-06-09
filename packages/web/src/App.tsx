import { Link, NavLink, Routes, Route, Navigate, Outlet } from 'react-router-dom';
import {
  Building2,
  Users,
  UserRound,
  FileCheck2,
  CalendarRange,
  ClipboardList,
  ClipboardCheck,
  ListChecks,
  GraduationCap,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from './lib/utils.js';
import { Button } from './components/ui/button.js';
import { useAuth } from './lib/AuthContext.js';
import { AgencySetupPage } from './features/agency/AgencySetupPage.js';
import { AgencySettingsPage } from './features/agency/AgencySettingsPage.js';
import { StaffPage } from './features/staff/StaffPage.js';
import { ClientsPage } from './features/clients/ClientsPage.js';
import { AuthorizationsPage } from './features/authorizations/AuthorizationsPage.js';
import { TemplatesPage } from './features/scheduling/TemplatesPage.js';
import { AssignmentsPage } from './features/scheduling/AssignmentsPage.js';
import { LoginPage } from './features/auth/LoginPage.js';
import { AcceptInvitePage } from './features/auth/AcceptInvitePage.js';
import { LandingPage } from './features/landing/LandingPage.js';
import { VisitReviewPage } from './features/evv/VisitReviewPage.js';
import { VisitCorrectionsQueuePage } from './features/evv/VisitCorrectionsQueuePage.js';
import { VisitCorrectionsTrackingPage } from './features/evv/VisitCorrectionsTrackingPage.js';
import { LearningDashboardPage } from './features/learning/LearningDashboardPage.js';
import { CourseCatalogPage } from './features/learning/CourseCatalogPage.js';
import { CaregiverLearningPage } from './features/learning/CaregiverLearningPage.js';
import { LearningAnalyticsPage } from './features/learning/LearningAnalyticsPage.js';
import { CourseDetailPage } from './features/learning/CourseDetailPage.js';
import { CopilotChatPage } from './features/learning/CopilotChatPage.js';

function ProtectedRoute() {
  const { isAuthenticated } = useAuth();
  
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof Building2;
  end?: boolean;
}

interface NavSection {
  heading: string;
  items: NavItem[];
}

const NAV_SECTIONS: NavSection[] = [
  {
    heading: 'Organization',
    items: [
      { to: '/admin/agency', label: 'Agency Setup', icon: Building2 },
      { to: '/admin/staff', label: 'Staff', icon: Users },
      { to: '/admin/clients', label: 'Clients', icon: UserRound },
      { to: '/admin/authorizations', label: 'Authorizations', icon: FileCheck2 },
    ],
  },
  {
    heading: 'Scheduling',
    items: [
      { to: '/admin/templates', label: 'Templates', icon: CalendarRange },
      { to: '/admin/assignments', label: 'Assignments', icon: ClipboardList },
    ],
  },
  {
    heading: 'Visits',
    items: [
      { to: '/admin/review', label: 'Visit Review', icon: ClipboardCheck },
      { to: '/admin/corrections', label: 'Corrections Queue', icon: ListChecks, end: true },
      { to: '/admin/corrections/tracking', label: 'Corrections Tracking', icon: ListChecks },
    ],
  },
  {
    heading: 'Workforce',
    items: [
      { to: '/admin/learning', label: 'Learning Hub', icon: GraduationCap, end: false },
      { to: '/admin/settings', label: 'Settings', icon: Settings },
    ],
  },
];

function SidebarLink({ item }: { item: NavItem }) {
  const Icon = item.icon;
  return (
    <NavLink
      to={item.to}
      end={item.end}
      className={({ isActive }) =>
        cn(
          'flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-white/15 text-white shadow-sm'
            : 'text-sky-100/80 hover:bg-white/10 hover:text-white',
        )
      }
    >
      <Icon className="size-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
    </NavLink>
  );
}

function AdminLayout() {
  const { logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-background">
      <nav className="flex w-64 shrink-0 flex-col gap-6 bg-[linear-gradient(180deg,#1248a0_0%,#1a5fa8_100%)] px-4 py-6 text-white shadow-[4px_0_15px_rgba(18,72,160,0.15)]">
        <Link
          to="/"
          className="flex items-center gap-2 px-2 font-display text-xl font-black tracking-tight text-white no-underline"
        >
          RayHealth
          <span className="rounded-full bg-accent px-2 py-0.5 text-[0.65rem] font-extrabold tracking-[0.18em]">
            EVV
          </span>
        </Link>

        <div className="flex flex-1 flex-col gap-5 overflow-y-auto">
          {NAV_SECTIONS.map((section) => (
            <div key={section.heading} className="flex flex-col gap-1">
              <p className="px-3 text-[0.68rem] font-bold uppercase tracking-[0.14em] text-sky-200/60">
                {section.heading}
              </p>
              {section.items.map((item) => (
                <SidebarLink key={item.to} item={item} />
              ))}
            </div>
          ))}
        </div>

        <Button
          variant="outline"
          onClick={logout}
          className="w-full border-white/25 bg-transparent text-white hover:bg-white/10 hover:text-white"
        >
          <LogOut className="size-4" aria-hidden />
          Sign Out
        </Button>
      </nav>

      <main className="flex-1 overflow-y-auto !p-0">
        <div className="mx-auto w-full max-w-6xl px-6 py-10 sm:px-10">
          <Outlet />
        </div>
      </main>
    </div>
  );
}

export function App() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/accept/:token" element={<AcceptInvitePage />} />
      
      <Route path="/admin" element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="agency" element={<AgencySetupPage />} />
          <Route path="settings" element={<AgencySettingsPage />} />
          <Route path="staff" element={<StaffPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="authorizations" element={<AuthorizationsPage />} />
          <Route path="templates" element={<TemplatesPage />} />
          <Route path="assignments" element={<AssignmentsPage />} />
          <Route path="review" element={<VisitReviewPage />} />
          <Route path="corrections" element={<VisitCorrectionsQueuePage />} />
          <Route path="corrections/tracking" element={<VisitCorrectionsTrackingPage />} />
          <Route path="learning" element={<LearningDashboardPage />} />
          <Route path="learning/courses" element={<CourseCatalogPage />} />
          <Route path="learning/caregivers/:id" element={<CaregiverLearningPage />} />
          <Route path="learning/analytics" element={<LearningAnalyticsPage />} />
          <Route path="learning/courses/:id" element={<CourseDetailPage />} />
          <Route path="learning/copilot" element={<CopilotChatPage />} />
          <Route index element={<Navigate to="/admin/agency" replace />} />
        </Route>
      </Route>
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
