import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { generateOTP, hashCode } from '@/lib/attendance';
import { useToast } from '@/hooks/use-toast';
import { RefreshCw, StopCircle, CheckCircle2, User } from 'lucide-react';

interface StudentRecord {
  id: string;
  student_id: string;
  marked_at: string;
  profiles?: { name: string; roll_number: string | null } | null;
}

export default function FacultyTakeAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState('');
  const [currentCode, setCurrentCode] = useState('');
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [isActive, setIsActive] = useState(false);
  const [timeLeft, setTimeLeft] = useState(0);
  const [students, setStudents] = useState<StudentRecord[]>([]);

  // Fetch faculty subjects
  useEffect(() => {
    if (!user) return;
    supabase.from('subjects').select('*').eq('faculty_id', user.id)
      .then(({ data }) => { if (data) setSubjects(data); });
  }, [user]);

  // Timer countdown
  useEffect(() => {
    if (!isActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 100) {
          return 0;
        }
        return prev - 100;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isActive, timeLeft]);

  // When timer expires, code is expired but session stays active for viewing
  useEffect(() => {
    if (isActive && timeLeft <= 0 && currentCode) {
      // Code expired, but session remains for faculty to see results
    }
  }, [isActive, timeLeft, currentCode]);

  // Realtime subscription for attendance records
  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`attendance-${sessionId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'attendance_records',
          filter: `session_id=eq.${sessionId}`,
        },
        async (payload) => {
          const record = payload.new as any;
          // Fetch student profile
          const { data: profile } = await supabase
            .from('profiles')
            .select('name, roll_number')
            .eq('id', record.student_id)
            .single();
          
          setStudents(prev => [...prev, { ...record, profiles: profile }]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [sessionId]);

  const generateNewCode = useCallback(async () => {
    if (!selectedSubject || !user) return;

    const code = generateOTP();
    const hash = await hashCode(code);
    const expiresAt = new Date(Date.now() + 30000).toISOString(); // 30 seconds

    // If there's an existing session, update it; otherwise create new
    if (sessionId) {
      await supabase.from('attendance_sessions')
        .update({ code_hash: hash, expires_at: expiresAt, is_active: true })
        .eq('id', sessionId);
    } else {
      const { data, error } = await supabase.from('attendance_sessions').insert({
        faculty_id: user.id,
        subject_id: selectedSubject,
        code_hash: hash,
        expires_at: expiresAt,
        is_active: true,
      }).select().single();

      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      if (data) setSessionId(data.id);
    }

    setCurrentCode(code);
    setTimeLeft(30000);
    setIsActive(true);
  }, [selectedSubject, user, sessionId, toast]);

  const closeSession = async () => {
    if (!sessionId) return;
    await supabase.from('attendance_sessions')
      .update({ is_active: false })
      .eq('id', sessionId);
    setIsActive(false);
    setCurrentCode('');
    setSessionId(null);
    setStudents([]);
    toast({ title: 'Session closed', description: `${students.length} students marked attendance` });
  };

  const timerPercentage = isActive ? (timeLeft / 30000) * 100 : 0;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Take Attendance</h2>
        <p className="text-sm text-muted-foreground mt-1">Generate a code for students to mark their presence</p>
      </div>

      {/* Subject selector */}
      {!isActive && !sessionId && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                <SelectTrigger className="h-11">
                  <SelectValue placeholder="Select a subject" />
                </SelectTrigger>
                <SelectContent>
                  {subjects.map(s => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button onClick={generateNewCode} disabled={!selectedSubject} className="w-full h-11">
                Generate Attendance Code
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Active session */}
      {(isActive || sessionId) && (
        <>
          {/* Code display */}
          <Card className="overflow-hidden">
            <CardContent className="pt-8 pb-6">
              <div className="text-center space-y-4">
                <p className="text-xs uppercase tracking-wider text-muted-foreground font-medium">Attendance Code</p>
                <div className="flex justify-center gap-3">
                  {(currentCode || '----').split('').map((digit, i) => (
                    <div
                      key={i}
                      className="w-16 h-20 flex items-center justify-center rounded-xl bg-secondary text-3xl font-bold text-foreground border border-border/50"
                    >
                      {digit}
                    </div>
                  ))}
                </div>

                {/* Timer bar */}
                {isActive && timeLeft > 0 && (
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-100 ease-linear"
                      style={{ width: `${timerPercentage}%` }}
                    />
                  </div>
                )}

                {isActive && timeLeft <= 0 && currentCode && (
                  <p className="text-sm text-muted-foreground">Code expired</p>
                )}

                <div className="flex gap-2 justify-center">
                  <Button onClick={generateNewCode} variant="outline" className="gap-2">
                    <RefreshCw className="w-4 h-4" />
                    Regenerate
                  </Button>
                  <Button onClick={closeSession} variant="destructive" className="gap-2">
                    <StopCircle className="w-4 h-4" />
                    Close & Save
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Live student list */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-success animate-pulse" />
                Live Attendance ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {students.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">Waiting for students…</p>
              ) : (
                <div className="space-y-2">
                  {students.map((s, i) => (
                    <div key={s.id} className="flex items-center gap-3 p-3 rounded-lg bg-secondary/50 animate-success-pop">
                      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-success/10 text-success">
                        <CheckCircle2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{s.profiles?.name || 'Student'}</p>
                        <p className="text-xs text-muted-foreground">{s.profiles?.roll_number || 'N/A'}</p>
                      </div>
                      <span className="text-xs text-muted-foreground">
                        {new Date(s.marked_at).toLocaleTimeString()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
