"use client"

import React from "react"
import { useEffect, useRef, useState, useMemo, useCallback } from "react"
import { FaTimes, FaChevronUp, FaChevronDown, FaTrash } from "react-icons/fa"
import HighwaySegmentChart from "@/components/chart/HighwaySegmentChart"

interface PMISFeature {
  properties: {
    TX_SIGNED_HIGHWAY_RDBD_ID?: string
    COUNTY?: string
    EFF_YEAR?: string | number
    TX_BEG_REF_MARKER_NBR?: string | number
    TX_BEG_REF_MRKR_DISP?: string | number
    TX_END_REF_MARKER_NBR?: string | number
    TX_END_REF_MRKR_DISP?: string | number
    TX_CONDITION_SCORE?: number | string
    TX_DISTRESS_SCORE?: number | string
    TX_RIDE_SCORE?: number | string
    TX_AADT_CURRENT?: number | string
    TX_MAINTENANCE_COST_AMT?: number | string
    [key: string]: any
  }
  geometry?: any
}

interface SelectedScore {
  value: string
  label: string
}

// Format county name: remove number prefix and convert from ALL CAPS to Capitalized
const formatCountyName = (county?: string): string => {
  if (!county) return "";

  // Normalize weird spaces/dashes, trim
  let s = county.normalize("NFKC").replace(/\u00A0/g, " ").trim();

  // If the field got duplicated with double spaces, keep the last chunk
  const parts = s.split(/\s{2,}/).filter(Boolean);
  if (parts.length > 1) s = parts[parts.length - 1];

  // Remove leading "number - " with any dash variant and optional spaces
  s = s.replace(/^\s*\d+\s*[-–—]?\s*/, "");

  // Title-case
  return s.toLowerCase().replace(/\b\w/g, c => c.toUpperCase());
};

interface HeatMapModalProps {
  id: string
  highway: string
  county: string
  selectedScores: SelectedScore[]
  features: PMISFeature[]
  onClose: () => void
  onRemoveScore: (scoreValue: string) => void
}



// Memoized chart component to prevent unnecessary re-renders
const MemoizedHighwaySegmentChart = React.memo(HighwaySegmentChart)

