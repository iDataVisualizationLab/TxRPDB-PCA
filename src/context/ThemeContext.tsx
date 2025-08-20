"use client";

import React, { createContext, useContext, useState, useEffect } from "react";

const ThemeContext = createContext({
  setThemeColor: (color: string) => {},
});

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  const [color, setColor] = useState("#fecaca");

  const setThemeColor = (newColor: string) => {
    document.documentElement.style.setProperty("--theme-color", newColor);
    // Optional: compute a darker hover variant
    document.documentElement.style.setProperty("--theme-hover", newColor); // You can darken if needed
    setColor(newColor);
  };

  // useEffect(() => {
  //   setThemeColor(color);
  // }, []);

  return (
    <ThemeContext.Provider value={{ setThemeColor }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => useContext(ThemeContext);
