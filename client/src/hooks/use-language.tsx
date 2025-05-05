import { createContext, ReactNode, useContext, useEffect, useState } from "react";

type Language = "en" | "es";

type LanguageContextType = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: string) => string;
};

// English translations
const enTranslations: Record<string, string> = {
  // Navigation
  "nav.mystencils": "My Stencils",
  "nav.signin": "Sign In",
  "nav.signout": "Sign Out",
  
  // Form labels
  "form.upload_label": "Upload your image",
  "form.drag_drop": "Drag & drop your image here",
  "form.or_click": "or click to select a file",
  "form.supported_formats": "Supports JPG, PNG, WEBP",
  "form.browse_files": "Browse Files",
  "form.line_color": "Line Color",
  "form.transparent_bg": "Transparent Background",
  "form.transparent_bg_help": "Enable this option to generate a stencil with transparent background, ideal for tattoo applications",
  "form.processing": "Processing...",
  "form.generate_stencil": "Generate Stencil",
  
  // Form errors
  "form.error": "Error",
  "form.error_file_type": "Please upload an image file (JPEG, PNG, etc.)",
  "form.error_no_file": "Please upload an image file",
  "form.error_generate": "Failed to generate stencil",
  
  // Auth page
  "auth.login": "Login",
  "auth.register": "Register",
  "auth.username": "Username",
  "auth.email": "Email",
  "auth.password": "Password",
  "auth.submit": "Submit",
  "auth.need_account": "Need an account?",
  "auth.have_account": "Already have an account?",
  "auth.welcome": "Welcome to TattooStencilPro",
  "auth.subtitle": "Create professional stencils for your tattoo designs in seconds"
};

// Spanish translations
const esTranslations: Record<string, string> = {
  // Navigation
  "nav.mystencils": "Mis Stencils",
  "nav.signin": "Iniciar sesión",
  "nav.signout": "Cerrar sesión",
  
  // Form labels
  "form.upload_label": "Sube tu imagen",
  "form.drag_drop": "Arrastra y suelta tu imagen aquí",
  "form.or_click": "o haz clic para seleccionar un archivo",
  "form.supported_formats": "Soporta JPG, PNG, WEBP",
  "form.browse_files": "Explorar archivos",
  "form.line_color": "Color de línea",
  "form.transparent_bg": "Fondo transparente",
  "form.transparent_bg_help": "Activa esta opción para generar un stencil con fondo transparente, ideal para aplicaciones de tatuajes",
  "form.processing": "Procesando...",
  "form.generate_stencil": "Generar Stencil",
  
  // Form errors
  "form.error": "Error",
  "form.error_file_type": "Por favor sube un archivo de imagen (JPEG, PNG, etc.)",
  "form.error_no_file": "Por favor sube un archivo de imagen",
  "form.error_generate": "Error al generar el stencil",
  
  // Auth page
  "auth.login": "Iniciar sesión",
  "auth.register": "Registrarse",
  "auth.username": "Nombre de usuario",
  "auth.email": "Correo electrónico",
  "auth.password": "Contraseña",
  "auth.submit": "Enviar",
  "auth.need_account": "¿Necesitas una cuenta?",
  "auth.have_account": "¿Ya tienes una cuenta?",
  "auth.welcome": "Bienvenido a TattooStencilPro",
  "auth.subtitle": "Crea stencils profesionales para tus diseños de tatuajes en segundos"
};

const translations: Record<Language, Record<string, string>> = {
  en: enTranslations,
  es: esTranslations,
};

export const LanguageContext = createContext<LanguageContextType | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  // Initialize language from localStorage or default to 'en'
  const [language, setLanguageState] = useState<Language>(() => {
    const savedLanguage = localStorage.getItem("language");
    return (savedLanguage === "en" || savedLanguage === "es") ? savedLanguage : "en";
  });

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem("language", newLanguage);
  };

  const t = (key: string) => {
    return translations[language][key] || key;
  };

  // Save language to localStorage when it changes
  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
      }}
    >
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
