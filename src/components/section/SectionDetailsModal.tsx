'use client';
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Rnd } from 'react-rnd';
import { FaTimes, FaChevronDown, FaChevronRight, FaDownload, FaFileAlt, FaChartLine, FaImage, FaSave, FaEdit } from 'react-icons/fa';
import { useSectionModal } from '@/context/SectionContext';
import LineChart from '@/components/chart/LineChart';
import BarChart from '@/components/chart/BarChart';
import TabbedChart from '@/components/chart/TabbedChart';
import ImageGallery from '@/components/img/ImageGallery';
import { route, routeDownload } from '@/config';
import SectionEditModal from './SectionEditModal';
import ChartEditModal from './ChartEditModal';
import ImageEditModal from './ImageEditModal';
import PlanSetEditModal from './PlanSetEditModal';
import { fetchProxy, saveToBackend, uploadProxy } from "@/lib/api";
import { usePathname } from 'next/navigation';
import { convertDate, labelKey } from '@/lib/date';
import ReportDisplay from './ReportDisplay';
import { createPortal } from "react-dom";
const toNumOrNull = (v: unknown): number | null => {
  if (v === "" || v === null || v === undefined) return null;
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
};
interface LTEData {
    Year: number;
    S?: number;
    M?: number;
    L?: number;
    Winter?: number;
    Summer?: number;
}

