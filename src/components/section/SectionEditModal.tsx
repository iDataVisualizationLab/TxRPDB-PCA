import React, { useState } from 'react';
import { FaSave, FaTimes } from 'react-icons/fa';

interface SectionEditModalProps {
  title?: string;
  isOpen: boolean;
  data: any;
  onClose: () => void;
  onSave: (updatedData: any) => void;
}

const SectionEditModal: React.FC<SectionEditModalProps> = ({
  title,
  isOpen,
  data,
  onClose,
  onSave
}) => {
  type FormDataKeys =
    | 'Test Section'
    | 'District'
    | 'County'
    | 'Road ID'
    | 'GPS (Start)'
    | 'GPS (End)'
    | 'Pavement Type'
    | 'Thickness'
    | 'Subbase'
    | 'Subgrade'
    | 'CSJ'
    | 'Length'
    | 'Construction Year';

  type FormDataType = Record<FormDataKeys, any> & { [key: string]: any };
  const [errors, setErrors] = useState<{ [key: string]: string }>({});
  const [formData, setFormData] = useState<FormDataType>({
    'Test Section': data?.['Test Section'] || data?.sectionId || '',
    District: data?.District || '',
    County: data?.County || '',
    'Road ID': data?.Highway || data?.['Road ID'] || '',
    'GPS (Start)': data?.['GPS (Start)'] || '',
    'GPS (End)': data?.['GPS (End)'] || '',
    'Pavement Type': data?.['Pavement Type'] || '',
    Thickness: data?.['Thickness (in.)'] || data?.Thickness || '',
    Subbase: data?.['Subbase Type'] || data?.Subbase || '',
    Subgrade: data?.['Subgrade Type'] || data?.Subgrade || '',
    CSJ: data?.CCSJ || data?.CSJ || '',
    Length: data?.Length || '',
    'Construction Year': data?.['Construction Year'] || '',
  });
  type FieldType = {
    key: string;
    label: string;
    type: string;
    required: boolean;
    placeholder?: string;
  };

  const fieldGroups: {
    title: string;
    fields: FieldType[];
  }[] = [
    {
      title: 'Location Information',
      fields: [
        { key: 'Test Section', label: 'Test Section', type: 'text', required: true, placeholder: 'e.g. 2-I35-1' },
        { key: 'District', label: 'District', type: 'text', required: true, placeholder: 'e.g. Lubbock' },
        { key: 'County', label: 'County', type: 'text', required: true, placeholder: 'e.g. Lubbock' },
        { key: 'Road ID', label: 'Road ID', type: 'text', required: true , placeholder: 'e.g. US290'},
        { key: 'GPS (Start)', label: 'GPS (Start)', type: 'text', required: true, placeholder: 'e.g. 30.2672, -97.7431 (Latitude, Longitude)' },
        { key: 'GPS (End)', label: 'GPS (End)', type: 'text', required: false, placeholder: 'e.g. 30.2672, -97.7431 (Latitude, Longitude)' },
      ]
    },
    {
      title: 'Pavement Information',
      fields: [
        { key: 'Pavement Type', label: 'Pavement Type', type: 'text', required: true, placeholder: 'e.g. CRCP' },
        { key: 'Thickness', label: 'Thickness', type: 'number', required: false, placeholder: 'e.g. 12' },
        { key: 'Subbase', label: 'Subbase', type: 'text', required: false, placeholder: '' },
        { key: 'Subgrade', label: 'Subgrade', type: 'text', required: false, placeholder: '' },
      ]
    },
    {
      title: 'Construction Information',
      fields: [
        { key: 'CSJ', label: 'CSJ', type: 'text', required: false },
        { key: 'Length', label: 'Length', type: 'number', required: false },
        { key: 'Construction Year', label: 'Construction Year', type: 'number', required: false },
      ]
    }
  ];
  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const canonicalKeys = Object.keys(formData);

  const aliasMap: Record<string, string[]> = {
    'Test Section': ['Test Section', 'sectionId'],
    'Road ID': ['Highway', 'Road ID'],
    CSJ: ['CCSJ', 'CSJ'],
    Thickness: ['Thickness (in.)', 'Thickness'],
    Subbase: ['Subbase Type', 'Subbase'],
    District: ['District'],
    County: ['County'],
    'GPS (Start)': ['GPS (Start)'],
    'GPS (End)': ['GPS (End)'],
    Length: ['Length'],
    'Construction Year': ['Construction Year'],
    'Pavement Type': ['Pavement Type'],
  };
  const handleSave = () => {
    const newErrors: { [key: string]: string } = {};


  fieldGroups.forEach(group => {
    group.fields.forEach(field => {
      if (field.required && !formData[field.key as FormDataKeys]?.toString().trim()) {
        newErrors[field.key] = `${field.label} is required.`;
      }
    });
  });

    setErrors(newErrors);

    if (Object.keys(newErrors).length > 0) return;

    const normalized: Record<string, any> = {};

    for (const canonicalKey of canonicalKeys) {
      const aliases = aliasMap[canonicalKey] || [canonicalKey];
      const targetKey = aliases.find(key => key in data) ?? aliases[0];
      normalized[targetKey] = formData[canonicalKey as FormDataKeys];
    }

    normalized['Test Section'] = formData['Test Section']; // ensure included
    onSave(normalized);
    onClose();
  };

  // const handleSave = () => {
  //   const normalized: Record<string, any> = {};

  //   for (const canonicalKey of canonicalKeys) {
  //     const aliases = aliasMap[canonicalKey] || [canonicalKey];
  //     const targetKey = aliases.find(key => key in data) ?? aliases[0];
  //     normalized[targetKey] = formData[canonicalKey as FormDataKeys];
  //   }

  //   onSave(normalized);
  //   onClose();
  // };
  const handleCancel = () => {
    onClose();
  };

  if (!isOpen) return null;



  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[100vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-[rgb(20,55,90)] to-[rgb(30,65,100)] text-white rounded-t-lg">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold">
              {title || `Edit Section Data - ${data?.sectionId || data?.['Section ID'] || 'Unknown'}`}
            </h2>
            <button
              onClick={handleCancel}
              className="text-white hover:bg-white/20 p-2 rounded-full transition-colors"
            >
              <FaTimes size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[80vh]">

          {fieldGroups.map(group => (
            <div key={group.title} className="mb-6">
              <h3 className="text-lg font-semibold text-blue-700 border-b pb-2 mb-4">{group.title}</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {group.fields.map(({ key, label, type, required, placeholder }) => (
                  <div key={key} className={key === 'GPS (End)' || key === 'Construction Year' ? 'md:col-span-1' : ''}>
                    <label className="block text-sm font-medium text-gray-700 mb-2">{label}{required && ' *'}:</label>
                    <input
                      type={type || 'text'}
                      value={formData[key]}
                      onChange={(e) => handleInputChange(key, e.target.value)}
                      placeholder={placeholder}
                      className={`w-full px-3 py-2 border ${errors[key] ? 'border-red-500' : 'border-gray-300'} rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500`}
                    />
                    {errors[key] && <p className="text-red-600 text-sm mt-1">{errors[key]}</p>}
                  </div>
                ))}
              </div>
            </div>
          ))}


          {/* Action Buttons */}
          <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleCancel}
              className="px-6 py-2 border border-gray-300 text-gray-700 rounded-md hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors flex items-center gap-2"
            >
              <FaSave size={16} />
              Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SectionEditModal;