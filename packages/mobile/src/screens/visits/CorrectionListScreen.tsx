/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { MissedPunchCorrection } from '../../types';
import { dataService } from '../../services/dataService';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { motion } from 'motion/react';
import { 
  ChevronLeft, Clock, Calendar, 
  CheckCircle2, XCircle, Loader2, AlertCircle,
  FileText, ArrowRight, History, RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import BottomNav from '../../components/layout/BottomNav';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';

export default function CorrectionListScreen() {
  const navigate = useNavigate();
  const [corrections, setCorrections] = useState<MissedPunchCorrection[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const fetchCorrections = async () => {
      const c = await dataService.getCorrections();
      setCorrections(c);
    };
    fetchCorrections();
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    try {
      await dataService.syncWithParent();
      const c = await dataService.getCorrections();
      setCorrections(c);
      toast.success('Supervisor approvals synced');
    } catch (e) {
      toast.error('Sync failed');
    } finally {
      setIsSyncing(false);
    }
  };

  const getStatusIcon = (status: MissedPunchCorrection['status']) => {
    switch (status) {
      case 'approved': return <CheckCircle2 className="w-4 h-4 text-emerald-500" />;
      case 'rejected': return <XCircle className="w-4 h-4 text-red-500" />;
      case 'pending': return <Loader2 className="w-4 h-4 text-amber-500 animate-spin" />;
    }
  };

  const getStatusLabel = (status: MissedPunchCorrection['status']) => {
    switch (status) {
      case 'approved': return 'Approved';
      case 'rejected': return 'Rejected';
      case 'pending': return 'Reviewing';
    }
  };

  const getStatusColor = (status: MissedPunchCorrection['status']) => {
    switch (status) {
      case 'approved': return 'bg-emerald-50 text-emerald-700 border-emerald-100';
      case 'rejected': return 'bg-red-50 text-red-700 border-red-100';
      case 'pending': return 'bg-amber-50 text-amber-700 border-amber-100';
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] pb-24">
      <header className="bg-white px-6 py-5 safe-area-top shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-slate-100 flex items-center justify-between z-10">
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading text-slate-900">Time Corrections</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-heading">Protocol Review & History</p>
        </div>
        <Button 
          variant="outline" 
          size="icon" 
          className={cn("rounded-2xl border-slate-100 bg-slate-50 transition-all hover:bg-slate-100 h-10 w-10", isSyncing && "animate-spin text-primary")}
          onClick={handleSync}
          disabled={isSyncing}
        >
          <RefreshCw className="w-4 h-4 text-slate-500" />
        </Button>
      </header>

      <ScrollArea className="flex-1 px-6 pt-6">
        <div className="space-y-5 pb-10">
          {corrections.map((correction, index) => (
            <motion.div
              key={correction.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
            >
              <Card className="medical-card border-none overflow-hidden">
                <CardContent className="p-5 space-y-5">
                  <div className="flex justify-between items-start">
                    <div className="flex items-center gap-2">
                       <Badge className={cn("text-[10px] py-0.5 px-3 font-bold uppercase flex items-center gap-1.5 h-7 rounded-xl border shadow-none font-heading", getStatusColor(correction.status))}>
                         {getStatusIcon(correction.status)}
                         {getStatusLabel(correction.status)}
                       </Badge>
                       <div className="h-4 w-px bg-slate-100 mx-1" />
                       <span className="text-[10px] text-slate-400 font-bold uppercase tracking-tight font-heading">{format(new Date(correction.createdAt), 'MMM d, h:mm a')}</span>
                    </div>
                    <p className="text-[10px] font-bold text-slate-300 uppercase tracking-tighter">ID: {correction.id}</p>
                  </div>

                  <div className="flex items-center justify-between bg-slate-50/50 p-4 rounded-2xl border border-slate-100/50">
                    <div className="flex items-center gap-4">
                      <div className="flex flex-col items-center">
                        <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center shadow-sm">
                          <Clock className="w-3.5 h-3.5 text-medical-500" />
                        </div>
                      </div>
                      <div className="space-y-1">
                        <p className="text-sm font-black flex items-center gap-2 text-slate-900 font-mono">
                          {format(new Date(correction.correctedStartTime), 'h:mm a')}
                          <ArrowRight className="w-3 h-3 text-slate-300" />
                          {format(new Date(correction.correctedEndTime), 'h:mm a')}
                        </p>
                        <div className="flex items-center gap-2 text-[10px] text-slate-500 font-bold uppercase tracking-tight">
                           <Calendar className="w-3 h-3 text-medical-400" />
                           {format(new Date(correction.correctedStartTime), 'EEEE, MMM d')}
                        </div>
                      </div>
                    </div>
                    
                    <div className="text-right border-l border-slate-100 pl-4">
                      <p className="text-[9px] text-slate-400 font-bold uppercase mb-1 font-heading">Assigned To</p>
                      <p className="text-sm font-bold text-slate-900 leading-none font-heading">Patient #2241</p>
                    </div>
                  </div>

                  <div className="p-4 bg-white border border-slate-100 rounded-2xl space-y-2 shadow-inner-sm">
                    <div className="flex items-center gap-2 mb-1">
                      <div className="w-5 h-5 rounded-md bg-amber-50 flex items-center justify-center">
                        <FileText className="w-3 h-3 text-amber-500" />
                      </div>
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest font-heading">Clinical Justification</span>
                    </div>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed italic pr-4">
                      "{correction.reason}"
                    </p>
                  </div>

                  {correction.status === 'approved' && (
                    <div className="flex items-center gap-2 pt-2 border-t border-slate-50">
                      <AlertCircle className="w-3 h-3 text-emerald-500" />
                      <p className="text-[10px] font-bold text-emerald-600 uppercase">Times updated in payroll system</p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
          
          {corrections.length === 0 && (
            <div className="flex flex-col items-center justify-center py-20 text-center space-y-4 opacity-40">
              <div className="p-6 bg-slate-100 rounded-full">
                <CheckCircle2 className="w-12 h-12 text-slate-400" />
              </div>
              <div className="space-y-1">
                <p className="font-bold">All caught up!</p>
                <p className="text-xs">No pending or historical corrections found.</p>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <BottomNav />
    </div>
  );
}
