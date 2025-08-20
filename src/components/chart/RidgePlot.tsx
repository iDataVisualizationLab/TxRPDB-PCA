"use client"

import type React from "react"
import { useRef } from "react"
import { FaDownload } from "react-icons/fa"
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
  type ChartOptions,
  type ChartData,
} from "chart.js"
import type { Chart } from "chart.js"
import { Line } from "react-chartjs-2"

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend, Filler)

interface RidgePlotJSProps {
  labels: number[]
  dataSets: { label: string; data: number[]; color?: string }[]
  title?: string
  height?: number
}

// Deflection-based color mapping
const getDeflectionColor = (value: number) => {
  const normalizedValue = Math.min(Math.max(value, 0), 8) / 8

  if (normalizedValue < 0.25) {
    return "rgba(46, 204, 113, 0.7)" // Green
  } else if (normalizedValue < 0.5) {
    return "rgba(241, 196, 15, 0.7)" // Yellow
  } else if (normalizedValue < 0.75) {
    return "rgba(230, 126, 34, 0.7)" // Orange
  } else {
    return "rgba(231, 76, 60, 0.7)" // Red
  }
}

const RidgePlotJS: React.FC<RidgePlotJSProps> = ({ labels, dataSets, title = "Deflection (Mils)", height = 400 }) => {
  // Fix the ref type to match what react-chartjs-2 expects
  const chartRef = useRef<Chart<"line"> | null>(null)

  // Create a stacked area chart that approximates a ridge plot
  const data: ChartData<"line"> = {
    labels: labels.map((label) => label.toString()),
    datasets: dataSets.map((dataset, index) => {
      // Calculate max value for color
      const maxValue = Math.max(...dataset.data.filter((val) => !isNaN(val) && val !== null))
      const baseColor = dataset.color || getDeflectionColor(maxValue)

      // Calculate vertical offset for stacking
      const offset = dataSets.length - index - 1

      return {
        label: dataset.label,
        data: dataset.data.map((val) => val + offset * 0.5), // Add offset to create stacking effect
        borderColor: baseColor.replace(/[^,]+(?=\))/, "1"), // Solid line
        backgroundColor: baseColor,
        fill: true,
        tension: 0.4,
        pointRadius: 0, // Hide points for smoother look
        pointHoverRadius: 5, // Show on hover
        borderWidth: 2,
        // Custom dataset options (using meta to avoid type errors)
        // @ts-ignore - Adding custom properties
        offset: offset,
        // @ts-ignore - Adding custom properties
        originalData: dataset.data, // Store original data for tooltips
      }
    }),
  }

  // Chart options
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        labels: {
          boxWidth: 15,
          padding: 30,
        },
      },
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
          weight: "bold",
        },
        padding: {
          top: 10,
          bottom: 20,
        },
      },
      tooltip: {
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        titleColor: "#333",
        bodyColor: "#333",
        borderColor: "#ddd",
        borderWidth: 1,
        padding: 10,
        callbacks: {
          // Show original values in tooltip, not the offset ones
          label: (context) => {
            // Access custom dataset property safely
            const dataset = context.dataset as any
            const originalData = dataset.originalData
            const originalValue = originalData ? originalData[context.dataIndex] : context.parsed.y
            return `${context.dataset.label}: ${originalValue.toFixed(2)} mils`
          },
        },
      },
    },
    scales: {
      x: {
        title: {
          display: true,
          text: "DMI (ft)",
          font: {
            weight: "bold",
          },
        },
        grid: {
          display: true,
          color: "#f0f0f0",
        },
      },
      y: {
        title: {
          display: true,
          text: "Deflection (Mils)",
          font: {
            weight: "bold",
          },
        },
        grid: {
          display: true,
          color: "#f0f0f0",
        },
        // Don't show exact values on y-axis since they're offset
        ticks: {
          callback: function (value) {
            // Access chart safely
            const chart = this.chart
            const datasets = chart.data.datasets

            // If this is a dataset offset tick, don't show it
            for (let i = 0; i < datasets.length; i++) {
              // Access custom dataset property safely
              const dataset = datasets[i] as any
              const offset = dataset.offset
              if (offset && Math.abs(Number(value) - offset * 0.5) < 0.1) {
                return ""
              }
            }

            // Only show integer values
            if (Number.isInteger(Number(value))) {
              return value
            }
            return ""
          },
        },
      },
    },
    interaction: {
      mode: "nearest",
      axis: "x",
      intersect: false,
    },
  }

  // Export to CSV function
  const exportToCSV = () => {
    const headerRow = ["DMI", ...dataSets.map((set) => set.label)]
    const dataRows = labels.map((label, i) => {
      const row = [label.toString()]
      dataSets.forEach((set) => {
        const value = i < set.data.length ? set.data[i] : ""
        row.push(typeof value === "number" ? value.toFixed(2) : "")
      })
      return row
    })

    const csvContent = [headerRow.join(","), ...dataRows.map((row) => row.join(","))].join("\n")
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.setAttribute("href", url)
    link.setAttribute("download", `${title.replace(/\s+/g, "_").toLowerCase()}.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const hasData =
    labels.length > 0 &&
    dataSets.some((set) => set.data && set.data.length > 0 && set.data.some((val) => val !== null && !isNaN(val)))

  return (
    <div className="w-full max-w-[1200px] mx-auto">
      <div className="relative" style={{ height: `${height}px` }}>
        {hasData && (
          <button
            onClick={exportToCSV}
            className="absolute top-0 right-2 z-10 bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-md flex items-center gap-1 text-xs transition-colors"
            title="Export as CSV"
          >
            <FaDownload size={12} /> CSV
          </button>
        )}
        <Line ref={chartRef} data={data} options={options} />
      </div>
    </div>
  )
}

export default RidgePlotJS
