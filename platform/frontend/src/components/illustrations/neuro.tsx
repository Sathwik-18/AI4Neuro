/**
 * Product illustrations, drawn from geometry rather than clip-art so they stay
 * crisp and on-palette: an axial brain slice traced from wavy polar curves,
 * EEG channels from summed sine waves, PET uptake as clipped radial fields.
 */
import { useId } from 'react';

const C = {
  ink: '#31241F',
  primary: '#806257',
  light: '#A68172',
  light2: '#C7A79B',
  accent: '#E1D2CC',
  tissue: '#F0E8E2',
  page: '#FAF6F3',
  muted: '#7D6E64',
  cn: '#10B981',
  mci: '#F59E0B',
  ad: '#EF4444',
};

type Pt = [number, number];

/** Smooth closed curve through points (Catmull-Rom -> cubic Bezier). */
function closedPath(pts: Pt[]): string {
  const n = pts.length;
  const f = (v: number) => v.toFixed(1);
  let d = `M${f(pts[0][0])},${f(pts[0][1])}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1: Pt = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2: Pt = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += `C${f(c1[0])},${f(c1[1])} ${f(c2[0])},${f(c2[1])} ${f(p2[0])},${f(p2[1])}`;
  }
  return d + 'Z';
}

/** Axial-slice outline: egg-shaped (narrower frontal pole), optional cortical wobble. */
function slice(cx: number, cy: number, rx: number, ry: number, wobble = 0, freq = 0, phase = 0, steps = 160): string {
  const pts: Pt[] = [];
  for (let i = 0; i < steps; i++) {
    const t = (i / steps) * Math.PI * 2;
    const w = 1 + (wobble * Math.sin(freq * t + phase)) / Math.max(rx, ry);
    const frontal = 1 - 0.08 * Math.max(0, -Math.sin(t)); // top (frontal pole) slightly narrower
    pts.push([cx + rx * Math.cos(t) * w * frontal, cy + ry * Math.sin(t) * w]);
  }
  return closedPath(pts);
}

function wave(x0: number, x1: number, y: number, amp: number, seed: number, step = 2): string {
  let d = '';
  for (let x = x0; x <= x1; x += step) {
    const t = (x - x0) / 18;
    const v =
      Math.sin(t * 1.0 + seed) * 0.55 +
      Math.sin(t * 2.3 + seed * 1.7) * 0.3 +
      Math.sin(t * 5.1 + seed * 0.6) * 0.15;
    d += `${x === x0 ? 'M' : 'L'}${x.toFixed(1)},${(y + v * amp).toFixed(1)}`;
  }
  return d;
}

/** Brain slice drawing shared by the hero and the MRI/PET cards. */
function BrainSlice({ cx, cy, rx, ry, idp, highlight = true }: {
  cx: number; cy: number; rx: number; ry: number; idp: string; highlight?: boolean;
}) {
  const outer = slice(cx, cy, rx, ry, rx * 0.025, 30, 0.3);
  return (
    <g>
      <defs>
        <radialGradient id={`${idp}-tissue`} cx="50%" cy="45%" r="60%">
          <stop offset="0%" stopColor="#FFFFFF" />
          <stop offset="70%" stopColor={C.tissue} />
          <stop offset="100%" stopColor={C.accent} />
        </radialGradient>
        <radialGradient id={`${idp}-hot`} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor={C.mci} stopOpacity="0.85" />
          <stop offset="100%" stopColor={C.mci} stopOpacity="0" />
        </radialGradient>
      </defs>
      {/* skull */}
      <path d={slice(cx, cy, rx * 1.1, ry * 1.08)} fill="none" stroke={C.light2} strokeWidth={rx * 0.05} opacity="0.55" />
      {/* parenchyma + cortex */}
      <path d={outer} fill={`url(#${idp}-tissue)`} stroke={C.light} strokeWidth="1.6" />
      {[0.88, 0.76, 0.63].map((s, i) => (
        <path
          key={s}
          d={slice(cx, cy, rx * s, ry * s, rx * (0.035 - i * 0.008), 26 - i * 5, i * 1.3)}
          fill="none"
          stroke={C.light}
          strokeWidth={1.3 - i * 0.25}
          opacity={0.7 - i * 0.18}
        />
      ))}
      {/* interhemispheric fissure */}
      <path
        d={`M${cx},${cy - ry * 0.98} C${cx - rx * 0.04},${cy - ry * 0.5} ${cx + rx * 0.04},${cy + ry * 0.4} ${cx},${cy + ry * 0.98}`}
        stroke={C.light}
        strokeWidth="1.4"
        fill="none"
        opacity="0.8"
      />
      {/* lateral ventricles */}
      {[-1, 1].map((side) => (
        <path
          key={side}
          d={`M${cx + side * rx * 0.06},${cy - ry * 0.28}
              C${cx + side * rx * 0.34},${cy - ry * 0.26} ${cx + side * rx * 0.3},${cy + ry * 0.06} ${cx + side * rx * 0.14},${cy + ry * 0.16}
              C${cx + side * rx * 0.2},${cy + ry * 0.02} ${cx + side * rx * 0.18},${cy - ry * 0.16} ${cx + side * rx * 0.06},${cy - ry * 0.14} Z`}
          fill="#FFFFFF"
          stroke={C.light2}
          strokeWidth="1.2"
        />
      ))}
      {highlight &&
        [-1, 1].map((side) => (
          <g key={side}>
            <ellipse cx={cx + side * rx * 0.42} cy={cy + ry * 0.36} rx={rx * 0.2} ry={ry * 0.12} fill={`url(#${idp}-hot)`} />
            <ellipse
              cx={cx + side * rx * 0.42}
              cy={cy + ry * 0.36}
              rx={rx * 0.11}
              ry={ry * 0.055}
              fill="none"
              stroke={C.mci}
              strokeWidth="1.3"
              strokeDasharray="3 2"
            />
          </g>
        ))}
    </g>
  );
}

