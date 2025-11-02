"use client";

import { ReactNode, useEffect, useState } from "react";
import { DEFAULT_LANGUAGE, Language, LANGUAGES, LanguageContext, getTranslation, getClientLanguage } from "./index";
import { getLanguageFont, getLanguageTitleFont, getLanguageSerifFont } from "./fonts";

interface LanguageProviderProps {
  children: ReactNode;
}

export function LanguageProvider({ children }: LanguageProviderProps) {
  const [language, setLanguageState] = useState<Language>(DEFAULT_LANGUAGE);
  const [isLoaded, setIsLoaded] = useState(false);

  const [fontClass, setFontClass] = useState(getLanguageFont(DEFAULT_LANGUAGE));
  const [titleFontClass, setTitleFontClass] = useState(getLanguageTitleFont(DEFAULT_LANGUAGE));
  const [serifFontClass, setSerifFontClass] = useState(getLanguageSerifFont(DEFAULT_LANGUAGE));

  useEffect(() => {
    const clientLanguage = getClientLanguage();
    setLanguageState(clientLanguage);

    setFontClass(getLanguageFont(clientLanguage));
    setTitleFontClass(getLanguageTitleFont(clientLanguage));
    setSerifFontClass(getLanguageSerifFont(clientLanguage));

    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("lang", clientLanguage);
    }

    setIsLoaded(true);
  }, []);

  const setLanguage = (newLanguage: Language) => {
    if (LANGUAGES.includes(newLanguage) && newLanguage !== language) {
      setLanguageState(newLanguage);
      localStorage.setItem("language", newLanguage);

      setFontClass(getLanguageFont(newLanguage));
      setTitleFontClass(getLanguageTitleFont(newLanguage));
      setSerifFontClass(getLanguageSerifFont(newLanguage));

      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("lang", newLanguage);
      }
    }
  };

  const t = (key: string) => {
    return getTranslation(language, key);
  };

  if (!isLoaded && typeof window !== "undefined") {
    return (
      <LanguageContext.Provider value={{ language, setLanguage, t, fontClass, titleFontClass, serifFontClass }}>
        {children}
      </LanguageContext.Provider>
    );
  }

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t, fontClass, titleFontClass, serifFontClass }}>
      {children}
    </LanguageContext.Provider>
  );
}
