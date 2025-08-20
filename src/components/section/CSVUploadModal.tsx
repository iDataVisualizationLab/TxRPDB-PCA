import React, { useState, DragEvent, ChangeEvent } from 'react';
import Papa from 'papaparse';
import { Check, X, Download } from 'lucide-react'

import { FaSearch, FaMapMarkerAlt, FaMagic, FaDownload, FaUpload, FaEdit, FaTrash, FaCheck } from 'react-icons/fa';

interface CSVUploadModalProps {
    chartType: 'deflection' | 'lte_season' | 'lte_crack';
    onClose: () => void;
    onUploadSuccess: (parsedData: any[]) => void;
}

const chartTypeColumns: Record<string, string[]> = {
    deflection: ['DMI'], // dynamic columns allowed (Winter/Summer + year)
    lte_season: ['Year', 'Winter', 'Summer'],
    lte_crack: ['Year', 'Small', 'Medium', 'Large']
};
const CURRENT_YEAR = new Date().getFullYear();

const parseFullYear = (part: string): number => {
    // Convert '22' → 2022, leave '2023' as 2023
    const s = String(part).trim();
    const n = s.length === 2 ? Number('20' + s) : Number(s);
    return Number.isFinite(n) ? n : NaN;
};

const isValidYearNum = (y: number) =>
    Number.isFinite(y) && /^\d{4}$/.test(String(y)) && y <= CURRENT_YEAR;

