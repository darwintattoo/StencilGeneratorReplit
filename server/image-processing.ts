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
 * Using Python OpenCV implementation for accuracy
 */
export async function applyCLAHE(imagePath: string, clipLimit: number = 2.0, tileGridSize: number = 8): Promise<string> {
  const { spawn } = await import('child_process');
  const { promisify } = await import('util');
  
  try {
    console.log(`CLAHE Processing Started:`, {
      input: path.basename(imagePath),
      clipLimit,
      tileGridSize: `${tileGridSize}x${tileGridSize}`,
      algorithm: 'Python OpenCV implementation'
    });
    
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    const outputPath = path.join(dirname, `${basename}_enhanced_clahe${ext}`);
    
    // Execute Python CLAHE processor using exact working code
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'clahe_exact.py'),
      imagePath,
      outputPath,
      clipLimit.toString(),
      tileGridSize.toString()
    ]);
    
    let stdout = '';
    let stderr = '';
    
    pythonProcess.stdout.on('data', (data) => {
      stdout += data.toString();
    });
    
    pythonProcess.stderr.on('data', (data) => {
      stderr += data.toString();
    });
    
    return new Promise((resolve, reject) => {
      pythonProcess.on('close', (code) => {
        if (code !== 0) {
          console.error('Python CLAHE processor error:', stderr);
          reject(new Error(`CLAHE processing failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            console.log('CLAHE processing complete:', result);
            resolve(result.output_path);
          } else {
            console.error('CLAHE processing failed:', result.error);
            reject(new Error(result.error));
          }
        } catch (parseError) {
          console.error('Failed to parse Python output:', stdout);
          reject(new Error('Failed to parse CLAHE processor output'));
        }
      });
    });
    
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
 * Apply CLAHE with improved bilinear interpolation between tile lookup tables
 */
function applyCLAHEWithBilinearInterpolation(
  labData: Buffer,
  processedLab: Buffer,
  width: number,
  height: number,
  channels: number,
  tileLookupTables: Uint8Array[][],
  tileGridSize: number,
  tileWidth: number,
  tileHeight: number
): void {
  // Process pixel by pixel with improved interpolation formula
  for (let y = 0; y < height; y++) {
    // Calculate tile Y coordinate with offset centering
    const ty = (y + 0.5) / tileHeight - 0.5;
    const yLow = Math.max(Math.floor(ty), 0);
    const yHigh = Math.min(yLow + 1, tileGridSize - 1);
    const wy = ty - yLow;

    for (let x = 0; x < width; x++) {
      // Calculate tile X coordinate with offset centering  
      const tx = (x + 0.5) / tileWidth - 0.5;
      const xLow = Math.max(Math.floor(tx), 0);
      const xHigh = Math.min(xLow + 1, tileGridSize - 1);
      const wx = tx - xLow;

      const idx = (y * width + x) * channels;
      const val = labData[idx]; // L channel value

      // Get lookup values from four surrounding tiles
      const l00 = tileLookupTables[yLow][xLow][val];
      const l10 = tileLookupTables[yLow][xHigh][val];
      const l01 = tileLookupTables[yHigh][xLow][val];
      const l11 = tileLookupTables[yHigh][xHigh][val];

      // Improved bilinear interpolation formula
      const newL = (1 - wy) * ((1 - wx) * l00 + wx * l10) + wy * ((1 - wx) * l01 + wx * l11);
      
      // Apply transformation only to L channel, preserve A and B channels
      processedLab[idx] = newL & 0xff; // Ensure 8-bit value
      processedLab[idx + 1] = labData[idx + 1]; // A channel unchanged
      processedLab[idx + 2] = labData[idx + 2]; // B channel unchanged
      if (channels === 4) processedLab[idx + 3] = labData[idx + 3]; // Alpha unchanged
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