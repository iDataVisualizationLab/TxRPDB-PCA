"use client"

import * as React from "react"
import { ChevronsUpDown } from 'lucide-react'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"

export interface Item {
  id: number
  label: string
}

interface RadioDropdownProps {
  items: Item[]
  selectedItem: Item | null
  type?: string
  setSelectedItem: React.Dispatch<React.SetStateAction<Item | null>>
  width?: string
}

export function RadioDropdown({ items, type, selectedItem, setSelectedItem, width = "200px" }: RadioDropdownProps) {
  const handleItemSelect = (item: Item | null) => {
    setSelectedItem(item)
  }

  const getSelectedLabel = () => {
    return selectedItem ? selectedItem.label : ""
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("justify-between group", width ? `w-[${width}]` : "w-[200px]")}>
          <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 group-hover:scrollbar-thumb-gray-400">
            {selectedItem ? (
              <span className="truncate">{getSelectedLabel()}</span>
            ) : (
              `Select ${type ? type : "Item"}`
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-none" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn(width ? `w-[${width}]` : "w-[200px]")}>
        <DropdownMenuLabel>Select {type ? type : "Item"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <div className="max-h-[240px] overflow-y-auto">
          <RadioGroup value={selectedItem?.id.toString()} onValueChange={(value) => handleItemSelect(items.find(item => item.id.toString() === value) || null)}>
            {items.map((item) => (
              <DropdownMenuItem
                key={item.id}
                onSelect={(event) => {
                  event.preventDefault()
                  handleItemSelect(item)
                }}
                className="flex items-center space-x-2"
              >
                <RadioGroupItem
                  id={`radio-${item.id}`}
                  value={item.id.toString()}
                />
                <label
                  htmlFor={`radio-${item.id}`}
                  className="flex-grow cursor-pointer"
                >
                  {item.label}
                </label>
              </DropdownMenuItem>
            ))}
          </RadioGroup>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}