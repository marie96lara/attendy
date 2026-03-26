import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, TrendingUp, Calendar } from 'lucide-react';

interface SubjectAttendance {
  subject_name: string;
  subject_code: string;
  total_sessions: number;
  attended: number;
  percentage: number;
}

export default function StudentDashboard() {
  const { profile } = useAuth();
  const [subjectStats, setSubjectStats] = useState<SubjectAttendance[]>([]);
  const [todayClasses, setTodayClasses] = useState<any[]>([]);

  useEffect(() => {
    if (!profile) return;
    loadData();
  }, [profile]);

  const loadData = async () => {
    if (!profile) return;

    // Get enrolled subjects
    const { data: enrollments } = await supabase
      .from('student_subjects')
      .select('subject_id, subjects(name, code)')
      .eq('student_id', profile.id);

    if (!enrollments) return;

    const stats: SubjectAttendance[] = [];

    for (const enrollment of enrollments) {
      const subject = enrollment.subjects as any;
      
      // Count total sessions for this subject
      const { count: totalSessions } = await supabase
        .from('attendance_sessions')
        .select('*', { count: 'exact', head: true })
        .eq('subject_id', enrollment.subject_id);

      // Count attended sessions
      const { count: attended } = await supabase
        .from('attendance_records')
        .select('*, attendance_sessions!inner(*)', { count: 'exact', head: true })
        .eq('student_id', profile.id)
        .eq('attendance_sessions.subject_id', enrollment.subject_id);

      const total = totalSessions || 0;
      const att = attended || 0;

      stats.push({
        subject_name: subject?.name || '',
        subject_code: subject?.code || '',
        total_sessions: total,
        attended: att,
        percentage: total > 0 ? Math.round((att / total) * 100) : 100,
      });
    }

    setSubjectStats(stats);

    // Today's lecture slots
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const { data: slots } = await supabase
      .from('lecture_slots')
      .select('*, subjects(name, code)')
      .gte('scheduled_at', today.toISOString())
      .lt('scheduled_at', tomorrow.toISOString())
      .order('scheduled_at');

    setTodayClasses(slots || []);
  };

  const overallPercentage = subjectStats.length > 0
    ? Math.round(subjectStats.reduce((sum, s) => sum + s.percentage, 0) / subjectStats.length)
    : 100;

  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good morning';
    if (hour < 17) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6">
      {/* Greeting */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">{greeting}, {profile?.name?.split(' ')[0]}!</h2>
        <p className="text-sm text-muted-foreground mt-1">Here's your attendance overview</p>
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{overallPercentage}%</p>
                <p className="text-xs text-muted-foreground">Overall Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{subjectStats.length}</p>
                <p className="text-xs text-muted-foreground">Enrolled Subjects</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Calendar className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{todayClasses.length}</p>
                <p className="text-xs text-muted-foreground">Classes Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Subject-wise attendance */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Subject-wise Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          {subjectStats.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No subjects enrolled yet</p>
          ) : (
            <div className="space-y-3">
              {subjectStats.map(s => (
                <div key={s.subject_code} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-medium">{s.subject_name} <span className="text-muted-foreground">({s.subject_code})</span></span>
                    <span className={`font-semibold ${s.percentage < 75 ? 'text-destructive' : 'text-foreground'}`}>
                      {s.percentage}%
                    </span>
                  </div>
                  <div className="w-full bg-secondary rounded-full h-2">
                    <div
                      className={`h-full rounded-full transition-all ${s.percentage < 75 ? 'bg-destructive' : 'bg-primary'}`}
                      style={{ width: `${s.percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{s.attended}/{s.total_sessions} sessions</p>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Today's classes */}
      {todayClasses.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Today's Classes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {todayClasses.map(slot => (
                <div key={slot.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                  <div>
                    <p className="text-sm font-medium">{(slot.subjects as any)?.name}</p>
                    <p className="text-xs text-muted-foreground">Room {slot.room}</p>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {new Date(slot.scheduled_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
