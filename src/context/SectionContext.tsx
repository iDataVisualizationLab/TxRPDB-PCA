'use client';

import { createContext, useContext, useState, ReactNode } from "react";
import { fetchJsonData } from "@/lib/fetchJsonData";
import { route } from '@/config';

interface SectionContextType {
  isOpen: boolean;
  data: any[];
  isDetailsModalOpen: boolean;
  setDetailsModalOpen: (isDetailsModalOpen: boolean) => void;
  selectedRow: number | null;
  setSelectedRow: (selectedRow: number | null) => void;
  surveyData: Record<string, any>;
  setSurveyData: (data: Record<string, any>) => void;
  surveyImages: any[];
  setSurveyImages: (data: any[]) => void;
  planSet: any[];
  setPlanSet: (data: any[]) => void;
  reportData: any[];
  setReportData: (data: any[]) => void;
  setModalData: (data: any[]) => void;
  openModal: () => void;
  closeModal: () => void;
  x: number | null;
  y: number | null;
  updateMapCoordinates: (x: number, y: number) => void;
  getCoordinates: () => { x: number | null; y: number | null };
  selectedPointId: string | null;
  setSelectedPointId: (id: string | null) => void;
  filteredData: any[];
  setFilteredData: (data: any[]) => void;
  loadSectionData: (sectionId: string, pathname: string) => void;
}

const SectionContext = createContext<SectionContextType | undefined>(undefined);

export const SectionProvider = ({ children }: { children: ReactNode }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isDetailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedRow, setSelectedRow] = useState<number | null>(null);
  const [data, setData] = useState<any[]>([]);
  const [filteredData, setFilteredData] = useState<any[]>([]);
  const [reportData, setReportData] = useState<any[]>([]);
  const [surveyData, setSurveyData] = useState<Record<string, any>>({});
  const [planSet, setPlanSet] = useState<any[]>([]);
  const [surveyImages, setSurveyImages] = useState<any[]>([]);
  const [coordinates, setCoordinates] = useState<{ x: number | null; y: number | null }>({ x: null, y: null });
  const [selectedPointId, setSelectedPointId] = useState<string | null>(null);

  const setModalData = (data: any[]) => {
    setData(data);
  };

  const openModal = () => setIsOpen(true);
  const closeModal = () => setIsOpen(false);

  const updateMapCoordinates = (x: number, y: number) => {
    setCoordinates({ x, y });
    console.log("Updated map coordinates:", { x, y });
  };

  const getCoordinates = () => {
    return { x: coordinates.x, y: coordinates.y };
  };

  const loadSectionData = (sectionId: string, pathname: string) => {
    let basePath = "";
    console.log("Loading section data for sectionId:", sectionId, "from pathname:", pathname);
    if (pathname.includes("level_one")) {
      basePath = `${pathname}sections/${sectionId}`;
    }
    else {
      basePath = `${pathname}${sectionId}`;
    }

    const surveyDataPath = `${route}${basePath}/survey_data/${sectionId}.json`;
    // const surveyImagesPath = `${route}${basePath}/survey_data/pictures/picture_dates.json`;
    const planSetPath = `${route}${basePath}/section_data/plan_sets/csj_list.json`;

    fetchJsonData(surveyDataPath, planSetPath)
      .then(({ surveyData, planSet }) => {
        setSurveyData(surveyData);
        setPlanSet(planSet);
      })
      .catch(error => {
        console.error('Error fetching section data:', error);
      });
  };

  return (
    <SectionContext.Provider value={{
      isOpen,
      data,
      isDetailsModalOpen,
      setDetailsModalOpen,
      surveyData,
      setSurveyData,
      surveyImages,
      setSurveyImages,
      planSet,
      setPlanSet,
      reportData,
      setReportData,
      setModalData,
      openModal,
      closeModal,
      x: coordinates.x,
      y: coordinates.y,
      updateMapCoordinates,
      getCoordinates,
      selectedRow,
      setSelectedRow,
      selectedPointId,
      setSelectedPointId,
      filteredData,
      setFilteredData,
      loadSectionData
    }}>
      {children}
    </SectionContext.Provider>
  );
};

export const useSectionModal = () => {
  const context = useContext(SectionContext);
  if (!context) {
    throw new Error("useSectionModal must be used within a SectionProvider");
  }
  return context;
};
