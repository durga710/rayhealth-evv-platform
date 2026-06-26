/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { NavLink } from 'react-router-dom';
import { Home, Calendar, Sparkles, User, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'motion/react';

export default function BottomNav() {
  const navItems = [
    { icon: Home, label: 'Today', path: '/' },
    { icon: Calendar, label: 'Schedule', path: '/schedule' },
    { icon: Sparkles, label: 'Assistant', path: '/ai', isSpecial: true },
    { icon: BookOpen, label: 'Learning', path: '/learning' },
    { icon: User, label: 'Profile', path: '/profile' },
  ];

  return (
    <nav className="fixed bottom-6 left-6 right-6 max-w-[calc(100%-3rem)] mx-auto bg-white/95 backdrop-blur-md h-20 px-4 rounded-[2rem] z-50 shadow-[0_12px_40px_-12px_rgba(18,72,160,0.2)] flex items-center border border-medical-100">
      <div className="flex justify-between items-center w-full">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={({ isActive }) => cn(
              "flex flex-col items-center gap-1.5 transition-all duration-300 relative py-1 px-2.5",
              isActive 
                ? "text-medical-600" 
                : "text-medical-300",
              item.isSpecial && "mx-1"
            )}
          >
            {({ isActive }) => (
              <>
                <div className={cn(
                  "p-2.5 rounded-2xl transition-all duration-300 relative",
                  isActive ? "bg-medical-100/50" : "bg-transparent",
                  item.isSpecial && !isActive && "text-pulse-orange",
                  item.isSpecial && isActive && "bg-pulse-orange text-white shadow-lg shadow-pulse-orange/30"
                )}>
                  {item.isSpecial && !isActive && (
                    <motion.div
                      animate={{ opacity: [0.1, 0.3, 0.1], scale: [1, 1.1, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="absolute inset-0 bg-pulse-orange rounded-2xl blur-md -z-10"
                    />
                  )}
                  <item.icon className={cn("w-5 h-5", isActive && "stroke-[2.5px]")} />
                </div>
                <span className={cn(
                  "text-[8px] font-black uppercase tracking-widest transition-all font-heading",
                  isActive || item.isSpecial ? "opacity-100" : "opacity-0",
                  item.isSpecial && !isActive ? "text-pulse-orange" : ""
                )}>{item.label}</span>
              </>
            )}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
