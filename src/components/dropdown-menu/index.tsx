import React from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  DropdownMenu as DropdownMenuRoot,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

interface Props {
  items: { id: string | number; label: string }[];
  selectedItems: { id: string | number; label: string }[];
  setSelectedItems: (items: { id: string | number; label: string }[]) => void;
  width?: string;
  type?: string;
}

const CustomDropdownMenu: React.FC<Props> = ({
  items,
  selectedItems,
  setSelectedItems,
  width,
  type,
}) => {
  const handleSelect = (item: { id: string | number; label: string }) => {
    if (item.label === "Select All") {
      // If Select All is clicked and not all items are selected, select all items except "Select All"
      if (selectedItems.length < items.length - 1) {
        setSelectedItems(items.filter((i) => i.label !== "Select All"));
      } else {
        // If all items are selected, deselect all
        setSelectedItems([]);
      }
    } else {
      const isSelected = selectedItems.some(
        (selected) => selected.id === item.id
      );
      if (isSelected) {
        setSelectedItems(selectedItems.filter((i) => i.id !== item.id));
      } else {
        setSelectedItems([...selectedItems, item]);
      }
    }
  };

  return (
    <DropdownMenuRoot>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "justify-between group",
            width ? `w-[${width}]` : "w-[200px]"
          )}
        >
          <div className="flex-1 overflow-x-auto whitespace-nowrap scrollbar-thin">
            {selectedItems.length > 0
              ? selectedItems.length === items.length - 1
                ? "All Selected"
                : selectedItems.map((item) => item.label).join(", ")
              : `Select ${type || "items"}...`}
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-[200px]">
        <DropdownMenuItem
          key="select-all"
          onSelect={() =>
            handleSelect({ id: "select-all", label: "Select All" })
          }
        >
          Select All
        </DropdownMenuItem>
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            onSelect={() => handleSelect(item)}
            className="flex items-center gap-2"
          >
            <div
              className={cn(
                "w-4 h-4 border rounded",
                selectedItems.some((selected) => selected.id === item.id)
                  ? "bg-primary border-primary"
                  : "border-input"
              )}
            />
            {item.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenuRoot>
  );
};

export default CustomDropdownMenu;
