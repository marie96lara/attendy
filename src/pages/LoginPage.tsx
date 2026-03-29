import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { GraduationCap, Users, Shield, RefreshCw } from 'lucide-react';
import { createClient } from '@supabase/supabase-js';

// Your Supabase configuration
const supabaseUrl = "https://vtvfljikljzsexfygpjb.supabase.co";
const supabaseAnonKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InZ0dmZsamlrbGp6c2V4ZnlncGpiIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MTUxNjQsImV4cCI6MjA5MDA5MTE2NH0.WRa_Hw1afNZjbSINDFs6vb4nendc4WYHbpN-5Qe8-Gw";
const supabase = createClient(supabaseUrl, supabaseAnonKey);

const DEMO_ACCOUNTS = [
  { label: 'Student', email: 'student1@attendy.demo', password: 'demo123456', icon: GraduationCap, description: 'View attendance & mark presence' },
  { label: 'Faculty', email: 'faculty1@attendy.demo', password: 'demo123456', icon: Users, description: 'Take attendance & view reports' },
  { label: 'Admin', email: 'admin@attendy.demo', password: 'demo123456', icon: Shield, description: 'Full system overview & reports' },
];

export default function LoginPage() {
  const { signIn } = useAuth();
  const { toast } = useToast();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e?: React.FormEvent) => {
    e?.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
    } catch (err: any) {
      toast({ title: 'Login failed', description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  const handleDemoLogin = async (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setLoading(true);
    try {
      await signIn(demoEmail, demoPassword);
    } finally {
      setLoading(false);
    }
  };

  const handleResetDemo = async () => {
    if (!confirm('⚠️ RESET ALL DEMO DATA?\n\nThis will permanently delete:\n• All attendance records\n• All attendance sessions\n\nThis action cannot be undone. Continue?')) {
      return;
    }
    
    setLoading(true);
    toast({ title: 'Resetting demo data...', description: 'Clearing database records' });
    
    try {
      // First, check if tables exist and delete records
      console.log('Attempting to reset demo data...');
      
      // Try to delete from attendance_records
      const { data: recordsData, error: recordsError } = await supabase
        .from('attendance_records')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (recordsError) {
        console.log('Records delete error:', recordsError);
        // If table doesn't exist, that's fine
        if (!recordsError.message.includes('does not exist')) {
          throw recordsError;
        }
      } else {
        console.log('Deleted attendance records');
      }
      
      // Try to delete from attendance_sessions
      const { data: sessionsData, error: sessionsError } = await supabase
        .from('attendance_sessions')
        .delete()
        .neq('id', '00000000-0000-0000-0000-000000000000');
      
      if (sessionsError) {
        console.log('Sessions delete error:', sessionsError);
        // If table doesn't exist, that's fine
        if (!sessionsError.message.includes('does not exist')) {
          throw sessionsError;
        }
      } else {
        console.log('Deleted attendance sessions');
      }
      
      toast({ 
        title: '✅ Reset complete!', 
        description: 'All attendance data has been cleared',
      });
      
      setTimeout(() => window.location.reload(), 1500);
      
    } catch (error: any) {
      console.error('Reset error:', error);
      
      // If tables don't exist, show appropriate message
      if (error.message?.includes('does not exist')) {
        toast({ 
          title: 'ℹ️ No data to reset', 
          description: 'The database tables have not been created yet.',
          variant: 'default'
        });
      } else {
        toast({ 
          title: '❌ Reset failed', 
          description: error.message || 'Please try again',
          variant: 'destructive'
        });
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4 relative">
      <div className="w-full max-w-md space-y-6">
        {/* Logo / Brand */}
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary mb-2">
            <GraduationCap className="w-7 h-7 text-primary-foreground" />
          </div>
          <h1 className="text-3xl font-bold text-foreground tracking-tight">Attendy</h1>
          <p className="text-muted-foreground text-sm">Digital Attendance Management System</p>
        </div>

        {/* Login Form */}
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-lg">Sign in</CardTitle>
            <CardDescription>Enter your credentials to continue</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                type="email"
                placeholder="Email address"
                value={email}
                onChange={e => setEmail(e.target.value)}
                className="h-11"
                disabled={loading}
              />
              <Input
                type="password"
                placeholder="Password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                className="h-11"
                disabled={loading}
              />
              <Button type="submit" className="w-full h-11" disabled={loading}>
                {loading ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Demo Login Buttons */}
        <div className="space-y-3">
          <p className="text-xs text-muted-foreground text-center uppercase tracking-wider font-medium">
            Quick Demo Access
          </p>
          <div className="grid gap-2">
            {DEMO_ACCOUNTS.map(demo => (
              <button
                key={demo.email}
                onClick={() => handleDemoLogin(demo.email, demo.password)}
                disabled={loading}
                className="flex items-center gap-3 w-full p-3 rounded-lg border border-border/50 bg-card hover:bg-accent transition-colors text-left group"
              >
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-secondary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <demo.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{demo.label}</p>
                  <p className="text-xs text-muted-foreground">{demo.description}</p>
                </div>
              </button>
            ))}
          </div>
        </div>

        <p className="text-xs text-center text-muted-foreground">
          Silver Oak University Attendance System
        </p>
      </div>

      {/* Reset Button - Bottom Right */}
      <button
        onClick={handleResetDemo}
        disabled={loading}
        className="fixed bottom-4 right-4 p-2 rounded-lg bg-muted/50 hover:bg-red-500/10 border border-border/50 hover:border-red-500/30 transition-all group disabled:opacity-50 z-50"
        title="Reset all demo data"
      >
        <RefreshCw className={`w-4 h-4 text-muted-foreground group-hover:text-red-500 transition-colors ${loading ? 'animate-spin' : ''}`} />
      </button>
    </div>
  );
}