function Corners({ x, y, w, h, len = 18 }: { x: number; y: number; w: number; h: number; len?: number }) {
  const p = (d: string) => <path d={d} stroke={C.primary} strokeWidth="2" fill="none" strokeLinecap="round" />;
  return (
    <g>
      {p(`M${x},${y + len} V${y} H${x + len}`)}
      {p(`M${x + w - len},${y} H${x + w} V${y + len}`)}
      {p(`M${x},${y + h - len} V${y + h} H${x + len}`)}
      {p(`M${x + w - len},${y + h} H${x + w} V${y + h - len}`)}
    </g>
  );
}

/** Landing hero: MRI slice in a scanner viewfinder, EEG strip, AI result card. */
export function HeroScanIllustration({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 640 560" className={className} role="img" aria-label="AI analysis of a brain MRI slice with EEG traces and a CN, MCI, AD probability card">
      <defs>
        <linearGradient id={`${id}-scan`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor={C.primary} stopOpacity="0" />
          <stop offset="100%" stopColor={C.primary} stopOpacity="0.35" />
        </linearGradient>
        <filter id={`${id}-shadow`} x="-20%" y="-20%" width="140%" height="160%">
          <feDropShadow dx="0" dy="12" stdDeviation="14" floodColor="#6E493B" floodOpacity="0.16" />
        </filter>
        <clipPath id={`${id}-view`}>
          <rect x="150" y="60" width="340" height="380" rx="20" />
        </clipPath>
      </defs>

      {/* scanner viewport */}
      <rect x="150" y="60" width="340" height="380" rx="20" fill="#FFFFFF" fillOpacity="0.55" stroke={C.accent} />
      <g opacity="0.5">
        {Array.from({ length: 9 }).map((_, i) => (
          <line key={`v${i}`} x1={150 + (i + 1) * 34} y1="60" x2={150 + (i + 1) * 34} y2="440" stroke={C.accent} strokeWidth="0.8" />
        ))}
        {Array.from({ length: 10 }).map((_, i) => (
          <line key={`h${i}`} x1="150" y1={60 + (i + 1) * 34.5} x2="490" y2={60 + (i + 1) * 34.5} stroke={C.accent} strokeWidth="0.8" />
        ))}
      </g>
      <BrainSlice cx={320} cy={252} rx={118} ry={150} idp={`${id}-b`} />
      <g clipPath={`url(#${id}-view)`}>
        <g className="ai4-scanline">
          <rect x="150" y="40" width="340" height="56" fill={`url(#${id}-scan)`} />
          <line x1="150" y1="96" x2="490" y2="96" stroke={C.primary} strokeWidth="1.5" />
        </g>
      </g>
      <Corners x={166} y={76} w={308} h={348} />
      <text x="170" y="460" fontFamily="var(--font-mono), monospace" fontSize="10" fill={C.muted} letterSpacing="0.5">
        T1W · AXIAL · SLICE 92/176
      </text>

      {/* callout to hippocampal region */}
      <path d="M392,306 L444,346 L486,346" stroke={C.mci} strokeWidth="1.2" fill="none" />
      <circle cx="392" cy="306" r="3" fill={C.mci} />
      <g filter={`url(#${id}-shadow)`}>
        <rect x="486" y="326" width="134" height="42" rx="10" fill="#FFFFFF" />
      </g>
      <text x="498" y="343" fontFamily="var(--font-dm-sans), sans-serif" fontSize="10.5" fontWeight="700" fill={C.ink}>
        Medial temporal
      </text>
      <text x="498" y="358" fontFamily="var(--font-dm-sans), sans-serif" fontSize="10" fill={C.muted}>
        Focus region · Grad-CAM
      </text>

      {/* EEG strip */}
      <g filter={`url(#${id}-shadow)`}>
        <rect x="14" y="96" width="176" height="128" rx="16" fill="#FFFFFF" />
      </g>
      <text x="30" y="120" fontFamily="var(--font-dm-sans), sans-serif" fontSize="11" fontWeight="700" fill={C.ink}>
        EEG · 19 ch
      </text>
      <text x="172" y="120" textAnchor="end" fontFamily="var(--font-mono), monospace" fontSize="9" fill={C.muted}>
        128 Hz
      </text>
      {['Fp1', 'C3', 'O1', 'T3'].map((ch, i) => (
        <g key={ch}>
          <text x="30" y={146 + i * 20} fontFamily="var(--font-mono), monospace" fontSize="8.5" fill={C.muted}>
            {ch}
          </text>
          <path d={wave(56, 176, 143 + i * 20, 5.5, i * 1.9 + 0.4)} stroke={i === 2 ? C.primary : C.light} strokeWidth="1.3" fill="none" />
        </g>
      ))}

      {/* AI result card */}
      <g filter={`url(#${id}-shadow)`}>
        <rect x="402" y="402" width="226" height="138" rx="18" fill="#FFFFFF" />
      </g>
      <text x="422" y="430" fontFamily="var(--font-dm-sans), sans-serif" fontSize="10" fontWeight="700" letterSpacing="1.2" fill={C.muted}>
        AI ASSESSMENT
      </text>
      <text x="608" y="430" textAnchor="end" fontFamily="var(--font-mono), monospace" fontSize="9" fill={C.muted}>
        multiclass
      </text>
      {[
        { k: 'CN', v: 0.14, c: C.cn },
        { k: 'MCI', v: 0.24, c: C.mci },
        { k: 'AD', v: 0.62, c: C.ad },
      ].map((r, i) => (
        <g key={r.k}>
          <text x="422" y={458 + i * 24} fontFamily="var(--font-dm-sans), sans-serif" fontSize="11" fontWeight="700" fill={C.ink}>
            {r.k}
          </text>
          <rect x="456" y={449 + i * 24} width="120" height="8" rx="4" fill={C.tissue} />
          <rect x="456" y={449 + i * 24} width={120 * r.v} height="8" rx="4" fill={r.c} />
          <text x="608" y={458 + i * 24} textAnchor="end" fontFamily="var(--font-mono), monospace" fontSize="10" fill={C.ink}>
            {Math.round(r.v * 100)}%
          </text>
        </g>
      ))}
    </svg>
  );
}

/** Service card: MRI slice with measurement guides. */
export function MriCardArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  return (
    <svg viewBox="0 0 320 200" className={className} role="img" aria-label="Structural brain MRI slice">
      <BrainSlice cx={160} cy={100} rx={62} ry={80} idp={`${id}-m`} />
      <g stroke={C.primary} strokeWidth="1" opacity="0.8">
        <line x1="70" y1="20" x2="70" y2="180" strokeDasharray="2 3" />
        <line x1="250" y1="20" x2="250" y2="180" strokeDasharray="2 3" />
        <path d="M66,20 H74 M66,180 H74 M246,20 H254 M246,180 H254" />
      </g>
      <text x="258" y="104" fontFamily="var(--font-mono), monospace" fontSize="9" fill={C.muted}>
        169 mm
      </text>
    </svg>
  );
}

