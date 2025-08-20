import type React from "react"
import dynamic from "next/dynamic"

// Inline function to avoid import issues
const cleanAndRound = (value: any): number => {
  if (value === null || typeof value === "undefined") return 0.0
  const cleaned = String(value).replace(/[^0-9.]/g, "")
  if (cleaned === "") return 0.0
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0.0
  return Number(num.toFixed(3))
}

const getDiscreteCategory = (metric: string, value: number): number => {
  const max = metric === "TX_AADT_CURRENT" ? GLOBAL_AADT_MAX : GLOBAL_COST_MAX
  const thresholds = [max * 0.125, max * 0.25, max * 0.375, max * 0.5, max * 0.625, max * 0.75, max * 0.875, max]
  for (let i = 0; i < thresholds.length; i++) {
    if (value <= thresholds[i]) return i
  }
  return thresholds.length - 1
}

const getDiscreteColor = (index: number, metric: string): string => {
  const aadtColors = [
    "rgb(140, 190, 220)", // More saturated but still lighter than category 2
    "rgb(107, 174, 214)",
    "rgb(66, 146, 198)",
    "rgb(33, 113, 181)",
    "rgb(8, 81, 156)",
    "rgb(8, 69, 148)",
    "rgb(8, 48, 107)",
    "rgb(5, 24, 82)",
  ]
  // const costColors = [
  //   "rgb(254, 229, 217)",
  //   "rgb(253, 204, 138)",
  //   "rgb(252, 169, 118)",
  //   "rgb(252, 141, 89)",
  //   "rgb(239, 101, 72)",
  //   "rgb(227, 74, 51)",
  //   "rgb(179, 0, 0)",
  //   "rgb(127, 0, 0)",
  // ]

  const costColors = [
    "rgb(230, 220, 240)", // More saturated but still lighter than category 2
    "rgb(218, 218, 235)",
    "rgb(188, 189, 220)",
    "rgb(158, 154, 200)",
    "rgb(128, 125, 186)",
    "rgb(106, 81, 163)",
    "rgb(74, 20, 134)",
    "rgb(45, 0, 75)",     // darkest purple
  ];


  return metric === "TX_AADT_CURRENT" ? aadtColors[index] || "#ccc" : costColors[index] || "#ccc"
}

const GLOBAL_AADT_MIN = 0
const GLOBAL_AADT_MAX = 371120
const GLOBAL_COST_MIN = 0
const GLOBAL_COST_MAX = 543313
const MIN_SEGMENT_LENGTH = 0.5 // Minimum segment length in reference marker units

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })

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

export interface SelectedScore {
  value: string
  label: string
}

interface HighwaySegmentChartProps {
  data: PMISFeature[]
  selectedHighway: string
  selectedScore: SelectedScore
}

function getCategory(metric: string, score: number): string {
  // Use fixed thresholds for condition metrics
  switch (metric) {
    case "TX_DISTRESS_SCORE":
      if (score >= 90) return "Very Good"
      if (score >= 80) return "Good"
      if (score >= 70) return "Fair"
      if (score >= 60) return "Poor"
      if (score < 1) return "Invalid"
      return "Very Poor"
    case "TX_RIDE_SCORE":
      if (score >= 4.0) return "Very Good"
      if (score >= 3.0) return "Good"
      if (score >= 2.0) return "Fair"
      if (score >= 1.0) return "Poor"
      if (score < 0.1) return "Invalid"
      return "Very Poor"
    case "TX_CONDITION_SCORE":
      if (score >= 90) return "Very Good"
      if (score >= 70) return "Good"
      if (score >= 50) return "Fair"
      if (score >= 35) return "Poor"
      if (score < 1) return "Invalid"
      return "Very Poor"
    default:
      return "Very Good"
  }
}

