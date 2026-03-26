import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false }
    });

    const departments = ['SOIM', 'SOCCA', 'SOCLS'] as const;
    const createdUsers: Record<string, string> = {};

    // Create admin
    const { data: adminData } = await supabase.auth.admin.createUser({
      email: 'admin@attendy.demo',
      password: 'demo123456',
      email_confirm: true,
      user_metadata: { name: 'Admin User', role: 'admin' },
    });
    if (adminData?.user) createdUsers['admin'] = adminData.user.id;

    // Create 2 faculty
    const facultyNames = ['Dr. Sharma', 'Prof. Patel'];
    const facultyDepts = ['SOIM', 'SOCCA'] as const;
    for (let i = 0; i < 2; i++) {
      const { data } = await supabase.auth.admin.createUser({
        email: `faculty${i + 1}@attendy.demo`,
        password: 'demo123456',
        email_confirm: true,
        user_metadata: { name: facultyNames[i], role: 'faculty' },
      });
      if (data?.user) {
        createdUsers[`faculty${i + 1}`] = data.user.id;
        // Update profile with department
        await supabase.from('profiles').update({ department: facultyDepts[i] }).eq('id', data.user.id);
      }
    }

    // Create 15 students (5 per department)
    const studentNames = [
      'Aarav Mehta', 'Priya Singh', 'Rohan Gupta', 'Sneha Joshi', 'Vikram Rao',
      'Ananya Reddy', 'Karthik Nair', 'Ishita Das', 'Arjun Verma', 'Meera Kapoor',
      'Nikhil Shah', 'Pooja Desai', 'Rahul Kumar', 'Sakshi Agarwal', 'Tanvi Mishra',
    ];

    for (let i = 0; i < 15; i++) {
      const dept = departments[Math.floor(i / 5)];
      const rollNum = `${dept}-${String(i + 1).padStart(3, '0')}`;
      const { data } = await supabase.auth.admin.createUser({
        email: `student${i + 1}@attendy.demo`,
        password: 'demo123456',
        email_confirm: true,
        user_metadata: { name: studentNames[i], role: 'student' },
      });
      if (data?.user) {
        createdUsers[`student${i + 1}`] = data.user.id;
        await supabase.from('profiles').update({
          roll_number: rollNum,
          department: dept,
        }).eq('id', data.user.id);
      }
    }

    // Create subjects (3 per faculty = 6 total)
    const subjectList = [
      { name: 'Data Structures', code: 'CS201', faculty: 'faculty1', dept: 'SOIM' },
      { name: 'Database Systems', code: 'CS301', faculty: 'faculty1', dept: 'SOIM' },
      { name: 'Web Development', code: 'CS401', faculty: 'faculty1', dept: 'SOIM' },
      { name: 'Business Analytics', code: 'BA201', faculty: 'faculty2', dept: 'SOCCA' },
      { name: 'Financial Management', code: 'FM301', faculty: 'faculty2', dept: 'SOCCA' },
      { name: 'Marketing Strategy', code: 'MK401', faculty: 'faculty2', dept: 'SOCCA' },
    ];

    const createdSubjects: Record<string, string> = {};
    for (const subj of subjectList) {
      const { data } = await supabase.from('subjects').insert({
        name: subj.name,
        code: subj.code,
        faculty_id: createdUsers[subj.faculty],
        department: subj.dept,
      }).select().single();
      if (data) createdSubjects[subj.code] = data.id;
    }

    // Enroll students in subjects (each dept's students get their dept's subjects)
    const enrollments: { student_id: string; subject_id: string }[] = [];
    for (let i = 0; i < 15; i++) {
      const deptIndex = Math.floor(i / 5);
      const deptSubjects = subjectList.filter((_, si) => Math.floor(si / 3) === deptIndex);
      for (const subj of deptSubjects) {
        const studentId = createdUsers[`student${i + 1}`];
        const subjectId = createdSubjects[subj.code];
        if (studentId && subjectId) {
          enrollments.push({ student_id: studentId, subject_id: subjectId });
        }
      }
    }

    if (enrollments.length > 0) {
      await supabase.from('student_subjects').insert(enrollments);
    }

    return new Response(
      JSON.stringify({ success: true, users: Object.keys(createdUsers).length, subjects: Object.keys(createdSubjects).length }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
