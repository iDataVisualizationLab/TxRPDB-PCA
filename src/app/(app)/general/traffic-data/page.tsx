"use client"

import dynamic from "next/dynamic"
import React, { useRef, useState, useEffect, useMemo, useCallback } from "react"
import FeatureLayer from "@arcgis/core/layers/FeatureLayer"
import Graphic from "@arcgis/core/Graphic"
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer"
import PopupTemplate from "@arcgis/core/PopupTemplate"
import * as XLSX from "xlsx"
import { routePublic } from "@/config"

import * as reactiveUtils from "@arcgis/core/core/reactiveUtils"
import { useGlobalLoading } from "@/context/GlobalLoadingContext"
import type Map from "@arcgis/core/Map"
import type MapView from "@arcgis/core/views/MapView"
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer"
import { API_GET_PROXY } from "@/lib/api";
const DynamicMapComponent = dynamic(() => import("@/components/map-arcgis/map"), { ssr: false })

const Plot = dynamic(() => import("react-plotly.js"), {
ssr: false,
})

const ResponsiveTooltip = ({ title, children }: { title: string; children: React.ReactNode }) => (
<div className="relative group inline-block ml-2">
<div className="w-5 h-5 rounded-full bg-gray-200 flex items-center justify-center cursor-help text-gray-600 hover:bg-gray-300 transition-colors">
<span className="text-xs font-bold">i</span>
</div>
<div className="absolute transform -translate-x-1/2 left-1/2 top-full mt-2 w-80 max-w-[calc(100vw-2rem)] bg-white shadow-lg rounded-lg p-3 text-sm text-gray-700 invisible group-hover:visible opacity-0 group-hover:opacity-100 transition-opacity z-10 border border-gray-200">
<div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 rotate-225 w-2 h-2 bg-white border-l border-t border-gray-200"></div>
<p className="font-bold mb-1">{title}</p>
{children}
</div>
</div>
)

interface AADTDataItem {
year: number
aadt: number
// truckPercentage: number | null
}

