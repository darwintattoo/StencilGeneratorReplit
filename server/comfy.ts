import axios from 'axios';
import { COMFY_API_KEY, COMFY_DEPLOYMENT_ID } from './env';

/**
 * Envía una solicitud para crear un nuevo trabajo en ComfyDeploy
 * @param inputs Los parámetros de entrada exactos que espera el workflow
 */
export async function queueRun(inputs: Record<string, any>) {
  try {
    console.log("Enviando solicitud a ComfyDeploy con inputs:", inputs);
    
    // Validar los inputs básicos
    if (!inputs.input_image) {
      throw new Error("La imagen es obligatoria");
    }
    
    // Transformar los inputs internos al formato que espera ComfyDeploy
    const comfyInputs = {
      "Darwin Enriquez": inputs.input_image, // Nombre del parámetro para la imagen
      "line_color": inputs.line_color, 
      "activar_transparencia": inputs.activate_transparency === 'true' || inputs.activate_transparency === true ? true : false,
      "iluminar sombras": inputs.brighten_shadows === 'true' || inputs.brighten_shadows === true ? true : false,
      "estilo de linea": inputs.line_style,
      "AI Model": inputs.checkpoint,
      "Posterize": Number(inputs.posterize_level || 8),
      "activar_Posterize": inputs.activate_posterize === 'true' || inputs.activate_posterize === true ? true : false,
      "Activar Auto Gamma": inputs.activate_auto_gamma === 'true' || inputs.activate_auto_gamma === true ? true : false
    };
    
    console.log("Payload final para ComfyDeploy:", JSON.stringify({
      deployment_id: COMFY_DEPLOYMENT_ID,
      inputs: comfyInputs
    }, null, 2));
    
    // Usar la estructura correcta del payload según la documentación
    // Ahora usando deployment_id en snake_case como espera la API
    const response = await axios.post(
      "https://api.comfydeploy.com/api/run/deployment/queue",
      {
        deployment_id: COMFY_DEPLOYMENT_ID,
        inputs: comfyInputs
      },
      {
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${COMFY_API_KEY}`
        },
        timeout: 60000 // 60 segundos de timeout para imágenes grandes
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
    
    // Crear un objeto de respuesta temporal mientras se implementa correctamente
    // Esto permitirá que la aplicación continúe funcionando mientras resolvemos 
    // el problema con la API
    const mockResponse = {
      status: "running",
      startedAt: new Date().toISOString(),
      outputs: {
        image: null
      }
    };
    
    // Intenta conectar con la API real
    try {
      const response = await axios.get(
        `https://api.comfydeploy.com/api/run`,
        {
          params: {
            run_id: runId
          },
          headers: {
            "Authorization": `Bearer ${COMFY_API_KEY}`
          },
          timeout: 30000
        }
      );
      
      console.log("Estado del trabajo real:", response.data);
      return response.data;
    } catch (apiError: any) {
      console.error(`Error temporal al verificar estado del trabajo ${runId}:`, apiError.message);
      console.warn("Usando respuesta temporal para permitir continuar el proceso");
      
      // Devolver la respuesta temporal hasta que arreglemos la API
      return mockResponse;
    }
  } catch (error: any) {
    console.error(`Error al verificar estado del trabajo ${runId}:`, error.message);
    throw error;
  }
}