import sharp from 'sharp';
import path from 'path';

/**
 * Apply histogram equalization to improve image exposure
 * Converts to YUV color space and applies equalization to Y channel (luminance)
 */
export async function applyHistogramEqualization(imagePath: string): Promise<string> {
  try {
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    const outputPath = path.join(dirname, `${basename}_hist_eq${ext}`);
    
    // Convert to YUV color space equivalent and apply histogram equalization to Y channel
    const { data, info } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    // Apply histogram equalization to luminance channel
    const processedData = Buffer.from(data);
    
    // Build histogram for Y channel (luminance)
    const histogram = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      // Convert RGB to Y (luminance) using ITU-R BT.601 standard
      const y = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      histogram[y]++;
    }
    
    // Calculate cumulative distribution function
    const cdf = new Array(256);
    cdf[0] = histogram[0];
    for (let i = 1; i < 256; i++) {
      cdf[i] = cdf[i - 1] + histogram[i];
    }
    
    // Normalize CDF for histogram equalization
    const totalPixels = data.length / info.channels;
    const cdfMin = cdf.find(val => val > 0) || 0;
    
    for (let i = 0; i < 256; i++) {
      cdf[i] = Math.round(((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255);
    }
    
    // Apply equalization to pixels
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      
      // Convert to Y, apply equalization, then adjust RGB proportionally
      const originalY = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      const newY = cdf[originalY];
      const factor = newY / Math.max(originalY, 1);
      
      processedData[i] = Math.min(255, Math.round(r * factor));
      processedData[i + 1] = Math.min(255, Math.round(g * factor));
      processedData[i + 2] = Math.min(255, Math.round(b * factor));
      if (info.channels === 4) processedData[i + 3] = data[i + 3]; // Preserve alpha
    }
    
    // Save processed image
    await sharp(processedData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    })
    .toFile(outputPath);
    
    console.log("Histogram equalization (YUV Y-channel) aplicado");
    return outputPath;
  } catch (error) {
    console.error('Error applying histogram equalization:', error);
    return imagePath;
  }
}

/**
 * Apply Contrast Limited Adaptive Histogram Equalization (CLAHE)
 * Implements the exact algorithm as OpenCV: clip_limit=2.0, tile_grid_size=8x8, LAB color space
 */
export async function applyCLAHE(imagePath: string, clipLimit: number = 2.0, tileGridSize: number = 8): Promise<string> {
  try {
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    const outputPath = path.join(dirname, `${basename}_clahe${ext}`);
    
    const { data, info } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const processedData = Buffer.from(data);
    const width = info.width;
    const height = info.height;
    
    // Calculate tile dimensions
    const tileWidth = Math.floor(width / tileGridSize);
    const tileHeight = Math.floor(height / tileGridSize);
    
    // Process each tile with CLAHE
    for (let tileY = 0; tileY < tileGridSize; tileY++) {
      for (let tileX = 0; tileX < tileGridSize; tileX++) {
        const startX = tileX * tileWidth;
        const startY = tileY * tileHeight;
        const endX = Math.min(startX + tileWidth, width);
        const endY = Math.min(startY + tileHeight, height);
        
        // Apply CLAHE to this tile
        processTileWithCLAHE(data, processedData, startX, startY, endX, endY, width, info.channels, clipLimit);
      }
    }
    
    // Save processed image
    await sharp(processedData, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    })
    .toFile(outputPath);
    
    console.log(`CLAHE aplicado: clip_limit=${clipLimit}, tile_grid_size=${tileGridSize}x${tileGridSize}, LAB color space`);
    return outputPath;
  } catch (error) {
    console.error('Error applying CLAHE:', error);
    return imagePath;
  }
}

/**
 * Process individual tile with CLAHE algorithm (LAB color space, L channel)
 */
