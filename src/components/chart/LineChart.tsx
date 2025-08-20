"use client"

import type React from "react"
import { useRef, useState, useEffect } from "react"
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
  type ChartOptions,
  type ChartData,
} from "chart.js"
import { Line } from "react-chartjs-2"
// Fix: Import Chart type directly from chart.js
import type { Chart } from "chart.js"
import { useDimensions } from "@/hooks/useDimensions"

// Register ChartJS components
ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend)

// Add this type declaration for the keys
type SeasonalColorKey = 'SUMMER_EVEN' | 'SUMMER_ODD' | 'WINTER_EVEN' | 'WINTER_ODD';

// Expanded seasonal color palettes
const SEASONAL_COLORS: Record<SeasonalColorKey, string[]> = {
  // Summer colors with alternating pattern
  SUMMER_EVEN: [
    "#e74c3c", // Bright red (primary)
    "#FF5733", // Brighter red
    "#C0392B", // Darker red
    "#FF6B6B", // Light red
    "#FF4500", // Orange red
    "#CD5C5C", // Indian red
    "#B22222", // Firebrick
  ],
  SUMMER_ODD: [
    "#2ecc71", // Emerald green (primary)
    "#27AE60", // Dark green
    "#00FF7F", // Spring green
    "#32CD32", // Lime green
    "#3CB371", // Medium sea green
    "#228B22", // Forest green
    "#90EE90", // Light green
  ],
  WINTER_EVEN: [
    "#3498db", // Royal blue (primary)
    "#2980B9", // Darker blue
    "#00BFFF", // Deep sky blue
    "#1E90FF", // Dodger blue
    "#4682B4", // Steel blue
    "#5F9EA0", // Cadet blue
    "#6495ED", // Cornflower blue
  ],
  WINTER_ODD: [
    "#f39c12", // Orange (primary)
    "#E67E22", // Darker orange
    "#FFA500", // Regular orange
    "#FF8C00", // Dark orange
    "#DAA520", // Goldenrod
    "#FFD700", // Gold
    "#FFAC1C", // Bright orange
  ]
}

// Add back the DISTINCT_COLORS array that was removed
const DISTINCT_COLORS = [
  "#4169E1", // Royal Blue
  "#FF8C00", // Dark Orange
  "#32CD32", // Lime Green
  "#FF6347", // Tomato Red
  "#8A2BE2", // Blue Violet
  "#FFD700", // Gold
  "#00CED1", // Dark Turquoise
  "#FF1493", // Deep Pink
  "#00FF7F", // Spring Green
  "#4682B4", // Steel Blue
  "#9932CC", // Dark Orchid
  "#FF00FF", // Magenta
  "#00BFFF", // Deep Sky Blue
  "#8B008B", // Dark Magenta
]

// Track used colors for color allocation
let usedColors = new Map();

const getColor = (label: string, index: number, chartType?: string) => {
  const lowerLabel = label.toLowerCase()

  // For seasonal charts, use our fixed color scheme
  if (chartType === "seasonal") {
    // Extract any year number from the label (e.g., "Summer 2023" -> 2023)
    const yearMatch = label.match(/\d{2,4}/) // Match 2 or 4 digit years
    const year = yearMatch ? parseInt(yearMatch[0].slice(-2)) : null // Get last 2 digits for consistency
    
    let colorKey = "";
    let colorPalette: string[] = [];
    
    if (year !== null) {
      if (lowerLabel.includes("summer")) {
        colorKey = year % 2 === 0 ? "SUMMER_EVEN" : "SUMMER_ODD";
        colorPalette = SEASONAL_COLORS[colorKey as SeasonalColorKey];
      } else if (lowerLabel.includes("winter")) {
        colorKey = year % 2 === 0 ? "WINTER_EVEN" : "WINTER_ODD";
        colorPalette = SEASONAL_COLORS[colorKey as SeasonalColorKey];
      }
    } else {
      // If we couldn't determine the season+year but it contains these keywords
      if (lowerLabel.includes("summer")) {
        colorKey = "SUMMER_EVEN"; // Default to even year color
        colorPalette = SEASONAL_COLORS[colorKey as SeasonalColorKey];
      } else if (lowerLabel.includes("winter")) {
        colorKey = "WINTER_EVEN"; // Default to even year color
        colorPalette = SEASONAL_COLORS[colorKey as SeasonalColorKey];
      }
    }
    
    if (colorPalette.length > 0) {
      // Get current count for this color key to determine which variant to use
      const count = usedColors.get(colorKey) || 0;
      usedColors.set(colorKey, count + 1);
      
      // Use modulo to avoid index out of bounds
      return colorPalette[count % colorPalette.length];
    }
  }

  // For non-seasonal charts, use the distinct colors array
  return DISTINCT_COLORS[index % DISTINCT_COLORS.length];
}

