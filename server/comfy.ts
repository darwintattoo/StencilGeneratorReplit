import { COMFY_API_KEY, COMFY_DEPLOYMENT_ID } from "./env";

/**
 * Envía una solicitud para crear un nuevo trabajo en ComfyDeploy
 * @param inputs Los parámetros de entrada exactos que espera el workflow
 */
export async function queueRun(inputs: Record<string, any>) {
  console.log("Enviando solicitud a ComfyDeploy con inputs:", JSON.stringify(inputs, null, 2));

  const res = await fetch(
    "https://api.comfydeploy.com/api/run/deployment/queue",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${COMFY_API_KEY}`
      },
      body: JSON.stringify({
        deploymentId: COMFY_DEPLOYMENT_ID,
        inputs
      })
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Error en ComfyDeploy API:", errorText);
    throw new Error(errorText);
  }

  return res.json(); // { run_id: "..." }
}

/**
 * Verifica el estado de un trabajo en ComfyDeploy
 * @param runId ID del trabajo
 */
export async function checkRunStatus(runId: string) {
  const res = await fetch(
    `https://api.comfydeploy.com/api/run/${runId}`,
    {
      headers: {
        "Authorization": `Bearer ${COMFY_API_KEY}`
      }
    }
  );

  if (!res.ok) {
    const errorText = await res.text();
    console.error("Error al verificar estado en ComfyDeploy:", errorText);
    throw new Error(errorText);
  }

  return res.json();
}