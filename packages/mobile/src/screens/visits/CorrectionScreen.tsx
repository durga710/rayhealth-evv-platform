/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { dataService } from '../../services/dataService';
import { Visit } from '../../types';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { motion } from 'motion/react';
import { 
  ChevronLeft, Clock, Calendar, AlertTriangle, 
  Send, History, MessageSquare, Info, ShieldCheck
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function CorrectionScreen() {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [visit, setVisit] = useState<Visit | null>(null);
  
  const [correctedStartTime, setCorrectedStartTime] = useState('09:00');
  const [correctedEndTime, setCorrectedEndTime] = useState('12:00');
  const [reason, setReason] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (id) {
      const fetchVisit = async () => {
        const v = await dataService.getVisitById(id);
        if (v) setVisit(v);
      };
      fetchVisit();
    }
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason || reason.length < 10) {
      toast.error('Please provide a detailed reason (at least 10 characters)');
      return;
    }

    setIsLoading(true);
    try {
      const date = visit?.scheduledStartTime.split('T')[0] || new Date().toISOString().split('T')[0];
      
      await dataService.addCorrection({
        visitId: id || '',
        caregiverId: user?.id || '',
        correctedStartTime: `${date}T${correctedStartTime}:00Z`,
        correctedEndTime: `${date}T${correctedEndTime}:00Z`,
        reason,
        originalStartTime: visit?.startTime,
        originalEndTime: visit?.endTime,
      });

      // Artificial delay for UI feedback
      await new Promise(resolve => setTimeout(resolve, 1200));
      
      toast.success('Correction request submitted to RayHealth supervisor');
      navigate('/corrections');
    } catch (error) {
      toast.error('Failed to submit request');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-screen bg-[#F8FAFC] pb-12">
      <header className="bg-white px-6 py-5 safe-area-top shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-slate-100 flex items-center gap-4 z-10">
        <Button variant="ghost" size="icon" className="rounded-2xl bg-slate-50 hover:bg-slate-100 h-10 w-10 border border-slate-100 transition-all active:scale-95 shadow-sm" onClick={() => navigate(-1)}>
          <ChevronLeft className="w-5 h-5 text-slate-500" />
        </Button>
        <div>
          <h2 className="text-xl font-bold tracking-tight font-heading text-slate-900">Time Correction</h2>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest font-heading">Protocol Exception Request</p>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="p-6 space-y-6">
          {/* Context Alert */}
          <div className="p-5 bg-amber-50/50 rounded-3xl border border-amber-100/50 flex gap-4">
            <div className="p-2.5 bg-amber-100 rounded-xl h-fit">
              <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-amber-900 leading-tight font-heading">State Compliance Protocol</p>
              <p className="text-[10px] text-amber-800/80 leading-relaxed font-bold">
                Manual corrections are flagged for clinical agency review. Ensure accurate justification to comply with EVV state directives.
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 pb-10">
            <Card className="medical-card border-none overflow-hidden">
              <CardHeader className="bg-medical-700 text-white py-6">
                <CardTitle className="text-lg flex items-center gap-2 font-heading">
                  <Clock className="w-5 h-5 text-medical-200" />
                  Proposed Rectification
                </CardTitle>
                <CardDescription className="text-medical-200/60 font-bold uppercase text-[10px] tracking-widest font-heading">
                  Visit Date: May 6, 2026
                </CardDescription>
              </CardHeader>
              <CardContent className="p-7 space-y-7">
                <div className="grid grid-cols-1 gap-6">
                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-heading">Adjusted Start Time</Label>
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/20">
                      <Clock className="w-5 h-5 text-medical-500 opacity-60" />
                      <Input 
                        type="time" 
                        value={correctedStartTime}
                        onChange={(e) => setCorrectedStartTime(e.target.value)}
                        className="border-none bg-transparent h-auto p-0 text-2xl font-mono font-bold focus-visible:ring-0 text-slate-800"
                      />
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-heading">Adjusted End Time</Label>
                    <div className="flex items-center gap-4 bg-slate-50 p-4 rounded-2xl border border-slate-100 transition-all focus-within:ring-2 focus-within:ring-primary/10 focus-within:border-primary/20">
                      <History className="w-5 h-5 text-medical-500 opacity-60" />
                      <Input 
                        type="time" 
                        value={correctedEndTime}
                        onChange={(e) => setCorrectedEndTime(e.target.value)}
                        className="border-none bg-transparent h-auto p-0 text-2xl font-mono font-bold focus-visible:ring-0 text-slate-800"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Label className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 font-heading flex items-center justify-between">
                    <span>Clinical Justification</span>
                    <Badge variant="outline" className="text-[9px] font-black uppercase text-medical-600 border-medical-100 bg-medical-50 px-2 py-0">Required</Badge>
                  </Label>
                  <div className="relative group">
                    <MessageSquare className="absolute left-4 top-4 w-5 h-5 text-slate-300 group-focus-within:text-medical-500 transition-colors" />
                    <textarea 
                      className="w-full min-h-[140px] bg-slate-50 p-5 pl-12 rounded-3xl border border-slate-100 text-sm font-bold text-slate-700 outline-none transition-all placeholder:text-slate-300 focus:ring-4 focus:ring-medical-500/5 focus:border-medical-500/20 shadow-inner-sm"
                      placeholder="Specify clinical reason for correction..."
                      value={reason}
                      onChange={(e) => setReason(e.target.value)}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="space-y-5">
              <div className="flex items-center gap-3 px-3">
                <div className="w-8 h-8 rounded-full bg-emerald-50 flex items-center justify-center border border-emerald-100">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                </div>
                <span className="text-[10px] font-bold text-slate-400 italic leading-snug">
                  I certify under penalty of clinical non-compliance that the above session times are accurate.
                </span>
              </div>
              <Button type="submit" disabled={isLoading} className="w-full h-16 rounded-2xl text-lg font-bold shadow-[0_8px_30px_rgb(37,99,235,0.2)] bg-primary font-heading transition-all hover:scale-[1.01] active:scale-[0.98]">
                {isLoading ? 'Processing...' : (
                  <div className="flex items-center gap-2">
                    <Send className="w-5 h-5 mr-1" />
                    Submit Formal Request
                  </div>
                )}
              </Button>
              <Button type="button" variant="ghost" className="w-full h-12 rounded-xl font-bold text-slate-400 font-heading" onClick={() => navigate(-1)}>
                Cancel Request
              </Button>
            </div>
          </form>
        </div>
      </ScrollArea>
    </div>
  );
}
