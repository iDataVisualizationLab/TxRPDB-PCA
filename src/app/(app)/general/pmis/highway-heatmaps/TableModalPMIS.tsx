"use client"

import React, { useEffect, useState, useRef, useMemo, useCallback } from "react"
import { route} from "@/config"
import { FaSearch, FaSpinner, FaChartLine, FaMapMarkerAlt, FaSort, FaSortUp, FaSortDown } from "react-icons/fa"
import Papa from "papaparse"
import MiniSegmentChart, { type PMISFeature } from "@/components/chart/MiniSegmentChart"
import { API_GET_PROXY } from "@/lib/api"


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
    if (score <= 100) return "Very Good"
    return "Invalid"
  } else if (scoreType === "aadt") {
    if (score < 1) return "Invalid"
    const max = 371120
    const thresholds = [max * 0.125, max * 0.25, max * 0.375, max * 0.5, max * 0.625, max * 0.75, max * 0.875, max]
    for (let i = 0; i < thresholds.length; i++) {
    if (score <= thresholds[i]) return `Category ${i + 1}`
    }
    return "Invalid"
  } else if (scoreType === "cost") {
    if (score < 0.1) return "Invalid"
    const max = 543313
    const thresholds = [max * 0.125, max * 0.25, max * 0.375, max * 0.5, max * 0.625, max * 0.75, max * 0.875, max]
    for (let i = 0; i < thresholds.length; i++) {
    if (score <= thresholds[i]) return `Category ${i + 1}`
    }
    return "Invalid"
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
  if (category === "Invalid" || category === "No Data") {
    return "rgb(240, 240, 240)"
  }

  if (scoreType === "aadt") {
    const aadtColors = [
    "rgb(140, 190, 220)", "rgb(107, 174, 214)", "rgb(66, 146, 198)", "rgb(33, 113, 181)",
    "rgb(8, 81, 156)", "rgb(8, 69, 148)", "rgb(8, 48, 107)", "rgb(5, 24, 82)",
    ]
    const index = parseInt(category.split(" ")[1]) - 1
    return aadtColors[index] || "#ccc"
  } else if (scoreType === "cost") {
    const costColors = [
    "rgb(230, 220, 240)", "rgb(218, 218, 235)", "rgb(188, 189, 220)", "rgb(158, 154, 200)",
    "rgb(128, 125, 186)", "rgb(106, 81, 163)", "rgb(74, 20, 134)", "rgb(45, 0, 75)",
    ]
    const index = parseInt(category.split(" ")[1]) - 1
    return costColors[index] || "#ccc"
  } else {
    switch (category) {
    case "Very Poor": return "rgb(239, 68, 68)"
    case "Poor": return "rgb(249, 115, 22)"
    case "Fair": return "rgb(234, 179, 8)"
    case "Good": return "rgb(34, 197, 94)"
    case "Very Good": return "rgb(21, 128, 61)"
    case "Invalid": return "rgb(200, 200, 200)"
    default: return "rgb(75, 85, 99)"
    }
  }
}

// This new component will defer rendering of the MiniSegmentChart
const DeferredChartCell: React.FC<{
  segmentData: PMISFeature[]
  metric: string
  getCategory: (scoreType: string, score: number) => string
  getCategoryColor: (category: string, scoreType: string) => string
  color: string
  index: number
}> = ({ segmentData, metric, getCategory, getCategoryColor, color, index }) => {
  const [isReady, setIsReady] = useState(false)

  useEffect(() => {
    // Stagger rendering to prevent blocking the main thread.
    // Each chart will render slightly after the previous one.
    const handle = setTimeout(() => setIsReady(true), index * 2)
    return () => clearTimeout(handle)
  }, [index])

  if (!isReady) {
    return <FaSpinner className="animate-spin mx-auto" size={16} style={{ color }} />
  }

  return (
    <MiniSegmentChart
      data={segmentData}
      metric={metric}
      getCategory={getCategory}
      getCategoryColor={getCategoryColor}
    />
  )
}

