'use client';
import React, { useState } from 'react';
import { FaEdit, FaFileAlt } from 'react-icons/fa';
import EditReportModal from './EditReportModal';
import { useSectionModal } from "@/context/SectionContext";
import { saveToBackend, deleteFromBackend, uploadReport, API_GET_PROXY } from "@/lib/api";

import { usePathname } from 'next/navigation';


interface Report {
    Title: string;
    'Research Project Number': string;
    Authors: string;
    Date: string;
    'Performing Organization': string;
    Link: string;
    Image?: string;
}

interface ReportDisplayProps {
    isAdmin?: boolean;
    route: string;
    onSuccess?: (msg: string) => void;
    onError?: (msg: string) => void;
}

const ReportDisplay: React.FC<ReportDisplayProps> = ({ isAdmin, route, onSuccess, onError }) => {
    const { reportData, setReportData } = useSectionModal();
    const [editOpen, setEditOpen] = useState(false);
    const [localReports, setLocalReports] = useState<Report[]>(reportData);
    const pathname = usePathname();

    const handleUpload = async (file: File | null, link: string | null) => {
        if (!file && !link) throw new Error('No file or link provided');

        const basePath = `${pathname}/reports`;
        return await uploadReport(file, link, basePath);
    };

    const handleSave = async (updated: Report[]) => {
        const changes: string[] = [];

        reportData.forEach((prev, index) => {
            const next = updated[index];
            if (!next) {
                changes.push(`Deleted report: **${prev.Title || 'Untitled'}**`);
                return;
            }

            const keys = Object.keys(prev) as (keyof Report)[];
            for (const key of keys) {
                const oldVal = prev[key];
                const newVal = next[key];

                if (oldVal !== newVal) {
                    if (key === "Link") {
                        const from = oldVal?.startsWith("http") ? "link" : "file";
                        const to = newVal?.startsWith("http") ? "link" : "file";
                        changes.push(
                            `Changed Link in **${prev.Title}** from ${from} \`${oldVal || 'none'}\` to ${to} \`${newVal || 'none'}\``
                        );
                    } else if (key === "Image") {
                        changes.push(`Updated image path in **${prev.Title}** to \`${newVal || 'none'}\``);
                    } else {
                        changes.push(
                            `Changed **${key}** in **${prev.Title || 'Untitled'}**: \`${oldVal || 'N/A'}\` → \`${newVal || 'N/A'}\``
                        );
                    }
                }
            }
        });

        if (updated.length > reportData.length) {
            for (let i = reportData.length; i < updated.length; i++) {
                changes.push(`Added new report: **${updated[i].Title || 'Untitled'}**`);
            }
        }

        try {
            await saveToBackend(`${pathname}/reports/reports_info.json`, updated);
            setLocalReports(updated);
            setReportData(updated);
            const summary = `Reports saved successfully.\n\n${changes.join("\n")}`;
            onSuccess?.(summary);
        } catch (error) {
            console.error("Failed to save report info:", error);
            onError?.("Failed to save report info to backend.");
        }
    };


    return (
        <div className="p-4 border border-gray-200 rounded-lg mt-2 bg-white shadow-sm">
            <div className="flex justify-between items-center border-b pb-2 mb-4">
                <h4 className="font-semibold text-lg text-blue-700">
                    Available Reports
                </h4>
                {isAdmin && (
                    <>
                        <button
                            onClick={() => setEditOpen(true)}
                            className="px-2.5 py-1 bg-blue-600 text-white text-sm rounded-md hover:bg-blue-700 flex items-center gap-1"
                        >
                            <FaEdit size={12} />
                            Edit Report
                        </button>
                        <EditReportModal
                            isOpen={editOpen}
                            onClose={() => setEditOpen(false)}
                            reports={localReports}
                            onSave={handleSave}
                            onUpload={handleUpload}
                            pathname={pathname}
                            onDeleteFile={deleteFromBackend}
                        />
                    </>
                )}
            </div>


            {localReports.length === 0 ? (
                <p className="text-center text-gray-500 py-4">No reports available.</p>
            ) : (
                localReports.map((report, index) => (
                    <div key={index} className="mb-5 last:mb-0 p-4 bg-gray-50 rounded-lg text-center">
                        <h3 className="font-bold text-lg text-blue-700 mb-2">{report.Title}</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3 md:max-w-xl mx-auto">
                            <p><strong>Research Project:</strong> {report['Research Project Number']}</p>
                            <p><strong>Authors:</strong> {report.Authors}</p>
                            <p><strong>Date:</strong> {report.Date}</p>
                            <p><strong>Organization:</strong> {report['Performing Organization']}</p>
                        </div>
                        {report.Link ? (
                            <a
                                href={report.Link.startsWith('https:') ? report.Link : `${API_GET_PROXY}/${report.Link}`}
                                className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-md transition-colors"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                <FaFileAlt /> View Report
                            </a>
                        ) : (
                            <span className="text-sm text-gray-400 italic">No file</span>
                        )}
                        {report.Image && (
                            <div className="mt-3 bg-white p-2 rounded border mx-auto max-w-md">
                                <img src={`${API_GET_PROXY}/${report.Image}`} alt={report.Title} className="mx-auto" />
                            </div>
                        )}
                    </div>
                ))
            )}
        </div>
    );
};

export default ReportDisplay;