const TruckPercentagePage = () => {
// Map references
const mapRef = useRef<Map | null>(null)
const viewRef = useRef<MapView | null>(null)
const highlightLayerRef = useRef<GraphicsLayer | null>(null)
const mapInitializedRef = useRef<boolean>(false)

// State
const [chartData, setChartData] = useState<any[]>([])
const [chartLayout, setChartLayout] = useState<any>({})
const [selectedLocation, setSelectedLocation] = useState<string | null>(null)
const [isLoading, setIsLoading] = useState<boolean>(false)
const [initialLoading, setInitialLoading] = useState<boolean>(true)
const [aadtData, setAadtData] = useState<AADTDataItem[]>([])
const [aadtFeature, setAadtFeature] = useState<Graphic | null>(null)
const [pointCounts, setPointCounts] = useState({
total: 0,
loaded: false,
loading: false,
})
const [visiblePointCount, setVisiblePointCount] = useState(0)

// DOM references
const rightPanelRef = useRef<HTMLDivElement>(null)
const mapContainerRef = useRef<HTMLDivElement>(null)

// Global loading context
const { setLoading } = useGlobalLoading()

// Resize handling
const resizeMapContainer = useCallback(() => {
if (!mapContainerRef.current || !viewRef.current) return

mapContainerRef.current.style.height = `calc(100vh - 2rem)`

try {
if (viewRef.current?.container) {
viewRef.current.container.style.height = `${mapContainerRef.current.clientHeight}px`
viewRef.current.container.style.width = `${mapContainerRef.current.clientWidth}px`

setTimeout(() => {
if (viewRef.current && "resize" in viewRef.current) {
;(viewRef.current as any).resize()
} else if (viewRef.current) {
window.dispatchEvent(new Event("resize"))
}
}, 0)
}
} catch (e) {
console.warn("Error resizing map view:", e)
}
}, [])

useEffect(() => {
if (!rightPanelRef.current || !mapContainerRef.current) return

let timeoutId: any = null
const debouncedResize = () => {
if (timeoutId) clearTimeout(timeoutId)
timeoutId = setTimeout(resizeMapContainer, 100)
}

resizeMapContainer()

const resizeObserver = new ResizeObserver(debouncedResize)
resizeObserver.observe(rightPanelRef.current)
window.addEventListener("resize", debouncedResize)

return () => {
resizeObserver.disconnect()
window.removeEventListener("resize", debouncedResize)
if (timeoutId) clearTimeout(timeoutId)

if (highlightLayerRef.current) {
// Cleanup any running pulse timers/animations
const layerAny = highlightLayerRef.current as any
const intervalId = layerAny["pulseIntervalId"]
if (intervalId) clearInterval(intervalId)
const rafId = layerAny["pulseRafId"]
if (rafId) cancelAnimationFrame(rafId)
}
}
}, [resizeMapContainer])

useEffect(() => {
const timeout = setTimeout(() => {
if (initialLoading) {
console.log("Fallback timeout triggered - forcing loading state to complete")
setInitialLoading(false)
}
}, 10000)

return () => clearTimeout(timeout)
}, [initialLoading])

useEffect(() => {
setLoading(initialLoading || isLoading)
}, [initialLoading, isLoading, setLoading])

function debounce<F extends (...args: any[]) => any>(func: F, wait: number): (...args: Parameters<F>) => void {
let timeout: NodeJS.Timeout | null = null

return (...args: Parameters<F>) => {
if (timeout) clearTimeout(timeout)
timeout = setTimeout(() => func(...args), wait)
}
}

const createLayers = () => {
// Create popup template for the GeoJSON layer
const popupTemplate = new PopupTemplate({
title: "<span style='color:#fc8d62;'>Highway Segment Info</span>",
content: `
       <b>Highway:</b> {TX_SIGNED_HIGHWAY_RDBD_ID}<br>
       <b>Year:</b> {EFF_YEAR}<br>
       <b>County:</b> {COUNTY}<br>
       <b>Begin RM:</b> {TX_BEG_REF_MARKER_NBR} + {TX_BEG_REF_MRKR_DISP}<br>
       <b>End RM:</b> {TX_END_REF_MARKER_NBR} + {TX_END_REF_MRKR_DISP}<br>
       <b>AADT:</b> {TX_AADT_CURRENT}<br>
       <!-- <b>Truck %:</b> {TX_TRUCK_AADT_PCT}<br> -->
       <b>Condition:</b> {TX_CONDITION_SCORE}
     `,
})

// Create the GeoJSON layer
const geoJSONLayer = new GeoJSONLayer({
url: `${routePublic}/files/pmis_lines_latest.geojson`,
title: "Highway Segments",
popupTemplate,
outFields: ["*"],
renderer: {
type: "simple",
symbol: {
type: "simple-line",
color: "rgba(0, 0, 0, 0.4)",
width: 2,
},
},
visible: true,
})

// Create the AADT layer
const AADTLayer = new FeatureLayer({
url: "https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_TPP_Annual_AADT_Data_(SPM_View)/FeatureServer/0",
outFields: ["*"],
title: "AADT",
renderer: {
type: "simple",
symbol: {
type: "simple-marker",
size: 6,
color: "#fc8d62",
outline: { width: 0.8, color: "black" },
},
},
labelingInfo: [],
definitionExpression: "ZLEVEL < 7",
visible: true,
})

const REFLayer = new FeatureLayer({
url: "https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Reference_Markers/FeatureServer/0",
title: "Reference Markers",
labelingInfo: [
{
symbol: {
type: "text",
color: "#fc8d62",
haloColor: "#FFFFFF",
haloSize: "1px",
font: { size: "12px", family: "Arial", weight: "bold" },
},
labelPlacement: "above-center",
labelExpressionInfo: { expression: "$feature.MRKR_NBR" },
},
],
renderer: {
type: "simple",
symbol: {
type: "simple-marker",
color: "#636363",
size: 5,
outline: { color: "#636363", width: 1 },
},
},
definitionExpression: "MOD(MRKR_NBR, 200) = 0",
})

return { geoJSONLayer, AADTLayer, REFLayer }
}

const { geoJSONLayer, AADTLayer, REFLayer } = useMemo(createLayers, [])

const updateVisiblePointCount = useCallback(
debounce((view: MapView) => {
if (!AADTLayer || !view) return

setPointCounts((prev) => ({ ...prev, loading: true }))

// Get total count if not already loaded
if (!pointCounts.loaded) {
AADTLayer.queryFeatureCount({
where: "1=1",
})
.then((totalCount) => {
console.log(`Total AADT points in database: ${totalCount}`)
setPointCounts((prev) => ({
...prev,
total: totalCount,
loaded: true,
}))
})
.catch((error: any) => {
console.error("Error counting total points:", error)
})
}

// Always query visible points
const extent = view.extent
const query = AADTLayer.createQuery()
query.geometry = extent
query.spatialRelationship = "intersects"
query.where = AADTLayer.definitionExpression

console.log(`Querying visible points with filter: ${query.where} at zoom ${view.zoom.toFixed(2)}`)

AADTLayer.queryFeatureCount(query)
.then((count) => {
console.log(`Found ${count} visible stations at zoom ${view.zoom.toFixed(2)}`)
setVisiblePointCount(count)
setPointCounts((prev) => ({ ...prev, loading: false }))
})
.catch((error: any) => {
console.error("Error counting visible points:", error)
setPointCounts((prev) => ({ ...prev, loading: false }))
})
}, 300),
[AADTLayer, pointCounts.loaded],
)

const getActiveLayers = useCallback(
(zoom: number) => {
if (!AADTLayer) return

let defExpression
if (zoom < 6) {
defExpression = "ZLEVEL < 7"
} else if (zoom >= 6 && zoom <= 13) {
defExpression = `ZLEVEL < ${Math.ceil(zoom + 1)}`
} else {
defExpression = "ZLEVEL <= 13"
}

AADTLayer.definitionExpression = defExpression
console.log(`Updated AADTLayer filter to: ${defExpression} at zoom level ${zoom}`)

if (viewRef.current) {
updateVisiblePointCount(viewRef.current)
}
},
[AADTLayer, updateVisiblePointCount],
)

const handleMapLoaded = useCallback(
(map: Map, view: MapView) => {
viewRef.current = view
mapRef.current = map
mapInitializedRef.current = true

updateVisiblePointCount(view)

reactiveUtils.when(
() => !view.updating,
() => updateVisiblePointCount(view),
{ initial: true },
)

view.watch("extent", () => {
if (!view.updating) {
console.log("Map extent changed, updating point count")
updateVisiblePointCount(view)
}
})

view.watch("zoom", (newZoom: number) => {
console.log(`Zoom changed to ${newZoom}`)
getActiveLayers(newZoom)

if (!view.updating) {
updateVisiblePointCount(view)
}
})

const highlightLayer = new GraphicsLayer({
title: "Highlights",
listMode: "hide",
})
map.add(highlightLayer)
highlightLayerRef.current = highlightLayer

if (view.popup) {
view.popup.autoCloseEnabled = true
view.popup.dockEnabled = false

if ("visible" in view.popup) {
view.popup.visible = false
}
}

map.layers.forEach((layer: any) => {
if (layer.type === "feature") {
try {
;(layer as any).popupEnabled = false
} catch (e) {
console.warn("Error disabling popup on layer:", e)
}
}
})

setPointCounts((prev) => ({ ...prev, loading: true }))

AADTLayer.queryFeatureCount({
where: "1=1",
})
.then((totalCount) => {
setPointCounts({
total: totalCount,
loaded: true,
loading: false,
})
console.log(`Total AADT points in database: ${totalCount}`)
})
.catch((error: any) => {
console.error("Error counting points:", error)
setPointCounts({
total: 0,
loaded: true,
loading: false,
})
})

view.on("click", async (event: any) => {
view
.hitTest(event)
.then(async (response: any) => {
const graphicResult = response.results?.find((result: any) => {
return result.type === "graphic" && "graphic" in result && result.graphic?.layer?.id === AADTLayer.id
})
const aadtFeature = graphicResult && "graphic" in graphicResult ? (graphicResult.graphic as Graphic) : null

if (aadtFeature) {
// Only set loading for the data panel, not the map
setIsLoading(true)

// Stop any running animations from prior selection
if (highlightLayerRef.current) {
const layerAny = highlightLayerRef.current as any
const prevInterval = layerAny["pulseIntervalId"]
if (prevInterval) clearInterval(prevInterval)
const prevRaf = layerAny["pulseRafId"]
if (prevRaf) cancelAnimationFrame(prevRaf)
}

highlightLayer.removeAll()

        // Orange center (#FF9800) with thicker black outline
const centerGraphic = new Graphic({
geometry: aadtFeature.geometry,
symbol: {
type: "simple-marker",
style: "circle",
                  size: 8,
color: [255, 152, 0, 1], // Orange (#FF9800)
          outline: { color: [0, 0, 0, 1], width: 2 },
},
})

// Blue pulsing ring (transparent fill, blue outline)
const minSize = 22
const maxSize = 40
let size = minSize
let growing = true

const ringGraphic = new Graphic({
geometry: aadtFeature.geometry,
symbol: {
type: "simple-marker",
style: "circle",
size,
color: [33, 150, 243, 0], // transparent fill
outline: { color: [33, 150, 243, 0.8], width: 2 },
},
})

highlightLayer.addMany([centerGraphic, ringGraphic])

const animate = () => {
if (!highlightLayerRef.current) return

if (growing) {
size += 0.6
if (size >= maxSize) growing = false
} else {
size -= 0.6
if (size <= minSize) growing = true
}

const t = Math.max(0, Math.min(1, (size - minSize) / (maxSize - minSize)))
const alpha = 0.8 * (1 - t) + 0.2 // fade out as it grows

try {
ringGraphic.symbol = {
type: "simple-marker",
style: "circle",
size,
color: [33, 150, 243, 0],
outline: { color: [33, 150, 243, alpha], width: 2 },
}
} catch (e) {
// If symbol update fails (e.g., map unmounted), stop animating
return
}

const rafId = requestAnimationFrame(animate)
;(highlightLayerRef.current as any)["pulseRafId"] = rafId
}

animate()

setAadtFeature(aadtFeature)

const attributes = aadtFeature.attributes
const location = attributes.ON_ROAD || attributes.RTE_NM || "Unknown Location"
setSelectedLocation(location)

// Query the GeoJSON layer to find matching segments for this highway
let processedData: AADTDataItem[] = []

if (location !== "Unknown Location") {
const highway = location.split(" ")[0] // Extract highway designation (e.g., "IH0020")

if (highway) {
// Query the GeoJSON layer for segments matching this highway
const query = geoJSONLayer.createQuery()
query.where = `TX_SIGNED_HIGHWAY_RDBD_ID LIKE '${highway}%'`
query.outFields = ["*"]

try {
const result = await geoJSONLayer.queryFeatures(query)

if (result.features && result.features.length > 0) {
// Process the truck percentage data from the GeoJSON
/*
                     const truckData = result.features
                       .map((feature) => {
                         const attrs = feature.attributes
                         return {
                           year: attrs.EFF_YEAR,
                           aadt: attrs.TX_AADT_CURRENT,
                           truckPercentage: attrs.TX_TRUCK_AADT_PCT,
                         }
                       })
                       .filter((item) => item.aadt > 0 && item.truckPercentage !== null)

                     // Update the AADT data with truck percentages
                     if (truckData.length > 0) {
                       // Find the most recent truck percentage data
                       const latestTruckData = truckData.sort((a, b) => b.year - a.year)[0]

                       // Add truck percentage to the AADT data
                       processedData = dataUtils.processAadtData(attributes, location).map((item) => ({
                         ...item,
                         truckPercentage: latestTruckData.truckPercentage,
                       }))
                     } else {
                       // If no truck data found, use regular AADT data
                       processedData = dataUtils.processAadtData(attributes, location)
                     }
                     */
processedData = dataUtils.processAadtData(attributes, location)
} else {
// If no matching segments found, use regular AADT data
processedData = dataUtils.processAadtData(attributes, location)
}
} catch (error) {
console.error("Error querying GeoJSON layer:", error)
processedData = dataUtils.processAadtData(attributes, location)
}
} else {
processedData = dataUtils.processAadtData(attributes, location)
}
} else {
processedData = dataUtils.processAadtData(attributes, location)
}

// Update AADT data state
setAadtData(processedData)

// Create chart data AFTER we have the processed data
const { chartData, chartLayout } = chartUtils.createChartData(
processedData,
location,
aadtFeature.attributes?.TRFC_STATN_ID || null,
)

// Update chart states
setChartData(chartData)
setChartLayout(chartLayout)

// Finally, set loading to false
setIsLoading(false)
}
})
.catch((error: any) => {
console.error("Error processing hit test:", error)
setIsLoading(false)
})
})

setTimeout(() => {
setInitialLoading(false)
}, 500)
},
[AADTLayer.id, geoJSONLayer, updateVisiblePointCount, getActiveLayers],
)

const mapProps = useMemo(
() => ({
basemapUrl:
"https://tiles.arcgis.com/tiles/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Vector_Tile_Basemap/VectorTileServer",
layers: [
{
layer: AADTLayer,
name: "AADT",
visible: true,
legendColor: "#fc8d62",
legendShape: "dot" as "dot" | "line" | "square",
},
{
layer: REFLayer,
name: "Reference Markers",
visible: false,
},
],
showLegend: true,
onMapLoaded: handleMapLoaded,
id: "traffic-map",
preserveView: true,
visiblePointCount: visiblePointCount,
totalPointCount: pointCounts.total,
}),
[AADTLayer, REFLayer, handleMapLoaded, visiblePointCount, pointCounts.total],
)

const exportToExcel = (data: AADTDataItem[], location: string | null) => {
const worksheet = XLSX.utils.json_to_sheet(
data.map((item) => ({
Year: item.year,
AADT: item.aadt,
// "Truck Percentage": item.truckPercentage !== null ? `${item.truckPercentage}%` : "N/A",
})),
)

worksheet["!cols"] = [
{ wch: 10 }, // Year column
{ wch: 15 }, // AADT column
// { wch: 15 }, // Truck Percentage column
]

data.forEach((_, idx) => {
const cell = XLSX.utils.encode_cell({ r: idx + 1, c: 1 })
if (worksheet[cell]) worksheet[cell].z = "#,##0"
})

const workbook = XLSX.utils.book_new()
XLSX.utils.book_append_sheet(workbook, worksheet, "Traffic Data")

const filename = `Traffic_Data_${location ? location.replace(/\s+/g, "_") : "Location"}_${new Date().toISOString().split("T")[0]}.xlsx`
XLSX.writeFile(workbook, filename)
}

return (
<div className="flex flex-col h-screen">
{initialLoading ? (
<div className="h-screen"></div>
) : (
<div className="grid grid-cols-1 md:grid-cols-2 gap-4 h-screen w-full p-4 bg-gray-100">
{/* Map container */}
<div className="h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white">
<div id="mapContainer" ref={mapContainerRef} className="w-full h-full">
<DynamicMapComponent {...mapProps} key="map-instance" />
</div>
</div>

{/* Data panel */}
<div
ref={rightPanelRef}
className="h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white"
>
{isLoading ? (
<div className="h-full flex items-center justify-center">
<div className="flex flex-col items-center text-gray-500">
<svg
className="animate-spin h-10 w-10 mb-4 text-blue-500"
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
<div>Loading traffic data...</div>
</div>
</div>
) : aadtData.length > 0 ? (
<div className="h-full overflow-y-auto p-4">
<div className="flex items-center justify-between mb-4">
<div className="flex items-center">
<h2 className="text-xl font-bold">Traffic Analysis</h2>
</div>
</div>

{selectedLocation && (
<div className="mb-4">
{/* Fixed the info cards to ensure they fit properly */}
<div className="grid grid-cols-3 gap-2">
<div className="bg-blue-50 p-2 rounded-lg">
<div className="text-xs text-blue-700">Highway</div>
<div className="font-bold text-lg truncate">{selectedLocation}</div>
</div>

<div className="bg-purple-50 p-2 rounded-lg">
<div className="text-xs text-purple-700">Traffic Station ID</div>
<div className="font-bold text-lg">{aadtFeature?.attributes?.TRFC_STATN_ID || "N/A"}</div>
</div>

<div className="bg-orange-50 p-2 rounded-lg">
<div className="text-xs" style={{ color: "#fc8d62" }}>
Latest AADT
</div>
<div className="font-bold text-lg" style={{ color: "#fc8d62" }}>
{aadtData.length > 0 ? aadtData[0].aadt.toLocaleString() : "N/A"}
</div>
</div>
</div>
</div>
)}

{/* Chart area  */}
<div className="flex-1" style={{ height: "380px", minHeight: "380px" }}>
<Plot
data={chartData}
layout={chartLayout}
config={{
responsive: true,
displaylogo: false,
modeBarButtonsToRemove: ["zoom2d", "pan2d", "select2d", "lasso2d", "autoScale2d", "resetScale2d"],
}}
style={{ width: "100%", height: "100%" }}
/>
</div>

{/* Data table area */}
<div className="mt-2 overflow-y-auto">
<div className="flex justify-between items-center mb-2">
<h3 className="text-lg font-bold">AADT Data Table</h3>
<button
onClick={() => exportToExcel(aadtData, selectedLocation)}
className="px-3 py-1 text-white text-sm rounded hover:bg-green-700 flex items-center bg-green-600"
>
<svg
className="w-4 h-4 mr-1"
fill="none"
stroke="currentColor"
viewBox="0 0 24 24"
xmlns="http://www.w3.org/2000/svg"
>
<path
strokeLinecap="round"
strokeLinejoin="round"
strokeWidth={2}
d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
/>
</svg>
Export CSV
</button>
</div>

{/* Table content */}
<table className="min-w-full bg-white border-collapse border border-gray-300">
<thead>
<tr className="bg-gray-800 text-white">
<th className="py-2 px-4 border border-gray-500">Year</th>
<th className="py-2 px-4 border border-gray-500">AADT</th>
{/* <th className="py-2 px-4 border border-gray-500">Truck %</th> */}
</tr>
</thead>
<tbody>
{aadtData.map((item, index) => (
<tr key={index} className={index % 2 === 0 ? "bg-gray-50" : "bg-white"}>
<td className="py-2 px-4 border border-gray-300 text-center">{item.year}</td>
<td
className="py-2 px-4 border border-gray-300 text-right font-medium"
style={{ color: "#fc8d62" }}
>
{item.aadt.toLocaleString()}
</td>
{/* <td className="py-2 px-4 border border-gray-300 text-right font-medium text-blue-500">
                           {item.truckPercentage !== null ? `${item.truckPercentage.toFixed(1)}%` : "N/A"}
                         </td> */}
</tr>
))}
</tbody>
</table>
</div>
</div>
) : (
<div className="h-full flex items-center justify-center text-gray-500">
<div className="text-center p-8">
<svg
className="w-16 h-16 mx-auto mb-4"
fill="none"
stroke="currentColor"
viewBox="0 0 24 24"
xmlns="http://www.w3.org/2000/svg"
>
<path
strokeLinecap="round"
strokeLinejoin="round"
strokeWidth={2}
d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
/>
</svg>
<p className="text-xl font-medium">No location selected</p>
<p className="mt-2">Click on a traffic station on the map to view data</p>
</div>
</div>
)}
</div>
</div>
)}
</div>
)
}

