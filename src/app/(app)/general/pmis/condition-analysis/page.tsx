"use client"

import type React from "react"
import { useEffect, useState, useMemo, useCallback } from "react"
import Papa from "papaparse"
import { routePublic } from "@/config"
import dynamic from "next/dynamic"
import { group, sum } from "d3-array"
import { debounce } from "lodash"
import { components } from "react-select"
import { useGlobalLoading } from "@/context/GlobalLoadingContext"
import PMISMapModal from "./PMISMapModal"
import MapModal from "../highway-heatmaps/MapModal"
import { fetchProxy } from "@/lib/api";

// Dynamically import Plotly and react-select
const Plot = dynamic(() => import("react-plotly.js"), { ssr: false })
const Select = dynamic(() => import("react-select"), { ssr: false })

// Component with immediate feedback
const Option = (props: any) => {
  const handleSelect = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    props.selectOption(props.data)
  }

  return (
    <components.Option {...props}>
      <div className="flex items-center gap-2 px-2 py-1">
        <div className="relative inline-block">
          <input
            type="checkbox"
            checked={props.isSelected}
            onChange={() => null}
            onClick={handleSelect}
            className={`w-4 h-4 border border-gray-300 rounded cursor-pointer
              ${props.isSelected ? "bg-blue-600 border-blue-600" : "bg-white"}
              hover:border-blue-500 focus:outline-none focus:ring-2 
              focus:ring-blue-500 focus:ring-offset-0 appearance-none`}
          />
          <svg
            className={`absolute top-0 left-0 w-4 h-4 pointer-events-none text-white
              ${props.isSelected ? "block" : "hidden"}`}
            viewBox="0 0 16 16"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M4 8l2 2 6-6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </div>
        <span className="text-sm text-gray-700 select-none cursor-pointer">{props.label}</span>
      </div>
    </components.Option>
  )
}

const MenuList = ({ children, ...props }: any) => {
  const allSelected = props.getValue().length === props.options.length

  const toggleAll = (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (allSelected) {
      props.clearValue()
    } else {
      props.setValue(props.options)
    }
  }

  return (
    <components.MenuList {...props}>
      <div className="sticky top-0 bg-white border-b border-gray-200">
        <div className="flex items-center gap-2 px-2 py-1">
          <div className="relative inline-block">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => null}
              onClick={toggleAll}
              className={`w-4 h-4 border border-gray-300 rounded cursor-pointer
                ${allSelected ? "bg-blue-600 border-blue-600" : "bg-white"}
                hover:border-blue-500 focus:outline-none focus:ring-2 
                focus:ring-blue-500 focus:ring-offset-0 appearance-none`}
            />
            <svg
              className={`absolute top-0 left-0 w-4 h-4 pointer-events-none text-white
                ${allSelected ? "visible" : "invisible"}`}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 8l2 2 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <span className="text-sm text-gray-700 select-none cursor-pointer" onClick={toggleAll}>
            Select All
          </span>
        </div>
      </div>
      {children}
    </components.MenuList>
  )
}

// Standard ValueContainer for all filters
const standardValueContainer = (label: string) => {
  const ValueContainer = ({ children, ...props }: any) => (
    <components.ValueContainer {...props}>
      <div className="flex items-center space-x-2 whitespace-nowrap">
        <span className="text-gray-400 shrink-0">{label}</span>
        <div className="overflow-hidden">{children}</div>
      </div>
    </components.ValueContainer>
  )

  // Add display name to fix the linting error
  ValueContainer.displayName = `ValueContainer(${label})`

  return ValueContainer
}

// Add this helper function
const formatSelectedValues = (selectedValues: string[], options: any[], maxDisplay = 3) => {
  if (selectedValues.length === 0) return ""

  const selectedLabels = selectedValues.map((value) => {
    const option = options.find((opt) => opt.value === value)
    return option?.label || value
  })

  return selectedValues.length > maxDisplay
    ? `${selectedLabels.slice(0, maxDisplay).join(", ")}... (${selectedValues.length})`
    : selectedLabels.join(", ")
}

// Add this helper function at the top of your component or in a utils file
const getScoreCategory = (scoreType: string, score: number): string => {
  if (scoreType === "condition" || scoreType === "distress") {
    if (score < 35) return "Very Poor"
    if (score < 50) return "Poor"
    if (score < 70) return "Fair"
    if (score < 90) return "Good"
    return "Very Good"
  } else {
    // ride score
    if (score < 1) return "Very Poor"
    if (score < 2) return "Poor"
    if (score < 3) return "Fair"
    if (score < 4) return "Good"
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
    default:
      return "rgb(75, 85, 99)"
  }
}

// Format location names (remove leading numbers/dashes)
const formatLocationName = (name: string) => {
  if (!name) return name
  return name.replace(/^\s*\d+\s*[-–—_\s]+\s*/g, "")
}

