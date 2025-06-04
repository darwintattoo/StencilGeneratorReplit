import sharp from 'sharp';
import fs from 'fs';

/**
 * Aplica corrección automática de exposición usando técnicas similares a CLAHE
 * Mejora el contraste adaptativo y corrige problemas de exposición
 */
export async function applyAutoExposureCorrection(inputPath: string, outputPath: string): Promise<void> {
  try {
    // Leer la imagen y obtener metadatos
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Aplicar corrección automática de exposición
    const processedImage = image
      // Normalizar el histograma para mejorar el contraste
      .normalize()
      // Aplicar mejora de contraste adaptativo
      .modulate({
        brightness: 1.1,    // Ligero aumento de brillo
        saturation: 1.05,   // Ligero aumento de saturación
        hue: 0              // Sin cambio de tono
      })
      // Aplicar corrección gamma para mejorar los medios tonos
      .gamma(1.2)
      // Aplicar un filtro de nitidez sutil
      .sharpen({
        sigma: 0.5,
        m1: 1.0,
        m2: 2.0,
        x1: 2,
        y2: 10,
        y3: 20
      });

    // Guardar la imagen procesada
    await processedImage.toFile(outputPath);
    
    console.log(`Auto exposure correction applied: ${inputPath} -> ${outputPath}`);
  } catch (error) {
    console.error('Error applying auto exposure correction:', error);
    // Si hay error, copiar el archivo original sin modificaciones
    fs.copyFileSync(inputPath, outputPath);
  }
}

/**
 * Versión alternativa con corrección más agresiva para imágenes muy oscuras o claras
 */
export async function applyAdvancedExposureCorrection(inputPath: string, outputPath: string): Promise<void> {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();
    
    // Obtener estadísticas de la imagen para detectar problemas de exposición
    const { channels } = await image.stats();
    
    // Calcular el brillo promedio
    const avgBrightness = channels.reduce((sum, channel) => sum + channel.mean, 0) / channels.length;
    
    // Determinar si la imagen está sub o sobre expuesta
    const isUnderexposed = avgBrightness < 100;
    const isOverexposed = avgBrightness > 200;
    
    let processedImage = image.normalize();
    
    if (isUnderexposed) {
      // Corrección para imágenes oscuras
      processedImage = processedImage
        .modulate({
          brightness: 1.3,
          saturation: 1.1,
          hue: 0
        })
        .gamma(1.4);
    } else if (isOverexposed) {
      // Corrección para imágenes claras
      processedImage = processedImage
        .modulate({
          brightness: 0.9,
          saturation: 1.05,
          hue: 0
        })
        .gamma(0.8);
    } else {
      // Corrección estándar
      processedImage = processedImage
        .modulate({
          brightness: 1.1,
          saturation: 1.05,
          hue: 0
        })
        .gamma(1.2);
    }
    
    // Aplicar nitidez final
    await processedImage
      .sharpen({ sigma: 0.5 })
      .toFile(outputPath);
      
    console.log(`Advanced exposure correction applied: ${inputPath} -> ${outputPath}`);
    console.log(`Average brightness: ${avgBrightness}, Underexposed: ${isUnderexposed}, Overexposed: ${isOverexposed}`);
  } catch (error) {
    console.error('Error applying advanced exposure correction:', error);
    fs.copyFileSync(inputPath, outputPath);
  }
}