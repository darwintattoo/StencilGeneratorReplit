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
  "upload_label": "Upload your image",
  "drag_drop": "Drag & drop your image here",
  "or_click": "or click to select a file",
  "supported_formats": "Supports JPG, PNG, WEBP",
  "browse_files": "Browse Files",
  "line_color": "Line Color",
  "basic_options": "Basic Options",
  "transparent_bg": "Transparent Background",
  "transparent_bg_help": "Enable this option to generate a stencil with transparent background, ideal for tattoo applications",
  "processing": "Processing...",
  "generate_stencil": "Generate Stencil",
  "select_image_first": "Select an image first",
  
  // Advanced options
  "advanced_options": "Advanced Options",
  "enhance_shadows": "Enhance Shadows",
  "enhance_shadows_help": "Improves visibility in areas with deep shadows",
  "line_style": "Line Style",
  "ai_model": "AI Model",
  "param_transparency": "Activate",
  "param_enhance_shadows": "Activate",
  "param_line_color": "Color",
  
  // Form errors
  "form.error": "Error",
  "form.error_file_type": "Please upload an image file (JPEG, PNG, etc.)",
  "form.error_file_size": "Image file size must be less than 15MB",
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
  "auth.subtitle": "Create professional stencils for your tattoo designs in seconds",

  // Stencil page
  "stencil.yourStencil": "Your Stencil"
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
  "form.basic_options": "Opciones Básicas",
  "form.transparent_bg": "Fondo transparente",
  "form.transparent_bg_help": "Activa esta opción para generar un stencil con fondo transparente, ideal para aplicaciones de tatuajes",
  "form.processing": "Procesando...",
  "form.generate_stencil": "Generar Stencil",
  "form.select_image_first": "Seleccione una imagen primero",
  
  // Advanced options
  "form.advanced_options": "Opciones Avanzadas",
  "form.enhance_shadows": "Mejorar Sombras",
  "form.enhance_shadows_help": "Mejora la visibilidad en áreas con sombras profundas",
  "form.line_style": "Estilo de línea",
  "form.ai_model": "Modelo de IA",
  "form.param_transparency": "activar_transparencia",
  "form.param_enhance_shadows": "iluminar sombras",
  "form.param_line_color": "line_color",
  
  // Form errors
  "form.error": "Error",
  "form.error_file_type": "Por favor sube un archivo de imagen (JPEG, PNG, etc.)",
  "form.error_file_size": "El tamaño de la imagen debe ser menor a 15MB",
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
  "auth.subtitle": "Crea stencils profesionales para tus diseños de tatuajes en segundos",

  // Stencil page
  "stencil.yourStencil": "Tu Stencil"
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
