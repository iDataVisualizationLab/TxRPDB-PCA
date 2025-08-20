"use client";
import { ReactNode } from "react";


export default function PageWrapper({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col pt-0 px-0 space-y-2 bg-zinc-100 flex-grow pb-4 min-h-0">
     
    {/* <div className="flex flex-col pt-0 px-0 space-y-2 bg-zinc-100 flex-1 overflow-auto pb-4"> */}
        {children}
    
    </div>
  );
}
