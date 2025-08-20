// PlanSetEditModal.tsx
"use client";

import React, { useState, useEffect, useRef } from "react";
import JSZip from "jszip";
import { FaTimes, FaTrash, FaUpload, FaSave, FaSpinner } from "react-icons/fa";
import { uploadProxy, deleteFromBackend, saveToBackend, API_GET_PROXY } from "@/lib/api";
import { usePathname } from "next/navigation";

interface PlanSetItem {
    CSJ: string;
    Path: string;
}

interface PlanSetEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    sectionId: string;
    currentPlanSets: PlanSetItem[];
    onSave: (updatedPlanSets: PlanSetItem[], done: () => void, summary?: string) => void;
}

const PlanSetEditModal: React.FC<PlanSetEditModalProps> = ({ isOpen, onClose, sectionId, currentPlanSets, onSave }) => {
    const [planSets, setPlanSets] = useState<PlanSetItem[]>([]);
    const [uploading, setUploading] = useState(false);
    const [saving, setSaving] = useState(false);
    const [newCSJ, setNewCSJ] = useState("");
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploadSuccess, setUploadSuccess] = useState<string | null>(null);
    const [uploadError, setUploadError] = useState<string | null>(null);
    const [changeLog, setChangeLog] = useState<string[]>([]);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const pathname = usePathname();

    useEffect(() => {
        setPlanSets(currentPlanSets);
        setChangeLog([]);
    }, [currentPlanSets]);

    const handleDelete = (index: number) => {
        const toDelete = planSets[index];
        if (confirm(`Delete plan set ${toDelete.CSJ}?`)) {
            setPlanSets(prev => prev.filter((_, i) => i !== index));
            if (toDelete.Path) deleteFromBackend(toDelete.Path).catch(console.warn);
            setChangeLog(prev => [...prev, `Deleted plan set for CSJ: ${toDelete.CSJ}`]);
        }
    };

    const handleUpload = async (file: File, csj: string) => {
        const basePath = pathname.includes("level_one")
            ? `${pathname}sections/${sectionId}`
            : `${pathname}${sectionId}`;

        const filename = `${csj}.zip`;
        const path = `${basePath}/section_data/plan_sets/${filename}`;

        const formData = new FormData();
        formData.append("file", file);
        formData.append("path", path);

        setUploading(true);
        setUploadSuccess(null);
        setUploadError(null);
        try {
            await uploadProxy(path, file);
            const fileSizeKB = (file.size / 1024).toFixed(1);
            const existingIndex = planSets.findIndex(p => p.CSJ === csj);
            const action = existingIndex >= 0 ? "Updated" : "Uploaded";

            setPlanSets(prev => {
                const existingIndex = prev.findIndex(p => p.CSJ === csj);
                const updatedEntry = { CSJ: csj, Path: path };

                if (existingIndex >= 0) {
                    const updated = [...prev];
                    updated[existingIndex] = updatedEntry;
                    return updated;
                } else {
                    return [...prev, updatedEntry];
                }
            });

            setChangeLog(prev => [...prev, `${action} plan set for CSJ: ${csj} (${fileSizeKB} KB) to ${path}`]);
            setUploadSuccess(`${action} plan set for CSJ: ${csj} (${fileSizeKB} KB) to ${path}`);
            setNewCSJ("");
        } catch (err) {
            console.error("Upload failed:", err);
            // alert("Failed to upload ZIP file");
            setUploadError(`Failed to upload ZIP for CSJ: ${csj}`);
        } finally {
            setUploading(false);
            setSelectedFile(null);
            if (fileInputRef.current) fileInputRef.current.value = "";
        }
    };


    const handleSave = async () => {
        setSaving(true);
        const jsonPath = pathname.includes("level_one")
            ? `${pathname}sections/${sectionId}/section_data/plan_sets/csj_list.json`
            : `${pathname}${sectionId}/section_data/plan_sets/csj_list.json`;

        const summary = changeLog.length ? changeLog.join("\n") : undefined;

        await onSave(planSets, async () => {
            try {
                await saveToBackend(jsonPath, planSets);
            } catch (e) {
                console.error("Save failed:", e);
            } finally {
                setSaving(false);
                onClose();
            }
        }, summary);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-3xl max-h-[90vh] overflow-hidden">
                <div className="px-6 py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white flex justify-between items-center">
                    <h2 className="text-xl font-bold">Edit Plan Sets - {sectionId}</h2>
                    <button onClick={onClose} className="text-white hover:text-gray-200 p-1">
                        <FaTimes size={20} />
                    </button>
                </div>

                <div className="p-6 overflow-y-auto max-h-[60vh] space-y-4">
                    <div className="border p-4 rounded bg-blue-50">
                        <h3 className="font-semibold text-blue-700 mb-2">Upload New Plan Set</h3>

                        <label className="block mb-1 text-sm font-medium text-gray-700">CSJ</label>
                        <input
                            type="text"
                            value={newCSJ}
                            onChange={(e) => setNewCSJ(e.target.value)}
                            className="block w-full border p-2 rounded mb-2"
                            placeholder="Enter CSJ"
                        />

                        <label className="block mb-1 text-sm font-medium text-gray-700">ZIP File</label>
                        <input
                            type="file"
                            accept=".zip"
                            ref={fileInputRef}
                            onChange={(e) => setSelectedFile(e.target.files?.[0] || null)}
                            className="block w-full border p-2 rounded mb-2"
                            disabled={uploading || !newCSJ}
                        />

                        {/* Button aligned right */}
                        <div className="flex justify-end">
                            <button
                                disabled={uploading || !selectedFile || !newCSJ}
                                onClick={() => {
                                    if (selectedFile && newCSJ) {
                                        handleUpload(selectedFile, newCSJ);
                                    }
                                }}
                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded disabled:opacity-50"
                            >
                                {uploading ? <FaSpinner className="animate-spin inline-block mr-2" /> : null}
                                Upload
                            </button>
                        </div>

                        {uploading && <p className="text-sm text-blue-600 mt-2">Uploading...</p>}
                    </div>


                    <div>
                        <h3 className="font-semibold text-gray-800 mb-2">Current Plan Sets</h3>
                        {planSets.length === 0 ? (
                            <p className="italic text-gray-500">No plan sets available</p>
                        ) : (
                            <ul className="space-y-2">
                                {planSets.map((plan, index) => (
                                    <li key={index} className="flex justify-between items-center border p-2 rounded">
                                        <div>
                                            <p><strong>CSJ:</strong> {plan.CSJ}</p>
                                            <p className="text-sm text-gray-500">{plan.Path}</p>
                                        </div>
                                        <button onClick={() => handleDelete(index)} className="text-red-600 hover:text-red-800">
                                            <FaTrash />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>

                <div className="px-6 py-4 bg-gray-50 flex justify-end border-t">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100 mr-3"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={saving || uploading}
                        className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 flex items-center gap-2 disabled:opacity-50"
                    >
                        {uploading ||saving ? <FaSpinner className="animate-spin" /> : <FaSave />} Save Changes
                    </button>
                </div>
            </div>
        </div>
    );
};


export default PlanSetEditModal;
