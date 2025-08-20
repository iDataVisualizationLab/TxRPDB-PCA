import type React from "react"
import { getCategoryColor } from "@/components/chart/ScoreGauge"

interface ScoreGaugeTooltipProps {
  scoreType: "condition" | "distress" | "ride" | "aadt" | "cost"
  thresholds?: number[]
}

const ScoreGaugeTooltip: React.FC<ScoreGaugeTooltipProps> = ({ scoreType, thresholds }) => {
  const categories =
    scoreType === "aadt" || scoreType === "cost"
      ? Array.from({ length: 8 }, (_, i) => `Category ${i + 1}`)
      : ["Very Poor", "Poor", "Fair", "Good", "Very Good"]

  const getColorScale = (type: string) => {
    if (type === "aadt") {
      return [
        "rgb(158, 202, 225)",
        "rgb(107, 174, 214)",
        "rgb(66, 146, 198)",
        "rgb(33, 113, 181)",
        "rgb(8, 81, 156)",
        "rgb(8, 69, 148)",
        "rgb(8, 48, 107)",
        "rgb(5, 24, 82)",
      ]
    } else if (type === "cost") {
      return [
        "rgb(254, 229, 217)",
        "rgb(253, 204, 138)",
        "rgb(252, 169, 118)",
        "rgb(252, 141, 89)",
        "rgb(239, 101, 72)",
        "rgb(227, 74, 51)",
        "rgb(179, 0, 0)",
        "rgb(127, 0, 0)",
      ]
    }
    return categories.map((cat) => getCategoryColor(cat, type))
  }

  const colors =
    scoreType === "aadt" || scoreType === "cost"
      ? getColorScale(scoreType)
      : categories.map((cat) => getCategoryColor(cat, scoreType))

  const headers =
    scoreType === "aadt"
      ? ["AADT Range", "Category"]
      : scoreType === "cost"
        ? ["Cost Range", "Category"]
        : ["Score Range", "Category"]

  const format = (n: number) =>
    n >= 1_000_000 ? `${Math.round(n / 1_000_000)}M` : n >= 1_000 ? `${Math.round(n / 1_000)}K` : `${Math.round(n)}`

  const defaultMax = scoreType === "aadt" ? 371120 : 543313
  const fullThresholds = thresholds && thresholds.length >= 7
    ? thresholds
    : Array.from({ length: 7 }, (_, i) => (defaultMax * (i + 1)) / 8)

  const ranges =
    scoreType === "aadt" || scoreType === "cost"
      ? [
          `0 – ${format(fullThresholds[0])}`,
          `${format(fullThresholds[0])} – ${format(fullThresholds[1])}`,
          `${format(fullThresholds[1])} – ${format(fullThresholds[2])}`,
          `${format(fullThresholds[2])} – ${format(fullThresholds[3])}`,
          `${format(fullThresholds[3])} – ${format(fullThresholds[4])}`,
          `${format(fullThresholds[4])} – ${format(fullThresholds[5])}`,
          `${format(fullThresholds[5])} – ${format(fullThresholds[6])}`,
          `${format(fullThresholds[6])} – ${format(defaultMax)}`,
        ]
      : {
          condition: ["1–34", "35–49", "50–69", "70–89", "90–100"],
          distress: ["1–59", "60–69", "70–79", "80–89", "90–100"],
          ride: ["0.1.0–0.9", "1.0–1.9", "2.0–2.9", "3.0–3.9", "4.0–5.0"],
        }[scoreType] || []

  // Function to determine if a color is dark and should use white text
  const getTextColor = (bgColor: string): string => {
    // Extract RGB values from the color string
    const rgbMatch = bgColor.match(/rgb\((\d+),\s*(\d+),\s*(\d+)\)/)
    if (!rgbMatch) return "black"

    const r = Number.parseInt(rgbMatch[1], 10)
    const g = Number.parseInt(rgbMatch[2], 10)
    const b = Number.parseInt(rgbMatch[3], 10)

    // Calculate perceived brightness (using YIQ formula)
    const brightness = (r * 299 + g * 587 + b * 114) / 1000

    // Return white for dark backgrounds, black for light backgrounds
    return brightness < 128 ? "white" : "black"
  }

  const padded = (arr: any[], fill: any) => arr.concat(Array(8 - arr.length).fill(fill)).slice(0, 8)

  const finalCategories = padded(categories, "")
  const finalColors = padded(colors, "rgb(255,255,255)")
  const finalRanges = padded(ranges, "")

  return (
    <div className="bg-white border rounded shadow-md p-2 text-sm w-60">
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-100">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-1 py-1 border text-left">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {finalCategories.map((cat, i) => {
            if (!cat || !finalRanges[i]) return null; // Skip empty rows
            const bgColor = finalColors[i]
            const textColor = getTextColor(bgColor)
            return (
              <tr key={i} style={{ backgroundColor: bgColor, color: textColor }}>
                <td className="px-1 py-1 border">{finalRanges[i]}</td>
                <td className="px-1 py-1 border">{cat}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

export default ScoreGaugeTooltip
