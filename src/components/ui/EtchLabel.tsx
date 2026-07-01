"use client";

import { ReactNode } from "react";

// A fine engraved label. Mono, tracked-out, uppercase. Used for instrument
// marks throughout the console.
export function EtchLabel({
  children,
  className = "",
  as: Tag = "span",
}: {
  children: ReactNode;
  className?: string;
  as?: "span" | "div" | "p" | "h2" | "h3";
}) {
  return <Tag className={`etch etch-deep text-[10px] ${className}`}>{children}</Tag>;
}
