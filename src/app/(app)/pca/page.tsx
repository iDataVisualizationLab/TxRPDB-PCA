'use client'

import React, { useEffect, useState, useCallback, useRef, useMemo, use } from 'react'
import Papa from 'papaparse'
import { PCA } from 'ml-pca'
import dynamic from 'next/dynamic'
import { components } from 'react-select'
import PCADataTable from "@/components/PCADataTable";
import { useGlobalLoading } from "@/context/GlobalLoadingContext"
import { route } from "@/config"
// UI components
import TableModalPMIS from '@/app/(app)/general/pmis/highway-heatmaps/TableModalPMIS'
import HeatMapModal from '@/app/(app)/general/pmis/highway-heatmaps/HeatMapModal'
const ScoreGauge = dynamic(() => import('@/components/chart/ScoreGauge'), { ssr: false });
const CategoryBarChart = dynamic(() => import('@/components/chart/CategoryBarChart'), { ssr: false });

const Select = dynamic(() => import('react-select'), { ssr: false })
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false })

// Score to gauge type mapping
const fieldToScoreType: Record<string, string> = {
    TX_CONDITION_SCORE: 'condition',
    TX_DISTRESS_SCORE: 'distress',
    TX_RIDE_SCORE: 'ride',
    TX_AADT_CURRENT: 'aadt',
    TX_MAINTENANCE_COST_AMT: 'cost',
}
const METRIC_FIELDS = Object.keys(fieldToScoreType);

// Row → { highway, county }
// const getHiCoFromRow = (row: any) => ({
//     highway: row?.TX_SIGNED_HIGHWAY_RDBD_ID,
//     county: row?.COUNTY,
// });
const getHiCoFromRow = (row: any) => {
    console.log(row); // debug log
    return {
        highway: row?.TX_SIGNED_HIGHWAY_RDBD_ID,
        county: row?.COUNTY,
    };
};


// Custom Option with checkbox
const Option = (props: any) => {
    const handleClick = (e: React.MouseEvent) => {
        e.preventDefault()
        props.selectOption(props.data)
    }
    return (
        <components.Option {...props}>
            <label className="flex items-center gap-2 px-2 py-1">
                <input
                    type="checkbox"
                    checked={props.isSelected}
                    onClick={handleClick}
                    readOnly
                    className="w-4 h-4 border border-gray-300 rounded cursor-pointer 
            hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 appearance-none"
                />
                <span className="text-sm text-gray-700 select-none">{props.label}</span>
            </label>
        </components.Option>
    )
}

// Custom MenuList with Select All
const MenuList = (props: any) => {
    const allSelected = props.getValue().length === props.options.length
    const toggleAll = (e: React.MouseEvent) => {
        e.preventDefault()
        e.stopPropagation()
        allSelected ? props.clearValue() : props.setValue(props.options)
    }
    return (
        <components.MenuList {...props}>
            <div className="sticky top-0 bg-white border-b border-gray-200">
                <div className="flex items-center gap-2 px-2 py-1">
                    <input
                        type="checkbox"
                        checked={allSelected}
                        onClick={toggleAll}
                        readOnly
                        className="w-4 h-4 border border-gray-300 rounded cursor-pointer hover:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-0 appearance-none"
                    />
                    <button onClick={toggleAll} className="text-sm text-gray-700 select-none">
                        {allSelected ? 'Unselect All' : 'Select All'}
                    </button>
                </div>
            </div>
            {props.children}
        </components.MenuList>
    )
}

function shadeColor(hex: string, percent: number) {
    const f = parseInt(hex.slice(1), 16);
    const t = percent < 0 ? 0 : 255;
    const p = Math.abs(percent);
    const R = f >> 16;
    const G = (f >> 8) & 0x00FF;
    const B = f & 0x0000FF;
    const toHex = (v: number) => v.toString(16).padStart(2, '0');
    return "#" + (
        (0x1000000 +
            (Math.round((t - R) * p) + R) * 0x10000 +
            (Math.round((t - G) * p) + G) * 0x100 +
            (Math.round((t - B) * p) + B)
        )
    ).toString(16).slice(1);
}

