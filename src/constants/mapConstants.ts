// src/constants/mapConstants.ts
import { route } from '@/config';

type BaseMapItem = {
  name: string;
  id: string;
  url: string;
  type: string;
  icon?: string; // optional
};

export const baseMaps: BaseMapItem[] = [
    {
      name: "TxDOT",
      id: "txdot",
      url: "https://tiles.arcgis.com/tiles/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Vector_Tile_Basemap/VectorTileServer",
      type: "vector",
      icon: `${route}/img/TxDOT_Vector_Tile_Basemap.png`,
    },
    {
      name: "TxDOT Light Gray",
      id: "lightgray",
      url: "https://www.arcgis.com/sharing/rest/content/items/507a9905e7154ce484617c7327ee8bc4/resources/styles/root.json",
      type: "vector",
      icon: `${route}/img/TxDOT_Light_Gray.png`,
    },
    {
      name: "TxDOT Dark Gray",
      id: "darkgray",
      url: "https://www.arcgis.com/sharing/rest/content/items/4bd376c56f314bc5a36446630db604a6/resources/styles/root.json",
      type: "vector",
      icon: `${route}/img/TxDOT_Dark_Gray.png`,
    },
    // {
    //   name: "Texas Imagery Service",
    //   id: "imagery",
    //   url: "https://tiles.arcgis.com/tiles/KTcxiTD9dsQw4r7Z/arcgis/rest/services/Texas_Imagery_Service/MapServer/tile/{z}/{y}/{x}",
    //   type: "raster",
    // //   icon: "mdi:satellite-variant",
    // },
    {
      name: "Esri Streets",
      id: "esristreets",
      url: "https://basemaps.arcgis.com/arcgis/rest/services/World_Basemap_v2/VectorTileServer",
      type: "vector",
      icon: `${route}/img/Esri_Streets.png`,
    },
    // {
    //   name: "Open Street Map",
    //   id: "osm",
    //   url: "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png",
    //   type: "raster",
    // //   icon: "mdi:map-outline",
    // },
  ];
  