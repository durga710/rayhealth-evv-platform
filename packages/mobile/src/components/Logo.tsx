import React from 'react';
import { motion } from 'motion/react';

interface LogoProps {
  className?: string;
  variant?: 'horizontal' | 'icon' | 'badge';
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export default function Logo({ className = '', variant = 'horizontal', size = 'md' }: LogoProps) {
  const sizeMap = {
    sm: variant === 'horizontal' ? 'w-32 h-auto' : 'w-8 h-8',
    md: variant === 'horizontal' ? 'w-48 h-auto' : 'w-12 h-12',
    lg: variant === 'horizontal' ? 'w-64 h-auto' : 'w-24 h-24',
    xl: variant === 'horizontal' ? 'w-80 h-auto' : 'w-32 h-32',
  };

  if (variant === 'icon') {
    return (
      <motion.svg 
        className={`${sizeMap[size]} ${className} animate-float`} 
        viewBox="0 0 180 180" 
        xmlns="http://www.w3.org/2000/svg"
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
      >
        <defs>
          <radialGradient id="appBg" cx="50%" cy="30%" r="75%">
            <stop offset="0%" stopColor="#3b8de0"/>
            <stop offset="100%" stopColor="#1248a0"/>
          </radialGradient>
          <radialGradient id="appGlow" cx="50%" cy="50%">
            <stop offset="0%" stopColor="#5ba8f5" stopOpacity="0.4"/>
            <stop offset="100%" stopColor="#1248a0" stopOpacity="0"/>
          </radialGradient>
        </defs>
        <rect width="180" height="180" rx="42" fill="url(#appBg)"/>
        <ellipse cx="90" cy="40" rx="66" ry="32" fill="white" opacity="0.14"/>
        <circle cx="90" cy="90" r="80" fill="url(#appGlow)"/>
        <polyline 
          points="18,90 34,90 42,60 52,120 62,74 72,106 82,90 98,90 106,62 116,118 126,90 144,90 162,90"
          fill="none" 
          stroke="white" 
          strokeWidth="4" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          opacity="0.92"
        />
        <circle cx="126" cy="90" r="7" fill="#f97316" className="ecg-pulse" />
      </motion.svg>
    );
  }

  return (
    <div className={`${sizeMap[size]} ${className} flex items-center gap-3`}>
      <svg className="h-full" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <radialGradient id="iconBg" cx="50%" cy="35%" r="70%">
            <stop offset="0%" stopColor="#4a9de8"/>
            <stop offset="100%" stopColor="#1a5fa8"/>
          </radialGradient>
        </defs>
        <circle cx="70" cy="70" r="56" fill="#e8f1fb" opacity="0.9"/>
        <circle cx="70" cy="70" r="44" fill="url(#iconBg)"/>
        <polyline 
          points="36,70 44,70 48,54 52,86 58,60 62,80 66,70 74,70 78,58 82,82 86,70 94,70 104,70"
          fill="none" 
          stroke="white" 
          strokeWidth="3.2" 
          strokeLinecap="round" 
          strokeLinejoin="round"
          opacity="0.95"
        />
        <circle cx="86" cy="70" r="4.5" fill="#f97316" />
      </svg>
      <div className="flex flex-col">
        <span className="font-heading font-black text-medical-700 leading-tight tracking-tighter" style={{ fontSize: '120%' }}>
          RayHealth
        </span>
        <div className="flex items-center gap-1.5">
          <div className="px-2 py-0.5 bg-medical-500 rounded-full">
            <span className="text-[10px] font-black text-white tracking-[0.2em]">EVV</span>
          </div>
          <span className="text-[8px] font-bold text-medical-300 uppercase tracking-widest whitespace-nowrap">™ Care Verified</span>
        </div>
      </div>
    </div>
  );
}
