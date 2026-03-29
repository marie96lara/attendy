import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { 
  Users, 
  Calendar, 
  TrendingUp, 
  Activity, 
  UserPlus, 
  Download, 
  Trash2,
  GraduationCap,
  UserCheck,
  X
} from 'lucide-react';

interface User {
  id: string;
  name: string;
  email: string;
  role: 'student' | 'faculty' | 'admin';
  roll_number?: string;
  created_at: string;
}

export default function AdminDashboard() {
  const { toast } = useToast();
  const [totalStudents, setTotalStudents] = useState(0);
  const [sessionsToday, setSessionsToday] = useState(0);
  const [avgAttendance, setAvgAttendance] = useState(0);
  const [recentActivity, setRecentActivity] = useState<any[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'users'>('overview');
  const [formData, setFormData] = useState({
    name: '',
    role: 'student' as 'student' | 'faculty',
    roll_number: '',
  });

  useEffect(() => {
    loadStats();
    loadUsers();
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

  const loadUsers = async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && data) {
      setUsers(data);
    }
  };

  const generatePassword = () => {
    const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
      password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
  };

  const generateEmail = (name: string, role: string) => {
    const cleanName = name.toLowerCase().replace(/\s/g, '.');
    const randomNum = Math.floor(Math.random() * 10000);
    return `${cleanName}.${randomNum}@attendy.demo`;
  };

  const generateRollNumber = () => {
    const year = new Date().getFullYear().toString().slice(-2);
    const randomNum = Math.floor(Math.random() * 10000);
    return `${year}${randomNum.toString().padStart(4, '0')}`;
  };

  const handleCreateUser = async () => {
    if (!formData.name) {
      toast({ title: 'Error', description: 'Please enter a name', variant: 'destructive' });
      return;
    }

    setLoading(true);
    const password = generatePassword();
    const email = generateEmail(formData.name, formData.role);
    const rollNumber = formData.role === 'student' ? (formData.roll_number || generateRollNumber()) : null;

    // Create auth user
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      toast({ title: 'Error', description: authError.message, variant: 'destructive' });
      setLoading(false);
      return;
    }

    // Create profile
    const { error: profileError } = await supabase
      .from('profiles')
      .insert({
        id: authData.user?.id,
        name: formData.name,
        email: email,
        role: formData.role,
        roll_number: rollNumber,
      });

    if (profileError) {
      toast({ title: 'Error', description: profileError.message, variant: 'destructive' });
    } else {
      // Show credentials
      toast({
        title: '✅ User Created Successfully!',
        description: `${formData.name} (${formData.role})\nEmail: ${email}\nPassword: ${password}`,
        duration: 10000,
      });
      
      // Download credentials
      const credentials = `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎓 ATTENDY - NEW USER CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

📋 USER INFORMATION
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Name: ${formData.name}
Role: ${formData.role.toUpperCase()}
${formData.role === 'student' ? `Roll Number: ${rollNumber}` : ''}
Created: ${new Date().toLocaleString()}

🔐 LOGIN CREDENTIALS
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Email: ${email}
Password: ${password}

🌐 LOGIN URL
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
${window.location.origin}

⚠️  Please save this information securely.
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`;
      
      const blob = new Blob([credentials], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${formData.name.replace(/\s/g, '_')}_credentials.txt`;
      a.click();
      URL.revokeObjectURL(url);
      
      setShowCreateModal(false);
      setFormData({ name: '', role: 'student', roll_number: '' });
      loadUsers();
      loadStats();
    }
    setLoading(false);
  };

  const handleDeleteUser = async (userId: string, userName: string) => {
    if (!confirm(`Delete ${userName}? This action cannot be undone.`)) return;

    setLoading(true);
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', userId);

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: '✅ User deleted', description: `${userName} has been removed` });
      loadUsers();
      loadStats();
    }
    setLoading(false);
  };

  const exportUsersToCSV = () => {
    const csvData = users.map(user => ({
      Name: user.name,
      Email: user.email,
      Role: user.role,
      'Roll Number': user.roll_number || 'N/A',
      'Created At': new Date(user.created_at).toLocaleDateString(),
    }));
    
    if (csvData.length === 0) {
      toast({ title: 'No data', description: 'No users to export', variant: 'destructive' });
      return;
    }
    
    const headers = Object.keys(csvData[0]);
    const csvRows = [
      headers.join(','),
      ...csvData.map(row => headers.map(h => JSON.stringify(row[h as keyof typeof row])).join(','))
    ];
    
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    
    toast({ title: '✅ Exported', description: 'User list downloaded as CSV' });
  };

  return (
    <div className="space-y-6">
      {/* Header with Tabs */}
      <div>
        <h2 className="text-2xl font-bold text-foreground">Admin Dashboard</h2>
        <p className="text-sm text-muted-foreground mt-1">Silver Oak University Attendance System</p>
      </div>

      {/* Tab Navigation */}
      <div className="flex gap-2 border-b border-border">
        <button
          onClick={() => setActiveTab('overview')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'overview'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          Overview
        </button>
        <button
          onClick={() => setActiveTab('users')}
          className={`px-4 py-2 text-sm font-medium transition-colors ${
            activeTab === 'users'
              ? 'text-primary border-b-2 border-primary'
              : 'text-muted-foreground hover:text-foreground'
          }`}
        >
          User Management
        </button>
      </div>

      {activeTab === 'overview' ? (
        <>
          {/* Stats Cards */}
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
        </>
      ) : (
        <>
          {/* User Management Section */}
          <div className="flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-foreground">All Users</h3>
              <p className="text-sm text-muted-foreground">Manage student and faculty accounts</p>
            </div>
            <div className="flex gap-3">
              <Button onClick={exportUsersToCSV} variant="outline" size="sm">
                <Download className="w-4 h-4 mr-2" />
                Export CSV
              </Button>
              <Button onClick={() => setShowCreateModal(true)} size="sm">
                <UserPlus className="w-4 h-4 mr-2" />
                Create User
              </Button>
            </div>
          </div>

          {/* Stats Summary */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Students</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.role === 'student').length}</p>
                  </div>
                  <GraduationCap className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-4 pb-3">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-muted-foreground">Faculty</p>
                    <p className="text-2xl font-bold">{users.filter(u => u.role === 'faculty').length}</p>
                  </div>
                  <UserCheck className="w-8 h-8 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Users Table */}
          <Card>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="border-b border-border">
                    <tr className="text-left">
                      <th className="p-4 text-sm font-medium text-muted-foreground">Name</th>
                      <th className="p-4 text-sm font-medium text-muted-foreground">Email</th>
                      <th className="p-4 text-sm font-medium text-muted-foreground">Role</th>
                      <th className="p-4 text-sm font-medium text-muted-foreground">Roll Number</th>
                      <th className="p-4 text-sm font-medium text-muted-foreground">Created</th>
                      <th className="p-4 text-sm font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-muted-foreground">
                          No users found. Click "Create User" to add one.
                        </td>
                      </tr>
                    ) : (
                      users.map((user) => (
                        <tr key={user.id} className="border-b border-border/50 hover:bg-secondary/30">
                          <td className="p-4 text-foreground font-medium">{user.name}</td>
                          <td className="p-4 text-muted-foreground text-sm">{user.email}</td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              user.role === 'student' ? 'bg-blue-500/20 text-blue-400' :
                              user.role === 'faculty' ? 'bg-purple-500/20 text-purple-400' :
                              'bg-red-500/20 text-red-400'
                            }`}>
                              {user.role}
                            </span>
                          </td>
                          <td className="p-4 text-muted-foreground text-sm">{user.roll_number || '-'}</td>
                          <td className="p-4 text-muted-foreground text-sm">
                            {new Date(user.created_at).toLocaleDateString()}
                          </td>
                          <td className="p-4">
                            <button
                              onClick={() => handleDeleteUser(user.id, user.name)}
                              className="p-1 hover:bg-red-500/10 rounded transition-colors"
                              disabled={loading}
                            >
                              <Trash2 className="w-4 h-4 text-red-500" />
                            </button>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-md">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle>Create New User</CardTitle>
              <button
                onClick={() => setShowCreateModal(false)}
                className="p-1 hover:bg-muted rounded transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>Full Name *</Label>
                <Input
                  placeholder="Enter full name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="mt-1"
                />
              </div>
              
              <div>
                <Label>Role *</Label>
                <select
                  value={formData.role}
                  onChange={(e) => setFormData({ ...formData, role: e.target.value as 'student' | 'faculty' })}
                  className="w-full mt-1 px-3 py-2 bg-background border border-input rounded-md"
                >
                  <option value="student">Student</option>
                  <option value="faculty">Faculty</option>
                </select>
              </div>
              
              {formData.role === 'student' && (
                <div>
                  <Label>Roll Number (Optional)</Label>
                  <Input
                    placeholder="Auto-generated if left empty"
                    value={formData.roll_number}
                    onChange={(e) => setFormData({ ...formData, roll_number: e.target.value })}
                    className="mt-1"
                  />
                </div>
              )}
              
              <div className="bg-muted/30 p-3 rounded-lg">
                <p className="text-sm text-muted-foreground">
                  📝 <strong>Note:</strong> A secure password will be auto-generated and shown after creation.
                  Credentials will be downloaded automatically.
                </p>
              </div>
              
              <div className="flex gap-3 pt-4">
                <Button variant="outline" onClick={() => setShowCreateModal(false)} className="flex-1">
                  Cancel
                </Button>
                <Button onClick={handleCreateUser} disabled={loading} className="flex-1">
                  {loading ? 'Creating...' : 'Create User'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}