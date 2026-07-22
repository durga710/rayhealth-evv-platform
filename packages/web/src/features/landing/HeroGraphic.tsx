import React from 'react';

export function HeroGraphic() {
  return (
    <svg width="700" height="220" viewBox="0 0 700 220" xmlns="http://www.w3.org/2000/svg" style={{ margin: '3rem 0', maxWidth: '100%' }}>
      <defs>
        <linearGradient id="banBg" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-primary-dark)"/>
          <stop offset="50%" stopColor="var(--color-primary)"/>
          <stop offset="100%" stopColor="var(--color-primary-dark)"/>
        </linearGradient>
        <radialGradient id="banHalo" cx="25%" cy="50%" r="50%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.25"/>
          <stop offset="100%" stopColor="var(--color-primary-dark)" stopOpacity="0"/>
        </radialGradient>
        <radialGradient id="banHalo2" cx="80%" cy="50%" r="40%">
          <stop offset="0%" stopColor="var(--color-primary)" stopOpacity="0.18"/>
          <stop offset="100%" stopColor="var(--color-primary-dark)" stopOpacity="0"/>
        </radialGradient>
        <filter id="banShadow">
          <feDropShadow dx="0" dy="10" stdDeviation="20" floodColor="var(--color-primary-dark)" floodOpacity="0.5"/>
        </filter>
        <filter id="banGl">
          <feGaussianBlur stdDeviation="4" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        <linearGradient id="banEvv" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="var(--color-accent)"/>
          <stop offset="100%" stopColor="var(--color-accent)"/>
        </linearGradient>
        <clipPath id="banClip">
          <rect width="700" height="220" rx="22"/>
        </clipPath>
      </defs>

      <rect width="700" height="220" rx="22" fill="url(#banBg)" filter="url(#banShadow)"/>
      <rect width="700" height="220" rx="22" clipPath="url(#banClip)" fill="url(#banHalo)"/>
      <rect width="700" height="220" rx="22" clipPath="url(#banClip)" fill="url(#banHalo2)"/>

      <pattern id="dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
        <circle cx="14" cy="14" r="1.2" fill="white" opacity="0.07"/>
      </pattern>
      <rect width="700" height="220" fill="url(#dots)"/>

      <circle cx="160" cy="110" r="130" fill="none" stroke="white" strokeWidth="1" opacity="0.06"/>
      <circle cx="160" cy="110" r="90" fill="none" stroke="white" strokeWidth="1" opacity="0.07"/>
      <circle cx="160" cy="110" r="50" fill="none" stroke="white" strokeWidth="1" opacity="0.09"/>

      <circle cx="160" cy="110" r="70" fill="white" opacity="0.1"/>
      <circle cx="160" cy="110" r="56" fill="white" opacity="0.12"/>

      <polyline points="96,110 108,110 116,86 124,134 132,96 140,124 148,110 172,110 180,82 190,138 198,110 218,110 240,110"
                fill="none" stroke="white" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round"
                opacity="0.9"/>
      <circle cx="198" cy="110" r="7" fill="var(--color-accent)" filter="url(#banGl)"/>
      <circle cx="198" cy="110" r="7" fill="var(--color-accent)" opacity="0.35">
        <animate attributeName="r" values="7;20;7" dur="2s" repeatCount="indefinite"/>
        <animate attributeName="opacity" values="0.35;0;0.35" dur="2s" repeatCount="indefinite"/>
      </circle>

      <text x="280" y="96" fontFamily="Nunito, sans-serif" fontWeight="900" fontSize="54"
            fill="white" letterSpacing="-2" opacity="0.97">RayHealth</text>

      <rect x="282" y="108" width="90" height="36" rx="18" fill="url(#banEvv)"/>
      <text x="327" y="132" fontFamily="Nunito, sans-serif" fontWeight="800" fontSize="16"
            fill="white" textAnchor="middle" letterSpacing="4">EVV</text>

      <text x="596" y="74" fontFamily="DM Sans, sans-serif" fontSize="14" fill="white"
            opacity="0.55" fontWeight="500">™</text>

      <text x="282" y="164" fontFamily="DM Sans, sans-serif" fontSize="14" fill="white"
            opacity="0.65" letterSpacing="1" fontWeight="300">Electronic Visit Verification</text>
      <text x="282" y="185" fontFamily="DM Sans, sans-serif" fontSize="12" fill="white"
            opacity="0.38" letterSpacing="2" fontWeight="300">CARE. VERIFIED. DELIVERED.</text>

      <rect x="595" y="55" width="12" height="60" rx="6" fill="white" opacity="0.05"/>
      <rect x="570" y="80" width="62" height="12" rx="6" fill="white" opacity="0.05"/>

      <rect x="0" y="210" width="700" height="10" rx="0" fill="var(--color-accent)" opacity="0.75"/>
    </svg>
  );
}