/** Service card: multichannel EEG with a highlighted slowing segment. */
export function EegCardArt({ className }: { className?: string }) {
  const channels = ['Fp1', 'F3', 'C3', 'P3', 'O1', 'T3'];
  return (
    <svg viewBox="0 0 320 200" className={className} role="img" aria-label="Six-channel EEG traces with a highlighted slowing segment">
      <rect x="170" y="14" width="64" height="172" rx="8" fill={C.mci} opacity="0.1" />
      <text x="202" y="196" textAnchor="middle" fontFamily="var(--font-mono), monospace" fontSize="8" fill={C.mci}>
        θ slowing
      </text>
      {Array.from({ length: 7 }).map((_, i) => (
        <line key={i} x1={50 + i * 40} y1="14" x2={50 + i * 40} y2="186" stroke={C.accent} strokeWidth="0.8" />
      ))}
      {channels.map((ch, i) => (
        <g key={ch}>
          <text x="14" y={34 + i * 28} fontFamily="var(--font-mono), monospace" fontSize="9" fill={C.muted}>
            {ch}
          </text>
          <path d={wave(46, 304, 31 + i * 28, 8, i * 1.3 + 0.2, 1.5)} stroke={i % 2 ? C.light : C.primary} strokeWidth="1.3" fill="none" />
        </g>
      ))}
    </svg>
  );
}

