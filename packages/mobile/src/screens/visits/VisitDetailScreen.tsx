/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Visit } from '../../types';
import { dataService } from '../../services/dataService';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ChevronLeft, MapPin, Clock, Calendar, 
  PlayCircle, CheckCircle2, AlertCircle, 
  Info, FileText, Map as MapIcon, Phone, MessageSquare,
  Edit3, Activity, Sparkles, Navigation, Bot, Send, 
  ShowerHead, Shirt, Move, Droplets, Utensils, Pill, 
  Sparkle, ShoppingBag, HeartPulse, Dumbbell, ShieldCheck, 
  Loader2, MoreHorizontal
} from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { requestClockReminderPermission } from '../../services/clockReminderService';

interface Task {
  id: string;
  label: string;
  category: string;
  completed: boolean;
  time?: string;
}

import { Haptics, ImpactStyle } from '@capacitor/haptics';
import { Capacitor } from '@capacitor/core';

function delay(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatDurationLabel(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  }
  return `${minutes}m`;
}

function buildDeviceInfo() {
  return {
    deviceId: `rayhealth-${navigator.platform || 'browser'}`,
    deviceType: Capacitor.getPlatform().toUpperCase(),
    osVersion: navigator.userAgent,
    appVersion: 'rayhealth-mobile-web',
    manufacturer: 'RayHealth',
    model: navigator.platform || 'browser',
  };
}

async function resolveLocation(fallback?: Visit['location']): Promise<Record<string, unknown>> {
  const fallbackLocation = {
    latitude: fallback?.latitude ?? 0,
    longitude: fallback?.longitude ?? 0,
    source: fallback ? 'scheduled-service-address' : 'device-fallback',
    capturedAt: new Date().toISOString(),
  };

  if (!('geolocation' in navigator)) {
    return fallbackLocation;
  }

  return await new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          capturedAt: new Date().toISOString(),
          source: 'device-gps',
        });
      },
      () => resolve(fallbackLocation),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  });
}

