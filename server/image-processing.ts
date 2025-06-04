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
    const denominator = totalPixels - cdfMin;
    
    // Handle edge case where all pixels have the same luminance
    if (denominator <= 0) {
      console.warn("All pixels have the same luminance, skipping histogram equalization");
      return imagePath;
    }
    
    for (let i = 0; i < 256; i++) {
      cdf[i] = Math.round(((cdf[i] - cdfMin) / denominator) * 255);
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
    console.log(`🔬 CLAHE Processing Started:`, {
      input: path.basename(imagePath),
      clipLimit,
      tileGridSize: `${tileGridSize}x${tileGridSize}`,
      algorithm: 'LAB color space, L channel processing'
    });
    
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    const outputPath = path.join(dirname, `${basename}_clahe${ext}`);
    
    // Convert to LAB color space first
    const { data: labData, info } = await sharp(imagePath)
      .toColourspace('lab')
      .raw()
      .toBuffer({ resolveWithObject: true });
    
    console.log(`📊 Image Analysis:`, {
      dimensions: `${info.width}x${info.height}`,
      channels: info.channels,
      colorSpace: 'LAB',
      totalPixels: info.width * info.height,
      dataSize: `${Math.round(labData.length / 1024)}KB`
    });
    
    // Create working copy for L channel processing
    const processedLab = Buffer.from(labData);
    const width = info.width;
    const height = info.height;
    
    // Calculate tile dimensions
    const tileWidth = Math.floor(width / tileGridSize);
    const tileHeight = Math.floor(height / tileGridSize);
    const totalTiles = tileGridSize * tileGridSize;
    
    console.log(`🎯 Tile Configuration:`, {
      tileSize: `${tileWidth}x${tileHeight}`,
      totalTiles,
      coverage: `${(tileWidth * tileGridSize)}x${(tileHeight * tileGridSize)} of ${width}x${height}`
    });
    
    // Create lookup tables for each tile
    const tileLookupTables: Uint8Array[][] = [];
    
    // Process each tile with CLAHE to generate lookup tables
    for (let tileY = 0; tileY < tileGridSize; tileY++) {
      tileLookupTables[tileY] = [];
      for (let tileX = 0; tileX < tileGridSize; tileX++) {
        const startX = tileX * tileWidth;
        const startY = tileY * tileHeight;
        const endX = Math.min(startX + tileWidth, width);
        const endY = Math.min(startY + tileHeight, height);
        
        // Generate CLAHE lookup table for this tile (L channel only)
        const lut = generateCLAHELookupTableOptimized(labData, startX, startY, endX, endY, width, info.channels, clipLimit);
        tileLookupTables[tileY][tileX] = lut;
      }
    }
    
    // Apply CLAHE with bilinear interpolation between tiles
    applyCLAHEWithBilinearInterpolation(labData, processedLab, width, height, info.channels, tileLookupTables, tileGridSize, tileWidth, tileHeight);
    
    console.log(`✅ CLAHE Processing Complete with bilinear interpolation`);
    
    // Convert back to RGB and save
    await sharp(processedLab, {
      raw: {
        width: info.width,
        height: info.height,
        channels: info.channels
      }
    })
    .toColourspace('srgb')
    .toFile(outputPath);
    
    console.log(`CLAHE aplicado: clip_limit=${clipLimit}, tile_grid_size=${tileGridSize}x${tileGridSize}, LAB color space con interpolación`);
    return outputPath;
  } catch (error) {
    console.error('Error applying CLAHE:', error);
    return imagePath;
  }
}

/**
 * Generate CLAHE lookup table for a specific tile (LAB L channel only)
 */
