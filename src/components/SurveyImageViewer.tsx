import React from 'react';
import ImageGallery from "@/components/img/ImageGallery";

interface SurveyImage {
  imageName: string;
  imagePath: string;
}

interface SurveyImageGroup {
  surveyId: string;
  date?: string | null;
  images: SurveyImage[];
}

interface SurveyImageViewerProps {
  surveyImages: SurveyImage[];
}

const SurveyImageViewer: React.FC<SurveyImageViewerProps> = ({ surveyImages }) => {
  const convertDate = (dateStr: string | null | undefined): string => {
    if (!dateStr) return "Unknown Date";
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? "Invalid Date" : date.toLocaleDateString();
  };

  const uniqueSurveyImages = React.useMemo(() => {
    if (!surveyImages || surveyImages.length === 0) return [];

    const grouped = surveyImages.reduce((acc: Record<string, any>, image: any) => {
      const surveyId = image.surveyId || 'unknown';
      if (!acc[surveyId]) {
        acc[surveyId] = {
          surveyId,
          date: image.date || null,
          images: []
        };
      }
      acc[surveyId].images.push(image);
      return acc;
    }, {});

    return Object.values(grouped) as SurveyImageGroup[];
  }, [surveyImages]);

  if (uniqueSurveyImages.length === 0) {
    return <div>No images available.</div>;
  }

  return (
    <>
      {uniqueSurveyImages.map((group) => (
        <div key={group.date} className="mb-6">
          <h5 className="font-medium text-gray-700 mb-2">{convertDate(group.date)}</h5>
          <div className="bg-gray-50 p-3 rounded-lg">
            <ImageGallery images={group.images.map(img => img.imagePath)} />
          </div>
        </div>
      ))}
    </>
  );
};

export default SurveyImageViewer;