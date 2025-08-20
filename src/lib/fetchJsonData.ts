// lib/fetchJsonData.ts

export async function fetchJsonData(
    surveyDataPath: string,
    // surveyImagesPath: string,
    planSetPath: string
  ): Promise<{
    surveyData: Record<string, any>;
    // surveyImages: any[];
    planSet: any[];
  }> {
    const [surveyData, planSet] = await Promise.all([
    // const [surveyData, surveyImages, planSet] = await Promise.all([
      fetchJson(surveyDataPath),
      // fetchJson(surveyImagesPath),
      fetchJson(planSetPath),
    ]);
  
    return {
      surveyData,
      // surveyImages,
      planSet,
    };
  }
  
  async function fetchJson(path: string): Promise<any> {
    try {
      const response = await fetch(path);
      if (!response.ok) {
        console.warn(`Failed to fetch ${path}: ${response.statusText}`);
        return path.endsWith('.json') ? (path.includes('picture_dates') ? [] : {}) : null;
      }
      return await response.json();
    } catch (error) {
      console.error(`Error fetching ${path}:`, error);
      return path.endsWith('.json') ? (path.includes('picture_dates') ? [] : {}) : null;
    }
  }
  