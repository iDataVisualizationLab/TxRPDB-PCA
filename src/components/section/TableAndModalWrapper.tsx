'use client';


import React, {
  useState,
  useRef,
  useEffect,
  useCallback,
  DragEvent,
  ChangeEvent
} from 'react';
import Papa from 'papaparse';
import SectionTable from './SectionTable';
import SectionDetailsModal from './SectionDetailsModal';
import { useSectionModal } from '@/context/SectionContext';
import { usePathname } from 'next/navigation';
import UploadModal from '@/components/upload/UploadModal';
import { routeUploadContent } from '@/config';
import { saveToBackend } from '@/lib/api';
import SectionEditModal from './SectionEditModal';
import { useDialog } from '@/context/ModalContext'

interface TableAndModalWrapperProps {
  title: string;
  geojsonPath: string;      // initial values
  jsonReportPath: string;
  onDataUpdated?: () => void;
}

const TableAndModalWrapper: React.FC<TableAndModalWrapperProps> = ({
  title,
  geojsonPath,
  jsonReportPath,
  onDataUpdated
}) => {
  /* context data */
  const {
    data,
    selectedPointId,
    selectedRow,
    setSelectedRow,
    setDetailsModalOpen,
    setSelectedPointId,
    // loadSectionData,
    updateMapCoordinates
  } = useSectionModal();

  const pathname = usePathname();
  const { confirm, alert /* choices, showModal, hideModal if needed */ } = useDialog();
  /* upload states */
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showDownloadModal, setShowDownloadModal] = useState(false);
  /* prevent scroll + esc key */
  useEffect(() => {
    if (showUploadModal || uploadMsg || uploadError) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
  }, [showUploadModal, uploadMsg, uploadError]);

  useEffect(() => {
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowUploadModal(false);
        setUploadMsg(null);
        setUploadError(null);
      }
    };
    window.addEventListener('keydown', onEsc);
    return () => window.removeEventListener('keydown', onEsc);
  }, []);

  /* auto-dismiss success after 10 s */
  useEffect(() => {
    if (uploadMsg) {
      const t = setTimeout(() => setUploadMsg(null), 10000);
      return () => clearTimeout(t);
    }
  }, [uploadMsg]);

  /* ───────────── table helpers ───────────── */
  const handleRowSelect = (row: any, idx: number) => {
    setSelectedRow(idx);
    updateMapCoordinates(row.x, row.y);
    setDetailsModalOpen(true);
    setSelectedPointId(row.sectionId);
    // loadSectionData(row.sectionId, pathname);
  };

  const handleMapClick = (row: any, idx: number) => {
    setSelectedRow(idx);
    updateMapCoordinates(row.x, row.y);
    setSelectedPointId(row.sectionId);
    // loadSectionData(row.sectionId, pathname);
  };

  /* download all */
  const handleDownloadAll = () => {
    if (!data?.length) return;
    setShowDownloadModal(true);
  };

  const downloadAsCSV = () => {
    const headers = Object.keys(data[0].properties ?? data[0]);
    const csvRows = [
      headers.join(','),
      ...data.map((feature: any) => {
        const row = feature.properties || feature;
        return headers
          .map(h => `"${(row[h] ?? '').toString().replace(/"/g, '""')}"`)
          .join(',');
      })
    ];
    const blob = new Blob([csvRows.join('\n')], { type: 'text/csv' });
    triggerDownload(blob, 'data.csv');
  };

  const downloadAsGeoJSON = () => {
    const geojson = {
      type: 'FeatureCollection',
      name: 'downloaded_data',
      crs: {
        type: 'name',
        properties: {
          name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
        }
      },
      features: data.map((feature: any, idx: number) => ({
        type: 'Feature',
        geometry: feature.geometry ?? {
          type: 'Point',
          coordinates: [
            parseFloat(feature.x ?? feature.properties?.x ?? 0),
            parseFloat(feature.y ?? feature.properties?.y ?? 0)
          ]
        },
        properties: {
          ...(feature.properties ?? feature),
          index: idx + 1
        }
      }))
    };
    const blob = new Blob([JSON.stringify(geojson, null, 2)], { type: 'application/json' });
    triggerDownload(blob, 'data.geojson');
  };

  const triggerDownload = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setShowDownloadModal(false);
  };
  const validateHeaders = (
    uploadedObjects: Record<string, any>[],
    templateHeaders: string[]
  ) => {
    if (!uploadedObjects.length) {
      throw new Error('No data rows found in the file.');
    }

    const uploadedHeaders = Object.keys(uploadedObjects[0] ?? {});
    const same =
      uploadedHeaders.length === templateHeaders.length &&
      uploadedHeaders.every((h, i) => h.trim() === templateHeaders[i]);

    if (same) return; // ✅ all good

    const problems: string[] = [];
    if (uploadedHeaders.length !== templateHeaders.length) {
      problems.push(
        `Expected ${templateHeaders.length} columns but found ${uploadedHeaders.length}`
      );
    }
    templateHeaders.forEach((exp, i) => {
      const found = uploadedHeaders[i];
      if (exp !== found) {
        problems.push(`Column ${i + 1}: expected "${exp}", found "${found ?? 'N/A'}"`);
      }
    });

    throw new Error(
      `The file structure does not match the current template.\n\n` +
      (problems.length ? problems.join('\n') : 'Header mismatch.')
    );
  };
  const toGeoJSONFeature = (entry: any, index: number) => {
    // If already a Feature, return as-is
    if (entry.type === 'Feature' && entry.geometry && entry.properties) return entry;

    const x = parseFloat(entry.x ?? entry['start_lon'] ?? 0);
    const y = parseFloat(entry.y ?? entry['start_lat'] ?? 0);

    return {
      type: 'Feature',
      geometry: {
        type: 'Point',
        coordinates: [x, y]
      },
      properties: {
        ...entry,
        x,
        y,
        index: index + 1
      }
    };
  };
  const handleDeleteRow = async (indexToRemove: number) => {
    const ok = await confirm(
      'Delete this record?',
      'This action cannot be undone.',
      { okText: 'Delete', cancelText: 'Cancel', variant: 'warning' }
    );
    if (!ok) return;

    const updated = [...data];
    updated.splice(indexToRemove, 1);

    const features = updated.map((item, i) => ({
      type: 'Feature',
      geometry: item.geometry ?? {
        type: 'Point',
        coordinates: [
          parseFloat(item.x ?? item.properties?.x ?? 0),
          parseFloat(item.y ?? item.properties?.y ?? 0),
        ]
      },
      properties: {
        ...(item.properties ?? item),
        index: i + 1,
      }
    }));

    const updatedGeoJSON = {
      type: 'FeatureCollection',
      name: 'updated_data',
      crs: {
        type: 'name',
        properties: {
          name: 'urn:ogc:def:crs:OGC:1.3:CRS84',
        }
      },
      features
    };

    try {
      await saveToBackend(geojsonPath, updatedGeoJSON);
      await alert('Deleted', 'The record was deleted and saved.', 'success');
    } catch (err: any) {
      await alert('Delete failed', err?.message ?? 'Failed to delete record.', 'error');
    } finally {
      if (onDataUpdated) onDataUpdated();
    }
  };

  /* upload logic */
  const handleUpload = useCallback(() => {
    if (!file || !data?.length) return;
    setUploading(true);
    setUploadError(null);

    const reader = new FileReader();

    const templateHeaders = Object.keys(data[0].properties ?? data[0]);
    reader.onload = e => {
      (async () => {
        try {
          const text = (await reader.result) as string;

          const fileName = geojsonPath.split('/').pop() ?? geojsonPath;

          // ────── CASE 1: .geojson or .json ──────
          if (file.name.endsWith('.geojson') || file.name.endsWith('.json')) {
            const parsed = JSON.parse(text);

            /* ----- 1. Plain array of property objects ----- */
            if (Array.isArray(parsed)) {
              validateHeaders(parsed, templateHeaders);
              await saveToBackend(geojsonPath, parsed);     // store array directly
            }

            /* ----- 2-3. FeatureCollection ----- */
            else if (parsed.type === 'FeatureCollection' && Array.isArray(parsed.features)) {

              // Always validate headers using properties array
              const propsArray = parsed.features.map((f: any) => f.properties ?? {});
              validateHeaders(propsArray, templateHeaders);

              // Check if every feature already has geometry
              const hasGeometry = parsed.features.every((f: any) => !!f.geometry);

              let geojsonToSave = parsed;                  // default: keep original

              /* 3. Rebuild geometry when missing ---------------------------------- */
              if (!hasGeometry) {
                const rebuiltFeatures = parsed.features.map((f: any, idx: number) => {
                  const p = f.properties ?? {};
                  const x = parseFloat(p.x ?? 0);
                  const y = parseFloat(p.y ?? 0);

                  return {
                    type: 'Feature',
                    geometry: {
                      type: 'Point',
                      coordinates: [x, y]
                    },
                    properties: {
                      ...p,
                      index: idx + 1
                    }
                  };
                });

                geojsonToSave = {
                  type: 'FeatureCollection',
                  name: fileName.replace(/\.[^/.]+$/, ''),
                  crs: {
                    type: 'name',
                    properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
                  },
                  features: rebuiltFeatures
                };
              }

              await saveToBackend(geojsonPath, geojsonToSave);
            }

            /* ----- Invalid JSON structure ----- */
            else {
              throw new Error('Invalid JSON format. Must be an array or a FeatureCollection.');
            }

            /* ----- Success feedback ----- */
            setUploadMsg(
              `Upload successful.\n` +
              `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)\n` +
              `Saved to: ${fileName}\n` +
              `Please refresh to see the new data.`
            );
            setShowUploadModal(false);
            return;
          }


          // ────── CASE 2: CSV file ──────
          if (file.name.endsWith('.csv')) {
            const result = Papa.parse<Record<string, string>>(text, {
              header: true,
              skipEmptyLines: true,
              dynamicTyping: false
            });

            if (result.errors.length) {
              throw new Error('CSV parse error: ' + result.errors.map(e => e.message).join('; '));
            }

            const uploadObjects = result.data;
            validateHeaders(uploadObjects, templateHeaders);
            const geojsonFeatures = uploadObjects.map((obj, idx) => {
              const x = parseFloat(obj['x']?.trim() ?? '');
              const y = parseFloat(obj['y']?.trim() ?? '');
              if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

              return {
                type: 'Feature',
                geometry: {
                  type: 'Point',
                  coordinates: [x, y]
                },
                properties: {
                  ...obj,
                  index: idx + 1
                }
              };
            }).filter(Boolean);

            const geojson = {
              type: 'FeatureCollection',
              name: fileName.replace(/\.[^/.]+$/, ''),
              crs: {
                type: 'name',
                properties: {
                  name: 'urn:ogc:def:crs:OGC:1.3:CRS84'
                }
              },
              features: geojsonFeatures
            };

            if (!geojson.features.length) {
              throw new Error('No valid features found in the CSV file.');
            }

            await saveToBackend(geojsonPath, geojson);
            setUploadMsg(
              `Upload successful.\n` +
              `File: ${file.name} (${(file.size / 1024).toFixed(1)} KB)\n` +
              `Saved to: ${fileName}\n` +
              `Please refresh to see the new data.`
            );
            setShowUploadModal(false);
            return;
          }

          // ────── Unsupported file type ──────
          throw new Error('Unsupported file type. Please upload a .csv or .geojson file.');
        } catch (err: any) {
          setUploadError(`Upload failed.\n\n${err.message}`);
        } finally {
          setUploading(false);
          setFile(null);
          if (onDataUpdated) onDataUpdated();
        }
      })();
    };

    reader.readAsText(file);
  }, [file, data, geojsonPath]);

  /* ───────────── render ───────────── */
  return (
    <>
      <SectionTable
        title={title}
        data={data}
        selectedPointId={selectedPointId}
        selectedRow={selectedRow}
        onDeleteRow={handleDeleteRow}
        onRowSelect={handleRowSelect}
        onMapClick={handleMapClick}
        onAddNew={() => setShowAddModal(true)}
        onDownloadAll={handleDownloadAll}
        onUploadAll={() => setShowUploadModal(true)}
      />
      {showAddModal && (
        <SectionEditModal
          title={"New Section Data"}
          isOpen={true}
          data={{}} // empty for new entry
          onClose={() => setShowAddModal(false)}
          onSave={async (newData) => {
            const newSectionId = newData['Test Section'] || `section-${Date.now()}`;
            const y = parseFloat(newData.x ?? newData['GPS (Start)']?.split(',')[0] ?? 0);
            const x = parseFloat(newData.y ?? newData['GPS (Start)']?.split(',')[1] ?? 0);
            console.log(newData['GPS (Start)'])
            console.log(x, y)
            const newFeature = {
              type: 'Feature',
              geometry: {
                type: 'Point',
                coordinates: [x, y]
              },
              properties: {
                ...newData,
                sectionId: newSectionId,
                x,
                y,
                index: data.length + 1,
              }
            };

            try {
              // Convert all existing entries into valid GeoJSON features
              const existingFeatures = data.map((d, i) => toGeoJSONFeature(d, i));

              const updatedGeoJSON = {
                type: 'FeatureCollection',
                name: 'updated_data',
                crs: {
                  type: 'name',
                  properties: { name: 'urn:ogc:def:crs:OGC:1.3:CRS84' }
                },
                features: [...existingFeatures, newFeature] // consistent format
              };

              await saveToBackend(geojsonPath, updatedGeoJSON);
              console.log('✅ New section saved to backend');

              setShowAddModal(false);
            } catch (err) {
              console.error('❌ Failed to save new section:', err);
              alert('Failed to save new section. Please try again.');
            } finally {
              if (onDataUpdated) onDataUpdated();
            }
          }}


        />
      )}

      {/* details modal from context */}
      <SectionDetailsModal geojsonPath={geojsonPath} />

      {/* download modal */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg max-w-sm w-full p-6 text-gray-900">
            <h2 className="text-lg font-semibold mb-4">Download Format</h2>
            <p className="mb-4">Choose a format:</p>
            <div className="flex justify-between space-x-4">
              <button
                onClick={downloadAsCSV}
                className="flex-1 bg-blue-600 text-white py-2 rounded hover:bg-blue-700"
              >
                CSV
              </button>
              <button
                onClick={downloadAsGeoJSON}
                className="flex-1 bg-green-600 text-white py-2 rounded hover:bg-green-700"
              >
                GeoJSON
              </button>
            </div>
            <div className="mt-4 text-right">
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-sm text-gray-600 hover:underline"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      {/* upload modal */}
      <UploadModal
        open={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        file={file}
        setFile={setFile}
        uploading={uploading}
        onUpload={handleUpload}
      />

      {/* success modal */}
      {uploadMsg && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-gray-900">
            <h2 className="text-lg font-semibold text-green-600 mb-2">
              Upload Complete
            </h2>
            <p className="whitespace-pre-wrap">{uploadMsg}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setUploadMsg(null)}
                className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}

      {/* error modal */}
      {uploadError && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-white rounded-xl shadow-lg max-w-md w-full p-6 text-red-800">
            <h2 className="text-lg font-semibold text-red-600 mb-2">
              Upload Failed
            </h2>
            <p className="whitespace-pre-wrap">{uploadError}</p>
            <div className="mt-4 flex justify-end">
              <button
                onClick={() => setUploadError(null)}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default TableAndModalWrapper;