interface SectionDetailsModalProps {
    geojsonPath: string;
}
interface SurveyImageItem {
    Date: string;
    Path: string;
}
const SectionDetailsModal: React.FC<SectionDetailsModalProps> = ({ geojsonPath }) => {
    const {
        isDetailsModalOpen,
        data,
        selectedRow,
        selectedPointId,
        // planSet,
        // surveyData,
        reportData,
        // loadSectionData,
        setDetailsModalOpen,
        updateMapCoordinates,
        setModalData
    } = useSectionModal();
    const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
    const [saveError, setSaveError] = useState<string | null>(null);

    const row = selectedRow !== null ? data?.[selectedRow] : null;
    const [isAdmin, setIsAdmin] = useState(false);

    const isResizing = useRef(false);
    const [width, setWidth] = useState(700);
    const [height, setHeight] = useState(600);
    const [x, setX] = useState(0);
    const [y, setY] = useState(70);
    const [expanded, setExpanded] = useState({ section: true, surveys: false, reports: false });
    const [planSet, setPlanSet] = useState<any[]>([]);
    const [selectedPlan, setSelectedPlan] = useState(planSet.length === 1 ? planSet[0] : null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [chartEditModalOpen, setChartEditModalOpen] = useState(false);
    const [editingChartType, setEditingChartType] = useState<'deflection' | 'lte_season' | 'lte_crack'>('deflection');
    const [surveyImages, setSurveyImages] = useState<SurveyImageItem[]>([]);
    const [imageEditModalOpen, setImageEditModalOpen] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [surveyData, setSurveyData] = useState<Record<string, any>>({});
    const [planSetEditOpen, setPlanSetEditOpen] = useState(false);
    const pathname = usePathname();
    const groupedImages = useMemo(() => {
        return surveyImages.reduce<Record<string, string[]>>((acc, img) => {
            const date = img.Date;
            acc[date] = acc[date] || [];
            acc[date].push(img.Path);
            return acc;
        }, {});
    }, [surveyImages]);
        
    const containerRef = useRef<HTMLDivElement>(null);
    
        // Use actual DOM size to center
        const centerModal = useCallback(() => {
          if (!isDetailsModalOpen) return;
      
          const w = containerRef.current?.offsetWidth ?? width ?? 680;
          const h = containerRef.current?.offsetHeight ?? height ?? 520;
      
          const cx = Math.max(Math.round((window.innerWidth - w) / 2), 16);
          const cy = Math.max(Math.round((window.innerHeight - h) / 2), 16);
      
          setX(cx);
          setY(cy);
        }, [isDetailsModalOpen, width, height]);
      
        // Center after render (size is known) and when selection changes
        useLayoutEffect(() => {
          if (!isDetailsModalOpen) return;
          requestAnimationFrame(centerModal);
        }, [isDetailsModalOpen, selectedRow, centerModal]);
      
        // Re-center on viewport resize
        useEffect(() => {
          if (!isDetailsModalOpen) return;
          const onResize = () => centerModal();
          window.addEventListener("resize", onResize);
          return () => window.removeEventListener("resize", onResize);
        }, [isDetailsModalOpen, centerModal]);
    const handleEditImages = () => {
        setImageEditModalOpen(true);
    };
    const handleSaveImages = async (updatedImages: { date: string; images: { path: string; file?: File }[] }[], onDone?: () => void) => {
        try {
            setError(null);
            const pathBase = pathname.includes("level_one")
                ? `${pathname}sections/${selectedPointId}`
                : `${pathname}${selectedPointId}`;

            const jsonPath = `${pathBase}/survey_data/pictures/picture_dates.json`;

            const jsonEntries: { Date: string; Path: string }[] = [];
            const uploads: { path: string; file: File }[] = [];

            for (const group of updatedImages) {
                for (const image of group.images) {
                    jsonEntries.push({ Date: group.date, Path: image.path });
                    if (image.file) {
                        uploads.push({ path: image.path, file: image.file });
                    }
                }
            }

            await saveToBackend(jsonPath, jsonEntries);

            for (const { path, file } of uploads) {
                const formData = new FormData();
                formData.append("file", file);
                formData.append("path", path);

                await uploadProxy(path, file);
            }

            setSurveyImages(jsonEntries);
            setError(null);
            onDone?.();
        } catch (err) {
            console.error("Save failed:", err);
            setError("Failed to save images");
        }
    };

    useEffect(() => {
        const fetchImages = async () => {
            setSurveyImages([]);
            try {
                let path = `${pathname}${selectedPointId}`;
                if (pathname.includes("level_one")) {
                    path = `${pathname}sections/${selectedPointId}`;
                }
                const jsonPath = `${path}/survey_data/pictures/picture_dates.json`;
                const data = await fetchProxy<SurveyImageItem[]>(jsonPath);
                setSurveyImages(data);
            } catch (err) {
                console.error("Error loading survey images", err);
            }
        };
        const fetchSurveyData = async () => {
            setSurveyData({});
            try {
                let path = `${pathname}${selectedPointId}`;
                if (pathname.includes("level_one")) {
                    path = `${pathname}sections/${selectedPointId}`;
                }
                const jsonPath = `${path}/survey_data/${selectedPointId}.json`;
                const data = await fetchProxy(jsonPath);
                setSurveyData(data);
            } catch (err) {
                console.error("Error loading survey data", err);
            }
        };
        const fetchPlanSet = async () => {
            setPlanSet([]);
            try {
                let path = `${pathname}${selectedPointId}`;
                if (pathname.includes("level_one")) {
                    path = `${pathname}sections/${selectedPointId}`;
                }
                const jsonPath = `${path}/section_data/plan_sets/csj_list.json`;
                const data = await fetchProxy(jsonPath);
                setPlanSet(data);
            } catch (err) {
                console.error("Error loading plan set data", err);
            }
        };

        if (selectedPointId) { fetchImages(); fetchSurveyData(); fetchPlanSet(); }
    }, [selectedPointId, pathname]);

    useEffect(() => {
        if (saveSuccess) {
            const t = setTimeout(() => setSaveSuccess(null), 10000);
            return () => clearTimeout(t);
        }
    }, [saveSuccess]);
    useEffect(() => {
        const role = localStorage.getItem("role");
        setIsAdmin(role === "admin");
    }, []);
    // Center on first open
    // useEffect(() => {
    //     if (isDetailsModalOpen) {
    //         const cx = Math.max(window.innerWidth / 4 - width / 2, 20);
    //         setX(cx);
    //     }
    // }, [isDetailsModalOpen, width]);
    const handleDownload = () => {
        if (selectedPlan) {
            const link = document.createElement("a");
            link.href = `${routeDownload}/${selectedPlan.Path}`;
            link.download = `${selectedPlan.CSJ}.zip`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        }
    };

    if (!isDetailsModalOpen || selectedRow == null || !row) {
        return null;
    }

    const handleEditSection = () => {
        setIsEditModalOpen(true);
    };

    // --- helper to parse "lat, lon" or "lat lon" ---
    const parseGPS = (val: unknown): { lat: number; lon: number } | null => {
        if (val == null) return null;
        if (typeof val === 'string') {
            const parts = val.split(/[,\s]+/).map(s => s.trim()).filter(Boolean);
            if (parts.length >= 2) {
                const lat = Number(parts[0]);
                const lon = Number(parts[1]);
                if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
            }
        } else if (Array.isArray(val) && val.length >= 2) {
            const lat = Number(val[0]);
            const lon = Number(val[1]);
            if (Number.isFinite(lat) && Number.isFinite(lon)) return { lat, lon };
        }
        return null;
    };
    const handleSaveSection = async (updatedRow: any) => {
        try {
            if (selectedRow === null || !data) return;
            const originalRow = { ...data[selectedRow] };
            const updatedData = [...data];
            const mergedRow = { ...originalRow, ...updatedRow };
            const startChanged = Object.prototype.hasOwnProperty.call(updatedRow, 'GPS (Start)');
            const endChanged = Object.prototype.hasOwnProperty.call(updatedRow, 'GPS (End)');

            const gpsStart = parseGPS(mergedRow['GPS (Start)']);
            const gpsEnd = parseGPS(mergedRow['GPS (End)']);

            if (startChanged && gpsStart) {
                // x = lon, y = lat
                mergedRow.x = String(gpsStart.lon);
                mergedRow.y = String(gpsStart.lat);
            } else if (endChanged && gpsEnd) {
                mergedRow.x = String(gpsEnd.lon);
                mergedRow.y = String(gpsEnd.lat);
            } else if ((!mergedRow.x || !mergedRow.y) && (gpsStart || gpsEnd)) {
                const pick = gpsStart ?? gpsEnd!;
                mergedRow.x = String(pick.lon);
                mergedRow.y = String(pick.lat);
            }
            updatedData[selectedRow] = mergedRow;
            // Build change summary
            const changes: string[] = [];
            Object.keys(updatedRow).forEach((key) => {
                const oldVal = originalRow[key];
                const newVal = updatedRow[key];
                if (oldVal !== newVal) {
                    const display = (val: any) =>
                        val === null || val === undefined ? "N/A" : String(val);

                    changes.push(`**${key}**: \`${display(oldVal)}\` → \`${display(newVal)}\``);
                }
            });
            updateMapCoordinates(parseFloat(mergedRow.x), parseFloat(mergedRow.y));
            // Build GeoJSON
            const features = updatedData.map((row, idx) => ({
                type: "Feature",
                geometry: {
                    type: "Point",
                    coordinates: [parseFloat(row.x), parseFloat(row.y)],
                },
                properties: {
                    ...row,
                    index: idx + 1,
                },
            }));

            const geojson = {
                type: "FeatureCollection",
                name: "sections_data",
                crs: {
                    type: "name",
                    properties: {
                        name: "urn:ogc:def:crs:OGC:1.3:CRS84",
                    },
                },
                features,
            };

            await saveToBackend(geojsonPath, geojson);

            setIsEditModalOpen(false);
            setModalData(updatedData);

            const summary = `Section saved successfully.\n\n` + changes.join("\n");
            setSaveSuccess(summary);

        } catch (err) {
            console.error("Save failed:", err);
            setSaveError("Failed to save section.");
        }
    };

    const handleResizeStart = () => {
        // Set the resizing flag to true to prevent auto-centering
        isResizing.current = true;
        console.log('[Debug] Resize started - Disabling auto-centering');
    };

    const handleResize = (e: any, direction: string, ref: HTMLElement, delta: any, position: any) => {
        // Get new dimensions
        const newWidth = parseInt(ref.style.width);
        const newHeight = parseInt(ref.style.height);

        // Calculate position adjustment based on resize direction
        let newX = x;
        let newY = y;

        // Only adjust position when resizing from left or top edges
        if (direction.includes('left')) {
            newX = position.x;
        }

        if (direction.includes('top')) {
            newY = position.y;
        }

        console.log(`[Debug] Resizing - Direction: ${direction}, W=${newWidth}, H=${newHeight}, X=${newX}, Y=${newY}`);

        // Update dimensions and position
        setWidth(newWidth);
        setHeight(newHeight);
        setX(newX);
        setY(newY);
    };



    const handleEditChart = (chartType: 'deflection' | 'lte_season' | 'lte_crack') => {
        setEditingChartType(chartType);
        setChartEditModalOpen(true);
    };

    const handleSaveChartData = async (updatedData: any[]) => {
        try {
            console.log('Attempting to save chart data:', editingChartType, updatedData);

            // Determine path
            let path = `${pathname}${selectedPointId}`;
            if (pathname.includes("level_one")) {
                path = `${pathname}sections/${selectedPointId}`;
            }
            const jsonPath = `${path}/survey_data/${selectedPointId}.json`;


            // Prepare updated data
            const newSurveyData = { ...surveyData };
            if (editingChartType === 'deflection') {
                newSurveyData.Deflection = updatedData;
            } else {
                newSurveyData.LTE = updatedData;
            }

            // Save to backend
            await saveToBackend(jsonPath, newSurveyData);

            // Update local state
            setSurveyData(newSurveyData);
            setSaveSuccess(`Chart data for **${editingChartType}** saved successfully.`);
            setChartEditModalOpen(false);
        } catch (err) {
            console.error("Error saving chart data:", err);
            setSaveError("Failed to save chart data.");
        }
    };

        return createPortal(
            <div className="fixed inset-0 z-[9999]">


            {/* <Rnd
            size={{ width, height }}
            position={{ x, y }}
            bounds="window"
            onDragStop={(e, d) => { setX(d.x); setY(d.y); }}
            onResizeStop={(e, dir, ref, delta, pos) => {
                setWidth(ref.offsetWidth);
                setHeight(ref.offsetHeight);
                setX(pos.x);
                setY(pos.y);
            }}
            className="z-50"
        > */}
            <Rnd
                size={{ width, height }}
                position={{ x, y }}
                onDragStop={(e: any, d: any) => { setX(d.x); setY(d.y); }}
                onResizeStart={handleResizeStart}
onResize={handleResize}
                onResizeStop={() => { 
                    isResizing.current = false; 
                    // After user finishes resizing, re-center within viewport
                    centerModal();
                }}                
                minWidth={300}
                minHeight={300}
                maxWidth={1200}
                bounds="window"
                dragHandleClassName="drag-handle"
                className="z-51 rounded-lg shadow-2xl overflow-hidden"
                enableResizing={{
                    top: true, right: true, bottom: true, left: true,
                    topRight: true, bottomRight: true, bottomLeft: true, topLeft: true
                }}
                // Add custom resize handles with identifiable classes for debugging
                resizeHandleClasses={{
                    top: 'resize-handle top',
                    right: 'resize-handle right',
                    bottom: 'resize-handle bottom',
                    left: 'resize-handle left',
                    topRight: 'resize-handle top-right',
                    bottomRight: 'resize-handle bottom-right',
                    bottomLeft: 'resize-handle bottom-left',
                    topLeft: 'resize-handle top-left'
                }}
            >
                <div  ref={containerRef} className="bg-white w-full h-full flex flex-col overflow-hidden">
                    {/* Gradient header for details */}
                    <div className="drag-handle px-5 py-4 bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] flex justify-between items-center cursor-move">
                        <h2 className="text-xl font-bold text-white">
                            {row?.sectionId || "Details"}
                        </h2>
                        <button
                            className="text-white p-1 rounded-full hover:bg-white/20 transition-colors"
                            onClick={() => setDetailsModalOpen(false)}
                        >
                            <FaTimes size={18} />
                        </button>
                    </div>

                    {/* Details content with improved styling */}
                    <div className="p-5 overflow-y-auto flex-grow">
                        {/* Section Data with fancy header */}
                        <div className="mb-5">
                            <button
                                className="w-full flex justify-between items-center bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] text-white p-3 rounded-lg font-medium"
                                onClick={() => setExpanded(prev => ({ ...prev, section: !prev.section }))}
                            >
                                <div className="flex items-center gap-2">
                                    <FaFileAlt />
                                    <span>Section Data</span>
                                </div>
                                {expanded.section ? <FaChevronDown /> : <FaChevronRight />}
                            </button>
                            {/* Section Header with Edit Button (Header Row) */}

                            {expanded.section && (
                                <div className="p-4 border border-gray-200 rounded-lg mt-2 bg-white shadow-sm">
                                    {/* Section Information Header with Edit Button */}
                                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                                        <h4 className="font-semibold text-lg text-blue-700">
                                            Section Information
                                        </h4>
                                        {isAdmin && (
                                            <button
                                                onClick={handleEditSection}
                                                className="px-2.5 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-1"
                                            >
                                                <FaEdit size={12} />
                                                Edit Section
                                            </button>
                                        )}
                                    </div>

                                    {/* Location Info */}
                                    <h5 className="font-semibold text-md text-gray-700 mb-2">Location Information</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                                        <p><strong>District:</strong> {row.District || "N/A"}</p>
                                        <p><strong>County:</strong> {row.County || "N/A"}</p>
                                        <p><strong>Road ID:</strong> {row.Highway || "N/A"}</p>
                                        <p><strong>GPS (Start):</strong> {row["GPS (Start)"] || "N/A"}</p>
                                        <p><strong>GPS (End):</strong> {row["GPS (End)"] || "N/A"}</p>
                                    </div>

                                    {/* Pavement Info */}
                                    <h5 className="font-semibold text-md text-gray-700 mb-2">Pavement Information</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                                        <p><strong>Pavement Type:</strong> {row["Pavement Type"] || "N/A"}</p>
                                        <p><strong>Thickness:</strong> {row["Thickness (in.)"] || "N/A"}</p>
                                        <p><strong>Subbase:</strong> {row["Subbase Type"] || "N/A"}</p>
                                        <p><strong>Subgrade:</strong> {row["Subgrade Type"] || "N/A"}</p>
                                    </div>

                                    {/* Construction Info */}
                                    <h5 className="font-semibold text-md text-gray-700 mb-2">Construction Information</h5>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-4">
                                        <p><strong>CSJ:</strong> {row.CCSJ || "N/A"}</p>
                                        <p><strong>Length:</strong> {row.Length || "N/A"}</p>
                                        <p><strong>Construction Year:</strong> {row["Construction Year"] || "N/A"}</p>
                                    </div>

                                    {/* Plan Sets with styled download button */}


                                    <div className="flex justify-between items-center border-b pb-2 mb-4">
                                        <h4 className="font-semibold text-lg text-blue-700">
                                            Plan Sets
                                        </h4>
                                        {isAdmin && (
                                            <button
                                                onClick={() => setPlanSetEditOpen(true)}
                                                className="px-2.5 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-1"
                                            >
                                                Edit Plan Set
                                            </button>
                                        )}
                                    </div>

                                    {planSet.length > 0 ? (
                                        <div className="bg-gray-50 p-3 rounded-lg">
                                            {planSet.length > 1 ? (
                                                <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
                                                    <label className="font-medium">Select ZIP File: </label>
                                                    <select
                                                        onChange={(e) => setSelectedPlan(planSet.find(p => p.CSJ === e.target.value) || null)}
                                                        className="p-2 border rounded-md flex-grow"
                                                    >
                                                        <option value="" disabled selected>Select a ZIP</option>
                                                        {planSet.map((p) => (
                                                            <option key={p.CSJ} value={p.CSJ}>
                                                                {p.CSJ}
                                                            </option>
                                                        ))}
                                                    </select>
                                                    <button
                                                        onClick={handleDownload}
                                                        disabled={!selectedPlan}
                                                        className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                    >
                                                        <FaDownload /> Download
                                                    </button>
                                                </div>
                                            ) : (
                                                <button
                                                    onClick={() => {
                                                        setSelectedPlan(planSet[0]);
                                                        handleDownload();
                                                    }}
                                                    className="bg-green-600 hover:bg-green-700 text-white py-2 px-4 rounded-md flex items-center gap-2 transition-colors"
                                                >
                                                    <FaDownload /> Download {planSet[0]?.CSJ}.zip
                                                </button>
                                            )}
                                        </div>
                                    ) : (
                                        <div className="bg-gray-50 p-3 rounded-lg text-gray-600 italic">
                                            No plan sets available.
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Survey Data with fancy header */}
                        <div className="mb-5">
                            <button
                                className="w-full flex justify-between items-center bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] text-white p-3 rounded-lg font-medium"
                                onClick={() => setExpanded(prev => ({ ...prev, surveys: !prev.surveys }))}
                            >
                                <div className="flex items-center gap-2">
                                    <FaChartLine />
                                    <span>Survey Data</span>
                                </div>
                                {expanded.surveys ? <FaChevronDown /> : <FaChevronRight />}
                            </button>
                            {expanded.surveys && (
                                <div className="p-4 border border-gray-200 rounded-lg mt-2 bg-white shadow-sm">
                                    <h4 className="font-semibold text-lg text-green-700 border-b pb-2 mb-3">Survey Details</h4>


                                    {/* Deflection Line Chart */}
                                    <div className="bg-white p-3 rounded-lg border shadow-sm mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-medium text-gray-700">Deflection Data</h5>

                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleEditChart('deflection')}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaEdit size={12} />
                                                    Edit Data
                                                </button>
                                            )}
                                        </div>
                                        {surveyData.Deflection?.length > 0 ? (
                                            <TabbedChart
                                                years={surveyData.Deflection.map((item: { DMI: number }) => toNumOrNull(item.DMI))}
                                                dataSets={Array.from(new Set(
                                                    surveyData.Deflection.flatMap((item: any) => Object.keys(item))
                                                ))
                                                    .filter(k => k !== 'DMI')
                                                    .map(key => ({
                                                        label: String(key),
                                                        data: surveyData.Deflection.map((d: any) => toNumOrNull(d[key as string]))
                                                    }))}
                                            />
                                        ) : (
                                            <p className="italic">No deflection data available.</p>
                                        )}
                                    </div>
                                    {/* LTE Bar Charts */}
                                    <div className="bg-white p-3 rounded-lg border shadow-sm mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-medium text-gray-700">LTE by Crack Spacing</h5>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleEditChart('lte_crack')}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaEdit size={12} />
                                                    Edit Data
                                                </button>
                                            )}
                                        </div>
                                        {surveyData.LTE?.some((d: LTEData) =>
                                            [d.S, d.M, d.L].some(val => typeof val === 'number' && val > 0)
                                        ) ? (
                                            <BarChart
                                                title="LTE by Crack Spacing"
                                                labels={surveyData.LTE.map((item: { Year: number }) => item.Year.toString())}
                                                dataSets={[
                                                    { label: 'Small', data: surveyData.LTE.map((item: { S: number | string }) => (typeof item.S === 'number' ? item.S : 0)) },
                                                    { label: 'Medium', data: surveyData.LTE.map((item: { M: number | string }) => (typeof item.M === 'number' ? item.M : 0)) },
                                                    { label: 'Large', data: surveyData.LTE.map((item: { L: number | string }) => (typeof item.L === 'number' ? item.L : 0)) },
                                                ]}
                                            />
                                        ) : (
                                            <p className="text-gray-500 italic">
                                                No LTE data based on crack spacing available.
                                            </p>
                                        )}
                                    </div>
                                    <div className="bg-white p-3 rounded-lg border shadow-sm mb-6">
                                        <div className="flex justify-between items-center mb-2">
                                            <h5 className="font-medium text-gray-700">LTE by Season</h5>
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleEditChart('lte_season')}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaEdit size={12} />
                                                    Edit Data
                                                </button>
                                            )}
                                        </div>
                                        {surveyData.LTE?.some((d: LTEData) =>
                                            [d.Winter, d.Summer].some(val => typeof val === 'number' && val > 0)
                                        ) ? (
                                            <BarChart
                                                title="LTE by Season"
                                                labels={surveyData.LTE.map((item: { Year: number }) => item.Year.toString())}
                                                dataSets={[
                                                    { label: 'Winter', data: surveyData.LTE.map((item: { Winter: number | string }) => (typeof item.Winter === 'number' ? item.Winter : 0)) },
                                                    { label: 'Summer', data: surveyData.LTE.map((item: { Summer: number | string }) => (typeof item.Summer === 'number' ? item.Summer : 0)) },
                                                ]}
                                            />
                                        ) : (
                                            <p className="text-gray-500 italic">
                                                No LTE data based on season available.
                                            </p>
                                        )}
                                    </div>


                                    {/* Image Gallery */}
                                    <div className="space-y-4">
                                        {/* Header */}
                                        <div className="flex justify-between items-center mb-3">
                                            <h4 className="font-semibold text-lg text-green-700 border-b pb-2 flex items-center gap-2">
                                                <FaImage /> Survey Images
                                            </h4>

                                            {isAdmin && (
                                                <button
                                                    onClick={handleEditImages}
                                                    className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
                                                >
                                                    <FaEdit size={12} />
                                                    Edit Images
                                                </button>
                                            )}
                                        </div>

                                        {/* Status */}
                                        {error ? (
                                            <p className="text-red-600 italic">{error}</p>
                                        ) : surveyImages.length > 0 ? (
                                            Object.entries(groupedImages)
                                                .map(([date, imgs]) => ({ date, imgs, label: convertDate(date) ?? date, key: labelKey(date) }))
                                                .sort((a, b) => b.key - a.key) // DESC by label (convertDate)
                                                .map(({ date, imgs, label }) => (
                                                    <div key={date} className="space-y-2">
                                                        <h5 className="font-medium">{label}</h5>
                                                        <ImageGallery images={imgs} />
                                                    </div>
                                                ))
                                        ) : (
                                            <p className="italic">No survey images available.</p>
                                        )}
                                    </div>

                                </div>
                            )}
                        </div>



                        <div className="mb-5">
                            <button
                                className="w-full flex justify-between items-center bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] text-white p-3 rounded-lg font-medium"
                                onClick={() => setExpanded(prev => ({ ...prev, reports: !prev.reports }))}
                            >
                                <div className="flex items-center gap-2">
                                    <FaFileAlt />
                                    <span>Reports</span>
                                </div>
                                {expanded.reports ? <FaChevronDown /> : <FaChevronRight />}
                            </button>

                            {expanded.reports && (
                                <ReportDisplay
                                    isAdmin={isAdmin}
                                    route={route}
                                    onSuccess={(msg) => setSaveSuccess(msg)}
                                    onError={(msg) => setSaveError(msg)}
                                />
                            )}
                        </div>
                    </div>
                </div>






            </Rnd >
            {/* Edit Modals */}
            <SectionEditModal
                isOpen={isEditModalOpen}
                data={row}
                onClose={() => setIsEditModalOpen(false)}
                onSave={handleSaveSection}
            />
            <ImageEditModal
                isOpen={imageEditModalOpen}
                onClose={() => setImageEditModalOpen(false)}
                sectionId={selectedPointId || row?.sectionId || 'Unknown'}
                currentImages={Object.entries(groupedImages).map(([date, images]) => ({ date, images: images.map(path => ({ path })) }))}
                onSave={(updated, done) => handleSaveImages(updated, done)}
            /><ChartEditModal
                isOpen={chartEditModalOpen}
                onClose={() => setChartEditModalOpen(false)}
                sectionId={selectedPointId || row?.sectionId || 'Unknown'}
                chartType={editingChartType}
                currentData={editingChartType === 'deflection' ? surveyData.Deflection || [] : surveyData.LTE || []}
                onSave={handleSaveChartData}
            />
            <PlanSetEditModal
                isOpen={planSetEditOpen}
                onClose={() => setPlanSetEditOpen(false)}
                sectionId={selectedPointId || row?.sectionId || 'Unknown'}
                currentPlanSets={planSet}
                onSave={(updated, done, summary) => {
                    setPlanSet(updated);
                    setSaveSuccess(summary || 'Plan set saved successfully.');
                    done();
                }}
            />
            {saveSuccess && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[99999]">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-gray-900">
                        <h2 className="text-lg font-semibold text-green-600 mb-2">Save Successful</h2>
                        <div className="prose prose-sm max-w-full text-gray-800" dangerouslySetInnerHTML={{ __html: saveSuccess.replace(/\n/g, '<br>').replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>').replace(/`([^`]+)`/g, '<code>$1</code>') }} />
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setSaveSuccess(null)}
                                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                            >
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {saveError && (
                <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-[99999]">
                    <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-red-800">
                        <h2 className="text-lg font-semibold text-red-600 mb-2">Save Failed</h2>
                        <p className="whitespace-pre-wrap">{saveError}</p>
                        <div className="mt-4 flex justify-end">
                            <button
                                onClick={() => setSaveError(null)}
                                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}

          </div>,
      document.body
    );
};

export default SectionDetailsModal;