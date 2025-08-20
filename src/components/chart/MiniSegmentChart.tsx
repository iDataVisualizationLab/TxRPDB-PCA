"use client"

import React, { useMemo } from "react"

// Inline function to avoid import issues
const cleanAndRound = (value: any): number => {
  if (value === null || typeof value === "undefined") return 0.0
  const cleaned = String(value).replace(/[^0-9.]/g, "")
  if (cleaned === "") return 0.0
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0.0
  return Number(num.toFixed(3))
}

export interface PMISFeature {
  properties: {
    TX_SIGNED_HIGHWAY_RDBD_ID?: string
    COUNTY?: string
    EFF_YEAR?: string | number
    TX_BEG_REF_MARKER_NBR?: string | number
    TX_BEG_REF_MRKR_DISP?: string | number
    TX_END_REF_MARKER_NBR?: string | number
    TX_END_REF_MARKER_DISP?: string | number
    TX_CONDITION_SCORE?: number | string
    TX_DISTRESS_SCORE?: number | string
    TX_RIDE_SCORE?: number | string
    TX_AADT_CURRENT?: number | string
    TX_MAINTENANCE_COST_AMT?: number | string
    TX_LENGTH?: number | string
    [key: string]: any
  }
  geometry?: any
}

interface MiniSegmentChartProps {
  data: PMISFeature[]
  metric: string
  getCategory: (scoreType: string, score: number) => string
  getCategoryColor: (category: string, scoreType: string) => string
}

const fieldToScoreType: Record<string, string> = {
  TX_CONDITION_SCORE: "condition",
  TX_DISTRESS_SCORE: "distress",
  TX_RIDE_SCORE: "ride",
  TX_AADT_CURRENT: "aadt",
  TX_MAINTENANCE_COST_AMT: "cost",
}

const BAR_THICKNESS = 1; // px, very thin bar
const MIN_SEGMENT_WIDTH = 2; // percent of SVG width (since width is in percent)

const MiniSegmentChart: React.FC<MiniSegmentChartProps> = ({ data, metric, getCategory, getCategoryColor }) => {
  // Find all unique years in the data
  const years = useMemo(() => {
    return Array.from(new Set(data.map((f) => Number(f.properties.EFF_YEAR) || 0))).sort((a, b) => b - a)
  }, [data])

  // Find the max number of years that could be present (for consistent spacing)
  // If you want to use a fixed set, e.g., 10 years, set it here
  const maxYears = years.length > 0 ? years.length : 1;

  const chartData = useMemo(() => {
    let minMarker = Infinity;
    let maxMarker = -Infinity;

    // Group segments by year
    const yearSegments = years.map((yr) => {
      return data
        .filter((f) => Number(f.properties.EFF_YEAR) === yr)
        .map((f) => {
          const beginMarker = cleanAndRound(f.properties.TX_BEG_REF_MARKER_NBR)
          const beginDisp = cleanAndRound(f.properties.TX_BEG_REF_MRKR_DISP)
          const length = cleanAndRound(f.properties.TX_LENGTH)

          const begin = beginMarker + beginDisp
          const end = begin + length
          const score = Number(f.properties[metric])

          minMarker = Math.min(minMarker, begin)
          maxMarker = Math.max(maxMarker, end)

          return { begin, end, score }
        })
        .filter((segment) => !isNaN(segment.score) && segment.score > 0)
        .sort((a, b) => a.begin - b.begin)
    })

    if (minMarker === Infinity) return []

    const totalMarkerRange = maxMarker - minMarker

    // Calculate vertical spacing for each year
    const verticalGap = 0; // px, or adjust as needed for padding between bars

    const segments: {
      x: number
      y: number
      width: number
      height: number
      fill: string
    }[] = []

    yearSegments.forEach((segmentsOfYear, i) => {
      // Evenly space bars within the calculated height
      const yPos = verticalGap + i * (BAR_THICKNESS + verticalGap)
      segmentsOfYear.forEach(({ begin, end, score }) => {
        const scoreType = fieldToScoreType[metric] || ""
        const category = getCategory(scoreType, score)
        const color = getCategoryColor(category, scoreType)

        const x = totalMarkerRange > 0 ? ((begin - minMarker) / totalMarkerRange) * 100 : 0
        const width = totalMarkerRange > 0 ? ((end - begin) / totalMarkerRange) * 100 : 100

        segments.push({
          x,
          y: yPos,
          width: Math.max(MIN_SEGMENT_WIDTH, width),
          height: BAR_THICKNESS,
          fill: color,
        })
      })
    })

    return segments
  }, [data, metric, getCategory, getCategoryColor, years, maxYears])

  if (chartData.length === 0) {
    // Calculate empty chart height for consistent cell height
    const emptyHeight = years.length * BAR_THICKNESS;
    return <div className="w-full h-full bg-gray-100" style={{ height: emptyHeight }} />
  }

  // Calculate dynamic chart height
  const chartHeight = years.length * BAR_THICKNESS;
  return (
    <div className="w-full h-full flex items-center justify-center p-3">
      <svg width="100%" height={chartHeight} viewBox={`0 0 100 ${chartHeight}`} preserveAspectRatio="none">
        {chartData.map((d, i) => (
          <rect key={i} x={d.x} y={d.y} width={d.width} height={d.height} fill={d.fill} />
        ))}
      </svg>
    </div>
  )
}

export default React.memo(MiniSegmentChart) 