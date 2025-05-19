import axios from 'axios';

// Usar el API_KEY del entorno 
const API_KEY = process.env.API_KEY;
// Usar el ID de deployment correcto como se especifica en la documentación
const DEPLOYMENT_ID = "c0887fe6-13b0-4406-a8d1-f596b1fdab8d";

// Variable para almacenar el tiempo de reintento actual
let backoffTime = 1000; // Comienza con 1 segundo

/**
 * Envía una solicitud a ComfyDeploy para generar un stencil con reintentos automáticos
 * @param imageUrl URL de la imagen a procesar
 * @param lineColor Color de línea (red, black, blue)
 * @param options Opciones adicionales para la generación
 */
export async function queueStencilGeneration(
  imageUrl: string, 
  lineColor: string,
  options: {
    transparentBackground: boolean,
    enhanceShadows?: boolean,
    presetLora?: string,
    aiModel?: string,
    posterizeValue?: number,
    activarPosterize?: boolean,
    activarAutoGamma?: boolean
  }
) {
  // Validar API key
  if (!API_KEY) {
    throw new Error("API_KEY no configurada en variables de entorno");
  }

  // Preparar los inputs para la API - probando diferentes formatos de nombres
  // Intentamos primero con guiones bajos, luego con formato original
  const getInputPayload = (useUnderscores = true) => {
    if (useUnderscores) {
      // Formato con guiones bajos
      return {
        "Darwin_Enriquez": imageUrl,
        "line_color": lineColor,
        "activar_transparencia": options.transparentBackground,
        "iluminar_sombras": options.enhanceShadows || false,
        "estilo_de_linea": options.presetLora || "LoraLineart/Darwinstencil3-000007.safetensors",
        "AI_Model": options.aiModel || "SDXL-Flash.safetensors",
        "Posterize": options.posterizeValue || 8,
        "activar_Posterize": options.activarPosterize || false,
        "Activar_Auto_Gamma": options.activarAutoGamma || false
      };
    } else {
      // Formato original con espacios
      return {
        "Darwin Enriquez": imageUrl,
        "line_color": lineColor,
        "activar_transparencia": options.transparentBackground,
        "iluminar sombras": options.enhanceShadows || false,
        "estilo de linea": options.presetLora || "LoraLineart/Darwinstencil3-000007.safetensors",
        "AI Model": options.aiModel || "SDXL-Flash.safetensors",
        "Posterize": options.posterizeValue || 8,
        "activar_Posterize": options.activarPosterize || false,
        "Activar Auto Gamma": options.activarAutoGamma || false
      };
    }
  };

  // Sistema de reintentos 
  const maxRetries = 3;
  let currentRetry = 0;
  let lastError = null;
  let useUnderscores = true;  // Comenzamos con formato de guiones bajos

  while (currentRetry < maxRetries) {
    try {
      // Alternamos entre formatos en cada reintento
      const inputPayload = getInputPayload(useUnderscores);
      const payload = {
        deployment_id: DEPLOYMENT_ID,
        inputs: inputPayload
      };

      console.log(`Intento ${currentRetry + 1}/${maxRetries} con formato ${useUnderscores ? 'guiones_bajos' : 'original'}`);
      console.log("Enviando solicitud a ComfyDeploy:", JSON.stringify(payload, null, 2));

      // Realizar la solicitud a la API con timeout adecuado
      const response = await axios.post(
        "https://api.comfydeploy.com/api/run/deployment/queue",
        payload,
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${API_KEY}`
          },
          timeout: 45000 // 45 segundos de timeout
        }
      );

      // Si la solicitud es exitosa, restablecer el backoff
      backoffTime = 1000;
      return response.data;
    } catch (error) {
      lastError = error;
      console.error(`Error en intento ${currentRetry + 1}:`, error.message);
      
      currentRetry++;
      // Alternamos el formato en cada reintento
      useUnderscores = !useUnderscores;
      
      // Si no es el último intento, esperamos antes de reintentar
      if (currentRetry < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        backoffTime = Math.min(backoffTime * 2, 10000); // Incremento exponencial hasta 10s
      }
    }
  }

  // Si llegamos aquí, todos los reintentos fallaron
  throw lastError || new Error("No se pudo conectar con ComfyDeploy después de múltiples intentos");
}

/**
 * Verifica el estado de un trabajo en ComfyDeploy con reintentos automáticos
 * @param runId ID del trabajo
 */
export async function checkJobStatus(runId: string) {
  if (!API_KEY) {
    throw new Error("API_KEY no configurada en variables de entorno");
  }

  // Sistema de reintentos para verificación de estado
  const maxRetries = 2;
  let currentRetry = 0;
  let lastError = null;

  while (currentRetry < maxRetries) {
    try {
      const response = await axios.get(
        `https://api.comfydeploy.com/api/run/${runId}`,
        {
          headers: {
            "Authorization": `Bearer ${API_KEY}`
          },
          timeout: 15000
        }
      );

      // Verificar si el trabajo está atascado y necesita ser reiniciado
      const now = new Date();
      const createdAt = new Date(response.data.created_at);
      const timeElapsed = now.getTime() - createdAt.getTime();
      
      // Si lleva más de 60 segundos en "not-started", es muy probable que esté atascado
      if (response.data.status === "not-started" && timeElapsed > 60000) {
        // Agregar flags internos para manejo automático del problema (no visibles al usuario)
        response.data._internalFlags = {
          probable_stuck: true,
          timeElapsed: timeElapsed,
          suggestRestart: true
        };
      }

      return response.data;
    } catch (error) {
      lastError = error;
      console.error(`Error verificando estado (intento ${currentRetry + 1}):`, error.message);
      
      currentRetry++;
      
      // Si no es el último intento, esperamos antes de reintentar
      if (currentRetry < maxRetries) {
        await new Promise(resolve => setTimeout(resolve, 1000 * currentRetry));
      }
    }
  }

  // Si llegamos aquí, todos los reintentos fallaron
  throw lastError || new Error("No se pudo verificar el estado del trabajo después de múltiples intentos");
}