const HeatMapModal: React.FC<HeatMapModalProps> = ({
  id,
  highway,
  county,
  selectedScores,
  features,
  onClose,
  onRemoveScore,
}) => {
  const [visibleScores, setVisibleScores] = useState<string[]>(selectedScores.map((s) => s.value))
  const [collapsedScores, setCollapsedScores] = useState<string[]>([])
  const [loadedCharts, setLoadedCharts] = useState<Set<string>>(new Set())
  const modalRef = useRef<HTMLDivElement>(null)
  const normalizeCounty = (v: unknown) =>
    formatCountyName(
      String(v ?? "")
        .normalize("NFKC")
        .replace(/\u00A0/g, " ") // NBSP → space
        .trim()
    )
      .replace(/\s+/g, "")        // ← drop ALL spaces
      .toUpperCase();             // case-insensitive compare

  const normalizeHighway = (v: unknown) =>
    String(v ?? "")
      .normalize("NFKC")
      .replace(/\u00A0/g, " ")
      .replace(/\s+/g, "")      // drop ALL spaces
      .toUpperCase();
  // Memoize filtered data to prevent recalculation with deep comparison
  // const heatMapData = useMemo(() => {
  //   if (!features.length) return []
  //   console.log("Filtering features for highway:", highway, "and county:", county)
  //   console.log("Filtering features for highway:", features.slice(0, 5))
  //   console.log(features.filter((f) => {
  //     f.properties.TX_SIGNED_HIGHWAY_RDBD_ID === highway && formatCountyName(f.properties.COUNTY) === county
  //   }))
  //   return features.filter((f) => {
  //     f.properties.TX_SIGNED_HIGHWAY_RDBD_ID === highway && formatCountyName(f.properties.COUNTY) === county
  //   })
  // }, [features, highway, county])

  const heatMapData = useMemo(() => {
    if (!features?.length) return [];

    const hwyKey = normalizeHighway(highway);
    const countyKey = normalizeCounty(county);

    const filtered = features.filter((f) => {
      const fHwy = normalizeHighway(f?.properties?.TX_SIGNED_HIGHWAY_RDBD_ID);
      const fCounty = normalizeCounty(f?.properties?.COUNTY);
      return fHwy === hwyKey && fCounty === countyKey;
    });

    console.log("filter keys:", { hwyKey, countyKey });
    console.log("first 5 matches:", filtered.slice(0, 5));

    return filtered;
  }, [features, highway, county]);
  // Update visible scores when selectedScores changes - optimized
  useEffect(() => {
    const newVisibleScores = selectedScores.map((s) => s.value)
    setVisibleScores(prev => {
      // Only update if actually different
      if (prev.length !== newVisibleScores.length ||
        !prev.every((score, i) => score === newVisibleScores[i])) {
        return newVisibleScores
      }
      return prev
    })

    // Batch load charts
    setLoadedCharts((prev) => {
      const newCharts = new Set(prev)
      let hasChanges = false

      newVisibleScores.forEach((score) => {
        if (!collapsedScores.includes(score) && !newCharts.has(score)) {
          newCharts.add(score)
          hasChanges = true
        }
      })

      return hasChanges ? newCharts : prev
    })
  }, [selectedScores, collapsedScores])

  const toggleCollapse = useCallback((scoreValue: string) => {
    setCollapsedScores((prev) => {
      const isCurrentlyCollapsed = prev.includes(scoreValue)
      const newCollapsed = isCurrentlyCollapsed ? prev.filter((s) => s !== scoreValue) : [...prev, scoreValue]

      // Load chart when expanding (do this in a separate effect)
      if (isCurrentlyCollapsed) {
        // Use setTimeout to avoid state update during render
        setTimeout(() => {
          setLoadedCharts((current) => new Set([...current, scoreValue]))
        }, 0)
      }

      return newCollapsed
    })
  }, [])

  const removeHeatmap = useCallback(
    (scoreValue: string) => {
      setVisibleScores((prev) => prev.filter((s) => s !== scoreValue))
      setLoadedCharts((prev) => {
        const newSet = new Set(prev)
        newSet.delete(scoreValue)
        return newSet
      })
      // Notify parent component to update its state
      onRemoveScore(scoreValue)
    },
    [onRemoveScore],
  )

  // Get active scores (visible and in the original selection)
  const activeScores = useMemo(() => {
    return selectedScores.filter((score) => visibleScores.includes(score.value))
  }, [selectedScores, visibleScores])

  // Lazy load charts - only render when expanded and loaded
  const shouldRenderChart = useCallback(
    (scoreValue: string) => {
      return !collapsedScores.includes(scoreValue) && loadedCharts.has(scoreValue)
    },
    [collapsedScores, loadedCharts],
  )

  return (
    <div ref={modalRef} className="w-full h-full flex flex-col overflow-auto rounded-xl shadow-xl border bg-white">
      <div className="cursor-move select-none flex justify-between items-center px-4 py-2 bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] text-white">
        <h2 className="font-bold text-sm">
          {highway}, {county} — {activeScores.length} Score Type{activeScores.length !== 1 ? "s" : ""}
        </h2>
        <button onClick={onClose} className="p-1 hover:bg-white/20 rounded-full">
          <FaTimes />
        </button>
      </div>
      <div className="p-4 flex-grow overflow-auto flex flex-col items-center space-y-6">
        {heatMapData.length > 0 && activeScores.length > 0 ? (
          activeScores.map((score) => (
            <div key={score.value} className="w-full border rounded-lg overflow-hidden transition-all duration-300">
              <div className="flex justify-between items-center bg-gray-100 px-3 py-2">
                <h3 className="font-medium text-sm text-gray-700">{score.label}</h3>
                <div className="flex space-x-2">
                  <button
                    onClick={() => toggleCollapse(score.value)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-full transition-colors"
                    aria-label={collapsedScores.includes(score.value) ? "Expand" : "Collapse"}
                  >
                    {collapsedScores.includes(score.value) ? <FaChevronDown size={14} /> : <FaChevronUp size={14} />}
                  </button>
                  <button
                    onClick={() => removeHeatmap(score.value)}
                    className="p-1.5 text-gray-600 hover:bg-gray-200 hover:text-red-500 rounded-full transition-colors"
                    aria-label="Remove"
                  >
                    <FaTrash size={14} />
                  </button>
                </div>
              </div>
              <div
                className={`transition-all duration-300 overflow-hidden ${collapsedScores.includes(score.value) ? "max-h-0 p-0" : "max-h-[500px] p-3"
                  }`}
              >
                {shouldRenderChart(score.value) ? (
                  <div className="w-full h-[400px]">
                    <MemoizedHighwaySegmentChart
                      key={`${highway}-${county}-${score.value}`}
                      data={heatMapData}
                      selectedHighway={highway}
                      selectedScore={score}
                    />
                  </div>
                ) : !collapsedScores.includes(score.value) ? (
                  <div className="w-full h-[400px] flex items-center justify-center bg-gray-50">
                    <div className="text-gray-500 text-sm animate-pulse">Loading chart...</div>
                  </div>
                ) : null}
              </div>
            </div>
          ))
        ) : (
          <p className="text-sm text-gray-500">
            {visibleScores.length === 0
              ? "All heatmaps have been removed. Close this modal to select new score types."
              : `No data available for ${highway}, ${county} and selected score type(s).`}
          </p>
        )}
      </div>
    </div>
  )
}

// Memoize the entire component to prevent unnecessary re-renders
export default React.memo(HeatMapModal)
