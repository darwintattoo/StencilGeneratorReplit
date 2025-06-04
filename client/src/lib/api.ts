import { apiRequest } from "./queryClient";
import { StencilResponse, StencilJobStatus } from "@/types";

interface StencilParams {
  imageUrl: string;
  lineColor: string;
  transparentBackground: boolean;
}

interface UploadStencilParams {
  image: File;
  lineColor: string;
  transparentBackground: boolean;
  aiModel?: string;
  enhanceShadows?: boolean;
  presetLora?: string;
  posterizeValue?: number;
  activarPosterize?: boolean;
  activarAutoGamma?: boolean;
  autoExposureCorrection?: boolean;
}

export async function generateStencil(params: StencilParams): Promise<StencilResponse> {
  const response = await apiRequest(
    "POST", 
    "/api/generate-stencil", 
    params
  );
  
  return response.json();
}

export async function uploadImageForStencil(params: UploadStencilParams): Promise<StencilResponse> {
  // Configuración del sistema de reintentos
  const maxRetries = 2;
  let retryCount = 0;
  let lastError: Error | null = null;
  
  // Función para crear el FormData y hacer la solicitud
  const attemptUpload = async (): Promise<Response> => {
    // Crear un FormData para enviar el archivo
    const formData = new FormData();
    formData.append("image", params.image);
    formData.append("lineColor", params.lineColor);
    
    // Asegurarnos de que los valores booleanos se envíen correctamente
    // La API espera valores true/false explícitos y no strings "true"/"false"
    formData.append("transparentBackground", params.transparentBackground.toString());
    
    // Agregar los nuevos parámetros opcionales si están presentes
    if (params.aiModel) {
      formData.append("aiModel", params.aiModel);
    } else {
      formData.append("aiModel", "SDXL-Flash.safetensors");
    }
    
    // Siempre incluir enhanceShadows como true/false explícito
    formData.append("enhanceShadows", params.enhanceShadows === true ? "true" : "false");
    
    if (params.presetLora) {
      formData.append("presetLora", params.presetLora);
    } else {
      formData.append("presetLora", "LoraLineart/Darwinstencil3-000007.safetensors");
    }
    
    // Agregar parámetros opcionales para Posterize y Auto Gamma
    if (params.posterizeValue !== undefined) {
      formData.append("posterizeValue", params.posterizeValue.toString());
    }
    
    if (params.activarPosterize !== undefined) {
      formData.append("activarPosterize", params.activarPosterize.toString());
    }
    
    if (params.activarAutoGamma !== undefined) {
      formData.append("activarAutoGamma", params.activarAutoGamma.toString());
    }
    
    // Mostrar en la consola los valores que se están enviando
    console.log("Enviando parámetros a API:", {
      lineColor: params.lineColor,
      transparentBackground: params.transparentBackground,
      aiModel: params.aiModel || "SDXL-Flash.safetensors",
      enhanceShadows: params.enhanceShadows,
      presetLora: params.presetLora || "LoraLineart/Darwinstencil3-000007.safetensors"
    });
    
    console.log("Enviando archivo:", params.image.name, "tipo:", params.image.type, "tamaño:", params.image.size);
    
    // Utilizamos fetch directamente ya que apiRequest no maneja FormData correctamente
    return fetch("/api/upload-image", {
      method: "POST",
      body: formData,
    });
  };
  
  // Bucle de reintentos
  while (retryCount <= maxRetries) {
    try {
      // Si es un reintento, mostrar mensaje en consola
      if (retryCount > 0) {
        console.log(`Reintentando subida de imagen (intento ${retryCount}/${maxRetries})...`);
      }
      
      const response = await attemptUpload();
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("Error al subir imagen:", errorData);
        throw new Error(errorData.message || "Error al subir la imagen");
      }
      
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error en intento ${retryCount + 1}:`, lastError.message);
      
      // Si hemos agotado los reintentos, lanzar el error
      if (retryCount >= maxRetries) {
        console.error("Se agotaron los reintentos. Último error:", lastError.message);
        throw lastError;
      }
      
      // Esperar antes de reintentar (backoff exponencial)
      const delay = Math.pow(2, retryCount) * 1000; // 1s, 2s, 4s...
      console.log(`Esperando ${delay}ms antes de reintentar...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retryCount++;
    }
  }
  
  // Este código no debería ejecutarse nunca debido a la lógica del bucle,
  // pero TypeScript lo requiere para asegurar que la función siempre devuelve algo
  throw lastError || new Error("Error inesperado durante la subida de imagen");
}

export async function checkJobStatus(runId: string): Promise<StencilJobStatus> {
  // Configuración del sistema de reintentos
  const maxRetries = 2;
  let retryCount = 0;
  let lastError: Error | null = null;
  
  // Bucle de reintentos
  while (retryCount <= maxRetries) {
    try {
      // Si es un reintento, mostrar mensaje en consola
      if (retryCount > 0) {
        console.log(`Reintentando verificación de estado (intento ${retryCount}/${maxRetries})...`);
      }
      
      const response = await apiRequest(
        "GET", 
        `/api/queue/${runId}`
      );
      
      return await response.json();
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Error al verificar estado (intento ${retryCount + 1}):`, lastError.message);
      
      // Si hemos agotado los reintentos, lanzar el error
      if (retryCount >= maxRetries) {
        console.error("Se agotaron los reintentos para verificar estado. Último error:", lastError.message);
        throw lastError;
      }
      
      // Esperar antes de reintentar (backoff exponencial pero más corto)
      const delay = 500 * Math.pow(1.5, retryCount); // 500ms, 750ms, 1125ms...
      console.log(`Esperando ${delay}ms antes de reintentar verificación de estado...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      
      retryCount++;
    }
  }
  
  // Este código no debería ejecutarse nunca debido a la lógica del bucle
  throw lastError || new Error("Error inesperado durante la verificación de estado");
}
