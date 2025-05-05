import { apiRequest } from "./queryClient";
import { StencilResponse } from "@/types";

interface StencilParams {
  imageUrl: string;
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
