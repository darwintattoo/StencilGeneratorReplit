import axios from 'axios';

// Usar el API_KEY del entorno 
const API_KEY = process.env.API_KEY;
// Usar el ID de deployment correcto como se especifica en la documentación
const DEPLOYMENT_ID = "c0887fe6-13b0-4406-a8d1-f596b1fdab8d";

/**
 * Envía una solicitud a ComfyDeploy para generar un stencil
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

  // Preparar los inputs siguiendo exactamente el formato documentado
  const payload = {
    deployment_id: DEPLOYMENT_ID,
    inputs: {
      "Darwin Enriquez": imageUrl,
      "line_color": lineColor,
      "activar_transparencia": options.transparentBackground,
      "iluminar sombras": options.enhanceShadows || false,
      "estilo de linea": options.presetLora || "LoraLineart/Darwinstencil3-000007.safetensors",
      "AI Model": options.aiModel || "SDXL-Flash.safetensors",
      "Posterize": options.posterizeValue || 8,
      "activar_Posterize": options.activarPosterize || false,
      "Activar Auto Gamma": options.activarAutoGamma || false
    }
  };

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
      timeout: 30000 // 30 segundos de timeout
    }
  );

  return response.data;
}

/**
 * Verifica el estado de un trabajo en ComfyDeploy
 * @param runId ID del trabajo
 */
export async function checkJobStatus(runId: string) {
  if (!API_KEY) {
    throw new Error("API_KEY no configurada en variables de entorno");
  }

  const response = await axios.get(
    `https://api.comfydeploy.com/api/run/${runId}`,
    {
      headers: {
        "Authorization": `Bearer ${API_KEY}`
      },
      timeout: 15000
    }
  );

  // Agregar información de diagnóstico si está atascado en "not-started"
  if (response.data.status === "not-started" && response.data.queue_position === null) {
    const now = new Date();
    const createdAt = new Date(response.data.created_at);
    const timeElapsed = now.getTime() - createdAt.getTime();
    
    response.data._diagnosticInfo = {
      serverTime: now.toISOString(),
      jobCreatedAt: response.data.created_at,
      timeElapsedSinceCreation: timeElapsed,
      message: "El trabajo parece estar atascado en estado 'not-started'. Esto puede indicar problemas con la API externa."
    };
  }

  return response.data;
}