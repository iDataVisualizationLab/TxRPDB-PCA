// src/components/Header.tsx
'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '@iconify/react';
import Image from 'next/image';
import useScroll from '@/hooks/use-scroll';
import { cn } from '@/lib/utils';
import { baseMaps } from '@/constants/mapConstants';
import { themes, type Theme } from '@/constants/themeConstants';
import { useMap } from '@/context/MapContext';
import { logoutUser } from '@/lib/api/users';
import { clearAuth } from '@/lib/auth';
import { sideApps } from './sideApps';
export default function Header() {
  const router = useRouter();
  const scrolled = useScroll(5);
  const { basemapUrl, setBasemapUrl, mapOpacity, setMapOpacity } = useMap();

  // dropdown state
  const [open, setOpen] = useState(false);
  const [sub, setSub] = useState<'basemap' | 'theme' | 'sideapps' | null>(null);
  const [selectedTheme, setSelectedTheme] = useState<Theme>(themes[0]);
  const [username, setUsername] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [openMenu, setOpenMenu] = useState<'basemap' | 'theme' | 'sideapps' | null>(null);
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    const storedRole = localStorage.getItem("role") ?? "guest";
    setRole(storedRole);
  }, []);
  useEffect(() => {
    const uname = localStorage.getItem('username');
    const guestFlag = localStorage.getItem('guest') === 'true';
    setUsername(uname);
    setIsGuest(guestFlag);
  }, []);

  // close menus on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.user-menu')) {
        setOpen(false);
        setSub(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest('.menu-container')) {
        setOpenMenu(null);
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);
  // logout
  const handleLogout = async () => {
    if (isGuest) {
      router.replace("/login");
    } else {
      await logoutUser();   // API call
      clearAuth();        // Clear localStorage
      router.replace("/login");
    }
  };


  // apply theme vars
  useEffect(() => {
    Object.entries({
      '--theme-color': selectedTheme.color,
      '--theme-foreground': selectedTheme.foreground,
      '--theme-hover': selectedTheme.hover,
      '--theme-active': selectedTheme.active,
      '--theme-shade': selectedTheme.shade,
    }).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
  }, [selectedTheme]);

  if (!role) return null;
  return (
    <header
      className={cn(
        'sticky top-0 z-30 w-full transition-colors duration-300',
        scrolled
          ? 'bg-[var(--theme-color)]/75 backdrop-blur-sm'
          : 'bg-[var(--theme-color)]'
      )}
    >
      <div className="flex h-12 items-center justify-end px-6">
        {/* Right side: Menus */}
        <div className="flex items-center space-x-4">
          {/* Base Map */}
          <div className="relative inline-block menu-container">
            <button
              onClick={() =>
                setOpenMenu(openMenu === 'basemap' ? null : 'basemap')
              }
              className="text-sm px-2 py-1 rounded hover:bg-[var(--theme-hover)]"
            >
              Base Map
            </button>
            {openMenu === 'basemap' && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--theme-color)] border border-[var(--theme-shade)] shadow-lg rounded origin-top-right">
                {baseMaps.map((bm) => (
                  <button
                    key={bm.id}
                    onClick={() => {
                      setBasemapUrl(bm.url);
                      setOpenMenu(null);
                    }}
                    className={cn(
                      'flex items-center justify-between w-full px-3 py-2 text-xs rounded-md transition',
                      basemapUrl === bm.url
                        ? 'bg-[var(--theme-active)] text-[var(--theme-foreground)] font-semibold shadow-inner'
                        : 'hover:bg-[var(--theme-hover)]'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {bm.icon ? (
                        <Image
                          src={bm.icon}
                          alt={bm.name}
                          width={36}
                          height={36}
                          className="object-contain"
                        />
                      ) : (
                        <span className="w-6 h-6" />
                      )}
                      <span>{bm.name}</span>
                    </div>

                    {basemapUrl === bm.url && (
                      <Icon icon="mdi:check" className="w-4 h-4" />
                    )}
                  </button>
                ))}
                {/* Opacity Slider */}
                <div className="px-3 py-2 border-t border-[var(--theme-shade)]">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs">Map Opacity</span>
                    <span className="text-xs">{mapOpacity}%</span>
                  </div>
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={mapOpacity}
                    onInput={(e) => setMapOpacity(Number(e.currentTarget.value))}
                    className="w-full h-2 bg-[var(--theme-shade)] rounded-lg appearance-none cursor-pointer"
                    style={{
                      background: `linear-gradient(to right, var(--theme-active) ${mapOpacity}%, var(--theme-shade) ${mapOpacity}%)`
                    }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Theme */}
          <div className="relative inline-block menu-container">
            <button
              onClick={() =>
                setOpenMenu(openMenu === 'theme' ? null : 'theme')
              }
              className="text-sm px-2 py-1 rounded hover:bg-[var(--theme-hover)]"
            >
              Theme
            </button>
            {openMenu === 'theme' && (
              <div className="absolute top-full right-0 mt-1 w-52 bg-[var(--theme-color)] border border-[var(--theme-shade)] shadow-lg rounded origin-top-right">
                {themes.map((t) => {
                  const isSelected = t.name === selectedTheme.name;
                  return (
                    <button
                      key={t.name}
                      onClick={() => {
                        setSelectedTheme(t);
                        setOpenMenu(null);
                      }}
                      className={cn(
                        'flex items-center justify-between w-full px-3 py-2 text-xs rounded-md transition',
                        isSelected
                          ? 'bg-[var(--theme-active)] text-[var(--theme-foreground)] font-semibold shadow-inner'
                          : 'hover:bg-[var(--theme-hover)]'
                      )}
                    >
                      <div className="flex items-center justify-between w-full">
                        {/* Left: Theme name */}
                        <span className="text-left">{t.name}</span>

                        {/* Right: color swatches */}
                        <div className="flex items-center gap-1 ml-2">
                          <span
                            className="w-4 h-4 rounded-sm border"
                            style={{ backgroundColor: t.color }}
                            title="Background"
                          />
                          <span
                            className="w-4 h-4 rounded-sm border"
                            style={{ backgroundColor: t.foreground }}
                            title="Text Color"
                          />
                          <span
                            className="w-4 h-4 rounded-sm border"
                            style={{ backgroundColor: t.active }}
                            title="Active"
                          />
                          <span
                            className="w-4 h-4 rounded-sm border"
                            style={{ backgroundColor: t.hover }}
                            title="Hover"
                          />
                        </div>
                      </div>

                      {/* Checkmark */}
                      {/* {isSelected && <Icon icon="mdi:check" className="w-4 h-4 ml-2" />} */}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Side Apps */}
          <div className="relative inline-block menu-container">
            <button
              onClick={() => setOpenMenu(openMenu === "sideapps" ? null : "sideapps")}
              className="text-sm px-2 py-1 rounded hover:bg-[var(--theme-hover)]"
            >
              Side Apps
            </button>
            {openMenu === "sideapps" && (
              <div className="absolute top-full right-0 mt-1 w-48 bg-[var(--theme-color)] border border-[var(--theme-shade)] shadow-lg rounded origin-top-right">
                {sideApps
                  .filter((item) => item.allowedRoles?.includes(role))
                  .map(app => (
                    <a
                      key={app.name}
                      href={app.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center w-full px-3 py-2 text-xs hover:bg-[var(--theme-hover)] transition"
                    >
                      <span>{app.name}</span>
                    </a>
                  ))}
              </div>
            )}
          </div>

        </div>

        <div className="relative user-menu text-sm">
          <button
            onClick={() => setOpen(o => !o)}
            className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-[var(--theme-hover)] transition"
          >
            <div className="relative w-8 h-8">
              <Icon icon="mdi:account-circle" className="w-8 h-8" />
              {!isGuest && (
                <span className="absolute bottom-[1px] right-[2px] bg-gray-200 text-gray-700 text-[9px] px-1 py-px rounded-md leading-none shadow-sm">
                  {role.charAt(0).toUpperCase() + role.slice(1)}
                </span>
              )}
            </div>


            <span className="font-medium">{username ?? 'Guest'}</span>
            <Icon
              icon={open ? 'mdi:chevron-up' : 'mdi:chevron-down'}
              className="w-5 h-5"
            />
          </button>

          {open && (
            <div className="absolute right-0 mt-2 w-56 bg-[var(--theme-color)] border border-[var(--theme-shade)] shadow-xl rounded-lg overflow-hidden">

              {/* <div className="border-t border-[var(--theme-shade)]"></div> */}

              {/* Logout */}
              <button
                onClick={handleLogout}
                className={`flex items-center gap-2 w-full px-4 py-3 hover:bg-[var(--theme-hover)] font-medium ${isGuest ? "text-blue-600" : "text-red-600"
                  }`}
              >
                <Icon icon={isGuest ? "mdi:login" : "mdi:logout"} className="w-5 h-5" />
                {isGuest ? "Login" : "Logout"}
              </button>

            </div>
          )}
        </div>
      </div>
    </header >
  );
}

