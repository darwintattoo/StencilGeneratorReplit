// Variables de entorno para la integración con ComfyDeploy
export const COMFY_API_KEY = process.env.COMFY_API_KEY || process.env.API_KEY || '';
export const COMFY_DEPLOYMENT_ID = process.env.COMFY_DEPLOYMENT_ID || 'c0887fe6-13b0-4406-a8d1-f596b1fdab8d';

// Verificar que las variables estén definidas
if (!COMFY_API_KEY) {
  console.warn('⚠️ ADVERTENCIA: COMFY_API_KEY no está definida. La integración con ComfyDeploy no funcionará correctamente.');
}

if (!COMFY_DEPLOYMENT_ID) {
  console.warn('⚠️ ADVERTENCIA: COMFY_DEPLOYMENT_ID no está definida. Se usará el ID predeterminado.');
}