const getCategoryColor = (category: string): string => {
  switch (category) {
    case "Very Poor":
      return "rgb(239, 68, 68)"
    case "Poor":
      return "rgb(249, 115, 22)"
    case "Fair":
      return "rgb(234, 179, 8)"
    case "Good":
      return "rgb(34, 197, 94)"
    case "Very Good":
      return "rgb(21, 128, 61)"
    case "Invalid":
      return "rgb(200, 200, 200)"
    default:
      return "rgb(75, 85, 99)"
  }
}

function getTickTextWithThresholds(metric: string): string[] {
  switch (metric) {
    case "TX_DISTRESS_SCORE":
      return ["<60 Very Poor", "60-69 Poor", "70-79 Fair", "80-89 Good", "90-100 Very Good"]
    case "TX_RIDE_SCORE":
      return ["<1.0 Very Poor", "1.0–1.9 Poor", "2.0–2.9 Fair", "3.0–3.9 Good", "≥4.0 Very Good"]
    case "TX_CONDITION_SCORE":
      return ["<35 Very Poor", "35–49 Poor", "50–69 Fair", "70–89 Good", "90–100 Very Good"]
    case "TX_AADT_CURRENT":
      return ["Low", "", "Medium", "", "High"]
    case "TX_MAINTENANCE_COST_AMT":
      return ["Low", "", "Medium", "", "High"]
    default:
      return ["Very Poor", "Poor", "Fair", "Good", "Very Good"]
  }
}

// Format cost as currency
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value)
}

// Format AADT with commas
function formatAADT(value: number): string {
  return new Intl.NumberFormat("en-US").format(value)
}

// Helper function to round to 2 decimal places
function roundToTwoDecimals(value: number | string): number {
  return Number(Number(value).toFixed(2))
}

