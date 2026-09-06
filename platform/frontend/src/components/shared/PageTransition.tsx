'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';

export function PageTransitionLoader() {
  const pathname = usePathname();
  const [loading, setLoading] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    setLoading(true);
    setVisible(true);
    const timer = setTimeout(() => {
      setLoading(false);
      setTimeout(() => setVisible(false), 300);
    }, 400);
    return () => clearTimeout(timer);
  }, [pathname]);

  if (!visible) return null;

  return (
    <div
      className="fixed top-0 left-0 right-0 z-[100] h-1 overflow-hidden"
      style={{ opacity: loading ? 1 : 0, transition: 'opacity 0.3s ease' }}
    >
      {/* EEG brain wave trace bar */}
      <svg
        width="100%"
        height="4"
        viewBox="0 0 1200 4"
        preserveAspectRatio="none"
        className="block"
      >
        <defs>
          <linearGradient id="wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#2563eb" stopOpacity="0" />
            <stop offset="30%" stopColor="#2563eb" stopOpacity="1" />
            <stop offset="70%" stopColor="#3b82f6" stopOpacity="1" />
            <stop offset="100%" stopColor="#2563eb" stopOpacity="0" />
          </linearGradient>
        </defs>
        <rect width="1200" height="4" fill="url(#wave-grad)">
          <animate
            attributeName="x"
            from="-1200"
            to="1200"
            dur="1.2s"
            repeatCount="indefinite"
          />
        </rect>
      </svg>
      {/* Subtle EEG spike overlay */}
      <svg
        width="100%"
        height="4"
        viewBox="0 0 200 4"
        preserveAspectRatio="none"
        className="block absolute top-0 left-0"
        style={{ opacity: 0.5 }}
      >
        <path
          d="M0 2 L10 2 L12 0 L14 4 L16 1 L18 3 L20 2 L40 2 L42 0 L44 4 L46 1 L48 3 L50 2 L70 2 L72 0 L74 4 L76 1 L78 3 L80 2 L100 2 L102 0 L104 4 L106 1 L108 3 L110 2 L130 2 L132 0 L134 4 L136 1 L138 3 L140 2 L160 2 L162 0 L164 4 L166 1 L168 3 L170 2 L200 2"
          fill="none"
          stroke="#2563eb"
          strokeWidth="1"
        >
          <animate
            attributeName="stroke-dashoffset"
            from="400"
            to="0"
            dur="1.5s"
            repeatCount="indefinite"
          />
        </path>
      </svg>
    </div>
  );
}
