'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import esriConfig from '@arcgis/core/config';
import Search from '@arcgis/core/widgets/Search';
import VectorTileLayer from '@arcgis/core/layers/VectorTileLayer';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import TileLayer from '@arcgis/core/layers/TileLayer';
import { useSectionModal } from "@/context/SectionContext";
import { usePathname } from 'next/navigation';
import GraphicsLayer from '@arcgis/core/layers/GraphicsLayer';
import Basemap from '@arcgis/core/Basemap';
import Graphic from '@arcgis/core/Graphic';
import Point from '@arcgis/core/geometry/Point';
// import '@arcgis/core/assets/esri/themes/dark/main.css'; // Default dark theme
import '@arcgis/core/assets/esri/themes/light/main.css'; // Light theme (will be conditionally loaded)
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
// Removed the conflicting import
import * as reactiveUtils from '@arcgis/core/core/reactiveUtils';
import CircleSymbol from "@arcgis/core/symbols/SimpleMarkerSymbol";
esriConfig.apiKey = 'AAPKdec314cf645a408e8d7fefaad73d1b04D_VHPN-eK0x0Mqx9tLkfn-4f0Hb3BJBNfuzVUvqkNkTdkmZfB_vmkJUcqrSkdNE_';
import { useMap } from "@/context/MapContext";
import { set } from 'lodash';
import { startPulsingHighlight, stopPulsingHighlight } from "@/lib/map/highlightPulse";

interface MapComponentProps {
  layers: Array<{
    layer: __esri.Layer;
    name: string;
    visible: boolean;
    popupEnabled?: boolean;  // Add this property
    legendColor?: string; // Optional color for legend symbol
    legendShape?: 'dot' | 'square' | 'line'; // Optional shape for legend symbol
  }>;
  uiControls?: Array<{
    key: string;
    control: HTMLElement;
  }>;
  searchSources?: __esri.SearchSource[];
  newBaseMapUrl?: string;
  theme?: 'light' | 'dark';
  showLegend?: boolean;
  needCheckBox?: boolean;
  showTable?: boolean;
  goToPoint?: { x: number; y: number; color: string; layerName: string };
  onMapLoaded?: (map: __esri.Map, view: __esri.MapView) => void;
  popupEnabled?: boolean;  // Add this property
  popupOptions?: {         // Add this property
    dockEnabled?: boolean;
    dockOptions?: {
      buttonEnabled?: boolean;
      breakpoint?: boolean;
      position?: string;
    };
  };
  visiblePointCount?: number;
  totalPointCount?: number;
}

