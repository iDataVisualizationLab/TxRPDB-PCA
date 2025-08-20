"use client"

import type React from "react"
import { useEffect, useState, useCallback, useMemo } from "react"
import Papa from "papaparse"
import { routePublic } from "@/config"
import { Button } from "@/components/ui/button"
import dynamic from "next/dynamic"
import { debounce } from "lodash"
import { sum } from "d3-array"
import { components } from "react-select"
import { useGlobalLoading } from "@/context/GlobalLoadingContext"
import { fetchProxy } from "@/lib/api";

// Load Plotly.js dynamically
const Plot = dynamic(() => import("react-plotly.js"), {
  ssr: false,
})

// Select component with loading state
const Select = dynamic(() => import("react-select"), {
  ssr: false,
})

// Color mapping for pavement types
const pavementTypeColors = {
  CRCP: "rgb(31, 119, 180)", // Blue
  JRCP: "rgb(255, 127, 14)", // Orange
  JPCP: "rgb(44, 160, 44)", // Green
}

// Client-side only component wrapper
function ClientOnly({ children }: { children: React.ReactNode }) {
  const [hasMounted, setHasMounted] = useState(false)

  useEffect(() => setHasMounted(true), [])

  return hasMounted ? <>{children}</> : null
}

// Type for chart data items
interface ChartDataItem {
  x: string[]
  y: number[]
  type: string
  name: string
  marker: {
    color: string
    line: {
      width: number
      color: string
    }
  }
  customdata?: Array<any> // Added for hover template data
  hovertemplate: string
}

// Type for combined data items
interface CombinedDataItem {
  CRCP: number
  JRCP: number
  JPCP: number
  year: string
  location: string
}

