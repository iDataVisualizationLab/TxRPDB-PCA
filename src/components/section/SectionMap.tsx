'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useSectionModal } from "@/context/SectionContext";
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import Map from '@arcgis/core/Map';
import MapView from '@arcgis/core/views/MapView';
import * as reactiveUtils from "@arcgis/core/core/reactiveUtils";
import { useResizeDetector } from 'react-resize-detector';
import { Feature, GeoJsonProperties, Geometry } from 'geojson';
import { API_GET_PROXY, fetchProxy } from "@/lib/api";
import TableAndModalWrapper from '@/components/section/TableAndModalWrapper';

const DynamicMapComponent = dynamic(() => import('@/components/map-arcgis/map'), { ssr: false });

const SectionMap = ({
  title,
  geojsonPath,
  jsonReportPath,
  popupTemplate,
  modalTitle,
  legendColor,
  legendoshape,
  renderer
}: {
  title: string;
  geojsonPath: string;
  jsonReportPath: string;
  popupTemplate: any;
  modalTitle: string;
  legendColor?: string;
  legendoshape?: string;
  renderer?: any;
}) => {
  const { setModalData, setReportData, openModal, setSelectedRow, setSelectedPointId } = useSectionModal();
  const mapRef = useRef<Map | null>(null);
  const viewRef = useRef<MapView | null>(null);
  const { ref: tableContainerRef, width, height } = useResizeDetector();
  const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });

  useEffect(() => {
    if (width && height) setContainerDimensions({ width, height });
  }, [width, height]);

  const layer = new GeoJSONLayer({
    url: API_GET_PROXY + geojsonPath,
    title: title,
    popupTemplate,
    renderer: renderer || {
      type: "simple",
      symbol: {
        type: "simple-marker",
        size: 6,
        color: "#fc8d62",
        outline: { width: 0.8, color: "black" },
      },
    },
  });

  const handleMapLoaded = useCallback((map: Map, view: MapView) => {
    mapRef.current = map;
    viewRef.current = view;

    reactiveUtils.watch(
      () => view.ready,
      (ready) => {
        if (ready && view.popup) {
          view.popup.dockEnabled = false;
          view.popup.dockOptions = {
            position: "top-right",
            buttonEnabled: false,
            breakpoint: false
          };
          view.popup.autoCloseEnabled = false;
        }
      }
    );
  }, []);

  const mapProps = {
    map: new Map({
      basemap: 'streets-navigation-vector',
      layers: [layer],
    }),
    layers: [{
      layer,
      name: title,
      visible: true,
      legendColor: legendColor || '#fc8d62',
      legendShape: (legendoshape === 'line' || legendoshape === 'dot' || legendoshape === 'square') ?
        legendoshape as 'line' | 'dot' | 'square' : 'dot'
    }],
    needCheckBox: false,
    showLegend: true,
    showTable: false,
    onMapLoaded: handleMapLoaded,
    viewProperties: {
      navigation: { mouseWheelZoomEnabled: true },
      constraints: { snapToZoom: false },
    }
  };

  const fetchGeoJSON = useCallback(async () => {
    try {
      // const response = await fetch(geojsonPath);
      // const data = await response.json();
      const data = await fetchProxy(geojsonPath);
      const rows = data.features
        .filter((feature: Feature<Geometry, GeoJsonProperties>) => {
          const coords = feature.geometry && 'coordinates' in feature.geometry ? feature.geometry.coordinates : undefined;
          return (
            (feature.geometry.type === "Point" && Array.isArray(coords) && coords.length === 2) ||
            (feature.geometry.type === "LineString" && Array.isArray(coords) && coords.length >= 2)
          );
        })
        .map((feature: Feature<Geometry, GeoJsonProperties>, index: number) => {
          let x = 0, y = 0;

          if (feature.geometry.type === "Point") {
            [x, y] = feature.geometry.coordinates;
          } else if (feature.geometry.type === "LineString") {
            const coords = feature.geometry.coordinates;
            const [lon1, lat1] = coords[0];
            const [lon2, lat2] = coords[coords.length - 1];
            x = (lon1 + lon2) / 2;
            y = (lat1 + lat2) / 2;
          }
          return {
            ...feature.properties,
            index: index + 1,
            sectionId: feature.properties?.["Test Section"] || `Unknown-${index}`,
            highway: feature.properties?.["Highway"] || "N/A",
            color: "black",
            x,
            y,
            geometry: feature.geometry
          };
        });
      setModalData(rows);
    } catch (err) {
      console.error(err);
    }
  }, [geojsonPath, setModalData]);

  const fetchJsonReportData = useCallback(async () => {
    try {
      // const res = await fetch(jsonReportPath);
      // const reportdata = await res.json();
      const reportdata = await fetchProxy(jsonReportPath);
      setReportData(reportdata);
    } catch (err) {
      console.error(err);
    }

  }, [jsonReportPath, setReportData]);

  useEffect(() => {
    fetchGeoJSON();
    fetchJsonReportData();
    openModal();
    setSelectedRow(-1);
    setSelectedPointId("null");
  }, []);

  return (
    <div className="flex flex-col h-[95vh]">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-grow p-4 bg-gray-100">
        <div className="h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white">
          <DynamicMapComponent {...mapProps} />
        </div>
        <div ref={tableContainerRef} className="h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white">
          {/* <TableModal 
            title={modalTitle}
            containerDimensions={containerDimensions}
          /> */}
          <TableAndModalWrapper
            title={modalTitle}
            geojsonPath={geojsonPath}
            jsonReportPath={jsonReportPath}
            onDataUpdated={fetchGeoJSON}
          />
        </div>
      </div>
    </div>
  );
};

export default SectionMap;
