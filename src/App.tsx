import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes, Navigate } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import LoginPage from "@/pages/LoginPage";
import AppLayout from "@/components/AppLayout";
import StudentDashboard from "@/pages/student/StudentDashboard";
import StudentMarkAttendance from "@/pages/student/MarkAttendance";
import FacultyTakeAttendance from "@/pages/faculty/TakeAttendance";
import FacultyReports from "@/pages/faculty/FacultyReports";
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminReports from "@/pages/admin/AdminReports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const STUDENT_NAV = [
  { label: 'Dashboard', path: '/' },
  { label: 'Mark Attendance', path: '/mark-attendance' },
];

const FACULTY_NAV = [
  { label: 'Take Attendance', path: '/' },
  { label: 'Reports', path: '/reports' },
];

const ADMIN_NAV = [
  { label: 'Dashboard', path: '/' },
  { label: 'Reports', path: '/reports' },
];

function AppRoutes() {
  const { user, role, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <p className="text-sm text-muted-foreground">Loading…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginPage />;
  }

  if (role === 'student') {
    return (
      <AppLayout nav={STUDENT_NAV}>
        <Routes>
          <Route path="/" element={<StudentDashboard />} />
          <Route path="/mark-attendance" element={<StudentMarkAttendance />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppLayout>
    );
  }

  if (role === 'faculty') {
    return (
      <AppLayout nav={FACULTY_NAV}>
        <Routes>
          <Route path="/" element={<FacultyTakeAttendance />} />
          <Route path="/reports" element={<FacultyReports />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppLayout>
    );
  }

  if (role === 'admin') {
    return (
      <AppLayout nav={ADMIN_NAV}>
        <Routes>
          <Route path="/" element={<AdminDashboard />} />
          <Route path="/reports" element={<AdminReports />} />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AppLayout>
    );
  }

  return <LoginPage />;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <AuthProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
