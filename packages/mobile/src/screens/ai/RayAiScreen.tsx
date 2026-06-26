/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Sparkles, Send, Loader2, User, Bot, Info, Activity } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { rayAssistantService } from '../../services/geminiService';
import { useAuth } from '../../contexts/AuthContext';
import { cn } from '@/lib/utils';
import BottomNav from '../../components/layout/BottomNav';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

export default function RayAiScreen() {
  const location = useLocation();
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([
    { role: 'assistant', content: 'Hi there! I am Ray, your RayHealth AI assistant. How can I assist you with your clinical visits, compliance, or earnings today?' }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const state = location.state as { initialMessage?: string };
    if (state?.initialMessage) {
      // Avoid duplicate triggers if state persists
      const userMsg = state.initialMessage;
      setMessages(prev => {
        if (prev.some(m => m.role === 'user' && m.content === userMsg)) return prev;
        return [...prev, { role: 'user', content: userMsg }];
      });
      
      const processMessage = async () => {
        setIsLoading(true);
        try {
          const response = await rayAssistantService.chat(userMsg, { 
            userFirstName: user?.firstName,
            userRole: user?.role,
            time: new Date().toISOString()
          });
          setMessages(prev => [...prev, { role: 'assistant', content: response }]);
        } catch (err) {
          setMessages(prev => [...prev, { role: 'assistant', content: "I encountered a system hiccup. Please try again later." }]);
        } finally {
          setIsLoading(false);
        }
      };

      // Reset location state to prevent re-triggering on refresh/mount
      window.history.replaceState({}, document.title);
      processMessage();
    }
  }, [location.state, user]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages]);

  const handleSend = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMsg = input.trim();
    setInput('');
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setIsLoading(true);

    try {
      const response = await rayAssistantService.chat(userMsg, { 
        userFirstName: user?.firstName,
        userRole: user?.role,
        time: new Date().toISOString()
      });
      setMessages(prev => [...prev, { role: 'assistant', content: response }]);
    } catch (err) {
      setMessages(prev => [...prev, { role: 'assistant', content: "I encounterd a system hiccup. Please try again later." }]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-medical-50 pb-24 overflow-hidden">
      <header className="bg-white px-6 py-5 safe-area-top shadow-[0_4px_24px_-8px_rgba(0,0,0,0.06)] border-b border-medical-100 flex items-center justify-between z-10">
        <div className="flex items-center gap-4">
          <div className="relative">
            <div className="absolute inset-0 bg-medical-500/20 blur-xl rounded-full" />
            <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-medical-600 to-medical-500 flex items-center justify-center text-white shadow-lg relative">
              <Activity className="w-6 h-6 ecg-pulse" />
            </div>
          </div>
          <div className="space-y-0.5">
            <h2 className="text-lg font-black tracking-tight text-medical-700 font-heading leading-tight">Ray Assistant</h2>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-pulse-orange animate-pulse" />
              <p className="text-[10px] text-medical-300 font-black uppercase tracking-[0.2em]">Clinical AI · Active</p>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 overflow-hidden flex flex-col relative">
        <ScrollArea className="flex-1 px-6 pt-6" viewportRef={scrollRef}>
          <div className="space-y-6 pb-40">
            {messages.map((msg, i) => (
              <motion.div 
                key={i} 
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "flex gap-3 max-w-[85%]",
                  msg.role === 'user' ? "ml-auto flex-row-reverse" : ""
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-1 shadow-sm border",
                  msg.role === 'assistant' 
                    ? "bg-white border-medical-100 text-medical-500" 
                    : "bg-medical-600 border-medical-600 text-white"
                )}>
                  {msg.role === 'assistant' ? <Activity className="w-4 h-4 ecg-pulse" /> : <User className="w-4 h-4" />}
                </div>
                <div className={cn(
                  "p-4 rounded-[1.25rem] text-sm leading-relaxed shadow-sm font-medium",
                  msg.role === 'assistant' 
                    ? "bg-white border border-medical-100 text-medical-700 rounded-tl-none font-sans" 
                    : "bg-medical-600 text-white rounded-tr-none font-sans"
                )}>
                  {msg.content}
                </div>
              </motion.div>
            ))}
            {isLoading && (
              <motion.div 
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex gap-3 max-w-[85%]"
              >
                <div className="w-8 h-8 rounded-lg bg-white border border-medical-100 flex items-center justify-center shadow-sm">
                  <Loader2 className="w-4 h-4 text-medical-500 animate-spin" />
                </div>
                <div className="bg-white border border-medical-100 p-4 rounded-[1.25rem] rounded-tl-none flex items-center gap-2">
                  <span className="text-[10px] text-medical-300 font-black uppercase tracking-widest">Ray is thinking...</span>
                </div>
              </motion.div>
            )}
          </div>
        </ScrollArea>

        <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-medical-50 via-medical-50/95 to-transparent pb-32">
          <Card className="border-none bg-medical-100/50 mb-4 p-4 flex items-start gap-4 rounded-2xl shadow-inner-sm">
            <Info className="w-4 h-4 text-medical-400 shrink-0 mt-0.5" />
            <p className="text-[10px] text-medical-500 font-bold leading-relaxed uppercase tracking-tight">
              Ask about clinical procedures, visit verification, or payroll compliance.
            </p>
          </Card>
          
          <form onSubmit={handleSend} className="relative">
            <textarea 
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder={`How can I help you${user?.firstName ? `, ${user.firstName}` : ''}?`}
              className="w-full rounded-2xl border border-medical-100 focus:ring-4 focus:ring-medical-500/10 focus:border-medical-500/20 min-h-[56px] max-h-32 px-5 py-4 text-sm font-bold bg-white shadow-xl outline-none transition-all resize-none placeholder:text-medical-200 pr-14"
            />
            <Button 
              type="submit" 
              disabled={!input.trim() || isLoading}
              className={cn(
                "absolute right-2 bottom-2 rounded-xl h-10 w-10 shrink-0 shadow-lg transition-all active:scale-95",
                input.trim() ? "button-accent" : "bg-medical-50 text-medical-200"
              )}
            >
              <Send className="w-4 h-4" />
            </Button>
          </form>
        </div>
      </div>

      <BottomNav />
    </div>
  );
}
