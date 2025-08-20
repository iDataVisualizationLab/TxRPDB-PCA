"use client"

import type React from "react"
import { useRef, useState } from "react"
import Plot from "react-plotly.js"
import ScoreGaugeTooltip from "@/components/ScoreGaugeTooltip"
import ReactDOM from "react-dom"

// Helper functions
export const getScoreCategory = (scoreType: string, score: number): string => {
  if (scoreType === "condition") {
    if (score < 1) return "Invalid"
    if (score < 35) return "Very Poor"
    if (score < 50) return "Poor"
    if (score < 70) return "Fair"
    if (score < 90) return "Good"
    return "Very Good"
  } else if (scoreType === "distress") {
    if (score < 1) return "Invalid"
    if (score < 60) return "Very Poor"
    if (score < 70) return "Poor"
    if (score < 80) return "Fair"
    if (score < 90) return "Good"
    return "Very Good"
  } else if (scoreType === "aadt") {
    if (score <= 6420) return "Very Low"
    if (score <= 13380) return "Low"
    if (score <= 27000) return "Medium"
    if (score <= 50000) return "High"
    return "Very High"
  } else if (scoreType === "cost") {
    if (score <= 19) return "Very Low"
    if (score <= 184) return "Low"
    if (score <= 1070) return "Medium"
    if (score <= 5000) return "High"
    return "Very High"
  } else {
    // ride score
    if (score < 0.1) return "Invalid"
    if (score < 1) return "Very Poor"
    if (score < 2) return "Poor"
    if (score < 3) return "Fair"
    if (score < 4) return "Good"
    return "Very Good"
  }
}

