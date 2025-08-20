// EditReportModal.tsx
'use client';
import React, { useState, useEffect } from 'react';
import { FaTimes, FaPlus, FaTrash, FaEdit } from 'react-icons/fa';
import { createPortal } from 'react-dom';
import ReportFormModal from './ReportFormModal';

interface Report {
  Title: string;
  'Research Project Number': string;
  Authors: string;
  Date: string;
  'Performing Organization': string;
  Link: string;
  Image?: string;
}

interface EditReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reports: Report[];
  pathname?: string;
  onSave: (updatedReports: Report[]) => void;
  onUpload: (file: File | null, link: string | null) => Promise<{ imagePath: string; pdfPath: string }>;
  onDeleteFile?: (path: string) => Promise<void>;
}

const EMPTY_REPORT: Report = {
  Title: '',
  'Research Project Number': '',
  Authors: '',
  Date: '',
  'Performing Organization': '',
  Link: '',
  Image: ''
};

const EditReportModal: React.FC<EditReportModalProps> = ({ isOpen, onClose, reports, pathname, onSave, onUpload, onDeleteFile }) => {
  const [editedReports, setEditedReports] = useState<Report[]>([]);
  const [deletedReports, setDeletedReports] = useState<Report[]>([]);
  const [formOpen, setFormOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  

  useEffect(() => {
    setEditedReports(reports);
  }, [reports]);

  const handleSaveForm = (report: Report) => {
    if (editingIndex !== null) {
      const updated = [...editedReports];
      updated[editingIndex] = report;
      setEditedReports(updated);
    } else {
      setEditedReports(prev => [...prev, report]);
    }
    setFormOpen(false);
    setEditingIndex(null);
  };

  const handleEdit = (index: number) => {
    setEditingIndex(index);
    setFormOpen(true);
  };

  const handleAdd = () => {
    setEditingIndex(null);
    setFormOpen(true);
  };

  const handleDelete = (index: number) => {
    const report = editedReports[index];
    setEditedReports(prev => prev.filter((_, i) => i !== index));
    setDeletedReports(prev => [...prev, report]);
  };

  const handleSaveAll = async () => {
    if (onDeleteFile) {
      for (const report of deletedReports) {
        const toDelete: string[] = [];
        if (report.Link && !report.Link.startsWith('http')) toDelete.push(report.Link);
        if (report.Image) toDelete.push(report.Image);
        for (const path of toDelete) {
          try {
            await onDeleteFile(path);
          } catch (err) {
            console.warn(`Failed to delete ${path}:`, err);
          }
        }
      }
    }
    onSave(editedReports);
    onClose();
  };

  if (!isOpen) return null;

  return createPortal(
    <>
      <div className="fixed inset-0 bg-black bg-opacity-40 flex items-center justify-center z-[9998]">
        <div className="bg-white w-full max-w-2xl p-6 rounded-lg shadow-lg max-h-[90vh] overflow-y-auto">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-blue-700">Manage Reports</h2>
            <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
              <FaTimes />
            </button>
          </div>

          <table className="min-w-full border mb-4">
            <thead className="bg-gray-100">
              <tr>
                <th className="text-left p-2">Title</th>
                <th className="text-left p-2 w-32">Actions</th>
              </tr>
            </thead>
            <tbody>
              {editedReports.map((report, index) => (
                <tr key={index} className="border-t">
                  <td className="p-2">{report.Title || <span className="italic text-gray-400">Untitled</span>}</td>
                  <td className="p-2 flex gap-2">
                    <button
                      onClick={() => handleEdit(index)}
                      className="text-blue-600 hover:text-blue-800 text-sm inline-flex items-center gap-1"
                    >
                      <FaEdit /> Edit
                    </button>
                    <button
                      onClick={() => handleDelete(index)}
                      className="text-red-600 hover:text-red-800 text-sm inline-flex items-center gap-1"
                    >
                      <FaTrash /> Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-between items-center">
            <button
              onClick={handleAdd}
              className="inline-flex items-center gap-2 bg-green-600 hover:bg-green-700 text-white px-4 py-2 rounded"
            >
              <FaPlus /> Add Report
            </button>
            <button
              onClick={handleSaveAll}
              className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded flex items-center gap-2"
            >
              Save All
            </button>
          </div>
        </div>
      </div>

      <ReportFormModal
        isOpen={formOpen}
        initialData={editingIndex !== null ? editedReports[editingIndex] : EMPTY_REPORT}
        onClose={() => setFormOpen(false)}
        onSave={handleSaveForm}
        onUpload={onUpload}
      />
    </>,
    document.body
  );
};

export default EditReportModal;
