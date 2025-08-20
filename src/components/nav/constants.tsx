import { Icon } from '@iconify/react';

import { SideNavItem } from "./types";

export const SIDENAV_ITEMS: SideNavItem[] = [
  
  {
    title: "Home",
    name: "home",
    path: "/",
    icon: <Icon icon="mdi:home" />,
    content: "Home page with latest updates and announcements",
    submenu: false,
    allowedRoles: ["admin", "user", "guest"],
  },
  {
    title: "General",
    name: "general",
    path: "/general/",
    submenu: true,
    icon: <Icon icon="mdi:chart-box-outline" />,
    allowedRoles: ["admin", "user"],
    subMenuItems: [
      { 
        title: "Lane Miles", 
        name: "lane-miles",
        path: "/general/lane-miles/", 
        content: "Lane miles vs Year chart for specific combinations of filter",
        size: `13px`
      },
      {
        // New nested PMIS Data item with two submenu options
        title: "PMIS Data",
        name: "pmis-data",
        // Optionally you may leave the parent path empty (or assign a fallback route)
        path: "/general/pmis/",
        submenu: true,
        size: `13px`,
        subMenuItems: [
          {
            title: "Highway Heatmaps",
            name: "highway-heatmaps",
            path: "/general/pmis/highway-heatmaps/",
            content: "Highway Condition & Traffic Analysis",
            size: `13px`
          },
          {
            title: "Condition Analysis",
            name: "condition-analysis",
            path: "/general/pmis/condition-analysis/",
            content: "Distress Score (DS), Ride Score (RS), and Condition Score (= DS*RS)",
            size: `13px`
          }
        ]
      },
      { 
        title: "Traffic Data", 
        name: "traffic-data",
        path: "/general/traffic-data/", 
        content: "Average Annual Daily Traffic (AADT), Truck Percentage displayed as data points on a map, and Truck Percentage (Plot View)",
        size: `13px`
      },
    ],
  },  
  {
    title: "PCA",
    name: "pca",
    path: "/pca/",
    submenu: false,
    icon: <Icon icon="mdi:chart-scatter-plot" />,
    allowedRoles: ["admin", "user"],
  },
];