const CSVUploadModal: React.FC<CSVUploadModalProps> = ({ chartType, onClose, onUploadSuccess }) => {
    const [parsedData, setParsedData] = useState<any[]>([]);
    const [rawHeaders, setRawHeaders] = useState<string[]>([]);
    const [fixSuggestions, setFixSuggestions] = useState<{ from: string; to: string }[]>([]);
    const [fixedCSVBlobUrl, setFixedCSVBlobUrl] = useState<string | null>(null);
    const [showFixPreview, setShowFixPreview] = useState(false);
    const [file, setFile] = useState<File | null>(null);
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [warning, setWarning] = useState<string | null>(null);
    const [manualFixes, setManualFixes] = useState<Record<string, string>>({});
    const [badDMIValues, setBadDMIValues] = useState<number[]>([]);
    const [dmiFixes, setDmiFixes] = useState<{ original: number, fixed: number }[]>([]);
    const [manualDmiFixes, setManualDmiFixes] = useState<Record<number, number>>({});


    // groups of duplicates and the user's pick per group
    type DupMember = { idx: number; row: any };
    type DupGroup = { key: string; members: DupMember[] }; // key = DMI (deflection) or Year (lte_*)

    const [dupGroups, setDupGroups] = useState<DupGroup[]>([]);
    const [dupChoice, setDupChoice] = useState<Record<string, number>>({}); // key -> idx to keep


    const handleDragEnter = () => setIsDragging(true);
    const handleDragLeave = () => setIsDragging(false);
    const handleDragOver = (e: DragEvent) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'copy';
    };
    const handleDrop = (e: DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const f = e.dataTransfer.files?.[0];
        if (f) {
            setFile(f);
            parseCSV(f);
        }
    };

    const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
        const f = e.target.files?.[0];
        if (f) {
            setFile(f);
            parseCSV(f);
        }
    };

    const parseCSV = (file: File) => {
        setError(null);
        setWarning(null);
        setDupGroups([]);
        setDupChoice({});
        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: (result) => {
                const parsed = result.data as any[];
                const headers = Object.keys(parsed[0] || {});
                const seen = new Set<string>();
                const lowerToOriginal: Record<string, string[]> = {};
                const duplicateCols: string[] = [];

                headers.forEach((col) => {
                    const fixed = col.trim().toLowerCase();
                    if (seen.has(fixed)) {
                        duplicateCols.push(col);
                        lowerToOriginal[fixed].push(col);
                    } else {
                        seen.add(fixed);
                        lowerToOriginal[fixed] = [col];
                    }
                });
                console.log('Duplicate columns:', duplicateCols);
                console.log('headers columns:', headers);
                const expected = chartTypeColumns[chartType];

                let isValid = false;

                setParsedData(parsed);
                setRawHeaders(headers);

                let invalidCols: string[] = [];
                let missingCols: string[] = [];
                let errorLines: string[] = [];

                let dmiErrors: number[] = [];

                if (parsed.length > 0) {
                    if (chartType === 'deflection') {
                        const seasonRegex = /^(Winter|Summer)[_\s]?(\d{2,4})$/;
                        const dmiRegex = /^dmi[\w-]*$/i;

                        const hasExactDMI = headers.includes('DMI');
                        const hasSomeDMI = headers.some(h => dmiRegex.test(h));
                        const seasonCols = headers.filter(h => h !== 'DMI' && seasonRegex.test(h));
                        const badSeasonHeaders: string[] = [];
                        const futureSeasonHeaders: string[] = [];
                        // DMI check
                        if (!hasExactDMI) {
                            if (hasSomeDMI) {
                                // malformed DMI (e.g., DMI2, dmi_xx)
                                const wrongDMI = headers.find(h => dmiRegex.test(h));
                                invalidCols.push(wrongDMI ?? 'Unknown DMI column');
                            } else {
                                missingCols.push('DMI');
                            }
                        }

                        // Season column check
                        headers.forEach((col) => {
                            if (col === 'DMI') return; // already checked
                            if (dmiRegex.test(col)) return; // skip malformed DMI from being treated as season

                            const m = col.match(seasonRegex);
                            if (!m) {
                                invalidCols.push(col);
                            } else {
                                const yearPart = m[2];
                                const full = parseFullYear(yearPart);
                                if (!isValidYearNum(full)) {
                                    badSeasonHeaders.push(`${col} (→ ${full || 'NaN'})`);
                                } else if (full > CURRENT_YEAR) {
                                    futureSeasonHeaders.push(`${col} (→ ${full})`);
                                }
                            }
                        });
                        const emptyDMI = parsed.filter(row => String(row.DMI ?? '').trim() === '');
                        if (emptyDMI.length > 0) {
                            errorLines.push(`Some rows have empty <b>DMI</b> (required).`);
                        }
                        dmiErrors = parsed
                            .map(row => {
                                const s = String(row.DMI ?? '').trim();
                                const n = s === '' ? NaN : Number(s);
                                return n;
                            })
                            .filter(dmi => Number.isFinite(dmi) && dmi % 50 !== 0) as number[];

                        // Show error
                        if (missingCols.length > 0) {
                            errorLines.push(`Missing columns:<br />• ${missingCols.join('<br />• ')}`);
                        }
                        if (invalidCols.length > 0) {
                            errorLines.push(
                                `Wrong format columns:<br />• ${invalidCols.map(col => `${col} → expected 'DMI', 'Winter_22', 'Summer 24', etc.`).join('<br />• ')}`
                            );
                        }
                        if (badSeasonHeaders.length > 0) {
                            errorLines.push(
                                `Invalid Year in season headers (must be 4 digits and ≤ ${CURRENT_YEAR}):<br />• ${badSeasonHeaders.join('<br />• ')}`
                            );
                        }
                        if (futureSeasonHeaders.length > 0) {
                            errorLines.push(
                                `Season headers have future years (≤ ${CURRENT_YEAR} required):<br />• ${futureSeasonHeaders.join('<br />• ')}`
                            );
                        }
                        if (dmiErrors.length > 0) {
                            console.warn('Invalid DMI values:', dmiErrors);
                            errorLines.push(`Some DMI values are not divisible by 50:<br />• ${dmiErrors.slice(0, 10).join(', ')}${dmiErrors.length > 10 ? '...' : ''}`);
                            setBadDMIValues(dmiErrors);
                        } else {
                            setBadDMIValues([]);
                        }
                        // All conditions must pass
                        const hasSeasonCols = seasonCols.length > 0;
                        isValid =
                            hasSeasonCols &&
                            missingCols.length === 0 &&
                            invalidCols.length === 0 &&
                            badSeasonHeaders.length === 0 &&
                            futureSeasonHeaders.length === 0 &&
                            emptyDMI.length === 0 &&
                            dmiErrors.length === 0;
                        // isValid = missingCols.length === 0 && invalidCols.length === 0 && dmiErrors.length === 0;
                    }
                    else {
                        const missing = expected.filter((key) => !headers.includes(key));
                        const unexpected = headers.filter((key) => !expected.includes(key));

                        missingCols = [...missing];
                        invalidCols = [...unexpected];

                        const errorLineMissing = missingCols.length > 0
                            ? `Missing columns:<br />• ${missingCols.join('<br />• ')}`
                            : '';

                        const errorLineInvalid = invalidCols.length > 0
                            ? `Wrong format columns:<br />• ${invalidCols.map(col => `${col} → expected one of: ${expected.join(', ')}`).join('<br />• ')}`
                            : '';

                        errorLines.push(...[errorLineMissing, errorLineInvalid].filter(Boolean));
                        let badYearValues: string[] = [];
                        if (headers.includes('Year')) {
                            parsed.forEach((row) => {
                                const s = String(row.Year ?? '').trim();
                                const n = /^\d{4}$/.test(s) ? Number(s) : NaN;
                                if (!Number.isFinite(n) || n > CURRENT_YEAR) {
                                    badYearValues.push(s === '' ? '(empty)' : s);
                                }
                            });
                        }

                        if (badYearValues.length > 0) {
                            errorLines.push(
                                `Invalid <b>Year</b> values (must be 4 digits and ≤ ${CURRENT_YEAR}):<br />• ${badYearValues.slice(0, 10).join(', ')
                                }${badYearValues.length > 10 ? '...' : ''}`
                            );
                        }
                        isValid =
                            missingCols.length === 0 &&
                            invalidCols.length === 0 &&
                            badYearValues.length === 0;
                    }

                }
                if (duplicateCols.length > 0) {
                    const duplicateLines = duplicateCols.map((col) => {
                        const count = parsed.filter(row => row[col] != null && String(row[col]).trim() !== '').length;
                        return `${col} → appears multiple times (${count > 0 ? 'has data' : 'empty'})`;
                    });

                    errorLines.push(
                        `Duplicate columns detected:<br />• ${duplicateLines.join('<br />• ')}<br />Consider removing or renaming them.`
                    );
                }
                const warningLines: string[] = [];
                if (chartType === 'deflection') {
                    // Duplicates by DMI
                    const dmiCounts = new Map<number, number>();
                    parsed.forEach(row => {
                        const s = String(row.DMI ?? '').trim();
                        const n = s === '' ? NaN : Number(s);
                        if (Number.isFinite(n)) {
                            dmiCounts.set(n, (dmiCounts.get(n) ?? 0) + 1);
                        }
                    });
                    const dupDmis = [...dmiCounts.entries()].filter(([, c]) => c > 1);
                    if (dupDmis.length) {
                        warningLines.push(
                            `Duplicate rows detected by <b>DMI</b> (only the last will be kept when you save):<br />• ${dupDmis
                                .slice(0, 10)
                                .map(([dmi, c]) => `DMI ${dmi} (x${c})`)
                                .join('<br />• ')
                            }${dupDmis.length > 10 ? '<br />…' : ''}`
                        );
                    }
                } else {
                    // Duplicates by Year
                    const yearCounts = new Map<number, number>();
                    parsed.forEach(row => {
                        const s = String(row.Year ?? '').trim();
                        const n = /^\d{4}$/.test(s) ? Number(s) : NaN;
                        if (Number.isFinite(n)) {
                            yearCounts.set(n, (yearCounts.get(n) ?? 0) + 1);
                        }
                    });
                    const dupYears = [...yearCounts.entries()].filter(([, c]) => c > 1);
                    if (dupYears.length) {
                        warningLines.push(
                            `Duplicate rows detected by <b>Year</b> (only the last will be kept when you save):<br />• ${dupYears
                                .slice(0, 10)
                                .map(([year, c]) => `${year} (x${c})`)
                                .join('<br />• ')
                            }${dupYears.length > 10 ? '<br />…' : ''}`
                        );
                    }
                }

                // Set or clear the warning banner
                if (warningLines.length) {
                    setWarning(warningLines.join('<br /><br />'));
                } else {
                    setWarning(null);
                }
                // --- Duplicate row grouping (rows, not columns) ---
                const groups: DupGroup[] = [];
                const choice: Record<string, number> = {};

                if (parsed.length) {
                    if (chartType === 'deflection') {
                        // Key duplicates by DMI number
                        const map = new Map<string, DupMember[]>();
                        parsed.forEach((row, idx) => {
                            const s = String(row.DMI ?? '').trim();
                            const n = s === '' ? NaN : Number(s);
                            if (!Number.isFinite(n)) return; // ignore empty/invalid DMI (already handled by error)
                            const k = String(n);
                            if (!map.has(k)) map.set(k, []);
                            map.get(k)!.push({ idx, row });
                        });
                        for (const [k, members] of map) {
                            if (members.length > 1) {
                                groups.push({ key: k, members });
                                // default to last in file (most recent line wins)
                                choice[k] = members[members.length - 1].idx;
                            }
                        }
                    } else {
                        // Key duplicates by Year (strict 4-digit)
                        const map = new Map<string, DupMember[]>();
                        parsed.forEach((row, idx) => {
                            const s = String(row.Year ?? '').trim();
                            const n = /^\d{4}$/.test(s) ? Number(s) : NaN;
                            if (!Number.isFinite(n)) return; // ignore invalid year (already handled by error)
                            const k = String(n);
                            if (!map.has(k)) map.set(k, []);
                            map.get(k)!.push({ idx, row });
                        });
                        for (const [k, members] of map) {
                            if (members.length > 1) {
                                groups.push({ key: k, members });
                                choice[k] = members[members.length - 1].idx;
                            }
                        }
                    }
                }

                setDupGroups(groups);
                setDupChoice(choice);
                if (!isValid) {
                    const expectedStr =
                        chartType === 'deflection'
                            ? `Invalid format. Expected columns: <b>'DMI'</b> plus columns like <b>'Winter_22'</b>, <b>'Summer 24'</b>, or <b>'Winter13'</b>.<br />
       Additionally, <b>DMI values must be divisible by 50</b> (e.g., 0, 50, 100, ...).<br /><br />` +
                            errorLines.join('<br /><br />')
                            : `Invalid format. Expected columns: ${expected.join(', ')}.<br /><br />` +
                            errorLines.join('<br /><br />');


                    setError(expectedStr);
                } else {
                    onUploadSuccess(parsed);
                    resetModal();
                }



            },
            error: (err) => {
                console.error('Parse error:', err);
                setError('Failed to parse CSV.');
            }
        });
    };
    const suggestFix = () => {
        if (!parsedData.length || !rawHeaders.length) return;

        const suggestions: { from: string; to: string }[] = [];

        // Step 1: build suggestions ONCE based on rawHeaders
        rawHeaders.forEach((col) => {
            let fixedCol = col;
            const original = col;

            if (chartType === 'deflection') {
                // First: handle DMI variants like DMI2, DMI_extra
                if (/^dmi[\w-]*$/i.test(col)) {
                    fixedCol = 'DMI';
                } else {
                    // Then: try to parse season + year from clean, fuzzy, or short forms

                    const colClean = col.trim();
                    let seasonMatch =
                        colClean.match(/(win(?:t)?e?r|sum(?:m)?e?r).*?(\d{2,4})/i) ||  // full correct
                        colClean.match(/(einter|sumer|wint|summ|wintr).*?(\d{2,4})/i) || // fuzzy typos
                        colClean.match(/^([WS])[\s_-]?(\d{2,4})/i); // fallback single-letter

                    if (seasonMatch) {
                        const rawSeason = seasonMatch[1].toLowerCase();
                        const season = rawSeason.startsWith('w') ? 'Winter' : 'Summer';
                        const year = seasonMatch[2];
                        fixedCol = `${season}_${year}`;
                    }
                }
            }
            else if (chartType === 'lte_crack') {
                const colClean = col.trim();
                if (/^s(ma(ll)?)?$/i.test(colClean)) fixedCol = 'Small';
                else if (/^m(ed(i(um)?)?)?$/i.test(colClean)) fixedCol = 'Medium';
                else if (/^l(ar(ge)?)?$/i.test(colClean)) fixedCol = 'Large';
            } else if (chartType === 'lte_season') {
                const colClean = col.trim();
                if (/^y(ea(r)?)?$/i.test(colClean)) fixedCol = 'Year';
                else if (/^w(in(t(er)?)?)?|wi|ww|wint?$/i.test(colClean)) fixedCol = 'Winter';
                else if (/^s(um(m(er)?)?)?|su|ss|sume?r?$/i.test(colClean)) fixedCol = 'Summer';
            }

            const isValidDeflection =
                chartType === 'deflection' &&
                (fixedCol === 'DMI' || /^(Winter|Summer)_\d{2,4}$/.test(fixedCol));

            const isValidLTECrack =
                chartType === 'lte_crack' &&
                ['Year', 'Small', 'Medium', 'Large'].includes(fixedCol);
            const isValidLTESeason =
                chartType === 'lte_season' &&
                ['Year', 'Winter', 'Summer'].includes(fixedCol);
            if (original !== fixedCol) {
                suggestions.push({ from: original, to: fixedCol });
            } else if (!isValidDeflection && !isValidLTECrack && !isValidLTESeason) {
                suggestions.push({ from: original, to: '' });
            }
        });

        // Step 2: deduplicate suggestions
        const uniqueSuggestions = suggestions.filter(
            (v, i, a) => a.findIndex(t => t.from === v.from) === i
        );

        // Step 3: only keep invalid ones
        const filteredSuggestions = uniqueSuggestions.filter(
            ({ from, to }) => to === '' || from !== to
        );


        // Step 3.5: detect duplicate *target* columns (e.g., multiple → "Summer")
        const targetToSources: Record<string, string[]> = {};
        filteredSuggestions.forEach(({ from, to }) => {
            if (!to) return;
            if (!targetToSources[to]) targetToSources[to] = [];
            targetToSources[to].push(from);
        });

        // Collect collisions (i.e., multiple columns that map to same name)
        const collisions = Object.entries(targetToSources).filter(([_, sources]) => sources.length > 1);

        // Optionally show per-column data presence to help user decide which to keep
        const collisionWithData = collisions.map(([target, sources]) => {
            return {
                target,
                sources: sources.map((from) => {
                    const count = parsedData.filter(row => row[from] != null && String(row[from]).trim() !== '').length;
                    return { from, hasData: count > 0, nonEmptyCount: count };
                })
            };
        });

        setFixSuggestions(filteredSuggestions);
        setShowFixPreview(true);

        // Step 4: prepare fixed CSV blob (only for download preview)
        const headerMap: Record<string, string> = {};
        filteredSuggestions.forEach(({ from, to }) => {
            headerMap[from] = to || from; // fallback to original for now
        });

        const newDmiFixes: { original: number, fixed: number }[] = [];

        const fixedData = parsedData.map((row) => {
            const newRow: Record<string, any> = {};
            Object.keys(row).forEach((key) => {
                const mappedKey = headerMap[key] || key;
                let value = row[key];

                // Collect DMI fixes (only for deflection)
                if (chartType === 'deflection' && mappedKey === 'DMI') {
                    const num = Number(value);
                    if (!isNaN(num)) {
                        const rounded = Math.round(num / 50) * 50;
                        const override = manualDmiFixes[num];
                        const finalValue = override ?? rounded;

                        if (finalValue !== num) {
                            newDmiFixes.push({ original: num, fixed: finalValue });
                            value = finalValue;
                        }
                    }
                }

                newRow[mappedKey] = value;
            });
            return newRow;
        });

        setDmiFixes(newDmiFixes);

        const csv = Papa.unparse(fixedData);
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        setFixedCSVBlobUrl(url);
        setFixedFile(new File([blob], 'fixed.csv', { type: 'text/csv' }));
    };
    const downloadTemplate = () => {
        let csvContent = '';

        if (parsedData.length > 0) {
            // Use current data as template
            csvContent = Papa.unparse(parsedData);
        } else {
            // Generate example headers for selected chart type
            let sample: Record<string, string | number>[] = [];

            if (chartType === 'deflection') {
                sample = [
                    { DMI: 0, Winter_22: 3.4, Summer_22: 3.2, Winter_23: 3.6, Summer_23: 3.5 },
                    { DMI: 50, Winter_22: 3.1, Summer_22: 3.0, Winter_23: 3.3, Summer_23: 3.2 }
                ];
            } else if (chartType === 'lte_season') {
                sample = [
                    { Year: 2022, Winter: 1.2, Summer: 1.4 },
                    { Year: 2023, Winter: 1.1, Summer: 1.5 }
                ];
            } else if (chartType === 'lte_crack') {
                sample = [
                    { Year: 2022, Small: 2, Medium: 1, Large: 0 },
                    { Year: 2023, Small: 3, Medium: 2, Large: 1 }
                ];
            }

            csvContent = Papa.unparse(sample);
        }

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);

        const a = document.createElement('a');
        a.href = url;
        a.download = `${chartType}_template.csv`;
        a.click();

        URL.revokeObjectURL(url);
    };


    const [fixedFile, setFixedFile] = useState<File | null>(null);

    const applyFix = () => {
        if (fixedFile) {
            const fixMap: Record<string, string> = {};
            fixSuggestions.forEach(({ from, to }) => {
                fixMap[from] = to || manualFixes[from] || from;
            });

            // Create a quick lookup for DMI value fixes
            const dmiFixLookup = new Map<number, number>();
            dmiFixes.forEach(({ original, fixed }) => {
                const manual = manualDmiFixes[original];
                dmiFixLookup.set(original, manual !== undefined ? manual : fixed);
            });

            const fixedData = parsedData.map((row) => {
                const fixedRow: Record<string, any> = {};

                Object.entries(row).forEach(([key, value]) => {
                    const mappedKey = fixMap[key] || key;
                    let newValue = value;

                    // Apply DMI value fix if needed
                    if (chartType === 'deflection' && mappedKey === 'DMI') {
                        const num = Number(value);
                        if (!isNaN(num) && dmiFixLookup.has(num)) {
                            newValue = dmiFixLookup.get(num);
                        }
                    }

                    fixedRow[mappedKey] = newValue;
                });

                return fixedRow;
            });
            let filteredFixedData = fixedData;

            // If there are duplicate groups, keep only the chosen row per group
            if (dupGroups.length > 0) {
                const dupIdxSet = new Set<number>();          // all indices that are in any dup group
                const keepIdxSet = new Set<number>();         // indices to keep (one per group)

                dupGroups.forEach(g => {
                    g.members.forEach(m => dupIdxSet.add(m.idx));
                    const chosen = dupChoice[g.key];
                    if (typeof chosen === 'number') keepIdxSet.add(chosen);
                });

                filteredFixedData = fixedData.filter((_, idx) => {
                    // If this row was part of a duplicate group, keep only if it's the chosen idx
                    if (dupIdxSet.has(idx)) return keepIdxSet.has(idx);
                    // Not in a duplicate group → always keep
                    return true;
                });
            }

            // Now continue with your existing CSV generation from filteredFixedData
            const csv = Papa.unparse(filteredFixedData);
            const blob = new Blob([csv], { type: 'text/csv' });
            const fixedFile = new File([blob], 'fixed.csv', { type: 'text/csv' });

            parseCSV(fixedFile);
            setShowFixPreview(false);
            // const csv = Papa.unparse(fixedData);
            // const blob = new Blob([csv], { type: 'text/csv' });
            // const fixedFile = new File([blob], 'fixed.csv', { type: 'text/csv' });

            // parseCSV(fixedFile);
            // setShowFixPreview(false);

        }
    };
    const resetModal = () => {
        onClose();
        setShowFixPreview(false);
        setFixSuggestions([]);
        setFixedCSVBlobUrl(null);
        setParsedData([]);
        setRawHeaders([]);
        setFixedFile(null);
        setError(null);
        setWarning(null);
        setManualFixes({});
        setBadDMIValues([]);
        setDmiFixes([]);
        setFile(null);
        setIsDragging(false);

        setDupGroups([]);
        setDupChoice({});
    };

    const allResolved = fixSuggestions.every(({ from, to }) => {
        const final = to || manualFixes[from];
        return final && final.trim().length > 0;
    });

    const allTargets = fixSuggestions.map(({ from, to }) => (to || manualFixes[from] || '').trim());
    const hasDuplicates = allTargets.some((target, i, arr) => target && arr.indexOf(target) !== i);

    // const canApplyFix = allResolved && !hasDuplicates && fixSuggestions.length > 0;
    const canApplyFix = allResolved && !hasDuplicates && (fixSuggestions.length > 0 || dmiFixes.length > 0);

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="bg-white rounded-xl shadow-lg w-full max-w-xl p-6 text-gray-900">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold">
                        Upload CSV for <span className="capitalize">{chartType.replace('_', ' ')}</span>
                    </h2>
                    <button onClick={resetModal} className="text-gray-500 hover:text-gray-800 text-lg">×</button>
                </div>

                <div className="mb-6">
                    <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
                    <div
                        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
                            } border-dashed rounded-md hover:border-blue-400 transition-colors`}
                        onDragEnter={handleDragEnter}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onDrop={handleDrop}
                    >
                        <div className="space-y-1 text-center">
                            <svg className="mx-auto h-12 w-12 text-gray-400" stroke="currentColor" fill="none" viewBox="0 0 48 48">
                                <path
                                    d="M28 8H12a4 4 0 00-4 4v20m32-12v8m0 0v8a4 4 0 01-4 4H12a4 4 0 01-4-4v-4m32-4l-3.172-3.172a4 4 0 00-5.656 0L28 28M8 32l9.172-9.172a4 4 0 015.656 0L28 28m0 0l4 4m4-24h8m-4-4v8m-12 4h.02"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            </svg>
                            <div className="flex text-sm text-gray-600">
                                <label htmlFor="file-upload" className="relative cursor-pointer bg-white rounded-md font-medium text-blue-600 hover:text-blue-500">
                                    <span>Select a CSV file</span>
                                    <input id="file-upload" type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
                                </label>
                                <p className="pl-1">or drag and drop</p>
                            </div>
                            <p className="text-xs text-gray-500">Accepted format: .csv</p>
                            {file && <div className="mt-2 text-sm text-gray-800 bg-blue-50 p-2 rounded">{file.name}</div>}
                        </div>
                    </div>
                </div>

                {error && (
                    <div
                        className="text-red-600 text-sm mt-2"
                        dangerouslySetInnerHTML={{ __html: error }}
                    />
                )}
                {warning && (
                    <div
                        className="mt-3 text-sm text-yellow-800 bg-yellow-50 border border-yellow-200 rounded p-3"
                        dangerouslySetInnerHTML={{ __html: warning }}
                    />
                )}

                {showFixPreview && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                        <div className="bg-white rounded-xl p-6 max-w-lg w-full shadow-xl">
                            <h3 className="text-lg font-bold mb-3">Fix Preview</h3>
                            <p className="text-sm font-medium text-black mt-4">Detected column fixes:</p>
                            <ul className="space-y-2">
                                {fixSuggestions.map(({ from, to }, idx) => {
                                    const allMappings = fixSuggestions.map(s => s.to || manualFixes[s.from] || s.from);
                                    const target = to || manualFixes[from] || '';
                                    const isDuplicate = target && allMappings.filter(val => val === target).length > 1;

                                    const value = manualFixes[from] ?? to ?? '';
                                    const rowDataCount = parsedData.filter(row => row[from] != null && String(row[from]).trim() !== '').length;
                                    const hasData = rowDataCount > 0;

                                    return (
                                        <li key={idx} className="flex items-center justify-between gap-3 py-1">
                                            <div className="flex items-center gap-2 w-1/3">
                                                <span className="w-32 font-medium text-red-600">{from}</span>
                                            </div>

                                            <span className="text-gray-500">→</span>
                                            <input
                                                type="text"
                                                value={value}
                                                placeholder="Enter column name"
                                                onChange={(e) => setManualFixes(prev => ({ ...prev, [from]: e.target.value }))}
                                                className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                                            />

                                            {isDuplicate && (
                                                <span className="text-yellow-600 text-xs px-2">⚠ Duplicate</span>
                                            )}
                                            <span
                                                className={`text-xs rounded px-2 py-0.5 ${hasData ? 'bg-green-100 text-green-800' : 'bg-gray-200 text-gray-600'
                                                    }`}
                                            >
                                                {hasData ? `${rowDataCount} rows` : 'Empty'}
                                            </span>

                                            <button
                                                onClick={() => {
                                                    setFixSuggestions(prev => prev.filter(s => s.from !== from));
                                                    setParsedData(prevData =>
                                                        prevData.map(row => {
                                                            const { [from]: _, ...rest } = row;
                                                            return rest;
                                                        })
                                                    );
                                                }}
                                                className="text-gray-400 hover:text-red-600 ml-auto"
                                                title="Delete"
                                            >
                                                <FaTrash className="w-4 h-4" />
                                            </button>
                                        </li>
                                    );
                                })}
                                {chartType === 'deflection' && dmiFixes.length > 0 && (
                                    <>
                                        <p className="text-sm font-medium text-black mt-4">DMI value fixes:</p>
                                        <ul className="space-y-1 divide-y divide-gray-100">
                                            {dmiFixes.map(({ original, fixed }, idx) => {
                                                const rowDataCount = parsedData.filter(row => Number(row.DMI) === original).length;
                                                const hasData = rowDataCount > 0;

                                                return (
                                                    <li key={idx} className="flex items-center justify-between gap-3 py-1">
                                                        <div className="flex items-center gap-2 w-1/3">
                                                            <span className="text-gray-700">DMI:</span>
                                                            <span className="text-red-600 font-medium">{original}</span>
                                                        </div>

                                                        <span className="text-gray-500">→</span>
                                                        <input
                                                            type="number"
                                                            value={manualDmiFixes[original] ?? fixed}
                                                            onChange={(e) =>
                                                                setManualDmiFixes((prev) => ({
                                                                    ...prev,
                                                                    [original]: Number(e.target.value),
                                                                }))
                                                            }
                                                            className="border border-gray-300 rounded px-2 py-1 text-sm w-40"
                                                        />

                                                        <span
                                                            className={`text-xs font-medium rounded px-2 py-0.5 whitespace-nowrap ${hasData ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
                                                                }`}
                                                        >
                                                            {hasData ? `${rowDataCount} rows` : 'Empty'}
                                                        </span>

                                                        <button
                                                            disabled
                                                            title="Cannot delete auto-detected DMI fix"
                                                            className="text-gray-300 cursor-not-allowed"
                                                        >
                                                            <FaTrash className="w-4 h-4" />
                                                        </button>
                                                    </li>
                                                );
                                            })}
                                        </ul>

                                    </>
                                )}
                                {dupGroups.length > 0 && (
                                    <>
                                        <p className="text-sm font-medium text-black mt-5">Duplicate rows found — choose which one to keep per key:</p>
                                        <div className="mt-2 max-h-64 overflow-auto border rounded">
                                            {dupGroups.map((g) => (
                                                <div key={g.key} className="border-b last:border-b-0 p-3">
                                                    <div className="font-medium mb-2">
                                                        {chartType === 'deflection' ? <>DMI: <span className="text-blue-700">{g.key}</span></> :
                                                            <>Year: <span className="text-blue-700">{g.key}</span></>}
                                                    </div>
                                                    <div className="space-y-2">
                                                        {g.members.map((m, i) => {
                                                            const r = m.row;
                                                            const preview =
                                                                chartType === 'deflection'
                                                                    ? `Row #${m.idx + 1} — W_??: ${Object.entries(r).filter(([k]) => /^Winter/i.test(k)).slice(0, 1).map(([, v]) => v).join('') || '—'}, S_??: ${Object.entries(r).filter(([k]) => /^Summer/i.test(k)).slice(0, 1).map(([, v]) => v).join('') || '—'}`
                                                                    : `Row #${m.idx + 1} — Winter: ${r.Winter ?? '—'}, Summer: ${r.Summer ?? '—'}${chartType === 'lte_crack' ? `, S/M/L: ${r.Small ?? '—'}/${r.Medium ?? '—'}/${r.Large ?? '—'}` : ''}`;
                                                            return (
                                                                <label key={m.idx} className="flex items-center gap-3 text-sm">
                                                                    <input
                                                                        type="radio"
                                                                        name={`dup-${g.key}`}
                                                                        checked={dupChoice[g.key] === m.idx}
                                                                        onChange={() => setDupChoice(prev => ({ ...prev, [g.key]: m.idx }))}
                                                                    />
                                                                    <span className="text-gray-700">{preview}</span>
                                                                </label>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Only the selected row for each key will be kept when you click <b>Apply Fix</b>.
                                        </p>
                                    </>
                                )}
                            </ul>


                            <div className="flex justify-end gap-3 mt-4 text-sm">
                                {/* Cancel */}
                                <button
                                    onClick={() => setShowFixPreview(false)}
                                    className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
                                >
                                    <X className="w-4 h-4 mr-2" />
                                    Cancel
                                </button>

                                {/* Download Template (Green) */}
                                <button
                                    onClick={downloadTemplate}
                                    className="inline-flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md"
                                >
                                    <FaDownload className="mr-1 w-5 h-5" />
                                    Download Template
                                </button>

                                {/* Apply Fix */}
                                <button
                                    onClick={applyFix}
                                    disabled={!canApplyFix}
                                    className={`inline-flex items-center px-4 py-2 rounded-md ${canApplyFix ? 'bg-blue-600 hover:bg-blue-700 text-white' : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                                        }`}
                                >
                                    <FaCheck className="w-4 h-4 mr-2" />
                                    Apply Fix
                                </button>
                            </div>

                        </div>
                    </div>
                )}

                <div className="mt-4 flex justify-end gap-3">
                    {error && parsedData.length > 0 && (

                        <button
                            onClick={suggestFix}
                            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-yellow-400 text-yellow-900 hover:bg-yellow-500 text-sm font-medium"
                        >
                            <FaMagic className="w-4 h-4" />
                            Suggest Fix
                        </button>
                    )}
                    <button
                        onClick={downloadTemplate}
                        className="inline-flex items-center px-4 py-2 bg-green-600 text-white hover:bg-green-700 rounded-md"
                    >
                        <FaDownload className="w-4 h-4 mr-2" />
                        Download Template
                    </button>
                    <button
                        onClick={resetModal}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 text-sm"
                    >
                        Cancel
                    </button>
                </div>

            </div>
        </div>
    );
};

export default CSVUploadModal;
