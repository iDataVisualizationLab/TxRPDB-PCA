"use client"
import { createContext, useContext, useState, ReactNode } from "react";

type MapContextType = {
  basemapUrl: string;
  setBasemapUrl: (url: string) => void;
  mapOpacity: number;
  setMapOpacity: (opacity: number) => void;
};

const MapContext = createContext<MapContextType | undefined>(undefined);

export const MapProvider = ({ children }: { children: ReactNode }) => {
  const [basemapUrl, setBasemapUrl] = useState(
    'https://tiles.arcgis.com/tiles/KTcxiTD9dsQw4r7Z/arcgis/rest/services/TxDOT_Vector_Tile_Basemap/VectorTileServer'
  );
  const [mapOpacity, setMapOpacity] = useState(100);

  return (
    <MapContext.Provider value={{ basemapUrl, setBasemapUrl, mapOpacity, setMapOpacity }}>
      {children}
    </MapContext.Provider>
  );
};

export const useMap = (): MapContextType => {
  const context = useContext(MapContext);
  if (!context) {
    throw new Error("useMap must be used within a MapProvider");
  }
  return context;
};
