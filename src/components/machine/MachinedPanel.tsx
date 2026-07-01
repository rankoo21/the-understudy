"use client";

import { ReactNode } from "react";
import { MetalPanel } from "@/components/ui/MetalPanel";
import { EtchLabel } from "@/components/ui/EtchLabel";

// A titled machined panel with an engraved header plate and a small status LED.
export function MachinedPanel({
  title,
  code,
  led,
  children,
  className = "",
}: {
  title: string;
  code?: string;
  led?: "cyan" | "amber" | "off";
  children: ReactNode;
  className?: string;
}) {
  const ledClass = led === "cyan" ? "led-cyan" : led === "amber" ? "led-amber" : "bg-instrument-label/30";
  return (
    <MetalPanel className={className}>
      <div className="flex items-center justify-between border-b border-instrument-label/20 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className={`inline-block h-1.5 w-1.5 rounded-full ${ledClass}`} />
          <EtchLabel className="text-instrument-white">{title}</EtchLabel>
        </div>
        {code ? <EtchLabel className="text-instrument-steel">{code}</EtchLabel> : null}
      </div>
      <div className="p-4">{children}</div>
    </MetalPanel>
  );
}
