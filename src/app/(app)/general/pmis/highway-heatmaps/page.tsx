"use client"

import dynamic from "next/dynamic"
import type React from "react"
import { useEffect, useState, useCallback, useRef, useMemo } from "react"
import { useResizeDetector } from "react-resize-detector"
import { route } from "@/config"
import TableModalPMIS from "./TableModalPMIS"
import MapModal from "./MapModal"

import dynamicImport from "next/dynamic"
import { useGlobalLoading } from "@/context/GlobalLoadingContext"
import { API_GET_PROXY, fetchProxy } from "@/lib/api";

const ScoreGauge = dynamicImport(() => import("@/components/chart/ScoreGauge"), { ssr: false })
const CategoryBarChart = dynamicImport(() => import("@/components/chart/CategoryBarChart"), { ssr: false })
const HeatMapModal = dynamicImport(() => import("./HeatMapModal"), { ssr: false })
const DynamicMapComponent = dynamic(() => import("@/components/map-arcgis/map"), { ssr: false })

// Map field names to score types
const fieldToScoreType = {
  TX_CONDITION_SCORE: "condition",
  TX_DISTRESS_SCORE: "distress",
  TX_RIDE_SCORE: "ride",
  TX_AADT_CURRENT: "aadt",
  TX_MAINTENANCE_COST_AMT: "cost",
}

// Add this interface at the top of the file after the existing interfaces
interface ChartData {
  highway: string
  county: string
  field: string
}

