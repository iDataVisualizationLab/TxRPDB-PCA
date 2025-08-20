// ReportFormModal.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { FaSave, FaTimes, FaUpload } from 'react-icons/fa';
import { createPortal } from 'react-dom';

interface Report {
    Title: string;
    'Research Project Number': string;
    Authors: string;
    Date: string;
    'Performing Organization': string;
    Link: string;
    Image?: string;
}

interface ReportFormModalProps {
    isOpen: boolean;
    initialData: Report;
    onClose: () => void;
    onSave: (report: Report) => void;
    onUpload: (file: File | null, link: string | null) => Promise<{ imagePath: string; pdfPath: string }>;
}

const ReportFormModal: React.FC<ReportFormModalProps> = ({ isOpen, initialData, onClose, onSave, onUpload }) => {
    const [formData, setFormData] = useState<Report>(initialData);
    const [linkInput, setLinkInput] = useState<string>(initialData.Link);
    const [uploading, setUploading] = useState(false);
    useEffect(() => {
        setFormData(initialData);
        setLinkInput(initialData.Link);
    }, [initialData]);

    const handleChange = (key: keyof Report, value: string) => {
        setFormData(prev => ({ ...prev, [key]: value }));
    };

    const handleUpload = async () => {
        const fileInput = document.getElementById('pdf-upload') as HTMLInputElement;
        const file = fileInput?.files?.[0] || null;
        const link = linkInput?.trim() || null;

        try {
            setUploading(true);
            let finalData = formData;

            if (link !== initialData.Link || file) {
                 const { imagePath, pdfPath } = await onUpload(file, link);
                 console.log()
                finalData = { ...formData, Link: pdfPath, Image: imagePath };
            }

            onSave(finalData);
        } catch (e) {
            alert('Upload failed: ' + (e instanceof Error ? e.message : String(e)));
        } finally {
            setUploading(false);
            onClose()
        }
    };

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9999]">
            <div className="bg-white w-full max-w-2xl p-6 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-lg font-semibold text-blue-700">Edit Report</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
                        <FaTimes />
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
                    <input type="text" placeholder="Title" value={formData.Title} onChange={e => handleChange('Title', e.target.value)} className="border p-2 rounded" />
                    <input type="text" placeholder="Research Project Number" value={formData['Research Project Number']} onChange={e => handleChange('Research Project Number', e.target.value)} className="border p-2 rounded" />
                    <input type="text" placeholder="Authors" value={formData.Authors} onChange={e => handleChange('Authors', e.target.value)} className="border p-2 rounded" />
                    <input type="text" placeholder="Date" value={formData.Date} onChange={e => handleChange('Date', e.target.value)} className="border p-2 rounded" />
                    <input type="text" placeholder="Performing Organization" value={formData['Performing Organization']} onChange={e => handleChange('Performing Organization', e.target.value)} className="border p-2 rounded" />
                </div>

                <div className="flex flex-col gap-2 mb-4">
                    <input id="pdf-upload" type="file" accept=".pdf" className="border p-2 rounded" />
                    <input type="text" placeholder="Or paste a PDF link" value={linkInput} onChange={e => setLinkInput(e.target.value)} className="border p-2 rounded" />
                </div>

                <div className="flex justify-end">
                    <button
                        disabled={uploading}
                        onClick={() => { handleUpload(); }}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
                    >
                        <FaSave /> {uploading ? 'Uploading...' : 'Save'}
                    </button>
                </div>
            </div>
        </div>,
        document.body
    );
};

export default ReportFormModal;
