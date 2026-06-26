/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Visit, EarningStats } from '../../types';
import { dataService } from '../../services/dataService';
import { rayhealthApi } from '../../services/rayhealth-api';
import type { TodayScheduleRow } from '../../services/rayhealth-contract';
import {
  startClockReminderService,
  stopClockReminderService,
} from '../../services/clockReminderService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, RefreshCw, DollarSign, Activity, Briefcase, Bell, Search } from 'lucide-react';
import BottomNav from '../../components/layout/BottomNav';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Logo from '../../components/Logo';
import { RAYHEALTH_FOREGROUND_EVENT } from '../../services/app-events';

function formatTime(iso: string | null): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function formatRelative(iso: string | null): string {
  if (!iso) return '';
  const ms = new Date(iso).getTime() - Date.now();
  const abs = Math.abs(ms);
  const minutes = Math.round(abs / 60_000);
  if (minutes < 1) return ms >= 0 ? 'in <1 min' : 'just now';
  if (minutes < 60) return ms >= 0 ? `in ${minutes} min` : `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return ms >= 0 ? `in ${hours} h` : `${hours} h ago`;
  const days = Math.round(hours / 24);
  return ms >= 0 ? `in ${days} d` : `${days} d ago`;
}

function scheduleBadge(row: TodayScheduleRow): { label: string; cls: string } {
  if (row.currentVisitStatus === 'verified' || row.currentVisitStatus === 'corrected') {
    return { label: 'Completed', cls: 'bg-emerald-50 text-emerald-700 border-emerald-100' };
  }
  if (row.currentVisitStatus === 'pending') {
    return { label: 'In progress', cls: 'bg-blue-50 text-blue-700 border-blue-100' };
  }
  if (row.scheduledStartTime && new Date(row.scheduledStartTime).getTime() < Date.now()) {
    return { label: 'Due now', cls: 'bg-orange-50 text-orange-700 border-orange-100' };
  }
  return { label: 'Scheduled', cls: 'bg-medical-50 text-medical-700 border-medical-100' };
}

export default function DashboardScreen() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [activeTab, setActiveTab ] = useState('today');
  const [visits, setVisits] = useState<Visit[]>([]);
  const [schedule, setSchedule] = useState<TodayScheduleRow[]>([]);
  const [earnings, setEarnings] = useState<EarningStats | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const displayedEarnings = earnings?.totalEarnings ?? earnings?.weekly ?? 0;

  const refreshDashboard = useCallback(async (includeSync = false) => {
      const v = await dataService.getVisits();
      const e = await dataService.getEarnings();
      setVisits(v);
      setEarnings(e);

      if (includeSync) {
        try {
          await dataService.syncWithParent();
          const syncedVisits = await dataService.getVisits();
          const syncedEarnings = await dataService.getEarnings();
          setVisits(syncedVisits);
          setEarnings(syncedEarnings);
        } catch (e) {
          console.log('Background autosync failed', e);
        }
      }
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      await refreshDashboard(true);
    };
    void fetchData();
  }, [refreshDashboard, user]);

  useEffect(() => {
    const handleForegroundRefresh = async () => {
      if (document.visibilityState === 'visible') {
        await refreshDashboard(false);
      }
    };

    const handleWindowFocus = () => {
      void handleForegroundRefresh();
    };

    document.addEventListener('visibilitychange', handleWindowFocus);
    window.addEventListener('focus', handleWindowFocus);
    window.addEventListener(RAYHEALTH_FOREGROUND_EVENT, handleWindowFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleWindowFocus);
      window.removeEventListener('focus', handleWindowFocus);
      window.removeEventListener(RAYHEALTH_FOREGROUND_EVENT, handleWindowFocus);
    };
  }, [refreshDashboard]);

  // RayHealth signature feature: 30-second pre-warning reminder.
  // Pulls today's schedule, registers iOS/Android local notifications
  // for `scheduled_start_time - 30s` and `scheduled_end_time - 30s` of
  // every assignment, and fires a haptic + in-app banner in the
  // foreground. The reminder service handles permission requests on
  // first start. Cleanup on unmount stops the foreground tick — the
  // OS-scheduled notifications remain so a backgrounded app still
  // gets the prompt.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const r = await rayhealthApi.getTodaysSchedule();
        if (cancelled) return;
        setSchedule(r.schedule);
        await startClockReminderService(r.schedule);
      } catch (err) {
        console.warn('Failed to load today schedule for reminders:', err);
      }
    })();

    const onReminder = (e: Event) => {
      const detail = (e as CustomEvent<{
        kind: 'start' | 'end';
        clientName: string;
        scheduledAt: string;
      }>).detail;
      const t = new Date(detail.scheduledAt).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      });
      const verb = detail.kind === 'start' ? 'Time to clock in for' : 'Time to clock out —';
      toast(detail.kind === 'start' ? `${verb} ${detail.clientName}` : `${verb} ${detail.clientName}`, {
        description: detail.kind === 'start' ? `Visit starts at ${t}` : `Shift ends at ${t}`,
        duration: 8_000,
      });
    };
    window.addEventListener('rayhealth:clock-reminder', onReminder as EventListener);

    return () => {
      cancelled = true;
      window.removeEventListener('rayhealth:clock-reminder', onReminder as EventListener);
      stopClockReminderService();
    };
  }, [user]);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await refreshDashboard(true);
      toast.success('Sync successful with agency system');
    } catch (e) {
      toast.error('Sync failed. Please check connection.');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusColor = (status: Visit['status']) => {
    switch (status) {
      case 'active': return 'bg-blue-50 text-blue-700 border-blue-100';
      case 'completed': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'missed': return 'bg-rose-50 text-rose-700 border-rose-100';
      default: return 'bg-medical-50 text-medical-600 border-medical-100';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-medical-50 pb-24 overflow-x-hidden">
      <header className="bg-white px-6 py-4 safe-area-top shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-medical-100 flex items-center justify-between z-20 sticky top-0">
        <Logo size="sm" className="h-8" />
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl text-medical-400 hover:text-medical-600 hover:bg-medical-100"
            onClick={handleSync}
            disabled={isSyncing}
          >
            <RefreshCw className={cn("w-5 h-5", isSyncing && "animate-spin")} />
          </Button>
          <Button 
            variant="ghost" 
            size="icon" 
            className="rounded-xl text-medical-400 hover:text-medical-600 hover:bg-medical-100"
            onClick={() => navigate('/notifications')}
          >
            <Bell className="w-5 h-5" />
          </Button>
          <Avatar className="w-9 h-9 border-2 border-medical-200 shadow-sm transition-transform active:scale-95" onClick={() => navigate('/profile')}>
            <AvatarImage src="" />
            <AvatarFallback className="bg-medical-600 text-white text-xs font-black font-heading">
              {user?.firstName?.[0]?.toUpperCase() || user?.email?.[0]?.toUpperCase() || 'C'}
            </AvatarFallback>
          </Avatar>
        </div>
      </header>

      <ScrollArea className="flex-1 px-6 pt-6">
        <div className="space-y-8 pb-10">
          <div className="flex flex-col">
            <h1 className="text-3xl font-black text-medical-700 font-heading tracking-tighter leading-none">
              Hello, {user?.firstName || 'there'}
            </h1>
            <p className="text-[11px] font-bold text-medical-400 uppercase tracking-widest mt-2">
              {format(new Date(), 'EEEE, MMMM do')}
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Card className="medical-card bg-gradient-to-br from-medical-600 to-medical-500 border-none shadow-lg text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full blur-xl -mr-8 -mt-8" />
              <CardContent className="p-5 flex flex-col items-center justify-center relative z-10 text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mb-1 backdrop-blur-sm">
                  <Briefcase className="w-5 h-5 text-white" />
                </div>
                <p className="text-2xl font-black font-heading tracking-tight">{visits.filter(v => v.status === 'completed').length}</p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-medical-100">Visits Done</p>
              </CardContent>
            </Card>

            <Card className="medical-card bg-white border border-medical-100 shadow-xl overflow-hidden">
              <CardContent className="p-5 flex flex-col items-center justify-center text-center space-y-1">
                <div className="w-10 h-10 rounded-full bg-pulse-orange/10 flex items-center justify-center mb-1">
                  <DollarSign className="w-5 h-5 text-pulse-orange" />
                </div>
                <p className="text-2xl font-black font-heading text-medical-700 tracking-tight">${displayedEarnings}</p>
                <p className="text-[10px] uppercase tracking-wider font-bold text-medical-400">Week Earnings</p>
              </CardContent>
            </Card>
          </div>

          <div className="flex items-center justify-between">
            <Tabs value={activeTab} className="w-full" onValueChange={setActiveTab}>
              <TabsList className="grid w-full grid-cols-3 rounded-2xl h-12 p-1 bg-medical-100/50">
                <TabsTrigger value="today" className="rounded-xl font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-medical-600 data-[state=active]:shadow-sm">
                  Active
                </TabsTrigger>
                <TabsTrigger value="upcoming" className="rounded-xl font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-medical-600 data-[state=active]:shadow-sm">
                  Roster
                </TabsTrigger>
                <TabsTrigger value="earnings" className="rounded-xl font-bold text-[10px] uppercase tracking-widest data-[state=active]:bg-white data-[state=active]:text-medical-600 data-[state=active]:shadow-sm">
                  Wallet
                </TabsTrigger>
              </TabsList>
            </Tabs>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {activeTab === 'earnings' ? (
                <div className="space-y-4">
                  {earnings && (
                    <Card className="p-6 bg-gradient-to-br from-medical-600 to-medical-700 rounded-[2rem] text-white shadow-xl border-none relative overflow-hidden">
                      <div className="absolute -right-8 -top-8 w-48 h-48 bg-white/5 rounded-full blur-3xl" />
                      <div className="relative z-10">
                        <div className="flex justify-between items-start mb-6">
                          <div className="p-2.5 bg-white/20 rounded-xl backdrop-blur-md">
                            <DollarSign className="w-5 h-5" />
                          </div>
                          <Badge className="bg-white/10 text-white border-none text-[9px] uppercase font-black px-2 rounded-full">Payroll Active</Badge>
                        </div>
                        <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-1">Total Accrued (May)</p>
                        <h3 className="text-4xl font-black tracking-tighter">${earnings.weekly.toFixed(2)}</h3>
                        <div className="mt-8 flex items-center justify-between">
                          <div className="text-center bg-white/5 p-3 rounded-2xl flex-1 mr-2">
                            <p className="text-white/40 text-[8px] font-bold uppercase">Visits</p>
                            <p className="text-lg font-black">{earnings.completedVisits}</p>
                          </div>
                          <div className="text-center bg-white/5 p-3 rounded-2xl flex-1">
                            <p className="text-white/40 text-[8px] font-bold uppercase">Hours</p>
                            <p className="text-lg font-black">{earnings.totalHours}</p>
                          </div>
                        </div>
                      </div>
                    </Card>
                  )}
                  <Button variant="ghost" className="w-full h-12 rounded-2xl text-medical-400 font-bold text-xs uppercase tracking-tight hover:bg-medical-50">
                    View Full Payment Ledger
                  </Button>
                </div>
              ) : activeTab === 'today' ? (
                <div className="space-y-4">
                  {schedule.length === 0 ? (
                    <div className="py-16 px-6 text-center space-y-4 bg-white medical-card">
                      <div className="w-16 h-16 bg-medical-50 rounded-full flex items-center justify-center mx-auto">
                        <Search className="w-8 h-8 text-medical-200" />
                      </div>
                      <h4 className="text-lg font-bold text-medical-500 font-heading">No visits scheduled today</h4>
                      <p className="text-xs text-medical-400 font-medium">Your coordinator hasn't assigned any visits in the next 24 hours.</p>
                      <Button onClick={handleSync} disabled={isSyncing} className="button-primary h-12 px-8">
                        SYNC ASSIGNMENTS
                      </Button>
                    </div>
                  ) : (
                    schedule.map((row, idx) => {
                      const badge = scheduleBadge(row);
                      const fullName = `${row.clientFirstName} ${row.clientLastName}`.trim();
                      const targetVisitId = row.currentVisitId;
                      const isInProgress = row.currentVisitStatus === 'pending';
                      const handleNavigate = () => {
                        if (targetVisitId) {
                          navigate(`/visits/${targetVisitId}`);
                        } else {
                          // No visit yet — clicking takes them to the assignment so they can clock in
                          navigate(`/visits/start/${row.assignmentId}`);
                        }
                      };
                      return (
                        <motion.div
                          key={row.assignmentId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group"
                          onClick={handleNavigate}
                        >
                          <Card className="medical-card border-none shadow-md p-5 relative cursor-pointer active:scale-[0.98] transition-all">
                            <div className="flex items-start justify-between mb-4">
                              <Badge className={cn('text-[9px] font-black uppercase rounded-lg border', badge.cls)}>
                                {badge.label}
                              </Badge>
                              <div className="text-right">
                                <p className="text-[10px] font-bold text-medical-500">
                                  {formatTime(row.scheduledStartTime)} — {formatTime(row.scheduledEndTime)}
                                </p>
                                {row.scheduledStartTime && (
                                  <p className="text-[10px] font-bold text-medical-300">
                                    {formatRelative(row.scheduledStartTime)}
                                  </p>
                                )}
                              </div>
                            </div>
                            <div className="flex gap-4">
                              <Avatar className="w-12 h-12 rounded-xl shadow-sm border border-medical-50">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${fullName}`} />
                                <AvatarFallback className="bg-medical-50 text-medical-400 font-black">
                                  {fullName[0] || 'C'}
                                </AvatarFallback>
                              </Avatar>
                              <div className="flex-1 min-w-0">
                                <h4 className="font-black text-medical-700 text-lg font-heading leading-tight truncate">{fullName}</h4>
                                <p className="text-[11px] text-medical-400 font-bold uppercase tracking-tight mt-0.5 truncate">
                                  {row.templateName || 'Clinical Care · Routine Session'}
                                </p>
                                <div className="flex items-center gap-1.5 mt-3 text-medical-500">
                                  <MapPin className="w-3 h-3" />
                                  <p className="text-[10px] font-bold truncate">
                                    {[row.clientAddressLine1, row.clientCity, row.clientState].filter(Boolean).join(', ') || 'Address not set'}
                                  </p>
                                </div>
                              </div>
                            </div>
                            {isInProgress && (
                              <div className="mt-4 pt-4 border-t border-medical-50">
                                <Button className="w-full h-11 button-accent text-xs">
                                  CONTINUE CLINICAL SESSION
                                </Button>
                              </div>
                            )}
                          </Card>
                        </motion.div>
                      );
                    })
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {visits.length === 0 ? (
                    <div className="py-16 px-6 text-center space-y-4 bg-white medical-card">
                      <div className="w-16 h-16 bg-medical-50 rounded-full flex items-center justify-center mx-auto">
                        <Search className="w-8 h-8 text-medical-200" />
                      </div>
                      <h4 className="text-lg font-bold text-medical-500 font-heading">No prior visits</h4>
                      <Button onClick={handleSync} disabled={isSyncing} className="button-primary h-12 px-8">
                        SYNC ASSIGNMENTS
                      </Button>
                    </div>
                  ) : (
                    visits
                      .filter(v => v.status === 'completed' || v.status === 'scheduled')
                      .map((visit, idx) => (
                        <motion.div
                          key={visit.id}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="group"
                          onClick={() => navigate(`/visits/${visit.id}`)}
                        >
                          <Card className="medical-card border-none shadow-md p-5 relative cursor-pointer active:scale-[0.98] transition-all">
                            <div className="flex items-start justify-between mb-4">
                              <Badge className={cn("text-[9px] font-black uppercase rounded-lg", getStatusColor(visit.status))}>
                                {visit.status}
                              </Badge>
                              <p className="text-[10px] font-bold text-medical-300">{format(new Date(visit.scheduledStartTime), 'h:mm a')}</p>
                            </div>
                            <div className="flex gap-4">
                              <Avatar className="w-12 h-12 rounded-xl shadow-sm border border-medical-50">
                                <AvatarImage src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${visit.patientName}`} />
                                <AvatarFallback className="bg-medical-50 text-medical-400 font-black">{visit.patientName[0]}</AvatarFallback>
                              </Avatar>
                              <div className="flex-1">
                                <h4 className="font-black text-medical-700 text-lg font-heading leading-tight">{visit.patientName}</h4>
                                <p className="text-[11px] text-medical-400 font-bold uppercase tracking-tight mt-0.5">Clinical Care · Routine Session</p>
                                <div className="flex items-center gap-1.5 mt-3 text-medical-500">
                                  <MapPin className="w-3 h-3" />
                                  <p className="text-[10px] font-bold truncate">{visit.patientAddress}</p>
                                </div>
                              </div>
                            </div>
                            {visit.status === 'active' && (
                              <div className="mt-4 pt-4 border-t border-medical-50">
                                <Button className="w-full h-11 button-accent text-xs">
                                  CONTINUE CLINICAL SESSION
                                </Button>
                              </div>
                            )}
                          </Card>
                        </motion.div>
                      ))
                  )}
                </div>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </ScrollArea>
      <BottomNav />
    </div>
  );
}
