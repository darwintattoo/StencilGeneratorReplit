import { createContext, ReactNode, useContext, useState, useEffect } from "react";

type Language = "en" | "es";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

// Diccionario de traducciones
const translations: Record<Language, Record<string, string>> = {
  en: {
    // Formulario principal
    "upload.title": "Upload your image",
    "upload.dragdrop": "Drag & drop your image here",
    "upload.orclick": "or click to select a file",
    "upload.supports": "Supports JPG, PNG, WEBP",
    "upload.browse": "Browse Files",
    "linecolor.title": "Line Color",
    "transparency.title": "Transparent Background",
    "transparency.description": "Enable this option to generate a stencil with transparent background, ideal for tattoo applications",
    "button.generate": "Generate Stencil",
    "button.processing": "Processing...",
    "button.save": "Save stencil",
    "button.saving": "Saving...",
    // Navegación
    "nav.mystencils": "My Stencils",
    "nav.signin": "Sign in",
    "nav.signout": "Sign out",
    // Misc
    "app.description": "Professional AI-powered stencil creator",
  },
  es: {
    // Formulario principal
    "upload.title": "Selecciona tu imagen",
    "upload.dragdrop": "Arrastra y suelta tu imagen aquí",
    "upload.orclick": "o haz clic para seleccionar un archivo",
    "upload.supports": "Soporta JPG, PNG, WEBP",
    "upload.browse": "Explorar archivos",
    "linecolor.title": "Color de Línea",
    "transparency.title": "Fondo Transparente",
    "transparency.description": "Activa esta opción para generar un stencil con fondo transparente, ideal para aplicaciones de tatuaje",
    "button.generate": "Generar Stencil",
    "button.processing": "Procesando...",
    "button.save": "Guardar stencil",
    "button.saving": "Guardando...",
    // Navegación
    "nav.mystencils": "Mis Stencils",
    "nav.signin": "Iniciar sesión",
    "nav.signout": "Cerrar sesión",
    // Misc
    "app.description": "Creador profesional de stencils con IA",
  },
};

const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Intentar obtener el idioma de localStorage, o usar inglés por defecto
  const [language, setLanguageState] = useState<Language>(() => {
    // Solo ejecutar en el cliente
    if (typeof window !== "undefined") {
      const savedLanguage = localStorage.getItem("language");
      return (savedLanguage === "es" ? "es" : "en") as Language;
    }
    return "en";
  });

  // Guardar el idioma en localStorage cuando cambie
  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem("language", newLanguage);
  };

  // Función para traducir una clave
  const t = (key: string): string => {
    return translations[language][key] || key;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
