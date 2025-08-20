"use client"

import { useGlobalLoading } from "@/context/GlobalLoadingContext"
import { useEffect, useState } from "react"

export default function GlobalContentLoader() {
  const { loading } = useGlobalLoading()
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    if (loading) {
      // Make the loader visible
      setVisible(true)
    } else {
      // Add a small delay before hiding to prevent flashing for quick operations
      const timeout = setTimeout(() => {
        setVisible(false)
      }, 300)

      return () => clearTimeout(timeout)
    }
  }, [loading])

  if (!visible && !loading) return null

  return (
    <div className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center">
      <div className="flex flex-col items-center justify-center">
        <div className="h-6 w-6 rounded-full border-2 border-gray-300 border-t-blue-500 animate-spin"></div>
        <p className="mt-2 text-sm font-medium text-gray-700">Loading...</p>
      </div>
    </div>
  )
}
