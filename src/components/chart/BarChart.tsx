// components/BarChart.tsx
import React from 'react';
import { Bar } from 'react-chartjs-2';
import { FaDownload } from "react-icons/fa";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
  ChartOptions,
} from 'chart.js';
import pattern from 'patternomaly'; 

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Cracking space color scheme
const CRACK_COLORS = {
  small: '#4CAF50',
  medium: '#FF9800',
  large: '#E53935',
  default: '#757575'
};

// Add seasonal color scheme
const SEASONAL_COLORS = {
  winter: '#1565C0', // Deep blue for winter
  summer: '#FF3D00', // Orange-red for summer
  default: '#757575'
};

// Default color palette for charts
const DEFAULT_COLORS = [
  '#4285F4', // Blue
  '#EA4335', // Red
  '#FBBC05', // Yellow
  '#34A853', // Green
  '#FF6D01', // Orange
  '#46BFBD', // Teal
  '#AC64AD', // Purple
  '#F7464A', // Bright red
];

interface BarChartProps {
  title: string;
  labels: string[];
  dataSets: {
    label: string;
    data: (number | null)[];
    backgroundColor?: string;
  }[];
  chartType?: 'default' | 'cracking' | 'seasonal'; // Added 'seasonal' as valid type
}

const BarChart: React.FC<BarChartProps> = ({ title, labels, dataSets, chartType = 'default' }) => {
  // Auto-detect chart type if not explicitly specified
  const detectChartType = () => {
    if (chartType !== 'default') return chartType;
    
    // Check if datasets have cracking-related keywords
    const hasCrackingLabels = dataSets.some(dataset => {
      const label = dataset.label.toLowerCase();
      return label.includes('crack') || 
             label.includes('small') || 
             label.includes('medium') || 
             label.includes('large');
    });
    
    if (hasCrackingLabels) return 'cracking';
    
    // Check if datasets have seasonal keywords
    const hasSeasonalLabels = dataSets.some(dataset => {
      const label = dataset.label.toLowerCase();
      return label.includes('summer') || 
             label.includes('winter');
    });
    
    if (hasSeasonalLabels) return 'seasonal';
    
    return 'default';
  };

  const effectiveChartType = detectChartType();
  // console.log('Detected Chart Type:', effectiveChartType);

  // Apply colors based on chart type with patterns
  const enhancedDataSets = dataSets.map((dataset, index) => {
    const label = dataset.label.toLowerCase();
    
    if (effectiveChartType === 'cracking') {
      if (label.includes('small')) {
        return { 
          ...dataset, 
          backgroundColor: pattern.draw('line', CRACK_COLORS.small),
          borderColor: CRACK_COLORS.small,
          borderWidth: 1
        };
      } else if (label.includes('medium')) {
        return { 
          ...dataset, 
          backgroundColor: pattern.draw('diagonal', CRACK_COLORS.medium),
          borderColor: CRACK_COLORS.medium,
          borderWidth: 1
        };
      } else if (label.includes('large')) {
        return { 
          ...dataset, 
          backgroundColor: pattern.draw('triangle', CRACK_COLORS.large),
          borderColor: CRACK_COLORS.large,
          borderWidth: 1
        };
      } else {
        return { ...dataset, backgroundColor: CRACK_COLORS.default };
      }
    } 
    else if (effectiveChartType === 'seasonal') {
      if (label.includes('winter')) {
        return { 
          ...dataset, 
          backgroundColor: pattern.draw('zigzag', SEASONAL_COLORS.winter),
          borderColor: SEASONAL_COLORS.winter,
          borderWidth: 1
        };
      } else if (label.includes('summer')) {
        return { 
          ...dataset, 
          backgroundColor: pattern.draw('diagonal-right-left', SEASONAL_COLORS.summer),
          borderColor: SEASONAL_COLORS.summer,
          borderWidth: 1
        };
      } else {
        return { ...dataset, backgroundColor: SEASONAL_COLORS.default };
      }
    }
    
    // For default chart types, use dots/circles with alternating patterns
    return { 
      ...dataset, 
      backgroundColor: pattern.draw(
        ['diagonal', 'line', 'zigzag', 'dot', 'dot-dash'][index % 5] as 'diagonal' | 'line' | 'zigzag' | 'dot' | 'dot-dash', 
        dataset.backgroundColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length]
      ),
      borderColor: dataset.backgroundColor || DEFAULT_COLORS[index % DEFAULT_COLORS.length],
      borderWidth: 1
    };
  });

  // // Debug logs
  // dataSets.forEach(dataset => {
  //   console.log(`Dataset: ${dataset.label}, Initial color: ${dataset.backgroundColor || 'none'}`);
  // });

  // enhancedDataSets.forEach(dataset => {
  //   console.log(`Enhanced dataset: ${dataset.label}, Final color: ${dataset.backgroundColor || 'none'}`);
  // });

  // console.log('Chart Type:', chartType);
  // console.log('Original Datasets:', dataSets);
  // console.log('Enhanced Datasets:', enhancedDataSets);

  const data = {
    labels: labels,
    datasets: enhancedDataSets,
  };

  const options: ChartOptions<'bar'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'top' as const,
      },
      title: {
        display: true,
        text: title,
      },
    },
    scales: {
      x: { title: { display: true, text: "Year" } },
      y: { title: { display: true, text: "LTE (%)" } },
    },
  };

  // Add CSV export function
  const exportToCSV = () => {
    // Skip export if no data
    if (!labels.length || !dataSets.length || !dataSets.some(set => set.data.some(val => val !== null && val > 0))) {
      return;
    }
    
    // Create CSV header with Year and all dataset labels
    const headerRow = ['Year', ...dataSets.map(set => set.label)];
    
    // Create data rows
    const dataRows = labels.map((label, i) => {
      const row = [label.toString()];
      
      // Add each dataset's value at this index
      dataSets.forEach(set => {
        const value = i < set.data.length ? set.data[i] : '';
        row.push(value !== null ? (typeof value === 'number' ? value.toFixed(2) : value) : '');
      });
      
      return row;
    });
    
    // Create CSV content
    const csvContent = [
      headerRow.join(','),
      ...dataRows.map(row => row.join(','))
    ].join('\n');
    
    // Create download
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `${title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_data.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Determine if we have data to export
  const hasData = labels.length > 0 && dataSets.some(set => 
    set.data.some(val => val !== null && val > 0)
  );

  return (
    <div className="w-full h-64 relative">
      {/* Only show export button if we have data */}
      {hasData && (
        <button 
          onClick={exportToCSV}
          className="absolute top-2 right-2 z-10 bg-green-600 hover:bg-green-700 text-white py-1 px-2 rounded-md flex items-center gap-1 text-xs transition-colors"
          title="Export as CSV"
        >
          <FaDownload size={12} /> CSV
        </button>
      )}
      <Bar data={data} options={options} />
    </div>
  );
};

export default BarChart;

// // Example usage of BarChart component
// const yearLabels = ['2020', '2021', '2022', '2023'];
// const crackingData = [
//   {
//     label: 'Small Cracks',
//     data: [10, 15, 12, 8],
//     backgroundColor: '#A5D6A7' // Light green
//   },
//   {
//     label: 'Medium Cracks',
//     data: [5, 8, 9, 12],
//     backgroundColor: '#FFA726' // Orange
//   },
//   {
//     label: 'Large Cracks',
//     data: [2, 4, 7, 10],
//     backgroundColor: '#F44336' // Red
//   }
// ];

// const seasonalData = [
//   { label: 'Winter', data: [15, 18, 12, 14], backgroundColor: '#1565C0' }, // Deep blue
//   { label: 'Summer', data: [8, 12, 15, 10], backgroundColor: '#FF3D00' }   // Bright orange-red
// ];

// <BarChart 
//   title="LTE by Cracking Space"
//   labels={yearLabels}
//   dataSets={crackingData}
// />;
