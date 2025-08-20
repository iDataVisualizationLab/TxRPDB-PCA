import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function cleanAndRound(value: any): number {
  if (value === null || typeof value === "undefined") return 0.0
  // Convert to string and remove any characters that are not digits or a decimal point.
  const cleaned = String(value).replace(/[^0-9.]/g, "")
  if (cleaned === "") return 0.0
  const num = parseFloat(cleaned)
  if (isNaN(num)) return 0.0
  // Round to 3 decimal places to preserve precision for short segments.
  return Number(num.toFixed(3))
} 