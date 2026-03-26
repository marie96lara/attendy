import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { LogOut, GraduationCap } from 'lucide-react';
import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

interface LayoutProps {
  children: ReactNode;
  nav: { label: string; path: string }[];
}

export default function AppLayout({ children, nav }: LayoutProps) {
  const { profile, signOut } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Top bar */}
      <header className="border-b border-border/50 bg-card/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary">
              <GraduationCap className="w-4 h-4 text-primary-foreground" />
            </div>
            <span className="font-semibold text-foreground tracking-tight">Attendy</span>
            <span className="text-xs bg-secondary text-secondary-foreground px-2 py-0.5 rounded-md font-medium capitalize">
              {profile?.role}
            </span>
          </div>
          <div className="flex items-center gap-6">
            <nav className="hidden md:flex items-center gap-1">
              {nav.map(item => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`px-3 py-1.5 text-sm rounded-md transition-colors ${
                    location.pathname === item.path
                      ? 'bg-primary text-primary-foreground font-medium'
                      : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground hidden sm:block">{profile?.name}</span>
              <Button variant="ghost" size="icon" onClick={signOut} className="h-8 w-8">
                <LogOut className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </header>
      {/* Mobile nav */}
      <nav className="md:hidden border-b border-border/50 bg-card/50 overflow-x-auto">
        <div className="flex items-center gap-1 px-4 py-2">
          {nav.map(item => (
            <Link
              key={item.path}
              to={item.path}
              className={`px-3 py-1.5 text-sm rounded-md whitespace-nowrap transition-colors ${
                location.pathname === item.path
                  ? 'bg-primary text-primary-foreground font-medium'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </div>
      </nav>
      <main className="container px-4 py-6">{children}</main>
    </div>
  );
}
