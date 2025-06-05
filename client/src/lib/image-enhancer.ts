/**
 * Cliente para integrar con la aplicación de mejora automática de exposición
 */

export interface EnhanceImageResponse {
  success: boolean;
  enhanced_image_url?: string;
  error?: string;
}

export async function enhanceImageExposure(imageFile: File): Promise<EnhanceImageResponse> {
  try {
    console.log('Enviando imagen a mejorar:', imageFile.name, imageFile.size);
    
    const formData = new FormData();
    formData.append('image', imageFile);

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

export async function downloadEnhancedImage(imageUrl: string): Promise<File | null> {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) {
      throw new Error(`Failed to download image: ${response.status}`);
    }
    
    const blob = await response.blob();
    const filename = `enhanced_${Date.now()}.png`;
    return new File([blob], filename, { type: blob.type });
  } catch (error) {
    console.error('Error downloading enhanced image:', error);
    return null;
  }
}