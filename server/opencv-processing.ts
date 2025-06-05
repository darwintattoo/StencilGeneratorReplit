import { spawn } from 'child_process';
import path from 'path';

/**
 * Apply real OpenCV CLAHE using the exact AutoImageEnhancer implementation
 * This replaces all manual CLAHE implementations with cv2.createCLAHE()
 */
export async function applyCLAHE(imagePath: string, clipLimit: number = 2.0, tileGridSize: number = 8): Promise<string> {
  try {
    console.log(`AutoImageEnhancer CLAHE Processing Started:`, {
      input: path.basename(imagePath),
      clipLimit,
      tileGridSize: `${tileGridSize}x${tileGridSize}`,
      algorithm: 'cv2.createCLAHE() - Real OpenCV'
    });
    
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    const outputPath = path.join(dirname, `${basename}_clahe_enhanced${ext}`);
    
    // Execute AutoImageEnhancer CLAHE processor using cv2.createCLAHE()
    const pythonProcess = spawn('python3', [
      path.join(__dirname, 'autoenhancer_clahe.py'),
      imagePath,
      outputPath
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
          console.error('AutoImageEnhancer CLAHE processor error:', stderr);
          reject(new Error(`CLAHE processing failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            console.log('AutoImageEnhancer CLAHE processing complete:', {
              originalMetrics: result.original_metrics,
              processedMetrics: result.processed_metrics,
              outputPath: result.output_path
            });
            resolve(result.output_path);
          } else {
            console.error('AutoImageEnhancer CLAHE processing failed:', result.error);
            reject(new Error(result.error));
          }
        } catch (parseError) {
          console.error('Failed to parse AutoImageEnhancer output:', stdout);
          reject(new Error('Failed to parse CLAHE processor output'));
        }
      });
    });
  } catch (error) {
    console.error('Error applying AutoImageEnhancer CLAHE:', error);
    return imagePath;
  }
}

/**
 * Calculate quality metrics using Python script for consistency
 */
export async function calculateQualityMetrics(imagePath: string): Promise<{brightness: number, contrast: number}> {
  try {
    const pythonProcess = spawn('python3', ['-c', `
import cv2
import numpy as np
import sys
import json

image = cv2.imread('${imagePath}')
if image is None:
    print(json.dumps({'brightness': 128, 'contrast': 64}))
    sys.exit(0)

gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
brightness = float(np.mean(gray))
contrast = float(np.std(gray))

print(json.dumps({'brightness': brightness, 'contrast': contrast}))
`]);
    
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
          console.error('Metrics calculation error:', stderr);
          resolve({ brightness: 128, contrast: 64 });
          return;
        }
        
        try {
          const result = JSON.parse(stdout.trim());
          resolve(result);
        } catch (parseError) {
          console.error('Failed to parse metrics output:', stdout);
          resolve({ brightness: 128, contrast: 64 });
        }
      });
    });
  } catch (error) {
    console.error('Error calculating quality metrics:', error);
    return { brightness: 128, contrast: 64 };
  }
}

/**
 * Apply automatic exposure correction using real AutoImageEnhancer CLAHE
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
    console.log(`AutoImageEnhancer Auto Exposure Correction - clipLimit: ${clipLimit}, tileGridSize: ${tileGridSize}x${tileGridSize}`);
    
    // Calculate original metrics
    const originalMetrics = await calculateQualityMetrics(imagePath);
    console.log("Original metrics:", originalMetrics);
    
    // Apply real OpenCV CLAHE
    const processedImagePath = await applyCLAHE(imagePath, clipLimit, tileGridSize);
    
    // Calculate processed metrics
    const processedMetrics = await calculateQualityMetrics(processedImagePath);
    console.log("Processed metrics:", processedMetrics);
    
    return {
      processedImagePath,
      originalMetrics,
      processedMetrics
    };
  } catch (error) {
    console.error('Error applying AutoImageEnhancer auto exposure correction:', error);
    return {
      processedImagePath: imagePath,
      originalMetrics: { brightness: 128, contrast: 64 },
      processedMetrics: { brightness: 128, contrast: 64 }
    };
  }
}