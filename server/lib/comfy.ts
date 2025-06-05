import axios from 'axios';

// Usar el API_KEY del entorno 
const API_KEY = process.env.API_KEY;
// Usar el ID de deployment correcto
const DEPLOYMENT_ID = "c0887fe6-13b0-4406-a8d1-f596b1fdab8d";

/**
 * Envía una solicitud a ComfyDeploy para generar un stencil
 * Probamos con un formato fijo que sabemos funciona
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
  if (!API_KEY) {
    throw new Error("API_KEY no configurada");
  }

  // Payload fijo en el formato exacto que requiere la API
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

  console.log("Parámetros API enviados a ComfyDeploy:", payload.inputs);
  console.log("API PAYLOAD ENVIADO:", JSON.stringify(payload, null, 2));

  try {
    console.log("Enviando solicitud a ComfyDeploy API...");
    const response = await axios.post(
      "https://api.comfydeploy.com/api/run/deployment/queue", 
      payload,
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${API_KEY}`
        },
        timeout: 30000
      }
    );
    
    console.log("Respuesta ComfyDeploy - Estado:", response.status);
    console.log("Respuesta ComfyDeploy - ID:", response.data?.id);
    
    return response.data;
  } catch (error: any) {
    console.error("Error al enviar solicitud a ComfyDeploy:", error.message);
    throw error;
  }
}

/**
 * Verifica el estado de un trabajo en ComfyDeploy
 */
export async function checkJobStatus(runId: string) {
  if (!API_KEY) {
    throw new Error("API_KEY no configurada");
  }

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
    
    return response.data;
  } catch (error: any) {
    console.error("Error al verificar estado en ComfyDeploy:", error.message);
    throw error;
  }
}