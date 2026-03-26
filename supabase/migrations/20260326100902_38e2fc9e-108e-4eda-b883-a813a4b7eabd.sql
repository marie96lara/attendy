
-- Create enum for roles
CREATE TYPE public.app_role AS ENUM ('student', 'faculty', 'admin');

-- Create enum for departments
CREATE TYPE public.department AS ENUM ('SOIM', 'SOCCA', 'SOCLS');

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  email TEXT NOT NULL,
  role app_role NOT NULL DEFAULT 'student',
  roll_number TEXT,
  department department,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE(user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT TO authenticated USING (auth.uid() = user_id);

-- Security definer function for role check
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role
  )
$$;

-- Subjects table
CREATE TABLE public.subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  faculty_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  department department,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view subjects" ON public.subjects FOR SELECT TO authenticated USING (true);

-- Lecture slots
CREATE TABLE public.lecture_slots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  room TEXT,
  scheduled_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.lecture_slots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view lecture slots" ON public.lecture_slots FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faculty can manage own slots" ON public.lecture_slots FOR ALL TO authenticated USING (faculty_id = auth.uid());

-- Attendance sessions
CREATE TABLE public.attendance_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slot_id UUID REFERENCES public.lecture_slots(id) ON DELETE CASCADE,
  faculty_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.attendance_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view active sessions" ON public.attendance_sessions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Faculty can insert sessions" ON public.attendance_sessions FOR INSERT TO authenticated WITH CHECK (faculty_id = auth.uid());
CREATE POLICY "Faculty can update own sessions" ON public.attendance_sessions FOR UPDATE TO authenticated USING (faculty_id = auth.uid());

-- Attendance records
CREATE TABLE public.attendance_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.attendance_sessions(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  marked_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  gps_lat DOUBLE PRECISION,
  gps_lng DOUBLE PRECISION,
  UNIQUE(session_id, student_id)
);

ALTER TABLE public.attendance_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Students can view own records" ON public.attendance_records FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Students can insert own records" ON public.attendance_records FOR INSERT TO authenticated WITH CHECK (student_id = auth.uid());
CREATE POLICY "Faculty can view session records" ON public.attendance_records FOR SELECT TO authenticated USING (
  EXISTS (SELECT 1 FROM public.attendance_sessions WHERE id = session_id AND faculty_id = auth.uid())
);
CREATE POLICY "Admins can view all records" ON public.attendance_records FOR SELECT TO authenticated USING (
  public.has_role(auth.uid(), 'admin')
);

-- Student-subject enrollment
CREATE TABLE public.student_subjects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_id UUID NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  UNIQUE(student_id, subject_id)
);

ALTER TABLE public.student_subjects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view enrollments" ON public.student_subjects FOR SELECT TO authenticated USING (true);

-- Enable realtime for attendance_records
ALTER PUBLICATION supabase_realtime ADD TABLE public.attendance_records;

-- Updated at trigger
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Function to handle new user profile creation
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  INSERT INTO public.user_roles (user_id, role)
  VALUES (
    NEW.id,
    COALESCE((NEW.raw_user_meta_data->>'role')::app_role, 'student')
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
