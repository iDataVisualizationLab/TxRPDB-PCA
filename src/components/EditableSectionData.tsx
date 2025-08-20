import React, { useState } from 'react';
import { FaSave, FaTimes, FaEdit } from 'react-icons/fa';

interface SectionData {
  District?: string;
  County?: string;
  Highway?: string;
  'GPS (Start)'?: string;
  'GPS (End)'?: string;
  'Pavement Type'?: string;
  'Thickness (in.)'?: string | number;
  'Subbase Type'?: string;
  'Subgrade Type'?: string;
  CCSJ?: string;
  Length?: string | number;
  'Construction Year'?: string | number;
}

interface EditableSectionDataProps {
  data: SectionData;
  onSave: (data: SectionData) => void;
  onCancel?: () => void;
}

const EditableSectionData: React.FC<EditableSectionDataProps> = ({ data, onSave, onCancel }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editedData, setEditedData] = useState<SectionData>({
    District: data.District || '',
    County: data.County || '',
    Highway: data.Highway || '',
    'GPS (Start)': data['GPS (Start)'] || '',
    'GPS (End)': data['GPS (End)'] || '',
    'Pavement Type': data['Pavement Type'] || '',
    'Thickness (in.)': data['Thickness (in.)'] || '',
    'Subbase Type': data['Subbase Type'] || '',
    'Subgrade Type': data['Subgrade Type'] || '',
    CCSJ: data.CCSJ || '',
    Length: data.Length || '',
    'Construction Year': data['Construction Year'] || ''
  });

  const handleInputChange = (field: keyof SectionData, value: string) => {
    setEditedData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = () => {
    onSave(editedData);
    setIsEditing(false);
  };

  const handleCancel = () => {
    setEditedData({
      District: data.District || '',
      County: data.County || '',
      Highway: data.Highway || '',
      'GPS (Start)': data['GPS (Start)'] || '',
      'GPS (End)': data['GPS (End)'] || '',
      'Pavement Type': data['Pavement Type'] || '',
      'Thickness (in.)': data['Thickness (in.)'] || '',
      'Subbase Type': data['Subbase Type'] || '',
      'Subgrade Type': data['Subgrade Type'] || '',
      CCSJ: data.CCSJ || '',
      Length: data.Length || '',
      'Construction Year': data['Construction Year'] || ''
    });
    setIsEditing(false);
    if (onCancel) onCancel();
  };

  const renderField = (label: string, field: keyof SectionData, type: string = "text") => (
    <div className="flex flex-col">
      <label className="font-medium text-gray-700 mb-1">{label}:</label>
      {isEditing ? (
        <input
          type={type}
          value={editedData[field] || ''}
          onChange={(e) => handleInputChange(field, e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : (
        <span className="px-3 py-2 bg-gray-50 rounded-md">
          {data[field] || "N/A"}
        </span>
      )}
    </div>
  );

  return (
    <div className="p-4 border border-gray-200 rounded-lg mt-2 bg-white shadow-sm">
      {/* Edit Controls */}
      <div className="flex justify-end mb-4">
        {!isEditing ? (
          <button
            onClick={() => setIsEditing(true)}
            className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-md hover:bg-blue-600 transition-colors"
          >
            <FaEdit size={14} />
            Edit
          </button>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded-md hover:bg-green-600 transition-colors"
            >
              <FaSave size={14} />
              Save
            </button>
            <button
              onClick={handleCancel}
              className="flex items-center gap-2 px-3 py-1 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
            >
              <FaTimes size={14} />
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Location Information */}
      <h4 className="font-semibold text-lg text-blue-700 border-b pb-2 mb-3">Location Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {renderField("District", "District")}
        {renderField("County", "County")}
        {renderField("Road ID", "Highway")}
        {renderField("GPS (Start)", "GPS (Start)")}
        {renderField("GPS (End)", "GPS (End)")}
      </div>

      {/* Pavement Information */}
      <h4 className="font-semibold text-lg text-blue-700 border-b pb-2 mb-3">Pavement Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {renderField("Pavement Type", "Pavement Type")}
        {renderField("Thickness", "Thickness (in.)", "number")}
        {renderField("Subbase", "Subbase Type")}
        {renderField("Subgrade", "Subgrade Type")}
      </div>

      {/* Construction Information */}
      <h4 className="font-semibold text-lg text-blue-700 border-b pb-2 mb-3">Construction Information</h4>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {renderField("CSJ", "CCSJ")}
        {renderField("Length", "Length", "number")}
        {renderField("Construction Year", "Construction Year", "number")}
      </div>
    </div>
  );
};

export default EditableSectionData;