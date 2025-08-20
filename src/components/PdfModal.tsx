'use client';
import React from 'react';
import { FaTimes } from 'react-icons/fa';

interface PdfModalProps {
  isOpen: boolean;
  pdfUrl: string;
  onClose: () => void;
}

const PdfModal: React.FC<PdfModalProps> = ({ isOpen, pdfUrl, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      {/* Outer container is 90% of the viewport width & height */}
      <div className="bg-white rounded-lg shadow-lg w-[80vw] h-[95vh] flex flex-col relative">
        {/* Top bar with close button */}
        <div className="flex justify-end p-4 border-b border-gray-200">
          <button onClick={onClose} className="text-gray-600">
            <FaTimes size={20} />
          </button>
        </div>

        {/* PDF iframe fills the remaining space */}
        <div className="flex-1">
          <iframe
            src={pdfUrl}
            title="PDF Viewer"
            className="w-full h-full"
            style={{ border: 'none' }}
          />
        </div>
      </div>
    </div>
  );
};

export default PdfModal;