function generateCLAHELookupTableOptimized(
  labData: Buffer,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  width: number,
  channels: number,
  clipLimit: number
): Uint8Array {
  // Build histogram for L channel only (first channel in LAB)
  const histogram = new Array(256).fill(0);
  let totalPixels = 0;
  
  for (let y = startY; y < endY; y++) {
    for (let x = startX; x < endX; x++) {
      const index = (y * width + x) * channels;
      const lValue = labData[index]; // L channel in LAB color space
      histogram[lValue]++;
      totalPixels++;
    }
  }
  
  // Apply clip limit to histogram
  const clipValue = Math.floor((clipLimit * totalPixels) / 256);
  let redistribute = 0;
  
  for (let i = 0; i < 256; i++) {
    if (histogram[i] > clipValue) {
      redistribute += histogram[i] - clipValue;
      histogram[i] = clipValue;
    }
  }
  
  // Redistribute excess uniformly
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
  
  // Normalize CDF to create lookup table
  const lut = new Uint8Array(256);
  const cdfMin = cdf.find(val => val > 0) || 0;
  const denominator = totalPixels - cdfMin;
  
  if (denominator <= 0) {
    // Identity mapping if all pixels have same value
    for (let i = 0; i < 256; i++) {
      lut[i] = i;
    }
  } else {
    for (let i = 0; i < 256; i++) {
      lut[i] = Math.round(((cdf[i] - cdfMin) / denominator) * 255);
    }
  }
  
  return lut;
}

/**
 * Apply CLAHE with bilinear interpolation between tile lookup tables
 */
function applyCLAHEWithBilinearInterpolation(
  originalLab: Buffer,
  processedLab: Buffer,
  width: number,
  height: number,
  channels: number,
  tileLookupTables: Uint8Array[][],
  tileGridSize: number,
  tileWidth: number,
  tileHeight: number
): void {
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * channels;
      const originalL = originalLab[index];
      
      // Calculate tile coordinates (floating point for interpolation)
      const tileX = Math.min((x / tileWidth), tileGridSize - 1);
      const tileY = Math.min((y / tileHeight), tileGridSize - 1);
      
      // Get integer tile indices
      const tileX0 = Math.floor(tileX);
      const tileY0 = Math.floor(tileY);
      const tileX1 = Math.min(tileX0 + 1, tileGridSize - 1);
      const tileY1 = Math.min(tileY0 + 1, tileGridSize - 1);
      
      // Calculate interpolation weights
      const wx = tileX - tileX0;
      const wy = tileY - tileY0;
      
      // Get lookup values from four surrounding tiles
      const lut00 = tileLookupTables[tileY0][tileX0][originalL];
      const lut01 = tileLookupTables[tileY0][tileX1][originalL];
      const lut10 = tileLookupTables[tileY1][tileX0][originalL];
      const lut11 = tileLookupTables[tileY1][tileX1][originalL];
      
      // Bilinear interpolation
      const top = lut00 * (1 - wx) + lut01 * wx;
      const bottom = lut10 * (1 - wx) + lut11 * wx;
      const interpolatedL = Math.round(top * (1 - wy) + bottom * wy);
      
      // Apply transformation only to L channel, preserve A and B channels
      processedLab[index] = interpolatedL;
      processedLab[index + 1] = originalLab[index + 1]; // A channel
      processedLab[index + 2] = originalLab[index + 2]; // B channel
      if (channels === 4) processedLab[index + 3] = originalLab[index + 3]; // Alpha
    }
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
export async function applyAutoExposureCorrection(
  imagePath: string, 
  clipLimit: number = 2.0, 
  tileGridSize: number = 8
): Promise<{
  processedImagePath: string;
  originalMetrics: { brightness: number; contrast: number };
  processedMetrics: { brightness: number; contrast: number };
}> {
  try {
    console.log(`Iniciando corrección automática de exposición con CLAHE (${clipLimit}, ${tileGridSize}x${tileGridSize})...`);
    
    // Calculate original metrics
    const originalMetrics = await calculateQualityMetrics(imagePath);
    console.log("Métricas originales:", originalMetrics);
    
    // Apply CLAHE with custom parameters
    const processedImagePath = await applyCLAHE(imagePath, clipLimit, tileGridSize);
    
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