'use client';
import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, useMap } from 'react-leaflet';
import CustomMarker from './CustomMarker';
import { useSectionModal } from '@/context/SectionContext';
import 'leaflet/dist/leaflet.css';

const DEFAULT_CENTER: [number, number] = [31.2, -99.5]; // Center of Texas
const DEFAULT_ZOOM = 6;

// Update map view when coordinates change
const MapUpdater = () => {
  const { x, y } = useSectionModal().getCoordinates();
  const map = useMap();

  useEffect(() => {
    if (x !== null && y !== null) {
      map.flyTo([y, x], 12, {
        duration: 1.5,
        easeLinearity: 0.25
      });
    }
  }, [map, x, y]);

  return null;
};

interface MapViewProps {
  height?: string;
  width?: string;
  showAllPoints?: boolean;
  popupEnabled?: boolean;
  popupOptions?: {
    dockEnabled?: boolean;
    dockOptions?: {
      buttonEnabled?: boolean;
      breakpoint?: boolean;
      position?: string;
    };
  };
  layers: Array<{
    layer: __esri.Layer;
    name: string;
    visible: boolean;
    popupEnabled?: boolean;
  }>;
}

const MapView: React.FC<MapViewProps> = ({ 
  height = "100vh", 
  width = "100%",
  showAllPoints = true
}) => {
  const { data, x, y, selectedPointId, setSelectedPointId, updateMapCoordinates } = useSectionModal();
  
  const handleMarkerClick = (id: string, x: number, y: number) => {
    setSelectedPointId(id);
    updateMapCoordinates(x, y);
  };

  return (
    <div style={{ height, width }}>
      <MapContainer 
        center={DEFAULT_CENTER} 
        zoom={DEFAULT_ZOOM} 
        style={{ height: "100%", width: "100%" }}
        zoomControl={true}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        
        {/* Display all points if showAllPoints is true */}
        {showAllPoints && data.map((point) => (
          <CustomMarker
            key={point.sectionId}
            position={[point.y, point.x]}
            markerType={selectedPointId === point.sectionId ? 'ultramodern' : 'default'}
            size={selectedPointId === point.sectionId ? 'large' : 'small'}
            pulse={selectedPointId === point.sectionId}
            flickering={selectedPointId === point.sectionId}
            title={`${point.sectionId} - ${point.highway}`}
            onClick={() => handleMarkerClick(point.sectionId, point.x, point.y)}
          />
        ))}
        
        {/* If a point is selected but not in the data array, show it specially */}
        {x !== null && y !== null && !data.some(point => point.x === x && point.y === y) && (
          <CustomMarker
            position={[y, x]}
            markerType="ultramodern"
            size="large"
            pulse={true}
            flickering={true}
            title="Selected Location"
          />
        )}
        
        <MapUpdater />
      </MapContainer>
    </div>
  );
};

export default MapView;
