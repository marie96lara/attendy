import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { hashCode } from '@/lib/attendance';
import { useToast } from '@/hooks/use-toast';
import { CheckCircle2, XCircle, MapPin } from 'lucide-react';

export default function StudentMarkAttendance() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [digits, setDigits] = useState(['', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<'success' | 'fail' | null>(null);
  const [timeLeft, setTimeLeft] = useState(10);
  const [isTimerActive, setIsTimerActive] = useState(false);

  // Timer for the student (visual only — actual expiry is server-side)
  useEffect(() => {
    if (!isTimerActive || timeLeft <= 0) return;
    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 0.1) {
          setIsTimerActive(false);
          return 0;
        }
        return prev - 0.1;
      });
    }, 100);
    return () => clearInterval(interval);
  }, [isTimerActive, timeLeft]);

  const handleDigitChange = (index: number, value: string) => {
    if (value.length > 1) value = value.slice(-1);
    if (value && !/^\d$/.test(value)) return;

    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);

    // Auto-focus next input
    if (value && index < 3) {
      const next = document.getElementById(`otp-${index + 1}`);
      next?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      const prev = document.getElementById(`otp-${index - 1}`);
      prev?.focus();
    }
  };

  const handleSubmit = async () => {
    const code = digits.join('');
    if (code.length !== 4 || !user) return;

    setLoading(true);
    setResult(null);

    try {
      // Get GPS
      let gpsLat: number | null = null;
      let gpsLng: number | null = null;
      
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 6000 });
        });
        gpsLat = pos.coords.latitude;
        gpsLng = pos.coords.longitude;
      } catch {
        // GPS not available, proceed without (for demo)
      }

      // Hash the submitted code
      const hash = await hashCode(code);

      // Find active session matching this hash
      const { data: sessions } = await supabase
        .from('attendance_sessions')
        .select('*')
        .eq('code_hash', hash)
        .eq('is_active', true)
        .gte('expires_at', new Date().toISOString());

      if (!sessions || sessions.length === 0) {
        setResult('fail');
        toast({ title: 'Invalid or expired code', variant: 'destructive' });
        setLoading(false);
        return;
      }

      const session = sessions[0];

      // Insert attendance record
      const { error } = await supabase.from('attendance_records').insert({
        session_id: session.id,
        student_id: user.id,
        gps_lat: gpsLat,
        gps_lng: gpsLng,
      });

      if (error) {
        if (error.code === '23505') {
          toast({ title: 'Already marked', description: 'You already marked attendance for this session', variant: 'destructive' });
        } else {
          toast({ title: 'Error', description: error.message, variant: 'destructive' });
        }
        setResult('fail');
      } else {
        setResult('success');
        toast({ title: 'Attendance marked!', description: 'Your presence has been recorded' });
      }
    } catch (err: any) {
      setResult('fail');
      toast({ title: 'Error', description: err.message, variant: 'destructive' });
    }

    setLoading(false);
  };

  const reset = () => {
    setDigits(['', '', '', '']);
    setResult(null);
    setTimeLeft(10);
    setIsTimerActive(false);
  };

  return (
    <div className="max-w-md mx-auto space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-foreground">Mark Attendance</h2>
        <p className="text-sm text-muted-foreground mt-1">Enter the 4-digit code shown by your faculty</p>
      </div>

      {result === null && (
        <Card>
          <CardContent className="pt-8 pb-6">
            <div className="text-center space-y-6">
              {/* OTP Input */}
              <div className="flex justify-center gap-3">
                {digits.map((digit, i) => (
                  <input
                    key={i}
                    id={`otp-${i}`}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleDigitChange(i, e.target.value)}
                    onKeyDown={e => handleKeyDown(i, e)}
                    onFocus={() => {
                      if (!isTimerActive && digits.every(d => d === '')) {
                        setIsTimerActive(true);
                        setTimeLeft(10);
                      }
                    }}
                    className="w-16 h-20 text-center text-3xl font-bold rounded-xl border-2 border-border bg-secondary/50 text-foreground focus:border-primary focus:outline-none transition-colors"
                  />
                ))}
              </div>

              {/* Countdown bar */}
              {isTimerActive && (
                <div className="space-y-1">
                  <div className="w-full bg-secondary rounded-full h-2 overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-300 ease-linear"
                      style={{ width: `${(timeLeft / 30) * 100}%` }}
                    />
                  </div>
                  <p className="text-xs text-muted-foreground">{Math.ceil(timeLeft)}s remaining</p>
                </div>
              )}

              {/* GPS indicator */}
              <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                <MapPin className="w-3 h-3" />
                GPS will be captured on submit
              </div>

              <Button
                onClick={handleSubmit}
                disabled={digits.some(d => d === '') || loading}
                className="w-full h-12 text-base"
              >
                {loading ? 'Verifying…' : 'Submit Attendance'}
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Success animation */}
      {result === 'success' && (
        <Card className="border-success/20">
          <CardContent className="pt-8 pb-6">
            <div className="text-center space-y-4 animate-success-pop">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-success/10">
                <CheckCircle2 className="w-10 h-10 text-success" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Attendance Marked!</h3>
                <p className="text-sm text-muted-foreground mt-1">Your presence has been recorded successfully</p>
              </div>
              <Button variant="outline" onClick={reset}>Mark Another</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Fail animation */}
      {result === 'fail' && (
        <Card className="border-destructive/20">
          <CardContent className="pt-8 pb-6">
            <div className="text-center space-y-4 animate-shake">
              <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-destructive/10">
                <XCircle className="w-10 h-10 text-destructive" />
              </div>
              <div>
                <h3 className="text-xl font-bold text-foreground">Failed!</h3>
                <p className="text-sm text-muted-foreground mt-1">Invalid code, expired, or already marked</p>
              </div>
              <Button variant="outline" onClick={reset}>Try Again</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