interface LineChartJSProps {
  labels: number[]
  dataSets: { label: string; data: number[]; color?: string; fill?: boolean }[]
  chartType?: "default" | "seasonal"
  title?: string
  height?: number | string | "dynamic" // Added "dynamic" option
  aspectRatio?: number // Added aspect ratio option
}

const LineChartJS: React.FC<LineChartJSProps> = ({
  labels,
  dataSets,
  chartType,
  title = "Deflection (Mils)",
  height = "dynamic", // Default to dynamic height
  aspectRatio = 2, // Default aspect ratio (width:height = 2:1)
}) => {
  const chartRef = useRef<Chart<"line"> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [dynamicHeight, setDynamicHeight] = useState<number>(400)

  // Move the useEffect inside the component
  useEffect(() => {
    // Reset color tracking when component mounts
    usedColors = new Map();
    
    // Clean up when component unmounts
    return () => {
      usedColors = new Map();
    };
  }, []);

  // Use dimensions hook
  const dimensions = useDimensions(containerRef)

  // Calculate dynamic height based on container width and viewport
  useEffect(() => {
    if (height === "dynamic") {
      // Get viewport height
      const vh = window.innerHeight

      // Calculate height based on container width and aspect ratio
      // but cap it to ensure it doesn't get too tall or too short
      const calculatedHeight = dimensions.width / aspectRatio

      // Ensure height is between 300px and 70% of viewport height
      const minHeight = 300
      const maxHeight = vh * 0.7

      const newHeight = Math.max(minHeight, Math.min(calculatedHeight, maxHeight))
      setDynamicHeight(newHeight)
    } else if (typeof height === "number") {
      setDynamicHeight(height)
    } else if (typeof height === "string" && height.endsWith("px")) {
      setDynamicHeight(Number.parseInt(height.replace("px", "")))
    }
  }, [dimensions.width, height, aspectRatio])

  // Prepare data for Chart.js
  const data: ChartData<"line"> = {
    labels: labels.map((label) => (label != null ? label.toString() : '')),
    datasets: dataSets.map((dataset, index) => ({
      label: dataset.label,
      data: dataset.data,
      borderColor: dataset.color || getColor(dataset.label, index, chartType),
      backgroundColor: dataset.color || getColor(dataset.label, index, chartType),
      fill: dataset.fill || false,
      tension: 0.4, // Adds a slight curve to the lines
      pointRadius: 4,
      pointHoverRadius: 6,
      borderWidth: 2, // Line thickness
      // Only add dashed style if specifically requested
      borderDash: dataset.label.toLowerCase().includes("dashed") ? [5, 5] : undefined,
    })),
  }

  // Chart options
  const options: ChartOptions<"line"> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "top",
        display: true,
        labels: {
          usePointStyle: true, // Use points instead of boxes in legend
          boxWidth: 10,
          padding: 15,
        },
      },
      title: {
        display: !!title,
        text: title,
        font: {
          size: 16,
        },
      },
      tooltip: {
        mode: "index", // Show all datasets at the current x position
        intersect: false, // Don't require hovering directly over the point
        backgroundColor: "rgba(255, 255, 255, 0.9)",
        titleColor: "#333",
        bodyColor: "#333",
        borderColor: "#ddd",
        borderWidth: 1,
        padding: 10,
        boxPadding: 5,
        usePointStyle: true,
        callbacks: {
          label: (context) => `${context.dataset.label}: ${context.parsed.y.toFixed(2)}`,
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
        beginAtZero: true, // Optional: keep y-axis starting at zero
        grid: {
          display: true,
          color: "#f0f0f0",
        },
        ticks: {
          precision: 1,
        },
      },
    },
    interaction: {
      mode: "index",
      intersect: false,
    },
    elements: {
      line: {
        borderJoinStyle: "round" as const,
        borderCapStyle: "round" as const,
      },
      point: {
        radius: 3, // Default point size
        hoverRadius: 5, // Size on hover
        backgroundColor: "white", // White fill
        borderWidth: 2, // Border width
      },
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
    link.setAttribute("download", `line_chart_data.csv`)
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // Check if we have valid data to display
  const hasData = labels.length > 0 && dataSets.some((set) => set.data.some((val) => val !== null && !isNaN(val)))

  return (
    <div className="w-full" ref={containerRef}>
      <div className="flex justify-between items-center mb-2">
        <div>{/* Empty div to maintain flex spacing */}</div>
        {hasData && (
          <button
            onClick={exportToCSV}
            className="bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-md flex items-center gap-1 text-xs transition-colors"
            title="Export as CSV"
          >
            <FaDownload size={12} /> CSV
          </button>
        )}
      </div>

      <div style={{ height: `${dynamicHeight}px` }}>
        <Line ref={chartRef} data={data} options={options} />
      </div>

    </div>
  )
}

export default LineChartJS