const HighwaySegmentChart: React.FC<HighwaySegmentChartProps> = ({ data, selectedHighway, selectedScore }) => {
  const traces: any[] = []
  const years = Array.from(new Set(data.map((f) => Number(f.properties.EFF_YEAR) || 0))).sort((a, b) => b - a)

  const yearSpacing = years.length > 1 ? 400 / (years.length - 1) : 7
  const adaptiveLineWidth = Math.max(7, Math.min(14, yearSpacing * 0.3))

  // AADT scale
  const minAADT = GLOBAL_AADT_MIN
  const maxAADT = GLOBAL_AADT_MAX

  // Cost scale
  const minCost = GLOBAL_COST_MIN
  const maxCost = GLOBAL_COST_MAX

  years.forEach((yr) => {
    // Get all segments for this year and sort them by beginning reference marker
    const yearSegments = data
      .filter((f) => Number(f.properties.EFF_YEAR) === yr)
      .map((f) => {
        // Round the individual property values to 2 decimal places before calculating begin and end
        const beginMarker = cleanAndRound(f.properties.TX_BEG_REF_MARKER_NBR)
        const beginDisp = cleanAndRound(f.properties.TX_BEG_REF_MRKR_DISP)
        const length = cleanAndRound(f.properties.TX_LENGTH)

        // Calculate begin and end using the rounded values
        const begin = beginMarker + beginDisp
        const end = begin + length
        const score = Number(f.properties[selectedScore.value])

        // Ensure minimum segment length for visibility
        const segmentLength = length
        const adjustedEnd = segmentLength < MIN_SEGMENT_LENGTH ? begin + MIN_SEGMENT_LENGTH : end

        return { f, begin, end: adjustedEnd, score }
      })
      .filter((segment) => !isNaN(segment.score))
      .sort((a, b) => a.begin - b.begin)

    // Process segments and detect overlaps
    for (let i = 0; i < yearSegments.length; i++) {
      const { f, begin, end, score } = yearSegments[i]

      // Check if this segment overlaps with any previous segment
      let isOverlapping = false
      let yOffset = 0

      // Look at all previous segments to check for overlaps
      for (let j = 0; j < i; j++) {
        const prevSegment = yearSegments[j]
        // If current segment begins before previous segment ends, it's an overlap
        if (begin < prevSegment.end) {
          isOverlapping = true
          // Increase offset to avoid stacking directly on top of another segment
          yOffset = 0.1
          break
        }
      }

      const yPosition = yr + yOffset

      if (selectedScore.value === "TX_AADT_CURRENT") {
        const categoryIndex = getDiscreteCategory(selectedScore.value, score)
        const color = getDiscreteColor(categoryIndex, selectedScore.value)
        traces.push({
          x: [begin, end],
          y: [yPosition, yPosition],
          mode: "lines",
          line: { width: adaptiveLineWidth, color: color },
          hoverinfo: "text",
          text: `Year: ${yr}<br>${selectedScore.label}: ${formatAADT(score)}<br>Category: ${categoryIndex + 1}<br>TX_BEG_REF_MARKER_NBR: ${f.properties.TX_BEG_REF_MARKER_NBR}<br>TX_BEG_REF_MRKR_DISP: ${f.properties.TX_BEG_REF_MRKR_DISP}<br>TX_END_REF_MARKER_NBR: ${f.properties.TX_END_REF_MARKER_NBR}<br>TX_END_REF_MARKER_DISP: ${f.properties.TX_END_REF_MARKER_DISP}${isOverlapping ? "<br><b>Overlapping segment</b>" : ""}`,
          showlegend: false,
        })
      } else if (selectedScore.value === "TX_MAINTENANCE_COST_AMT") {
        const categoryIndex = getDiscreteCategory(selectedScore.value, score)
        const color = getDiscreteColor(categoryIndex, selectedScore.value)
        traces.push({
          x: [begin, end],
          y: [yPosition, yPosition],
          mode: "lines",
          line: { width: adaptiveLineWidth, color: color },
          hoverinfo: "text",
          text: `Year: ${yr}<br>${selectedScore.label}: ${score}<br>Category: ${categoryIndex}<br>TX_BEG_REF_MARKER_NBR: ${f.properties.TX_BEG_REF_MARKER_NBR}<br>TX_BEG_REF_MRKR_DISP: ${f.properties.TX_BEG_REF_MRKR_DISP}<br>TX_END_REF_MARKER_NBR: ${f.properties.TX_END_REF_MARKER_NBR}<br>TX_END_REF_MARKER_DISP: ${f.properties.TX_END_REF_MARKER_DISP}${isOverlapping ? "<br><b>Overlapping segment</b>" : ""}`,
          showlegend: false,
        })
      } else {
        const category = getCategory(selectedScore.value, score)
        traces.push({
          x: [begin, end],
          y: [yPosition, yPosition],
          mode: "lines",
          line: { width: adaptiveLineWidth, color: getCategoryColor(category) },
          hoverinfo: "text",
          text: `Year: ${yr}<br>${selectedScore.label}: ${score}<br>Category: ${category}<br>TX_BEG_REF_MARKER_NBR: ${f.properties.TX_BEG_REF_MARKER_NBR}<br>TX_BEG_REF_MRKR_DISP: ${f.properties.TX_BEG_REF_MRKR_DISP}<br>TX_END_REF_MARKER_NBR: ${f.properties.TX_END_REF_MARKER_NBR}<br>TX_END_REF_MARKER_DISP: ${f.properties.TX_END_REF_MARKER_DISP}${isOverlapping ? "<br><b>Overlapping segment</b>" : ""}`,
          showlegend: false,
        })
      }
    }
  })

  return (
    <Plot
      data={traces}
      layout={{
        height: 400,
        autosize: true,
        margin: { l: 50, r: 50, t: 20, b: 40 },
        xaxis: {
          title: "Reference Marker",
          showgrid: true,
          gridcolor: "rgba(0,0,0,0.3)",
          gridwidth: 1,
        },
        yaxis: {
          title: "Year",
          showgrid: true,
          gridcolor: "rgba(0,0,0,0.3)",
          gridwidth: 1,
        },
      }}
      useResizeHandler={true}
      style={{ width: "100%", height: "100%" }}
      config={{ responsive: true }}
    />
  )
}

export default HighwaySegmentChart