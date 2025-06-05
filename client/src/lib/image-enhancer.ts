/**
 * Cliente para integrar con la aplicación de mejora automática de exposición
 */

export interface EnhanceImageResponse {
  success: boolean;
  enhanced_image?: string; // base64 string
  error?: string;
}

export async function enhanceImageExposure(imageFile: File): Promise<EnhanceImageResponse> {
  try {
    console.log('Enviando imagen a mejorar:', imageFile.name, imageFile.size);
    
    const formData = new FormData();
    formData.append('file', imageFile);

    const response = await fetch('https://auto-image-enhancer-darwintattoo1.replit.app/enhance', {
      method: 'POST',
      body: formData,
      mode: 'cors',
      headers: {
        'Accept': 'application/json',
      }
    });

    console.log('Respuesta del servidor:', response.status, response.statusText);

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Error del servidor:', errorText);
      throw new Error(`Error del servidor: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('Resultado de la mejora:', result);
    return result;
  } catch (error) {
    console.error('Error enhancing image:', error);
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      return {
        success: false,
        error: 'No se puede conectar con el servicio de mejora de imágenes. Verifica que la aplicación esté funcionando.'
      };
    }
    
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Error desconocido al mejorar la imagen'
    };
  }
}

export function base64ToFile(base64String: string, filename: string = `enhanced_${Date.now()}.png`): File | null {
  try {
    // Remove data URL prefix if present
    const base64Data = base64String.includes(',') ? base64String.split(',')[1] : base64String;
    
    // Convert base64 to binary
    const binaryString = atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    
    // Create blob and file
    const blob = new Blob([bytes], { type: 'image/png' });
    return new File([blob], filename, { type: 'image/png' });
  } catch (error) {
    console.error('Error converting base64 to file:', error);
    return null;
  }
}