"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { SIDENAV_ITEMS } from "@/components/nav/constants";
import { SideNavItem } from "@/components/nav/types";
import { ScrollArea } from "../ui/scroll-area";
import { baseMaps } from "@/constants/mapConstants";
import { useMap } from "@/context/MapContext";
import { Icon } from "@iconify/react";
import {
  Accordion,
  AccordionItem,
  AccordionTrigger,
  AccordionContent
} from "@/components/ui/accordion";
import { route } from "@/config";

import Image from 'next/image';


const SideNav = () => {
  const { basemapUrl, setBasemapUrl } = useMap();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("role") || "guest";
    setRole(storedRole);
  }, []);
  if (!role) return null;

  return (
    <aside className="md:w-60 h-screen fixed hidden md:flex flex-col bg-[var(--theme-color)] text-[var(--theme-foreground)] shadow-xl">
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 h-16">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src={`${route}/img/txdot-logo.png`}
            alt="Logo"
            width={32} // Adjust width as needed
            height={32} // Adjust height as needed
            className="h-8 w-auto object-contain rounded-lg"
            style={{ imageRendering: "auto" }}
          />
          <span className="font-semibold text-lg tracking-wide">RPDB v3.4</span>
        </Link>
      </div>

      {/* Scrollable nav + base map in one ScrollArea */}
      <ScrollArea className="flex-1">
        <nav className="flex flex-col gap-1 px-2 py-4">
          {/* Main Navigation */}
          <div className="flex flex-col gap-1 mt-4">
            {/* <label className="text-[10px] font-medium text-[var(--theme-foreground)] px-1 mb-0.5">Main Menu</label> */}
            {SIDENAV_ITEMS
              .filter((item) => item.allowedRoles?.includes(role))
              .map((item) => (
                <RecursiveMenuItem key={item.name} item={item} />
              ))}
          </div>

        </nav>
      </ScrollArea>
    </aside>

  );
};

export default SideNav;

const itemBaseClass =
  "p-1.5 px-3 rounded-xl transition-colors duration-200 text-sm";

const RecursiveMenuItem = ({ item, depth = 0 }: { item: SideNavItem; depth?: number }) => {
  const pathname = usePathname();
  const isActive = item.path
    ? item.path === '/'
      ? pathname === '/'
      : pathname.startsWith(item.path)
    : false;

  const fontClass = isActive ? "font-medium" : "font-normal";
  const activeClass = isActive
    ? 'bg-[var(--theme-active)] text-[var(--theme-foreground)] shadow-sm font-medium'
    : 'bg-[var(--theme-shade)] hover:bg-[var(--theme-hover)] font-normal';

  const indent = `pl-${Math.min(depth * 4, 12)}`;
  const content = (
    <div className={`flex items-center gap-3  ${item.size ? `text-[${item.size}]` : ''}`}>
      {item.icon && <span className="text-lg">{item.icon}</span>}
      <span>{item.title}</span>
    </div>
  );
  if (item.submenu && item.subMenuItems && item.subMenuItems.length > 0) {
    return (
      <Accordion type="single" collapsible>
        <AccordionItem value={item.name} className="rounded-xl !border-none before:!hidden bg-[var(--theme-shade)]">
          <AccordionTrigger showArrow className={`${itemBaseClass} ${fontClass} ${activeClass}text-left w-full ${indent}`}>
            {content}
          </AccordionTrigger>
          <AccordionContent>
            <div className="flex flex-col gap-1 pl-4 mt-1 ">
              {item.subMenuItems
                .slice()
                .sort((a, b) => a.name.localeCompare(b.name))
                .map((subItem) => (
                  <RecursiveMenuItem
                    key={subItem.name}
                    item={subItem}
                    depth={depth + 1}
                  />
                ))
              }
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    );
  }

  return (
    <Link href={item.path} className={` ${itemBaseClass} ${fontClass}  ${activeClass} ${indent} `}>
      {content}
    </Link>
  );
};
