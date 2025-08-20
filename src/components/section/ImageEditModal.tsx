"use client";

import React, { useState, useRef, useEffect } from "react";
import { FaTimes, FaUpload, FaTrash, FaSpinner, FaImage, FaSave } from "react-icons/fa";
import JSZip from "jszip";
import { API_GET_PROXY } from "@/lib/api";
import ReactDOM from "react-dom";
import { convertDate, formatToMMDDYY } from '@/lib/date';
import { usePathname } from "next/navigation";
import { useDialog } from '@/context/ModalContext';

interface EditableImage {
  path: string;
  file?: File;
  previewUrl?: string;
}

interface ImageEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectionId: string;
  currentImages: { date: string; images: EditableImage[] }[];
  onSave: (
    updatedImages: { date: string; images: EditableImage[] }[],
    done: () => void
  ) => void;
}

const isImage = (url: string) => /\.(jpe?g|png|gif|bmp|webp|svg)$/i.test(url);
const isVideo = (url: string) => /\.(mp4|mov|webm|ogg)$/i.test(url);
const ImageEditModal: React.FC<ImageEditModalProps> = ({
  isOpen,
  onClose,
  sectionId,
  currentImages,
  onSave,
}) => {
  const { alert, choices } = useDialog();
  const [images, setImages] = useState(currentImages);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedDateText, setSelectedDateText] = useState("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pathname = usePathname();
  useEffect(() => {
    setImages(currentImages);
  }, [currentImages]);
  if (!isOpen) return null;

  const canSave =
    selectedFiles.length === 0 ||
    images.some(g => g.images?.some(img => !!img.file));


const handleSave = async () => {
  if (!canSave) {
    const choice = await choices(
      'Upload required',
      <>
        You selected files but haven’t uploaded them yet.
        <br />
        What would you like to do?
      </>,
      {
        variant: 'warning',
        closeOnBackdrop: false,
        actions: [
          { key: 'continue', label: 'Save without selected files', variant: 'primary', autoFocus: true },
          { key: 'upload',   label: 'Upload now',                  variant: 'success' },
          // { key: 'clear',    label: 'Clear selected files',        variant: 'ghost' },
        ],
      }
    );

    if (choice === 'upload') {
      if (!isValidDate) {
        await alert('Select a date', <>Please choose a date before uploading.</>, 'warning');
        return;
      }
      await handleFileUpload({ target: { files: selectedFiles } } as unknown as React.ChangeEvent<HTMLInputElement>);
      return; // let the user review; they can click Save again (or you can auto-continue)
    }

    if (choice === 'clear') {
      setSelectedFiles([]);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    if (choice !== 'continue') {
      // dismiss/X or anything else → just return
      return;
    }
    // choice === 'continue' → fall through and save without selected files
  }

  setSaving(true);
  await onSave(images, () => {
    setSaving(false);
    onClose();
  });
};
  // const handleSave = async () => {
  //   setSaving(true);
  //   await onSave(images, () => {
  //     setSaving(false);
  //     onClose();
  //   });
  // };



  const compressImage = async (file: File): Promise<File> => {
    const imageBitmap = await createImageBitmap(file);

    const MAX_WIDTH = 1024;
    const isAlreadySmall = imageBitmap.width <= MAX_WIDTH;

    // Skip compression if image is small AND file size is already under 200 KB
    if (isAlreadySmall && file.size < 200 * 1024) {
      return file;
    }

    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");

    const scale = MAX_WIDTH / imageBitmap.width;
    canvas.width = MAX_WIDTH;
    canvas.height = imageBitmap.height * scale;

    ctx?.drawImage(imageBitmap, 0, 0, canvas.width, canvas.height);

    return new Promise(resolve => {
      canvas.toBlob(blob => {
        if (blob) {
          resolve(new File([blob], file.name, { type: "image/jpeg" }));
        } else {
          resolve(file);
        }
      }, "image/jpeg", 0.75);
    });
  };


  const compressVideo = async (file: File): Promise<File> => {
    const isAlreadySmall = file.size < 500 * 1024; // 500 KB (adjust as needed)
    if (isAlreadySmall) return file;

    const video = document.createElement("video");
    video.src = URL.createObjectURL(file);

    return new Promise(resolve => {
      video.onloadedmetadata = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");

        const MAX_WIDTH = 720;
        const scale = MAX_WIDTH / video.videoWidth;
        canvas.width = MAX_WIDTH;
        canvas.height = video.videoHeight * scale;

        video.currentTime = 0;

        video.onseeked = async () => {
          ctx?.drawImage(video, 0, 0, canvas.width, canvas.height);

          canvas.toBlob(blob => {
            if (blob) {
              const reduced = new File([blob], file.name.replace(/\.(mov)$/i, ".mp4"), {
                type: "video/mp4",
              });
              resolve(reduced);
            } else {
              resolve(file);
            }
          }, "video/mp4", 0.7);
        };
      };
    });
  };
  const isValidDate = /^\d{6}$/.test(selectedDateText);

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || []);
    if (!files.length || !isValidDate) return;

    setUploading(true);

    const entries: EditableImage[] = [];
    const pathBase = pathname.includes("level_one")
      ? `${pathname}sections/${sectionId}`
      : `${pathname}${sectionId}`;
    const jsonPath = `${pathBase}/survey_data/pictures`;

    try {
      for (const file of files) {
        if (file.name.endsWith(".zip")) {
          const zip = await JSZip.loadAsync(file);
          await Promise.all(
            Object.keys(zip.files).map(async (name) => {
              const entry = zip.files[name];
              if (!entry.dir) {
                const ext = name.split(".").pop()?.toLowerCase();
                const fileNameOnly = name.split("/").pop()!;
                const blob = await entry.async("blob");
                const rawFile = new File([blob], fileNameOnly);

                if (["jpg", "jpeg", "png"].includes(ext!)) {
                  const compressed = await compressImage(rawFile);
                  entries.push({
                    path: `${jsonPath}/${selectedDateText}/${compressed.name}`,
                    file: compressed,
                    previewUrl: URL.createObjectURL(compressed),
                  });
                } else if (["mov", "mp4"].includes(ext!)) {
                  const reducedVideo = await compressVideo(rawFile);
                  entries.push({
                    path: `${jsonPath}/${selectedDateText}/${reducedVideo.name}`,
                    file: reducedVideo,
                    previewUrl: URL.createObjectURL(reducedVideo),
                  });
                }
              }
            })
          );
        } else {
          const ext = file.name.split(".").pop()?.toLowerCase();
          if (["jpg", "jpeg", "png"].includes(ext!)) {
            const compressed = await compressImage(file);
            entries.push({
              path: `${jsonPath}/${selectedDateText}/${compressed.name}`,
              file: compressed,
              previewUrl: URL.createObjectURL(compressed),
            });
          } else if (["mov", "mp4"].includes(ext!)) {
            const reducedVideo = await compressVideo(file);
            entries.push({
              path: `${jsonPath}/${selectedDateText}/${reducedVideo.name}`,
              file: reducedVideo,
              previewUrl: URL.createObjectURL(reducedVideo),
            });
          }
        }
      }

      setImages(prev => {
        const index = prev.findIndex(g => g.date === selectedDateText);
        if (index >= 0) {
          const updated = [...prev];
          const group = { ...updated[index] };
          group.images = [...group.images, ...entries];
          updated[index] = group;
          return updated;
        } else {
          return [...prev, { date: selectedDateText, images: entries }];
        }
      });
    } catch (err) {
      console.error("Upload error:", err);
    } finally {
      setUploading(false);
      setSelectedFiles([]);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  };


  const handleDeleteImageGroup = (date: string) => {
    if (confirm(`Delete all images for ${date}?`)) {
      setImages(prev => prev.filter(img => img.date !== date));
    }
  };

  const handleDeleteSingleImage = async (date: string, imageIndex: number) => {
    setImages(prev => prev.map(group =>
      group.date === date
        ? { ...group, images: group.images.filter((_, idx) => idx !== imageIndex) }
        : group
    ));
  };


  // return ReactDOM.createPortal(
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[9999]">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-6xl max-h-[100vh] overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 bg-gradient-to-r from-green-600 to-green-700 text-white flex justify-between items-center">
          <h2 className="text-xl font-bold flex items-center gap-2">
            <FaImage />
            Edit Survey Images - {sectionId}
          </h2>
          <button onClick={onClose} className="text-white hover:text-gray-200 p-1">
            <FaTimes size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[50vh]">
          {/* Upload Section */}
          <div className="mb-6 p-4 border-2 border-dashed border-green-300 rounded-lg bg-green-50">
            <h3 className="text-lg font-semibold mb-4 text-green-800">Upload New Images</h3>

            <div className="flex gap-4 items-end mb-4">
              <div className="flex-1">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Select Date
                </label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => {
                    const rawDate = e.target.value; // "2023-08-30"
                    setSelectedDate(rawDate);
                    // const mmddyy = formatToMMDDYY(new Date(rawDate));
                    // Parse the date without timezone shift
                    const [year, month, day] = rawDate.split("-").map(Number);
                    const localDate = new Date(year, month - 1, day); // month is 0-indexed
                    const mmddyy = formatToMMDDYY(localDate);
                    setSelectedDateText(mmddyy); // MMDDYY format
                  }}
                  max={new Date().toISOString().split("T")[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>

              <div className="flex-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Upload ZIP, Image, or Video Files
                </label>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".zip,image/*,video/*"
                  multiple
                  // onChange={handleFileUpload}
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    setSelectedFiles(files);
                  }}
                  disabled={uploading || !isValidDate}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 disabled:bg-gray-100"
                />
              </div>

              <button
                // onClick={() => fileInputRef.current?.click()}
                onClick={() => handleFileUpload({ target: { files: selectedFiles } } as any)}
                disabled={uploading || !isValidDate || selectedFiles.length === 0}
                // disabled={uploading || !isValidDate}
                className="px-6 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 disabled:bg-gray-400 flex items-center gap-2 min-w-[120px] justify-center"
              >
                {uploading ? <FaSpinner className="animate-spin" /> : <FaUpload />}
                {uploading ? 'Uploading...' : 'Upload'}
              </button>
            </div>
          </div>

          {/* Current Images */}
          <div className="space-y-6">
            <h3 className="text-lg font-semibold text-gray-800 border-b pb-2">Current Images</h3>

            {images.length === 0 ? (
              <div className="text-center py-12 bg-gray-50 rounded-lg">
                <FaImage className="mx-auto text-gray-400 text-4xl mb-4" />
                <p className="text-gray-500 text-lg">No images available</p>
                <p className="text-gray-400 text-sm">Upload ZIP files to add survey images</p>
              </div>
            ) : (
              images.map((imageGroup, index) => (
                <div key={index} className="border rounded-lg p-4 bg-gray-50">
                  <div className="flex justify-between items-center mb-4">
                    <h4 className="font-medium text-gray-800 text-lg">
                      {convertDate(imageGroup.date) || imageGroup.date}
                    </h4>
                    <button
                      onClick={() => handleDeleteImageGroup(imageGroup.date)}
                      className="text-red-600 hover:text-red-800 flex items-center gap-2 px-3 py-1 border border-red-300 rounded-md hover:bg-red-50"
                    >
                      <FaTrash size={14} />
                      Delete All ({imageGroup.images.length})
                    </button>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
                    {imageGroup.images.map((image, imgIndex) => (
                      <div key={imgIndex} className="relative group">
                        <div className="aspect-square bg-gray-200 rounded-lg overflow-hidden border">
                          {
                            isImage(image.path) ? (
                              <img
                                src={image.previewUrl || `${API_GET_PROXY}${image.path}`}
                                alt={`Thumbnail ${imgIndex}`}
                                className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                              // onClick={() => window.open(`${API_GET_PROXY}${image.path}`, '_blank')}
                              />
                            ) : isVideo(image.path) ? (
                              <video
                                src={image.previewUrl || `${API_GET_PROXY}${image.path}`}
                                className="w-full h-full object-cover hover:scale-105 transition-transform cursor-pointer"
                                muted
                                playsInline
                              // onClick={() => window.open(`${API_GET_PROXY}${image.path}`, '_blank')}
                              />
                            ) : null
                          }
                        </div>

                        <button
                          onClick={() => handleDeleteSingleImage(imageGroup.date, imgIndex)}
                          className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                        >
                          <FaTimes size={10} />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 flex justify-between items-center border-t">
          <div className="text-sm text-gray-600">
            Total: <strong>{images.reduce((sum, group) => sum + group.images.length, 0)}</strong> images
            across <strong>{images.length}</strong> date groups
          </div>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-100"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || uploading}
              className="px-4 py-2 bg-green-600 text-white rounded-md hover:bg-green-700 flex items-center gap-2 disabled:bg-gray-400"
            >
              {/* {uploading ? <FaSpinner className="animate-spin" /> : null} */}
              {saving ? <FaSpinner className="animate-spin" /> : <FaSave />}
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
    // ,document.body
  );



};

export default ImageEditModal;