// Pre-calculate score data to avoid recalculating during render
interface ScoreData {
  value: number
  category: string
  color: string
}

interface ProcessedFeature {
  highway: string
  county: string
  formattedCounty: string
  scores: { [key: string]: ScoreData }
  interestingness?: number
}

interface TableModalPMISProps {
  title?: string
  containerDimensions?: { width: number; height: number }
  setSelectedHighway?: (hwy: string) => void
  showMapModal?: (rte_nm: string, cnty_nm: string) => void
  addChart?: (chart: { highway: string; county: string; field: string }, scoreValue: number) => void
  activeHeatMapData?: {
    highway: string
    county: string
    scores: { value: string; label: string }[]
    id: string
  }[]
  search?: string
  setSearch?: (search: string) => void
  features?: PMISFeature[]
}

type SortDirection = "asc" | "desc" | null
type SortColumn = "highway" | "county" | "condition" | "distress" | "ride" | "aadt" | "cost" | "interestingness" | null

interface TableRowProps {
  item: ProcessedFeature
  fields: string[]
  isHighwayAvailable: (highway: string) => boolean
  handleMapClick: (highway: string, county: string) => void
  handleChartClick: (highway: string, county: string, field: string) => void
  activeHeatMapData: {
    highway: string
    county: string
    scores: { value: string; label: string }[]
    id: string
  }[]
  getScoreCategory: (scoreType: string, score: number) => string
  getCategoryColor: (category: string, scoreType: string) => string
  segmentData: PMISFeature[]
  rowIndex: number
}

const TableRow: React.FC<TableRowProps> = React.memo(
  ({ item, fields, isHighwayAvailable, handleMapClick, handleChartClick, activeHeatMapData, getScoreCategory, getCategoryColor, segmentData, rowIndex }) => {
    return (
    <tr className="hover:bg-blue-50 border-b border-gray-200">
    {/* Highway */}
    <td className="p-2 border-r border-gray-300 overflow-hidden">
    <span className="text-xs font-medium truncate block">{item.highway}</span>
    </td>

    {/* County */}
    <td className="p-2 border-r border-gray-300 overflow-hidden">
    <span className="text-xs truncate block">{item.formattedCounty}</span>
    </td>

    {/* Map Button */}
    <td className="p-1 border-r border-gray-300 text-center">
    <button
    onClick={() => handleMapClick(item.highway, item.county)}
    className={`p-1 rounded-full transition ${isHighwayAvailable(item.highway) ? "bg-blue-100 hover:bg-blue-200" : "bg-gray-100 cursor-not-allowed opacity-50"}`}
    disabled={!isHighwayAvailable(item.highway)}
    title={isHighwayAvailable(item.highway) ? "View on map" : "Highway not available on map"}
    >
    <FaMapMarkerAlt className={isHighwayAvailable(item.highway) ? "text-blue-600" : "text-gray-400"} size={8} />
    </button>
    </td>

    {/* Chart Columns */}
    {fields.map((field, fieldIndex) => {
    const scoreData = item.scores[field]
    const isActive = activeHeatMapData.some(
    (d) => d.highway === item.highway && d.county === item.county && d.scores.some((s) => s.value === field),
    )
    const hasData = scoreData && scoreData.category !== "No Data"
    const cellIndex = rowIndex * fields.length + fieldIndex

    return (
    <td key={field} className="p-1 text-center relative border-r border-gray-300" style={{ height: '60px' }}>
    <button
    onClick={() => (hasData ? handleChartClick(item.highway, item.county, field) : undefined)}
    className="w-full h-full relative flex items-center justify-center"
    title={hasData ? `${scoreData?.category || "N/A"}: ${scoreData?.value || "N/A"}` : "No data available"}
    disabled={!hasData}
    style={{ minHeight: '56px' }}
    >
    {isActive && <div className="absolute inset-0 border-2 border-black rounded" style={{ zIndex: 10 }} />}
    {hasData ? (
    <div className="w-full h-full overflow-hidden">
      <DeferredChartCell
        segmentData={segmentData}
        metric={field}
        getCategory={getScoreCategory}
        getCategoryColor={getCategoryColor}
        color={scoreData.color}
        index={cellIndex}
      />
    </div>
    ) : (
    <div className="w-full h-full bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Data</div>
    )}
    </button>
    </td>
    )
    })}
    </tr>
    )
  },
)
TableRow.displayName = "TableRow"