const EXP3: React.FC = () => {
  // ─── State ─────────────────────────────────────────────────────
  const [selectedHighway, setSelectedHighway] = useState<string | null>(null)
  const [mapModalOpen, setMapModalOpen] = useState(false)
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 })
  const [pmisFeatures, setPmisFeatures] = useState<any[]>([])
  const [selectedCharts, setSelectedCharts] = useState<{ highway: string; county: string; field: string }[]>([])
  const [scoreGauges, setScoreGauges] = useState<{ [k in "condition" | "distress" | "ride" | "aadt" | "cost"]?: number }>({})
  const [mapModalInfo, setMapModalInfo] = useState<{ highway: string; county: string } | null>(null)
  const [activeHeatMapData, setActiveHeatMapData] = useState<
    { highway: string; county: string; scores: { value: string; label: string }[]; id: string }[]
  >([])
  const [isLoading, setIsLoading] = useState(true)

  // Add search state management with debouncing
  const [tableSearch, setTableSearch] = useState("")
  const [debouncedTableSearch, setDebouncedTableSearch] = useState("")

  // Optimized debounce effect for search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedTableSearch(tableSearch), 150)
    return () => clearTimeout(timer)
  }, [tableSearch])

  // Track if all modals were recently closed
  const [recentlyCleared, setRecentlyCleared] = useState(false)

  // Use a ref to generate unique IDs for heatmaps
  const heatmapIdCounter = useRef(0)
  const getNextHeatmapId = () => {
    heatmapIdCounter.current += 1
    return `heatmap-${heatmapIdCounter.current}`
  }

  // Extract all AADT and Cost values for percentile calculations
  const allAADTValues = useMemo(() => {
    if (!pmisFeatures.length) return []
    return pmisFeatures.map((f) => Number(f.properties.TX_AADT_CURRENT)).filter((v) => !isNaN(v) && v > 0)
  }, [pmisFeatures])

  const allCostValues = useMemo(() => {
    if (!pmisFeatures.length) return []
    return pmisFeatures.map((f) => Number(f.properties.TX_MAINTENANCE_COST_AMT)).filter((v) => !isNaN(v) && v > 0)
  }, [pmisFeatures])

  // Global loading context
  const { setLoading } = useGlobalLoading()

  // Connect local loading state to global loading context
  useEffect(() => {
    setLoading(isLoading)
    return () => setLoading(false)
  }, [isLoading, setLoading])

  // ─── Resize detector for the table (attach this to the left panel content) ─────
  const {
    ref: tableContainerRef,
    width,
    height,
  } = useResizeDetector({ refreshMode: "debounce", refreshRate: 100 })

  useEffect(() => {
    if (width && height) setContainerDimensions({ width, height })
  }, [width, height])

  // ─── Load PMIS features via simple fetch ───────────────────────
  useEffect(() => {
    setIsLoading(true)

    fetch(`${route}/general/Concrete_distresses.csv`)
      .then((res) => res.text())
      .then((csvText) => {
        // Parse CSV text to array of objects
        const lines = csvText.split("\n")
        const headers = lines[0].split(",").map((header) => header.trim())

        const features = lines
          .slice(1)
          .filter((line) => line.trim() !== "")
          .map((line) => {
            const values = line.split(",").map((value) => value.trim())
            const properties: Record<string, string> = {}
            headers.forEach((header, index) => {
              properties[header] = values[index]
            })
            // Create a feature structure similar to GeoJSON to maintain compatibility
            return { type: "Feature", properties, geometry: null }
          })

        setPmisFeatures(features)
        setIsLoading(false)
      })
      .catch((err) => {
        console.error("Failed to load CSV data:", err)
        setIsLoading(false)
      })
  }, [])

  // ─── Reset all data when all heatmaps are closed ───────────────
  useEffect(() => {
    if (activeHeatMapData.length === 0) {
      setScoreGauges({})
      setSelectedCharts([])
      heatmapIdCounter.current = 0
      setRecentlyCleared(true)
    } else {
      setRecentlyCleared(false)
    }
  }, [activeHeatMapData])

  // ─── Update gauges when heatmaps or their scores change ─────────
  useEffect(() => {
    const activeScoreTypes: Record<string, boolean> = {
      condition: false, distress: false, ride: false, aadt: false, cost: false,
    }

    activeHeatMapData.forEach((heatmap) => {
      heatmap.scores.forEach((score) => {
        const scoreType = fieldToScoreType[score.value as keyof typeof fieldToScoreType]
        if (scoreType) activeScoreTypes[scoreType] = true
      })
    })

    setScoreGauges((prev) => {
      const newGauges: typeof prev = {}
      Object.entries(prev).forEach(([type, value]) => {
        if (activeScoreTypes[type]) newGauges[type as keyof typeof prev] = value
      })
      return newGauges
    })
  }, [activeHeatMapData])
   useEffect(() => {
        console.log('Score gauges updated:', scoreGauges);
    }, [scoreGauges]);
  // ─── Chart‐adding callback ─────────────────────────────────────
  const addChart = useCallback(
    (chart: ChartData, scoreValue: number) => {
      if (recentlyCleared) {
        setRecentlyCleared(false)
        setSelectedCharts([chart])
        const scoreType = fieldToScoreType[chart.field as keyof typeof fieldToScoreType]
        if (scoreType) setScoreGauges({ [scoreType]: scoreValue })
      } else {
        setSelectedCharts((prev) =>
          prev.some((c) => c.highway === chart.highway && c.county === chart.county && c.field === chart.field)
            ? prev
            : [...prev, chart],
        )
        const scoreType = fieldToScoreType[chart.field as keyof typeof fieldToScoreType]
        if (scoreType) setScoreGauges((prev) => ({ ...prev, [scoreType]: scoreValue }))
      }
    },
    [recentlyCleared],
  )

  // ─── Add or update heatmap data ────────────────────────────────
  const addOrUpdateHeatMapData = useCallback(
    (chart: ChartData) => {
      let scoreLabel: string
      switch (chart.field) {
        case "TX_AADT_CURRENT": scoreLabel = "AADT"; break
        case "TX_MAINTENANCE_COST_AMT": scoreLabel = "Maintenance Cost"; break
        case "TX_CONDITION_SCORE": scoreLabel = "Condition Score"; break
        case "TX_DISTRESS_SCORE": scoreLabel = "Distress Score"; break
        case "TX_RIDE_SCORE": scoreLabel = "Ride Score"; break
        default:
          scoreLabel = chart.field.replace("TX_", "").split("_").map((w) => w.charAt(0) + w.slice(1).toLowerCase()).join(" ")
      }

      const newScore = { value: chart.field, label: scoreLabel }

      if (recentlyCleared) {
        const newHeatmapId = getNextHeatmapId()
        setActiveHeatMapData([{ highway: chart.highway, county: chart.county, scores: [newScore], id: newHeatmapId }])
        return
      }

      const existingIndex = activeHeatMapData.findIndex(
        (item) => item.highway === chart.highway && item.county === chart.county,
      )

      if (existingIndex >= 0) {
        setActiveHeatMapData((prev) => {
          const updated = [...prev]
          const scoreExists = updated[existingIndex].scores.some((s) => s.value === chart.field)
          if (!scoreExists) {
            updated[existingIndex] = { ...updated[existingIndex], scores: [...updated[existingIndex].scores, newScore] }
          }
          return updated
        })
      } else {
        setActiveHeatMapData((prev) => [
          ...prev, { highway: chart.highway, county: chart.county, scores: [newScore], id: getNextHeatmapId() },
        ])
      }
    },
    [activeHeatMapData, recentlyCleared],
  )

  const handleAddChart = useCallback(
    (chart: ChartData, scoreValue: number) => {
      addChart(chart, scoreValue)
      addOrUpdateHeatMapData(chart)
    },
    [addChart, addOrUpdateHeatMapData],
  )

  // ─── Open/Close MapModal ───────────────────────────────────────
  const showMapModal = useCallback((highway: string, county: string) => {
    setMapModalInfo({ highway, county }); setMapModalOpen(true)
  }, [])
  const closeMapModal = useCallback(() => { setMapModalOpen(false); setMapModalInfo(null) }, [])

  // ─── Draggable split state ─────────────────────────────────────
  const [leftPanelWidth, setLeftPanelWidth] = useState(50) // Percentage
  const [isDragging, setIsDragging] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const dragStartX = useRef(0)
  const dragStartWidth = useRef(50)

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!containerRef.current) return
    setIsDragging(true)
    dragStartX.current = e.clientX
    dragStartWidth.current = leftPanelWidth
    e.preventDefault()
  }, [leftPanelWidth])

  const handleMouseMove = useCallback((e: MouseEvent) => {
    if (!isDragging || !containerRef.current) return
    const containerRect = containerRef.current.getBoundingClientRect()
    const deltaX = e.clientX - dragStartX.current
    const deltaPercent = (deltaX / containerRect.width) * 100
    const newWidth = Math.min(Math.max(dragStartWidth.current + deltaPercent, 20), 80)
    setLeftPanelWidth(newWidth)
  }, [isDragging])

  const handleMouseUp = useCallback(() => setIsDragging(false), [])
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove)
      document.addEventListener("mouseup", handleMouseUp)
      document.body.style.cursor = "col-resize"
      document.body.style.userSelect = "none"
      return () => {
        document.removeEventListener("mousemove", handleMouseMove)
        document.removeEventListener("mouseup", handleMouseUp)
        document.body.style.cursor = ""
        document.body.style.userSelect = ""
      }
    }
  }, [isDragging, handleMouseMove, handleMouseUp])

  // ─── Visualization renderer ────────────────────────────────────
  const renderVisualization = useCallback((type: string, value: number) => {
    const key = `${type}-${value}`
    if (type === "aadt") return <CategoryBarChart key={key} value={value} dataType="aadt" allValues={allAADTValues} />
    if (type === "cost") return <CategoryBarChart key={key} value={value} dataType="cost" allValues={allCostValues} />
    return <ScoreGauge key={key} value={value} scoreType={type as "condition" | "distress" | "ride"} />
  }, [allAADTValues, allCostValues])

  // ─── Table modal element ───────────────────────────────────────
  const tableModalComponent = useMemo(() => (
    <TableModalPMIS
      title="PMIS Data"
      containerDimensions={containerDimensions}
      setSelectedHighway={setSelectedHighway}
      addChart={handleAddChart}
      activeHeatMapData={activeHeatMapData}
      showMapModal={showMapModal}
      search={debouncedTableSearch}
      setSearch={setTableSearch}
      features={pmisFeatures}
    />
  ), [containerDimensions, handleAddChart, activeHeatMapData, showMapModal, debouncedTableSearch, pmisFeatures])

  // ─── Layout ────────────────────────────────────────────────────
  return (
    <div className="h-full">
      <div ref={containerRef} className="flex h-full w-full p-4 bg-gray-100 overflow-auto gap-1">
        {/* Left side - Table */}
        <div
          className="flex flex-col overflow-hidden rounded-lg shadow border border-gray-200 bg-white"
          style={{ width: Object.keys(scoreGauges).length > 0 ? `${leftPanelWidth}%` : "100%" }}
        >
          {/* ATTACH the measuring ref here so the table can use the full height */}
          <div ref={tableContainerRef} className="flex-grow overflow-hidden min-h-0">
            {tableModalComponent}
          </div>
        </div>

        {/* Draggable divider */}
        {Object.keys(scoreGauges).length > 0 && (
          <div className="w-1 bg-gray-300 hover:bg-gray-400 cursor-col-resize flex-shrink-0 transition-colors" onMouseDown={handleMouseDown} />
        )}

        {/* Right side - Heatmaps */}
        {Object.keys(scoreGauges).length > 0 && (
          <div className="flex flex-col overflow-hidden rounded-lg shadow border border-gray-200 bg-white" style={{ width: `${100 - leftPanelWidth}%` }}>
            <div className="flex flex-col">
              <div className="px-5 py-3 bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] text-white font-bold flex justify-between items-center">
                <span>PMIS Heat Maps</span>
                <button onClick={() => setActiveHeatMapData([])} className="px-3 py-1 bg-white/20 hover:bg-white/30 rounded text-sm transition-colors" title="Close all heatmaps">
                  Close All
                </button>
              </div>

              {/* Gauges */}
              <div className="p-2 bg-gray-50 overflow-x-auto">
                <div className="flex gap-6 min-w-min">
                  {Object.keys(scoreGauges).length > 0 && (
                    <div className="py-1 px-3 bg-gray-50 shadow-sm mb-4">
                      <div className="overflow-x-auto pb-2">
                        <div className="flex flex-row gap-6 min-w-min">
                          {Object.entries(scoreGauges).map(([type, value]) => (
                            <div key={`viz-${type}`} className="w-[220px] h-[120px] flex-shrink-0 flex flex-col justify-end">
                              {renderVisualization(type, value || 0)}
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Scrollable modals */}
            <div className="flex-grow overflow-y-auto px-4 pb-4">
              {activeHeatMapData.map((data) => (
                <div key={data.id} className="mb-4">
                  <HeatMapModal
                    id={data.id}
                    highway={data.highway}
                    county={data.county}
                    selectedScores={data.scores}
                    features={pmisFeatures}
                    onClose={() => setActiveHeatMapData((prev) => prev.filter((item) => item.id !== data.id))}
                    onRemoveScore={(scoreValue) => {
                      setActiveHeatMapData((prev) =>
                        prev
                          .map((item) =>
                            item.id === data.id ? { ...item, scores: item.scores.filter((s) => s.value !== scoreValue) } : item,
                          )
                          .filter((item) => item.scores.length > 0),
                      )
                    }}
                  />
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Map Modal */}
      {mapModalOpen && mapModalInfo && (
        <MapModal id="map-modal" onClose={() => closeMapModal()} highway={mapModalInfo.highway} county={mapModalInfo.county} />
      )}
    </div>
  )
}

export default EXP3