// Utility functions for data processing
const dataUtils = {
processAadtData(attributes: any, location: string): AADTDataItem[] {
const data = []
for (let i = 0; i <= 19; i++) {
const year = 2023 - i
const fieldSuffix = i === 0 ? "QTY" : `HIST_${i.toString().padStart(2, "0")}_QTY`
const aadtFieldName = `AADT_RPT_${fieldSuffix}`
// const truckPctFieldName =
//   i === 0 ? "TX_TRUCK_AADT_PCT" : `TX_TRUCK_AADT_PCT_HIST_${i.toString().padStart(2, "0")}`

const aadtValue = attributes[aadtFieldName] || 0
if (aadtValue <= 0) continue

// let truckPercentage = null
// if (attributes[truckPctFieldName] !== undefined && attributes[truckPctFieldName] !== null) {
//   truckPercentage = Number.parseFloat(attributes[truckPctFieldName])
// }

data.push({
year,
aadt: aadtValue,
// truckPercentage,
})
}

return data.sort((a, b) => b.year - a.year)
},

calculateGrowthRate(data: AADTDataItem[]): number {
const validData = data.filter((d) => d.aadt > 0)
if (validData.length < 2) return 0

const firstYear = validData[validData.length - 1]
const lastYear = validData[0]
const years = lastYear.year - firstYear.year
if (years <= 0) return 0

return ((lastYear.aadt / firstYear.aadt) ** (1 / years) - 1) * 100
},
}

