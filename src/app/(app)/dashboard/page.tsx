'use client';

import dynamic from 'next/dynamic';
import React, { useEffect, useRef, useState } from 'react';
import PopupTemplate from '@arcgis/core/PopupTemplate';
import FeatureLayer from '@arcgis/core/layers/FeatureLayer';
import GeoJSONLayer from '@arcgis/core/layers/GeoJSONLayer';
import { routePublic } from '@/config';
import HelpButton from '@/components/HelpButton';
import { useGlobalLoading } from '@/context/GlobalLoadingContext';

import { API_GET_PROXY } from "@/lib/api";
// Dynamically import the MapComponent with SSR disabled
const DynamicMapComponent = dynamic(() => import('../../../components/map-arcgis/map'), {
  ssr: false,
});

const MainMapPage = () => {
  // Add loading state variables
  const { setLoading } = useGlobalLoading();
  const [isLoaded, setIsLoaded] = useState(false);
  
  // EXACT SAME loading pattern as other pages
  useEffect(() => {
    // Show loading indicator when component mounts
    setLoading(true);
    
    // Simulate resource loading completion
    const timer = setTimeout(() => {
      setIsLoaded(true);
      setLoading(false);
    }, 1000);
    
    // Clean up on unmount
    return () => {
      clearTimeout(timer);
      setLoading(false);
    };
  }, [setLoading]);

  const popupTemplate = new PopupTemplate({
    title: "<span style='color:rgb(64, 233, 255);'>Feature Information</span>",
    content: `
      <b>Highway:</b> {TX_SIGNED_HIGHWAY_RDBD_ID}<br>
      <b>Year:</b> {EFF_YEAR}<br>
      <b>Beginning TRM Number:</b> {TX_BEG_REF_MARKER_NBR}<br>
      <b>Beginning TRM Displacement:</b> {TX_BEG_REF_MRKR_DISP}<br>
      <b>Ending TRM Number:</b> {TX_END_REF_MARKER_NBR}<br>
      <b>Ending TRM Displacement:</b> {TX_END_REF_MARKER_DISP}<br>
      <b>AADT Current:</b> {TX_AADT_CURRENT}<br>
      <b>18KIP ESALS:</b> {TX_CURRENT_18KIP_MEAS}<br>
      <b>Truck AADT Percentage:</b> {TX_TRUCK_AADT_PCT}<br>
      <b>Distress Score:</b> {TX_DISTRESS_SCORE}<br>
      <b>Condition Score:</b> {TX_CONDITION_SCORE}<br>
      <b>Ride Score:</b> {TX_RIDE_SCORE}<br>
      <b>Maintenance Section:</b> {MAINT_SECTION}<br>
      <b>Pavement Type:</b> {BROAD_PAV_TYPE}
    `,
  });

  // Add GeoJSON Layer
  const geoJSON_PMIS_Layer = new GeoJSONLayer({
    url: `${routePublic}/files/pmis_lines_latest.geojson`,
    title: "PMIS Data",
    fields: [
      { name: "TX_SIGNED_HIGHWAY_RDBD_ID", type: "string", alias: "Highway" },
      { name: "EFF_YEAR", type: "string", alias: "Year" },
      { name: "TX_BEG_REF_MARKER_NBR", type: "double", alias: "Beginning Reference Marker" },
      { name: "TX_BEG_REF_MRKR_DISP", type: "double", alias: "Beginning Displacement" },
      { name: "TX_END_REF_MARKER_NBR", type: "double", alias: "Ending Reference Marker" },
      { name: "TX_END_REF_MARKER_DISP", type: "double", alias: "Ending Displacement" },
      { name: "TX_AADT_CURRENT", type: "string", alias: "AADT Current" }, 
      { name: "TX_CURRENT_18KIP_MEAS", type: "string", alias: "18KIP ESALS" }, 
      { name: "TX_TRUCK_AADT_PCT", type: "string", alias: "Truck AADT Percentage" },
      { name: "TX_DISTRESS_SCORE", type: "string", alias: "Distress Score" },
      { name: "TX_CONDITION_SCORE", type: "double", alias: "Condition Score" },
      { name: "TX_RIDE_SCORE", type: "string", alias: "Ride Score" },
      { name: "MAINT_SECTION", type: "string", alias: "Maintenance Section" },
      { name: "BROAD_PAV_TYPE", type: "string", alias: "Pavement Type" }
    ],    
    popupTemplate: popupTemplate,
    outFields: ["*"]
  });

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
      title: "<span style='color:rgb(64, 233, 255);'>Highway: <b>{RTE_CNTY}</b></span>",
      content: `
        <b>Route Name:</b> {RTE_NM}<br>
        <b>Route ID:</b> {RTE_ID}<br>
        <b>County:</b> {CNTY_NM}<br>
        <b>Length:</b> {SECT_LEN} miles
      `,  // Add content to the popup template
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
    // basemapUrl: 'https://tiles.arcgis.com/tiles/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Vector_Tile_Basemap/VectorTileServer',
    // theme: "dark",
    searchSources: [
      {
        // layer: HighwayLayer as __esri.FeatureLayer, // Explicitly cast to FeatureLayer
        layer: new FeatureLayer({ url: "https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Roadways_Search/FeatureServer/0" }),
        searchFields: ['RTE_CNTY'],
        displayField: 'RTE_CNTY',
        exactMatch: false,
        outFields: ['*'],
        name: 'Highways',
        placeholder: 'Search Highway...',
        autoNavigate: true,
        filter: null,
        definitionExpression: '',
        resultSymbol: {
            type: "simple-line",
            color: "cyan",
            width: "6px",
        }
        // getResults: async () => [],
        // getSuggestions: async () => [],
      } as unknown as __esri.LayerSearchSource,
      {
        // layer: REFLayer as __esri.FeatureLayer,
        layer: new FeatureLayer({ url: "https://services.arcgis.com/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Reference_Markers/FeatureServer/0" }),
        searchFields: ['RTE_NM', 'MRKR_NBR'],
        suggestionTemplate: "{RTE_NM} - {MRKR_NBR}",
        displayField: 'RTE_NM',
        exactMatch: false,
        outFields: ['*'],
        name: 'Reference Markers',
        placeholder: 'Search Reference Marker...',
        autoNavigate: true,
        filter: null,
        definitionExpression: '',
    } as unknown as __esri.LayerSearchSource,
      
      //     const { searchTerm } = params;
      //     const query = REFLayer.createQuery();
      //     query.where = `RTE_NM LIKE '%${searchTerm}%' OR MRKR_NBR LIKE '%${searchTerm}%'`;
      //     query.outFields = ['*'];
      //     query.returnGeometry = true;

      //     const results = await REFLayer.queryFeatures(query);
      //     return results.features.map((feature) => ({
      //       feature,
      //       name: `${feature.attributes.RTE_NM} - ${feature.attributes.MRKR_NBR}`,
      //       layer: REFLayer,
      //     }));
      //   }
      // } as unknown as __esri.LayerSearchSource,
    ],
    // uiControls: {  },
    layers: [
      {
        layer: geoJSON_PMIS_Layer,
        name: 'PMIS Data',
        visible: true,
        popupEnabled: true,
        legendColor: 'orange',
        legendShape: 'line' as 'line'// or 'square' or 'line'
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
        position: "auto"
      }
    }
  };

  const helpContent = (
    <div>
      <h3>Map Navigation Help</h3>
      <ul>
        <li><strong>Pan:</strong> Click and drag the map</li>
        <li><strong>Zoom:</strong> Use the scroll wheel or the zoom buttons</li>
        <li><strong>Search:</strong> Use the search bar to find highways or reference markers</li>
        <li><strong>Layer Visibility:</strong> Toggle layers on/off in the layer list</li>
        <li><strong>Get Information:</strong> Click on map features to see details</li>
      </ul>
      <h3>Data Layers</h3>
      <ul>
        <li><strong>PMIS Data Points:</strong> Shows pavement condition information</li>
        <li><strong>Reference Markers:</strong> Shows reference markers along highways</li>
        <li><strong>Highways:</strong> Shows the highway network</li>
      </ul>
    </div>
  );

  // Conditional rendering for loading state
  if (!isLoaded) {
    return <div></div>; // Empty div while loading
  }

  return (
    <>
      <DynamicMapComponent {...mapProps} />
      <HelpButton helpContent={helpContent} />
    </>
  );
};

export default MainMapPage;
