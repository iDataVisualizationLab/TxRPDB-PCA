import React from 'react';
import { Marker, Tooltip } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Define marker types with their colors
const markerTypes = {
  default: '#3388ff',  // blue
  primary: '#1976D2',  // darker blue
  success: '#4CAF50',  // green
  warning: '#FF9800',  // orange
  danger: '#F44336',   // red
  ultramodern: '#2196F3' // blue for the flickering ring
};

// Define marker sizes
const markerSizes = {
  small: 8,
  medium: 12,
  large: 16
};

type MarkerType = keyof typeof markerTypes;
type MarkerSize = keyof typeof markerSizes;

interface CustomMarkerProps {
  position: [number, number];
  markerType?: MarkerType;
  size?: MarkerSize;
  pulse?: boolean;
  title?: string;
  onClick?: () => void;
  flickering?: boolean; // New prop for flickering effect
}

const CustomMarker: React.FC<CustomMarkerProps> = ({
  position,
  markerType = 'default',
  size = 'medium',
  pulse = false,
  title,
  onClick,
  flickering = false
}) => {
  // Create the SVG for the marker
  const createSvgIcon = (type: MarkerType, size: MarkerSize, pulsing: boolean, isFlickering: boolean) => {
    const color = markerTypes[type];
    const radius = markerSizes[size];
    
    // For ultramodern flickering blue ring with yellow center
    if (isFlickering) {
      return `
        <svg xmlns="http://www.w3.org/2000/svg" width="${radius * 5}" height="${radius * 5}" viewBox="0 0 ${radius * 5} ${radius * 5}">
          <style>
            @keyframes flicker {
              0%, 100% { opacity: 1; r: ${radius * 1.5}; }
              25% { opacity: 0.4; r: ${radius * 1.7}; }
              50% { opacity: 0.7; r: ${radius * 2.0}; }
              75% { opacity: 0.5; r: ${radius * 1.8}; }
            }
            @keyframes pulse {
              0%, 100% { r: ${radius * 1.2}; opacity: 0.8; }
              50% { r: ${radius * 2.5}; opacity: 0; }
            }
            .flicker-ring {
              animation: flicker 1.5s infinite ease-in-out;
              transform-origin: center;
              fill: none;
              stroke: #2196F3;
              stroke-width: 1.5;
            }
            .pulse-ring {
              animation: pulse 2s infinite;
              transform-origin: center;
            }
          </style>
          <circle cx="${radius * 2.5}" cy="${radius * 2.5}" r="${radius * 1.5}" class="flicker-ring" />
          <circle cx="${radius * 2.5}" cy="${radius * 2.5}" r="${radius * 1.2}" class="pulse-ring" fill="#2196F3" opacity="0.3" />
          <circle cx="${radius * 2.5}" cy="${radius * 2.5}" r="${radius}" fill="#FFEB3B" /> <!-- Yellow center -->
        </svg>
      `;
    }
    
    // For regular markers with optional pulsing
    return `
      <svg xmlns="http://www.w3.org/2000/svg" width="${radius * 4}" height="${radius * 4}" viewBox="0 0 ${radius * 4} ${radius * 4}">
        <style>
          @keyframes pulse {
            0%, 100% { r: ${radius * 1.2}; opacity: 0.8; }
            50% { r: ${radius * 2.5}; opacity: 0; }
          }
          .pulse {
            animation: pulse 2s infinite;
            transform-origin: center;
          }
        </style>
        ${pulsing ? `<circle cx="${radius * 2}" cy="${radius * 2}" r="${radius * 1.2}" class="pulse" fill="${color}" />` : ''}
        <circle cx="${radius * 2}" cy="${radius * 2}" r="${radius}" fill="${color}" />
        <circle cx="${radius * 2}" cy="${radius * 2}" r="${radius * 0.7}" fill="white" />
      </svg>
    `;
  };

  // Create the icon
  const svgIcon = createSvgIcon(markerType, size, pulse, flickering || markerType === 'ultramodern');
  const svgUrl = `data:image/svg+xml;base64,${btoa(svgIcon)}`;

  const icon = L.icon({
    iconUrl: svgUrl,
    iconSize: [markerSizes[size] * 4, markerSizes[size] * 4],
    iconAnchor: [markerSizes[size] * 2, markerSizes[size] * 2],
  });

  return (
    <Marker 
      position={position} 
      icon={icon} 
      eventHandlers={{
        click: onClick,
      }}
    >
      {title && <Tooltip>{title}</Tooltip>}
    </Marker>
  );
};

export default CustomMarker;
