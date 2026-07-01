"use client";

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { Principle } from "@/lib/genlayer/types";

// The faceted logic core. A machined polygonal crystal that gains one facet per
// accepted principle. Locked principles glow faintly cyan. Drawn as crisp 2D
// SVG so it renders identically in a static export and respects reduced motion.
//
// Geometry: facets are wedges of a regular polygon whose side-count equals the
// number of principles (clamped to a sensible range). The whole core rotates
// slowly; a verifying sweep can be layered by the Decision Bay.

const CENTER = 130;
const OUTER = 104;
const INNER = 42;

function polygonPoints(sides: number, radius: number, rotation = 0): string {
  const pts: string[] = [];
  const n = Math.max(3, sides);
  for (let i = 0; i < n; i++) {
    const a = rotation + (i / n) * Math.PI * 2 - Math.PI / 2;
    pts.push(`${CENTER + Math.cos(a) * radius},${CENTER + Math.sin(a) * radius}`);
  }
  return pts.join(" ");
}

export function LogicCore({
  principles,
  coherence,
  scanning = false,
}: {
  principles: Principle[];
  coherence: number;
  scanning?: boolean;
}) {
  const reduce = useReducedMotion();
  const facetCount = Math.max(3, Math.min(principles.length || 1, 16));

  const facets = useMemo(() => {
    const n = facetCount;
    const wedges: { path: string; locked: boolean; idx: number }[] = [];
    for (let i = 0; i < n; i++) {
      const a0 = (i / n) * Math.PI * 2 - Math.PI / 2;
      const a1 = ((i + 1) / n) * Math.PI * 2 - Math.PI / 2;
      const ox0 = CENTER + Math.cos(a0) * OUTER;
      const oy0 = CENTER + Math.sin(a0) * OUTER;
      const ox1 = CENTER + Math.cos(a1) * OUTER;
      const oy1 = CENTER + Math.sin(a1) * OUTER;
      const ix0 = CENTER + Math.cos(a0) * INNER;
      const iy0 = CENTER + Math.sin(a0) * INNER;
      const ix1 = CENTER + Math.cos(a1) * INNER;
      const iy1 = CENTER + Math.sin(a1) * INNER;
      const locked = Boolean(principles[i]?.locked);
      wedges.push({
        path: `M ${ix0} ${iy0} L ${ox0} ${oy0} L ${ox1} ${oy1} L ${ix1} ${iy1} Z`,
        locked,
        idx: i,
      });
    }
    return wedges;
  }, [facetCount, principles]);

  // Coherence tints the inner core: high coherence is a steadier cyan.
  const innerOpacity = 0.25 + (Math.max(0, Math.min(100, coherence)) / 100) * 0.45;

  return (
    <div className="relative mx-auto aspect-square w-full max-w-[260px]" aria-hidden="true">
      <motion.div
        className="h-full w-full"
        animate={reduce ? {} : { rotate: 360 }}
        transition={reduce ? {} : { duration: 90, ease: "linear", repeat: Infinity }}
      >
        <svg viewBox="0 0 260 260" className="h-full w-full">
          <defs>
            <radialGradient id="coreInner" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#38E1D6" stopOpacity={innerOpacity} />
              <stop offset="70%" stopColor="#2E343A" stopOpacity="0.9" />
              <stop offset="100%" stopColor="#1C2024" stopOpacity="1" />
            </radialGradient>
            <linearGradient id="facetMetal" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#2E343A" />
              <stop offset="100%" stopColor="#14171A" />
            </linearGradient>
          </defs>

          {/* outer machined ring */}
          <polygon
            points={polygonPoints(facetCount, OUTER + 12)}
            fill="none"
            stroke="#5A7184"
            strokeOpacity="0.35"
            strokeWidth="1"
          />

          {/* facets */}
          {facets.map((f) => (
            <motion.path
              key={f.idx}
              d={f.path}
              fill="url(#facetMetal)"
              stroke={f.locked ? "#38E1D6" : "#8A929A"}
              strokeOpacity={f.locked ? 0.8 : 0.3}
              strokeWidth={f.locked ? 1.4 : 0.8}
              initial={reduce ? false : { opacity: 0, scale: 0.6 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
              style={{ transformOrigin: `${CENTER}px ${CENTER}px` }}
            />
          ))}

          {/* locked facet glow accents */}
          {facets
            .filter((f) => f.locked)
            .map((f) => (
              <path key={`g-${f.idx}`} d={f.path} fill="#38E1D6" fillOpacity="0.06" />
            ))}

          {/* inner core */}
          <polygon points={polygonPoints(facetCount, INNER)} fill="url(#coreInner)" stroke="#38E1D6" strokeOpacity="0.4" strokeWidth="1" />

          {/* center machined pin */}
          <circle cx={CENTER} cy={CENTER} r="6" fill="#0A0B0D" stroke="#5A7184" strokeOpacity="0.6" />

          {/* verifying scan sweep */}
          {scanning ? (
            <motion.rect
              x="26"
              width="208"
              height="3"
              fill="#38E1D6"
              fillOpacity="0.7"
              initial={{ y: 26 }}
              animate={{ y: 234 }}
              transition={{ duration: 1.2, ease: "linear", repeat: Infinity }}
            />
          ) : null}
        </svg>
      </motion.div>
    </div>
  );
}