// Tooltip component
const RatingCriteriaTooltip = ({ visible }: { visible: boolean }) => {
  if (!visible) return null

  return (
    <div className="absolute z-10 bg-white shadow-lg rounded-lg p-3 border border-gray-200 w-[460px]">
      <div className="text-sm font-medium mb-2">PMIS Pavement Condition Rating Criteria (TxDOT, 2023)</div>
      <table className="w-full text-xs border-collapse">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-2 py-1 border border-gray-200 text-left">Category</th>
            <th className="px-2 py-1 border border-gray-200 text-left">Condition Score</th>
            <th className="px-2 py-1 border border-gray-200 text-left">Distress Score</th>
            <th className="px-2 py-1 border border-gray-200 text-left">Ride Score</th>
          </tr>
        </thead>
        <tbody>
          <tr className="bg-green-50">
            <td className="px-2 py-1 border border-gray-200 font-medium">Very Good</td>
            <td className="px-2 py-1 border border-gray-200">90 to 100</td>
            <td className="px-2 py-1 border border-gray-200">90 to 100</td>
            <td className="px-2 py-1 border border-gray-200">4.0 to 5.0</td>
          </tr>
          <tr className="bg-green-100">
            <td className="px-2 py-1 border border-gray-200 font-medium">Good</td>
            <td className="px-2 py-1 border border-gray-200">70 to 89</td>
            <td className="px-2 py-1 border border-gray-200">80 to 89</td>
            <td className="px-2 py-1 border border-gray-200">3.0 to 3.9</td>
          </tr>
          <tr className="bg-yellow-50">
            <td className="px-2 py-1 border border-gray-200 font-medium">Fair</td>
            <td className="px-2 py-1 border border-gray-200">50 to 69</td>
            <td className="px-2 py-1 border border-gray-200">70 to 79</td>
            <td className="px-2 py-1 border border-gray-200">2.0 to 2.9</td>
          </tr>
          <tr className="bg-orange-50">
            <td className="px-2 py-1 border border-gray-200 font-medium">Poor</td>
            <td className="px-2 py-1 border border-gray-200">35 to 49</td>
            <td className="px-2 py-1 border border-gray-200">60 to 69</td>
            <td className="px-2 py-1 border border-gray-200">1.0 to 1.9</td>
          </tr>
          <tr className="bg-red-50">
            <td className="px-2 py-1 border border-gray-200 font-medium">Very Poor</td>
            <td className="px-2 py-1 border border-gray-200">1 to 34</td>
            <td className="px-2 py-1 border border-gray-200">1 to 59</td>
            <td className="px-2 py-1 border border-gray-200">0.1 to 0.9</td>
          </tr>
        </tbody>
      </table>
    </div>
  )
}
const PMIS = () => {
  const [data, setData] = useState<{ [key: string]: any }[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [initialLoading, setInitialLoading] = useState(true)

  // UI state variables
  const [selectedHighway, setSelectedHighway] = useState<string | null>(null)
  const [selectedBeginRM, setSelectedBeginRM] = useState<string[]>([])
  const [selectedEndRM, setSelectedEndRM] = useState<string[]>([])
  const [selectedBeginRMDisplace, setSelectedBeginRMDisplace] = useState<string[]>([])
  const [selectedEndRMDisplace, setSelectedEndRMDisplace] = useState<string[]>([])

  // Add state for the map modal
  const [showMapModal, setShowMapModal] = useState(false)
  const [selectedCounty, setSelectedCounty] = useState<string>("") // Add state for selected county

  const [isInitialLoad, setIsInitialLoad] = useState(true)
  const [showCRCP, setShowCRCP] = useState(true)

  const [showTooltip, setShowTooltip] = useState({
    condition: false,
    distress: false,
    ride: false,
  })

  const [isExporting, setIsExporting] = useState(false)

  const [loadingPercentage, setLoadingPercentage] = useState(0)
  const [chartLoadingPercentage, setChartLoadingPercentage] = useState(0)

  const { setLoading } = useGlobalLoading()

  // Add this effect to connect local loading states to global loading
  useEffect(() => {
    setLoading(initialLoading || isLoading)

    // Clean up when component unmounts
    return () => {
      setLoading(false)
    }
  }, [initialLoading, isLoading, setLoading])

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      return (
        (!selectedHighway || String(item.TX_SIGNED_HIGHWAY_RDBD_ID) === selectedHighway) &&
        (!selectedBeginRM.length || selectedBeginRM.includes(String(item.TX_BEG_REF_MARKER_NBR))) &&
        (!selectedEndRM.length || selectedEndRM.includes(String(item.TX_END_REF_MARKER_NBR))) &&
        (!selectedBeginRMDisplace.length || selectedBeginRMDisplace.includes(String(item.TX_BEG_REF_MRKR_DISP))) &&
        (!selectedEndRMDisplace.length || selectedEndRMDisplace.includes(String(item.TX_END_REF_MARKER_DISP)))
      )
    })
  }, [data, selectedHighway, selectedBeginRM, selectedEndRM, selectedBeginRMDisplace, selectedEndRMDisplace])

  // Modify the filter options to depend on previous selections
  const highwayOptions = useMemo(() => {
    return [...new Set(data.map((item) => String(item.TX_SIGNED_HIGHWAY_RDBD_ID)))]
      .sort()
      .map((h) => ({ value: h, label: h }))
  }, [data])

  const beginRMOptions = useMemo(() => {
    // Only show Begin RM options for selected highway
    const filteredData = selectedHighway
      ? data.filter((item) => String(item.TX_SIGNED_HIGHWAY_RDBD_ID) === selectedHighway)
      : []

    return [...new Set(filteredData.map((item) => String(item.TX_BEG_REF_MARKER_NBR)))]
      .sort((a, b) => Number(a) - Number(b))
      .map((rm) => ({ value: rm, label: rm }))
  }, [data, selectedHighway])

  // Update the filter dependencies
  const endRMOptions = useMemo(() => {
    // Only show End RM options for selected highway, begin RM, and begin displacement
    const filteredData = data.filter((item) => {
      const matchesHighway = String(item.TX_SIGNED_HIGHWAY_RDBD_ID) === selectedHighway
      const matchesBeginRM = selectedBeginRM.includes(String(item.TX_BEG_REF_MARKER_NBR))
      const matchesBeginDisp = selectedBeginRMDisplace.includes(String(item.TX_BEG_REF_MRKR_DISP))

      return matchesHighway && matchesBeginRM && matchesBeginDisp
    })

    return [...new Set(filteredData.map((item) => String(item.TX_END_REF_MARKER_NBR)))]
      .sort((a, b) => Number(a) - Number(b))
      .map((rm) => ({ value: rm, label: rm }))
  }, [data, selectedHighway, selectedBeginRM, selectedBeginRMDisplace])

  const beginRMDisplaceOptions = useMemo(() => {
    // Filter data based on selected highway and begin RM
    const dataToUse = data.filter((item) => {
      const matchesHighway = !selectedHighway || String(item.TX_SIGNED_HIGHWAY_RDBD_ID) === selectedHighway
      const matchesBeginRM =
        selectedBeginRM.length === 0 || selectedBeginRM.includes(String(item.TX_BEG_REF_MARKER_NBR))
      return matchesHighway && matchesBeginRM
    })

    return [
      ...new Set(
        dataToUse
          .map((item) => {
            const displacement = item.TX_BEG_REF_MRKR_DISP
            return displacement !== null && displacement !== undefined ? String(displacement).trim() : null
          })
          .filter(Boolean),
      ),
    ]
      .sort((a, b) => Number(a) - Number(b))
      .map((d) => ({ value: d, label: d }))
  }, [data, selectedHighway, selectedBeginRM])

  const endRMDisplaceOptions = useMemo(() => {
    // Filter data based on all previous selections
    const dataToUse = data.filter((item) => {
      const matchesHighway = !selectedHighway || String(item.TX_SIGNED_HIGHWAY_RDBD_ID) === selectedHighway
      const matchesBeginRM =
        selectedBeginRM.length === 0 || selectedBeginRM.includes(String(item.TX_BEG_REF_MARKER_NBR))
      const matchesEndRM = selectedEndRM.length === 0 || selectedEndRM.includes(String(item.TX_END_REF_MARKER_NBR))
      const matchesBeginDisp =
        selectedBeginRMDisplace.length === 0 || selectedBeginRMDisplace.includes(String(item.TX_BEG_REF_MRKR_DISP))
      return matchesHighway && matchesBeginRM && matchesEndRM && matchesBeginDisp
    })

    return [
      ...new Set(
        dataToUse
          .map((item) => {
            const displacement = item.TX_END_REF_MARKER_DISP
            return displacement !== null && displacement !== undefined ? String(displacement).trim() : null
          })
          .filter(Boolean),
      ),
    ]
      .sort((a, b) => Number(a) - Number(b))
      .map((d) => ({ value: d, label: d }))
  }, [data, selectedHighway, selectedBeginRM, selectedEndRM, selectedBeginRMDisplace])

  // Fetch and parse CSV data
  const fetchData = useCallback(async () => {
    try {
      // const response = await fetch(`${route}/general/Concrete_distresses-0.csv`)
      // const response = await fetchProxy(`/general/Concrete_distresses-0.csv`)

      const response = await fetch(`${routePublic}/files/Concrete_distresses-0.csv`)
      if (!response.ok) throw new Error("Failed to load CSV file")

      const csvText = await response.text()
      return new Promise<any[]>((resolve, reject) => {
        Papa.parse(csvText, {
          header: true,
          skipEmptyLines: true,
          dynamicTyping: true,
          complete: (results) => {
            if (results.errors.length) reject(results.errors)
            else {
              setInitialLoading(false) // Set initial loading to false when data is ready
              resolve(results.data)
            }
          },
        })
      })
    } catch (error) {
      console.error("Error fetching or parsing CSV:", error)
      setInitialLoading(false) // Make sure to set to false even on error
      throw error
    }
  }, [])

  // Load data on component mount
  useEffect(() => {
    fetchData()
      .then((parsedData) => {
        setData(parsedData)
      })
      .catch((error) => console.error("Error loading data:", error))
  }, [fetchData])

  // Apply filters to data
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const applyFilters = useCallback(
    debounce(() => {
      setIsLoading(true)
      setIsInitialLoad(false)

      // Wrap in requestAnimationFrame to avoid UI blocking
      requestAnimationFrame(() => {
        try {
          const result = [...data]

          // setFilteredData(result);
        } catch (error) {
          console.error("Error applying filters:", error)
        } finally {
          setIsLoading(false)
        }
      })
    }, 300),
    [data, selectedHighway, selectedBeginRM, selectedEndRM, selectedBeginRMDisplace, selectedEndRMDisplace],
  )

  // Reset all filters
  const resetFilters = useCallback(() => {
    setIsInitialLoad(true)
    setSelectedHighway(null)
    setSelectedBeginRM([])
    setSelectedEndRM([])
    setSelectedBeginRMDisplace([])
    setSelectedEndRMDisplace([])
  }, [])

  // Helper function to compute weighted scores
  const computeWeightedScore = useCallback((data: any[], field: string): number => {
    const totalWeightedScore = sum(data, (dp) => Number(dp[field] || 0) * Number(dp.TX_LENGTH || 0))
    const totalLength = sum(data, (dp) => Number(dp.TX_LENGTH || 0))
    return totalLength > 0 ? totalWeightedScore / totalLength : 0
  }, [])

  // Compute scores for the charts
  const computeScores = useCallback(
    (data: any[]) => {
      if (!data.length) return []

      const grouped = group(data, (d) => d.EFF_YEAR)
      return Array.from(grouped, ([effYear, groupData]) => {
        const yearlyTotalLength = sum(groupData, (d) => Number(d.TX_LENGTH || 0))
        if (!yearlyTotalLength) return null

        // Calculate weighted averages
        const weightedDistressScore = computeWeightedScore(groupData, "TX_DISTRESS_SCORE")
        const weightedRideScore = computeWeightedScore(groupData, "TX_RIDE_SCORE")
        const weightedConditionScore = computeWeightedScore(groupData, "TX_CONDITION_SCORE")

        // Calculate distress counts per mile
        const totalACPPatches = sum(groupData, (d) => d.TX_CRCP_ACP_PATCHES_QTY || 0)
        const totalPCCPatches = sum(groupData, (d) => d.TX_CRCP_PCC_PATCHES_QTY || 0)
        const totalSpalledCracks = sum(groupData, (d) => d.TX_CRCP_SPALLED_CRACKS_QTY || 0)
        const totalPunchouts = sum(groupData, (d) => d.TX_CRCP_PUNCHOUT_QTY || 0)

        const acpPatchesPerMile = yearlyTotalLength > 0 ? totalACPPatches / yearlyTotalLength : 0
        const pccPatchesPerMile = yearlyTotalLength > 0 ? totalPCCPatches / yearlyTotalLength : 0
        const spalledCracksPerMile = yearlyTotalLength > 0 ? totalSpalledCracks / yearlyTotalLength : 0
        const punchoutsPerMile = yearlyTotalLength > 0 ? totalPunchouts / yearlyTotalLength : 0

        // Add JCP calculations
        const totalJCPFailedJoints = sum(groupData, (d) => d.TX_JCP_FAILED_JNTS_CRACKS_QTY || 0)
        const totalJCPFailures = sum(groupData, (d) => d.TX_JCP_FAILURES_QTY || 0)
        const totalJCPLongCracks = sum(groupData, (d) => d.TX_JCP_LONGITUDE_CRACKS_QTY || 0)
        const totalJCPPCCPatches = sum(groupData, (d) => d.TX_JCP_PCC_PATCHES_QTY || 0)
        const totalJCPShatteredSlabs = sum(groupData, (d) => d.TX_JCP_SHATTERED_SLABS_QTY || 0)

        // Calculate per mile metrics
        const jcpFailedJointsPerMile = yearlyTotalLength > 0 ? totalJCPFailedJoints / yearlyTotalLength : 0
        const jcpFailuresPerMile = yearlyTotalLength > 0 ? totalJCPFailures / yearlyTotalLength : 0
        const jcpLongCracksPerMile = yearlyTotalLength > 0 ? totalJCPLongCracks / yearlyTotalLength : 0
        const jcpPCCPatchesPerMile = yearlyTotalLength > 0 ? totalJCPPCCPatches / yearlyTotalLength : 0
        const jcpShatteredSlabsPerMile = yearlyTotalLength > 0 ? totalJCPShatteredSlabs / yearlyTotalLength : 0

        return {
          effYear,
          weightedDistressScore,
          weightedRideScore,
          weightedConditionScore,
          acpPatches: acpPatchesPerMile,
          pccPatches: pccPatchesPerMile,
          spalledCracks: spalledCracksPerMile,
          punchouts: punchoutsPerMile,
          jcpFailedJoints: jcpFailedJointsPerMile,
          jcpFailures: jcpFailuresPerMile,
          jcpLongCracks: jcpLongCracksPerMile,
          jcpPCCPatches: jcpPCCPatchesPerMile,
          jcpShatteredSlabs: jcpShatteredSlabsPerMile,
        }
      })
        .filter(Boolean)
        .sort((a: any, b: any) => a.effYear - b.effYear)
    },
    [computeWeightedScore],
  )

  // Add function to get the latest year's data
  const getLatestYearData = useCallback((data: any[]) => {
    if (!data || data.length === 0) return null

    // Find the maximum (most recent) year
    const latestYear = Math.max(...data.map((d) => d.effYear))

    // Return the data for that year
    return data.find((d) => d.effYear === latestYear)
  }, [])

  // Memoized computed data
  const computedData = useMemo(() => computeScores(filteredData), [filteredData, computeScores])

  // Add this to handle chart loading progress
  useEffect(() => {
    let interval: NodeJS.Timeout

    if (isLoading) {
      // Reset progress when loading starts
      setChartLoadingPercentage(0)

      // Simulate chart loading progress
      interval = setInterval(() => {
        setChartLoadingPercentage((prev) => {
          const next = prev + Math.random() * 5
          return next < 85 ? next : 85
        })
      }, 100)
    } else if (computedData.length > 0) {
      // Complete progress when chart data is ready
      setChartLoadingPercentage(100)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [isLoading, computedData])

  // Implemented exportToCSV function
  function exportToCSV(event: React.MouseEvent<HTMLButtonElement>): void {
    if (!computedData || computedData.length === 0) {
      alert("No data to export. Please apply filters first.")
      return
    }

    setIsExporting(true) // Start loading

    try {
      // Create CSV header based on data type
      const headers = ["Year", "Condition_Score", "Distress_Score", "Ride_Score"]

      // Add specific distress headers based on current view
      if (showCRCP) {
        headers.push("ACP_Patches_per_Mile", "PCC_Patches_per_Mile", "Spalled_Cracks_per_Mile", "Punchouts_per_Mile")
      } else {
        headers.push(
          "Failed_Joints_per_Mile",
          "Failures_per_Mile",
          "Longitudinal_Cracks_per_Mile",
          "PCC_Patches_per_Mile",
          "Shattered_Slabs_per_Mile",
        )
      }

      // Create CSV rows from data
      const csvRows = [headers.join(",")]

      computedData.forEach((d) => {
        if (!d) return

        const rowData = [
          d.effYear,
          d.weightedConditionScore.toFixed(2),
          d.weightedDistressScore.toFixed(2),
          d.weightedRideScore.toFixed(2),
        ]

        if (showCRCP) {
          rowData.push(
            d.acpPatches.toFixed(2),
            d.pccPatches.toFixed(2),
            d.spalledCracks.toFixed(2),
            d.punchouts.toFixed(2),
          )
        } else {
          rowData.push(
            d.jcpFailedJoints.toFixed(2),
            d.jcpFailures.toFixed(2),
            d.jcpLongCracks.toFixed(2),
            d.jcpPCCPatches.toFixed(2),
            d.jcpShatteredSlabs.toFixed(2),
          )
        }

        csvRows.push(rowData.join(","))
      })

      // Create and download the CSV file
      const csvString = csvRows.join("\n")
      const blob = new Blob([csvString], { type: "text/csv;charset=utf-8;" })

      // Create filename with current filters
      const highwayText = selectedHighway ? `_Highway_${selectedHighway}` : ""
      const dateStr = new Date().toISOString().split("T")[0]
      const filename = `PMIS_Data${highwayText}_${showCRCP ? "CRCP" : "JCP"}_${dateStr}.csv`

      // Create download link and trigger click
      const link = document.createElement("a")
      link.href = URL.createObjectURL(blob)
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(link.href)

      setIsExporting(false) // End loading
    } catch (error) {
      console.error("Error exporting data to CSV:", error)
      alert("Error exporting data. Please try again.")
      setIsExporting(false) // End loading
    }
  }

  // Keep basic shared layout properties
  const baseChartLayout = {
    autosize: true,
    margin: {
      r: 50,
      t: 100,
      b: 60,
      l: 60,
    },
    paper_bgcolor: "rgba(0,0,0,0)",
    plot_bgcolor: "rgba(0,0,0,0)",
  }

  // Add reset functions for when parent filters change
  useEffect(() => {
    // Reset dependent filters when highway changes
    if (selectedHighway) {
      setSelectedBeginRM([])
      setSelectedEndRM([])
      setSelectedBeginRMDisplace([])
      setSelectedEndRMDisplace([])
    }
  }, [selectedHighway])

  useEffect(() => {
    // Reset dependent filters when begin RM changes
    if (selectedBeginRM.length > 0) {
      setSelectedEndRM([])
      setSelectedBeginRMDisplace([])
      setSelectedEndRMDisplace([])
    }
  }, [selectedBeginRM])

  useEffect(() => {
    // Reset dependent filters when end RM changes
    if (selectedEndRM.length > 0) {
      setSelectedEndRMDisplace([])
    }
  }, [selectedEndRM])

  useEffect(() => {
    // Reset end displacement when begin displacement changes
    if (selectedBeginRMDisplace.length > 0) {
      setSelectedEndRMDisplace([])
    }
  }, [selectedBeginRMDisplace])

  // Update the End RM Select component's onChange handler
  const handleEndRMChange = (selectedOptions: any) => {
    const newValues = selectedOptions
      ? (selectedOptions as Array<{ value: string; label: string }>).map((option) => option.value)
      : []

    // Check if there are selected Begin RMs
    if (selectedBeginRM.length > 0) {
      const minBeginRM = Math.min(...selectedBeginRM.map(Number))
      // Filter out End RMs that are less than the minimum Begin RM
      const validEndRMs = newValues.filter((endRM) => Number(endRM) >= minBeginRM)
      setSelectedEndRM(validEndRMs)
    } else {
      // If no Begin RM is selected, allow any End RM selection
      setSelectedEndRM(newValues)
    }

    // Only reset the End Displacement, not Begin Displacement
    setSelectedEndRMDisplace([])
  }

  // Modify the openMapModal function to ensure we never try to open the map without a highway
  const openMapModal = () => {
    if (selectedHighway) {
      const county = selectedCounty || "TRAVIS" // Default county if none selected
      setShowMapModal(true)
    }
    // No alert - the button will be disabled if no highway is selected
  }

  // Function to close the map modal
  const closeMapModal = () => {
    setShowMapModal(false)
  };

  // Extract counties from data for the selected highway
  const countyOptions = useMemo(() => {
    if (!selectedHighway) return []

    const counties = [
      ...new Set(
        data
          .filter((item) => String(item.TX_SIGNED_HIGHWAY_RDBD_ID) === selectedHighway)
          .map((item) => item.COUNTY)
          .filter(Boolean),
      ),
    ]

    return counties.map((county) => ({
      value: county,
      label: formatLocationName(county) // Apply the formatLocationName function here
    }))
  }, [data, selectedHighway])

  // Set the first county as default when highway changes
  useEffect(() => {
    if (selectedHighway && countyOptions.length > 0) {
      setSelectedCounty(countyOptions[0].value)
    } else {
      setSelectedCounty("")
    }
  }, [selectedHighway, countyOptions])

  return (
    <div className="h-full">
      <section className="h-full overflow-auto px-4 py-4">
        <div className="flex flex-col sm:py-6 sm:gap-y-3">
          {initialLoading ? (
            <div className="flex flex-col items-center justify-center h-[400px]"></div>
          ) : (
            <div className="flex flex-col items-center sm:gap-y-8">
              <div className="flex flex-col items-center w-full max-w-6xl">
                <div className="flex flex-col items-center w-full max-w-6xl">
                  {/* Header section with title */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm max-w-7xl w-full mx-auto">
                    <div className="flex items-center gap-2 mb-3">
                      <h2 className="text-base font-semibold">Filters</h2>
                      <div className="relative group">
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center cursor-help text-gray-600 hover:bg-gray-300 transition-colors">
                          <span className="text-xs font-bold">i</span>
                        </div>
                        <div className="absolute left-0 top-full mt-2 w-72 bg-white shadow-lg rounded-lg p-3 text-xs text-gray-700 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-gray-200">
                          <p className="mb-1">
                            <strong>Filter Selection Guide</strong>
                          </p>
                          <p className="mb-1">Select filters in the following order:</p>
                          <ol className="list-decimal pl-4 mb-1">
                            <li>
                              Select <strong>Highway</strong>
                            </li>
                            <li>
                              Select <strong>Begin RM</strong>
                            </li>
                            <li>
                              Select <strong>Begin Displacement</strong>
                            </li>
                            <li>
                              Select <strong>End RM</strong>
                            </li>
                            <li>
                              Select <strong>End Displacement</strong>
                            </li>
                          </ol>
                          <p>Then click &quot;Apply Filters&quot; to generate the chart.</p>
                        </div>
                      </div>
                    </div>

                    {/* Filter grid */}
                    <div className="grid grid-cols-1 md:grid-cols-5 gap-3 mb-4">
                      {/* Highway filter */}
                      <div className="flex flex-col">
                        <label className="block text-lg font-semibold mb-1">Highway</label>
                        <Select
                          isClearable
                          className="basic-single"
                          options={highwayOptions}
                          value={
                            selectedHighway
                              ? {
                                value: selectedHighway,
                                label: selectedHighway,
                              }
                              : null
                          }
                          onChange={(option: any) => {
                            setSelectedHighway(option ? option.value : null)
                            // Reset all dependent filters
                            setSelectedBeginRM([])
                            setSelectedBeginRMDisplace([])
                            setSelectedEndRM([])
                            setSelectedEndRMDisplace([])

                            // Auto-open map modal when highway is selected
                            if (option?.value) {
                              // Small delay to ensure state is updated
                              setTimeout(() => openMapModal(), 100)
                            }
                          }}
                          placeholder="Select Highway"
                        />
                        {selectedHighway && (
                          <div className="text-xs mt-0.5 text-blue-600 truncate">Selected: {selectedHighway}</div>
                        )}
                      </div>

                      {/* County filter - Add this new filter */}
                      {selectedHighway && (
                        <div className="flex flex-col">
                          <label className="block text-lg font-semibold mb-1">County</label>
                          <Select
                            className="basic-single"
                            options={countyOptions}
                            value={
                              selectedCounty
                                ? {
                                  value: selectedCounty,
                                  label: formatLocationName(selectedCounty) // Apply formatting here too
                                }
                                : null
                            }
                            onChange={(option: any) => {
                              setSelectedCounty(option ? option.value : "")
                            }}
                            placeholder="Select County"
                          />
                          {selectedCounty && (
                            <div className="text-xs mt-0.5 text-blue-600 truncate">
                              Selected: {formatLocationName(selectedCounty)}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Begin Reference Marker filter */}
                      <div className="flex flex-col">
                        <label className="block text-lg font-semibold mb-1">Begin RM</label>
                        <Select
                          isMulti
                          isDisabled={!selectedHighway} // Disable if no highway selected
                          closeMenuOnSelect={false}
                          hideSelectedOptions={false}
                          components={{
                            MenuList,
                            Option,
                          }}
                          className="multi-select"
                          options={beginRMOptions}
                          value={beginRMOptions.filter((option) => selectedBeginRM.includes(option.value))}
                          onChange={(selectedOptions) => {
                            const newValues = selectedOptions
                              ? (selectedOptions as Array<{ value: string; label: string }>).map((option) => option.value)
                              : []
                            setSelectedBeginRM(newValues)
                            // Reset dependent filters
                            setSelectedBeginRMDisplace([])
                            setSelectedEndRM([])
                            setSelectedEndRMDisplace([])
                          }}
                          placeholder={!selectedHighway ? "Select Highway" : "Select Begin RM"}
                        />
                        {selectedBeginRM.length > 0 && (
                          <div className="text-xs mt-1 text-blue-600">
                            Selected: {formatSelectedValues(selectedBeginRM, beginRMOptions)}
                          </div>
                        )}
                      </div>

                      {/* Begin Displacement filter */}
                      <div className="flex flex-col">
                        <label className="block text-lg font-semibold mb-1">Begin Displacement</label>
                        <Select
                          isMulti
                          isDisabled={!selectedHighway || selectedBeginRM.length === 0} // Disable if previous filters not selected
                          closeMenuOnSelect={false}
                          hideSelectedOptions={false}
                          components={{ MenuList, Option }}
                          className="multi-select"
                          options={beginRMDisplaceOptions}
                          value={beginRMDisplaceOptions.filter((option) =>
                            selectedBeginRMDisplace.includes(option.value as string),
                          )}
                          onChange={(selectedOptions) => {
                            const newValues = selectedOptions
                              ? (selectedOptions as Array<{ value: string; label: string }>).map((option) => option.value)
                              : []
                            setSelectedBeginRMDisplace(newValues)
                            // Reset dependent filter
                            setSelectedEndRMDisplace([])
                          }}
                          placeholder={
                            !selectedHighway
                              ? "Select Highway"
                              : !selectedBeginRM.length
                                ? "Select Begin RM"
                                : "Select Begin Displacement"
                          }
                        />
                        {selectedBeginRMDisplace.length > 0 && (
                          <div className="text-xs mt-1 text-blue-600">
                            Selected: {formatSelectedValues(selectedBeginRMDisplace, beginRMDisplaceOptions)}
                          </div>
                        )}
                      </div>

                      {/* End Reference Marker filter */}
                      <div className="flex flex-col">
                        <label className="block text-lg font-semibold mb-1">End RM</label>
                        <Select
                          isMulti
                          isDisabled={
                            !selectedHighway || selectedBeginRM.length === 0 || selectedBeginRMDisplace.length === 0
                          }
                          closeMenuOnSelect={false}
                          hideSelectedOptions={false}
                          components={{ MenuList, Option }}
                          className="multi-select"
                          options={endRMOptions}
                          value={endRMOptions.filter((option) => selectedEndRM.includes(option.value))}
                          onChange={handleEndRMChange}
                          placeholder={
                            !selectedHighway
                              ? "Select Highway"
                              : !selectedBeginRM.length
                                ? "Select Begin RM"
                                : !selectedBeginRMDisplace.length
                                  ? "Select Begin Displacement"
                                  : "Select End RM"
                          }
                        />
                        {selectedEndRM.length > 0 && (
                          <div className="text-xs mt-1 text-blue-600">
                            Selected: {formatSelectedValues(selectedEndRM, endRMOptions)}
                          </div>
                        )}
                      </div>

                      {/* End Displacement filter */}
                      <div className="flex flex-col">
                        <label className="block text-lg font-semibold mb-1">End Displacement</label>
                        <Select
                          isMulti
                          isDisabled={
                            !selectedHighway ||
                            selectedBeginRM.length === 0 ||
                            selectedBeginRMDisplace.length === 0 ||
                            selectedEndRM.length === 0
                          }
                          closeMenuOnSelect={false}
                          hideSelectedOptions={false}
                          components={{ MenuList, Option }}
                          className="multi-select"
                          options={endRMDisplaceOptions}
                          value={endRMDisplaceOptions.filter((option) =>
                            selectedEndRMDisplace.includes(option.value as string),
                          )}
                          onChange={(selectedOptions) => {
                            const newValues = selectedOptions
                              ? (selectedOptions as Array<{ value: string; label: string }>).map((option) => option.value)
                              : []
                            setSelectedEndRMDisplace(newValues)
                          }}
                          placeholder={
                            !selectedHighway
                              ? "Select Highway"
                              : !selectedBeginRM.length
                                ? "Select Begin RM"
                                : !selectedBeginRMDisplace.length
                                  ? "Select Begin Displacement"
                                  : !selectedEndRM.length
                                    ? "Select End RM"
                                    : "Select End Displacement"
                          }
                        />
                        {selectedEndRMDisplace.length > 0 && (
                          <div className="text-xs mt-1 text-blue-600">
                            Selected: {formatSelectedValues(selectedEndRMDisplace, endRMDisplaceOptions)}
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Action buttons */}
                    <div className="flex flex-wrap justify-center gap-2 mt-2">
                      <button
                        onClick={applyFilters}
                        className="px-3 py-1 bg-blue-600 text-white text-sm font-medium rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-opacity-50 transition-colors flex items-center gap-1 h-8"
                        disabled={isLoading}
                      >
                        {isLoading ? (
                          <>
                            <svg
                              className="animate-spin h-3 w-3 text-white mr-1"
                              xmlns="http://www.w3.org/2000/svg"
                              fill="none"
                              viewBox="0 0 24 24"
                            >
                              <circle
                                className="opacity-25"
                                cx="12"
                                cy="12"
                                r="10"
                                stroke="currentColor"
                                strokeWidth="4"
                              ></circle>
                              <path
                                className="opacity-75"
                                fill="currentColor"
                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                              ></path>
                            </svg>
                            Loading...
                          </>
                        ) : (
                          "Apply Filters"
                        )}
                      </button>

                      <button
                        onClick={resetFilters}
                        className="px-3 py-1 bg-gray-200 text-gray-700 text-sm font-medium rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-opacity-50 transition-colors h-8"
                      >
                        Reset
                      </button>

                      {/* Add View on Map button */}
                      <button
                        onClick={openMapModal}
                        className={`px-3 py-1 bg-indigo-600 text-white text-sm font-medium rounded-md hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-opacity-50 transition-colors flex items-center gap-1 h-8 ${!selectedHighway ? "opacity-50 cursor-not-allowed" : ""}`}
                        disabled={!selectedHighway}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                          />
                        </svg>
                        View on Map
                      </button>

                      <button
                        onClick={exportToCSV}
                        className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors flex items-center gap-1 h-8"
                        disabled={!computedData || computedData.length === 0 || isExporting}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          fill="currentColor"
                          viewBox="0 0 16 16"
                        >
                          <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                          <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                        </svg>
                        Export
                      </button>
                    </div>
                  </div>

                  {/* Summary section */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm max-w-7xl w-full mx-auto">
                    <div className="flex items-center gap-2 mb-2">
                      <h2 className="text-lg font-semibold">Summary</h2>
                      <div className="relative group">
                        <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center cursor-help text-gray-600 hover:bg-gray-300 transition-colors">
                          <span className="text-xs font-bold">i</span>
                        </div>
                        <div className="absolute left-0 top-full mt-2 w-96 bg-white shadow-lg rounded-lg p-3 text-sm text-gray-700 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-gray-200">
                          <p className="mb-2">
                            <strong>PMIS Data Summary</strong>
                          </p>
                          <p className="mb-2">This summary displays metrics for the selected highway segments:</p>
                          <ul className="list-disc pl-5 mb-2">
                            <li>
                              <span className="text-green-700 font-medium">Condition Score</span>: Weighted by segment
                              length
                            </li>
                            <li>
                              <span className="text-blue-700 font-medium">Distress Score</span>: Weighted by segment length
                            </li>
                            <li>
                              <span className="text-red-700 font-medium">Ride Score</span>: Weighted by segment length
                            </li>
                            <li>
                              <span className="text-gray-700 font-medium">Distress Metrics</span>: Counts per mile
                            </li>
                          </ul>
                          <p className="mt-3 mb-1 font-medium">How these scores are calculated:</p>
                          <p>
                            • All scores shown are from the most recent year data (
                            {computedData.length ? getLatestYearData(computedData)?.effYear : "N/A"})
                          </p>
                          <p>• Condition, Distress, and Ride scores are weighted by segment length using the formula:</p>
                          <p className="font-mono bg-gray-100 p-1 my-1 rounded text-xs">
                            Weighted Score = (Σ (Score × Segment Length)) / (Σ Segment Length)
                          </p>
                          <p>• Distress metrics (patches, cracks, etc.) represent counts per mile for the latest year:</p>
                          <p className="font-mono bg-gray-100 p-1 my-1 rounded text-xs">
                            Distress per Mile = (Σ Distresses) / (Σ Length)
                          </p>
                          {/* <p>• When data is updated in the future, these values will automatically display the most recent year results</p> */}
                        </div>
                      </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                      {/* Condition Score Card */}
                      <div
                        className="bg-green-50 p-3 rounded relative"
                        onMouseEnter={() => setShowTooltip((prev) => ({ ...prev, condition: true }))}
                        onMouseLeave={() => setShowTooltip((prev) => ({ ...prev, condition: false }))}
                      >
                        <div className="text-sm text-gray-500">Latest Condition Score</div>
                        <div className="text-xs text-gray-500 mt-1">
                          From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                        </div>

                        {/* Tooltip for condition score */}
                        <div className="absolute top-0 left-full ml-2">
                          <RatingCriteriaTooltip visible={showTooltip.condition} />
                        </div>

                        {/* Add condition score gauge */}
                        {computedData.length > 0 ? (
                          <div className="h-[120px] mt-2">
                            <Plot
                              data={[
                                {
                                  type: "indicator",
                                  mode: "gauge+number",
                                  value: getLatestYearData(computedData)?.weightedConditionScore || 0,
                                  gauge: {
                                    axis: {
                                      range: [0, 100],
                                      tickwidth: 1,
                                      tickvals: [0, 35, 50, 70, 90, 100],
                                      ticktext: ["0", "35", "50", "70", "90", "100"],
                                      tickfont: { size: 9 },
                                      tickangle: 0,
                                      visible: true,
                                      showticklabels: true,
                                      tickmode: "array",
                                      ticklen: 5,
                                      tickcolor: "black",
                                    },
                                    bar: { color: "black", thickness: 0.2 },
                                    bgcolor: "white",
                                    borderwidth: 1,
                                    bordercolor: "lightgray",
                                    steps: [
                                      { range: [0, 35], color: "rgb(239, 68, 68)" }, // Very Poor
                                      { range: [35, 50], color: "rgb(249, 115, 22)" }, // Poor
                                      { range: [50, 70], color: "rgb(234, 179, 8)" }, // Fair
                                      { range: [70, 90], color: "rgb(34, 197, 94)" }, // Good
                                      { range: [90, 100], color: "rgb(21, 128, 61)" }, // Very Good
                                    ],
                                  },
                                  number: {
                                    font: {
                                      size: 22,
                                      color: (() => {
                                        const score = getLatestYearData(computedData)?.weightedConditionScore || 0
                                        const category = getScoreCategory("condition", score)
                                        return getCategoryColor(category)
                                      })(),
                                    },
                                    valueformat: ".1f",
                                    suffix: "",
                                  },
                                },
                              ]}
                              layout={{
                                height: 120,
                                width: 300,
                                margin: { t: 20, r: 60, l: 60, b: 40 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                annotations: [
                                  {
                                    x: 0.5,
                                    y: 0.1,
                                    text: (() => {
                                      const score = getLatestYearData(computedData)?.weightedConditionScore || 0
                                      return getScoreCategory("condition", score)
                                    })(),
                                    font: {
                                      size: 14,
                                      color: (() => {
                                        const score = getLatestYearData(computedData)?.weightedConditionScore || 0
                                        const category = getScoreCategory("condition", score)
                                        return getCategoryColor(category)
                                      })(),
                                    },
                                    showarrow: false,
                                    xref: "paper",
                                    yref: "paper",
                                    xanchor: "center",
                                    yanchor: "top",
                                  },
                                ],
                              }}
                              config={{ displayModeBar: false, responsive: true }}
                              style={{ width: "100%", height: "100%" }}
                            />
                          </div>
                        ) : (
                          <div className="h-[120px] mt-2 flex items-center justify-center">
                            <p className="text-gray-500">Loading...</p>
                          </div>
                        )}
                      </div>

                      {/* Distress Score Card */}
                      <div
                        className="bg-blue-50 p-3 rounded relative"
                        onMouseEnter={() => setShowTooltip((prev) => ({ ...prev, distress: true }))}
                        onMouseLeave={() => setShowTooltip((prev) => ({ ...prev, distress: false }))}
                      >
                        <div className="text-sm text-gray-500">Latest Distress Score</div>
                        <div className="text-xs text-gray-500 mt-1">
                          From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                        </div>

                        {/* Tooltip for distress score */}
                        <div className="absolute top-0 left-full ml-2">
                          <RatingCriteriaTooltip visible={showTooltip.distress} />
                        </div>

                        {/* Distress score  */}
                        {computedData.length > 0 ? (
                          <div className="h-[120px] mt-2">
                            <Plot
                              data={[
                                {
                                  type: "indicator",
                                  mode: "gauge+number",
                                  value: getLatestYearData(computedData)?.weightedDistressScore || 0,
                                  gauge: {
                                    axis: {
                                      range: [0, 100],
                                      tickwidth: 1,
                                      tickvals: [0, 60, 70, 80, 90, 100],
                                      ticktext: ["0", "60", "70", "80", "90", "100"],
                                      tickfont: { size: 9 },
                                      tickangle: 0,
                                      visible: true,
                                      showticklabels: true,
                                      tickmode: "array",
                                      ticklen: 5,
                                      tickcolor: "black",
                                    },
                                    bar: { color: "black", thickness: 0.2 },
                                    bgcolor: "white",
                                    borderwidth: 1,
                                    bordercolor: "lightgray",
                                    steps: [
                                      { range: [0, 60], color: "rgb(239, 68, 68)" },
                                      { range: [60, 70], color: "rgb(249, 115, 22)" },
                                      { range: [70, 80], color: "rgb(234, 179, 8)" },
                                      { range: [80, 90], color: "rgb(34, 197, 94)" },
                                      { range: [90, 100], color: "rgb(21, 128, 61)" },
                                    ],
                                  },
                                  number: {
                                    font: {
                                      size: 22,
                                      color: (() => {
                                        const score = getLatestYearData(computedData)?.weightedDistressScore || 0
                                        const category = getScoreCategory("distress", score)
                                        return getCategoryColor(category)
                                      })(),
                                    },
                                    valueformat: ".1f",
                                    suffix: "",
                                  },
                                },
                              ]}
                              layout={{
                                height: 120,
                                width: 300,
                                margin: { t: 20, r: 60, l: 60, b: 40 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                annotations: [
                                  {
                                    x: 0.5,
                                    y: 0.1,
                                    text: (() => {
                                      const score = getLatestYearData(computedData)?.weightedDistressScore || 0
                                      return getScoreCategory("distress", score)
                                    })(),
                                    font: {
                                      size: 14,
                                      color: (() => {
                                        const score = getLatestYearData(computedData)?.weightedDistressScore || 0
                                        const category = getScoreCategory("distress", score)
                                        return getCategoryColor(category)
                                      })(),
                                    },
                                    showarrow: false,
                                    xref: "paper",
                                    yref: "paper",
                                    xanchor: "center",
                                    yanchor: "top",
                                  },
                                ],
                              }}
                              config={{ displayModeBar: false, responsive: true }}
                              style={{ width: "100%", height: "100%" }}
                            />
                          </div>
                        ) : (
                          <div className="h-[120px] mt-2 flex items-center justify-center">
                            <p className="text-gray-500">Loading...</p>
                          </div>
                        )}
                      </div>

                      {/* Ride Score Card  */}
                      <div
                        className="bg-red-50 p-3 rounded relative"
                        onMouseEnter={() => setShowTooltip((prev) => ({ ...prev, ride: true }))}
                        onMouseLeave={() => setShowTooltip((prev) => ({ ...prev, ride: false }))}
                      >
                        <div className="text-sm text-gray-500">Latest Ride Score</div>
                        <div className="text-xs text-gray-500 mt-1">
                          From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                        </div>

                        {/* Tooltip for ride score */}
                        <div className="absolute top-0 left-full ml-2">
                          <RatingCriteriaTooltip visible={showTooltip.ride} />
                        </div>

                        {/* Updated ride score gauge */}
                        {computedData.length > 0 ? (
                          <div className="h-[120px] mt-2">
                            <Plot
                              data={[
                                {
                                  type: "indicator",
                                  mode: "gauge+number",
                                  value: getLatestYearData(computedData)?.weightedRideScore || 0,
                                  gauge: {
                                    axis: {
                                      range: [0, 5],
                                      tickwidth: 1,
                                      tickvals: [0, 1, 2, 3, 4, 5],
                                      ticktext: ["0", "1", "2", "3", "4", "5"],
                                      tickfont: { size: 9 },
                                      tickangle: 0,
                                      visible: true,
                                      showticklabels: true,
                                      tickmode: "array",
                                      ticklen: 5,
                                      tickcolor: "black",
                                    },
                                    bar: { color: "black", thickness: 0.2 },
                                    bgcolor: "white",
                                    borderwidth: 1,
                                    bordercolor: "lightgray",
                                    steps: [
                                      { range: [0, 1], color: "rgb(239, 68, 68)" },
                                      { range: [1, 2], color: "rgb(249, 115, 22)" },
                                      { range: [2, 3], color: "rgb(234, 179, 8)" },
                                      { range: [3, 4], color: "rgb(34, 197, 94)" },
                                      { range: [4, 5], color: "rgb(21, 128, 61)" },
                                    ],
                                  },
                                  number: {
                                    font: {
                                      size: 24,
                                      color: (() => {
                                        const score = getLatestYearData(computedData)?.weightedRideScore || 0
                                        const category = getScoreCategory("ride", score)
                                        return getCategoryColor(category)
                                      })(),
                                    },
                                    valueformat: ".2f",
                                    suffix: "",
                                  },
                                },
                              ]}
                              layout={{
                                height: 120,
                                width: 300,
                                margin: { t: 20, r: 60, l: 60, b: 40 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                annotations: [
                                  {
                                    x: 0.5,
                                    y: 0.1,
                                    text: (() => {
                                      const score = getLatestYearData(computedData)?.weightedRideScore || 0
                                      return getScoreCategory("ride", score)
                                    })(),
                                    font: {
                                      size: 14,
                                      color: (() => {
                                        const score = getLatestYearData(computedData)?.weightedRideScore || 0
                                        const category = getScoreCategory("ride", score)
                                        return getCategoryColor(category)
                                      })(),
                                    },
                                    showarrow: false,
                                    xref: "paper",
                                    yref: "paper",
                                    xanchor: "center",
                                    yanchor: "top",
                                  },
                                ],
                              }}
                              config={{ displayModeBar: false, responsive: true }}
                              style={{ width: "100%", height: "100%" }}
                            />
                          </div>
                        ) : (
                          <div className="h-[120px] mt-2 flex items-center justify-center">
                            <p className="text-gray-500">Loading...</p>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Add distress metrics summary based on selected pavement type */}
                    <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
                      {showCRCP ? (
                        <>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">ACP Patches</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.acpPatches.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/miles" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">PCC Patches</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.pccPatches.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/miles" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">Spalled Cracks</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.spalledCracks.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/miles" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">Punchouts</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.punchouts.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/miles" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">Failed Joints</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.jcpFailedJoints.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/miles" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">Failures</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.jcpFailures.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/miles" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">Longitudinal Cracks</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.jcpLongCracks.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/mi" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                          <div className="bg-gray-50 p-3 rounded">
                            <div className="text-sm text-gray-500">Shattered Slabs</div>
                            <div className="text-xl font-bold">
                              {computedData.length ? (
                                (() => {
                                  const latest = getLatestYearData(computedData)
                                  return latest ? latest.jcpShatteredSlabs.toFixed(2) : "N/A"
                                })()
                              ) : (
                                <div className="h-6 flex items-center justify-center">
                                  <p className="text-xs text-gray-500">Loading...</p>
                                </div>
                              )}{" "}
                              {computedData.length ? "/miles" : ""}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              From {computedData.length ? getLatestYearData(computedData)?.effYear : ""}
                            </div>
                          </div>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Charts Container */}
                <div className="flex flex-col gap-4 w-full max-w-7xl">
                  {/* Line Chart Card */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <h2 className="text-lg font-semibold text-gray-700 mb-6">Evaluation Scores</h2>
                    <p className="mt-3 text-xs text-gray-600">All scores are weighted by segment length.</p>
                    {/* Added bg-white container with padding and border */}
                    <div className="w-full h-[550px] bg-white p-4 rounded-lg border border-gray-100">
                      {Plot && computedData.length > 0 ? (
                        <Plot
                          data={[
                            {
                              x: computedData.map((d) => d!.effYear),
                              y: computedData.map((d) => d!.weightedConditionScore),
                              type: "scatter",
                              mode: "lines+markers",
                              name: "Condition Score",
                              line: { color: "green" },
                            },
                            {
                              x: computedData.map((d) => d!.effYear),
                              y: computedData.map((d) => d!.weightedDistressScore),
                              type: "scatter",
                              mode: "lines+markers",
                              name: "Distress Score",
                              line: { color: "blue" },
                            },
                            {
                              x: computedData.map((d) => d!.effYear),
                              y: computedData.map((d) => d!.weightedRideScore),
                              type: "scatter",
                              mode: "lines+markers",
                              name: "Ride Score",
                              line: { color: "red" },
                              yaxis: "y2",
                            },
                          ]}
                          layout={{
                            ...baseChartLayout,
                            xaxis: {
                              title: "Year",
                              type: "category",
                              autorange: true,
                              tickangle: -45, // Rotate labels 45 degrees to the left
                              tickfont: {
                                size: 11, // Slightly smaller font to prevent overlap
                              },
                            },
                            yaxis: {
                              title: "Distress & Condition Score",
                              range: [0, 101],
                              autorange: false, // Set to false to enforce the range
                              rangemode: "tozero",
                            },
                            yaxis2: {
                              title: "Ride Score",
                              overlaying: "y",
                              side: "right",
                              range: [0, 5], // Min and max values
                              autorange: false,
                              rangemode: "tozero",
                              tickmode: "linear", // Use linear tick mode for custom step size
                              tick0: 0, // Start ticks at 0
                              dtick: 0.5, // Step size of 0.5 between each tick
                              showgrid: true, // Optional: Hide grid lines for cleaner look
                            },
                            legend: {
                              orientation: "h" as const,
                              y: 1.2,
                              x: 0.5,
                              xanchor: "center" as const,
                              yanchor: "bottom" as const,
                              bgcolor: "rgba(255,255,255,0.8)",
                              bordercolor: "lightgray",
                              borderwidth: 1,
                              traceorder: "normal" as const,
                              itemclick: "toggle" as const,
                            },
                            // Update background colors
                            paper_bgcolor: "white",
                            plot_bgcolor: "rgba(249, 250, 251, 0.5)", // Very light gray
                            // Update margins
                            margin: {
                              r: 60,
                              t: 110, // Increased to accommodate legend
                              b: 70,
                              l: 70,
                            },
                          }}
                          config={{
                            responsive: true,
                            displayModeBar: true,
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            minHeight: "450px",
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-[450px]">
                          <p className="text-gray-500">Loading evaluation scores...</p>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Distress Chart Card */}
                  <div className="bg-white border rounded-lg p-4 shadow-sm">
                    <div className="flex flex-col gap-4 mb-6">
                      <div className="flex justify-between items-end">
                        <h2 className="text-lg font-semibold text-gray-700">Distresses Over Time</h2>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => setShowCRCP(true)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${showCRCP ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                          >
                            CRCP
                          </button>
                          <button
                            onClick={() => setShowCRCP(false)}
                            className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${!showCRCP ? "bg-blue-600 text-white" : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                              }`}
                          >
                            JCP
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Info text moved below buttons */}
                    <div className="flex items-center justify-center text-sm text-gray-500 mb-6">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        className="h-4 w-4 mr-1"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      <span>Switch between CRCP and JCP distress data using the toggle buttons above</span>
                    </div>

                    {/* Updated chart container with padding and background */}
                    <div className="w-full h-[500px] bg-white p-4 rounded-lg border border-gray-100">
                      {Plot && computedData.length > 0 ? (
                        <Plot
                          data={
                            showCRCP
                              ? [
                                // CRCP data
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.acpPatches),
                                  type: "bar",
                                  name: "ACP Patches",
                                  marker: { color: "green" },
                                  legendgroup: "distress",
                                  legendrank: 1,
                                },
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.pccPatches),
                                  type: "bar",
                                  name: "PCC Patches",
                                  marker: { color: "blue" },
                                  legendgroup: "distress",
                                  legendrank: 2,
                                },
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.spalledCracks),
                                  type: "bar",
                                  name: "Spalled Cracks",
                                  marker: { color: "orange" },
                                  legendgroup: "distress",
                                  legendrank: 3,
                                },
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.punchouts),
                                  type: "bar",
                                  name: "Punchouts",
                                  marker: { color: "red" },
                                  legendgroup: "distress",
                                  legendrank: 4,
                                },
                              ]
                              : [
                                // JCP data with updated colors
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.jcpFailedJoints),
                                  type: "bar",
                                  name: "Failed Joints",
                                  marker: { color: "green" }, // Changed to match CRCP green
                                  legendgroup: "jcp",
                                  legendrank: 1,
                                },
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.jcpFailures),
                                  type: "bar",
                                  name: "Failures",
                                  marker: { color: "blue" }, // Changed to match CRCP blue
                                  legendgroup: "jcp",
                                  legendrank: 2,
                                },
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.jcpLongCracks),
                                  type: "bar",
                                  name: "Longitudinal Cracks",
                                  marker: { color: "orange" }, // Changed to match CRCP orange
                                  legendgroup: "jcp",
                                  legendrank: 3,
                                },
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.jcpPCCPatches),
                                  type: "bar",
                                  name: "PCC Patches",
                                  marker: { color: "red" }, // Changed to match CRCP red
                                  legendgroup: "jcp",
                                  legendrank: 4,
                                },
                                {
                                  x: computedData.map((d) => d!.effYear),
                                  y: computedData.map((d) => d!.jcpShatteredSlabs),
                                  type: "bar",
                                  name: "Shattered Slabs",
                                  marker: { color: "gray" }, // Kept gray for Shattered Slabs
                                  legendgroup: "jcp",
                                  legendrank: 5,
                                },
                              ]
                          }
                          layout={{
                            ...baseChartLayout,
                            xaxis: {
                              title: "Year",
                              type: "category",
                              autorange: true,
                              tickangle: -45,
                              tickfont: { size: 11 },
                            },
                            yaxis: {
                              title: `${showCRCP ? "CRCP" : "JCP"} Distresses per Mile`,
                              range: (() => {
                                // Get all distress values
                                const allValues = showCRCP
                                  ? [
                                    ...computedData.map(d => Number(d!.acpPatches) || 0),
                                    ...computedData.map(d => Number(d!.pccPatches) || 0),
                                    ...computedData.map(d => Number(d!.spalledCracks) || 0),
                                    ...computedData.map(d => Number(d!.punchouts) || 0)
                                  ]
                                  : [
                                    ...computedData.map(d => Number(d!.jcpFailedJoints) || 0),
                                    ...computedData.map(d => Number(d!.jcpFailures) || 0),
                                    ...computedData.map(d => Number(d!.jcpLongCracks) || 0),
                                    ...computedData.map(d => Number(d!.jcpPCCPatches) || 0),
                                    ...computedData.map(d => Number(d!.jcpShatteredSlabs) || 0)
                                  ];

                                // Find the maximum value
                                const maxValue = Math.max(...allValues);

                                // if max ≤ 10, use 10; otherwise max + 2
                                const yaxisMax = maxValue <= 10 ? 10 : maxValue + 2;

                                return [0, yaxisMax];
                              })(),
                              autorange: false,
                            },
                            barmode: "group",
                            legend: {
                              orientation: "h" as const,
                              y: 1.2,
                              x: 0.5,
                              xanchor: "center" as const,
                              yanchor: "bottom" as const,
                              bgcolor: "rgba(255,255,255,0.8)",
                              bordercolor: "lightgray",
                              borderwidth: 1,
                              traceorder: "normal" as const,
                              itemclick: false as false,
                              itemdoubleclick: false as false,
                            },

                            margin: {
                              r: 60,
                              t: 110,
                              b: 70,
                              l: 70,
                            },
                            // Update background colors
                            paper_bgcolor: "white",
                            plot_bgcolor: "rgba(249, 250, 251, 0.5)",
                          }}
                          config={{
                            responsive: true,
                            displayModeBar: true,
                          }}
                          style={{
                            width: "100%",
                            height: "100%",
                            minHeight: "450px",
                          }}
                        />
                      ) : (
                        <div className="flex items-center justify-center h-[450px]">
                          <p className="text-gray-500">Loading distress data...</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Render the MapModal when showMapModal is true */}
          {showMapModal && selectedHighway && (
            <PMISMapModal
              id={`map-modal-${selectedHighway}`}
              onClose={closeMapModal}
              highway={selectedHighway}
              county={selectedCounty}
            />
          )}
        </div>
      </section>
    </div>

  )
}

export default PMIS
