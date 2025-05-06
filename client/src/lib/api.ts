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
  // Crear un FormData para enviar el archivo
  const formData = new FormData();
  formData.append("image", params.image);
  formData.append("lineColor", params.lineColor);
  formData.append("transparentBackground", params.transparentBackground.toString());
  
  console.log("Enviando archivo:", params.image.name, "tipo:", params.image.type, "tamaño:", params.image.size);
  
  // Utilizamos fetch directamente ya que apiRequest no maneja FormData correctamente
  const response = await fetch("/api/upload-image", {
    method: "POST",
    body: formData,
  });
  
  if (!response.ok) {
    const errorData = await response.json();
    console.error("Error al subir imagen:", errorData);
    throw new Error(errorData.message || "Error al subir la imagen");
  }
  
  return response.json();
}

export async function checkJobStatus(runId: string): Promise<StencilJobStatus> {
  const response = await apiRequest(
    "GET", 
    `/api/job-status/${runId}`
  );
  
  return response.json();
}
