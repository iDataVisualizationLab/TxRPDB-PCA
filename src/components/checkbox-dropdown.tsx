"use client"

import * as React from "react"
import { ChevronsUpDown } from 'lucide-react'

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
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

interface CheckboxDropdownProps {
  items: Item[]
  selectedItems: Item[]
  type?: string
  setSelectedItems: React.Dispatch<React.SetStateAction<Item[]>>
  width?: string
}

export function CheckboxDropdown({ items, type, selectedItems, setSelectedItems, width = "150px" }: CheckboxDropdownProps) {
  const handleItemToggle = (item: Item) => {
    setSelectedItems((prev) =>
      prev.some((selectedItem) => selectedItem.id === item.id)
        ? prev.filter((selectedItem) => selectedItem.id !== item.id)
        : [...prev, item]
    )
  }

  const handleSelectAll = () => {
    setSelectedItems(selectedItems.length === items.length ? [] : items)
  }

  const getSelectedLabels = () => {
    return selectedItems.map((item) => item.label).join(", ")
  }

  const isAllSelected = selectedItems.length === items.length

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className={cn("justify-between group", width ? `w-[${width}]` : "w-[200px]")}>
          <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100 group-hover:scrollbar-thumb-gray-400">
            {selectedItems.length > 0 ? (
              <span className="truncate">{getSelectedLabels()}</span>
            ) : (
              `Select ${type ? type : "Items"}`
            )}
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50 flex-none" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className={cn(width ? `w-[${width}]` : "w-[150px]")}>
        <DropdownMenuLabel>Select {type ? type : "Items"}</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem 
          onSelect={(event) => {
            event.preventDefault()
            handleSelectAll()
          }}
          className="flex items-center space-x-2"
        >
          <Checkbox
            checked={isAllSelected}
            onCheckedChange={handleSelectAll}
          />
          <label className="flex-grow cursor-pointer font-medium">
            Select All
          </label>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <div className="max-h-[240px] overflow-y-auto">
          {items.map((item) => (
            <DropdownMenuItem
              key={item.id}
              onSelect={(event) => {
                event.preventDefault()
                handleItemToggle(item)
              }}
              className="flex items-center space-x-2"
            >
              <Checkbox
                id={`checkbox-${item.id}`}
                checked={selectedItems.some((selectedItem) => selectedItem.id === item.id)}
                onCheckedChange={() => handleItemToggle(item)}
              />
              <label
                htmlFor={`checkbox-${item.id}`}
                className="flex-grow cursor-pointer"
              >
                {item.label}
              </label>
            </DropdownMenuItem>
          ))}
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

