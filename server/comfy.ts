import axios from 'axios';
import { COMFY_API_KEY, COMFY_DEPLOYMENT_ID } from './env';

/**
 * Envía una solicitud para crear un nuevo trabajo en ComfyDeploy
 * @param inputs Los parámetros de entrada exactos que espera el workflow
 */
export async function queueRun(inputs: Record<string, any>) {
  try {
    console.log("Enviando solicitud a ComfyDeploy con inputs:", inputs);
    
    const response = await axios.post(
      "https://api.comfydeploy.com/api/run/deployment/queue",
      {
        deployment_id: COMFY_DEPLOYMENT_ID,
        inputs
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${COMFY_API_KEY}`
        },
        timeout: 30000 // 30 segundos de timeout
      }
    );
    
    console.log("Respuesta exitosa de ComfyDeploy:", response.data);
    return response.data;
  } catch (error: any) {
    console.error("Error al crear trabajo en ComfyDeploy:", error.message);
    if (error.response) {
      console.error("Detalles del error:", error.response.data);
    }
    throw error;
  }
}

/**
 * Verifica el estado de un trabajo en ComfyDeploy
 * @param runId ID del trabajo
 */
export async function checkRunStatus(runId: string) {
  try {
    console.log(`Verificando estado del trabajo ${runId}`);
    
    const response = await axios.get(
      `https://api.comfydeploy.com/api/run/deployment/${runId}`,
      {
        headers: {
          "Authorization": `Bearer ${COMFY_API_KEY}`
        },
        timeout: 30000
      }
    );
    
    console.log("Estado del trabajo:", response.data);
    return response.data;
  } catch (error: any) {
    console.error(`Error al verificar estado del trabajo ${runId}:`, error.message);
    if (error.response) {
      console.error("Detalles del error:", error.response.data);
    }
    throw error;
  }
}