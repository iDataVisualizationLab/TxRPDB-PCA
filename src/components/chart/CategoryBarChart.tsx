"use client"

import type React from "react"
import { useEffect, useState, useRef } from "react"
import Plot from "react-plotly.js"
import ScoreGaugeTooltip from "@/components/ScoreGaugeTooltip"
import ReactDOM from "react-dom"

interface CategoryBarChartProps {
  value: number
  dataType: "cost" | "aadt"
  allValues: number[]
}

interface CategoryThresholds {
  veryLow: number
  low: number
  mediumLow: number
  medium: number
  mediumHigh: number
  high: number
  veryHigh: number
  extreme: number
}

const CategoryBarChart: React.FC<CategoryBarChartProps> = ({ value, dataType, allValues }) => {
  const [thresholds, setThresholds] = useState<CategoryThresholds>({
    veryLow: 0,
    low: 0,
    mediumLow: 0,
    medium: 0,
    mediumHigh: 0,
    high: 0,
    veryHigh: 0,
    extreme: 0,
  })

  // Tooltip state and ref
  const [showTooltip, setShowTooltip] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const btnRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const min = 0
    const max = dataType === "aadt" ? 371120 : 543313

    const calculatedThresholds = {
      veryLow: min + (max - min) * 0.125,
      low: min + (max - min) * 0.25,
      mediumLow: min + (max - min) * 0.375,
      medium: min + (max - min) * 0.5,
      mediumHigh: min + (max - min) * 0.625,
      high: min + (max - min) * 0.75,
      veryHigh: min + (max - min) * 0.875,
      extreme: max,
    }

    setThresholds(calculatedThresholds)
  }, [dataType])

  // Format values for hover text only
  const formatValueForHover = (val: number): string => {
    if (dataType === "cost") {
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency: "USD",
        maximumFractionDigits: 0,
      }).format(val)
    } else {
      return new Intl.NumberFormat("en-US").format(val)
    }
  }

  // Calculate bar heights to represent the actual min/max of each bin
  const barValues = [
    thresholds.veryLow,
    thresholds.low,
    thresholds.mediumLow,
    thresholds.medium,
    thresholds.mediumHigh,
    thresholds.high,
    thresholds.veryHigh,
    thresholds.extreme,
  ]

  const getCategoryColors = (): string[] => {
    return dataType === "aadt"
      ? [
          "rgb(140, 190, 220)", // More saturated but still lighter than category 2
          "rgb(107, 174, 214)",
          "rgb(66, 146, 198)",
          "rgb(33, 113, 181)",
          "rgb(8, 81, 156)",
          "rgb(8, 69, 148)",
          "rgb(8, 48, 107)",
          "rgb(5, 24, 82)",
        ]
      : [
          // "rgb(254, 229, 217)",
          // "rgb(253, 204, 138)",
          // "rgb(252, 169, 118)",
          // "rgb(252, 141, 89)",
          // "rgb(239, 101, 72)",
          // "rgb(227, 74, 51)",
          // "rgb(179, 0, 0)",
          // "rgb(127, 0, 0)",
          "rgb(230, 220, 240)", // More saturated but still lighter than category 2
          "rgb(218, 218, 235)",
          "rgb(188, 189, 220)",
          "rgb(158, 154, 200)",
          "rgb(128, 125, 186)",
          "rgb(106, 81, 163)",
          "rgb(74, 20, 134)",
          "rgb(45, 0, 75)",     // darkest purple
        ]
  }

  // Show range bounds for each bin
  const rangeLabels = [
    [0, thresholds.veryLow],
    [thresholds.veryLow, thresholds.low],
    [thresholds.low, thresholds.mediumLow],
    [thresholds.mediumLow, thresholds.medium],
    [thresholds.medium, thresholds.mediumHigh],
    [thresholds.mediumHigh, thresholds.high],
    [thresholds.high, thresholds.veryHigh],
    [thresholds.veryHigh, thresholds.extreme],
  ]

  const textLabels = rangeLabels.map(([, max]) => {
    const format = (n: number) =>
      n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${Math.round(n)}`
    return format(max)
  })

  // Simplified category labels for x-axis (show min values of each bin)
  const xLabels = rangeLabels.map(([min]) => {
    const format = (n: number) =>
      n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${Math.round(n)}`
    return format(min)
  })

  const segmentWidths = barValues.map((val, i) => (i === 0 ? val : val - barValues[i - 1]))
  const basePositions = [0, ...barValues.slice(0, -1)]

  const handleMouseEnter = () => {
    if (btnRef.current) {
      const rect = btnRef.current.getBoundingClientRect()
      setTooltipPos({
        top: rect.top + window.scrollY, // top of the button
        left: rect.left + rect.width / 2 + window.scrollX,
      })
      setShowTooltip(true)
    }
  }

  const handleMouseLeave = () => setShowTooltip(false)

  return (
    <div className="h-full w-full flex flex-col justify-end relative">
      <div style={{ marginBottom: "60px" }}>
        <Plot
          data={segmentWidths.map((width, i) => ({
            type: "bar",
            orientation: "h",
            y: [""],
            x: [width],
            base: basePositions[i],
            marker: {
              color: getCategoryColors()[i],
            },
            hoverinfo: "x+text",
            textposition: "inside",
          }))}
          layout={{
            autosize: false,
            width: 250,
            height: 70, // Further reduced height
            margin: { t: 10, r: 10, l: 10, b: 30 }, // Adjusted margins
            paper_bgcolor: "rgba(0,0,0,0)",
            plot_bgcolor: "rgba(0,0,0,0)",
            font: { size: 10 },
            xaxis: {
              showgrid: false,
              zeroline: false,
              tickfont: { size: 8 },
              showticklabels: true,
              tickvals: [...basePositions, thresholds.extreme],
              ticktext: [...xLabels, textLabels[textLabels.length - 1]],
              tickangle: 270,
            },
            yaxis: {
              showticklabels: false,
              showgrid: false,
              zeroline: false,
            },
            showlegend: false,
            barmode: "stack",
          }}
          config={{ displayModeBar: false, responsive: false }}
          useResizeHandler={false}
          style={{ width: "250px", height: "50px" }}
        />
      </div>

      {/* Title and tooltip below the chart */}
      <div className="flex items-center justify-center gap-2 absolute bottom-0 left-0 right-0">
        <span className="font-bold text-base">
          {dataType === "aadt"
            ? "AADT"
            : dataType === "cost"
              ? "Maintenance Cost"
              : (dataType as string).charAt(0).toUpperCase() + (dataType as string).slice(1)}
        </span>
        {/* Tooltip hover area */}
        <div
          ref={btnRef}
          className="relative"
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className="text-xs bg-gray-200 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer">
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
              <ScoreGaugeTooltip
                scoreType={dataType}
                thresholds={[
                  thresholds.veryLow,
                  thresholds.low,
                  thresholds.mediumLow,
                  thresholds.medium,
                  thresholds.mediumHigh,
                  thresholds.high,
                  thresholds.veryHigh,
                ]}
              />
            </div>,
            document.body
          )}
      </div>
    </div>
  )
}

export default CategoryBarChart
