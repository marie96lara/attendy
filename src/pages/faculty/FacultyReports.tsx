import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

export default function FacultyReports() {
  const { user } = useAuth();
  const [subjects, setSubjects] = useState<any[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [stats, setStats] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    supabase.from('subjects').select('*').eq('faculty_id', user.id)
      .then(({ data }) => {
        if (data) {
          setSubjects(data);
          if (data.length > 0) setSelectedSubject(data[0].id);
        }
      });
  }, [user]);

  useEffect(() => {
    if (!selectedSubject) return;
    loadSubjectStats(selectedSubject);
  }, [selectedSubject]);

  const loadSubjectStats = async (subjectId: string) => {
    // Get all enrolled students for this subject
    const { data: enrollments } = await supabase
      .from('student_subjects')
      .select('student_id, profiles:student_id(name, roll_number, department)')
      .eq('subject_id', subjectId);

    if (!enrollments) return;

    // Get total sessions for this subject
    const { count: totalSessions } = await supabase
      .from('attendance_sessions')
      .select('*', { count: 'exact', head: true })
      .eq('subject_id', subjectId);

    const total = totalSessions || 0;

    const studentStats = [];
    for (const enrollment of enrollments) {
      const { count: attended } = await supabase
        .from('attendance_records')
        .select('*, attendance_sessions!inner(*)', { count: 'exact', head: true })
        .eq('student_id', enrollment.student_id)
        .eq('attendance_sessions.subject_id', subjectId);

      const att = attended || 0;
      const percentage = total > 0 ? Math.round((att / total) * 100) : 100;
      const profile = enrollment.profiles as any;

      studentStats.push({
        student_id: enrollment.student_id,
        name: profile?.name || 'Unknown',
        roll_number: profile?.roll_number || 'N/A',
        department: profile?.department || 'N/A',
        attended: att,
        total,
        percentage,
      });
    }

    studentStats.sort((a, b) => a.percentage - b.percentage);
    setStats(studentStats);
  };

  const defaulters = stats.filter(s => s.percentage < 75);

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Reports</h2>
        <p className="text-sm text-muted-foreground mt-1">Subject-wise attendance summary</p>
      </div>

      {/* Subject tabs */}
      <div className="flex gap-2 flex-wrap">
        {subjects.map(s => (
          <button
            key={s.id}
            onClick={() => setSelectedSubject(s.id)}
            className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
              selectedSubject === s.id
                ? 'bg-primary text-primary-foreground border-primary'
                : 'bg-card text-foreground border-border hover:bg-accent'
            }`}
          >
            {s.name}
          </button>
        ))}
      </div>

      {/* Defaulters alert */}
      {defaulters.length > 0 && (
        <Card className="border-destructive/20 bg-destructive/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm text-destructive">⚠ Defaulters (Below 75%)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {defaulters.map(d => (
                <Badge key={d.student_id} variant="destructive" className="text-xs">
                  {d.name} — {d.percentage}%
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Full student table */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Student Attendance</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Roll No</TableHead>
                <TableHead>Name</TableHead>
                <TableHead>Attended</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Percentage</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {stats.map(s => (
                <TableRow key={s.student_id}>
                  <TableCell className="font-mono text-xs">{s.roll_number}</TableCell>
                  <TableCell>{s.name}</TableCell>
                  <TableCell>{s.attended}</TableCell>
                  <TableCell>{s.total}</TableCell>
                  <TableCell>
                    <span className={`font-semibold ${s.percentage < 75 ? 'text-destructive' : ''}`}>
                      {s.percentage}%
                    </span>
                  </TableCell>
                </TableRow>
              ))}
              {stats.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                    No data available
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