const LaneMiles = () => {
  // Core state
  interface DataItem {
    COUNTY: string
    RESPONSIBLE_DISTRICT: string
    DETAILED_PAV_TYPE: string
    EFF_YEAR: string
    TX_LENGTH: string
    [key: string]: any
  }

  const [data, setData] = useState<DataItem[]>([])
  const [chartData, setChartData] = useState<any[]>([])
  const [chartLayout, setChartLayout] = useState<any>({})
  const [isLoading, setIsLoading] = useState<boolean>(false)
  const [fieldMap, setFieldMap] = useState<{ [key: string]: keyof DataItem }>({
    COUNTY: "COUNTY",
    RESPONSIBLE_DISTRICT: "RESPONSIBLE_DISTRICT",
    DETAILED_PAV_TYPE: "DETAILED_PAV_TYPE",
    EFF_YEAR: "EFF_YEAR",
    TX_LENGTH: "TX_LENGTH",
  })
  const [initialLoading, setInitialLoading] = useState(true)

  // Filter state
  const [selectedLevel, setSelectedLevel] = useState<{ id: number; label: string }[]>([])
  const [selectedYears, setSelectedYears] = useState<string[]>([])
  const [selectedDistrict, setSelectedDistrict] = useState<string[]>([])
  const [selectedCounty, setSelectedCounty] = useState<string[]>([])
  const [selectedPavementTypes, setSelectedPavementTypes] = useState<string[]>([])
  const [averages, setAverages] = useState<{
    totalLength?: number
    totalCRCP?: number
    totalJRCP?: number
    totalJPCP?: number
  }>({})

  const { setLoading } = useGlobalLoading()

  useEffect(() => {
    setLoading(initialLoading)
  }, [initialLoading, setLoading])

  // Calculate averages from data
  const calculateAverages = (data: DataItem[]) => {
    if (!data.length) return {}

    const totalLength = sum(data, (item) => Number(item[fieldMap.TX_LENGTH]) || 0)
    const totalCRCP = sum(data, (item) =>
      item.DETAILED_PAV_TYPE?.includes("CRCP") ? Number(item[fieldMap.TX_LENGTH]) || 0 : 0,
    )
    const totalJRCP = sum(data, (item) =>
      item.DETAILED_PAV_TYPE?.includes("JRCP") ? Number(item[fieldMap.TX_LENGTH]) || 0 : 0,
    )
    const totalJPCP = sum(data, (item) =>
      item.DETAILED_PAV_TYPE?.includes("JPCP") ? Number(item[fieldMap.TX_LENGTH]) || 0 : 0,
    )

    return { totalLength, totalCRCP, totalJRCP, totalJPCP }
  }

  // Fetch CSV data
  const fetchData = useCallback(async () => {
    setIsLoading(true)
    try {
      // const response = await fetch(`${route}/general/Concrete_distresses.csv`)
      // const response = await fetchProxy(`/general/Concrete_distresses.csv`)
      const response = await fetch(`${routePublic}/files/Concrete_distresses.csv`)
      const csvText = await response.text()

      Papa.parse<DataItem>(csvText, {
        header: true,
        skipEmptyLines: true,
        dynamicTyping: true,
        complete: (results) => {
          if (results.data && Array.isArray(results.data)) {
            const filteredData = results.data.map((item: any) => ({
              COUNTY: item.COUNTY,
              RESPONSIBLE_DISTRICT: item.RESPONSIBLE_DISTRICT,
              DETAILED_PAV_TYPE: item.DETAILED_PAV_TYPE,
              EFF_YEAR: item.EFF_YEAR,
              TX_LENGTH: item.TX_LENGTH,
            }))
            setData(filteredData)
          }
          setIsLoading(false)
        },
        error: (error: Error) => {
          console.error("Error parsing CSV:", error)
          setIsLoading(false)
        },
      })
    } catch (error) {
      console.error("Error fetching data:", error)
      setIsLoading(false)
    }
  }, [])

  // Format location names (remove leading numbers/dashes)
  const formatLocationName = (name: string) => {
    if (!name) return name
    return name.replace(/^\s*\d+\s*[-–—_\s]+\s*/g, "")
  }

  // Generate dropdown options from data
  const getOptions = useCallback(
    (field: string) => {
      return Array.from(new Set(data.map((item) => item[fieldMap[field]])))
        .filter((value) => value !== null && value !== undefined)
        .sort()
        .map((value) => ({
          value: value.toString(),
          label: value.toString(),
        }))
    },
    [data, fieldMap],
  )

  // Helper function to format selected values for display
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

  // Load CSV data on component mount
  useEffect(() => {
    fetchData().finally(() => {
      setIsLoading(false)
      setInitialLoading(false)
    })
  }, [fetchData])

  // Detect field names when data loads
  useEffect(() => {
    if (data.length > 0) {
      const sampleItem = data[0]
      const keys = Object.keys(sampleItem)
      const newFieldMap = { ...fieldMap }

      keys.forEach((key) => {
        const upperKey = key.toUpperCase()
        if (upperKey === "COUNTY") newFieldMap.COUNTY = key
        else if (upperKey === "RESPONSIBLE_DISTRICT") newFieldMap.RESPONSIBLE_DISTRICT = key
        else if (upperKey === "DETAILED_PAV_TYPE") newFieldMap.DETAILED_PAV_TYPE = key
        else if (upperKey === "EFF_YEAR") newFieldMap.EFF_YEAR = key
        else if (upperKey.includes("LENGTH")) newFieldMap.TX_LENGTH = key
      })

      setFieldMap(newFieldMap)
    }
  }, [data])

  // Calculate initial averages when data is loaded
  useEffect(() => {
    if (data.length > 0) {
      const avg = calculateAverages(data)
      setAverages(avg)

      // Set initial chart data
      const initialChartData = [
        {
          x: [""],
          y: [avg.totalCRCP],
          type: "bar",
          name: "CRCP",
          marker: { color: pavementTypeColors.CRCP },
        },
        {
          x: [""],
          y: [avg.totalJRCP],
          type: "bar",
          name: "JRCP",
          marker: { color: pavementTypeColors.JRCP },
        },
        {
          x: [""],
          y: [avg.totalJPCP],
          type: "bar",
          name: "JPCP",
          marker: { color: pavementTypeColors.JPCP },
        },
      ]

      setChartData(initialChartData)
      setChartLayout({
        title: "Lane Miles by Pavement Type",
        xaxis: { title: "Pavement Type" },
        yaxis: { title: "Length (Lane-Miles)" },
        showlegend: true,
        legend: {
          x: 1.1,
          y: 0.9,
          xanchor: "left",
          yanchor: "top",
          bgcolor: "rgba(255,255,255,0.9)",
          bordercolor: "lightgray",
          borderwidth: 1,
          font: { size: 12 },
          itemsizing: "constant",
        },
        margin: { t: 50, r: 200, b: 50, l: 80 }, // Increased right margin to accommodate legend
        autosize: true,
      })
    }
  }, [data])

  // Filter data based on selections
  const filteredData = useMemo(() => {
    return data.filter((item) => {
      return (
        (!selectedLevel.length ||
          selectedLevel.some((level) => {
            if (level.label === "District") {
              return (
                selectedDistrict.length === 0 ||
                selectedDistrict.includes(item[fieldMap.RESPONSIBLE_DISTRICT].toString())
              )
            } else {
              return selectedCounty.length === 0 || selectedCounty.includes(item[fieldMap.COUNTY].toString())
            }
          })) &&
        (!selectedYears.length || selectedYears.includes(item[fieldMap.EFF_YEAR].toString())) &&
        (!selectedPavementTypes.length || selectedPavementTypes.some((type) => item.DETAILED_PAV_TYPE?.includes(type)))
      )
    })
  }, [data, selectedLevel, selectedYears, selectedDistrict, selectedCounty, selectedPavementTypes, fieldMap])

  // Options for dropdowns
  const pavementTypeOptions = useMemo(
    () => [
      { value: "CRCP", label: "CRCP", color: pavementTypeColors.CRCP },
      { value: "JRCP", label: "JRCP", color: pavementTypeColors.JRCP },
      { value: "JPCP", label: "JPCP", color: pavementTypeColors.JPCP },
    ],
    [],
  )

  const levelOptions = useMemo(
    () => [
      { id: 1, label: "District" },
      { id: 2, label: "County" },
    ],
    [],
  )

  const districtOptions = useMemo(
    () =>
      getOptions("RESPONSIBLE_DISTRICT").map((option) => ({
        ...option,
        label: formatLocationName(option.label),
      })),
    [getOptions],
  )

  const countyOptions = useMemo(
    () =>
      getOptions("COUNTY").map((option) => ({
        ...option,
        label: formatLocationName(option.label),
      })),
    [getOptions],
  )

  const yearOptions = useMemo(() => getOptions("EFF_YEAR"), [getOptions])

  // Apply filters and update chart
  const handleApplyFilter = useCallback(
    debounce(() => {
      if (selectedLevel.length === 0) {
        alert("Please select at least one level (District or County)")
        return
      }

      setIsLoading(true)

      // Filter data based on selected criteria
      const filteredData = data.filter((item) => {
        const yearMatch = selectedYears.length === 0 || selectedYears.includes(item[fieldMap.EFF_YEAR].toString())
        const typeMatch =
          selectedPavementTypes.length === 0 ||
          selectedPavementTypes.some((type) => item.DETAILED_PAV_TYPE?.includes(type))
        const locationMatch = selectedLevel.some((level) => {
          if (level.label === "District") {
            return (
              selectedDistrict.length === 0 || selectedDistrict.includes(item[fieldMap.RESPONSIBLE_DISTRICT].toString())
            )
          } else {
            return selectedCounty.length === 0 || selectedCounty.includes(item[fieldMap.COUNTY].toString())
          }
        })

        return yearMatch && typeMatch && locationMatch
      })

      if (filteredData.length === 0) {
        alert("No data matches the selected filters. Please try different criteria.")
        setIsLoading(false)
        return
      }

      // Update averages with filtered data
      setAverages(calculateAverages(filteredData))

      // Group data by location and pavement type
      const locationField = selectedLevel[0]?.label === "District" ? fieldMap.RESPONSIBLE_DISTRICT : fieldMap.COUNTY

      // Group data by year+location+pavementType for simpler display
      const combinedData: Record<string, CombinedDataItem> = {}

      filteredData.forEach((item) => {
        const year = item[fieldMap.EFF_YEAR]?.toString()
        const location = item[locationField]?.toString()
        const detailedPavType = item.DETAILED_PAV_TYPE || ""
        const length = Number.parseFloat(item[fieldMap.TX_LENGTH]) || 0

        if (!year || !location || isNaN(length)) return

        const formattedLocation = formatLocationName(location)
        // Create combined x-axis label: "Year - Location"
        const xLabel = `${year} - ${formattedLocation}`

        if (!combinedData[xLabel]) {
          combinedData[xLabel] = { CRCP: 0, JRCP: 0, JPCP: 0, year, location: formattedLocation }
        }

        if (detailedPavType.includes("CRCP")) combinedData[xLabel].CRCP += length
        if (detailedPavType.includes("JRCP")) combinedData[xLabel].JRCP += length
        if (detailedPavType.includes("JPCP")) combinedData[xLabel].JPCP += length
      })

      // Prepare chart data with simpler structure
      const xLabels = Object.keys(combinedData)
      const newChartData: ChartDataItem[] = []

        // Add traces for each pavement type
        ; (selectedPavementTypes.length === 0 ? ["CRCP", "JRCP", "JPCP"] : selectedPavementTypes).forEach((type) => {
          newChartData.push({
            x: xLabels,
            y: xLabels.map((label) => Number(combinedData[label][type as "CRCP" | "JRCP" | "JPCP"])),
            type: "bar",
            name: type,
            marker: {
              color: pavementTypeColors[type as keyof typeof pavementTypeColors] || "gray",
              line: { width: 1, color: "rgb(68, 68, 68)" },
            },
            customdata: xLabels.map((label) => {
              // Extract year and location from the label (format: "Year - Location")
              const [year, location] = label.split(" - ")
              return [year, location]
            }),
            hovertemplate: `
              <b>${type}</b><br>
              <b>Year:</b> %{customdata[0]}<br>
              <b>${selectedLevel[0]?.label || "Location"}:</b> %{customdata[1]}<br>
              <b>Lane Miles:</b> %{y:.2f}<br>
              <extra></extra>
            `,
          })
        })

      setChartData(newChartData)
      setChartLayout({
        title: `Lane Miles by Year and ${selectedLevel[0]?.label}`,
        xaxis: {
          title: "", // No title needed as labels are self-explanatory
          tickangle: -45, // 45-degree angle for better readability
          automargin: true,
          tickfont: { size: 10 },
        },
        yaxis: { title: "Length (Lane-Miles)" },
        barmode: "group",
        autosize: true,
        margin: { t: 130, r: 200, b: 160, l: 120 }, // Increased right margin for legend
        showlegend: true,
        legend: {
          x: 1.1,
          y: 0.9,
          xanchor: "left",
          yanchor: "top",
          bgcolor: "rgba(255,255,255,0.9)",
          bordercolor: "lightgray",
          borderwidth: 1,
          font: { size: 12 },
          itemsizing: "constant",
          traceorder: "normal",
        },
        paper_bgcolor: "white",
        plot_bgcolor: "rgba(249, 250, 251, 0.5)",
      })

      setIsLoading(false)
    }, 300),
    [
      data,
      selectedLevel,
      selectedYears,
      selectedDistrict,
      selectedCounty,
      selectedPavementTypes,
      fieldMap,
      calculateAverages,
    ],
  )

  // Reset all filters
  const resetFilters = useCallback(() => {
    setSelectedLevel([])
    setSelectedYears([])
    setSelectedDistrict([])
    setSelectedCounty([])
    setSelectedPavementTypes([])
    setChartData([])
    setAverages(calculateAverages(data))
  }, [data])

  // Export data to CSV
  const exportToCSV = useCallback(() => {
    if (!chartData || chartData.length === 0) {
      alert("No data to export. Please apply filters first.")
      return
    }

    try {
      const level = selectedLevel[0]?.label
      const locations = chartData[0]?.x

      if (!locations || !Array.isArray(locations)) {
        alert("Error exporting data. Please try again.")
        return
      }

      const pavementTypes = chartData.map((trace) => trace.name)
      const csvRows = []
      const headers = [level, "Year", ...pavementTypes]
      csvRows.push(headers.join(","))

      locations.forEach((location, index) => {
        selectedYears.forEach((year) => {
          const row = [
            location,
            year,
            ...pavementTypes.map((type) => {
              const traceIndex = chartData.findIndex((trace) => trace.name === type)
              const value = chartData[traceIndex]?.y[index]
              return value === undefined || value === null ? "0" : value.toString()
            }),
          ]
          csvRows.push(row.join(","))
        })
      })

      const csvContent = csvRows.join("\n")
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" })
      const url = URL.createObjectURL(blob)

      const link = document.createElement("a")
      link.setAttribute("href", url)
      link.setAttribute("download", `lane_miles_${new Date().toISOString().slice(0, 10)}.csv`)
      link.style.visibility = "hidden"
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
    } catch (error) {
      console.error("Error exporting data:", error)
      alert("Error exporting data. Please check the console for details.")
    }
  }, [chartData, selectedLevel, selectedYears])

  // Custom MenuList component for multi-select with "Select All" option
  const MenuList = ({ children, ...props }: any) => {
    const selectProps = props.selectProps
    const [selectAll, setSelectAll] = useState(false)

    const allSelected = useMemo(() => {
      const selectedValues = (selectProps.value || []).map((item: any) => item.value)
      return (
        selectProps.options.length > 0 &&
        selectProps.options.every((option: any) => selectedValues.includes(option.value))
      )
    }, [selectProps.value, selectProps.options])

    const toggleSelectAll = () => {
      if (allSelected) {
        selectProps.onChange([], { action: "clear" })
      } else {
        selectProps.onChange(selectProps.options, { action: "select-option" })
      }
      setSelectAll(!selectAll)
    }

    return (
      <components.MenuList {...props}>
        <div className="px-2 py-1">
          <div className="flex items-center gap-2">
            <div className="relative inline-block">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleSelectAll}
                className="peer w-4 h-4 border border-gray-300 rounded bg-white 
                  checked:bg-blue-600 checked:border-blue-600 hover:border-blue-500 
                  focus:outline-none focus:ring-2 focus:ring-blue-500 
                  focus:ring-offset-0 transition-colors cursor-pointer appearance-none"
              />
              {allSelected && (
                <svg
                  className="absolute top-0 left-0 w-4 h-4 pointer-events-none text-white"
                  viewBox="0 0 16 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <path d="M4 8l2 2 6-6" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              )}
            </div>
            <span className="text-sm text-gray-700 select-none cursor-pointer" onClick={toggleSelectAll}>
              Select All
            </span>
          </div>
        </div>
        {children}
      </components.MenuList>
    )
  }

  // Custom Option component for multi-select checkboxes
  const Option = ({ children, isSelected, innerProps, ...props }: any) => {
    const handleSelect = (e: React.MouseEvent) => {
      e.preventDefault()
      e.stopPropagation()
      props.selectOption(props.data)
    }

    return (
      <div className="flex items-center gap-2 px-2 py-1 hover:bg-gray-100" {...innerProps}>
        <div className="relative inline-block">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={() => null}
            onClick={handleSelect}
            className="peer w-4 h-4 border border-gray-300 rounded bg-white 
              checked:bg-blue-600 checked:border-blue-600 hover:border-blue-500 
              focus:outline-none focus:ring-2 focus:ring-blue-500 
              focus:ring-offset-0 transition-colors cursor-pointer appearance-none"
          />
          {isSelected && (
            <svg
              className="absolute top-0 left-0 w-4 h-4 pointer-events-none text-white"
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path d="M4 8l2 2 6-6" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
        <span className="text-sm text-gray-700 select-none cursor-pointer">{children}</span>
      </div>
    )
  }

  return (

    <div className="h-full">
      <section className="h-full overflow-auto px-4 py-4">
        <div className="flex flex-col sm:py-06 sm:gap-y-3">
          {/* Filters */}
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
                      Select <strong>Level</strong> (District or County)
                    </li>
                    <li>
                      Select one or more <strong>Districts/Counties</strong>
                    </li>
                    <li>
                      Select one or more <strong>Years</strong>
                    </li>
                    <li>
                      Optionally select <strong>Pavement Types</strong>
                    </li>
                  </ol>
                  <p>Then click Apply Filters to generate the chart.</p>
                </div>
              </div>
            </div>

            <div className="flex flex-col items-center gap-3">
              {/* Filter selections */}
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 w-full">
                {/* Level selection */}
                <div>
                  <label className="block text-sm font-semibold mb-1">Level</label>
                  <ClientOnly>
                    <Select
                      options={levelOptions}
                      value={selectedLevel}
                      onChange={(option) => setSelectedLevel(option ? [option as { id: number; label: string }] : [])}
                      placeholder="Select Level"
                      isClearable
                    />
                  </ClientOnly>
                </div>

                {/* District/County selection */}
                {selectedLevel[0]?.label === "District" ? (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Districts</label>
                    <Select
                      isMulti
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      components={{ MenuList, Option }}
                      className="multi-select"
                      options={districtOptions}
                      value={districtOptions.filter((option) => selectedDistrict.includes(option.value))}
                      onChange={(newValue: unknown) => {
                        const selectedOptions = newValue as Array<{ value: string; label: string }>
                        setSelectedDistrict(selectedOptions ? selectedOptions.map((option) => option.value) : [])
                      }}
                      placeholder={!selectedLevel.length ? "Select Level first" : "Select Districts"}
                      isDisabled={!selectedLevel.length}
                    />
                    {selectedDistrict.length > 0 && (
                      <div className="text-xs mt-0.5 text-blue-600 truncate">{selectedDistrict.length} selected</div>
                    )}
                  </div>
                ) : selectedLevel[0]?.label === "County" ? (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Counties</label>
                    <Select
                      isMulti
                      closeMenuOnSelect={false}
                      hideSelectedOptions={false}
                      components={{ MenuList, Option }}
                      className="multi-select"
                      options={countyOptions}
                      value={countyOptions.filter((option) => selectedCounty.includes(option.value))}
                      onChange={(newValue: unknown) => {
                        const selectedOptions = newValue as Array<{ value: string; label: string }>
                        setSelectedCounty(selectedOptions ? selectedOptions.map((option) => option.value) : [])
                      }}
                      placeholder={!selectedLevel.length ? "Select Level first" : "Select Counties"}
                      isDisabled={!selectedLevel.length}
                    />
                    {selectedCounty.length > 0 && (
                      <div className="text-xs mt-0.5 text-blue-600 truncate">{selectedCounty.length} selected</div>
                    )}
                  </div>
                ) : (
                  <div>
                    <label className="block text-sm font-semibold mb-1">Districts/Counties</label>
                    <Select isDisabled={true} placeholder="Select Level first" />
                  </div>
                )}

                {/* Years selection */}
                <div>
                  <label className="block text-sm font-semibold mb-1">Years</label>
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    components={{ MenuList, Option }}
                    className="multi-select"
                    options={yearOptions}
                    value={yearOptions.filter((option) => selectedYears.includes(option.value))}
                    onChange={(selectedOptions) =>
                      setSelectedYears(
                        selectedOptions
                          ? (selectedOptions as Array<{ value: string; label: string }>).map((option) => option.value)
                          : [],
                      )
                    }
                    placeholder={
                      !selectedLevel.length
                        ? "Select Level first"
                        : (selectedLevel[0]?.label === "District" && !selectedDistrict.length) ||
                          (selectedLevel[0]?.label === "County" && !selectedCounty.length)
                          ? `Select ${selectedLevel[0]?.label}s first`
                          : "Select Years"
                    }
                    isDisabled={
                      !selectedLevel.length ||
                      (selectedLevel[0]?.label === "District" && !selectedDistrict.length) ||
                      (selectedLevel[0]?.label === "County" && !selectedCounty.length)
                    }
                  />
                  {selectedYears.length > 0 && (
                    <div className="text-xs mt-0.5 text-blue-600 truncate">{selectedYears.length} selected</div>
                  )}
                </div>

                {/* Pavement Types */}
                <div>
                  <label className="block text-sm font-semibold mb-1">Pavement Types</label>
                  <Select
                    isMulti
                    closeMenuOnSelect={false}
                    hideSelectedOptions={false}
                    components={{ MenuList, Option }}
                    className="multi-select"
                    options={pavementTypeOptions}
                    value={pavementTypeOptions.filter((option) => selectedPavementTypes.includes(option.value))}
                    onChange={(newValue: unknown) => {
                      const selectedOptions = newValue as Array<{ value: string; label: string }>
                      setSelectedPavementTypes(selectedOptions ? selectedOptions.map((option) => option.value) : [])
                    }}
                    placeholder={
                      !selectedLevel.length
                        ? "Select Level first"
                        : (selectedLevel[0]?.label === "District" && !selectedDistrict.length) ||
                          (selectedLevel[0]?.label === "County" && !selectedCounty.length)
                          ? `Select ${selectedLevel[0]?.label}s first`
                          : !selectedYears.length
                            ? "Select Years first"
                            : "Select Pavement Types"
                    }
                    isDisabled={
                      !selectedLevel.length ||
                      (selectedLevel[0]?.label === "District" && !selectedDistrict.length) ||
                      (selectedLevel[0]?.label === "County" && !selectedCounty.length) ||
                      !selectedYears.length
                    }
                  />
                  {selectedPavementTypes.length > 0 && (
                    <div className="text-xs mt-0.5 text-blue-600 truncate">{selectedPavementTypes.length} selected</div>
                  )}
                </div>
              </div>

              {/* Action Buttons*/}
              <div className="flex flex-wrap justify-center gap-2 mt-2">
                <Button
                  onClick={handleApplyFilter}
                  className="bg-blue-600 text-white hover:bg-blue-700 flex items-center gap-1 px-3 py-1 h-8 text-sm"
                  disabled={isLoading}
                >
                  Apply Filters
                </Button>

                <Button
                  onClick={resetFilters}
                  className="bg-gray-200 text-gray-700 hover:bg-gray-300 h-8 px-3 py-1 text-sm"
                  disabled={isLoading}
                >
                  Reset
                </Button>

                <button
                  onClick={exportToCSV}
                  className="px-3 py-1 bg-green-600 text-white text-sm rounded-md hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-opacity-50 transition-colors flex items-center gap-1 h-8"
                  title="Export to CSV"
                  disabled={!chartData || chartData.length === 0}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" fill="currentColor" viewBox="0 0 16 16">
                    <path d="M.5 9.9a.5.5 0 0 1 .5.5v2.5a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-2.5a.5.5 0 0 1 1 0v2.5a2 2 0 0 1-2 2H2a2 2 0 0 1-2-2v-2.5a.5.5 0 0 1 .5-.5z" />
                    <path d="M7.646 11.854a.5.5 0 0 0 .708 0l3-3a.5.5 0 0 0-.708-.708L8.5 10.293V1.5a.5.5 0 0 0-1 0v8.793L5.354 8.146a.5.5 0 1 0-.708.708l3 3z" />
                  </svg>
                  Export
                </button>
              </div>
            </div>
          </div>

          {/* Data Summary */}
          <div className="bg-white border rounded-lg p-4 shadow-sm max-w-7xl w-full mx-auto">
            <div className="flex items-center gap-2 mb-2">
              <h2 className="text-lg font-semibold">Summary</h2>
              <div className="relative group">
                <div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center cursor-help text-gray-600 hover:bg-gray-300 transition-colors">
                  <span className="text-xs font-bold">i</span>
                </div>
                <div className="absolute left-0 top-full mt-2 w-72 bg-white shadow-lg rounded-lg p-3 text-sm text-gray-700 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-gray-200">
                  <p className="mb-2">
                    <strong>Lane Miles Analysis Summary</strong>
                  </p>
                  <p className="mb-2">
                    This summary displays the total lane miles across Texas, broken down by concrete pavement types:
                  </p>
                  <ul className="list-disc pl-5 mb-2">
                    <li>
                      <span className="text-blue-700 font-medium">CRCP</span>: Continuously Reinforced Concrete Pavement
                    </li>
                    <li>
                      <span className="text-orange-700 font-medium">JRCP</span>: Jointed Reinforced Concrete Pavement
                    </li>
                    <li>
                      <span className="text-green-700 font-medium">JPCP</span>: Jointed Plain Concrete Pavement
                    </li>
                  </ul>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
              <div className="bg-gray-50 p-3 rounded">
                <div className="text-sm text-gray-500">Total Lane Miles</div>
                <div className="text-xl font-bold">
                  {isLoading ? (
                    <div className="h-6 w-24 bg-gray-200 animate-pulse rounded"></div>
                  ) : (
                    `${averages.totalLength?.toLocaleString(undefined, { maximumFractionDigits: 0 })} miles`
                  )}
                </div>
              </div>
              <div className="bg-blue-50 p-3 rounded">
                <div className="text-sm text-gray-500">CRCP</div>
                <div className="text-xl font-bold text-blue-700">
                  {averages.totalCRCP?.toLocaleString(undefined, { maximumFractionDigits: 0 })} miles
                </div>
                <div className="text-xs text-gray-500">
                  ({(((averages.totalCRCP || 0) / (averages.totalLength || 1)) * 100).toFixed(0)}%)
                </div>
              </div>
              <div className="bg-orange-50 p-3 rounded">
                <div className="text-sm text-gray-500">JRCP</div>
                <div className="text-xl font-bold text-orange-700">
                  {averages.totalJRCP?.toLocaleString(undefined, { maximumFractionDigits: 0 })} miles
                </div>
                <div className="text-xs text-gray-500">
                  ({(((averages.totalJRCP || 0) / (averages.totalLength || 1)) * 100).toFixed(0)}%)
                </div>
              </div>
              <div className="bg-green-50 p-3 rounded">
                <div className="text-sm text-gray-500">JPCP</div>
                <div className="text-xl font-bold text-green-700">
                  {averages.totalJPCP?.toLocaleString(undefined, { maximumFractionDigits: 0 })} miles
                </div>
                <div className="text-xs text-gray-500">
                  ({(((averages.totalJPCP || 0) / (averages.totalLength || 1)) * 100).toFixed(0)}%)
                </div>
              </div>
            </div>
            <div className="text-xs text-gray-500 mt-2">
              This summary shows the total lane miles across all available data, broken down by pavement type. Values will
              update when filters are applied.
            </div>
          </div>

          {/* Chart */}
          <div className="bg-white border rounded-lg p-4 shadow-sm max-w-7xl w-full mx-auto">
            <div className="w-full" style={{ minHeight: "400px" }}>
              {chartData && chartData.length > 0 ? (
                <Plot
                  data={chartData}
                  layout={chartLayout}
                  config={{
                    responsive: true,
                    displayModeBar: true,
                    displaylogo: false,
                    modeBarButtonsToRemove: ["lasso2d", "select2d"],
                  }}
                  style={{ width: "100%", height: "600px" }}
                  useResizeHandler={true}
                />
              ) : !isLoading && (
                <div className="flex items-center justify-center h-[400px] w-full bg-gray-50 rounded-lg border">
                  <div className="text-lg text-gray-500">
                    No chart data to display. Please apply filters.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </div>

  )
}

export default LaneMiles