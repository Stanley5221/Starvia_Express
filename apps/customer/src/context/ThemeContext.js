import React, { createContext, useContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkColors, lightColors } from '../constants/theme';

const THEME_KEY = '@starvia_customer_theme';

const ThemeContext = createContext({
  colors: darkColors,
  isDark: true,
  toggleTheme: () => {},
});

export function ThemeProvider({ children }) {
  const [isDark, setIsDark] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem(THEME_KEY)
      .then(val => { if (val !== null) setIsDark(val === 'dark'); })
      .catch(() => {});
  }, []);

  function toggleTheme() {
    const next = !isDark;
    setIsDark(next);
    AsyncStorage.setItem(THEME_KEY, next ? 'dark' : 'light').catch(() => {});
  }

  return (
    <ThemeContext.Provider value={{ colors: isDark ? darkColors : lightColors, isDark, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => useContext(ThemeContext);