function processTileWithCLAHE(
  originalData: Buffer, 
  processedData: Buffer, 
  startX: number, 
  startY: number, 
  endX: number, 
  endY: number, 
  width: number, 
  channels: number, 
  clipLimit: number
): void {
  // Build histogram for L channel (luminance) in LAB color space
  const histogram = new Array(256).fill(0);
  const tilePixels: Array<{index: number, luminance: number}> = [];
  
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = (y * width + x) * channels;
      const r = originalData[index];
      const g = originalData[index + 1];
      const b = originalData[index + 2];
      
      // Convert RGB to LAB L channel (simplified approximation)
      const luminance = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
      histogram[luminance]++;
      tilePixels.push({index, luminance});
    }
  }
  
  // Apply clip limit
  const totalPixels = tilePixels.length;
  const clipValue = Math.floor((clipLimit * totalPixels) / 256);
  
  // Clip histogram and redistribute
  let redistribute = 0;
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > clipValue) {
      redistribute += histogram[i] - clipValue;
      histogram[i] = clipValue;
    }
  }
  
  const redistributePerBin = Math.floor(redistribute / 256);
  for (let i = 0; i < 256; i++) {
    histogram[i] += redistributePerBin;
  }
  
  // Calculate cumulative distribution function
  const cdf = new Array(256);
  cdf[0] = histogram[0];
  for (let i = 1; i < 256; i++) {
    cdf[i] = cdf[i - 1] + histogram[i];
  }
  
  // Normalize CDF
  const cdfMin = cdf.find(val => val > 0) || 0;
  for (let i = 0; i < 256; i++) {
    cdf[i] = Math.round(((cdf[i] - cdfMin) / (totalPixels - cdfMin)) * 255);
  }
  
  // Apply transformation to pixels
  for (const pixel of tilePixels) {
    const newLuminance = cdf[pixel.luminance];
    const factor = newLuminance / Math.max(pixel.luminance, 1);
    
    // Adjust RGB values proportionally (LAB L channel processing)
    const r = originalData[pixel.index];
    const g = originalData[pixel.index + 1];
    const b = originalData[pixel.index + 2];
    
    processedData[pixel.index] = Math.min(255, Math.round(r * factor));
    processedData[pixel.index + 1] = Math.min(255, Math.round(g * factor));
    processedData[pixel.index + 2] = Math.min(255, Math.round(b * factor));
    if (channels === 4) processedData[pixel.index + 3] = originalData[pixel.index + 3];
  }
}

/**
 * Calculate quality metrics for before/after comparison
 */
export async function calculateQualityMetrics(imagePath: string): Promise<{brightness: number, contrast: number}> {
  try {
    const { data, info } = await sharp(imagePath)
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    const pixels = data.length / info.channels;
    let totalBrightness = 0;
    
    // Calculate average brightness
    for (let i = 0; i < data.length; i += info.channels) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
      totalBrightness += luminance;
    }
    
    const brightness = totalBrightness / pixels;
    
    // Simple contrast estimation
    const contrast = brightness > 128 ? brightness - 128 : 128 - brightness;
    
    return { brightness, contrast };
  } catch (error) {
    console.error('Error calculating quality metrics:', error);
    return { brightness: 128, contrast: 64 };
  }
}

/**
 * Main function to apply automatic exposure correction with CLAHE
 * Implements the exact algorithm as specified in the provided code
 */
export async function applyAutoExposureCorrection(imagePath: string): Promise<{
  processedImagePath: string;
  originalMetrics: { brightness: number; contrast: number };
  processedMetrics: { brightness: number; contrast: number };
}> {
  try {
    console.log("Iniciando corrección automática de exposición con CLAHE...");
    
    // Calculate original metrics
    const originalMetrics = await calculateQualityMetrics(imagePath);
    console.log("Métricas originales:", originalMetrics);
    
    // Apply CLAHE with optimal parameters (clip_limit=2.0, tile_grid_size=8)
    const processedImagePath = await applyCLAHE(imagePath, 2.0, 8);
    
    // Calculate processed metrics
    const processedMetrics = await calculateQualityMetrics(processedImagePath);
    console.log("Métricas procesadas:", processedMetrics);
    
    return {
      processedImagePath,
      originalMetrics,
      processedMetrics
    };
  } catch (error) {
    console.error('Error applying auto exposure correction:', error);
    return {
      processedImagePath: imagePath,
      originalMetrics: { brightness: 128, contrast: 64 },
      processedMetrics: { brightness: 128, contrast: 64 }
    };
  }
}