// Utility functions for chart creation
const chartUtils = {
createChartData(data: AADTDataItem[], location: string, stationId: string | null) {
const growthRate = dataUtils.calculateGrowthRate(data)
const sortedData = [...data].sort((a, b) => a.year - b.year)

const aadtBars = {
x: sortedData.map((item) => item.year),
y: sortedData.map((item) => item.aadt),
type: "bar",
name: "Total Vehicles (AADT)",
marker: {
color: "#fc8d62",
},
hovertemplate: "<b>%{y:,}</b> total vehicles<extra>%{x}</extra>",
width: 0.55,
}

// Add truck percentage as a line on secondary axis if data exists
// const hasTruckData = sortedData.some((item) => item.truckPercentage !== null)
const hasTruckData = false

const chartData = [aadtBars]

/*
   if (hasTruckData) {
     const truckLine = {
       x: sortedData.map((item) => item.year),
       y: sortedData.map((item) => item.truckPercentage || 0),
       type: "scatter",
       mode: "lines+markers",
       name: "Truck Percentage",
       marker: {
         color: "#3182bd",
         size: 8,
       },
       line: {
         color: "#3182bd",
         width: 3,
       },
       width: 0.55,
       yaxis: "y2",
       hovertemplate: "<b>%{y:.1f}%</b> trucks<extra>%{x}</extra>",
     }

     chartData.push(truckLine)
   }
   */

return {
chartData,
chartLayout: this.createChartLayout(location, growthRate, stationId, hasTruckData),
}
},

createChartLayout(location: string, growthRate: number, stationId: string | null, showTruckAxis = false) {
const stationInfo = stationId ? `Station ${stationId} on ` : ""

const baseAnnotation = {
x: 0.5,
y: 1.2,
xref: "paper",
yref: "paper",
text: `Annual Growth Rate: ${growthRate.toFixed(2)}%`,
showarrow: false,
font: {
size: 14,
color: growthRate >= 0 ? "#2e8540" : "#cc0000",
},
bgcolor: "rgba(255,255,255,0.8)",
borderpad: 5,
}

// Base layout
const layout: any = {
title: `Traffic Data for ${stationInfo}${location || "Selected Location"}`,
xaxis: {
title: "Year",
tickangle: -45,
automargin: true,
type: "category",
},
yaxis: {
title: "AADT",
rangemode: "tozero",
titlefont: { color: "#fc8d62" },
tickfont: { color: "#fc8d62" },
},
annotations: [baseAnnotation],
showlegend: true,
legend: {
orientation: "h",
y: -0.5,
x: 0.5,
xanchor: "center",
yanchor: "top",
bgcolor: "rgba(255,255,255,0.7)",
bordercolor: "lightgray",
borderwidth: 1,
},
margin: {
l: 70,
r: 70,
t: 120,
b: 150,
},
barmode: "group",
bargap: 0.15,
barnorm: false,
}

// Add secondary y-axis for truck percentage if needed
/*
   if (showTruckAxis) {
     layout.yaxis2 = {
       title: "Truck Percentage (%)",
       titlefont: { color: "#3182bd" },
       tickfont: { color: "#3182bd" },
       overlaying: "y",
       side: "right",
       range: [0, 30],
       showgrid: false,
     }
   }
   */

return layout
},
}

export default React.memo(TruckPercentagePage)