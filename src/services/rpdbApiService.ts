"use client"

interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
}

interface SectionData {
  sectionId: string
  survey_images?: { date: string; images: string[] }[]
  images?: { date: string; images: string[] }[]
  deflection_data?: any[]
  Deflection?: any[]
  lte_data?: any[]
  LTE?: any[]
  [key: string]: any
}

export class RPDBApiService {
  private static baseUrl = 'https://rpdb-backend-eqgxdrekhegcdmdn.eastus-01.azurewebsites.net'
  private static mockMode = true // Set to true for testing

  // Helper function to convert unknown error to string
  private static getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
      return error.message
    }
    return String(error)
  }

  static async getSectionData(sectionId: string): Promise<ApiResponse<SectionData>> {
    if (this.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 1000))
      console.log('MOCK: Getting section data for:', sectionId)
      return {
        success: true,
        data: {
          sectionId,
          District: "3",
          County: "Tarrant",
          Highway: "135",
          deflection_data: [
            { DMI: 0, Summer_23: 100, Winter_22: 95 },
            { DMI: 1, Summer_23: 102, Winter_22: 97 }
          ],
          lte_data: [
            { Year: 2023, Winter: 85, Summer: 90 },
            { Year: 2024, Winter: 88, Summer: 92 }
          ]
        }
      }
    }

    try {
      console.log('Fetching section data from Azure backend:', sectionId)
      
      const response = await fetch(`${this.baseUrl}/api/sections/${sectionId}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        }
      })
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }
      
      const data = await response.json()
      console.log('Section data received from Azure:', data)
      return { success: true, data }
    } catch (error) {
      console.error('Azure API Error:', error)
      return { success: false, error: `Failed to fetch section data: ${this.getErrorMessage(error)}` }
    }
  }

  static async updateSectionData(sectionId: string, updateData: any): Promise<ApiResponse> {
    if (this.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 1500))
      console.log('MOCK: Updating section data for:', sectionId, 'Data:', updateData)
      return {
        success: true,
        data: { message: 'Mock update successful', sectionId, updateData }
      }
    }

    try {
      console.log('Updating section data on Azure backend:', sectionId, updateData)
      
      const response = await fetch(`${this.baseUrl}/api/sections/${sectionId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(updateData)
      })
      
      if (!response.ok) {
        throw new Error(`Update failed: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('Section data updated on Azure:', result)
      return { success: true, data: result }
    } catch (error) {
      console.error('Azure API Error:', error)
      return { success: false, error: `Failed to update section data: ${this.getErrorMessage(error)}` }
    }
  }

  static async uploadImages(sectionId: string, date: string, file: File): Promise<ApiResponse> {
    if (this.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 2000))
      console.log('MOCK: Uploading image for:', sectionId, 'Date:', date, 'File:', file.name)
      return {
        success: true,
        data: {
          images: [
            `/data/sections/${sectionId}/images/${date}/image1.jpg`,
            `/data/sections/${sectionId}/images/${date}/image2.jpg`,
            `/data/sections/${sectionId}/images/${date}/image3.jpg`
          ]
        }
      }
    }

    try {
      console.log('Uploading images to Azure backend:', sectionId, date, file.name)
      
      const formData = new FormData()
      formData.append('file', file)
      formData.append('sectionId', sectionId)
      formData.append('date', date)
      
      const response = await fetch(`${this.baseUrl}/api/sections/${sectionId}/images`, {
        method: 'POST',
        body: formData
      })
      
      if (!response.ok) {
        throw new Error(`Upload failed: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('Images uploaded to Azure:', result)
      return { success: true, data: result }
    } catch (error) {
      console.error('Azure Upload Error:', error)
      return { success: false, error: `Failed to upload images: ${this.getErrorMessage(error)}` }
    }
  }

  static async deleteImages(sectionId: string, imagePath: string): Promise<ApiResponse> {
    if (this.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log('MOCK: Deleting image for:', sectionId, 'Path:', imagePath)
      return {
        success: true,
        data: { message: 'Mock delete successful' }
      }
    }

    try {
      console.log('Deleting image from Azure backend:', sectionId, imagePath)
      
      const response = await fetch(`${this.baseUrl}/api/sections/${sectionId}/images`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ imagePath })
      })
      
      if (!response.ok) {
        throw new Error(`Delete failed: ${response.status}`)
      }
      
      const result = await response.json()
      console.log('Image deleted from Azure:', result)
      return { success: true, data: result }
    } catch (error) {
      console.error('Azure Delete Error:', error)
      return { success: false, error: `Failed to delete image: ${this.getErrorMessage(error)}` }
    }
  }

  static async testConnection(): Promise<ApiResponse> {
    if (this.mockMode) {
      await new Promise(resolve => setTimeout(resolve, 500))
      console.log('MOCK: Backend connection test successful')
      return { 
        success: true, 
        data: { 
          status: 'Mock mode active',
          message: 'Frontend-only testing mode. Set mockMode to false when backend is ready.'
        }
      }
    }

    try {
      console.log('Testing connection to Azure backend...')
      
      const response = await fetch(`${this.baseUrl}/docs`, {
        method: 'HEAD'
      })
      
      if (!response.ok) {
        throw new Error(`Backend unreachable: ${response.status}`)
      }
      
      console.log('Azure backend connection successful!')
      return { 
        success: true, 
        data: { 
          status: 'Connected to Azure backend',
          url: this.baseUrl,
          message: 'Backend is accessible'
        }
      }
    } catch (error) {
      console.error('Azure backend connection failed:', error)
      return { 
        success: false, 
        error: `Azure backend connection failed: ${this.getErrorMessage(error)}` 
      }
    }
  }
}