/** Service card: PET metabolic map clipped to the brain outline. */
export function PetCardArt({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const outline = slice(160, 100, 62, 80, 1.6, 30, 0.3);
  return (
    <svg viewBox="0 0 320 200" className={className} role="img" aria-label="PET metabolic uptake map of a brain slice">
      <defs>
        <clipPath id={`${id}-clip`}>
          <path d={outline} />
        </clipPath>
        {[
          ['a', C.ad],
          ['b', C.mci],
          ['c', C.primary],
        ].map(([k, col]) => (
          <radialGradient key={k} id={`${id}-${k}`} cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={col} stopOpacity="0.8" />
            <stop offset="100%" stopColor={col} stopOpacity="0" />
          </radialGradient>
        ))}
      </defs>
      <path d={outline} fill={C.tissue} stroke={C.light} strokeWidth="1.4" />
      <g clipPath={`url(#${id}-clip)`}>
        <ellipse cx="160" cy="44" rx="58" ry="34" fill={`url(#${id}-c)`} />
        <ellipse cx="124" cy="104" rx="36" ry="30" fill={`url(#${id}-b)`} />
        <ellipse cx="198" cy="104" rx="36" ry="30" fill={`url(#${id}-b)`} />
        <ellipse cx="160" cy="150" rx="40" ry="26" fill={`url(#${id}-a)`} />
      </g>
      <path d={slice(160, 100, 52, 68, 2, 24, 1)} fill="none" stroke={C.light} strokeWidth="0.9" opacity="0.6" />
      <g transform="translate(262 40)">
        <defs>
          <linearGradient id={`${id}-scale`} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={C.ad} />
            <stop offset="50%" stopColor={C.mci} />
            <stop offset="100%" stopColor={C.tissue} />
          </linearGradient>
        </defs>
        <rect width="10" height="120" rx="5" fill={`url(#${id}-scale)`} />
        <text x="16" y="8" fontFamily="var(--font-mono), monospace" fontSize="8" fill={C.muted}>
          SUVR
        </text>
      </g>
    </svg>
  );
}

/** About section: a clinician report sheet reviewed by the care team. */
export function ClinicianReportIllustration({ className }: { className?: string }) {
  const id = useId().replace(/:/g, '');
  const team = [
    { i: 'RD', label: 'Radiologist', x: 92 },
    { i: 'DR', label: 'Neurologist', x: 250 },
    { i: 'PT', label: 'Patient', x: 408 },
  ];
  return (
    <svg viewBox="0 0 500 520" className={className} role="img" aria-label="A clinician report with a brain scan thumbnail, class probabilities, review priority and care-team sign-off">
      <defs>
        <filter id={`${id}-sh`} x="-20%" y="-20%" width="140%" height="150%">
          <feDropShadow dx="0" dy="16" stdDeviation="18" floodColor="#6E493B" floodOpacity="0.16" />
        </filter>
      </defs>

      {/* back sheet for depth */}
      <rect x="86" y="44" width="330" height="380" rx="20" fill="#FFFFFF" opacity="0.55" transform="rotate(-4 250 234)" />
      <g filter={`url(#${id}-sh)`}>
        <rect x="80" y="40" width="340" height="392" rx="20" fill="#FFFFFF" />
      </g>

      {/* header */}
      <rect x="80" y="40" width="340" height="58" rx="20" fill={C.page} />
      <rect x="80" y="78" width="340" height="20" fill={C.page} />
      <text x="104" y="66" fontFamily="var(--font-dm-sans), sans-serif" fontSize="10" fontWeight="700" letterSpacing="1.4" fill={C.muted}>
        CLINICIAN REPORT
      </text>
      <text x="104" y="86" fontFamily="var(--font-dm-sans), sans-serif" fontSize="14" fontWeight="700" fill={C.ink}>
        MRI · Multiclass assessment
      </text>
      <text x="396" y="66" textAnchor="end" fontFamily="var(--font-mono), monospace" fontSize="9" fill={C.muted}>
        MRI-8F3A21C0
      </text>

      {/* patient row */}
      {[
        ['Patient', 'P-0142 · 71 y'],
        ['Scan', 'T1W 3T · 12 Sep'],
      ].map(([k, v], i) => (
        <g key={k}>
          <text x={104 + i * 160} y="124" fontFamily="var(--font-dm-sans), sans-serif" fontSize="9.5" fill={C.muted}>
            {k}
          </text>
          <text x={104 + i * 160} y="140" fontFamily="var(--font-dm-sans), sans-serif" fontSize="11.5" fontWeight="600" fill={C.ink}>
            {v}
          </text>
        </g>
      ))}
      <line x1="104" y1="156" x2="396" y2="156" stroke={C.accent} />

      {/* thumbnail + probabilities */}
      <rect x="104" y="172" width="118" height="132" rx="12" fill={C.page} stroke={C.accent} />
      <BrainSlice cx={163} cy={238} rx={40} ry={52} idp={`${id}-t`} />
      {[
        { k: 'CN', v: 0.14, c: C.cn },
        { k: 'MCI', v: 0.24, c: C.mci },
        { k: 'AD', v: 0.62, c: C.ad },
      ].map((r, i) => (
        <g key={r.k}>
          <text x="240" y={194 + i * 30} fontFamily="var(--font-dm-sans), sans-serif" fontSize="10.5" fontWeight="700" fill={C.ink}>
            {r.k}
          </text>
          <text x="396" y={194 + i * 30} textAnchor="end" fontFamily="var(--font-mono), monospace" fontSize="10" fill={C.ink}>
            {Math.round(r.v * 100)}%
          </text>
          <rect x="240" y={200 + i * 30} width="156" height="7" rx="3.5" fill={C.tissue} />
          <rect x="240" y={200 + i * 30} width={156 * r.v} height="7" rx="3.5" fill={r.c} />
        </g>
      ))}
      <rect x="240" y="280" width="104" height="24" rx="12" fill="#FCE8E6" />
      <text x="292" y="296" textAnchor="middle" fontFamily="var(--font-dm-sans), sans-serif" fontSize="10.5" fontWeight="700" fill="#C5221F">
        Review: Urgent
      </text>

      {/* findings lines */}
      <text x="104" y="332" fontFamily="var(--font-dm-sans), sans-serif" fontSize="10" fontWeight="700" letterSpacing="1" fill={C.muted}>
        FINDINGS
      </text>
      {[284, 250, 270].map((w, i) => (
        <rect key={i} x="104" y={342 + i * 14} width={w} height="6" rx="3" fill={C.tissue} />
      ))}

      {/* sign-off */}
      <path d="M104,410 C118,398 128,420 142,406 S166,398 176,410" stroke={C.primary} strokeWidth="1.6" fill="none" strokeLinecap="round" />
      <line x1="104" y1="416" x2="230" y2="416" stroke={C.accent} />
      <text x="104" y="428" fontFamily="var(--font-dm-sans), sans-serif" fontSize="9" fill={C.muted}>
        Reviewed &amp; signed
      </text>

      {/* care team */}
      <path d="M92,478 H408" stroke={C.light2} strokeWidth="1.2" strokeDasharray="4 4" />
      {team.map((t) => (
        <g key={t.i}>
          <circle cx={t.x} cy="478" r="22" fill={t.i === 'DR' ? C.primary : '#FFFFFF'} stroke={C.light2} strokeWidth="1.2" />
          <text x={t.x} y="482" textAnchor="middle" fontFamily="var(--font-dm-sans), sans-serif" fontSize="11" fontWeight="700" fill={t.i === 'DR' ? '#FFFFFF' : C.ink}>
            {t.i}
          </text>
          <text x={t.x} y="514" textAnchor="middle" fontFamily="var(--font-dm-sans), sans-serif" fontSize="10" fill={C.muted}>
            {t.label}
          </text>
        </g>
      ))}
    </svg>
  );
}