// Table body component
interface TableBodyProps {
  visibleRows: ProcessedFeature[]
  fields: string[]
  isHighwayAvailable: (highway: string) => boolean
  handleMapClick: (highway: string, county: string) => void
  handleChartClick: (highway: string, county: string, field: string) => void
  activeHeatMapData: {
    highway: string
    county: string
    scores: { value: string; label: string }[]
    id: string
  }[]
  getScoreCategory: (scoreType: string, score: number) => string
  getCategoryColor: (category: string, scoreType: string) => string
  segmentDataByHighwayCounty: Map<string, PMISFeature[]>
}

const TableBodyComponent: React.FC<TableBodyProps> = React.memo(
  ({
    visibleRows,
    fields,
    isHighwayAvailable,
    handleMapClick,
    handleChartClick,
    activeHeatMapData,
    getScoreCategory,
    getCategoryColor,
    segmentDataByHighwayCounty,
  }) => {
    return (
    <tbody>
    {visibleRows.map((item, index) => (
    <TableRow
    key={`${item.highway}-${item.county}-${index}`}
    item={item}
    fields={fields}
    isHighwayAvailable={isHighwayAvailable}
    handleMapClick={handleMapClick}
    handleChartClick={handleChartClick}
    activeHeatMapData={activeHeatMapData}
    getScoreCategory={getScoreCategory}
    getCategoryColor={getCategoryColor}
    segmentData={
    segmentDataByHighwayCounty.get(`${item.highway}|${item.formattedCounty}`) || []
    }
    rowIndex={index}
    />
    ))}
    </tbody>
    )
  }
)

TableBodyComponent.displayName = "TableBodyComponent"

