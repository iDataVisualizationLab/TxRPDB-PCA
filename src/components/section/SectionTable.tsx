import React, { useState, useRef, useEffect } from 'react';
import { FaSearch, FaMapMarkerAlt, FaEllipsisV, FaDownload, FaUpload, FaEdit, FaTrash } from 'react-icons/fa';
import { Menu } from '@headlessui/react';
import { useSectionModal } from '@/context/SectionContext';

interface SectionTableProps {
    data: any[];
    selectedPointId: string | null;
    selectedRow: number | null;
    onDownloadAll: () => void;
    onDeleteRow: (index: number) => void;
    onAddNew: () => void;
    onUploadAll: () => void;
    onRowSelect: (row: any, index: number) => void;
    onMapClick: (row: any, index: number) => void;
    title: string | null;
}

const SectionTable: React.FC<SectionTableProps> = ({
    data,
    selectedPointId,
    selectedRow,
    onDownloadAll,
    onDeleteRow,
    onAddNew,
    onUploadAll,
    onRowSelect,
    onMapClick,
    title
}) => {
    const [isAdmin, setIsAdmin] = useState(false);
    const [search, setSearch] = useState('');
    const filteredData = data.filter(item =>
        item.index?.toString().includes(search) ||
        item.sectionId?.toString().includes(search) ||
        item.highway?.toLowerCase().includes(search.toLowerCase())
    );
    const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
    useEffect(() => {
        const role = localStorage.getItem("role");
        setIsAdmin(role === "admin");
    }, []);
    useEffect(() => {
        const el = selectedPointId ? rowRefs.current[selectedPointId] : null;
        if (el) {
            el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
        }
    }, [selectedPointId]);

    return (
        // <div className="max-h-[calc(100vh-250px)] flex flex-col overflow-hidden isolate rounded-lg shadow-xl border-0 bg-white">
        <div className="h-full flex flex-col overflow-hidden isolate rounded-lg shadow-xl border-0 bg-white">
            {/* Header */}
            {/* Header with global actions */}
            <div className="px-5 py-4 bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] border-b flex justify-between items-center rounded-t-lg">
                <h2 className="text-xl font-bold text-white">{title}</h2>
            </div>
            {/* Search + Table */}
            <div className="p-5 flex flex-col flex-grow overflow-hidden">
                <div className="flex items-center justify-between gap-3 mb-5">
                    {/* Search Input - grows to fill space */}
                    <div className="relative flex-grow">
                        <input
                            type="text"
                            placeholder="Search sections..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full p-3 pl-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all"
                        />
                        <FaSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    </div>

                    {/* Buttons - fixed size, aligned to the right */}
                    <div className="flex gap-2 shrink-0">
                        {isAdmin && (
                            <button
                                onClick={onAddNew}
                                title="Add New Section"
                                className="inline-flex items-center p-1 px-2 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                            >
                                <FaEdit className="mr-1 w-5 h-5" />
                                Add Section
                            </button>
                        )}
                        {/* {isAdmin && (
                            <button
                                onClick={onUploadAll}
                                title="Upload All"
                                className="inline-flex items-center p-1 px-2 text-xs rounded bg-blue-600 text-white hover:bg-blue-700 transition"
                            >
                                <FaUpload className="mr-1 w-5 h-5" />
                                Upload
                            </button>
                        )} */}
                        <button
                            onClick={onDownloadAll}
                            title="Download All"
                            className="inline-flex items-center p-1 px-2 text-xs rounded bg-green-600 text-white hover:bg-green-700 transition"
                        >
                            <FaDownload className="mr-1 w-5 h-5" />
                            Download
                        </button>
                    </div>
                </div>



                <div className="border rounded-lg shadow flex-grow">
                    <div className="overflow-x-auto max-h-[calc(100vh-250px)] scroll-smooth">
                        <table className="min-w-full border-collapse table-fixed text-sm">
                            <thead className="sticky top-0 bg-gradient-to-r from-gray-100 to-gray-200 text-gray-700 z-10">
                                <tr>
                                    <th className="border-b pl-2 pr-1 py-3 text-left font-semibold">No.</th>
                                    <th className="border-b pl-1 pr-1 py-3 text-left font-semibold">Section ID</th>
                                    <th className="border-b pl-1 pr-1 py-3 text-left font-semibold">Highway</th>
                                    <th className="border-b pl-1 pr-1 py-3 text-center font-semibold">Map</th>
                                    <th className="border-b pl-1 pr-2 py-3 text-center font-semibold">Details</th>
                                    <th className="border-b pl-1 pr-2 py-3 text-center font-semibold">Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {filteredData.map((row, index) => (
                                    <tr
                                        key={index}
                                        ref={el => {
                                            if (row.sectionId === selectedPointId) {
                                                rowRefs.current[row.sectionId] = el;
                                            }
                                        }}
                                        className={`border-b hover:bg-blue-50 transition-colors ${selectedPointId === row.sectionId
                                            ? "bg-blue-200"
                                            : selectedRow === index
                                                ? "bg-blue-100"
                                                : ""
                                            }`}
                                    >
                                        <td className="pl-2 pr-1 py-3">{row.index}</td>
                                        <td className="pl-1 pr-1 py-3">{row.sectionId}</td>
                                        <td className="pl-1 pr-1 py-3">{row.highway}</td>
                                        <td className="pl-1 pr-1 py-3 text-center">
                                            <button
                                                className={`p-2 rounded-full ${selectedPointId === row.sectionId
                                                    ? "bg-green-200 text-green-700 hover:bg-green-300"
                                                    : "bg-blue-100 text-blue-600 hover:bg-blue-200"
                                                    } transition-colors`}
                                                title="Show on Map"
                                                onClick={() => onMapClick(row, index)}
                                            >
                                                <FaMapMarkerAlt />
                                            </button>
                                        </td>
                                        <td className="pl-1 pr-2 py-3 text-center">
                                            <button
                                                className="p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 transition-colors"
                                                title="View Details"
                                                onClick={() => onRowSelect(row, index)}
                                            >
                                                <FaSearch />
                                            </button>
                                        </td>
                                        <td className="pl-1 pr-2 py-3 text-center">
                                            <Menu as="div" className="relative inline-block text-left">
                                                <Menu.Button className="p-2 rounded-full hover:bg-gray-200 text-gray-600">
                                                    <FaEllipsisV />
                                                </Menu.Button>
                                                <Menu.Items className="absolute right-0 mt-2 w-28 origin-top-right bg-white border border-gray-200 rounded-md shadow-lg focus:outline-none z-10">
                                                    <div className="py-1">
                                                        <Menu.Item>
                                                            {({ active }) => (
                                                                <button
                                                                    className={`w-full px-4 py-2 text-sm text-left text-red-600 ${active ? 'bg-gray-100' : ''}`}
                                                                    onClick={() => onDeleteRow(index)}
                                                                >
                                                                    Delete
                                                                </button>
                                                            )}
                                                        </Menu.Item>
                                                    </div>
                                                </Menu.Items>
                                            </Menu>
                                        </td>

                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SectionTable;
