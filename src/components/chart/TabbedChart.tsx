"use client"

import type React from "react"
import { useState } from "react"
import LineChartJS from "./LineChart"
// TODO: Re-enable Ridge Plot in the near future
// import RidgePlotJS from "./RidgePlot"

interface TabbedChartJSProps {
  years: number[]
  dataSets: { label: string; data: number[] }[]
  chartType?: "default" | "seasonal"
}

const TabbedChartJS: React.FC<TabbedChartJSProps> = ({ years, dataSets, chartType }) => {
  // Keep state as-is for easy restoration later
  const [tab, setTab] = useState<"line" | "ridge">("line")

  return (
    <div>
      <div className="flex border-b mb-2">
        <button
          className={`px-4 py-2 ${tab === "line" ? "border-b-2 border-blue-600" : ""}`}
          onClick={() => setTab("line")}
        >
          Line Chart
        </button>
        {/* TODO: Re-enable Ridge Plot tab in the near future
        <button
          className={`px-4 py-2 ${tab === "ridge" ? "border-b-2 border-blue-600" : ""}`}
          onClick={() => setTab("ridge")}
        >
          Ridge Plot
        </button>
        */}
      </div>
      
      {/* Always render Line Chart for now */}
      <LineChartJS
        labels={years}
        dataSets={dataSets.map((ds) => ({ ...ds, fill: false }))}
        chartType={chartType}
        title=""
        height={500} // Increase line chart height
      />
      
      {/* TODO: Re-enable Ridge Plot in the near future
      {tab === "ridge" && (
        <RidgePlotJS labels={years} dataSets={dataSets} title="" height={500} />
      )}
      */}
    </div>
  )
}

export default TabbedChartJS