const TableModalPMIS: React.FC<TableModalPMISProps> = ({
  title = "Highway Data",
  containerDimensions,
  setSelectedHighway = () => {},
  showMapModal = () => {},
  addChart = () => {},
  activeHeatMapData = [],
  search = "",
  setSearch = () => {},
  features = [],
}) => {
  const [loading, setLoading] = useState(true)
  const [availableHighways, setAvailableHighways] = useState<Set<string>>(new Set())
  const [processedData, setProcessedData] = useState<ProcessedFeature[]>([])
  const [sortColumn, setSortColumn] = useState<SortColumn>("interestingness")
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc")
  const [currentPage, setCurrentPage] = useState(1)
  const [itemsPerPage] = useState(50) // Show 50 rows at a time
  const [localSearch, setLocalSearch] = useState(search)
  const [searchTerm, setSearchTerm] = useState(search)
  const isMounted = useRef(true)

  const headerRef = useRef<HTMLTableSectionElement>(null)

  const fields = useMemo(
    () => ["TX_CONDITION_SCORE", "TX_DISTRESS_SCORE", "TX_RIDE_SCORE", "TX_AADT_CURRENT", "TX_MAINTENANCE_COST_AMT"],
    [],
  )



  // Format county name
  const formatCountyName = useCallback((county: string | undefined): string => {
    if (!county) return ""
    const withoutPrefix = county.replace(/^\d+\s*-\s*/, "")
    return withoutPrefix.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase())
  }, [])

  const segmentDataByHighwayCounty = useMemo(() => {
    const map = new Map<string, PMISFeature[]>()
    if (!features || features.length === 0) return map

    features.forEach((feature) => {
    const highway = feature.properties.TX_SIGNED_HIGHWAY_RDBD_ID
    const county = feature.properties.COUNTY
    if (highway && county) {
    const formattedCounty = formatCountyName(county)
    const key = `${highway}|${formattedCounty}`
    if (!map.has(key)) map.set(key, [])
    map.get(key)?.push(feature)
    }
    })

    return map
  }, [features, formatCountyName])

  // Memoize interestingness calculations separately for better performance
  const interestingnessCache = useMemo(() => {
    const cache = new Map<string, number>()

    if (processedData.length === 0) return cache

    processedData.forEach((item) => {
      const key = `${item.highway}|${item.formattedCounty}`
      if (cache.has(key)) return

      const segments = segmentDataByHighwayCounty.get(key) || []
      if (segments.length === 0) {
        cache.set(key, 0)
        return
      }

      const scores: number[] = []
      fields.forEach((field) => {
        segments.forEach((s) => {
          const score = Number(s.properties[field])
          if (!isNaN(score) && score > 0) scores.push(score)
        })
      })

      let interestingness = 0
      if (scores.length > 1) {
        const mean = scores.reduce((a, b) => a + b, 0) / scores.length
        const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / (scores.length - 1)
        const stdDev = Math.sqrt(variance)
        interestingness = stdDev * Math.log10(scores.length + 1)
      } else {
        interestingness = scores.length
      }

      cache.set(key, interestingness)
    })

    return cache
  }, [processedData, segmentDataByHighwayCounty, fields])

  const processedDataWithInterestingness = useMemo(() => {
    return processedData.map((item) => {
      const key = `${item.highway}|${item.formattedCounty}`
      const interestingness = interestingnessCache.get(key) || 0
      return { ...item, interestingness }
    })
  }, [processedData, interestingnessCache])

  // Process features once and store the result
  const processFeatures = useCallback((data: any[]): ProcessedFeature[] => {
    const processed: { [key: string]: ProcessedFeature } = {}

    data.forEach((row) => {
    const highway = row.TX_SIGNED_HIGHWAY_RDBD_ID || ""
    const county = row.COUNTY || ""
    const key = `${highway}|${county}`

    if (!processed[key]) {
    processed[key] = { highway, county, formattedCounty: formatCountyName(county), scores: {} }
    }

    // Pre-calculate all scores
    fields.forEach((field) => {
    const rawValue = row[field]
    if (rawValue !== undefined && rawValue !== null && rawValue !== "") {
    const value = Number(rawValue)
    if (isNaN(value)) {
    processed[key].scores[field] = { value: 0, category: "No Data", color: "rgb(240, 240, 240)" }
    return
    }

    let scoreType = ""
    switch (field) {
    case "TX_CONDITION_SCORE": scoreType = "condition"; break
    case "TX_DISTRESS_SCORE": scoreType = "distress"; break
    case "TX_RIDE_SCORE": scoreType = "ride"; break
    case "TX_AADT_CURRENT": scoreType = "aadt"; break
    case "TX_MAINTENANCE_COST_AMT": scoreType = "cost"; break
    }

    const category = getScoreCategory(scoreType, value)
    const color = getCategoryColor(category, scoreType)
    processed[key].scores[field] = { value, category, color }
    } else {
    processed[key].scores[field] = { value: 0, category: "No Data", color: "rgb(240, 240, 240)" }
    }
    })
    })

    return Object.values(processed)
  }, [fields, formatCountyName])

  // Fetch CSV data
  useEffect(() => {
    const fetchCSVData = async () => {
    try {
    const response = await fetch(`${route}/general/hw_cnty_avg.csv`)
    const csvText = await response.text()

    Papa.parse(csvText, {
    header: true,
    dynamicTyping: true,
    skipEmptyLines: true,
    complete: (results) => {
    const validData = results.data.filter((row: any) => row.COUNTY && row.TX_SIGNED_HIGHWAY_RDBD_ID)
    const processed = processFeatures(validData)

    if (isMounted.current) {
    setProcessedData(processed)
    setLoading(false)
    }
    },
    error: (error: any) => {
    console.error("Error parsing CSV:", error)
    if (isMounted.current) setLoading(false)
    },
    })
    } catch (error: any) {
    console.error("Error fetching CSV data:", error)
    if (isMounted.current) setLoading(false)
    }
    }

    fetchCSVData()
  }, [processFeatures])

  // Fetch highway availability data
  useEffect(() => {
    const fetchGeoJSONData = async () => {
    try {
    const response = await fetch(`${API_GET_PROXY}/general/pmis_lines_latest.geojson`)
    const data = await response.json()

    const highways = new Set<string>()
    data.features.forEach((feature: any) => {
    if (feature.properties && feature.properties.TX_SIGNED_HIGHWAY_RDBD_ID) {
    highways.add(feature.properties.TX_SIGNED_HIGHWAY_RDBD_ID)
    }
    })

    if (isMounted.current) setAvailableHighways(highways)
    } catch (error) {
    console.error("Error fetching GeoJSON data:", error)
    }
    }

    fetchGeoJSONData()
  }, [])

  const reformatHighwayName = useCallback((highway: string): string => {
    const lastSpaceIndex = highway.lastIndexOf(" ")
    if (lastSpaceIndex !== -1) {
    return highway.substring(0, lastSpaceIndex) + "-" + highway.substring(lastSpaceIndex + 1) + "G"
    }
    return highway + "G"
  }, [])

  const isHighwayAvailable = useCallback((highway: string): boolean => {
    const reformattedHighway = reformatHighwayName(highway)
    return availableHighways.has(reformattedHighway)
  }, [availableHighways, reformatHighwayName])

  const handleMapClick = useCallback((highway: string, county: string) => {
    setSelectedHighway(highway)
    showMapModal(highway, county)
  }, [setSelectedHighway, showMapModal])

  const handleChartClick = useCallback((highway: string, county: string, field: string) => {
    const feature = processedDataWithInterestingness.find((f) => f.highway === highway && f.county === county)
    const scoreValue = feature?.scores[field]?.value || 0
    addChart({ highway, county, field }, scoreValue)
  }, [processedDataWithInterestingness, addChart])

  // Sync external search prop with local state
  useEffect(() => {
    setLocalSearch(search)
    setSearchTerm(search)
  }, [search])

  const handleSearch = () => {
    setSearchTerm(localSearch)
    setSearch(localSearch) // Update parent
  }

  // Optimized filtering
  const filteredData = useMemo(() => {
    if (searchTerm === "") return processedDataWithInterestingness

    const lowercasedSearchTerm = searchTerm.toLowerCase()
    return processedDataWithInterestingness.filter(item => {
      const searchText = `${item.highway.toLowerCase()} ${item.formattedCounty.toLowerCase()} ${item.county.toLowerCase()}`
      return searchText.includes(lowercasedSearchTerm)
    })
  }, [processedDataWithInterestingness, searchTerm])

  const handleSort = useCallback((column: SortColumn) => {
    if (sortColumn === column) {
    if (sortDirection === "asc") setSortDirection("desc")
    else if (sortDirection === "desc") { setSortDirection(null); setSortColumn(null) }
    } else {
    setSortColumn(column); setSortDirection("asc")
    }
  }, [sortColumn, sortDirection])

  const getSortIcon = useCallback((column: SortColumn) => {
    if (sortColumn !== column) return <FaSort className="text-gray-400" />
    if (sortDirection === "asc") return <FaSortUp className="text-blue-600" />
    if (sortDirection === "desc") return <FaSortDown className="text-blue-600" />
    return <FaSort className="text-gray-400" />
  }, [sortColumn, sortDirection])

  const sortedData = useMemo(() => {
    if (!sortColumn || !sortDirection) return filteredData

    return [...filteredData].sort((a, b) => {
    let comparison = 0

    if (sortColumn === "highway") {
    comparison = a.highway.localeCompare(b.highway)
    } else if (sortColumn === "county") {
    comparison = a.formattedCounty.localeCompare(b.formattedCounty)
    } else if (sortColumn === "interestingness") {
    const aValue = a.interestingness || 0
    const bValue = b.interestingness || 0
    comparison = aValue - bValue
    } else {
    let fieldName = ""
    switch (sortColumn) {
    case "condition": fieldName = "TX_CONDITION_SCORE"; break
    case "distress": fieldName = "TX_DISTRESS_SCORE"; break
    case "ride": fieldName = "TX_RIDE_SCORE"; break
    case "aadt": fieldName = "TX_AADT_CURRENT"; break
    case "cost": fieldName = "TX_MAINTENANCE_COST_AMT"; break
    }

    const aCategory = a.scores[fieldName]?.category
    const bCategory = b.scores[fieldName]?.category
    const aValue = (aCategory === "No Data" || aCategory === "Invalid" || a.scores[fieldName]?.value == null)
    ? (sortDirection === "asc" ? Infinity : -Infinity)
    : a.scores[fieldName]?.value
    const bValue = (bCategory === "No Data" || bCategory === "Invalid" || b.scores[fieldName]?.value == null)
    ? (sortDirection === "asc" ? Infinity : -Infinity)
    : b.scores[fieldName]?.value

    comparison = (aValue as number) - (bValue as number)
    if (comparison === 0) comparison = a.formattedCounty.localeCompare(b.formattedCounty)
    }

    return sortDirection === "asc" ? comparison : -comparison
    })
  }, [filteredData, sortColumn, sortDirection])

  // Pagination
  const totalPages = Math.ceil(sortedData.length / itemsPerPage)
  const visibleRows = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    const endIndex = startIndex + itemsPerPage
    return sortedData.slice(startIndex, endIndex)
  }, [sortedData, currentPage, itemsPerPage])

  // Reset to page 1 when search or sort changes
  useEffect(() => {
    setCurrentPage(1)
  }, [searchTerm, sortColumn, sortDirection])

  return (
    <div className="h-full flex flex-col overflow-hidden rounded-lg shadow border bg-white">
    <div className="px-5 py-3 bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] text-white font-bold flex-shrink-0">
    {title}
    </div>

    {/* Search */}
    <div className="p-4 border-b flex-shrink-0" data-table-search>
    <div className="relative flex items-center">
    <FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
    <input
    className="pl-9 pr-3 py-2 w-full border rounded-l-md focus:outline-none"
    placeholder="Search by highway or county..."
    value={localSearch}
    onChange={(e) => setLocalSearch(e.target.value)}
    onKeyDown={(e) => {
        if (e.key === "Enter") {
        handleSearch()
        }
    }}
    disabled={loading}
    />
    {localSearch && (
        <button
        onClick={() => {
            setLocalSearch("")
            setSearchTerm("")
            setSearch("")
        }}
        className="absolute right-[90px] top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
        >
        &#x2715; {/* X icon */}
        </button>
    )}
    <button
    onClick={handleSearch}
    className="px-4 py-2 bg-blue-500 text-white rounded-r-md hover:bg-blue-600 focus:outline-none disabled:bg-gray-400"
    disabled={loading}
    >
    Search
    </button>
    </div>
    </div>

    {/* Body container (below search) */}
    <div className="flex-grow overflow-hidden bg-white min-h-0">
    <div className="h-full flex flex-col">
    {sortedData.length === 0 ? (
    <div className="flex items-center justify-center h-32">
    {loading ? <FaSpinner className="animate-spin mx-auto" /> : <div className="text-gray-500">No records found</div>}
    </div>
    ) : (
    <>
    <div className="flex-grow overflow-auto min-h-0">
    <div className="overflow-x-auto">
    <table className="w-full border-collapse bg-white" style={{ tableLayout: 'fixed', minWidth: '800px' }}>
    {/* Table Header */}
    <thead ref={headerRef} className="sticky top-0 bg-gray-100 border-b-2 border-gray-300 z-10">
    <tr className="text-gray-700 text-sm font-semibold">
    <th className="p-2 text-left cursor-pointer hover:bg-gray-200 border-r border-gray-300" style={{ width: '120px' }} onClick={() => handleSort("highway")}>
    <div className="flex items-center gap-1 text-xs">Highway {getSortIcon("highway")}</div>
    </th>
    <th className="p-2 text-left cursor-pointer hover:bg-gray-200 border-r border-gray-300" style={{ width: '100px' }} onClick={() => handleSort("county")}>
    <div className="flex items-center gap-1 text-xs">County {getSortIcon("county")}</div>
    </th>
    <th className="p-1 text-center border-r border-gray-300" style={{ width: '40px' }}>
    <div className="text-xs">Map</div>
    </th>
    <th className="p-2 text-center cursor-pointer hover:bg-gray-200 border-r border-gray-300" style={{ width: '120px' }} onClick={() => handleSort("condition")}>
    <div className="flex items-center justify-center gap-1 text-xs">Condition {getSortIcon("condition")}</div>
    </th>
    <th className="p-2 text-center cursor-pointer hover:bg-gray-200 border-r border-gray-300" style={{ width: '120px' }} onClick={() => handleSort("distress")}>
    <div className="flex items-center justify-center gap-1 text-xs">Distress {getSortIcon("distress")}</div>
    </th>
    <th className="p-2 text-center cursor-pointer hover:bg-gray-200 border-r border-gray-300" style={{ width: '120px' }} onClick={() => handleSort("ride")}>
    <div className="flex items-center justify-center gap-1 text-xs">Ride {getSortIcon("ride")}</div>
    </th>
    <th className="p-2 text-center cursor-pointer hover:bg-gray-200 border-r border-gray-300" style={{ width: '120px' }} onClick={() => handleSort("aadt")}>
    <div className="flex items-center justify-center gap-1 text-xs">AADT {getSortIcon("aadt")}</div>
    </th>
    <th className="p-2 text-center cursor-pointer hover:bg-gray-200" style={{ width: '120px' }} onClick={() => handleSort("cost")}>
    <div className="flex items-center justify-center gap-1 text-xs">Cost {getSortIcon("cost")}</div>
    </th>
    </tr>
    </thead>

    {/* Table Body */}
    <TableBodyComponent
    visibleRows={visibleRows}
    fields={fields}
    isHighwayAvailable={isHighwayAvailable}
    handleMapClick={handleMapClick}
    handleChartClick={handleChartClick}
    activeHeatMapData={activeHeatMapData}
    getScoreCategory={getScoreCategory}
    getCategoryColor={getCategoryColor}
    segmentDataByHighwayCounty={segmentDataByHighwayCounty}
    />
    </table>
    </div>

    {/* Pagination */}
    {totalPages > 1 && (
    <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50 flex-shrink-0">
    <div className="text-sm text-gray-700">
    Showing {((currentPage - 1) * itemsPerPage) + 1} to {Math.min(currentPage * itemsPerPage, sortedData.length)} of {sortedData.length} results
    </div>
    <div className="flex items-center gap-2">
    <button
    onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
    disabled={currentPage === 1}
    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
    >
    Previous
    </button>
    <span className="text-sm text-gray-700">
    Page {currentPage} of {totalPages}
    </span>
    <button
    onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
    disabled={currentPage === totalPages}
    className="px-3 py-1 text-sm border rounded hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed"
    >
    Next
    </button>
    </div>
    </div>
    )}
    </div>
    </>
    )}
    </div>
    </div>
    </div>
  )
}

export default TableModalPMIS