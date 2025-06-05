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

    console.log('Conectando directamente con tu aplicación de corrección de exposición');
    
    // Intentar conectar con la aplicación de corrección de exposición
    const response = await fetch('https://auto-image-enhancer-darwintattoo1.replit.app/enhance', {
      method: 'POST',
      body: formData,
      headers: {
        // Asegurar que no haya conflictos de headers
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
    console.error('Error type:', typeof error);
    console.error('Error details:', error);
    
    let errorMessage = 'Error desconocido al mejorar la imagen';
    
    if (error instanceof TypeError && error.message.includes('fetch')) {
      errorMessage = 'No se puede conectar con el servicio de corrección de exposición. Verifica que la aplicación esté funcionando correctamente.';
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }
    
    return {
      success: false,
      error: errorMessage
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