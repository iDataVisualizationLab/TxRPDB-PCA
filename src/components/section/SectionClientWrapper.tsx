// components/section/SectionClientWrapper.tsx
'use client';

import dynamic from 'next/dynamic';

import { useEffect, useState } from 'react';


// Dynamically import SectionMap with SSR disabled
const SectionMap = dynamic(() => import('@/components/section/SectionMap'), {
  ssr: false,
  loading: () => (
    <div className="h-screen w-full flex items-center justify-center">
      
    </div>
  ),
});

interface SectionClientWrapperProps {
  title: string;
  geojsonPath: string;
  jsonReportPath: string;
  popupTemplate?: any;
  modalTitle: string;
  legendColor?: string;
  legendoshape?: string;
  renderer?: any;
}

export default function SectionClientWrapper({
  title,
  geojsonPath,
  jsonReportPath,
  popupTemplate,
  modalTitle,
  legendColor,
  legendoshape,
  renderer
}: SectionClientWrapperProps) {
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  if (!isMounted) {
    return (
      <div className="h-screen w-full flex items-center justify-center">
        
      </div>
    );
  }

  return (
    
    <SectionMap
      title={title}
      geojsonPath={geojsonPath}
      jsonReportPath={jsonReportPath}
      popupTemplate={popupTemplate}
      modalTitle={modalTitle}
      legendColor={legendColor}
      legendoshape={legendoshape}
      renderer={renderer}
    />
    
  );
}
