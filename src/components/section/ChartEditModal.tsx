"use client"

import React, { useState, useMemo, useEffect } from 'react'
import { FaTimes, FaPlus, FaTrash, FaEdit, FaSave, FaTimes as FaCancel, FaChartLine, FaExclamationTriangle } from 'react-icons/fa'
import CSVUploadModal from './CSVUploadModal'
import { useDialog } from '@/context/ModalContext'
interface ChartData {
  [key: string]: number | string
}

interface ChartEditModalProps {
  isOpen: boolean
  onClose: () => void
  sectionId: string
  chartType: 'deflection' | 'lte_season' | 'lte_crack'
  currentData: ChartData[]
  onSave: (updatedData: ChartData[]) => void
}

const ChartEditModal: React.FC<ChartEditModalProps> = ({
  isOpen,
  onClose,
  sectionId,
  chartType,
  currentData,
  onSave
}) => {
  const transformedInitialData = useMemo(() => {
    console.log('RAW currentData:', currentData);

    if (chartType === 'deflection') {
      const expanded: ChartData[] = [];

      currentData.forEach(row => {
        const baseDMI = row.DMI;
        const yearMap: Record<string, ChartData> = {};

        Object.entries(row).forEach(([key, value]) => {
          // [_\s]* means: allow any number of underscores or spaces (0, 1, or many)
          // [_\s]? means: allow an optional underscore or space (0 or 1)
          const match = key.match(/^(Winter|Summer)[_\s]?(\d{2,4})$/);
          if (match) {
            const [_, season, yearPart] = match;
            const fullYear = yearPart.length === 2 ? '20' + yearPart : yearPart;
            if (!yearMap[fullYear]) {
              yearMap[fullYear] = { DMI: baseDMI, Year: fullYear };
            }
            yearMap[fullYear][season] = value as string | number;
          }
        });

        const yearEntries = Object.values(yearMap);
        if (yearEntries.length > 0) {
          expanded.push(...yearEntries);
        } else {
          expanded.push({ DMI: baseDMI, Year: '', Winter: '', Summer: '' });
        }
      });

      console.log('Transformed Deflection Data:', expanded);
      return expanded;
    }

    // lte_season: Normalize Year and fill empty seasons
    if (chartType === 'lte_season') {
      const normalized = currentData.map(row => ({
        Year: row.Year,
        Winter: row.Winter ?? '',
        Summer: row.Summer ?? '',
        Small: row.S ?? row.Small ?? '',
        Medium: row.M ?? row.Medium ?? '',
        Large: row.L ?? row.Large ?? ''
      }));
      console.log('Transformed LTE Season Data:', normalized);
      return normalized;
    }

    // lte_crack: Normalize Year and fill empty cracks
    if (chartType === 'lte_crack') {
      const normalized = currentData.map(row => ({
        Year: row.Year,
        Winter: row.Winter ?? '',
        Summer: row.Summer ?? '',
        Small: row.S ?? row.Small ?? '',
        Medium: row.M ?? row.Medium ?? '',
        Large: row.L ?? row.Large ?? ''
      }));
      console.log('Transformed LTE Crack Data:', normalized);
      return normalized;
    }

    return [...currentData];
  }, [chartType, currentData]);

  const { alert, confirm } = useDialog();
  const [data, setData] = useState<ChartData[]>([]);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [loading, setLoading] = useState(false)
  const [sortConfig, setSortConfig] = useState<{ key: string; direction: 'asc' | 'desc' } | null>(null);
  const [yearFilter, setYearFilter] = useState<string>('All');
  const [isUploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [warningModalRow, setWarningModalRow] = useState<ChartData | null>(null);
  const [validationErrors, setValidationErrors] = useState<Record<number, string>>({});
  const [invalidDMIModalRow, setInvalidDMIModalRow] = useState<ChartData | null>(null);
  const CURRENT_YEAR = new Date().getFullYear();
  const rowKey = (r: ChartData) =>
    chartType === 'deflection'
      ? `${r.DMI ?? ''}__${r.Year ?? ''}` // DMI+Year pair
      : `${r.Year ?? ''}`;                // other tables use Year


  const showInvalidDMI = async (row: ChartData) => {
    await alert(
      <>Error: Invalid DMI</>,
      <div className="space-y-3">
        <p>
          The <strong>DMI</strong> value <code>{row.DMI}</code> is not divisible by 50 and is invalid.
          Please correct this value before saving.
        </p>
        <div className="text-sm text-gray-700 space-y-1 border-l-4 border-red-400 pl-4">
          <p><strong>DMI:</strong> {String(row.DMI ?? '')}</p>
          <p><strong>Year:</strong> {String(row.Year ?? '')}</p>
          <p><strong>Winter:</strong> {String(row.Winter ?? '')}</p>
          <p><strong>Summer:</strong> {String(row.Summer ?? '')}</p>
        </div>
      </div>,
      'error'
    );
  };

  const showZeroWarning = async (row: ChartData) => {
    await alert(
      <>Warning: Invalid Value</>,
      <div className="space-y-3">
        <p>
          The value <strong>0</strong> for <code>Winter</code> or <code>Summer</code> in deflection data
          is not valid and likely an error. Please review and correct this data.
        </p>
        <div className="text-sm text-gray-700 space-y-1 border-l-4 border-yellow-400 pl-4">
          <p><strong>DMI:</strong> {String(row.DMI ?? '')}</p>
          <p><strong>Year:</strong> {String(row.Year ?? '')}</p>
          <p><strong>Winter:</strong> {String(row.Winter ?? '')}</p>
          <p><strong>Summer:</strong> {String(row.Summer ?? '')}</p>
        </div>
      </div>,
      'warning'
    );
  };


  useEffect(() => {
    if (isOpen) {
      setData(transformedInitialData);
    }
  }, [isOpen, transformedInitialData]);

  const columns = useMemo(() => {
    if (chartType === 'deflection') {
      return ['DMI', 'Year', 'Winter', 'Summer'];
    }
    else {
      switch (chartType) {
        case 'lte_season':
          return ['Year', 'Winter', 'Summer'];
        case 'lte_crack':
          return ['Year', 'Small', 'Medium', 'Large'];
        default:
          return ['Year', 'Value'];
      }
    }
    return Object.keys(data[0]);
  }, [chartType, data]);

  const handleCellEdit = (rowIndex: number, column: string, value: string) => {
    const updatedData = [...data];
    const isNumericColumn = column !== 'Year' && column !== 'DMI';

    const parsedValue =
      isNumericColumn ? (value === '' ? '' : parseFloat(value)) : value;

    updatedData[rowIndex] = {
      ...updatedData[rowIndex],
      [column]: parsedValue
    };

    setData(updatedData);

    // Validation logic
    const row = updatedData[rowIndex];
    const errors: Record<number, string> = {};
    if (column === 'Year') {
      const yStr = String(value ?? '').trim();
      const is4Digits = /^\d{4}$/.test(yStr);
      const yNum = is4Digits ? Number(yStr) : NaN;
      if (!is4Digits || !Number.isFinite(yNum) || yNum > CURRENT_YEAR) {
        errors[rowIndex] = `Year must be 4 digits and ≤ ${CURRENT_YEAR}`;
      }
    }
    if (column === 'DMI') {
      const dmiVal = parseFloat(value);
      if (!isNaN(dmiVal) && dmiVal % 50 !== 0) {
        errors[rowIndex] = 'DMI must be divisible by 50';
      }
    }

    if (chartType === 'deflection') {
      const winter = column === 'Winter' ? parsedValue : row.Winter;
      const summer = column === 'Summer' ? parsedValue : row.Summer;

      if (winter === 0 || summer === 0) {
        if (!errors[rowIndex]) {
          errors[rowIndex] = 'Warning: 0 value in Winter or Summer';
        }
      }
    }

    setValidationErrors(prev => ({
      ...prev,
      [rowIndex]: errors[rowIndex] || ''
    }));
  };

  const handleAddRow = () => {
    const defaultRow: ChartData = {};
    columns.forEach((col) => {
      if (col === 'Year') {
        defaultRow[col] = new Date().getFullYear();
      } else {
        defaultRow[col] = '';
      }
    });
    const updatedData = [...data, defaultRow];
    setData(updatedData);
    setEditingIndex(updatedData.length - 1); // auto-enable editing
  };

  const handleDeleteRow = (index: number) => {
    if (!confirm('Delete this row?')) return;

    const updatedData = [...data];
    const row = updatedData[index];

    if (chartType === 'lte_season') {
      // Clear Winter and Summer
      const cleared = {
        ...row,
        Winter: '',
        Summer: '',
        Small: row.Small ?? row.S ?? '',
        Medium: row.Medium ?? row.M ?? '',
        Large: row.Large ?? row.L ?? '',
        S: row.S ?? row.Small ?? '',
        M: row.M ?? row.Medium ?? '',
        L: row.L ?? row.Large ?? ''
      };
      const isEmpty = [
        cleared.Small || cleared.S,
        cleared.Medium || cleared.M,
        cleared.Large || cleared.L
      ].every(v => v === '' || v === undefined);
      if (isEmpty) {
        updatedData.splice(index, 1); // Delete row
      } else {
        updatedData[index] = cleared; // Just clear values
      }

    } else if (chartType === 'lte_crack') {
      // Clear Small, Medium, Large (and S/M/L)
      const cleared = {
        ...row,
        Small: '',
        Medium: '',
        Large: '',
        S: '',
        M: '',
        L: '',
        Winter: row.Winter ?? '',
        Summer: row.Summer ?? ''
      };

      const isEmpty = [cleared.Winter, cleared.Summer].every(v => v === '' || v === undefined);

      if (isEmpty) {
        updatedData.splice(index, 1);
      } else {
        updatedData[index] = cleared;
      }

    } else {
      // Deflection or other types — full delete
      updatedData.splice(index, 1);
    }

    setData(updatedData);
  };
  const toYearOrNull = (v: unknown): number | null => {
    if (v === '' || v == null) return null;
    const s = String(v).trim();
    if (!/^\d{4}$/.test(s)) return null;          // keep it strict (4 digits)
    const n = parseInt(s, 10);
    return Number.isFinite(n) ? n : null;
  };
  const parseRequiredYear = (v: unknown): number => {
    const s = String(v ?? '').trim();
    if (!/^\d{4}$/.test(s)) return NaN;
    const n = Number(s);
    return Number.isFinite(n) && n <= CURRENT_YEAR ? n : NaN;
  };
  const handleSave = async () => {
    setLoading(true);
    const isNumericZero = (v: unknown): v is 0 =>
      typeof v === 'number' && Number.isFinite(v) && v === 0;
    const toNumOrNull = (v: unknown): number | null => {
      if (v === '' || v == null) return null;
      const n = typeof v === 'number' ? v : parseFloat(String(v));
      return Number.isFinite(n) ? n : null;
    };
    try {
      let transformedData: ChartData[] = data;
      if (Object.values(validationErrors).some(msg => msg?.includes('DMI'))) {
        await alert(
          <>Fix invalid DMI</>,
          <>Please fix DMI values that are not divisible by 50 before saving.</>,
          'error'
        );
        setLoading(false);
        return;
      }
      const badYearRow = data.find(r => !Number.isFinite(parseRequiredYear(r.Year)));
      if (badYearRow) {
        await alert(
          <>Fix Year before saving</>,
          <>Year is required, must be 4 digits, and ≤ {CURRENT_YEAR}.</>,
          'error'
        );
        setLoading(false);
        return;
      }
      if (chartType === 'deflection') {
        // key = DMI|Year
        const counts = new Map<string, number>();
        data.forEach(r => {
          const dmi = toNumOrNull(r.DMI);
          const yr = parseRequiredYear(r.Year);
          if (!Number.isFinite(dmi) || !Number.isFinite(yr)) return;
          const k = `${dmi}|${yr}`;
          counts.set(k, (counts.get(k) ?? 0) + 1);
        });
        const dups = [...counts.entries()]
          .filter(([, c]) => c > 1)
          .map(([k, c]) => {
            const [dmi, yr] = k.split('|');
            return { dmi: Number(dmi), year: Number(yr), count: c };
          });

        if (dups.length) {
          const ok = await confirm(
            'Duplicate DMI+Year detected',
            <>
              <p>
                Found {dups.length} duplicate key{dups.length > 1 ? 's' : ''}. Saving will keep the
                <strong> last row in the table</strong> for each duplicate (it will replace earlier ones).
              </p>
              <div className="mt-3 text-sm text-gray-700 space-y-1 border-l-4 border-yellow-400 pl-4">
                {dups.slice(0, 6).map((d, i) => (
                  <div key={i}>
                    <strong>DMI:</strong> {d.dmi} <strong>Year:</strong> {d.year} <em>(x{d.count})</em>
                  </div>
                ))}
                {dups.length > 6 && <div>…and {dups.length - 6} more</div>}
              </div>
              <p className="mt-3">Proceed?</p>
            </>,
            { okText: 'Save and replace', cancelText: 'Review', variant: 'warning' }
          );
          if (!ok) { setLoading(false); return; }
        }
        // Validate DMI before processing
        const badRow = data.find(r => {
          const dmi = toNumOrNull(r.DMI);
          return !(dmi != null && dmi >= 0 && dmi % 50 === 0);
        });

        if (badRow) {
          await alert(
            <>Fix DMI before saving</>,
            <>
              <p>DMI is required and must be a positive number divisible by 50.</p>
              <div className="mt-3 text-sm text-gray-700 space-y-1 border-l-4 border-red-400 pl-4">
                <div><strong>DMI:</strong> {String(badRow.DMI ?? '')}</div>
                <div><strong>Year:</strong> {String(badRow.Year ?? '')}</div>
                <div><strong>Winter:</strong> {String(badRow.Winter ?? '')}</div>
                <div><strong>Summer:</strong> {String(badRow.Summer ?? '')}</div>
              </div>
            </>,
            'error'
          );
          setLoading(false);
          return;
        }

        const zeroRows = data.filter(r => isNumericZero(r?.Winter) || isNumericZero(r?.Summer));

        if (zeroRows.length) {
          const ok = await confirm(
            'Zero values detected',
            <>
              <p>
                Found {zeroRows.length} row{zeroRows.length > 1 ? 's' : ''} with <code>Winter</code> or <code>Summer</code> = 0.
                This is likely invalid.
              </p>
              <div className="mt-3 text-sm text-gray-700 space-y-1 border-l-4 border-yellow-400 pl-4">
                {zeroRows.slice(0, 5).map((r, i) => (
                  <div key={i}>
                    <strong>DMI:</strong> {String(r.DMI ?? '')}{' '}
                    <strong>Year:</strong> {String(r.Year ?? '')}{' '}
                    <strong>W:</strong> {String(r.Winter ?? '')}{' '}
                    <strong>S:</strong> {String(r.Summer ?? '')}
                  </div>
                ))}
                {zeroRows.length > 5 && <div>…and {zeroRows.length - 5} more</div>}
              </div>
              <p className="mt-3">Do you want to continue saving anyway?</p>
            </>,
            { okText: 'Save anyway', cancelText: 'Review data', variant: 'warning' }
          );
          if (!ok) { setLoading(false); return; }
        }
        const groupedMap = new Map<string, ChartData>();

        data.sort((a, b) => {

          const aD = toNumOrNull(a?.DMI);
          const bD = toNumOrNull(b?.DMI);
          // put rows with missing DMI at the end (no ''→0)
          return (aD ?? Number.POSITIVE_INFINITY) - (bD ?? Number.POSITIVE_INFINITY);
        }).forEach(row => {
          const { DMI, Year, Winter, Summer } = row;
          if (DMI == null) return;
          const year = parseRequiredYear(Year);
          const shortYear = Year?.toString().slice(-2);
          const id = `${DMI}`;

          if (!groupedMap.has(id)) {
            groupedMap.set(id, {});
          }

          const existing = groupedMap.get(id)!;

          existing['DMI'] = DMI;
          if (Winter !== undefined) existing[`Winter_${shortYear}`] = toNumOrNull(Winter) ?? '';
          if (Summer !== undefined) existing[`Summer_${shortYear}`] = toNumOrNull(Summer) ?? '';
        });

        transformedData = Array.from(groupedMap.values());

      } else {
        const groupedMap = new Map<string, ChartData>();
        // key = Year
        const counts = new Map<number, number>();
        data.forEach(r => {
          const yr = parseRequiredYear(r.Year);
          if (Number.isFinite(yr)) counts.set(yr, (counts.get(yr) ?? 0) + 1);
        });
        const dups = [...counts.entries()].filter(([, c]) => c > 1).map(([yr, c]) => ({ year: yr, count: c }));

        if (dups.length) {
          const ok = await confirm(
            'Duplicate Year detected',
            <>
              <p>
                Found {dups.length} duplicate year{dups.length > 1 ? 's' : ''}. Saving will keep the
                <strong> last row in the table</strong> for each duplicate year and replace earlier values.
              </p>
              <div className="mt-3 text-sm text-gray-700 space-y-1 border-l-4 border-yellow-400 pl-4">
                {dups.slice(0, 6).map((d, i) => (
                  <div key={i}>
                    <strong>Year:</strong> {d.year} <em>(x{d.count})</em>
                  </div>
                ))}
                {dups.length > 6 && <div>…and {dups.length - 6} more</div>}
              </div>
              <p className="mt-3">Proceed?</p>
            </>,
            { okText: 'Save and replace', cancelText: 'Review', variant: 'warning' }
          );
          if (!ok) { setLoading(false); return; }
        }
        data.sort((a, b) => {
          const ay = toYearOrNull(a.Year);
          const by = toYearOrNull(b.Year);

          if (ay == null && by == null) return 0;  // both missing -> keep order
          if (ay == null) return 1;                // missing year goes last
          if (by == null) return -1;
          return ay - by;                          // numeric compare
        }).forEach(row => {
          const y = parseRequiredYear(row.Year);
          const year = String(y);
          if (!year) return;

          if (!groupedMap.has(year)) {
            groupedMap.set(year, { Year: year });
          }

          const existing = groupedMap.get(year)!;
          if (row.Winter !== undefined) existing['Winter'] = toNumOrNull(row.Winter) ?? '';
          if (row.Summer !== undefined) existing['Summer'] = toNumOrNull(row.Summer) ?? '';
          if (row.Small !== undefined) existing['S'] = toNumOrNull(row.Small) ?? '';
          if (row.Medium !== undefined) existing['M'] = toNumOrNull(row.Medium) ?? '';
          if (row.Large !== undefined) existing['L'] = toNumOrNull(row.Large) ?? '';
        });

        transformedData = Array.from(groupedMap.values());
      }

      console.log('[Save] Final Transformed:', transformedData);
      onSave(transformedData);
      onClose();

    } catch (error) {
      console.error('Save chart data error:', error);
    } finally {
      setLoading(false);
    }
  };


  const getChartTitle = () => {
    switch (chartType) {
      case 'deflection':
        return 'Deflection Data';
      case 'lte_season':
        return 'LTE by Season';
      case 'lte_crack':
        return 'LTE by Crack Spacing';
      default:
        return 'Chart Data';
    }
  };

  useEffect(() => {
    setSelectedRows(new Set());
  }, [yearFilter]);

  const visibleData = useMemo(() => {
    let filtered = [...data];

    // Filter by year
    if (yearFilter !== 'All') {
      filtered = filtered.filter(row => row.Year?.toString() === yearFilter);
    }

    // Sort
    if (sortConfig) {
      const { key, direction } = sortConfig;
      filtered.sort((a, b) => {
        const aVal = a[key] ?? '';
        const bVal = b[key] ?? '';
        return direction === 'asc'
          ? (aVal > bVal ? 1 : -1)
          : (aVal < bVal ? 1 : -1);
      });
    }

    return filtered;
  }, [data, sortConfig, yearFilter]);
  const getDataIndexFromVisible = (visibleIdx: number) => {
    const vr = visibleData[visibleIdx];
    const key = rowKey(vr);
    return data.findIndex(d => rowKey(d) === key);
  };
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-7xl max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FaChartLine />
            Edit {getChartTitle()} - {sectionId}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}

        <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
          <div className="mb-4 flex flex-wrap justify-between items-center gap-4">
            <h3 className="text-lg font-semibold text-gray-800">
              {getChartTitle()} Table
            </h3>

            <div className="flex items-center gap-3">
              <label className="text-sm text-gray-600">Filter by Year:</label>
              <select
                value={yearFilter}
                onChange={(e) => setYearFilter(e.target.value)}
                className="px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="All">All Years</option>
                {[...new Set(data.map(row => row.Year).filter(Boolean))]
                  .sort()
                  .map(year => (
                    <option key={year} value={year?.toString()}>{year}</option>
                  ))}
              </select>
              <button
                onClick={async () => {
                  if (selectedRows.size === 0) return;

                  const ok = await confirm(
                    `Remove ${selectedRows.size} selected row(s)?`,
                    <>
                      This will remove them from the table now.
                      <div className="text-sm text-gray-600 mt-2">
                        It won’t be permanent until you click <strong>Save Changes</strong>.
                      </div>
                    </>,
                    { okText: 'Remove', cancelText: 'Cancel', variant: 'warning' }
                  );

                  if (!ok) return; // cancel, X, or dismiss → no delete

                  const newData = data.filter((_, i) => !selectedRows.has(i));
                  setData(newData);
                  setSelectedRows(new Set());
                }}
                disabled={selectedRows.size === 0}
                className={`px-4 py-2 text-white rounded-md text-sm flex items-center gap-2 ${selectedRows.size === 0
                  ? 'bg-gray-300 cursor-not-allowed'
                  : 'bg-red-600 hover:bg-red-700'
                  }`}
              >
                <FaTrash size={14} />
                Delete Selected
              </button>
              <button
                onClick={handleAddRow}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 text-sm"
              >
                <FaPlus size={14} />
                Add Row
              </button>
              <button
                onClick={() => setUploadModalOpen(true)}
                className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 text-sm"
              >
                <FaPlus size={14} />
                Upload CSV
              </button>
            </div>
          </div>
          {isUploadModalOpen && (
            <CSVUploadModal
              chartType={chartType}
              onClose={() => setUploadModalOpen(false)}
              onUploadSuccess={(parsed) => {
                let transformed: ChartData[] = [];
                const parseFloatSafe = (val: unknown): number | '' => {
                  const num = parseFloat(String(val));
                  return isNaN(num) ? '' : num;
                };
                const mergeLTEDataByYear = (
                  chartType: 'lte_season' | 'lte_crack',
                  parsed: ChartData[],
                  existing: ChartData[]
                ): ChartData[] => {
                  const yearMap = new Map<string, ChartData>();

                  // Add existing data
                  for (const row of existing) {
                    yearMap.set(String(row.Year), { ...row });
                  }

                  for (const row of parsed) {
                    const year = String(row.Year);
                    const existingRow = yearMap.get(year) ?? { Year: year };

                    if (chartType === 'lte_season') {
                      yearMap.set(year, {
                        ...existingRow,
                        Winter: parseFloatSafe(row.Winter ?? ''),
                        Summer: parseFloatSafe(row.Summer ?? '')
                      });
                    } else if (chartType === 'lte_crack') {
                      yearMap.set(year, {
                        ...existingRow,
                        Small: parseFloatSafe(row.S ?? row.Small ?? ''),
                        Medium: parseFloatSafe(row.M ?? row.Medium ?? ''),
                        Large: parseFloatSafe(row.L ?? row.Large ?? '')
                      });
                    }
                  }

                  return Array.from(yearMap.values());
                };

                if (chartType === 'deflection') {
                  const existingKeyMap = new Map<string, ChartData>();
                  data.forEach(row => {
                    const key = `${row.DMI}-${row.Year}`;
                    existingKeyMap.set(key, { ...row });
                  });

                  parsed.forEach(row => {
                    const baseDMI = parseFloatSafe(row.DMI);
                    const yearMap: Record<string, ChartData> = {};

                    Object.entries(row).forEach(([key, value]) => {
                      const match = key.match(/^(Winter|Summer)[_\s]?(\d{2,4})$/);
                      if (match) {
                        const [_, season, yearPart] = match;
                        const fullYear = yearPart.length === 2 ? '20' + yearPart : yearPart;
                        const compositeKey = `${baseDMI}-${fullYear}`;
                        const existingRow = existingKeyMap.get(compositeKey) ?? { DMI: baseDMI, Year: fullYear };
                        const parsed = parseFloatSafe(value);
                        if (parsed !== '') {
                          existingRow[season] = parsed;
                        }
                        existingKeyMap.set(compositeKey, existingRow);
                      }
                    });
                  });

                  transformed = Array.from(existingKeyMap.values());
                }
                else if (chartType === 'lte_season' || chartType === 'lte_crack') {
                  transformed = mergeLTEDataByYear(chartType, parsed, data);
                } else {
                  transformed = parsed;
                }

                setData(transformed);
              }}

            />
          )}


          {/* Table */}
          <div className="overflow-x-auto border rounded-lg">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {/* <input
                      type="checkbox"
                      checked={selectedRows.size === visibleData.length && visibleData.length > 0}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedRows(new Set(visibleData.map((_, i) => i)));
                        } else {
                          setSelectedRows(new Set());
                        }
                      }}
                    /> */}
                    <input
                      type="checkbox"
                      checked={
                        visibleData.length > 0 &&
                        visibleData.every((_, i) => selectedRows.has(getDataIndexFromVisible(i)))
                      }
                      onChange={(e) => {
                        const ns = new Set(selectedRows);
                        if (e.target.checked) {
                          visibleData.forEach((_, i) => {
                            const di = getDataIndexFromVisible(i);
                            if (di !== -1) ns.add(di);
                          });
                        } else {
                          visibleData.forEach((_, i) => {
                            const di = getDataIndexFromVisible(i);
                            ns.delete(di);
                          });
                        }
                        setSelectedRows(ns);
                      }}
                    />
                  </th>

                  <th className="px-0 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                  {columns.map((column) => (
                    <th
                      key={column}
                      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                    >
                      {column}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {visibleData.map((row, rowIndex) => {
                  const dataIndex = data.indexOf(row); // <-- map visible row to full-data index

                  return (
                    <tr key={dataIndex} className="hover:bg-gray-50">
                      <td className="px-4 py-3 whitespace-nowrap text-sm">
                        <input
                          type="checkbox"
                          checked={selectedRows.has(dataIndex)}
                          onChange={(e) => {
                            const ns = new Set(selectedRows);
                            e.target.checked ? ns.add(dataIndex) : ns.delete(dataIndex);
                            setSelectedRows(ns);
                          }}
                        />
                      </td>

                      <td className="px-0 py-3 whitespace-nowrap text-sm">
                        <div className="flex gap-2 items-center">
                          {/* Edit / Cancel Toggle */}
                          <button
                            onClick={() =>
                              setEditingIndex(editingIndex === dataIndex ? null : dataIndex)
                            }
                            className="text-blue-600 hover:text-blue-800"
                          >
                            {editingIndex === dataIndex ? <FaCancel size={14} /> : <FaEdit size={14} />}
                          </button>

                          {/* ❗ DMI not divisible by 50 */}
                          {chartType === 'deflection' &&
                            row?.DMI !== '' &&
                            (!Number.isFinite(Number(row?.DMI)) || Number(row?.DMI) % 50 !== 0) && (
                              <button
                                onClick={() => showInvalidDMI(row)}   // <-- use modal context
                                title="DMI must be divisible by 50"
                                className="text-red-600 hover:text-red-700"
                              >
                                <FaExclamationTriangle size={16} />
                              </button>
                            )}

                          {/* ⚠️ Winter or Summer is zero */}
                          {chartType === 'deflection' &&
                            (row?.Winter === 0 || row?.Summer === 0) && (
                              <button
                                onClick={() => showZeroWarning(row)}  // <-- use modal context
                                title="Winter or Summer value is 0 — likely invalid"
                                className="text-yellow-500 hover:text-yellow-600"
                              >
                                <FaExclamationTriangle size={16} />
                              </button>
                            )}
                        </div>
                      </td>

                      {columns.map((column) => {
                        const value = row[column];
                        const dmiStr = column === 'DMI' ? String(value ?? '').trim() : '';
                        const dmiNum = dmiStr === '' ? NaN : Number(dmiStr);

                        const isInvalidDMI =
                          chartType === 'deflection' &&
                          column === 'DMI' &&
                          (!Number.isFinite(dmiNum) || dmiNum < 0 || dmiNum % 50 !== 0);

                        const isZeroWarn =
                          chartType === 'deflection' &&
                          (column === 'Winter' || column === 'Summer') &&
                          value !== '' &&
                          value != null &&
                          !isNaN(Number(value)) &&
                          Number(value) === 0;

                        // ✅ YEAR validation (4 digits and not in the future)
                        const yearStr = column === 'Year' ? String(value ?? '').trim() : '';
                        const yearNum = /^\d{4}$/.test(yearStr) ? Number(yearStr) : NaN;
                        const isInvalidYear =
                          column === 'Year' && (!Number.isFinite(yearNum) || yearNum > CURRENT_YEAR);

                        const tooltip = isInvalidDMI
                          ? 'DMI must be divisible by 50'
                          : isZeroWarn
                            ? 'Warning: 0 is theoretically invalid'
                            : isInvalidYear
                              ? `Year must be 4 digits and \u2264 ${CURRENT_YEAR}`
                              : '';

                        return (
                          <td key={column} className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                            {editingIndex === dataIndex ? (
                              <>
                                <input
                                  type={column === 'Year' ? 'text' : 'number'}
                                  value={value ?? ''}
                                  onChange={(e) => handleCellEdit(dataIndex, column, e.target.value)}
                                  className={`w-full px-2 py-1 rounded border focus:outline-none focus:ring-2 ${(isInvalidDMI || isInvalidYear)
                                    ? 'border-red-500 focus:ring-red-500'
                                    : 'border-gray-300 focus:ring-blue-500'
                                    }`}
                                  step={column === 'DMI' ? 50 : column === 'Year' ? undefined : '0.01'}
                                />
                                {isInvalidDMI && (
                                  <p className="text-xs text-red-500 mt-1">DMI must be divisible by 50</p>
                                )}
                                {isZeroWarn && (
                                  <p className="text-xs text-yellow-600 mt-1">0 is theoretically invalid</p>
                                )}
                                {isInvalidYear && (
                                  <p className="text-xs text-red-500 mt-1">
                                    Year must be 4 digits and not in the future (≤ {CURRENT_YEAR}).
                                  </p>
                                )}
                              </>
                            ) : (
                              <div title={tooltip}>
                                <span
                                  className={
                                    isInvalidDMI || isInvalidYear
                                      ? 'text-red-600 font-bold'
                                      : isZeroWarn
                                        ? 'text-yellow-600 font-bold'
                                        : ''
                                  }
                                >
                                  {value}
                                </span>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}


              </tbody>
            </table>
          </div>

          {data.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>No data available. Click &quot;Add Row&quot; to start adding data.</p>
            </div>
          )}
        </div>
        {/* {invalidDMIModalRow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4 text-red-600">
                <FaExclamationTriangle className="text-2xl" />
                <h2 className="text-lg font-bold">Error: Invalid DMI</h2>
              </div>

              <p className="text-gray-800 mb-4">
                The <strong>DMI</strong> value <code>{invalidDMIModalRow.DMI}</code> is not divisible by 50 and is invalid.
                Please correct this value before saving.
              </p>

              <div className="text-sm text-gray-700 mb-6 space-y-1 border-l-4 border-red-400 pl-4">
                <p><strong>DMI:</strong> {invalidDMIModalRow.DMI}</p>
                <p><strong>Year:</strong> {invalidDMIModalRow.Year}</p>
                <p><strong>Winter:</strong> {invalidDMIModalRow.Winter}</p>
                <p><strong>Summer:</strong> {invalidDMIModalRow.Summer}</p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setInvalidDMIModalRow(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )}

        {warningModalRow && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[10000]">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6">
              <div className="flex items-center gap-3 mb-4 text-yellow-600">
                <FaExclamationTriangle className="text-2xl" />
                <h2 className="text-lg font-bold">Warning: Invalid Value</h2>
              </div>

              <p className="text-gray-800 mb-4">
                The value <strong>0</strong> for <code>Winter</code> or <code>Summer</code> in deflection data is not valid and likely an error.
                Please review and correct this data.
              </p>

              <div className="text-sm text-gray-700 mb-6 space-y-1 border-l-4 border-yellow-400 pl-4">
                <p><strong>DMI:</strong> {warningModalRow.DMI}</p>
                <p><strong>Year:</strong> {warningModalRow.Year}</p>
                <p><strong>Winter:</strong> {warningModalRow.Winter}</p>
                <p><strong>Summer:</strong> {warningModalRow.Summer}</p>
              </div>

              <div className="flex justify-end">
                <button
                  onClick={() => setWarningModalRow(null)}
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400"
                >
                  OK
                </button>
              </div>
            </div>
          </div>
        )} */}
        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={loading}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400"
          >
            {loading ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ChartEditModal