export default function PCAExplorer() {
    const [data, setData] = useState<any[]>([])
    const [numericCols, setNumericCols] = useState<string[]>([])
    const [selectedCols, setSelectedCols] = useState<string[]>([])
    const [colorCol, setColorCol] = useState<string>('')
    const [scores, setScores] = useState<Array<{ PC1: number, PC2: number, colorVal: any, row: any }>>([])
    const [loadings, setLoadings] = useState<any[]>([])
    const [shapes, setShapes] = useState<Partial<Plotly.Shape>[]>([]);
    const { setLoading: setGlobalLoading } = useGlobalLoading()
    const [displayMode, setDisplayMode] = useState<'grouped' | 'raw' | 'raw-timeline'>('grouped');
    const [selectedRows, setSelectedRows] = useState<any[]>([]);
    const displayModeOptions = [
        { value: 'grouped', label: 'Grouped' },
        { value: 'raw', label: 'Ungrouped' },
        { value: 'raw-timeline', label: 'Timeline' },
    ];
    const [selectedHighways, setSelectedHighways] = useState<string[]>([])
    const [selectedCounties, setSelectedCounties] = useState<string[]>([])
    const [begNbrs, setBegNbrs] = useState<string[]>([])
    const [begDisps, setBegDisps] = useState<string[]>([])
    const [endNbrs, setEndNbrs] = useState<string[]>([])
    const [endDisps, setEndDisps] = useState<string[]>([])
    const [hmHighway, setHmHighway] = useState<string>('')
    const [hmCounty, setHmCounty] = useState<string>('')
    const [hmField, setHmField] = useState<string>('')
    const [selectedHmHighways, setSelectedHmHighways] = useState<string[]>([])
    const [selectedHmCounties, setSelectedHmCounties] = useState<string[]>([])

    const [scoreGauges, setScoreGauges] = useState<{ [k in "condition" | "distress" | "ride" | "aadt" | "cost"]?: number }>({})
    const [isLoading, setIsLoading] = useState(true)

    const [pmisFeatures, setPmisFeatures] = useState<any[]>([])
    const [activeHeatMapData, setActiveHeatMapData] = useState<any[]>([])
    const heatmapIdRef = useRef(0)
    const nextId = () => `heatmap-${++heatmapIdRef.current}`

    // Global loading context
    const { setLoading } = useGlobalLoading()

    // Connect local loading state to global loading context
    useEffect(() => {
        setLoading(isLoading)
        return () => setLoading(false)
    }, [isLoading, setLoading])

    useEffect(() => {
        setIsLoading(true)

        Papa.parse(`${route}/general/pmis_pca_input.csv`, {
            download: true,
            header: true,
            dynamicTyping: true,
            complete: ({ data: rows }) => {

                const mapped = (rows as any[]).map(r => {
                    if (typeof r.DETAILED_PAV_TYPE === 'string') {
                        const m = r.DETAILED_PAV_TYPE.match(/\(([^)]+)\)/)
                        if (m) {
                            // e.g. "(CRCP)" → "crcp"
                            // r.DETAILED_PAV_TYPE = m[1].toLowerCase()
                            r.DETAILED_PAV_TYPE = m[1]
                        }
                    }
                    return r
                })
                const clean = mapped.filter(r => Object.values(r as Record<string, unknown>).some(v => v !== null && v !== undefined))
                setData(clean)
                // 2) collect all column names
                const allCols = Object.keys(clean[0] || {});
                console.log("allCols:", allCols);

                // 3) pick only those where EVERY non-null value is a number
                const nums = allCols.filter(col => {
                    // grab all the actual, non-empty values in that column
                    const vals = clean
                        .map(r => (r as Record<string, unknown>)[col])
                        .filter(v => v !== null && v !== undefined);

                    // if there are no real values, skip it
                    if (vals.length === 0) return false;

                    // return true only if all of them are typeof number
                    return vals.every(v => typeof v === 'number');
                });

                // const sample: Record<string, any> = clean[0] || {}
                // const nums = Object.keys(sample).filter(k => typeof sample[k] === 'number')
                setNumericCols(nums)
                setSelectedCols(['TX_DISTRESS_SCORE', 'TX_LENGTH', 'TX_RIDE_SCORE', 'TX_AADT_CURRENT', 'TX_MAINTENANCE_COST_AMT'])
                setColorCol('DETAILED_PAV_TYPE')
            }
        })
        fetch(`${route}/general/Concrete_distresses.csv`)
            .then((res) => res.text())
            .then((csvText) => {
                // Parse CSV text to array of objects
                const lines = csvText.split("\n")
                const headers = lines[0].split(",").map((header) => header.trim())

                const features = lines
                    .slice(1)
                    .filter((line) => line.trim() !== "")
                    .map((line) => {
                        const values = line.split(",").map((value) => value.trim())
                        const properties: Record<string, string> = {}
                        headers.forEach((header, index) => {
                            properties[header] = values[index]
                        })
                        // Create a feature structure similar to GeoJSON to maintain compatibility
                        return { type: "Feature", properties, geometry: null }
                    })

                setPmisFeatures(features)
                setIsLoading(false)
            })
            .catch((err) => {
                console.error("Failed to load CSV data:", err)
                setIsLoading(false)
            })
    }, [])

    // Extract all AADT/Cost values for distribution bars
    const allAADTValues = useMemo(() => {
        return pmisFeatures
            .map(f => Number(f.properties?.TX_AADT_CURRENT))
            .filter(v => Number.isFinite(v) && v > 0);
    }, [pmisFeatures]);

    const allCostValues = useMemo(() => {
        return pmisFeatures
            .map(f => Number(f.properties?.TX_MAINTENANCE_COST_AMT))
            .filter(v => Number.isFinite(v) && v > 0);
    }, [pmisFeatures]);
    const renderVisualization = useCallback(
        (type: string, value: number) => {
            if (type === 'aadt') {
                return <CategoryBarChart value={value} dataType="aadt" allValues={allAADTValues} />;
            }
            if (type === 'cost') {
                return <CategoryBarChart value={value} dataType="cost" allValues={allCostValues} />;
            }
            return <ScoreGauge value={value} scoreType={type as 'condition' | 'distress' | 'ride'} />;
        },
        [allAADTValues, allCostValues]
    );

    // Options for 'Color by'
    const columnOptions = useMemo(() => {
        if (!data[0]) return []
        return Object.keys(data[0]).map(col => ({ value: col, label: col }))
    }, [data])
    const highwayOptions = useMemo(() => {
        const uniques = Array.from(new Set(data.map(r => r.TX_SIGNED_HIGHWAY_RDBD_ID)))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data])

    const countyOptions = useMemo(() => {
        if (!selectedHighways.length) return []
        const filt = data.filter(r => selectedHighways.includes(r.TX_SIGNED_HIGHWAY_RDBD_ID))
        const uniques = Array.from(new Set(filt.map(r => r.COUNTY)))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data, selectedHighways])
    const hmhighwayOptions = useMemo(() => {
        const uniques = Array.from(new Set(data.map(r => r.TX_SIGNED_HIGHWAY_RDBD_ID)))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data])

    const hmcountyOptions = useMemo(() => {
        if (!hmHighway) return []
        const filt = data.filter(r => hmHighway === r.TX_SIGNED_HIGHWAY_RDBD_ID)
        const uniques = Array.from(new Set(filt.map(r => r.COUNTY)))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data, hmHighway])
    const begNbrOptions = useMemo(() => {
        if (!selectedCounties.length) return []
        const filt = data.filter(r =>
            selectedHighways.includes(r.TX_SIGNED_HIGHWAY_RDBD_ID) &&
            selectedCounties.includes(r.COUNTY)
        )
        const uniques = Array.from(new Set(filt.map(r => String(r.TX_BEG_REF_MARKER_NBR))))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data, selectedHighways, selectedCounties])

    const begDispOptions = useMemo(() => {
        if (!begNbrs.length) return []
        const filt = data.filter(r =>
            selectedHighways.includes(r.TX_SIGNED_HIGHWAY_RDBD_ID) &&
            selectedCounties.includes(r.COUNTY) &&
            begNbrs.includes(String(r.TX_BEG_REF_MARKER_NBR))
        )
        const uniques = Array.from(new Set(filt.map(r => String(r.TX_BEG_REF_MRKR_DISP))))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data, selectedHighways, selectedCounties, begNbrs])

    const endNbrOptions = useMemo(() => {
        if (!begDisps.length) return []
        const filt = data.filter(r =>
            selectedHighways.includes(r.TX_SIGNED_HIGHWAY_RDBD_ID) &&
            selectedCounties.includes(r.COUNTY) &&
            begNbrs.includes(String(r.TX_BEG_REF_MARKER_NBR)) &&
            begDisps.includes(String(r.TX_BEG_REF_MRKR_DISP))
        )
        const uniques = Array.from(new Set(filt.map(r => String(r.TX_END_REF_MARKER_NBR))))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data, selectedHighways, selectedCounties, begNbrs, begDisps])

    const endDispOptions = useMemo(() => {
        if (!endNbrs.length) return []
        const filt = data.filter(r =>
            selectedHighways.includes(r.TX_SIGNED_HIGHWAY_RDBD_ID) &&
            selectedCounties.includes(r.COUNTY) &&
            begNbrs.includes(String(r.TX_BEG_REF_MARKER_NBR)) &&
            begDisps.includes(String(r.TX_BEG_REF_MRKR_DISP)) &&
            endNbrs.includes(String(r.TX_END_REF_MARKER_NBR))
        )
        const uniques = Array.from(new Set(filt.map(r => String(r.TX_END_REF_MARKER_DISP))))
        return uniques.map(v => ({ value: v, label: v }))
    }, [data, selectedHighways, selectedCounties, begNbrs, begDisps, endNbrs])

    // const displayedScores = useMemo(() => {
    //     if (!selectedHighways.length) return scores;
    //     return scores.filter(pt => selectedHighways.includes(pt.row.TX_SIGNED_HIGHWAY_RDBD_ID));
    // }, [scores, selectedHighways]);
    const displayedScores = useMemo(() => {
        return scores.filter(pt => {
            const r = pt.row
            if (selectedHighways.length && !selectedHighways.includes(r.TX_SIGNED_HIGHWAY_RDBD_ID))
                return false
            if (selectedCounties.length && !selectedCounties.includes(r.COUNTY))
                return false
            if (begNbrs.length && !begNbrs.includes(String(r.TX_BEG_REF_MARKER_NBR)))
                return false
            if (begDisps.length && !begDisps.includes(String(r.TX_BEG_REF_MRKR_DISP)))
                return false
            if (endNbrs.length && !endNbrs.includes(String(r.TX_END_REF_MARKER_NBR)))
                return false
            if (endDisps.length && !endDisps.includes(String(r.TX_END_REF_MARKER_DISP)))
                return false
            return true
        })
    }, [scores, selectedHighways, selectedCounties, begNbrs, begDisps, endNbrs, endDisps])
    const traces: Partial<Plotly.PlotData>[] = useMemo(() => {
        if (scores.length === 0) return [];
        // const detailCols = Object.keys(data[0] || {}).slice(0, 9);
        let detailCols = [
            ...selectedCols,
            ...Object.keys(data[0] || {})
                .filter(c => !selectedCols.includes(c)) // skip any already in selectedCols
                .slice(0, 9)
        ];
        if (displayedScores.length === 0) return [];
        if (displayMode === 'raw') {
            // const detailCols = Object.keys(data[0] || {}).slice(0, 9);
            const cats = Array.from(new Set(displayedScores.map(pt => pt.colorVal)));
            return cats.map(cat => {
                const pts = displayedScores.filter(pt => pt.colorVal === cat);
                return {
                    x: pts.map(p => p.PC1),
                    y: pts.map(p => p.PC2),
                    name: `${String(cat)} (${pts.length})`,
                    mode: 'markers',
                    type: 'scattergl',
                    line: { width: 1 },
                    marker: {
                        size: 6,
                        opacity: 0.8,
                        line: { width: 1, color: 'black' }
                    },
                    showlegend: true,
                    text: pts.map(pt => {
                        const lines: string[] = [];

                        lines.push(`PC1: ${pt.PC1}`);
                        lines.push(`PC2: ${pt.PC2}`);

                        // add your first 9 column details:
                        detailCols.forEach(col => {
                            lines.push(`${col}: ${pt.row[col]}`);
                        });

                        return lines.join('<br>');
                    }),

                    customdata: pts.map(p => p.row),
                    hoverinfo: 'text'
                };
            });
        }
        if (displayMode === 'raw-timeline') {
            setShapes([]);

            const yearCol = 'EFF_YEAR';  // your time field
            const groupCols = [
                'TX_SIGNED_HIGHWAY_RDBD_ID',
                colorCol,                    // your pavement‐type column
                'TX_BEG_REF_MARKER_NBR',
                'TX_BEG_REF_MRKR_DISP',
                'TX_END_REF_MARKER_NBR',
                'TX_END_REF_MARKER_DISP',
                'TX_LENGTH'
            ];

            // 0) track which counties we've already given a header for
            const seenCounties = new Set<string>();

            // 1) bucket all points into routes
            const byGroup = displayedScores.reduce((map, pt) => {
                const key = groupCols.map(c => pt.row[c]).join(' | ');
                if (!map.has(key)) map.set(key, []);
                map.get(key)!.push(pt);
                return map;
            }, new Map<string, typeof displayedScores>());
            const counties = Array.from(
                new Set(displayedScores.map(pt => pt.row.COUNTY))
            );

            // const counties = Array.from(new Set(displayedSelectedScores.map(pt => pt.row.COUNTY)));
            const numCounties = counties.length;
            const hueWidth = 360 / numCounties;
            const countyHueMap: Record<string, { start: number; end: number }> = {};
            counties.forEach((c, i) => {
                countyHueMap[c] = {
                    start: i * hueWidth,
                    end: (i + 1) * hueWidth
                };
            });

            // ─────────────────────────────────────────────────────────────────────────────
            //  Helper: HSL → HEX (unchanged)
            // ─────────────────────────────────────────────────────────────────────────────
            function hslToHex(h: number, s: number, l: number): string {
                l /= 100;
                const a = (s * Math.min(l, 1 - l)) / 100;
                const f = (n: number): string => {
                    const k = (n + h / 30) % 12;
                    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                    return Math.round(255 * color).toString(16).padStart(2, '0');
                };
                return `#${f(0)}${f(8)}${f(4)}`;
            }

            // ─────────────────────────────────────────────────────────────────────────────
            //  STEP 1: Build a nested map of “county → highway → [routeKey, …]”
            //             so that we know how many sections each highway has.
            // ─────────────────────────────────────────────────────────────────────────────
            type RoutesByCountyHighway = Record<string, Record<string, string[]>>;
            const routesByCountyHighway: RoutesByCountyHighway = {};

            byGroup.forEach((pts, routeKey) => {
                const row = pts[0].row;
                const county = row.COUNTY as string;
                const highway = row.TX_SIGNED_HIGHWAY_RDBD_ID as string;

                if (!routesByCountyHighway[county]) {
                    routesByCountyHighway[county] = {};
                }
                if (!routesByCountyHighway[county][highway]) {
                    routesByCountyHighway[county][highway] = [];
                }
                routesByCountyHighway[county][highway].push(routeKey);
            });

            // ─────────────────────────────────────────────────────────────────────────────
            //  STEP 2: For each county, subdivide its hue‐interval among that county’s highways.
            //  We’ll build “highwayHueMap” so that each (county+highway) has its own [h0,h1].
            // ─────────────────────────────────────────────────────────────────────────────
            type HueInterval = { start: number; end: number };
            const highwayHueMap: Record<string, HueInterval> = {};
            // key = `${county}–${highway}`

            // Loop over each county:
            counties.forEach((county) => {
                // 2a) grab ALL highways in this county
                const highways = Object.keys(routesByCountyHighway[county] || {});
                const numHighways = highways.length;

                if (numHighways === 0) return;

                // 2b) county’s hue interval:
                const { start: c0, end: c1 } = countyHueMap[county];
                const hueWidthHW = (c1 - c0) / numHighways;

                highways.forEach((hw, idx) => {
                    const start = c0 + idx * hueWidthHW;
                    const end = c0 + (idx + 1) * hueWidthHW;
                    highwayHueMap[`${county}–${hw}`] = { start, end };
                });
            });

            // ─────────────────────────────────────────────────────────────────────────────
            //  STEP 3: Build one trace per “section” (routeKey), varying lightness inside that highway’s hue.
            // ─────────────────────────────────────────────────────────────────────────────
            const seenGroups = new Set<string>();
            const tlTraces: Partial<Plotly.PlotData>[] = [];

            byGroup.forEach((pts, routeKey) => {
                const row = pts[0].row;
                const county = row.COUNTY as string;
                const highway = row.TX_SIGNED_HIGHWAY_RDBD_ID as string;
                const chKey = `${county}–${highway}`; // must match how we built highwayHueMap

                // 3a) Sort points by year (same as before)
                pts.sort((a, b) => a.row[yearCol] - b.row[yearCol]);

                // 3b) Figure out how many “sections” this highway has, and this section’s index:
                const sectionsOfThisHW = routesByCountyHighway[county]?.[highway] || [];
                const secIdx = sectionsOfThisHW.indexOf(routeKey);
                const secTotal = sectionsOfThisHW.length;

                // 3c) Grab this highway’s hue‐interval:
                const rangeHW = highwayHueMap[chKey];
                let hueMid: number;
                if (!rangeHW) {
                    // fallback to gray if somehow missing
                    hueMid = 0;
                } else {
                    // Pick the midpoint of [h0,h1] for this highway
                    hueMid = (rangeHW.start + rangeHW.end) / 2;
                }

                // 3d) Decide “lightness” for this section:
                //     e.g. baseLight = 50%, variation = 20% (so sections go from 50−20=30 up to 50+20=70)
                const baseLight = 50;
                const lightVar = 20;
                let lightForThisSec: number;
                if (secTotal <= 1) {
                    lightForThisSec = baseLight;
                } else {
                    // normalized t ∈ [0..1]
                    const t = secIdx / (secTotal - 1);
                    // shift to [−1..+1]:  (t−0.5)*2
                    const shift = (t - 0.5) * 2;
                    // now light = 50 + shift * 20  →  [30..70]
                    lightForThisSec = baseLight + shift * lightVar;
                }

                // 3e) Convert to hex:
                const routeColor = rangeHW
                    ? hslToHex(hueMid, 70, lightForThisSec)
                    : '#888888';

                // 3f) Only show the “legendgrouptitle” once per county–highway:
                const isFirstInGroup = !seenGroups.has(chKey);
                if (isFirstInGroup) seenGroups.add(chKey);

                // 3g) Extract x,y, symbols, sizes, hover‐text exactly as before:
                const xs = pts.map(p => p.PC1);
                const ys = pts.map(p => p.PC2);

                const symbols = pts.map((p, i) => {
                    if (i === 0) return 'circle';
                    const prev = pts[i - 1];
                    return (prev.PC1 === p.PC1 && prev.PC2 === p.PC2)
                        ? 'circle-open'
                        : 'circle';
                });
                const sizes = pts.map((p, i) => {
                    if (i === 0) return 6;
                    const prev = pts[i - 1];
                    return (prev.PC1 === p.PC1 && prev.PC2 === p.PC2) ? 12 : 6;
                });

                const hoverTexts = pts.map((p, i) => {
                    const lines = [
                        `Year: ${p.row[yearCol]}`,
                        `PC1:  ${p.PC1.toFixed(3)}`,
                        `PC2:  ${p.PC2.toFixed(3)}`,
                        ...detailCols.map(col => `${col}: ${p.row[col]}`)
                    ];
                    const loopers: number[] = [];
                    for (let j = i - 1; j >= 0; j--) {
                        if (pts[j].PC1 === p.PC1 && pts[j].PC2 === p.PC2) {
                            loopers.push(pts[j].row[yearCol]);
                        } else break;
                    }
                    if (loopers.length) {
                        lines.push(`(looped from ${loopers.join(', ')})`);
                    }
                    return lines.join('<br>');
                });

                // 3h) Build a concise trace name (you can adjust the formatting however you like):
                // const name = `${county}–${highway} | Section ${secIdx + 1} of ${secTotal}`;
                // const name = `${county} – ${highway} | ` +
                const name = `${row.TX_BEG_REF_MARKER_NBR + row.TX_BEG_REF_MRKR_DISP}` +
                    `–${row.TX_END_REF_MARKER_NBR + row.TX_END_REF_MARKER_DISP}` +
                    ` | ${row.DETAILED_PAV_TYPE}`;

                // 3i) Push the Plotly trace
                tlTraces.push({
                    x: xs,
                    y: ys,
                    mode: 'lines+markers',
                    type: 'scattergl',
                    name,
                    legendgroup: chKey,
                    legendgrouptitle: isFirstInGroup ? { text: chKey } : undefined,
                    showlegend: true,
                    line: { width: 1, color: routeColor },
                    marker: {
                        size: sizes,
                        opacity: 0.8,
                        symbol: symbols,
                        color: routeColor,
                        line: { width: 1, color: 'black' }
                    },
                    customdata: pts.map(p => p.row),
                    text: hoverTexts,
                    hoverinfo: 'text',
                });
            });

            return tlTraces;



        }

        if (displayMode === 'grouped') {
            // 1) group by category
            // const byCat = scores.reduce((m, pt) => {
            const byCat = displayedScores.reduce((m, pt) => {
                const cat = pt.colorVal == null ? 'undefined' : String(pt.colorVal);
                if (!m.has(cat)) m.set(cat, []);
                m.get(cat)!.push(pt);
                return m;
                // }, new Map<string, typeof scores>());
                // type Cluster = { x: number, y: number, records: typeof scores };
            }, new Map<string, typeof displayedScores>());
            type Cluster = { x: number, y: number, records: typeof displayedScores };

            const clustersByCat = Array.from(byCat.entries()).map(([category, pts]) => {
                // map-of-(rounded-loc) → Cluster
                const gm = new Map<string, Cluster>();
                pts.forEach(p => {
                    const key = `${p.PC1.toFixed(2)}_${p.PC2.toFixed(2)}`;
                    if (!gm.has(key)) {
                        gm.set(key, { x: p.PC1, y: p.PC2, records: [] });
                    }
                    gm.get(key)!.records.push(p);
                });
                return { category, clusters: Array.from(gm.values()) };
            });


            // 2) for each category, bucket by (rounded) PC1/PC2 & compute counts
            return clustersByCat.map(({ category, clusters }) => {
                // total points and unique bubbles
                const total = clusters.reduce((sum, c) => sum + c.records.length, 0);
                const unique = clusters.length;
                // for each bubble, build one HTML string
                const hoverText = clusters.map(c => {
                    const lines = [
                        `<b>${category}</b>`,
                        `Count: ${c.records.length}`,
                        `PC1: ${c.x.toFixed(3)}`,
                        `PC2: ${c.y.toFixed(3)}`
                    ];

                    const maxShow = 3;
                    const toShow = c.records.slice(0, maxShow);
                    toShow.forEach((r, idx) => {
                        lines.push(`<u>Record ${idx + 1}</u>`);
                        detailCols.forEach(col => {
                            lines.push(`${col}: ${r.row[col]}`);
                        });
                    });
                    // if there are more than 5, note how many you hid
                    if (c.records.length > maxShow) {
                        lines.push(`… and ${c.records.length - maxShow} more records`);
                    }

                    return lines.join('<br>');
                });


                return {
                    x: clusters.map(c => c.x),
                    y: clusters.map(c => c.y),
                    mode: 'markers',
                    type: 'scattergl' as const,
                    name: `${category} (${total}→${unique})`,
                    marker: {
                        size: clusters.map(c => Math.log10(c.records.length + 1) * 20),
                        opacity: 0.6,
                        // … colour logic …
                    },
                    customdata: clusters.map(c => c.records.map(r => r.row)),
                    text: hoverText,          // one HTML string per point
                    hoverinfo: 'text',        // show only our custom text
                    hoverlabel: { align: 'left' }  // optional: left‐align the tooltip
                };
            });

        }
        return [];

    }, [scores, displayedScores, colorCol, displayMode]);


    const flatRows = Array.isArray(selectedRows[0])
        ? (selectedRows[0] as any[])
        : selectedRows;
    const formatCountyName = (county?: string): string => {
        if (!county) return "";
        const withoutPrefix = county.replace(/^\d+\s*-\s*/, "");
        return withoutPrefix.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
    };

    const normalizeCounty = (v: unknown) =>
        formatCountyName(
            String(v ?? "")
                .normalize("NFKC")
                .replace(/\u00A0/g, " ") // NBSP → space
                .trim()
        )
            .replace(/\s+/g, "")
            .toUpperCase();

    const normalizeHighway = (v: unknown) =>
        String(v ?? "")
            .normalize("NFKC")
            .replace(/\u00A0/g, " ")
            .replace(/\s+/g, "")
            .toUpperCase();

    // Build (highway||county) set directly from flat rows
    const selectedHiCo = React.useMemo(() => {
        const s = new Set<string>();
        selectedRows.forEach((r: any) => {
            const hw = normalizeHighway(r?.TX_SIGNED_HIGHWAY_RDBD_ID);
            const co = normalizeCounty(r?.COUNTY);
            if (hw && co) s.add(`${hw}||${co}`);
        });
        return s;
    }, [selectedRows]);

    const filteredData = React.useMemo(() => {
        if (!selectedHiCo.size) return [];
        return (data ?? []).filter((r) => {
            const hw = normalizeHighway(r?.TX_SIGNED_HIGHWAY_RDBD_ID);
            const co = normalizeCounty(r?.COUNTY);
            return selectedHiCo.has(`${hw}||${co}`);
        });
    }, [data, selectedHiCo]);


    const selectedHiCos = useMemo(() => {
        if (!selectedRows.length) return new Set<string>();
        const rows: any[] = Array.isArray(selectedRows[0]) ? (selectedRows as any[]).flat() : (selectedRows as any[]);
        const s = new Set<string>();
        rows.forEach(r => {
            const hw = r?.TX_SIGNED_HIGHWAY_RDBD_ID;
            const co = r?.COUNTY;
            if (hw && co) s.add(`${hw}||${co}`);
        });
        return s;
    }, [selectedRows]);
    const selectedTraces = useMemo<Partial<Plotly.PlotData>[]>(() => {
        if (!selectedRows.length || scores.length === 0) return [];

        // If you want to respect the left-side filters, use `displayedScores` here instead of `scores`.
        const base = scores; // or: const base = displayedScores;

        // Take ALL points that share any (highway, county) in the selection
        const ptsForSecondPlot = base.filter(pt =>
            selectedHiCos.has(`${pt.row.TX_SIGNED_HIGHWAY_RDBD_ID}||${pt.row.COUNTY}`)
        );
        if (ptsForSecondPlot.length === 0) return [];

        let detailCols = [
            ...selectedCols,
            ...Object.keys(data[0] || {}).filter(c => !selectedCols.includes(c)).slice(0, 9)
        ];
        const yearCol = 'EFF_YEAR';
        const groupCols = [
            'TX_SIGNED_HIGHWAY_RDBD_ID',
            colorCol,
            'TX_BEG_REF_MARKER_NBR',
            'TX_BEG_REF_MRKR_DISP',
            'TX_END_REF_MARKER_NBR',
            'TX_END_REF_MARKER_DISP',
            'TX_LENGTH'
        ];

        // ↓↓↓ Everything below is the same logic you already have, just use ptsForSecondPlot
        const byGroup = ptsForSecondPlot.reduce((map, pt) => {
            const key = groupCols.map(c => pt.row[c]).join(' | ');
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(pt);
            return map;
        }, new Map<string, typeof ptsForSecondPlot>());

        const counties = Array.from(new Set(ptsForSecondPlot.map(pt => pt.row.COUNTY)));
        const numCounties = counties.length;
        const hueWidth = 360 / Math.max(1, numCounties);
        const countyHueMap: Record<string, { start: number; end: number }> = {};
        counties.forEach((c, i) => {
            countyHueMap[c] = { start: i * hueWidth, end: (i + 1) * hueWidth };
        });

        function hslToHex(h: number, s: number, l: number): string {
            l /= 100;
            const a = (s * Math.min(l, 1 - l)) / 100;
            const f = (n: number): string => {
                const k = (n + h / 30) % 12;
                const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
                return Math.round(255 * color).toString(16).padStart(2, '0');
            };
            return `#${f(0)}${f(8)}${f(4)}`;
        }

        type RoutesByCountyHighway = Record<string, Record<string, string[]>>;
        const routesByCountyHighway: RoutesByCountyHighway = {};
        byGroup.forEach((pts, routeKey) => {
            const row = pts[0].row;
            const county = row.COUNTY as string;
            const highway = row.TX_SIGNED_HIGHWAY_RDBD_ID as string;
            (routesByCountyHighway[county] ??= {});
            (routesByCountyHighway[county][highway] ??= []).push(routeKey);
        });

        type HueInterval = { start: number; end: number };
        const highwayHueMap: Record<string, HueInterval> = {};
        counties.forEach((county) => {
            const highways = Object.keys(routesByCountyHighway[county] || {});
            const n = Math.max(1, highways.length);
            const { start: c0, end: c1 } = countyHueMap[county];
            const w = (c1 - c0) / n;
            highways.forEach((hw, idx) => {
                highwayHueMap[`${county}–${hw}`] = { start: c0 + idx * w, end: c0 + (idx + 1) * w };
            });
        });

        const seenGroups = new Set<string>();
        const tlTraces: Partial<Plotly.PlotData>[] = [];

        byGroup.forEach((pts, routeKey) => {
            const row = pts[0].row;
            const county = row.COUNTY as string;
            const highway = row.TX_SIGNED_HIGHWAY_RDBD_ID as string;
            const chKey = `${county}–${highway}`;

            pts.sort((a, b) => a.row[yearCol] - b.row[yearCol]);

            const sections = routesByCountyHighway[county]?.[highway] || [];
            const secIdx = sections.indexOf(routeKey);
            const secTotal = Math.max(1, sections.length);

            const rangeHW = highwayHueMap[chKey];
            const hueMid = rangeHW ? (rangeHW.start + rangeHW.end) / 2 : 0;

            const baseLight = 50, lightVar = 20;
            const t = secTotal <= 1 ? 0.5 : secIdx / (secTotal - 1);
            const light = baseLight + (t - 0.5) * 2 * lightVar;

            const routeColor = rangeHW ? hslToHex(hueMid, 70, light) : '#888888';
            const isFirstInGroup = !seenGroups.has(chKey);
            if (isFirstInGroup) seenGroups.add(chKey);

            const xs = pts.map(p => p.PC1);
            const ys = pts.map(p => p.PC2);
            const symbols = pts.map((p, i) => (i && pts[i - 1].PC1 === p.PC1 && pts[i - 1].PC2 === p.PC2) ? 'circle-open' : 'circle');
            const sizes = pts.map((p, i) => (i && pts[i - 1].PC1 === p.PC1 && pts[i - 1].PC2 === p.PC2) ? 12 : 6);

            const hoverTexts = pts.map((p, i) => {
                const lines = [
                    `Year: ${p.row[yearCol]}`,
                    `PC1:  ${p.PC1.toFixed(3)}`,
                    `PC2:  ${p.PC2.toFixed(3)}`,
                    ...detailCols.map(col => `${col}: ${p.row[col]}`)
                ];
                const loopers: number[] = [];
                for (let j = i - 1; j >= 0; j--) {
                    if (pts[j].PC1 === p.PC1 && pts[j].PC2 === p.PC2) loopers.push(pts[j].row[yearCol]); else break;
                }
                if (loopers.length) lines.push(`(looped from ${loopers.join(', ')})`);
                return lines.join('<br>');
            });

            const name =
                `${row.TX_BEG_REF_MARKER_NBR + row.TX_BEG_REF_MRKR_DISP}` +
                `–${row.TX_END_REF_MARKER_NBR + row.TX_END_REF_MARKER_DISP}` +
                ` | ${row.DETAILED_PAV_TYPE}`;

            tlTraces.push({
                x: xs, y: ys,
                mode: 'lines+markers',
                type: 'scattergl',
                name,
                legendgroup: chKey,
                legendgrouptitle: isFirstInGroup ? { text: chKey } : undefined,
                showlegend: true,
                line: { width: 1, color: routeColor },
                marker: { size: sizes, opacity: 0.8, symbol: symbols, color: routeColor, line: { width: 1, color: 'black' } },
                customdata: pts.map(p => p.row),
                text: hoverTexts,
                hoverinfo: 'text',
            });
        });

        return tlTraces;
    }, [selectedRows, scores, displayedScores, selectedHiCos, selectedCols, data, colorCol]);

    // 2) Generate PCA on button click
    const handleGenerate = () => {
        setLoading(true)
        try {
            // first, exclude any row where any selectedCol is null/empty
            const realFull = data.filter(r =>
                selectedCols.every(c =>
                    r[c] != null &&  // filters out null & undefined
                    r[c] !== ""         // filters out empty strings
                )
            );
            const keptIdx: number[] = [];
            const matrix = realFull
                .map((r, idx) => {
                    // parse each selected column
                    const rowVals = selectedCols.map(c => {
                        const v = parseFloat(r[c]);
                        return Number.isNaN(v) ? NaN : v;
                    });
                    // if all parsed OK, remember this index and return the numeric row
                    if (rowVals.every(v => !Number.isNaN(v))) {
                        keptIdx.push(idx);
                        return rowVals;
                    }
                    // otherwise drop by returning null
                    return null;
                })
                .filter((v): v is number[] => v !== null);

            if (matrix.length < 2) {
                setLoading(false);
                return;
            }

            const pca = new PCA(matrix, { center: true, scale: true })
            const comps = pca.predict(matrix, { nComponents: 2 }).to2DArray()

            // build scores with color
            const scored = comps.map((_, i) => {
                const realIdx = keptIdx[i];
                const row = realFull[realIdx];
                return {
                    PC1: comps[i][0],
                    PC2: comps[i][1],
                    colorVal: colorCol ? (row as any)[colorCol] : null,
                    row
                };
            });
            // const scored = comps.map((_, i) => ({
            //     PC1: comps[i][0],
            //     PC2: comps[i][1],
            //     colorVal: colorCol ? realFull[i][colorCol] : null,
            //     row: realFull[i]
            // }))
            setScores(scored)

            // build loadings
            const rawLoad = pca.getLoadings().to2DArray()
            const ld: any[] = []
            selectedCols.forEach((col, i) => {
                ld.push({ variable: col, PC: 'PC1', loading: rawLoad[i][0] })
                ld.push({ variable: col, PC: 'PC2', loading: rawLoad[i][1] })
            })
            setLoadings(ld)

        } finally {
            setLoading(false)
        }
    }



    // Load PMIS CSV into features
    // ─── Load PMIS features via simple fetch ───────────────────────


    // Add or update a heatmap entry
    const addOrUpdateHeatMap = useCallback((chart: { highway: string; county: string; field: string }) => {
        const label = chart.field.replace(/^TX_/, '').split('_').map(w => w[0] + w.slice(1).toLowerCase()).join(' ')
        const scoreObj = { value: chart.field, label }
        setActiveHeatMapData(prev => {
            const idx = prev.findIndex(x => x.highway === chart.highway && x.county === chart.county)
            if (idx >= 0) {
                const copy = [...prev]
                if (!copy[idx].scores.find((s: any) => s.value === chart.field))
                    copy[idx].scores.push(scoreObj)
                return copy
            }
            return [...prev, { id: nextId(), highway: chart.highway, county: chart.county, scores: [scoreObj] }]
        })
    }, [])

    // Remove a score or entire heatmap
    const removeScore = useCallback((id: string, value: string) => {
        setActiveHeatMapData(prev => prev
            .map(x => x.id === id ? { ...x, scores: x.scores.filter((s: any) => s.value !== value) } : x)
            .filter(x => x.scores.length > 0)
        )
    }, [])

    const addAllMetricsFor = useCallback((highway: string, county: string) => {
        setHmHighway(highway);
        setHmCounty(county);
        // setActiveHeatMapData([]);
        console.log(`Adding metrics for ${highway} in`, county);

        METRIC_FIELDS.forEach(field => {
            addOrUpdateHeatMap({ highway, county, field });
            const scoreType = fieldToScoreType[field as keyof typeof fieldToScoreType]
            if (scoreType) setScoreGauges((prev) => ({ ...prev, [scoreType]: 0 }))
        });
    }, [addOrUpdateHeatMap]);

    // useEffect(() => {
    //   // inputs changed; the current loadings/scores are stale until next Generate
    //   setLoadings([]);
    //   // optional: setScores([]);
    // }, [selectedCols]);

    // helper: always return an array of row objects for each clicked point
    const toRowArray = (cd: any) => (Array.isArray(cd) ? cd : [cd]).filter(Boolean);

    // grab unique (highway, county) pairs from selected rows
    const getUniquePairs = (rows: any[]) => {
        const seen = new Set<string>();
        const pairs: { highway: string; county: string }[] = [];

        for (const r of rows) {
            const { highway, county } = getHiCoFromRow(r) || {};
            if (!highway || !county) continue;
            const key = `${highway}__${county}`;
            if (!seen.has(key)) {
                seen.add(key);
                pairs.push({ highway, county });
            }
        }
        return pairs;
    };

    // common handler for click or lasso select
    const handleFromPlot = (e: any) => {
        setActiveHeatMapData([]);
        setScoreGauges({});

        const rows = e.points.flatMap((pt: any) => toRowArray(pt.customdata));
        if (!rows.length) return;

        setSelectedRows(rows);

        const pairs = getUniquePairs(rows);
        if (!pairs.length) return;

        // If addAllMetricsFor is async, use for..of + await.
        // Otherwise, this forEach is fine.
        pairs.forEach(({ highway, county }) => {
            addAllMetricsFor(highway, county);
        });
    };

    // wire both events to the same logic
    const handlePlotClick = handleFromPlot;
    const handlePlotSelect = handleFromPlot;

    useEffect(() => {
        if (data.length && selectedCols.length && !scores.length) {
            handleGenerate();
        }
    }, [data.length, selectedCols.join(','), scores.length]);

    return (
        <div className="flex flex-col h-screen overflow-auto">
            <div className="p-6">
                <h1 className="text-3xl font-bold mb-8">Principal Component Analysis Explorer</h1>

                {/* Analysis Inputs Panel */}
                <section className="bg-white border border-gray-200 rounded-lg p-4 shadow-sm max-w-7xl mx-auto mb-8">
                    <h2 className="text-lg font-medium text-gray-900 mb-4">Analysis Inputs</h2>

                    <div className="grid grid-cols-12 gap-4 items-end">
                        {/* PCA Inputs: span 12 on xs, 6 on sm+ */}
                        <div className="col-span-12 sm:col-span-8">
                            <label htmlFor="pca-inputs" className="block text-sm font-medium text-gray-700 mb-1">
                                PCA Inputs
                            </label>
                            <Select
                                id="pca-inputs"
                                isMulti
                                options={numericCols.map(c => ({ value: c, label: c }))}
                                value={selectedCols.map(c => ({ value: c, label: c }))}
                                onChange={nv => {
                                    const opts = Array.isArray(nv) ? nv : []
                                    setSelectedCols(opts.map(o => o.value))
                                }}
                                closeMenuOnSelect={false}
                                hideSelectedOptions={false}
                                components={{ Option, MenuList }}
                                className="basic-multi-select w-full"
                                placeholder="Select PCA inputs…"
                            />
                        </div>

                        {/* Color by: span 12 → 4 */}
                        <div className="col-span-12 sm:col-span-2">
                            <label htmlFor="color-by" className="block text-sm font-medium text-gray-700 mb-1">
                                Color by
                            </label>
                            <Select
                                id="color-by"
                                isClearable
                                options={columnOptions}
                                value={colorCol ? { value: colorCol, label: colorCol } : null}
                                onChange={opt => setColorCol((opt as any)?.value || '')}
                                className="basic-single w-full"
                                placeholder="Select a column…"
                            />
                        </div>

                        {/* Button: span 12 → 2 */}
                        <div className="col-span-12 sm:col-span-2 flex sm:justify-end">
                            <button
                                onClick={handleGenerate}
                                disabled={isLoading}
                                className={`
          w-full sm:w-auto
          px-4 py-2
          ${isLoading ? 'bg-gray-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'}
          text-white text-sm font-medium
          rounded-lg shadow-sm
          transition
        `}
                            >
                                {isLoading ? 'Computing…' : 'Generate Plot'}
                            </button>
                        </div>
                    </div>
                </section>


                <section className="bg-white border border-gray-200 rounded-lg p-6 shadow-sm max-w-7xl mx-auto mb-8">
                    <h2 className="text-xl font-semibold text-gray-800 mb-6">Settings</h2>

                    <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">
                        {/** Plot Style **/}
                        {/* <div>
                            <h3 className="text-lg font-medium text-gray-700 mb-4">Plot Style</h3>
                            <div className="space-y-4">
                                <Select
                                    options={displayModeOptions}
                                    value={displayModeOptions.find(o => o.value === displayMode)}
                                    onChange={o => setDisplayMode((o as any).value)}
                                    className="basic-single"
                                    placeholder="Display mode…"
                                />
                            </div>
                        </div> */}

                        {/** Data Filters **/}
                        <div>
                            <h3 className="text-lg font-medium text-gray-700 mb-4">Data Filters</h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <Select
                                    isMulti
                                    options={highwayOptions}
                                    value={highwayOptions.filter(o => selectedHighways.includes(o.value))}
                                    onChange={val => {
                                        const arr = Array.isArray(val) ? val : []
                                        setSelectedHighways(arr.map(o => o.value))
                                        setSelectedCounties([])
                                        setBegNbrs([]); setBegDisps([]); setEndNbrs([]); setEndDisps([])
                                    }}
                                    components={{ Option, MenuList }}
                                    placeholder="Highway…"
                                    className="basic-multi-select"
                                />

                                <Select
                                    isMulti
                                    options={countyOptions}
                                    isDisabled={!selectedHighways.length}
                                    value={countyOptions.filter(o => selectedCounties.includes(o.value))}
                                    onChange={val => {
                                        const arr = Array.isArray(val) ? val : []
                                        setSelectedCounties(arr.map(o => o.value))
                                        setBegNbrs([]); setBegDisps([]); setEndNbrs([]); setEndDisps([])
                                    }}
                                    components={{ Option, MenuList }}
                                    placeholder="County…"
                                    className="basic-multi-select"
                                />

                                <Select
                                    isMulti
                                    options={begNbrOptions}
                                    isDisabled={!selectedCounties.length}
                                    value={begNbrOptions.filter(o => begNbrs.includes(o.value))}
                                    onChange={val => {
                                        const arr = Array.isArray(val) ? val : []
                                        setBegNbrs(arr.map(o => o.value))
                                        setBegDisps([]); setEndNbrs([]); setEndDisps([])
                                    }}
                                    placeholder="Begin Marker #…"
                                    className="basic-multi-select"
                                />

                                <Select
                                    isMulti
                                    options={begDispOptions}
                                    isDisabled={!begNbrs.length}
                                    value={begDispOptions.filter(o => begDisps.includes(o.value))}
                                    onChange={val => {
                                        const arr = Array.isArray(val) ? val : []
                                        setBegDisps(arr.map(o => o.value))
                                        setEndNbrs([]); setEndDisps([])
                                    }}
                                    placeholder="Begin Disp…"
                                    className="basic-multi-select"
                                />

                                <Select
                                    isMulti
                                    options={endNbrOptions}
                                    isDisabled={!begDisps.length}
                                    value={endNbrOptions.filter(o => endNbrs.includes(o.value))}
                                    onChange={val => {
                                        const arr = Array.isArray(val) ? val : []
                                        setEndNbrs(arr.map(o => o.value))
                                        setEndDisps([])
                                    }}
                                    placeholder="End Marker #…"
                                    className="basic-multi-select"
                                />

                                <Select
                                    isMulti
                                    options={endDispOptions}
                                    isDisabled={!endNbrs.length}
                                    value={endDispOptions.filter(o => endDisps.includes(o.value))}
                                    onChange={val => {
                                        const arr = Array.isArray(val) ? val : []
                                        setEndDisps(arr.map(o => o.value))
                                    }}
                                    placeholder="End Disp…"
                                    className="basic-multi-select"
                                />
                            </div>
                        </div>
                    </div>
                </section>

            </div>




            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-grow p-4 bg-gray-100">

                {/* Scatter plot */}
                {traces.length > 0 && (
                    <div className="md:col-span-3 h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white">
                        <div className="w-full" style={{ minHeight: '400px' }}>
                            <Plot
                                data={traces}
                                layout={{
                                    // title: 'PC1 vs PC2 (grouped bubbles)',
                                    xaxis: { title: 'PC1' },
                                    yaxis: { title: 'PC2' },
                                    autosize: true,
                                    margin: { t: 40, b: 60, l: 60, r: 150 },
                                    paper_bgcolor: 'white', plot_bgcolor: 'rgba(0,0,0,0)',
                                    hovermode: 'closest',
                                    // hovermode: 'x unified',    // or 'y unified'
                                    // hoverlabel: { align: 'left' },
                                    clickmode: 'event+select',
                                    shapes: shapes,
                                    legend: {
                                        orientation: 'v',
                                        traceorder: 'grouped',
                                        groupclick: 'toggleitem',
                                        x: 1.02,        // 100% of plot width + a little
                                        xanchor: 'left',
                                        y: 1,
                                        yanchor: 'top'
                                    },
                                    modebar: {
                                        orientation: 'v', // Set the modebar orientation to vertical
                                    },
                                    annotations: [],
                                }}
                                onClick={handlePlotClick}
                                onSelected={handlePlotSelect}
                                // onClick={(e) => {
                                //     // e.points is an array of all points under your click
                                //     const rows = e.points.map(pt => pt.customdata as any);
                                //     setSelectedRows(rows);
                                //     if (rows[0]) {
                                //         const { highway, county } = getHiCoFromRow(rows[0][0]);
                                //         console.log('Clicked on:', { highway, county });
                                //         if (highway && county) addAllMetricsFor(highway, county);
                                //     }
                                // }}
                                // onSelected={(e) => {
                                //     // box‐ or lasso‐select
                                //     const rows = e.points.map(pt => pt.customdata as any);
                                //     setSelectedRows(rows);
                                //     if (rows[0]) {
                                //         const { highway, county } = getHiCoFromRow(rows[0][0]);
                                //         if (highway && county) addAllMetricsFor(highway, county);
                                //     }
                                // }}
                                config={{ displayModeBar: true, responsive: true }}
                                style={{ width: '100%', height: 500 }}
                            />
                        </div>
                    </div>
                )
                }



                {/* Loadings line chart */}
                {traces.length > 0 && (() => {
                    // keep only columns that exist in the current loadings
                    const colsWithLoadings = selectedCols.filter(col =>
                        loadings.some(l => l.variable === col && (l.PC === 'PC1' || l.PC === 'PC2'))
                    );

                    // map to coords, skipping any incomplete pair
                    const coords = colsWithLoadings.map(col => {
                        const p1 = loadings.find(l => l.variable === col && l.PC === 'PC1');
                        const p2 = loadings.find(l => l.variable === col && l.PC === 'PC2');
                        if (!p1 || !p2) return null;
                        const pc1 = p1.loading ?? 0;
                        const pc2 = p2.loading ?? 0;
                        return { col, pc1, pc2, len: Math.hypot(pc1, pc2) };
                    }).filter(Boolean) as { col: string; pc1: number; pc2: number; len: number }[];

                    if (coords.length === 0) {
                        // Optional: render a small note instead of the chart
                        return (
                            <div className="md:col-span-1 h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white flex items-center justify-center p-4 text-sm text-gray-600">
                                PCA inputs changed — click “Generate Plot” to refresh loadings.
                            </div>
                        );
                    }

                    const maxLen = Math.max(...coords.map(c => c.len)) || 1; // avoid divide-by-zero
                    const scale = 0.8 / maxLen;
                    const span = maxLen * scale * 1.5;
                    const range: [number, number] = [-span, span];

                    const arrowAnns = coords.map(({ pc1, pc2 }) => ({
                        ax: 0, ay: 0,
                        x: pc1 * scale,
                        y: pc2 * scale,
                        xref: 'x', yref: 'y', axref: 'x', ayref: 'y',
                        showarrow: true, arrowhead: 3, arrowcolor: 'rgba(0,0,0,0.6)',
                        arrowsize: 1.2, arrowwidth: 1.5, text: ''
                    }));

                    const labelAnns = coords.map(({ col, pc1, pc2 }) => {
                        const xTip = pc1 * scale;
                        const yTip = pc2 * scale;
                        return {
                            x: xTip * 0.2,
                            y: yTip * 1,
                            xref: 'x' as const, yref: 'y' as const,
                            showarrow: false,
                            text: col,
                            xanchor: xTip >= 0 ? 'left' : 'right',
                            yanchor: yTip >= 0 ? 'bottom' : 'top',
                            font: { size: 12 }
                        };
                    });

                    return (
                        <div className="md:col-span-1 h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white">
                            <div className="w-full" style={{ minHeight: '400px' }}>
                                <Plot
                                    data={[]}
                                    layout={{
                                        xaxis: { title: 'PC1', range, zeroline: true },
                                        yaxis: { title: 'PC2', range, zeroline: true },
                                        annotations: [
                                            ...arrowAnns as Partial<Plotly.Annotations>[],
                                            ...labelAnns as Partial<Plotly.Annotations>[],
                                        ],
                                        margin: { t: 40, b: 60, l: 60, r: 60 },
                                        autosize: true,
                                    }}
                                    config={{ displayModeBar: true, responsive: true }}
                                    style={{ width: '100%', height: 500 }}
                                />
                            </div>
                        </div>
                    );
                })()}


            </div>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4 flex-grow p-4 bg-gray-100">
                <div className="md:col-span-3 h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white">


                    {/* Scatter plot */}
                    {selectedTraces.length > 0 && (
                        <div className="bg-white border rounded-lg p-4 shadow-sm max-w-7xl w-full mx-auto mt-4">
                            <div className="w-full" style={{ minHeight: '400px' }}>
                                <Plot
                                    data={selectedTraces}
                                    // data={overlappingTraces}
                                    layout={{
                                        title: 'PC1 vs PC2 (grouped bubbles)',
                                        xaxis: { title: 'PC1' },
                                        yaxis: { title: 'PC2' },
                                        autosize: true,
                                        margin: { t: 40, b: 40, l: 60, r: 40 },
                                        paper_bgcolor: 'white', plot_bgcolor: 'rgba(0,0,0,0)',
                                        hovermode: 'closest',
                                        // hovermode: 'x unified',    // or 'y unified'
                                        // hoverlabel: { align: 'left' },
                                        shapes: shapes,
                                        legend: {
                                            orientation: 'v',
                                            traceorder: 'grouped',
                                            groupclick: 'toggleitem'
                                        },
                                        modebar: {
                                            orientation: 'v', // Set the modebar orientation to vertical
                                        },

                                        annotations: [],
                                    }}
                                    onClick={e => {
                                        const rowsOfArrays = e.points.map(pt => pt.customdata);
                                        setSelectedRows(rowsOfArrays);
                                    }}
                                    onSelected={e => {
                                        const rowsOfArrays = e.points.map(pt => pt.customdata);
                                        setSelectedRows(rowsOfArrays);
                                    }}
                                    config={{ displayModeBar: true, responsive: true }}
                                    style={{ width: '100%', height: 500 }}
                                />
                            </div>
                        </div>
                    )
                    }


                    <div className="bg-white border rounded-lg p-4 shadow-sm max-w-7xl w-full mx-auto mt-4">
                        <h3 className="font-semibold mb-3">Rows in selected Highway & County</h3>
                        <PCADataTable allData={filteredData} selectedRows={selectedRows} pageSize={20} />
                    </div>


                </div>
                <div className="md:col-span-2 h-full overflow-hidden rounded-lg shadow-md border border-gray-200 bg-white">

                    {/* Right: Heatmap Panel */}
                    <div className="flex flex-col h-full bg-white shadow rounded-lg">
                        <div className="px-5 py-3 bg-gradient-to-r from-blue-800 to-blue-700 text-white font-bold">
                            PMIS Heat Maps
                        </div>
                        <section className="p-4">
                            <div className="mb-3">
                                <h3 className="text-base font-semibold">Heatmap Inputs</h3>
                            </div>

                            {/* 2 rows, 3 cols each */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {/* Row 1 (3 selects) */}
                                <div>
                                    <Select
                                        options={hmhighwayOptions}
                                        value={hmhighwayOptions.find(o => o.value === hmHighway) || null}
                                        onChange={o => setHmHighway((o as any)?.value || "")}
                                        placeholder="Highway…"
                                        className="w-full"
                                        classNamePrefix="react-select"
                                        styles={{
                                            control: (base: any, state: any) => ({
                                                ...base,
                                                minHeight: 44,
                                                borderRadius: 12,
                                                backgroundColor: state.isDisabled ? "#F3F4F6" : "#FFFFFF",
                                                borderColor: state.isFocused ? "#3B82F6" : "#E5E7EB",
                                                boxShadow: state.isFocused ? "0 0 0 1px #3B82F6" : "none",
                                                transition: "border-color .15s ease",
                                                ":hover": { borderColor: state.isFocused ? "#3B82F6" : "#D1D5DB" },
                                            }),
                                            placeholder: (b: any) => ({ ...b, color: "#6B7280" }),
                                            menu: (b: any) => ({ ...b, zIndex: 40 }),
                                        }}
                                    />
                                </div>

                                <div>
                                    <Select
                                        options={hmcountyOptions}
                                        isDisabled={!hmHighway}
                                        value={hmcountyOptions.find(o => o.value === hmCounty) || null}
                                        onChange={o => setHmCounty((o as any)?.value || "")}
                                        placeholder="County…"
                                        className="w-full"
                                        classNamePrefix="react-select"
                                        styles={{
                                            control: (base: any, state: any) => ({
                                                ...base,
                                                minHeight: 44,
                                                borderRadius: 12,
                                                backgroundColor: state.isDisabled ? "#F3F4F6" : "#FFFFFF",
                                                borderColor: state.isFocused ? "#3B82F6" : "#E5E7EB",
                                                boxShadow: state.isFocused ? "0 0 0 1px #3B82F6" : "none",
                                                transition: "border-color .15s ease",
                                                ":hover": { borderColor: state.isFocused ? "#3B82F6" : "#D1D5DB" },
                                            }),
                                            placeholder: (b: any) => ({ ...b, color: "#6B7280" }),
                                            menu: (b: any) => ({ ...b, zIndex: 40 }),
                                        }}
                                    />
                                </div>

                                <div>
                                    <Select
                                        options={Object.keys(fieldToScoreType).map(f => ({ value: f, label: fieldToScoreType[f] }))}
                                        value={hmField ? { value: hmField, label: fieldToScoreType[hmField] } : null}
                                        onChange={o => setHmField((o as any)?.value || "")}
                                        placeholder="Metric…"
                                        className="w-full"
                                        classNamePrefix="react-select"
                                        styles={{
                                            control: (base: any, state: any) => ({
                                                ...base,
                                                minHeight: 44,
                                                borderRadius: 12,
                                                backgroundColor: state.isDisabled ? "#F3F4F6" : "#FFFFFF",
                                                borderColor: state.isFocused ? "#3B82F6" : "#E5E7EB",
                                                boxShadow: state.isFocused ? "0 0 0 1px #3B82F6" : "none",
                                                transition: "border-color .15s ease",
                                                ":hover": { borderColor: state.isFocused ? "#3B82F6" : "#D1D5DB" },
                                            }),
                                            placeholder: (b: any) => ({ ...b, color: "#6B7280" }),
                                            menu: (b: any) => ({ ...b, zIndex: 40 }),
                                        }}
                                    />
                                </div>

                                {/* Row 2 (actions, right side in cols 2–3) */}
                                <div className="hidden md:block" />
                                <div className="md:col-start-2 md:col-span-2">
                                    <div className="flex justify-start md:justify-end gap-3">
                                        <button
                                            className="h-11 px-5 rounded-xl bg-blue-600 text-white text-sm font-semibold shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                                            disabled={!(hmHighway && hmCounty && hmField)}
                                            onClick={() => addOrUpdateHeatMap({ highway: hmHighway, county: hmCounty, field: hmField })}
                                        >
                                            Add Heatmap
                                        </button>

                                        <button
                                            onClick={() => setActiveHeatMapData([])}
                                            title="Close all heatmaps"
                                            className="h-11 px-5 rounded-xl border border-slate-300 text-slate-700 bg-white hover:bg-slate-50 shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-400"
                                        >
                                            Close All
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </section>







                        {/* Gauges row */}
                        <div className="p-2 bg-gray-50 overflow-x-auto">
                            <div className="flex gap-6 min-w-min">
                                {Object.keys(scoreGauges).length > 0 && (
                                    <div className="py-1 px-3 bg-gray-50 shadow-sm mb-4">
                                        <div className="overflow-hidden pb-2">
                                            <div className="flex flex-row gap-6 min-w-min">
                                                {Object.entries(scoreGauges).map(([type, value]) => (
                                                    <div key={`viz-${type}`} className="w-[220px] h-[120px] flex-shrink-0 flex flex-col justify-end">
                                                        {renderVisualization(type, value || 0)}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                        {/* HeatMapModals container */}
                        <div className="flex-grow overflow-y-auto px-4 pb-4">
                            {activeHeatMapData.map(data => (
                                <HeatMapModal
                                    key={data.id}
                                    id={data.id}
                                    highway={data.highway}
                                    county={data.county}
                                    selectedScores={data.scores}
                                    features={pmisFeatures}
                                    onClose={() => setActiveHeatMapData(prev => prev.filter(x => x.id !== data.id))}
                                    onRemoveScore={val => removeScore(data.id, val)}
                                />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>

    )
}

