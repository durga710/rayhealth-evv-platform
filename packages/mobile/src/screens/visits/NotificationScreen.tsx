import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { dataService } from '../../services/dataService';
import { Notification } from '../../types';
import { Button } from '@/components/ui/button';
import { Avatar } from '@/components/ui/avatar';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import BottomNav from '../../components/layout/BottomNav';
import { Bell, ChevronLeft, MessageSquareShare, Trash2, Info, AlertTriangle, CheckCircle2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { format } from 'date-fns';
import { toast } from 'sonner';

export default function NotificationScreen() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchNotifications = async () => {
      try {
        const data = await dataService.getNotifications();
        setNotifications(data);
      } catch (err) {
        console.error('Failed to fetch notifications', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchNotifications();
  }, []);

  const handleMarkAsRead = async (id: string) => {
    try {
      await dataService.markNotificationRead(id);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
    } catch (err) {
      console.error('Failed to mark as read', err);
    }
  };

  const handleTransferToAi = (notification: Notification) => {
    // Navigate to AI screen and pass context via state
    navigate('/ai', {
      state: {
        initialMessage: `I want to discuss this alert: "${notification.title}". Context: ${notification.aiContext || notification.message}`
      }
    });
  };

  // Whitelist of mobile routes the backend may set in `notification.actionUrl`.
  // Anything outside this set hits the wildcard <Route path="*"> in App.tsx and
  // silently bounces to '/', which feels like a dead tap. Keep this list in
  // sync with src/App.tsx.
  const isKnownRoute = (url: string | undefined): boolean => {
    if (!url || !url.startsWith('/')) return false;
    if (url === '/' || url === '/corrections' || url === '/ai' || url === '/schedule' || url === '/profile' || url === '/notifications' || url === '/learning') {
      return true;
    }
    if (/^\/visits\/[^/]+(?:\/correction)?$/.test(url)) return true;
    return false;
  };

  const handleViewVisit = (notification: Notification) => {
    if (!isKnownRoute(notification.actionUrl)) {
      toast('Action link unavailable', {
        description: "This alert links to a feature that isn't available in this build.",
      });
      return;
    }
    navigate(notification.actionUrl!);
  };

  const getIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info': return <Info className="w-5 h-5 text-blue-500" />;
      case 'warning': return <AlertTriangle className="w-5 h-5 text-amber-500" />;
      case 'success': return <CheckCircle2 className="w-5 h-5 text-emerald-500" />;
      case 'error': return <XCircle className="w-5 h-5 text-rose-500" />;
    }
  };

  return (
    <div className="flex-1 flex flex-col h-screen bg-medical-50 pb-24 overflow-hidden">
      <header className="bg-white px-6 py-5 safe-area-top shadow-sm border-b border-medical-100 flex items-center gap-4 z-10 sticky top-0">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-xl">
          <ChevronLeft className="w-6 h-6 text-medical-400" />
        </Button>
        <div className="flex-1">
          <h2 className="text-xl font-black tracking-tight text-medical-700 font-heading">Clinical Alerts</h2>
          <p className="text-[10px] font-bold text-medical-300 uppercase tracking-widest mt-0.5">Stay Synchronized</p>
        </div>
        <div className="p-2 bg-medical-50 rounded-xl">
          <Bell className="w-5 h-5 text-medical-500" />
        </div>
      </header>

      <ScrollArea className="flex-1 px-4 pt-6">
        <div className="space-y-4 pb-10">
          <AnimatePresence mode="popLayout">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-20 opacity-50">
                <Bell className="w-12 h-12 text-medical-200 animate-bounce" />
                <p className="text-[10px] font-black uppercase tracking-widest text-medical-300 mt-4">Consulting Cloud...</p>
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-20 px-10 text-center space-y-6">
                <div className="w-20 h-20 bg-white rounded-[2rem] shadow-xl flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-10 h-10 text-medical-200" />
                </div>
                <div>
                  <h4 className="text-lg font-black text-medical-700 font-heading">Clear Skies</h4>
                  <p className="text-xs font-bold text-medical-400 uppercase tracking-tight mt-1">No pending alerts or notifications.</p>
                </div>
              </div>
            ) : (
              notifications.map((notification, idx) => (
                <motion.div
                  key={notification.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: idx * 0.05 }}
                >
                  <Card 
                    className={`medical-card border-none shadow-md overflow-hidden relative ${!notification.read ? 'bg-white' : 'bg-white/60'}`}
                    onClick={() => handleMarkAsRead(notification.id)}
                  >
                    {!notification.read && (
                      <div className="absolute top-0 left-0 bottom-0 w-1.5 bg-medical-500" />
                    )}
                    <div className="p-5">
                      <div className="flex items-start gap-4">
                        <div className={`p-2.5 rounded-xl ${notification.read ? 'bg-medical-50/50 grayscale' : 'bg-medical-50'}`}>
                          {getIcon(notification.type)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between mb-1">
                            <h4 className={`text-sm font-black font-heading truncate ${notification.read ? 'text-medical-400' : 'text-medical-700'}`}>
                              {notification.title}
                            </h4>
                            <p className="text-[9px] font-bold text-medical-300 whitespace-nowrap">
                              {format(new Date(notification.createdAt), 'h:mm a')}
                            </p>
                          </div>
                          <p className={`text-xs leading-relaxed ${notification.read ? 'text-medical-300' : 'text-medical-500'}`}>
                            {notification.message}
                          </p>
                          
                          <div className="mt-4 flex items-center gap-3">
                            <Button 
                              size="sm" 
                              variant="outline" 
                              className="h-9 rounded-xl border-medical-100 text-medical-600 bg-white shadow-sm flex-1 font-bold text-[10px] uppercase tracking-tight gap-2"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleTransferToAi(notification);
                              }}
                            >
                              <MessageSquareShare className="w-3.5 h-3.5 text-medical-400" />
                              Transfer to Ray AI
                            </Button>
                            {notification.actionUrl && (
                              <Button
                                size="sm"
                                className="h-9 px-4 rounded-xl button-primary text-[10px] font-bold uppercase tracking-tight"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleViewVisit(notification);
                                }}
                              >
                                View Visit
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </Card>
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      </ScrollArea>
      <BottomNav />
    </div>
  );
}
