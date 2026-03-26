import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableHeader, TableRow, TableHead, TableBody, TableCell } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { Download } from 'lucide-react';

export default function AdminReports() {
  const [subjects, setSubjects] = useState<any[]>([]);
  const [students, setStudents] = useState<any[]>([]);
  const [view, setView] = useState<'subjects' | 'students'>('subjects');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    // All subjects with session counts
    const { data: subjectsData } = await supabase
      .from('subjects')
      .select('*, profiles:faculty_id(name)');

    if (subjectsData) {
      const enriched = [];
      for (const subject of subjectsData) {
        const { count: sessions } = await supabase
          .from('attendance_sessions')
          .select('*', { count: 'exact', head: true })
          .eq('subject_id', subject.id);
        
        const { count: enrollments } = await supabase
          .from('student_subjects')
          .select('*', { count: 'exact', head: true })
          .eq('subject_id', subject.id);

        enriched.push({
          ...subject,
          total_sessions: sessions || 0,
          enrolled_students: enrollments || 0,
          faculty_name: (subject.profiles as any)?.name || 'N/A',
        });
      }
      setSubjects(enriched);
    }

    // All students with attendance
    const { data: studentsData } = await supabase
      .from('profiles')
      .select('*')
      .eq('role', 'student');

    if (studentsData) {
      const enriched = [];
      for (const student of studentsData) {
        const { count: totalAttended } = await supabase
          .from('attendance_records')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', student.id);
        
        // Get enrolled subject count
        const { count: subjectCount } = await supabase
          .from('student_subjects')
          .select('*', { count: 'exact', head: true })
          .eq('student_id', student.id);

        enriched.push({
          ...student,
          total_attended: totalAttended || 0,
          subject_count: subjectCount || 0,
        });
      }
      setStudents(enriched);
    }
  };

  const exportCSV = () => {
    const headers = view === 'subjects'
      ? ['Name', 'Code', 'Department', 'Faculty', 'Sessions', 'Students']
      : ['Name', 'Roll Number', 'Department', 'Subjects', 'Attended'];
    
    const rows = view === 'subjects'
      ? subjects.map(s => [s.name, s.code, s.department, s.faculty_name, s.total_sessions, s.enrolled_students])
      : students.map(s => [s.name, s.roll_number, s.department, s.subject_count, s.total_attended]);

    const csv = [headers, ...rows].map(r => r.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `attendy-${view}-report.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-foreground">Reports</h2>
          <p className="text-sm text-muted-foreground mt-1">Comprehensive attendance data</p>
        </div>
        <Button variant="outline" onClick={exportCSV} className="gap-2">
          <Download className="w-4 h-4" />
          Export CSV
        </Button>
      </div>

      {/* View toggle */}
      <div className="flex gap-2">
        <button
          onClick={() => setView('subjects')}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
            view === 'subjects' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-accent'
          }`}
        >
          By Subject
        </button>
        <button
          onClick={() => setView('students')}
          className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
            view === 'students' ? 'bg-primary text-primary-foreground border-primary' : 'bg-card text-foreground border-border hover:bg-accent'
          }`}
        >
          By Student
        </button>
      </div>

      <Card>
        <CardContent className="pt-4">
          {view === 'subjects' ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Subject</TableHead>
                  <TableHead>Code</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Faculty</TableHead>
                  <TableHead>Sessions</TableHead>
                  <TableHead>Students</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {subjects.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.code}</TableCell>
                    <TableCell>{s.department}</TableCell>
                    <TableCell>{s.faculty_name}</TableCell>
                    <TableCell>{s.total_sessions}</TableCell>
                    <TableCell>{s.enrolled_students}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Roll No</TableHead>
                  <TableHead>Department</TableHead>
                  <TableHead>Subjects</TableHead>
                  <TableHead>Attended</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.map(s => (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="font-mono text-xs">{s.roll_number}</TableCell>
                    <TableCell>{s.department}</TableCell>
                    <TableCell>{s.subject_count}</TableCell>
                    <TableCell>{s.total_attended}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
