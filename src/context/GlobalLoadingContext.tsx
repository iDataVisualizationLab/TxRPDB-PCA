"use client";
import React, { createContext, useContext, useState, ReactNode } from "react";

interface GlobalLoadingContextProps {
  loading: boolean;
  setLoading: (value: boolean) => void;
}

const GlobalLoadingContext = createContext<GlobalLoadingContextProps | undefined>(undefined);

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(false);
  return (
    <GlobalLoadingContext.Provider value={{ loading, setLoading }}>
      {children}
    </GlobalLoadingContext.Provider>
  );
}

export function useGlobalLoading() {
  const context = useContext(GlobalLoadingContext);
  if (!context) throw new Error("useGlobalLoading must be used within GlobalLoadingProvider");
  return context;
}