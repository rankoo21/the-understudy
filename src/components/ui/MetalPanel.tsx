"use client";

import { ReactNode } from "react";

// A machined metal panel with hard seams. The structural building block of
// every zone. Never a soft card.
export function MetalPanel({
  children,
  className = "",
  inset = false,
}: {
  children: ReactNode;
  className?: string;
  inset?: boolean;
}) {
  return (
    <div
      className={`relative brushed panel-grain ${inset ? "machined-inset" : "machined"} ${className}`}
    >
      {children}
    </div>
  );
}
