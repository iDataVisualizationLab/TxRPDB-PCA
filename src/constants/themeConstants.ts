// src/constants/themeConstants.ts

export type Theme = {
    name: string;
    color: string; // background color
    foreground: string; // text color
    hover: string; // hover color
    active: string; // active color or selected-item background
    shade: string; // shade/border color
  };
  
  export const themes: Theme[] = [
    {
      name: 'Light',             // Default light theme and CB-Friendly (Blue)
      color: '#ffffff',          // white
      foreground: '#000000',     // black
      hover: '#e8f3ff',          // very light blue
      shade: '#f8f9fa',          // off-white border/shade
      active: '#0C7BDC',      // blue accent
    },
    {
      name: 'Dark',
      color: '#1e293b',
      foreground: '#f8fafc',
      hover: '#374151',      // slate-700
      shade: '#111827',      // slate-900
      active: '#6366f1',  // indigo-400
    },
    {
      name: 'Night',
      color: '#0f172a',
      foreground: '#e2e8f0',
      hover: '#1e293b',      // slate-800
      shade: '#090e1a',      // almost black
      active: '#7c3aed',  // purple-500
    },
    {
      name: 'Pastel (Peach)',
      color: '#fdf6f0',
      foreground: '#4b4b4b',
      hover: '#ffe4e6',      // soft pink
      shade: '#f9e2dc',      // muted peach
      active: '#f8b195',  // pastel peach
    },
    {
        name: 'Pastel (Blue)',
        color:    '#f0f4f8',   // very light sky
        foreground:'#2e3a46',  // dark slate
        hover:    '#d3e2f1',   // light pastel blue
        shade:    '#e6eff7',   // off-white blue tint
        active:'#6fa8dc',   // pastel sky-blue accent
      }
  ];
  