const MapComponent: React.FC<MapComponentProps> = ({
  layers,
  uiControls,
  searchSources,
  newBaseMapUrl,
  theme,
  showLegend,
  showTable,
  goToPoint,
  onMapLoaded,
  popupEnabled,
  popupOptions,
  visiblePointCount,
  totalPointCount,
  needCheckBox,
}) => {
  const { basemapUrl, mapOpacity } = useMap();
  const mapRef = useRef<HTMLDivElement>(null);
  const { isOpen, data, x, y, isDetailsModalOpen, setDetailsModalOpen, selectedRow, setSelectedRow, reportData, surveyData, setSurveyData, surveyImages, setSurveyImages, planSet, setPlanSet, updateMapCoordinates, selectedPointId, setSelectedPointId, filteredData, setFilteredData } = useSectionModal();
  const [mapView, setMapView] = useState<__esri.MapView | null>(null);
  const graphicsLayerRef = useRef<__esri.GraphicsLayer | null>(null);
  const pulseLayerRef = useRef<__esri.GraphicsLayer | null>(null);
  const pathname = usePathname();
  const stationCountInfoRef = useRef<string>('');

  useEffect(() => {
    let view: MapView;
    const map = new Map({
      basemap: {
        baseLayers: [
          new VectorTileLayer({
            url: newBaseMapUrl || basemapUrl,
            opacity: mapOpacity / 100 // Convert percentage to decimal
          })
        ]
      }
    });

    // Create graphics layers: one for static markers; one for pulsing highlight
    const graphicsLayer = new GraphicsLayer({ listMode: "hide" });
    map.add(graphicsLayer);
    graphicsLayerRef.current = graphicsLayer;

    const pulseLayer = new GraphicsLayer({ listMode: "hide", title: "Highlights" });
    map.add(pulseLayer);
    pulseLayerRef.current = pulseLayer;

    // Initialize MapView
    if (mapRef.current) {
      view = new MapView({
        container: mapRef.current,
        map: map,
        center: [-99.1332, 31.9686], // Example coordinates (Texas)
        zoom: 6,
        popup: {  // Configure popup instead of disabling it
          dockEnabled: popupOptions?.dockEnabled || false,
          dockOptions: popupOptions?.dockOptions || {
            buttonEnabled: true,
            breakpoint: false,
            position: "auto"
          }
        }
      });
      const zoomCoordsDiv = document.createElement("div");
      zoomCoordsDiv.style.position = "absolute";
      zoomCoordsDiv.style.bottom = "20px";
      zoomCoordsDiv.style.left = "10px";
      zoomCoordsDiv.style.backgroundColor = "rgba(0, 0, 0, 0.7)";
      zoomCoordsDiv.style.color = "white";
      zoomCoordsDiv.style.padding = "5px";
      zoomCoordsDiv.style.borderRadius = "5px";
      zoomCoordsDiv.id = "zoom-coords-display"; // Add ID for later reference

      // Initialize with station count if available
      if (visiblePointCount !== undefined && totalPointCount) {
        const percentage = ((visiblePointCount / totalPointCount) * 100).toFixed(1);
        stationCountInfoRef.current = `Stations: ${visiblePointCount.toLocaleString()}/${totalPointCount.toLocaleString()} (${percentage}%)`;
        zoomCoordsDiv.innerText = `Zoom: ${view.zoom.toFixed(2)}, Coords: --, -- | ${stationCountInfoRef.current}`;
      } else {
        zoomCoordsDiv.innerText = `Zoom: ${view.zoom.toFixed(2)}, Coords: --, --`;
      }

      if (uiControls) {
        Object.entries(uiControls).forEach(([key, control]) => {
          // Ensure control is an HTMLElement before adding it
          if (control instanceof HTMLElement) {
            view.ui.add(control, key);
          }
        });
      }
      // Append the zoom level div to the view's container
      view.ui.add(zoomCoordsDiv, "manual");
      // Update zoom level on zoom change
      view.watch('zoom', (zoom) => {
        const coordPart = `Zoom: ${zoom.toFixed(2)}, Coords: --, --`;
        if (stationCountInfoRef.current) {
          zoomCoordsDiv.innerText = `${coordPart} | ${stationCountInfoRef.current}`;
        } else {
          zoomCoordsDiv.innerText = coordPart;
        }
      });



      view.when(() => {
        console.log("Map is ready, adding layers...");
        layers.forEach(({ layer, visible, popupEnabled }) => {
          if (layer) {
            layer.visible = visible;
            // Set popup enabled status if specified
            if (typeof popupEnabled === 'boolean' && 'popupEnabled' in layer) {
              (layer as any).popupEnabled = popupEnabled;
            }
            console.log("Adding layer:", layer);
            view.map.add(layer);
          }
        });
        // Keep the highlight layer on top
        if (pulseLayerRef.current) {
          try {
            (view.map as any).reorder(pulseLayerRef.current, (view.map as any).layers.length - 1);
          } catch { }
        }
        if (onMapLoaded) {
          onMapLoaded(map, view);
        }
      });
      // Update coordinates on pointer-move while preserving station count
      view.on('pointer-move', (event) => {
        const point = view.toMap({ x: event.x, y: event.y });
        if (point && typeof point.latitude === 'number' && typeof point.longitude === 'number') {
          const coordPart = `Zoom: ${view.zoom.toFixed(2)}, Coords: ${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;

          // Always include station count info if available
          if (stationCountInfoRef.current) {
            zoomCoordsDiv.innerText = `${coordPart} | ${stationCountInfoRef.current}`;
          } else {
            zoomCoordsDiv.innerText = coordPart;
          }
        }
      });
      view.on("click", (event) => {
        console.log("Map clicked at:", event.mapPoint);

        view.hitTest(event)
          .then((response) => {
            const graphicResult = response.results?.find((result) => {
              return result.type === "graphic" && "graphic" in result;
            });

            if (graphicResult && "graphic" in graphicResult) {
              if (graphicResult.graphic?.geometry?.type === "point") {
                const point = graphicResult.graphic.geometry as __esri.Point;
                console.log("Graphic layer title:", point.latitude, point.longitude);
              } else {
                console.log("Graphic layer is not a point geometry.");
              }
              console.log("Graphic layer title:", graphicResult.graphic?.layer?.title);
              console.log("Graphic layer id:", graphicResult.graphic?.layer?.id);
              let selectedData = null;
              if (graphicResult.graphic?.geometry?.type === "point") {
                const point = graphicResult.graphic.geometry as __esri.Point;
                const lon = point.longitude ?? 0;
                const lat = point.latitude ?? 0;

                const tolerances = [0.0001, 0.005, 0.01, 0.1, 0.5];

                for (const tol of tolerances) {
                  selectedData = data.find(d =>
                    Math.abs(d.x - lon) < tol && Math.abs(d.y - lat) < tol
                  );
                  if (selectedData) break;
                }
              }

              if (!selectedData) {
                console.error("No matching data found!");
                return;
              }

              setSelectedRow(selectedData.index - 1);
              updateMapCoordinates(selectedData.x, selectedData.y);
              setSelectedPointId(selectedData.sectionId);
              // setDetailsModalOpen(true);

            } else {
              console.log("No PMIS Data Point found at clicked location.");
            }
          })
          .catch((error) => {
            console.error("Error during hitTest:", error);
          });
      });

      // Right-click event to copy coordinates
      view.on("pointer-down", async (event) => {
        if (event.button === 2) { // Right-click only
          event.stopPropagation();

          const point = view.toMap({ x: event.x, y: event.y });
          if (point && typeof point.latitude === 'number' && typeof point.longitude === 'number') {
            const coordsText = `${point.latitude.toFixed(6)}, ${point.longitude.toFixed(6)}`;

            try {
              await navigator.clipboard.writeText(coordsText);

              // Show a temporary notification
              const notification = document.createElement("div");
              notification.innerText = `Copied: ${coordsText}`;
              notification.style.position = "absolute";
              notification.style.top = `${event.y}px`;
              notification.style.left = `${event.x}px`;
              notification.style.backgroundColor = "black";
              notification.style.color = "white";
              notification.style.padding = "5px";
              notification.style.borderRadius = "5px";
              notification.style.zIndex = "1000";

              mapRef.current?.appendChild(notification);

              setTimeout(() => {
                notification.remove();
              }, 1500);
            } catch (err) {
              console.error("Failed to copy coordinates:", err);
            }
          }
        }
      });
      function retrieveFeatureLayer(name: string): __esri.Layer | undefined {
        let layer = map.layers.find((lyr: __esri.Layer) => lyr.title === name);
        return layer;
      }

      // Usage in getActiveLayers
      const getActiveLayers = (z: number) => layers.forEach((x) => {
        let feat = retrieveFeatureLayer(x.name);
        if (feat) { // Check if feat is defined
          view.whenLayerView(feat).then((y) => {
            displayFeatOnZoom(y, z);
          });
        }
      });

      async function displayFeatOnZoom(layerView: __esri.LayerView, zoom: number) {
        {
          let displayFeatZoom = [
            "PMIS Data",
            "AADT",
            "Functional Classification & Urban Areas",
            "Reference Markers",
            "Control Sections",
            "Speed Limits",
            "Future Traffic & Percent Truck",
            "Cemeteries",
            "Texas Roadways Unsegmented",
            "Highways"
          ];
          if (layerView.layer.title && displayFeatZoom.includes(layerView.layer.title)) {
            const featureLayer = layerView.layer as FeatureLayer;
            let getItem: { [key: string]: () => void } = {
              "PMIS Data Points": () => {
                featureLayer.definitionExpression = '1=1';
              },
              "Highways": () => {
                if (zoom <= 4) {
                  featureLayer.definitionExpression = "SUBSTRING(RTE_NM,1,2)='IH'";
                } else if (zoom > 4 && zoom <= 6) {
                  featureLayer.definitionExpression = "(SUBSTRING(RTE_NM,1,2)='IH' or SUBSTRING(RTE_NM,1,2)='US')"
                } else if (zoom > 6 && zoom < 8) {
                  featureLayer.definitionExpression = "(SUBSTRING(RTE_NM,1,2)='IH' or SUBSTRING(RTE_NM,1,2)='US')"
                } else if (zoom >= 8) {
                  featureLayer.definitionExpression = "1=1"; // No restrictions, show all features
                } else {
                  featureLayer.definitionExpression = ""; // Default case
                }

              },
              "Texas Roadways Unsegmented": () => {
                switch (zoom) {
                  case 6:
                  case 7:
                    featureLayer.definitionExpression = "RTE_PRFX = 'IH' AND RDBD_TYPE = 'Single Roadbed'";
                    break;
                  case 8:
                    featureLayer.definitionExpression = "RTE_PRFX IN ('IH', 'US') AND RDBD_TYPE = 'Single Roadbed'";
                    break;
                  case 9:
                  case 10:
                  case 11:
                    featureLayer.definitionExpression = "RTE_PRFX NOT IN ('CS', 'PR') AND RDBD_TYPE = 'Single Roadbed'";
                    break;
                  case 12:
                  case 13:
                  default:
                    featureLayer.definitionExpression = '';
                    break;
                }
              },
              "AADT": () => {
                if (zoom < 6) {
                  featureLayer.definitionExpression = `ZLEVEL < 7`;
                } else if (zoom >= 6 && zoom <= 13) {
                  featureLayer.definitionExpression = `ZLEVEL < ${zoom + 1}`;
                } else {
                  featureLayer.definitionExpression = `ZLEVEL <= 13`;
                }
              },
              "Functional Classification & Urban Areas": () => {
                switch (zoom) {
                  case 6:
                  case 7:
                  case 8:
                    featureLayer.title === "TxDOT Functional Classification" ? featureLayer.definitionExpression = "RTE_PRFX ='IH' AND RDBD_TYPE = 'KG'" : null;
                    break;
                  case 9:
                  case 10:
                    featureLayer.title === "TxDOT Functional Classification" ? featureLayer.definitionExpression = "(RTE_PRFX IN ('IH', 'US') OR F_SYSTEM IN (1,2,3)) AND RDBD_TYPE = 'KG'" : null;
                    break;
                  case 11:
                  case 12:
                  case 13:
                  default:
                    featureLayer.title === "TxDOT Functional Classification" ? featureLayer.definitionExpression = "" : null;
                    break;
                }
              },
              "Reference Markers": () => {
                if (zoom <= 4) {
                  featureLayer.definitionExpression = "MOD(MRKR_NBR, 400) = 0";
                } else if (zoom > 4 && zoom <= 6) {
                  featureLayer.definitionExpression = "MOD(MRKR_NBR, 200) = 0";
                } else if (zoom > 6 && zoom <= 10) {
                  featureLayer.definitionExpression = "MOD(MRKR_NBR, 100) = 0";
                } else if (zoom > 10) {
                  featureLayer.definitionExpression = "1=1"; // No restrictions, show all features
                } else {
                  featureLayer.definitionExpression = ""; // Default case
                }

              },
              "Control Sections": () => {
                switch (zoom) {
                  case 5:
                  case 6:
                  case 7:
                    featureLayer.definitionExpression = "RTE_PRFX='IH'";
                    break;
                  case 8:
                  case 9:
                    featureLayer.definitionExpression = "(RTE_PRFX='IH' or RTE_PRFX='US')";
                    break;
                  case 10:
                    featureLayer.definitionExpression = "(RTE_PRFX='IH' or RTE_PRFX='SH' or RTE_PRFX='US' or RTE_PRFX='SL')";
                    break;
                  case 11:
                  case 12:
                    featureLayer.definitionExpression = "RTE_PRFX NOT IN ('CS', 'FC', 'CR', 'FD', 'PR')";
                    break;
                  case 13:
                  default:
                    featureLayer.definitionExpression = "RTE_PRFX <> 'CS'";
                    break;
                }
              },
              "Speed Limits": () => {
                switch (zoom) {
                  case 6:
                  case 7:
                  case 8:
                    featureLayer.definitionExpression = "RTE_PRFX ='IH' AND RDBD_TYPE = 'KG'";
                    break;
                  case 9:
                  case 10:
                    featureLayer.definitionExpression = "RTE_PRFX IN ('IH','US') AND RDBD_TYPE = 'KG'";
                    break;
                  case 11:
                  case 12:
                    featureLayer.definitionExpression = "RTE_PRFX IN ('IH','SH','US','SL') AND RDBD_TYPE = 'KG'";
                    break;
                  case 13:
                  default:
                    featureLayer.definitionExpression = '';
                    break;
                }
              },
              "Future Traffic & Percent Truck": () => {
                switch (zoom) {
                  case 6:
                  case 7:
                  case 8:
                    featureLayer.definitionExpression = "SUBSTRING(RIA_RTE_ID,1,2)='IH'";
                    break;
                  case 9:
                  case 10:
                    featureLayer.definitionExpression = "(SUBSTRING(RIA_RTE_ID,1,2)='IH' or SUBSTRING(RIA_RTE_ID,1,2)='US')";
                    break;
                  case 11:
                    featureLayer.definitionExpression = "(SUBSTRING(RIA_RTE_ID,1,2)='IH' or SUBSTRING(RIA_RTE_ID,1,2)='US' or SUBSTRING(RIA_RTE_ID,1,2)='SH' or SUBSTRING(RIA_RTE_ID,1,2)='SL' or SUBSTRING(RIA_RTE_ID,1,2)='TL')";
                    break;
                  case 12:
                  case 13:
                  default:
                    featureLayer.definitionExpression = "(SUBSTRING(RIA_RTE_ID,1,2)='IH' or SUBSTRING(RIA_RTE_ID,1,2)='US' or SUBSTRING(RIA_RTE_ID,1,2)='SH' or SUBSTRING(RIA_RTE_ID,1,2)='SL' or SUBSTRING(RIA_RTE_ID,1,2)='TL')";
                    break;
                }
              },
              "Cemeteries": () => {
                switch (zoom) {
                  case 6:
                  case 7:
                  case 8:
                  case 9:
                    featureLayer.definitionExpression = "RTE_PRFX='IH'";
                    break;
                  case 10:
                  case 11:
                  case 12:
                  case 13:
                  default:
                    featureLayer.definitionExpression = "";
                    break;
                }
              }
            };

            // Execute the appropriate function based on the layer name
            if (featureLayer.title && getItem[featureLayer.title]) {
              getItem[featureLayer.title]();
            }
          }
        }
      }

      if (showLegend) {
        // Create controls container
        const controlsContainer = document.createElement("div");
        controlsContainer.style.padding = "10px";
        controlsContainer.style.borderRadius = "5px";
        controlsContainer.style.display = "flex";
        controlsContainer.style.flexDirection = "column"; // Stack items vertically
        controlsContainer.style.gap = "8px"; // Space between items

        // Apply styles based on the selected theme
        if (theme === 'dark') {
          controlsContainer.style.backgroundColor = "#333"; // Dark gray background for dark theme
          controlsContainer.style.color = "#fff"; // White text for dark theme
          controlsContainer.style.boxShadow = "0 2px 5px rgba(255, 255, 255, 0.2)"; // Subtle shadow for depth
        } else {
          controlsContainer.style.backgroundColor = "#f0f0f0"; // Light gray background for light theme
          controlsContainer.style.color = "#000"; // Black text for light theme
          controlsContainer.style.boxShadow = "0 2px 5px rgba(0, 0, 0, 0.2)"; // Subtle shadow for depth
        }

        layers.forEach((x, index) => {
          var checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = x.visible;
          checkbox.id = `showLegend-ref-markers-${index}`; // Ensure a unique ID

          // Create legend symbol
          var legendSymbol = document.createElement("span");
          legendSymbol.style.display = "inline-block";
          legendSymbol.style.width = "15px";
          legendSymbol.style.marginRight = "5px";
          legendSymbol.style.backgroundColor = x.legendColor || "gray";
          legendSymbol.style.marginLeft = "8px"; // Adds space between checkbox and symbol

          // Style based on legendShape
          switch (x.legendShape) {
            case 'dot':
              legendSymbol.style.height = "15px";
              legendSymbol.style.borderRadius = "50%";
              legendSymbol.style.border = "1px solid black"; // Add black border
              break;
            case 'square':
              legendSymbol.style.height = "15px";
              legendSymbol.style.borderRadius = "0";
              legendSymbol.style.border = "1px solid black"; // Add black border
              break;
            case 'line':
              legendSymbol.style.height = "4px";
              legendSymbol.style.borderRadius = "0";
              break;
            default:
              legendSymbol.style.height = "15px";
              legendSymbol.style.borderRadius = "50%";
          }


          var label = document.createElement("label");
          // label.innerText = `Show ${x.name} - (${featuresCount})`; // Indicate layer name
          label.innerText = `${x.name}`; // Indicate layer name
          label.htmlFor = checkbox.id;
          label.style.marginLeft = "5px"; // Space between checkbox and label
          label.style.fontWeight = "bold"; // Bold text for emphasis

          var container = document.createElement("div");
          container.style.display = "flex";
          container.style.alignItems = "center"; // Center items vertically

          if (needCheckBox === false) {
            // Skip adding checkbox when explicitly set to false
          } else {
            // Default behavior: add checkbox
            container.appendChild(checkbox);
          }
          container.appendChild(legendSymbol); // Add legend symbol to the container
          container.appendChild(label);
          controlsContainer.appendChild(container);

          checkbox.addEventListener("change", () => {
            const feat = retrieveFeatureLayer(x.name);
            if (feat) {
              feat.visible = checkbox.checked; // Update layer visibility based on checkbox state
            }
          });

        });
        view.ui.add(controlsContainer, "top-right");
      }
      const searchWidget = new Search({
        view: view,
        sources: searchSources,
      });

      // Add the search widget to view.ui (but hide it initially)
      view.ui.add(searchWidget, 'top-left');
      view.ui.components = (["attribution", "zoom", "compass"]);

      setMapView(view);
      view.watch('zoom', (newZoom) => {
        getActiveLayers(newZoom)
      });
    }

    return () => {
      if (pulseLayerRef.current) {
        stopPulsingHighlight(pulseLayerRef.current as any);
      }
      if (view) {
        view.destroy();
      }
    };
  }, []);

  useEffect(() => {
    console.log("🔁 MapComponent: data changed", data);
    let view = mapView;
    if (!view) return;

    view.when(() => {
      view.map.removeAll();
      if (x !== null && y !== null) {
        const point = new Point({
          longitude: x,
          latitude: y,
          spatialReference: { wkid: 4326 }
        });

        // Use reusable pulsing highlight for consistency
        if (pulseLayerRef.current) {
          stopPulsingHighlight(pulseLayerRef.current as any);
          startPulsingHighlight(pulseLayerRef.current as any, point);
        }
      }
      // Re-add our internal layers and ensure order: app layers then pulse on top
      if (graphicsLayerRef.current) {
        view.map.add(graphicsLayerRef.current);
      }
      layers.forEach(({ layer, visible, popupEnabled }) => {
        if (layer) {
          layer.visible = visible;
          if (typeof popupEnabled === 'boolean' && 'popupEnabled' in layer) {
            (layer as any).popupEnabled = popupEnabled;
          }
          view.map.add(layer);
        }
      });
      if (pulseLayerRef.current) {
        view.map.add(pulseLayerRef.current);
      }
    });


    view.on("click", (event) => {
      console.log("Map clicked at:", event.mapPoint);

      view.hitTest(event)
        .then((response) => {
          const graphicResult = response.results?.find((result) => {
            return result.type === "graphic" && "graphic" in result;
          });

          if (graphicResult && "graphic" in graphicResult) {
            if (graphicResult.graphic?.geometry?.type === "point") {
              const point = graphicResult.graphic.geometry as __esri.Point;
              console.log("Graphic layer title:", point.latitude, point.longitude);
            } else {
              console.log("Graphic layer is not a point geometry.");
            }
            console.log("Graphic layer title:", graphicResult.graphic?.layer?.title);
            console.log("Graphic layer id:", graphicResult.graphic?.layer?.id);
            let selectedData = null;
            if (graphicResult.graphic?.geometry?.type === "point") {
              const point = graphicResult.graphic.geometry as __esri.Point;
              const lon = point.longitude ?? 0;
              const lat = point.latitude ?? 0;

              const tolerances = [0.0001, 0.005, 0.01, 0.1, 0.5];

              for (const tol of tolerances) {
                selectedData = data.find(d =>
                  Math.abs(d.x - lon) < tol && Math.abs(d.y - lat) < tol
                );
                if (selectedData) break;
              }
            }

            if (!selectedData) {
              console.error("No matching data found!");
              return;
            }

            setSelectedRow(selectedData.index - 1);
            updateMapCoordinates(selectedData.x, selectedData.y);
            setSelectedPointId(selectedData.sectionId);

            // Start pulsing highlight at clicked point for supported pages
            const validPaths = [
              "level_one_sections",
              "level_one",
              "special_sections",
              "special",
              "experimental_sections",
              "experimental"
            ];
            const isValidPath = pathname ? validPaths.some(path => pathname.includes(path)) : false;
            if (isValidPath && pulseLayerRef.current && graphicResult.graphic.geometry?.type === "point") {
              const pt = graphicResult.graphic.geometry as __esri.Point;
              stopPulsingHighlight(pulseLayerRef.current as any);
              startPulsingHighlight(pulseLayerRef.current as any, pt);
            }
            // setDetailsModalOpen(true);

          } else {
            console.log("No PMIS Data Point found at clicked location.");
          }
        })
        .catch((error) => {
          console.error("Error during hitTest:", error);
        });
    });
    setMapView(view);
  }, [data]);

  useEffect(() => {
    if (!mapView || !mapView.map || !basemapUrl) return;
    const isVector = basemapUrl.endsWith(".json") || basemapUrl.includes("VectorTileServer");

    const newBaseLayer = isVector
      ? new VectorTileLayer({
        url: newBaseMapUrl || basemapUrl,
        opacity: mapOpacity / 100 // Convert percentage to decimal
      })
      : new TileLayer({
        url: newBaseMapUrl || basemapUrl,
        opacity: mapOpacity / 100 // Convert percentage to decimal
      });

    const newBasemap = new Basemap({
      baseLayers: [newBaseLayer],
    });

    // ✅ Safely set new basemap
    mapView.map.basemap = newBasemap;
  }, [basemapUrl, mapView]);

  // Add new effect to handle opacity changes separately
  useEffect(() => {
    if (!mapView || !mapView.map || !mapView.map.basemap) return;

    // Update opacity of the current basemap's baseLayer
    const baseLayer = mapView.map.basemap.baseLayers.getItemAt(0);
    if (baseLayer) {
      baseLayer.opacity = mapOpacity / 100;
    }
  }, [mapOpacity, mapView]);

  useEffect(() => {
    if (visiblePointCount !== undefined && totalPointCount) {
      const percentage = ((visiblePointCount / totalPointCount) * 100).toFixed(1);
      stationCountInfoRef.current = `Stations: ${visiblePointCount.toLocaleString()}/${totalPointCount.toLocaleString()} (${percentage}%)`;

      // Update the display if the element exists
      const zoomCoordsDiv = document.getElementById('zoom-coords-display');
      if (zoomCoordsDiv && mapView) {
        // Get the current coordinate part of the text
        const currentText = zoomCoordsDiv.innerText;
        const coordPart = currentText.includes(' | ')
          ? currentText.split(' | ')[0]
          : currentText;

        // Update with new station count
        zoomCoordsDiv.innerText = `${coordPart} | ${stationCountInfoRef.current}`;
      }
    }
  }, [visiblePointCount, totalPointCount, mapView]);

  // Create a function to add flickering marker
  const addFlickeringMarker = (longitude: number, latitude: number) => {
    if (!graphicsLayerRef.current) return;

    // Clear existing graphics
    graphicsLayerRef.current.removeAll();

    // Create point
    const point = new Point({
      longitude,
      latitude
    });

    // Create an SVG string with flickering animation
    const svgString = `
      <svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 60 60">
        <style>
          @keyframes flicker {
            0%, 100% { opacity: 1; r: 15; stroke-width: 2; }
            25% { opacity: 0.6; r: 17; stroke-width: 3; }
            50% { opacity: 0.9; r: 18; stroke-width: 2.5; }
            75% { opacity: 0.7; r: 16; stroke-width: 2; }
          }
          @keyframes pulse {
            0% { r: 12; opacity: 0.8; }
            70% { r: 25; opacity: 0; }
            100% { r: 12; opacity: 0; }
          }
          .flicker-ring {
            animation: flicker 1.5s infinite ease-in-out;
            fill: none;
            stroke: #2196F3;
            stroke-width: 2;
          }
          .pulse {
            animation: pulse 2s infinite;
            transform-origin: center;
          }
        </style>
        <circle cx="30" cy="30" r="15" class="flicker-ring" />
        <circle cx="30" cy="30" r="12" class="pulse" fill="#2196F3" opacity="0.3" />
        <circle cx="30" cy="30" r="8" fill="#FFEB3B" />
      </svg>
    `;

    // Create a symbol from the SVG
    const pictureSymbol = {
      type: "picture-marker" as const,
      url: `data:image/svg+xml;base64,${btoa(svgString)}`,
      width: 60,
      height: 60
    };

    // Create the graphic
    const graphic = new Graphic({
      geometry: point,
      symbol: pictureSymbol
    });

    // Add to the graphics layer
    graphicsLayerRef.current.add(graphic);
  };

  const addFlickeringHighlight = useCallback((point: __esri.Point) => {
    console.log('addFlickeringHighlight called with point:', point);

    if (!graphicsLayerRef.current) {
      console.error('Graphics layer not initialized');
      return;
    }

    // Clear any existing highlights
    graphicsLayerRef.current.removeAll();
    console.log('Cleared existing graphics');

    try {
      // Create the main point marker
      const pointGraphic = new Graphic({
        geometry: point,
        symbol: new CircleSymbol({
          style: "circle",
          size: 8,
          color: [33, 150, 243, 0.8],
          outline: {
            color: [255, 255, 255, 1],
            width: 2
          }
        })
      });
      console.log('Created point graphic:', pointGraphic);

      // Create the animated ring with explicit typing
      const ringSymbol = {
        type: "simple-marker" as const,
        style: "circle" as const,
        size: 12,
        color: [33, 150, 243, 0],
        outline: {
          color: [33, 150, 243, 0.8],
          width: 2
        }
      };

      const ringGraphic = new Graphic({
        geometry: point,
        symbol: ringSymbol
      });
      console.log('Created ring graphic:', ringGraphic);

      // Add both graphics to the layer
      graphicsLayerRef.current.addMany([pointGraphic, ringGraphic]);
      console.log('Added graphics to layer');

      // Create animation with debugging
      let size = 24;
      let growing = true;
      let frameCount = 0;

      const animate = () => {
        if (!graphicsLayerRef.current) {
          console.error('Graphics layer lost during animation');
          return;
        }

        frameCount++;
        // // Change from logging every 60 frames to every 300 frames (less frequent)
        // if (frameCount % 300 === 0) {
        //   console.log(`Animation running, current size: ${size.toFixed(1)}`);
        // }

        if (growing) {
          size += 0.5;
          if (size >= 40) growing = false;
        } else {
          size -= 0.5;
          if (size <= 24) growing = true;
        }

        try {
          ringGraphic.symbol = {
            type: "simple-marker" as const,
            style: "circle" as const,
            size: size,
            color: [33, 150, 243, 0],
            outline: {
              color: [33, 150, 243, 0.8],
              width: 2
            }
          };
          requestAnimationFrame(animate);
        } catch (error) {
          console.error('Error updating ring symbol:', error);
        }
      };

      animate();
      console.log('Started animation');
    } catch (error) {
      console.error('Error in addFlickeringHighlight:', error);
    }
  }, []);

  useEffect(() => {
    // Create an array of valid path segments
    const validPaths = ["level_one", "special", "experimental"];
    // Check if current pathname includes any of the valid paths
    const isValidPath = pathname ? [
      "level_one_sections",
      "level_one",
      "special_sections",
      "special",
      "experimental_sections",
      "experimental"
    ].some(path => pathname.includes(path)) : false;

    if (!isValidPath) {
      console.log('Not in supported path, skipping highlight. Current path:', pathname);
      return;
    }

    if (!mapView || !mapView.ready) {
      console.error("MapView not ready:", { mapView });
      return;
    }

    if (x !== null && y !== null) {
      console.log('Coordinates received:', { x, y });
      const point = new Point({
        longitude: x,
        latitude: y,
        spatialReference: { wkid: 4326 }
      });
      console.log('Created point:', point);

      // Use reusable pulsing highlight for consistency
      if (pulseLayerRef.current) {
        stopPulsingHighlight(pulseLayerRef.current as any);
        startPulsingHighlight(pulseLayerRef.current as any, point);
      }

      mapView.goTo({
        target: point,
        zoom: 10,
      }).catch(error => {
        console.error('Error in goTo:', error);
      });
    } else {
      console.log('No coordinates available:', { x, y });
    }
  }, [x, y, mapView, pathname, addFlickeringHighlight]);

  useEffect(() => {
    const isValidPath = pathname ? [
      "level_one_sections",
      "level_one",
      "special_sections",
      "special",
      "experimental_sections",
      "experimental"
    ].some(path => pathname.includes(path)) : false;

    if (!isValidPath) return;

    if (!mapView || !mapView.ready) {
      console.error("mapView is not initialized yet.");
      return;
    }

    // On supported pages, we use pulsing highlight only; skip old flicker marker
    if (!isValidPath) {
      if (x !== null && y !== null) {
        addFlickeringMarker(x, y);
        mapView.goTo({ target: [x, y], zoom: 10 });
      } else {
        console.error("Invalid coordinates: x or y is null.");
      }
    }
  }, [x, y, mapView, pathname]);


  return (
    <>
      <div ref={mapRef} style={{ width: '100%', height: '93vh' }}></div>
    </>
  );
};

export default MapComponent;