export const getCategoryColor = (category: string, scoreType: string): string => {
  if (category === "Invalid") {
    return "rgb(128, 128, 128)" // Gray
  }
  if (scoreType === "aadt") {
    switch (category) {
      case "Very Low":
        return "rgb(198, 219, 239)" // Light blue
      case "Low":
        return "rgb(107, 174, 214)" // Medium blue
      case "Medium":
        return "rgb(33, 113, 181)" // Dark blue
      case "High":
        return "rgb(8, 81, 156)" // Very dark blue
      case "Very High":
        return "rgb(8, 48, 107)" // Extremely dark blue
      default:
        return "rgb(107, 174, 214)" // Default blue
    }
  } else if (scoreType === "cost") {
    switch (category) {
      case "Very Low":
        return "rgb(254, 240, 217)" // Very light orange
      case "Low":
        return "rgb(253, 204, 138)" // Light orange
      case "Medium":
        return "rgb(252, 141, 89)" // Medium orange
      case "High":
        return "rgb(227, 74, 51)" // Dark orange
      case "Very High":
        return "rgb(179, 0, 0)" // Very dark red/orange
      default:
        return "rgb(252, 141, 89)" // Default orange
    }
  } else {
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
}

interface ScoreGaugeProps {
  value: number
  scoreType: "condition" | "distress" | "ride" | "aadt" | "cost"
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ value = 0, scoreType }) => {
  const category = getScoreCategory(scoreType, value)
  const color = getCategoryColor(category, scoreType)

  let steps, tickvals, ticktext

  // Define the gauge configuration based on score type
  if (scoreType === "aadt") {
    tickvals = [0, 6420, 13380, 27000, 50000, 60000]
    ticktext = ["0", "6.4K", "13.4K", "27K", "50K", "60K"]
    steps = [
      { range: [0, 6420], color: getCategoryColor("Very Low", "aadt") },
      { range: [6420, 13380], color: getCategoryColor("Low", "aadt") },
      { range: [13380, 27000], color: getCategoryColor("Medium", "aadt") },
      { range: [27000, 50000], color: getCategoryColor("High", "aadt") },
      { range: [50000, 60000], color: getCategoryColor("Very High", "aadt") },
    ]
  } else if (scoreType === "cost") {
    tickvals = [0, 19, 184, 1070, 5000, 6000]
    ticktext = ["0", "19", "184", "1.1K", "5K", "6K"]
    steps = [
      { range: [0, 19], color: getCategoryColor("Very Low", "cost") },
      { range: [19, 184], color: getCategoryColor("Low", "cost") },
      { range: [184, 1070], color: getCategoryColor("Medium", "cost") },
      { range: [1070, 5000], color: getCategoryColor("High", "cost") },
      { range: [5000, 6000], color: getCategoryColor("Very High", "cost") },
    ]
  } else if (scoreType === "ride") {
    tickvals = [0, 0.1, 1, 2, 3, 4, 5]
    ticktext = ["", "0.1", "1", "2", "3", "4", "5"]
    steps = [
      { range: [0, 0.1], color: getCategoryColor("Invalid", scoreType) },
      { range: [0.1, 1], color: getCategoryColor("Very Poor", scoreType) },
      { range: [1, 2], color: getCategoryColor("Poor", scoreType) },
      { range: [2, 3], color: getCategoryColor("Fair", scoreType) },
      { range: [3, 4], color: getCategoryColor("Good", scoreType) },
      { range: [4, 5], color: getCategoryColor("Very Good", scoreType) },
    ]
  } else if (scoreType === "distress") {
    tickvals = [0, 1, 60, 70, 80, 90, 100]
    ticktext = ["", "1", "60", "70", "80", "90", "100"]
    steps = [
      { range: [0, 1], color: getCategoryColor("Invalid", scoreType) },
      { range: [1, 60], color: getCategoryColor("Very Poor", scoreType) },
      { range: [60, 70], color: getCategoryColor("Poor", scoreType) },
      { range: [70, 80], color: getCategoryColor("Fair", scoreType) },
      { range: [80, 90], color: getCategoryColor("Good", scoreType) },
      { range: [90, 100], color: getCategoryColor("Very Good", scoreType) },
    ]
  } else {
    // condition
    tickvals = [0, 1, 35, 50, 70, 90, 100]
    ticktext = ["", "1", "35", "50", "70", "90", "100"]
    steps = [
      { range: [0, 1], color: getCategoryColor("Invalid", scoreType) },
      { range: [1, 35], color: getCategoryColor("Very Poor", scoreType) },
      { range: [35, 50], color: getCategoryColor("Poor", scoreType) },
      { range: [50, 70], color: getCategoryColor("Fair", scoreType) },
      { range: [70, 90], color: getCategoryColor("Good", scoreType) },
      { range: [90, 100], color: getCategoryColor("Very Good", scoreType) },
    ]
  }

  // Create a simple legend for categories
  const categoryLabels =
    scoreType === "aadt" || scoreType === "cost"
      ? ["Very Low", "Low", "Medium", "High", "Very High"]
      : ["Very Poor", "Poor", "Fair", "Good", "Very Good"]

  // Calculate positions for legend items with better spacing
  const legendPositions = [0.02, 0.26, 0.5, 0.74, 0.98]

  // Tooltip state and ref
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLDivElement>(null)

  const handleMouseEnter = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setTooltipPos({
        top: rect.top + window.scrollY,
        left: rect.left + rect.width / 2 + window.scrollX,
      })
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => setShowTooltip(false)

  return (
    <div className="h-full w-full flex flex-col justify-end relative">
      {/* Gauge with legend as annotations */}
      <div style={{ marginBottom: "40px" }}>
        <Plot
          data={[
            {
              type: "indicator",
              mode: "gauge",
              value,
              gauge: {
                axis: {
                  range: [0, tickvals[tickvals.length - 1]],
                  tickmode: "array",
                  tickvals,
                  ticktext,
                  tickfont: { size: 8 },
                  ticklen: 2,
                  tickcolor: "black",
                  tickangle: 0,
                  tickwidth: 1,
                  showticklabels: true,
                  ticks: "outside",
                  showgrid: false,
                  showline: false,
                },
                bar: { color: "rgba(0,0,0,0)", thickness: 0 },
                bgcolor: "white",
                borderwidth: 0,
                steps,
                threshold: {
                  line: { color: "transparent", width: 0 },
                  thickness: 0.5,
                  value: value,
                },
                shape: "angular",
                // @ts-ignore
                angularspan: 180,
                // @ts-ignore
                startangle: 200,
              },
            },
          ]}
          layout={{
            autosize: false,
            width: 220,
            height: 80,
            margin: { t: 12, r: 10, l: 10, b: 5 },
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { size: 8 },
            xaxis: { visible: false, showgrid: false },
            yaxis: { visible: false, showgrid: false },
          }}
          config={{ displayModeBar: false, responsive: false }}
          useResizeHandler={false}
          style={{ width: "220px", height: "60px" }}
        />
      </div>

      {/* Title and tooltip below the gauge */}
      <div className="flex items-center justify-center gap-1 absolute bottom-0 left-0 right-0">
        <span className="font-bold text-sm">
          {scoreType === "aadt"
            ? "AADT"
            : scoreType === "cost"
              ? "Maintenance Cost"
              : scoreType.charAt(0).toUpperCase() + scoreType.slice(1)}
        </span>
        {/* Tooltip hover area */}
        <div ref={btnRef} className="relative" onMouseEnter={handleMouseEnter} onMouseLeave={handleMouseLeave}>
          <div className="text-xs bg-gray-200 rounded-full w-4 h-4 flex items-center justify-center cursor-pointer">
            ?
          </div>
        </div>
        {showTooltip &&
          ReactDOM.createPortal(
            <div
              className="z-50 absolute"
              style={{
                top: tooltipPos.top,
                left: tooltipPos.left,
                transform: "translate(-50%, -100%)", // above the button, centered
              }}
            >
              <ScoreGaugeTooltip scoreType={scoreType} />
            </div>,
            document.body,
          )}
      </div>
    </div>
  )
}

export default ScoreGauge