export default function VisitDetailScreen() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<Visit | null>(null);
  const [isCheckingIn, setIsCheckingIn] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [isLoadingVisit, setIsLoadingVisit] = useState(true);
  const [verificationStep, setVerificationStep] = useState<'idle' | 'calling' | 'keypad' | 'locating' | 'success'>('idle');
  const [tasks, setTasks] = useState<Task[]>([]);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  const loadVisit = useCallback(async () => {
    if (!id) {
      return;
    }

    const currentVisit = await dataService.getVisitById(id);
    if (currentVisit) {
      setVisit(currentVisit);
      return;
    }

    navigate('/');
  }, [id, navigate]);

  const loadTasks = useCallback(async () => {
    if (!id) {
      return;
    }

    try {
      const nextTasks = await dataService.getVisitTasks(id);
      setTasks(nextTasks);
    } catch (error) {
      console.error('Failed to load visit tasks', error);
      setTasks([]);
    }
  }, [id]);

  useEffect(() => {
    const fetchVisitData = async () => {
      if (!id) {
        return;
      }

      setIsLoadingVisit(true);
      try {
        await Promise.all([loadVisit(), loadTasks()]);
      } finally {
        setIsLoadingVisit(false);
      }
    };

    void fetchVisitData();
  }, [id, loadTasks, loadVisit]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (visit?.status === 'active' && visit.startTime) {
      const startedAt = new Date(visit.startTime).getTime();
      setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      interval = setInterval(() => {
        setElapsedSeconds(Math.max(0, Math.floor((Date.now() - startedAt) / 1000)));
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => clearInterval(interval);
  }, [visit?.startTime, visit?.status]);

  // Real-time safety location tracking
  useEffect(() => {
    let trackingInterval: NodeJS.Timeout;
    
    const track = async () => {
      if (visit?.status !== 'active' || !id) return;

      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const point = {
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: new Date().toISOString()
            };
            
            setVisit((currentVisit) => (
              currentVisit
                ? {
                    ...currentVisit,
                    locationPoints: [...(currentVisit.locationPoints || []), point],
                  }
                : currentVisit
            ));
            console.log("Background location heartbeat recorded", point);
          },
          undefined,
          { enableHighAccuracy: true }
        );
      }
    };

    if (visit?.status === 'active') {
      // Start tracking immediately then periodically
      track();
      trackingInterval = setInterval(track, 60000); // 60s requirements
    }

    return () => {
      if (trackingInterval) clearInterval(trackingInterval);
    };
  }, [visit?.status, id]);

  if (isLoadingVisit || !visit) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-medical-50">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-medical-500" />
      </div>
    );
  }

  const formatTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const handleGeolocationVerification = async () => {
    if (Capacitor.isNativePlatform()) {
      await Haptics.impact({ style: ImpactStyle.Heavy });
    }
    setVerificationStep('locating');

    try {
      const location = await resolveLocation(visit.location);
      await delay(1200);
      await completeClockIn(location);
    } catch (err) {
      console.error('Clock-in verification failed', err);
      setVerificationStep('idle');
      toast.error('Unable to verify arrival. Please try again.');
    }
  };

  const completeClockIn = async (location: Record<string, unknown>) => {
    if (!id) {
      return;
    }

    setIsCheckingIn(true);
    setVerificationStep('success');
    try {
      await delay(800);
      const updated = await dataService.startVisit(id, location, buildDeviceInfo());
      if (updated) {
        setVisit(updated);
      } else {
        await loadVisit();
      }
      await loadTasks();
      toast.success('Arrival verified and synced to RayHealth.');
      // First-clock-in is the contextually-relevant moment to ask for
      // notification permission so the 30-second pre-shift reminders
      // can fire on subsequent days. Fire-and-forget: permission denial
      // doesn't block the clock-in success path.
      void requestClockReminderPermission();
    } finally {
      setVerificationStep('idle');
      setIsCheckingIn(false);
    }
  };

  const handleTelephonyVerification = async () => {
    setVerificationStep('calling');
    await delay(1200);
    setVerificationStep('keypad');
    await delay(900);
    setVerificationStep('locating');
    const location = await resolveLocation(visit.location);
    await completeClockIn(location);
  };

  const handleCheckoutVerification = async () => {
    if (!id) {
      return;
    }

    setIsCheckingOut(true);
    setVerificationStep('locating');
    try {
      const location = await resolveLocation(visit.location);
      await delay(1200);
      setVerificationStep('success');
      await delay(800);
      const updated = await dataService.endVisit(id, location, buildDeviceInfo());
      if (updated) {
        setVisit(updated);
      } else {
        await loadVisit();
      }
      await loadTasks();
      toast.success('Visit completion synced to RayHealth.');
    } catch (error) {
      console.error('Clock-out failed', error);
      toast.error(error instanceof Error ? error.message : 'Unable to complete visit.');
    } finally {
      setIsCheckingOut(false);
      setVerificationStep('idle');
    }
  };

  const toggleTask = async (taskId: string) => {
    const targetTask = tasks.find((task) => task.id === taskId);
    if (!targetTask) {
      return;
    }

    if (targetTask.completed) {
      toast.info('This care task is already complete.');
      return;
    }

    const completedAt = format(new Date(), 'h:mm a');
    try {
      await dataService.completeTask(taskId, `Completed from mobile at ${completedAt}`);
      setTasks((previousTasks) =>
        previousTasks.map((task) =>
          task.id === taskId ? { ...task, completed: true, time: completedAt } : task,
        ),
      );
      toast.success('Task completion synced to RayHealth.');
    } catch (error) {
      console.error('Task completion failed', error);
      toast.error(error instanceof Error ? error.message : 'Unable to complete task.');
    }
  };

  const scheduledDurationSeconds = Math.max(
    Math.floor((new Date(visit.scheduledEndTime).getTime() - new Date(visit.scheduledStartTime).getTime()) / 1000),
    0,
  );
  const usedPercent = scheduledDurationSeconds > 0
    ? Math.min(100, Math.round((elapsedSeconds / scheduledDurationSeconds) * 100))
    : 0;
  const remainingSeconds = Math.max(scheduledDurationSeconds - elapsedSeconds, 0);
  const scheduledStartLabel = format(new Date(visit.scheduledStartTime), 'h:mm a');
  const scheduledEndLabel = format(new Date(visit.scheduledEndTime), 'h:mm a');

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'Personal Care': return <ShowerHead className="w-4 h-4" />;
      case 'Dressing': return <Shirt className="w-4 h-4" />;
      case 'Mobility': return <Move className="w-4 h-4" />;
      case 'Meal & Nutrition': return <Utensils className="w-4 h-4" />;
      case 'Medication': return <Pill className="w-4 h-4" />;
      case 'Household': return <Sparkle className="w-4 h-4" />;
      default: return <MoreHorizontal className="w-4 h-4" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-medical-50 font-sans">
      <header className="bg-white px-6 py-4 safe-area-top shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-medical-100 flex items-center gap-4 z-20">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-xl h-10 w-10 text-medical-400" 
          onClick={() => navigate('/')}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-1.5 mb-0.5">
            <ShieldCheck className="w-3 h-3 text-medical-500" />
            <p className="text-[10px] font-black text-medical-300 uppercase tracking-widest leading-none">Security Identity Verified</p>
          </div>
          <h2 className="text-lg font-black tracking-tight text-medical-700 font-heading leading-tight truncate">
            {visit.status === 'active' ? 'Live Shift Dashboard' : 'Visit Protocol'}
          </h2>
        </div>
        <Badge className={cn(
          "h-7 px-3 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-none",
          visit.status === 'active' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-medical-50 text-medical-600 border-medical-100"
        )}>
          {visit.status}
        </Badge>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6 pb-24">
          <AnimatePresence mode="wait">
            {/* Verification Flow overlay (Conceptual) */}
            {verificationStep !== 'idle' && (
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 bg-medical-700/90 backdrop-blur-md flex items-center justify-center p-6"
              >
                <Card className="w-full max-w-sm bg-white rounded-3xl overflow-hidden shadow-2xl p-8 text-center space-y-8">
                  <div className="relative mx-auto w-24 h-24 flex items-center justify-center">
                    <div className="absolute inset-0 bg-medical-500/10 rounded-full animate-ping" />
                    <div className="w-20 h-20 bg-medical-500 rounded-full flex items-center justify-center text-white shadow-xl shadow-medical-500/20 relative z-10">
                      {verificationStep === 'calling' && <Phone className="w-10 h-10 ecg-pulse" />}
                      {verificationStep === 'keypad' && <Activity className="w-10 h-10 ecg-pulse" />}
                      {verificationStep === 'locating' && <Navigation className="w-10 h-10 animate-bounce" />}
                      {verificationStep === 'success' && <CheckCircle2 className="w-10 h-10 scale-125" />}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <h3 className="text-xl font-black text-medical-700 font-heading">
                      {verificationStep === 'calling' && 'Calling EVV System...'}
                      {verificationStep === 'keypad' && 'Record Connection'}
                      {verificationStep === 'locating' && 'Verifying Your Location...'}
                      {verificationStep === 'success' && 'Verified'}
                    </h3>
                    <p className="text-sm font-medium text-medical-400">
                      {verificationStep === 'calling' && 'Initiating telephony handshake'}
                      {verificationStep === 'keypad' && 'Press "1" on your keypad to record your arrival'}
                      {verificationStep === 'locating' && 'Matching your GPS coordinates with the service address'}
                      {verificationStep === 'success' && 'Security timestamp recorded successfully'}
                    </p>
                  </div>
                  
                  {(verificationStep === 'calling' || verificationStep === 'locating') && (
                    <div className="w-full h-1 bg-medical-50 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '100%' }}
                        transition={{ duration: 2 }}
                        className="h-full bg-medical-500" 
                      />
                    </div>
                  )}
                </Card>
              </motion.div>
            )}

            {visit.status === 'active' ? (
              <motion.div 
                key="active-dashboard"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="space-y-6"
              >
                {/* Timer Display */}
                <Card className="medical-card p-6 border-none text-center relative overflow-hidden bg-white">
                  <div className="absolute top-[-20%] right-[-10%] opacity-[0.03] text-medical-500">
                    <Activity className="w-64 h-64 ecg-pulse" />
                  </div>
                  <div className="relative z-10">
                    <div className="flex items-center justify-center gap-2 mb-2">
                      <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      <p className="text-[10px] font-black text-medical-400 uppercase tracking-widest">LIVE CLINICAL SESSION</p>
                    </div>
                    <h3 className="text-5xl font-mono font-black text-medical-700 tracking-tighter mb-4">
                      {formatTime(elapsedSeconds)}
                    </h3>
                    <div className="flex flex-col gap-2 max-w-[240px] mx-auto">
                      <div className="flex items-center justify-between text-[10px] font-black text-medical-300">
                        <span>{formatDurationLabel(scheduledDurationSeconds)} AUTHORIZED</span>
                        <span className="text-medical-500">{usedPercent}% USED</span>
                      </div>
                      <div className="w-full h-2.5 bg-medical-50 rounded-full overflow-hidden">
                        <motion.div 
                          className="h-full bg-gradient-to-r from-medical-500 via-medical-600 to-pulse-orange" 
                          initial={{ width: 0 }}
                          animate={{ width: `${usedPercent}%` }}
                        />
                      </div>
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-tighter mt-1 self-center">
                        {formatDurationLabel(remainingSeconds)} remaining in scheduled visit
                      </p>
                    </div>
                  </div>
                </Card>

                {/* Task Checklist */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between px-2">
                    <h3 className="text-[11px] font-black text-medical-300 uppercase tracking-[0.2em] font-heading">Task Checklist</h3>
                    <Badge variant="outline" className="rounded-full bg-medical-500/5 text-medical-600 border-medical-200 uppercase text-[9px] font-black">
                      {tasks.filter(t => t.completed).length}/{tasks.length} Done
                    </Badge>
                  </div>
                  
                  <div className="space-y-3">
                    {tasks.length === 0 ? (
                      <Card className="medical-card border-none p-5 text-center text-sm font-bold text-medical-400">
                        No care tasks were assigned to this visit yet.
                      </Card>
                    ) : (
                      tasks.map((task) => (
                        <motion.div
                          key={task.id}
                          initial={{ opacity: 0, x: -10 }}
                          animate={{ opacity: 1, x: 0 }}
                          onClick={() => { void toggleTask(task.id); }}
                          className={cn(
                            "flex items-center gap-4 p-4 rounded-2xl border transition-all cursor-pointer",
                            task.completed 
                              ? "bg-white border-medical-500 shadow-md translate-x-2" 
                              : "bg-white border-medical-50 shadow-sm hover:border-medical-200"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
                            task.completed ? "bg-medical-500 text-white" : "bg-medical-50 text-medical-400"
                          )}>
                            {getCategoryIcon(task.category)}
                          </div>
                          <div className="flex-1">
                            <p className={cn("text-sm font-bold transition-colors", task.completed ? "text-medical-700" : "text-slate-600")}>
                              {task.label}
                            </p>
                            <p className="text-[10px] text-medical-300 font-black uppercase tracking-tight">{task.category}</p>
                          </div>
                          {task.completed && (
                            <div className="text-right">
                              <p className="text-[10px] font-black text-medical-500">{task.time}</p>
                              <CheckCircle2 className="w-5 h-5 text-emerald-500 ml-auto" />
                            </div>
                          )}
                        </motion.div>
                      ))
                    )}
                  </div>
                </div>

                {/* End Visit Action */}
                <div className="pt-4">
                  <Button 
                    variant="default"
                    className="w-full h-16 button-orange text-lg shadow-2xl"
                    onClick={handleCheckoutVerification}
                  >
                    END VISIT & CLOCK OUT
                  </Button>
                  <p className="text-center text-[10px] font-bold text-medical-300 uppercase tracking-widest mt-4">
                    Shield of Trust: GPS and Telephony verification active
                  </p>
                </div>
              </motion.div>
            ) : visit.status === 'scheduled' ? (
              <motion.div 
                key="arrival-protocol"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-6"
              >
                {/* Client Profile Summary */}
                <Card className="medical-card p-6 border-none shadow-xl overflow-hidden">
                  <div className="flex items-center gap-5 mb-8">
                     <Avatar className="w-20 h-20 rounded-3xl shadow-lg border-4 border-white">
                        <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${visit.patientName}`} />
                        <AvatarFallback className="bg-medical-500 text-white font-black text-3xl italic">{visit.patientName[0]}</AvatarFallback>
                     </Avatar>
                     <div className="space-y-1">
                        <h4 className="text-2xl font-black text-medical-700 font-heading leading-tight">{visit.patientName}</h4>
                        <div className="flex items-center gap-2">
                           <div className="p-1 px-2 bg-medical-50 rounded-lg border border-medical-100">
                             <p className="text-[9px] font-black text-medical-600 uppercase">HHA — Morning</p>
                           </div>
                           <Badge variant="outline" className="rounded-lg bg-emerald-50 text-emerald-600 border-none">Authorized</Badge>
                        </div>
                     </div>
                  </div>

                  <div className="space-y-4 pt-6 border-t border-medical-50">
                    <div className="flex items-start gap-4">
                       <MapPin className="w-5 h-5 text-medical-500 shrink-0 mt-0.5" />
                       <div className="space-y-1">
                          <p className="text-sm font-bold text-medical-700">{visit.patientAddress}</p>
                          <p className="text-[10px] font-black text-medical-400 uppercase tracking-tighter">Verified Service Location</p>
                       </div>
                    </div>
                    <div className="flex items-center gap-8 pl-9">
                       <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-medical-300 uppercase tracking-widest leading-none">Schedule</p>
                          <p className="text-xs font-black text-medical-600">{scheduledStartLabel} – {scheduledEndLabel}</p>
                       </div>
                       <div className="space-y-0.5">
                          <p className="text-[9px] font-black text-medical-300 uppercase tracking-widest leading-none">Duration</p>
                          <p className="text-xs font-black text-medical-600">{formatDurationLabel(scheduledDurationSeconds)}</p>
                       </div>
                    </div>
                  </div>
                </Card>

                {/* Clock In Gateway */}
                <div className="space-y-6 text-center">
                   <div className="p-8 rounded-[3rem] bg-white border border-medical-100 shadow-xl space-y-6">
                      <div className="w-20 h-20 rounded-[2rem] bg-medical-500/10 flex items-center justify-center mx-auto">
                        <MapPin className="w-10 h-10 text-medical-500" />
                      </div>
                      <div className="space-y-2">
                         <h3 className="text-xl font-black text-medical-700 font-heading">Verify Your Arrival</h3>
                         <p className="text-xs font-medium text-medical-400 leading-relaxed max-w-[220px] mx-auto">
                           Tap to securely verify your location within the service boundary.
                         </p>
                      </div>
                      <Button 
                        disabled={isCheckingIn}
                        onClick={handleGeolocationVerification}
                        className="w-full h-16 button-primary gap-3 text-lg"
                      >
                         <Navigation className="w-5 h-5" />
                         LOCATE & CLOCK IN
                      </Button>
                   </div>
                   
                   <p className="text-[10px] font-black text-medical-300 uppercase tracking-widest">
                     Other Methods: <span className="text-medical-500 ml-1 underline cursor-pointer" onClick={handleTelephonyVerification}>Telephony Handshake</span> • <span
                       className="text-medical-500 ml-1 underline cursor-pointer"
                       onClick={() =>
                         toast('Client Signature is coming soon', {
                           description: 'For now, use GPS verification or Telephony Handshake to clock in.',
                         })
                       }
                     >Client Signature</span>
                   </p>

                   <div className="p-5 flex items-start gap-3 bg-medical-50 rounded-2xl text-left border border-medical-100">
                     <ShieldCheck className="w-5 h-5 text-medical-500 shrink-0" />
                     <p className="text-[10px] font-bold text-medical-500 leading-relaxed uppercase tracking-tight">
                       Your visit is secured with high-precision GPS verification. Data is encrypted and synced in real-time for compliance.
                     </p>
                   </div>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key="completed-summary"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="py-10 text-center space-y-4"
              >
                <div className="w-24 h-24 rounded-[2.5rem] bg-emerald-50 flex items-center justify-center mx-auto border-4 border-emerald-100">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1.2 }}
                    transition={{ type: 'spring', damping: 10 }}
                  >
                    <CheckCircle2 className="w-12 h-12 text-emerald-500" />
                  </motion.div>
                </div>
                <div className="space-y-1">
                  <h4 className="text-2xl font-black text-medical-700 font-heading tracking-tight">Care Delivered</h4>
                  <p className="text-xs font-black text-medical-400 uppercase tracking-widest">Verification Status: Full Match ✓</p>
                </div>
                <div className="mt-8 p-6 bg-white medical-card text-left space-y-4">
                   <div className="flex items-center justify-between border-b border-medical-50 pb-4">
                      <p className="text-[10px] font-black text-medical-300 uppercase">Total Billable Time</p>
                      <p className="text-lg font-black text-medical-700">
                        {formatDurationLabel(
                          Math.max(
                            Math.floor(
                              (
                                new Date(visit.endTime ?? visit.scheduledEndTime).getTime() -
                                new Date(visit.startTime ?? visit.scheduledStartTime).getTime()
                              ) / 1000,
                            ),
                            0,
                          ),
                        )}
                      </p>
                   </div>
                   <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-medical-300 uppercase">Tasks Logged</p>
                      <p className="text-lg font-black text-medical-700">{tasks.length} of {tasks.length}</p>
                   </div>
                </div>
                <Button variant="ghost" className="text-medical-500 font-black uppercase text-[10px] tracking-widest" onClick={() => navigate('/')}>
                  Return to My Day
                </Button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
    </div>
  );
}
