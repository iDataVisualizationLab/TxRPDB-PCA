"use client"

import type React from "react"
import { useEffect, useRef, useCallback, useState } from "react"
import { FaTimes, FaMap } from "react-icons/fa"
import dynamic from "next/dynamic"
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GeoJSONLayer from "@arcgis/core/layers/GeoJSONLayer"
import PopupTemplate from "@arcgis/core/PopupTemplate"
import type MapView from "@arcgis/core/views/MapView"
import type Map from "@arcgis/core/Map"
import { routePublic } from "@/config"
import GraphicsLayer from "@arcgis/core/layers/GraphicsLayer"
import Graphic from "@arcgis/core/Graphic"
import Extent from "@arcgis/core/geometry/Extent"
import { API_GET_PROXY } from "@/lib/api";
// Dynamically import your map component
const DynamicMapComponent = dynamic(() => import("@/components/map-arcgis/map"), { ssr: false })

interface MapModalProps {
  id: string
  onClose: () => void
  highway: string
  county: string
}

const MapModal: React.FC<MapModalProps> = ({ id, onClose, highway, county }) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const position = useRef({ x: 0, y: 0 })
  const translate = useRef({ x: 0, y: 0 })
  const offset = useRef({ x: 0, y: 0 })
  const dragging = useRef(false)
  const origUserSelectRef = useRef("")
  const mapRef = useRef<Map | null>(null)
  const viewRef = useRef<MapView | null>(null)

  const [histogramData, setHistogramData] = useState<{
    category: string;
    count: number;
    percentage: number;
    miles: number;
    color: string;
  }[]>([]);

  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  // Either remove entirely, or if you want to keep map clicks for other purposes, simplify to:
  const handleMapClick = useCallback((event: any) => {
    // Any non-legend related click handling you want to keep
  }, []);

  // Now handleMapLoaded can safely reference handleMapClick
  const handleMapLoaded = useCallback((map: any, view: MapView) => {
    mapRef.current = map
    viewRef.current = view
    view.constraints = {
      ...view.constraints,
      snapToZoom: false,
    }
    if (view.popup) {
      view.popup.dockEnabled = false
      view.popup.dockOptions = { position: "top-right", buttonEnabled: false, breakpoint: false }
      view.popup.autoCloseEnabled = false
      
      // Set popup alignment
      view.popup.alignment = "top-center"
      
      // Make the content cleaner and more compact using CSS
      const popupCSS = document.createElement("style")
      popupCSS.innerHTML = `
        .esri-popup__main-container {
          max-width: 280px !important;
          width: auto !important;
        }
        .esri-popup__content {
          margin: 0;
          padding: 8px 12px;
        }
        .esri-popup__collapsed-button {
          display: none !important;
        }
      `
      document.head.appendChild(popupCSS)
    }
    
    // Change the default highlight color 
    view.highlightOptions = {
      color: [0, 0, 0], 
      haloOpacity: 1,
      fillOpacity: 0.0,
      shadowColor: "black",
      shadowOpacity: 0.4,
      shadowDifference: 0.2
    };

    // Add click handler
    view.on("click", handleMapClick);

    // Ensure zoom happens after map is ready
    view.when(() => {
      setTimeout(() => {
        zoomToHighwayCounty(view, highway, county);
      }, 1000);
    });
  }, [handleMapClick, highway, county])

  const popupTemplate = new PopupTemplate({
    title: "<span style='color:rgb(11, 12, 12);'>PMIS Feature Info</span>",
    content: `
    <b>Highway:</b> {TX_SIGNED_HIGHWAY_RDBD_ID}<br>
    <b>Year:</b> {EFF_YEAR}<br>
    <b>Begin RM:</b> {TX_BEG_REF_MARKER_NBR} + {TX_BEG_REF_MRKR_DISP}<br>
    <b>End RM:</b> {TX_END_REF_MARKER_NBR} + {TX_END_REF_MRKR_DISP}<br>
    <b>Length:</b> {TX_LENGTH} miles<br>  
    <b>AADT:</b> {TX_AADT_CURRENT}<br>
    <b>Distress:</b> {TX_DISTRESS_SCORE}<br>
    <b>Condition:</b> {TX_CONDITION_SCORE}<br>
    <b>Ride:</b> {TX_RIDE_SCORE}
  `,
  })

  const geoJSON_PMIS_Layer = new GeoJSONLayer({
    url: `${routePublic}/files/pmis_lines_latest.geojson`,
    title: "PMIS Data",
    popupTemplate,
    outFields: ["*"],
    renderer: {
      type: "unique-value",
      valueExpression: `
      var s = $feature.TX_CONDITION_SCORE;
      if (s < 1) return 'Invalid';
      if (s >= 90) return 'Very Good';
      if (s >= 70) return 'Good';
      if (s >= 50) return 'Fair';
      if (s >= 35) return 'Poor';
      return 'Very Poor';
    `,
      valueExpressionTitle: "Condition Category",
      uniqueValueInfos: [
        {
          value: "Invalid",
          label: "Invalid",
          symbol: { type: "simple-line", color: "rgba(200, 200, 200, 0.5)", width: 3 },
        },
        {
          value: "Very Poor",
          label: "Very Poor",
          symbol: { type: "simple-line", color: "rgba(239, 68, 68, 0.3)", width: 3 },
        },
        {
          value: "Poor",
          label: "Poor",
          symbol: { type: "simple-line", color: "rgba(249, 115, 22, 0.3)", width: 3 },
        },
        {
          value: "Fair",
          label: "Fair",
          symbol: { type: "simple-line", color: "rgba(234, 179, 8, 0.3)", width: 3 },
        },
        {
          value: "Good",
          label: "Good",
          symbol: { type: "simple-line", color: "rgba(34, 197, 94, 0.3)", width: 3 },
        },
        {
          value: "Very Good",
          label: "Very Good",
          symbol: { type: "simple-line", color: "rgba(21, 128, 61, 0.3)", width: 3 },
        },
      ],
    },
  })

  const geoJSON_PMIS_LayerRef = useRef<GeoJSONLayer>(geoJSON_PMIS_Layer)

  const REFLayer = new FeatureLayer({
    url: 'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Reference_Markers/FeatureServer/0',
    title: "Reference Markers",
    popupTemplate: {
      title: "Reference Marker Information",
      content: `
        <b>Route Name:</b> {RTE_NM}<br>
        <b>Reference Marker:</b> {MRKR_NBR}<br>
        <b>Marker Suffix:</b> {MRKR_SFX}<br>
        <b>DFO:</b> {DFO}
      `,
    },
    outFields: ["*"],  // Add this to ensure all fields are available for popups
    labelingInfo: [
      {
        symbol: {
          type: 'text',
          color: '#000000',
          haloColor: '#FFFFFF',
          haloSize: '1px',
          font: {
            size: '12px',
            family: 'Arial',
            weight: 'bold',
          },
        },
        labelPlacement: 'above-center',
        labelExpressionInfo: {
          expression: '$feature.MRKR_NBR',
        },
      },
    ],
    renderer: {
      type: 'simple',
      symbol: {
        type: 'simple-marker',
        color: 'rgba(0, 0, 0, 1)',
        size: 5,
        outline: {
          color: 'rgba(255, 255, 255, 0.4)',
          width: 1,
        },
      },
    },
    definitionExpression: 'MOD(MRKR_NBR, 200) = 0',
  });

  const HighwayLayer = new FeatureLayer({
    url: 'https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Roadways_Search/FeatureServer/0',
    outFields: ['*'],
    title: "Highways",
    popupTemplate: {
      title: "<span style='color:rgb(13, 13, 14);'>Highway: <b>{RTE_CNTY}</b></span>",
      content: [
        {
          type: "fields",
          fieldInfos: [
            {
              fieldName: "RTE_NM",
              label: "Route Name",
            },
            {
              fieldName: "RTE_ID",
              label: "Route ID",
            },
            {
              fieldName: "CNTY_NM",
              label: "County",
            },
            {
              fieldName: "Shape__Length",
              label: "Length",
              format: {
                digitSeparator: true,
                places: 2
              }
            }
          ]
        }
      ],
      expressionInfos: [{
        name: "length-miles",
        title: "Length in Miles",
        expression: "$feature.Shape__Length * 0.000621371" // Convert meters to miles
      }]
    },
    renderer: {
      type: 'simple',
      symbol: {
        type: 'simple-line',
        color: 'rgba(0, 0, 0, 0.4)',
        width: 1,
      },
    },
    definitionExpression: "(SUBSTRING(RTE_NM,1,2)='IH' or SUBSTRING(RTE_NM,1,2)='US')",
  });

  const mapProps = {
    layers: [
      {
        layer: geoJSON_PMIS_Layer,
        name: "PMIS Condition Scores",
        visible: true,
        popupEnabled: true,
        legendColor: "green",
        legendShape: "line" as const,
      },
      {
        layer: REFLayer,
        name: 'Reference Markers',
        visible: false,
        popupEnabled: true,
        legendColor: 'black',
        legendShape: 'dot' as 'dot'
      },
      {
        layer: HighwayLayer,
        name: 'Highways',
        visible: false,
        popupEnabled: true,
        legendColor: 'black',
        legendShape: 'line' as 'line'
      }
    ],
    showLegend: true,
    popupEnabled: true,  // Add this line to enable popups
    popupOptions: {
      dockEnabled: true,
      dockOptions: {
        buttonEnabled: true,
        breakpoint: false,
        legendColor: 'black',
        position: "top-right",
      }
    },
    onMapLoaded: handleMapLoaded,
  }

  const zoomToHighway = (view: MapView, highway: string) => {
    if (!highway || !view || !geoJSON_PMIS_LayerRef.current) return
    
    // Parse and normalize highway ID formats to handle different variations
    let formatsToTry = [highway]; // Original format always tried first
    
    // Handle dash format (e.g. "IH0030-LG")
    if (highway.includes('-')) {
      formatsToTry.push(highway.replace('-', ' ')); // Try with space
      formatsToTry.push(highway.split('-')[0]);     // Try prefix only
    } 
    // Handle space format (e.g. "US0069 L")
    else if (highway.includes(' ')) {
      formatsToTry.push(highway.replace(' ', '-')); // Try with dash
      formatsToTry.push(highway.split(' ')[0]);     // Try prefix only
    }
    
    const whereClause = formatsToTry.map(fmt => 
      `TX_SIGNED_HIGHWAY_RDBD_ID = '${fmt}'`
    ).join(' OR ');
    
    const query = geoJSON_PMIS_LayerRef.current.createQuery()
    query.where = `(${whereClause})`
    query.returnGeometry = true
    
    geoJSON_PMIS_LayerRef.current.queryExtent(query).then(({ extent }) => {
      if (extent) {
        view.padding = { top: 20, right: 20, bottom: 20, left: 20 }
        view.goTo(extent)
      } else {
        // Try fuzzy match if exact match fails
        const baseHighwayNumber = highway.replace(/[^0-9]/g, '');
        const fuzzyQuery = geoJSON_PMIS_LayerRef.current.createQuery()
        fuzzyQuery.where = `TX_SIGNED_HIGHWAY_RDBD_ID LIKE '%${baseHighwayNumber}%'`
        
        geoJSON_PMIS_LayerRef.current.queryExtent(fuzzyQuery).then(({ extent: fuzzyExtent }) => {
          if (fuzzyExtent) {
            view.padding = { top: 20, right: 20, bottom: 20, left: 20 }
            view.goTo(fuzzyExtent)
          }
        })
      }
    })
  }

  const zoomToHighwayCounty = (view: MapView, highway: string, county: string) => {
    if (!highway || !view || !geoJSON_PMIS_LayerRef.current) return;

    // Normalize county name - remove any number prefix and convert to uppercase
    const normalizedCounty = county.replace(/^\d+\s*[-–—]\s*/, "").toUpperCase();

    // build list of possible formats
    let formatsToTry = [highway];

    // Add interstate prefix variations (IH/I)
    if (highway.startsWith("IH")) {
      formatsToTry.push(highway.replace("IH", "I"));
    } else if (highway.startsWith("I")) {
      formatsToTry.push(highway.replace("I", "IH"));
    }

    // Add Business Route variations (BU)
    if (highway.startsWith("BU")) {
      // Try without trailing suffix (like TL for truck lane)
      if (highway.length > 6) {
        formatsToTry.push(highway.slice(0, 6)); // Just try BU0067 without the TL
      }
    }

    // Keep existing dash/space variations
    if (highway.includes('-')) {
      formatsToTry.push(highway.replace('-', ' '), highway.split('-')[0]);
    } else if (highway.includes(' ')) {
      formatsToTry.push(highway.replace(' ', '-'), highway.split(' ')[0]);
    }

    console.log(`Trying highway formats: ${formatsToTry.join(', ')}`);
    console.log(`Looking for county: ${normalizedCounty}`);

    // EXACT MATCH QUERY
    const whereExact = formatsToTry.map(fmt =>
      `TX_SIGNED_HIGHWAY_RDBD_ID = '${fmt}'`
    ).join(' OR ');
    
    const exactQuery = geoJSON_PMIS_LayerRef.current.createQuery();
    exactQuery.where = `(${whereExact}) AND UPPER(COUNTY) LIKE '%${normalizedCounty}%'`;
    exactQuery.returnGeometry = true;

    geoJSON_PMIS_LayerRef.current.queryExtent(exactQuery)
      .then(({ extent }) => {
        if (extent) {
          // zoom & highlight exact matches
          highlightFeatures(view, exactQuery, `Exact (${formatsToTry.join(', ')})`);
        } else {
          // FUZZY MATCH QUERY
          console.log("No exact match—trying fuzzy match");
          const baseNumber = highway.replace(/[^0-9]/g, '');
          const fuzzyQuery = geoJSON_PMIS_LayerRef.current.createQuery();
          fuzzyQuery.where = `TX_SIGNED_HIGHWAY_RDBD_ID LIKE '%${baseNumber}%' AND UPPER(COUNTY) LIKE '%${normalizedCounty}%'`;
          fuzzyQuery.returnGeometry = true;

          geoJSON_PMIS_LayerRef.current.queryExtent(fuzzyQuery)
            .then(({ extent: fuzzyExtent }) => {
              if (fuzzyExtent) {
                console.log("Found fuzzy matches, zooming…");
                highlightFeatures(view, fuzzyQuery, `Fuzzy (${baseNumber})`);
              } else {
                console.error(`Could not find highway '${highway}' in county '${county}' (fuzzy failed)`);
              }
            })
            .catch(err => console.error("Error querying fuzzy extent:", err));
        }
      })
      .catch(error => {
        console.error("Error querying highway extent:", error);
      });
  };

  /**
   * Runs queryFeatures on the given query, zooms the view to its extent,
   * and adds both glow & color highlights for each returned feature.
   * Also logs the matching IDs.
   */
  function highlightFeatures(view: MapView, query: __esri.Query, logLabel: string) {
    const layer = geoJSON_PMIS_LayerRef.current!;
    view.padding = { top: 20, right: 20, bottom: 20, left: 20 };

    // ensure we have a highlight layer
    let hl = view.map.findLayerById("highlight-layer") as GraphicsLayer;
    if (!hl) {
      hl = new GraphicsLayer({ id: "highlight-layer" });
      view.map.add(hl);
    }
    hl.removeAll();

    // zoom to extent first
    layer.queryExtent(query).then(({ extent }) => {
      if (extent) view.goTo(extent);
    });

    // then get and draw features
    layer.queryFeatures(query)
      .then(({ features }) => {
        console.log(`${logLabel} — found ${features.length} segments:`,
                    features.map(f => f.attributes.TX_SIGNED_HIGHWAY_RDBD_ID)
        );

        // Calculate histogram for these features
        calculateHistogram(features);
        
        // Add black outline around ALL segments first 
        features.forEach(feature => {
          // Add thick black outline underneath everything
          hl.add(new Graphic({
            geometry: feature.geometry,
            symbol: {
              type: "simple-line",
              color: [0, 0, 0,],  // Black outline
              width: 10,              
              cap: "round",
              join: "round"
            }
          }));
        });

        // Now add the white glow and colored segments as before
        features.forEach(feature => {
          const score = feature.attributes.TX_CONDITION_SCORE;
          let color: [number, number, number, number];
          if (score >= 90)      color = [21,  128, 61,  1.0];
          else if (score >= 70) color = [34,  197, 94,  1.0];
          else if (score >= 50) color = [234, 179, 8,   1.0];
          else if (score >= 35) color = [249, 115, 22,  1.0];
          else if (score >= 1)  color = [239, 68,  68,  1.0];
          else                  color = [200, 200, 200, 1.0];

          // glow
          hl.add(new Graphic({
            geometry: feature.geometry,
            symbol: {
              type: "simple-line",
              color: [255, 255, 255, 0.5],
              width: 5.5,
            }
          }));

          // main line
          hl.add(new Graphic({
            geometry: feature.geometry,
            symbol: {
              type: "simple-line",
              color,
              width: 4,
              cap: "round",
            },
            attributes: feature.attributes,
          }));
        });
      })
      .catch(err => console.error("Error querying features:", err));
  }
    
    const calculateHistogram = useCallback((features: __esri.Graphic[]) => {
      if (!features || features.length === 0) return;
      
      // Define categories as a type to ensure consistency
      type CategoryKey = "very-good" | "good" | "fair" | "poor" | "very-poor" | "invalid";
      
      // Initialize counters with proper index signature
      const counts: Record<CategoryKey, number> = {
        "very-good": 0,
        "good": 0,
        "fair": 0,
        "poor": 0,
        "very-poor": 0,
        "invalid": 0
      };
      
      // Track miles with proper index signature
      const miles: Record<CategoryKey, number> = {
        "very-good": 0,
        "good": 0,
        "fair": 0,
        "poor": 0,
        "very-poor": 0,
        "invalid": 0
      };
      
      // Calculate segment length for each feature
      let totalLength = 0;
      let totalMiles = 0;
      
      // Count segments in each category
      features.forEach(feature => {
        const score = feature.attributes.TX_CONDITION_SCORE;
        // Get actual segment length in miles from TX_LENGTH field
        const segmentLength = 1; // For count-based
        const segmentMiles = parseFloat(feature.attributes.TX_LENGTH) || 0; // Actual miles
        
        // Type the category variable explicitly
        let category: CategoryKey;
        if (score >= 90) {
          category = "very-good";
        } else if (score >= 70) {
          category = "good";
        } else if (score >= 50) {
          category = "fair";
        } else if (score >= 35) {
          category = "poor";
        } else if (score >= 1) {
          category = "very-poor";
        } else {
          category = "invalid";
        }
        
        counts[category] += segmentLength;
        miles[category] += segmentMiles;
        
        totalLength += segmentLength;
        totalMiles += segmentMiles;
      });
      
      // Convert to array format for the chart
      const histData = [
        { 
          category: "very-good", 
          count: counts["very-good"], 
          percentage: (counts["very-good"] / totalLength) * 100,
          miles: miles["very-good"],
          color: "rgb(21,128,61)" 
        },
        { 
          category: "good", 
          count: counts["good"], 
          percentage: (counts["good"] / totalLength) * 100,
          miles: miles["good"],
          color: "rgb(34,197,94)" 
        },
        { 
          category: "fair", 
          count: counts["fair"], 
          percentage: (counts["fair"] / totalLength) * 100,
          miles: miles["fair"],
          color: "rgb(234,179,8)" 
        },
        { 
          category: "poor", 
          count: counts["poor"], 
          percentage: (counts["poor"] / totalLength) * 100,
          miles: miles["poor"],
          color: "rgb(249,115,22)" 
        },
        { 
          category: "very-poor", 
          count: counts["very-poor"], 
          percentage: (counts["very-poor"] / totalLength) * 100,
          miles: miles["very-poor"],
          color: "rgb(239,68,68)" 
        },
        { 
          category: "invalid", 
          count: counts["invalid"], 
          percentage: (counts["invalid"] / totalLength) * 100,
          miles: miles["invalid"],
          color: "rgb(200,200,200)" 
        }
      ];
      
      setHistogramData(histData);
    }, []);

    function calculateAverageCondition(data: { category: string; count: number; percentage: number; color: string }[]): string {
      if (!data.length) return "N/A";
      
      // Weights for each category (midpoint of range)
      const weights = {
        "very-good": 95,
        "good": 80,
        "fair": 60,
        "poor": 42.5,
        "very-poor": 17.5,
        "invalid": 0
      };
      
      let totalWeight = 0;
      let totalCount = 0;
      
      data.forEach(item => {
        totalWeight += weights[item.category as keyof typeof weights] * item.count;
        totalCount += item.count;
      });
      
      if (totalCount === 0) return "N/A";
      
      const avgScore = totalWeight / totalCount;
      return avgScore.toFixed(1);
    }

    // Add this function before your return statement
    const handleLegendInteraction = useCallback(
      (category: string | null, action: "hover" | "click") => {
        if (!viewRef.current) return;

        const pmisLayer = viewRef.current.map.allLayers.find(
          (layer) => layer.title === "PMIS Data"
        ) as GeoJSONLayer;
        
        if (!pmisLayer) return;

        // For hover actions with no current selection
        if (action === "hover" && !selectedCategory) {
          // Reset all features to normal opacity if no category or hover ending
          if (!category) {
            pmisLayer.opacity = 1;
            pmisLayer.definitionExpression = "";
            return;
          }

          // Apply temporary hover filter
          let whereClause = "";
          switch (category) {
            case "very-good":
              whereClause = "TX_CONDITION_SCORE >= 90";
              break;
            case "good":
              whereClause = "TX_CONDITION_SCORE >= 70 AND TX_CONDITION_SCORE < 90";
              break;
            case "fair":
              whereClause = "TX_CONDITION_SCORE >= 50 AND TX_CONDITION_SCORE < 70";
              break;
            case "poor":
              whereClause = "TX_CONDITION_SCORE >= 35 AND TX_CONDITION_SCORE < 50";
              break;
            case "very-poor":
              whereClause = "TX_CONDITION_SCORE >= 1 AND TX_CONDITION_SCORE < 35";
              break;
            case "invalid":
              whereClause = "TX_CONDITION_SCORE < 1";
              break;
          }

          pmisLayer.definitionExpression = whereClause;

          // After a short delay, reset if still no selection
          setTimeout(() => {
            if (viewRef.current && !selectedCategory) {
              const currentPmisLayer = viewRef.current.map.allLayers.find(
                (layer) => layer.title === "PMIS Data"
              ) as GeoJSONLayer;

              if (currentPmisLayer) {
                currentPmisLayer.definitionExpression = "";
              }
            }
          }, 5000);  // Changed from 100ms to 5000ms (5 seconds)
        }
        // For click actions
        else if (action === "click") {
          // Toggle selection if clicking the same category
          if (category === selectedCategory) {
            setSelectedCategory(null);
            pmisLayer.definitionExpression = "";
            pmisLayer.opacity = 1;
          } else {
            setSelectedCategory(category);
            if (category) {
              let whereClause = "";
              switch (category) {
                case "very-good":
                  whereClause = "TX_CONDITION_SCORE >= 90";
                  break;
                case "good":
                  whereClause = "TX_CONDITION_SCORE >= 70 AND TX_CONDITION_SCORE < 90";
                  break;
                case "fair":
                  whereClause = "TX_CONDITION_SCORE >= 50 AND TX_CONDITION_SCORE < 70";
                  break;
                case "poor":
                  whereClause = "TX_CONDITION_SCORE >= 35 AND TX_CONDITION_SCORE < 50";
                  break;
                case "very-poor":
                  whereClause = "TX_CONDITION_SCORE >= 1 AND TX_CONDITION_SCORE < 35";
                  break;
                case "invalid":
                  whereClause = "TX_CONDITION_SCORE < 1";
                  break;
              }
              pmisLayer.definitionExpression = whereClause;
            }
          }
        }
      },
      [selectedCategory]
    );

    useEffect(() => {
      if (viewRef.current && viewRef.current.ready) {
        // Add a small delay to ensure map is fully loaded
        setTimeout(() => {
          if (viewRef.current) {
            zoomToHighwayCounty(viewRef.current, highway, county);
          }
        }, 500);
      }
    }, [highway, county]);

    useEffect(() => {
      const onMouseMove = (e: MouseEvent) => {
        if (dragging.current && containerRef.current) {
          translate.current.x = position.current.x + (e.clientX - offset.current.x)
          translate.current.y = position.current.y + (e.clientY - offset.current.y)
          
          // Apply consistent transform
          containerRef.current.style.transform = `translate(calc(-50% + ${translate.current.x}px), ${translate.current.y}px)`
        }
      }

      const onMouseUp = () => {
        if (dragging.current) {
          position.current.x = translate.current.x
          position.current.y = translate.current.y
          dragging.current = false
          document.body.style.userSelect = origUserSelectRef.current
        }
      }

      document.addEventListener("mousemove", onMouseMove)
      document.addEventListener("mouseup", onMouseUp)

      return () => {
        document.removeEventListener("mousemove", onMouseMove)
        document.removeEventListener("mouseup", onMouseUp)
        document.body.style.userSelect = origUserSelectRef.current
      }
    }, [])

    const onHeaderMouseDown = (e: React.MouseEvent) => {
      if (!containerRef.current) return
      origUserSelectRef.current = document.body.style.userSelect
      document.body.style.userSelect = "none"
      offset.current.x = e.clientX
      offset.current.y = e.clientY
      dragging.current = true
    }

    function getAllPossibleHighwayFormats(highway: string): string[] {
      const formats = new Set<string>([highway]);
      
      // Enhanced prefix patterns to handle different format variations
      const prefixPatterns = [
        /^([A-Z]{1,3})(\d{1,4})-([A-Z]{1,2})$/,  // Format with dash at end like IH0027-L
        /^([A-Z]{1,3})(\d{1,4})([A-Z]{1,2})$/,   // Basic format like IH0069EA
        /^([A-Z]{1,3})(\d{1,4})\s+([A-Z]{1,2})$/,// Format with space like IH0069 EA
        /^([A-Z]{1,3})-(\d{1,4})([A-Z]{1,2})$/,  // Format with dash after prefix like IH-0069EA
        /^([A-Z]{1,3})-(\d{1,4})-([A-Z]{1,2})$/, // Format with dashes like IH-0069-EA
        /^([A-Z]{1,3})\s+(\d{1,4})\s+([A-Z]{1,2})$/, // Format with spaces like IH 0069 EA
        /^([A-Z]{1,3})(\d{1,4})$/,              // Format with no suffix like IH0069
        /^([A-Z]{1,3})-(\d{1,4})$/,             // Format with dash after prefix, no suffix like IH-0069
        /^([A-Z]{1,3})\s+(\d{1,4})$/           // Format with space after prefix, no suffix like IH 0069
      ];
      
      let prefix = "";
      let number = "";
      let suffix = "";
      let matched = false;
      
      // Try each pattern until we find a match
      for (const pattern of prefixPatterns) {
        const match = highway.match(pattern);
        if (match) {
          prefix = match[1];
          number = match[2];
          suffix = match[3] || "";  // Some patterns might not have a suffix
          matched = true;
          break;
        }
      }
      
      // If no pattern matched, use fallback approach to extract components
      if (!matched) {
        let i = 0;
        // Extract prefix (letters until we hit a digit)
        while (i < highway.length && !/\d/.test(highway[i])) {
          prefix += highway[i++];
        }
        
        // Extract number (digits)
        while (i < highway.length && /\d/.test(highway[i])) {
          number += highway[i++];
        }
        
        // Everything else is the suffix
        suffix = highway.substring(i).trim();
        
        // Handle special case where suffix starts with a dash or space
        if (suffix.startsWith('-') || suffix.startsWith(' ')) {
          suffix = suffix.substring(1);
        }
      }
      
      // Generate prefix variations
      const prefixVariations = new Set<string>([prefix]);
      
      // Common prefix mappings
      const prefixMap: Record<string, string[]> = {
        'IH': ['I', 'IS'],
        'I': ['IH', 'IS'],
        'US': ['US0', 'US-'],
        'SH': ['SL', 'TX', 'SR', 'SH0'],
        'FM': ['RM', 'FM0', 'FR'],
        'RM': ['FM', 'RM0'],
        'BU': ['BI', 'BR', 'BS', 'BF'],
        'BI': ['BU', 'BR', 'BS', 'BF'],
        'SL': ['SH', 'SP', 'SR'],
        'LP': ['LO', 'SL'],
        'SP': ['SL', 'SP0'],
        'CR': ['CO', 'CR0'],
        'PR': ['PA', 'PR0']
      };
      
      // Add variations from the mapping
      if (prefix in prefixMap) {
        prefixMap[prefix].forEach(p => prefixVariations.add(p));
      }
      
      // Generate number variations
      const numberVariations = new Set<string>();
      numberVariations.add(number);                   // Original number
      numberVariations.add(number.replace(/^0+/, '')); // Without leading zeros
      if (number.length < 4) {
        numberVariations.add(number.padStart(4, '0')); // With leading zeros to make 4 digits
      }
      
      // Generate suffix variations
      const suffixVariations = new Set<string>(['']);
      
      if (suffix) {
        // Original suffix
        suffixVariations.add(suffix);
        
        // Add separator variations
        suffixVariations.add(`-${suffix}`);
        suffixVariations.add(` ${suffix}`);
        
        // Single letter variations
        if (suffix.length > 1) {
          const firstLetter = suffix[0];
          suffixVariations.add(firstLetter);
          suffixVariations.add(`-${firstLetter}`);
          suffixVariations.add(` ${firstLetter}`);
        }
        
        // Direction mappings
        const directionMap: Record<string, string[]> = {
          'L': ['LG', 'LN', 'LOOP'],
          'E': ['EA', 'EB', 'EAST'],
          'W': ['WA', 'WB', 'WEST'],
          'N': ['NA', 'NB', 'NORTH'],
          'S': ['SA', 'SB', 'SOUTH'],
          'R': ['RT', 'RA', 'RD'],
          'T': ['TR', 'TL', 'TRUCK'],
          'F': ['FR', 'FL', 'FRONTAGE'],
          'C': ['CK', 'CL', 'CONNECTOR'],
          'A': ['AK', 'AC', 'ALT'],
          'X': ['XA', 'XB', 'EXPRESS']
        };
        
        // Add direction variations for single letter suffixes
        if (suffix.length === 1 && suffix in directionMap) {
          directionMap[suffix].forEach(dir => {
            suffixVariations.add(dir);
            suffixVariations.add(`-${dir}`);
            suffixVariations.add(` ${dir}`);
          });
        }
      }
      
      // Generate all combinations
      for (const p of prefixVariations) {
        for (const n of numberVariations) {
          for (const s of suffixVariations) {
            formats.add(`${p}${n}${s}`);
          }
        }
      }
      
      // Return unique, non-empty formats as an array
      return Array.from(formats).filter(Boolean);
    }

    return (
        <div className="fixed inset-0 z-50 pointer-events-none">
          <div
            ref={containerRef}
            className="pointer-events-auto bg-white rounded-xl shadow-2xl border-[1px] border-gray-200/50 w-[850px] h-[920px] resize overflow-hidden absolute left-1/2 top-1/5"
            style={{ 
              transform: "translate(-50%, 0)",
              boxShadow: "0 0 60px rgba(0, 0, 0, 0.4), 0 0 30px rgba(0, 0, 0, 0.7), 0 0 15px rgba(0, 0, 0, 0.4)"
            }}
          >
            <div
              onMouseDown={onHeaderMouseDown}
              className="cursor-move select-none flex justify-between items-center px-4 py-3 bg-gradient-to-r from-[rgb(15,40,70)] to-[rgb(25,55,90)] text-white rounded-t-xl"
            >
              <div className="flex items-center gap-3">
                <div className="w-6 h-6 text-[rgb(241, 246, 247)] flex-shrink-0 flex items-center justify-center">
                  <FaMap className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-bold text-base leading-tight">
                    PMIS Map View — <span className="text-[rgb(246, 249, 250)]">{highway}</span>
                  </h2>
                  <p className="text-xs text-white/80 leading-tight">
                    {county.replace(/^\d+\s*[-–—]\s*/, "").toUpperCase()} County
                  </p>
                </div>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 hover:bg-white/20 rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-white/50"
                aria-label="Close map modal"
                title="Close map (Esc)"
              >
                <FaTimes className="w-4 h-4" />
              </button>
            </div>
            <div className="h-[calc(100%-48px)] w-full overflow-hidden">
              <DynamicMapComponent
                {...mapProps}
                onMapLoaded={handleMapLoaded}
              />
            </div>

            {/* Enhanced interactive legend with histogram */}
            <div className="absolute bottom-4 right-4 bg-white/95 backdrop-blur-sm rounded-xl p-4 shadow-xl border border-gray-200/50 text-xs transition-all duration-300 hover:shadow-2xl" style={{ minWidth: "220px" }}>
              <div className="flex items-center justify-between mb-3 pb-2 border-b border-gray-200">
                <span className="font-medium text-sm">Latest Condition Score</span>
                
                {/* Help button */}
                <div className="group relative ml-auto">
                  <button 
                    type="button"
                    className="w-4 h-4 inline-flex items-center justify-center rounded-full bg-gray-100 text-xs text-gray-500 hover:bg-blue-100 hover:text-blue-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    aria-label="Legend help"
                  >
                    ?
                  </button>
                  <div className="absolute bottom-full right-0 mb-2 w-56 transform scale-0 group-hover:scale-100 transition-transform origin-bottom z-50">
                    <div className="bg-gray-900 text-white text-xs p-2 rounded shadow-lg">
                      <p className="mb-1 font-medium">Condition Score Legend:</p>
                      <ul className="list-disc list-inside text-gray-200 text-[10px] leading-tight">
                        <li>Bar length shows % of highway segments</li>
                        <li>Miles shown are actual segment lengths</li>
                        <li>Higher scores mean better conditions</li>
                        <li>Click on a category to filter the map</li>
                        <li>Click again to clear the filter</li>
                      </ul>
                      <div className="absolute bottom-0 right-4 transform translate-y-1/2 rotate-45 w-2 h-2 bg-gray-900"></div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="space-y-2 legend-container">
                {[
                  { id: "very-good", color: "rgb(21,128,61)", label: "Very Good (90-100)" },
                  { id: "good", color: "rgb(34,197,94)", label: "Good (70-89)" },
                  { id: "fair", color: "rgb(234,179,8)", label: "Fair (50-69)" },
                  { id: "poor", color: "rgb(249,115,22)", label: "Poor (35-49)" },
                  { id: "very-poor", color: "rgb(239,68,68)", label: "Very Poor (1-34)" },
                  { id: "invalid", color: "rgb(200,200,200)", label: "Invalid (0)" }
                ].map((item) => {
                  // Find the matching histogram data or use default
                  const histItem = histogramData.find(h => h.category === item.id) || 
                    { count: 0, percentage: 0, miles: 0, color: item.color };
                  
                  return (
                    <div key={item.id} className="flex flex-col text-xs">
                      <div 
                        className="flex items-center gap-2 cursor-pointer"
                        data-category={item.id}
                        onMouseEnter={() => handleLegendInteraction(item.id, 'hover')}
                        onMouseLeave={() => handleLegendInteraction(null, 'hover')}
                        onClick={() => handleLegendInteraction(item.id, 'click')}
                      >
                        <div 
                          className={`w-4 h-4 flex-shrink-0 rounded-sm transition-all duration-300 shadow-sm ${
                            selectedCategory === item.id ? 'ring-2 ring-blue-500 scale-110' : 'hover:scale-110'
                          }`}
                          style={{ backgroundColor: item.color }}
                          data-category={item.id}
                        ></div>
                        <span className={`text-gray-800 transition-all duration-300 ${
                          selectedCategory === item.id ? 'font-bold text-blue-600' : 'hover:text-gray-900'
                        }`}>
                          {item.label}
                        </span>
                        <span className="ml-auto font-bold text-gray-700 text-[10px]">
                          {histItem.percentage.toFixed(1)}% ({histItem.miles?.toFixed(1) || 0} mi)
                        </span>
                      </div>
                      
                      {/* Histogram bar */}
                      <div className="mt-1 h-2 w-full bg-gray-100 rounded overflow-hidden">
                        <div 
                          className="h-full rounded transition-all duration-300"
                          style={{ 
                            width: `${Math.max(0.5, histItem.percentage)}%`, 
                            backgroundColor: item.color,
                            transition: 'width 0.5s ease-out',
                            filter: selectedCategory && selectedCategory !== item.id ? 'grayscale(70%)' : 'none',
                            opacity: selectedCategory && selectedCategory !== item.id ? 0.5 : 1,
                          }} 
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
              
              {/* Summary stats */}
              {histogramData.length > 0 && (
                <div className="mt-2 pt-2 border-t border-gray-200">
                  <div className="flex justify-between text-xs">
                    <span>Total: {histogramData.reduce((sum, item) => sum + item.count, 0)} segments</span>
                    <span className="font-medium">
                      Average: {calculateAverageCondition(histogramData)}
                    </span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      );
}

export default MapModal