import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Users, Calendar, TrendingUp, Activity } from 'lucide-react';

export default function AdminDashboard() {
  const [totalStudents, setTotalStudents] = useState(0);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    // Total students
    const { count: students } = await supabase
      .from('profiles')
      .select('*', { count: 'exact', head: true })
      .eq('role', 'student');
    setTotalStudents(students || 0);

    // Sessions today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const { count: sessions } = await supabase
      .from('attendance_sessions')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', today.toISOString());
    setSessionsToday(sessions || 0);

    // Recent attendance records
    const { data: recent } = await supabase
      .from('attendance_records')
      .select('*, profiles:student_id(name), attendance_sessions(subject_id, subjects(name))')
      .order('marked_at', { ascending: false })
      .limit(10);
    setRecentActivity(recent || []);

    // Avg attendance (approximate)
    const { count: totalRecords } = await supabase
      .from('attendance_records')
      .select('*', { count: 'exact', head: true });
    const { count: totalSessionsAll } = await supabase
      .from('attendance_sessions')
      .select('*', { count: 'exact', head: true });
    
    if (totalSessionsAll && totalSessionsAll > 0 && students && students > 0) {
      const expected = totalSessionsAll * students;
      setAvgAttendance(Math.round(((totalRecords || 0) / expected) * 100));
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Silver Oak University — Attendance Overview</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{totalStudents}</p>
                <p className="text-xs text-muted-foreground">Total Students</p>
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
                <p className="text-2xl font-bold">{sessionsToday}</p>
                <p className="text-xs text-muted-foreground">Sessions Today</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{avgAttendance}%</p>
                <p className="text-xs text-muted-foreground">Avg Attendance</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5 pb-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <Activity className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{recentActivity.length}</p>
                <p className="text-xs text-muted-foreground">Recent Records</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent activity feed */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          {recentActivity.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No recent activity</p>
          ) : (
            <div className="space-y-2">
              {recentActivity.map(record => {
                const studentName = (record.profiles as any)?.name || 'Student';
                const subjectName = (record.attendance_sessions as any)?.subjects?.name || 'Subject';
                return (
                  <div key={record.id} className="flex items-center justify-between p-3 rounded-lg bg-secondary/50">
                    <div>
                      <p className="text-sm font-medium">{studentName}</p>
                      <p className="text-xs text-muted-foreground">marked attendance for {subjectName}</p>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date(record.marked_at).toLocaleString()}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
