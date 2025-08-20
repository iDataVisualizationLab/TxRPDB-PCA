import React, { useState, DragEvent, ChangeEvent } from 'react';

interface UploadModalProps {
  open: boolean;
  onClose: () => void;
  file: File | null;
  setFile: (f: File | null) => void;
  uploading: boolean;
  onUpload: () => void;
}

const UploadModal: React.FC<UploadModalProps> = ({
  open,
  onClose,
  file,
  setFile,
  uploading,
  onUpload
}) => {
  const [isDragging, setIsDragging] = useState(false);
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
    if (f) setFile(f);
  };
  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) setFile(f);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-xl shadow-lg w-full max-w-xl p-6 text-gray-900">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Upload File</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-800 text-lg">
            ×
          </button>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1">Upload File</label>
          <div
            className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 ${
              isDragging ? 'border-blue-500 bg-blue-50' : 'border-gray-300'
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
                  <span>Upload a file</span>
                  <input id="file-upload" type="file" accept=".csv,text/csv" className="sr-only" onChange={handleFileChange} />
                </label>
                <p className="pl-1">or drag and drop</p>
              </div>
              <p className="text-xs text-gray-500">Supports .csv files</p>
              {file && <div className="mt-2 text-sm text-gray-800 bg-blue-50 p-2 rounded">{file.name}</div>}
            </div>
          </div>
        </div>

        <button
          onClick={onUpload}
          disabled={uploading || !file}
          className={`w-full py-2 px-4 rounded-md text-sm font-medium text-white ${
            uploading || !file ? 'bg-blue-300 cursor-not-allowed' : 'bg-blue-600 hover:bg-blue-700'
          }`}
        >
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>
    </div>
  );
};

export default UploadModal;
