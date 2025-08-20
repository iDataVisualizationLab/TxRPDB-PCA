'use client';
// app/context/SideNavSheetContext.tsx
import React, { createContext, useContext, useState } from 'react';

interface Row {
  index: number;
  sectionId: string;
  highway: string;
  x: number; // X coordinate
  y: number; // Y coordinate
}

interface SideNavSheetContextProps {
  rows: Row[];
  selectedIndex: number | null;
  setSelectedIndex: (index: number) => void;
  isOpen: boolean;
  openSheet: () => void;
  closeSheet: () => void;
}

const SideNavSheetContext = createContext<SideNavSheetContextProps | undefined>(undefined);

export const SideNavSheetProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [rows, setRows] = useState<Row[]>([]);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [isOpen, setIsOpen] = useState(false);

  const openSheet = () => setIsOpen(true);
  const closeSheet = () => setIsOpen(false);

  return (
    <SideNavSheetContext.Provider value={{ rows, selectedIndex, setSelectedIndex, isOpen, openSheet, closeSheet }}>
      {children}
    </SideNavSheetContext.Provider>
  );
};

export const useSideNavSheetContext = () => {
  const context = useContext(SideNavSheetContext);
  if (!context) {
    throw new Error('useSideNavSheetContext must be used within a SideNavSheetProvider');
  }
  return context;
};
