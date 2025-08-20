'use client';

import React, { ReactNode, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { usePathname } from 'next/navigation';
import { SIDENAV_ITEMS } from '@/components/nav/constants';
import { SideNavItem } from '@/components/nav/types';
import { Icon } from '@iconify/react';
import { motion, useCycle } from 'framer-motion';
import { useMap } from '@/context/MapContext';
import { themes, type Theme } from '@/constants/themeConstants';
import { baseMaps } from '@/constants/mapConstants';

import { route } from '@/config';
const sidebar = {
  open: (height = 1000) => ({
    clipPath: `circle(${height * 2 + 200}px at 100% 0)`,
    transition: { type: 'spring', stiffness: 20, restDelta: 2 },
  }),
  closed: {
    clipPath: 'circle(0px at 100% 0)',
    transition: { type: 'spring', stiffness: 400, damping: 40 },
  },
};

const HeaderMobile = () => {
  const pathname = usePathname();
  const containerRef = useRef(null);
  const { height } = useDimensions(containerRef);
  const [isOpen, toggleOpen] = useCycle(false, true);
  const { basemapUrl, setBasemapUrl } = useMap();
  const [selectedTheme, setSelectedTheme] = useState<Theme>(themes[0]);
  const [role, setRole] = useState<string | null>(null);
  const [username, setUsername] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);
  useEffect(() => {
    const storedRole = localStorage.getItem("role") ?? "guest";
    const uname = localStorage.getItem('username');
    const guestFlag = localStorage.getItem('guest') === 'true';
    setRole(storedRole);
    setUsername(uname);
    setIsGuest(guestFlag);
  }, []);
  const handleLogout = async () => {
    if (isGuest) {
      location.href = '/login';
    } else {
      await import('@/lib/api/users').then(mod => mod.logoutUser());
      import('@/lib/auth').then(mod => mod.clearAuth());
      location.href = '/login';
    }
  };
  useEffect(() => {
    const vars = {
      '--theme-color': selectedTheme.color,
      '--theme-foreground': selectedTheme.foreground,
      '--theme-hover': selectedTheme.hover,
      '--theme-active': selectedTheme.active,
      '--theme-shade': selectedTheme.shade,
    };
    Object.entries(vars).forEach(([k, v]) =>
      document.documentElement.style.setProperty(k, v)
    );
  }, [selectedTheme]);


  if (!role) return null;
  return (
    <>
      {/* Mobile Top Header */}
      <div className="fixed top-0 left-0 right-0 z-40 flex items-center justify-between bg-[var(--theme-color)] text-[var(--theme-foreground)] h-12 px-4 md:hidden">
        <Link href="/" className="flex items-center gap-2">
          <Image src={`${route}/img/txdot-logo.png`} width={24} height={24} className="rounded" alt="Logo" />
          <span className="font-medium text-base">RPDB</span>
        </Link>

        <div className="relative user-header-menu">
          {/* User Button */}
          <button
            onClick={() => setShowUserMenu((prev) => !prev)}
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
              icon={showUserMenu ? 'mdi:chevron-up' : 'mdi:chevron-down'}
              className="w-5 h-5"
            />
          </button>

          {/* Dropdown */}
          {showUserMenu && (
            <div className="absolute right-0 mt-2 w-32 bg-[var(--theme-color)] border border-[var(--theme-shade)] shadow-xl rounded-lg overflow-hidden">
              <button
                onClick={() => {
                  setShowUserMenu(false);
                  handleLogout();
                }}
                className={`flex items-center gap-2 w-full px-4 py-3 hover:bg-[var(--theme-hover)] font-medium ${isGuest ? "text-blue-600" : "text-red-600"
                  }`}
              >
                <Icon icon={isGuest ? "mdi:login" : "mdi:logout"} className="w-5 h-5" />
                {isGuest ? "Login" : "Logout"}
              </button>
            </div>
          )}
        </div>
        <MenuToggle toggle={toggleOpen} isOpen={isOpen} />
      </div>

      {/* Slide Menu */}
      <motion.nav
        initial={false}
        animate={isOpen ? 'open' : 'closed'}
        custom={height}
        className={`fixed inset-0 z-30 md:hidden transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        ref={containerRef}
      >
        <motion.div className="absolute inset-0 bg-[var(--theme-color)] text-[var(--theme-foreground)] backdrop-blur-sm" variants={sidebar} />
        <motion.ul className="absolute grid w-full gap-3 px-10 pt-16 pb-6 max-h-screen overflow-y-auto" variants={variants}>
          {SIDENAV_ITEMS
            .filter((item) => item.allowedRoles?.includes(role))
            .map((item, idx) => (
              <div key={idx}>
                {item.submenu ? (
                  <MenuItemWithSubMenu item={item} toggleOpen={toggleOpen} />
                ) : (
                  <MenuItem>
                    <Link
                      href={item.path}
                      onClick={() => toggleOpen()}
                      className={`flex w-full text-2xl px-2 py-1 rounded-md transition-colors duration-150 ${item.path === pathname ? 'bg-[var(--theme-active)] font-bold' : 'hover:bg-[var(--theme-hover)]'
                        }`}
                    >
                      {item.title}
                    </Link>
                  </MenuItem>
                )}
                {idx !== SIDENAV_ITEMS.length - 1 && (
                  <MenuItem className="my-3 h-px w-full bg-gray-300" />
                )}
              </div>
            ))}

          {/* Base Map */}
          <motion.li className="pt-2">
            <p className="text-sm mb-1">Base Map</p>
            <div className="flex flex-col gap-1">
              {baseMaps.map((bm) => (
                <button
                  key={bm.id}
                  onClick={() => {
                    setBasemapUrl(bm.url);
                    toggleOpen();
                  }}
                  className={`flex items-center justify-between text-sm px-3 py-2 rounded-md transition ${basemapUrl === bm.url
                    ? 'bg-[var(--theme-active)] font-semibold shadow-inner'
                    : 'hover:bg-[var(--theme-hover)]'
                    }`}
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

                  {basemapUrl === bm.url && <Icon icon="mdi:check" className="w-4 h-4" />}
                </button>
              ))}
            </div>
          </motion.li>

          {/* Theme Switcher */}
          <motion.li className="pt-4">
            <p className="text-sm mb-1">Theme</p>
            <div className="flex flex-col gap-1">
              {themes.map((t) => (
                <button
                  key={t.name}
                  onClick={() => {
                    setSelectedTheme(t);
                    toggleOpen();
                  }}
                  className={`flex justify-between text-sm px-3 py-2 rounded-md transition ${selectedTheme?.name === t.name
                    ? 'bg-[var(--theme-active)] font-semibold shadow-inner'
                    : 'hover:bg-[var(--theme-hover)]'
                    }`}
                >
                  <span>{t.name}</span>
                  <div className="flex gap-1">
                    {[t.color, t.foreground, t.active, t.hover].map((c, i) => (
                      <span key={i} className="w-3 h-3 rounded-sm border" style={{ backgroundColor: c }} />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </motion.li>
        </motion.ul>
      </motion.nav>
    </>
  );
};

export default HeaderMobile;

// Utility Components

const MenuToggle = ({ toggle, isOpen }: { toggle: () => void; isOpen: boolean }) => (
  <button onClick={toggle} aria-expanded={isOpen} className="pointer-events-auto z-50">
    <svg width="23" height="23" viewBox="0 0 23 23">
      <Path
        stroke="var(--theme-foreground)"
        variants={{
          closed: { d: 'M 2 2.5 L 20 2.5' },
          open: { d: 'M 3 16.5 L 17 2.5' },
        }}
      />
      <Path
        d="M 2 9.423 L 20 9.423"
        variants={{ closed: { opacity: 1 }, open: { opacity: 0 } }}
        transition={{ duration: 0.1 }}
      />
      <Path
        variants={{
          closed: { d: 'M 2 16.346 L 20 16.346' },
          open: { d: 'M 3 2.5 L 17 16.346' },
        }}
      />
    </svg>
  </button>
);

const Path = (props: any) => (
  <motion.path
    fill="transparent"
    strokeWidth="2"
    stroke="hsl(0, 0%, 18%)"
    strokeLinecap="round"
    {...props}
  />
);

const MenuItem = ({ className, children }: { className?: string; children?: ReactNode }) => (
  <motion.li variants={MenuItemVariants} className={className}>
    {children}
  </motion.li>
);

const MenuItemWithSubMenu = ({
  item,
  toggleOpen,
  depth = 0,
}: {
  item: SideNavItem;
  toggleOpen: () => void;
  depth?: number;
}) => {
  const pathname = usePathname();
  const [subMenuOpen, setSubMenuOpen] = useState(false);

  // Calculate text size and indentation based on depth
  const textSize = depth === 0 ? 'text-2xl' : depth === 1 ? 'text-xl' : 'text-lg';
  const marginLeft = depth > 0 ? `ml-${Math.min(depth * 4, 12)}` : '';

  return (
    <>
      <MenuItem>
        <button
          className={`flex w-full ${textSize} px-2 py-1 rounded-md transition-colors duration-150 hover:bg-[var(--theme-hover)] ${marginLeft}`}
          onClick={() => setSubMenuOpen(!subMenuOpen)}
        >
          <div className="flex flex-row justify-between w-full items-center">
            <span className={`${pathname?.includes(item.path) ? 'font-bold' : ''}`}>
              {item.title}
            </span>
            <div className={`${subMenuOpen && 'rotate-180'}`}>
              <Icon icon="lucide:chevron-down" width="24" height="24" />
            </div>
          </div>
        </button>
      </MenuItem>
      <div className="mt-2 ml-4 flex flex-col space-y-2">
        {subMenuOpen &&
          item.subMenuItems?.map((subItem, subIdx) => (
            <MenuItem key={subIdx}>
              {/* Check if subItem has its own submenus */}
              {subItem.submenu && subItem.subMenuItems && subItem.subMenuItems.length > 0 ? (
                <MenuItemWithSubMenu 
                  item={subItem} 
                  toggleOpen={toggleOpen} 
                  depth={depth + 1}
                />
              ) : (
                <Link
                  href={subItem.path}
                  onClick={() => toggleOpen()}
                  className={`text-base ${subItem.path === pathname ? 'font-bold' : ''} block px-2 py-1 rounded-md transition-colors duration-150 hover:bg-[var(--theme-hover)]`}
                >
                  {subItem.title}
                </Link>
              )}
            </MenuItem>
          ))}
      </div>
    </>
  );
};

const MenuItemVariants = {
  open: {
    y: 0,
    opacity: 1,
    transition: { y: { stiffness: 1000, velocity: -100 } },
  },
  closed: {
    y: 50,
    opacity: 0,
    transition: { y: { stiffness: 1000 }, duration: 0.02 },
  },
};

const variants = {
  open: { transition: { staggerChildren: 0.02, delayChildren: 0.15 } },
  closed: { transition: { staggerChildren: 0.01, staggerDirection: -1 } },
};

const useDimensions = (ref: any) => {
  const dimensions = useRef({ width: 0, height: 0 });

  useEffect(() => {
    if (ref.current) {
      dimensions.current.width = ref.current.offsetWidth;
      dimensions.current.height = ref.current.offsetHeight;
    }
  }, [ref]);

  return dimensions.current;
};