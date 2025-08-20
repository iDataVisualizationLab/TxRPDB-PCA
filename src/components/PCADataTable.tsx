"use client";

import * as React from "react";
import { DataGrid, GridColDef, GridFilterModel, GridSortModel } from "@mui/x-data-grid";
import Box from "@mui/material/Box";
import TextField from "@mui/material/TextField";
import MenuItem from "@mui/material/MenuItem";

// —————————————————— Normalizers ——————————————————
const formatCountyName = (county?: string): string => {
    if (!county) return "";
    const withoutPrefix = county.replace(/^\d+\s*-\s*/, "");
    return withoutPrefix.toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
};
const normalizeCounty = (v: unknown) =>
    formatCountyName(String(v ?? "").normalize("NFKC").replace(/\u00A0/g, " ").trim())
        .replace(/\s+/g, "")
        .toUpperCase();
const normalizeHighway = (v: unknown) =>
    String(v ?? "").normalize("NFKC").replace(/\u00A0/g, " ").replace(/\s+/g, "").toUpperCase();

// Stable key for rows
const makeKey = (r: any) =>
    JSON.stringify([
        r?.TX_SIGNED_HIGHWAY_RDBD_ID,
        r?.EFF_YEAR,
        r?.COUNTY,
        r?.TX_BEG_REF_MARKER_NBR,
        r?.TX_BEG_REF_MRKR_DISP,
        r?.TX_END_REF_MARKER_NBR,
        r?.TX_END_REF_MARKER_DISP,
    ]);

interface PCADataTableProps {
    allData: any[];
    selectedRows: any[];
    pageSize?: number;
}

const PCADataTable: React.FC<PCADataTableProps> = ({ allData, selectedRows, pageSize = 20 }) => {
    // selection → highlight rows
    // eslint-disable-next-line react-hooks/exhaustive-deps
    const flatSelected: any[] = Array.isArray(selectedRows?.[0])
        ? (selectedRows as any[]).flat()
        : ((selectedRows as any[]) ?? []);
    const selectedKeySet = React.useMemo(() => new Set(flatSelected.map(makeKey)), [flatSelected]);

    // decorate rows with a flag for styling (MUI grid is column-based; we’ll still add a flag)
    const rows = React.useMemo(
        () =>
            allData.map((r) => ({
                ...r,
                __id: makeKey(r),
                __selected: selectedKeySet.has(makeKey(r)),
            })),
        [allData, selectedKeySet]
    );


    // columns: from data shape
    const columns = React.useMemo<GridColDef<any>[]>(() => {
        const sample = allData?.[0] ?? {};
        const keys = Object.keys(sample);

        const baseCols: GridColDef[] = keys.map((k) => ({
            field: k,                // let DataGrid read row[k]
            headerName: k,
            flex: 1,
            minWidth: 120,
            sortable: true,
            filterable: true,
            // OPTIONAL: pretty print objects/nulls without touching the source value
            valueFormatter: (p) => {
                const v = p;
                if (v == null) return "";
                if (typeof v === "object") return JSON.stringify(v);
                return String(v);
            },
            // OPTIONAL: keep nowrap
            renderCell: (p) => <span style={{ whiteSpace: "nowrap" }}>{p.formattedValue as string}</span>,
        }));

        return [
            {
                field: "__selected",
                headerName: "Selected",
                width: 96,
                sortable: true,
                filterable: false,
                renderCell: (p) => (p?.row?.__selected ? "✓" : ""),
                headerAlign: "left",
                align: "left",
                sortComparator: (a, b) => Number(a) - Number(b),
            },
            ...baseCols,
        ];
    }, [allData]);

    // sort: default by Selected desc
    const [sortModel, setSortModel] = React.useState<GridSortModel>([
        { field: "__selected", sort: "desc" },
    ]);

    // Single search: dropdown picks a column OR "ALL", one debounced text box
    type FilterMode = "ALL" | string;
    const [filterMode, setFilterMode] = React.useState<FilterMode>("ALL");
    const [query, setQuery] = React.useState("");
    const debQuery = useDebounced(query, 300);

    // Build a filterModel for the grid
    const filterModel: GridFilterModel = React.useMemo(() => {
        if (!debQuery) return { items: [] };
        if (filterMode === "ALL") {
            // Quick filter across all columns
            return { items: [], quickFilterValues: [debQuery] };
        }
        // Single column contains filter
        return {
            items: [
                {
                    id: 1,
                    field: filterMode,
                    operator: "contains",
                    value: debQuery,
                },
            ],
        };
    }, [debQuery, filterMode]);

    // Columns dropdown options
    const columnOptions = React.useMemo(
        () => [
            { id: "ALL", label: "All columns" },
            ...columns
                .filter((c) => c.field !== "__selected")
                .map((c) => ({ id: c.field, label: c.headerName ?? c.field })),
        ],
        [columns]
    );

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.5 }}>
            {/* Toolbar: dropdown + search */}
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
                <TextField
                    select
                    size="small"
                    label="Filter scope"
                    value={filterMode}
                    onChange={(e) => setFilterMode(e.target.value as FilterMode)}
                    sx={{ minWidth: 180 }}
                >
                    {columnOptions.map((o) => (
                        <MenuItem key={o.id} value={o.id}>
                            {o.label}
                        </MenuItem>
                    ))}
                </TextField>

                <TextField
                    size="small"
                    label={filterMode === "ALL" ? "Search all columns" : `Search ${filterMode}`}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    sx={{ minWidth: 280 }}
                />

                <Box sx={{ ml: "auto", fontSize: 12, color: "text.secondary" }}>
                    Rows: {rows.length}
                </Box>
            </Box>

            <Box
                sx={{
                    height: 560,
                    width: "100%",
                    "& .selectedRow": {
                        backgroundColor: "rgba(250, 204, 21, 0.18)", // amber-300-ish
                    },
                }}
            >
                <DataGrid
                    rows={rows}
                    columns={columns}
                    getRowId={(r) => r.__id}
                    filterModel={filterModel}
                    onFilterModelChange={() => { }}
                    sortingMode="client"
                    sortModel={sortModel}
                    onSortModelChange={(m) => setSortModel(m)}
                    initialState={{
                        pagination: { paginationModel: { page: 0, pageSize } },
                    }}
                    pageSizeOptions={[10, 20, 50, 100]}
                    disableRowSelectionOnClick
                    getRowClassName={(params) => (params.row.__selected ? "selectedRow" : "")}
                    sx={{
                        // Smooth scrolling + good defaults; DataGrid is virtualized by default
                        "& .MuiDataGrid-columnHeaders": { position: "sticky", top: 0, zIndex: 1 },
                    }}
                />
            </Box>
        </Box>
    );
};

export default PCADataTable;

// ——— tiny debounce hook
function useDebounced<T>(value: T, ms = 300) {
    const [v, setV] = React.useState(value);
    React.useEffect(() => {
        const t = setTimeout(() => setV(value), ms);
        return () => clearTimeout(t);
    }, [value, ms]);
    return v;
}
