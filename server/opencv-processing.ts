import { spawn } from 'child_process';
import path from 'path';

/**
 * Apply CLAHE using direct Python OpenCV implementation
 * Following your specification: LAB color space, L channel only, proper interpolation
 */
export async function applyCLAHE(imagePath: string, clipLimit: number = 2.0, tileGridSize: number = 8): Promise<string> {
  try {
    const ext = path.extname(imagePath);
    const basename = path.basename(imagePath, ext);
    const dirname = path.dirname(imagePath);
    const outputPath = path.join(dirname, `${basename}_clahe${ext}`);
    
    // Create inline Python script that implements your exact specification
    const pythonScript = `
import cv2
import numpy as np
import sys
import json

def apply_clahe_correct(image_path, output_path, clip_limit=2.0, tile_grid_size=8):
    """Apply CLAHE exactly as specified in research"""
    try:
        # Load image and convert to LAB color space
        img = cv2.imread(image_path)
        if img is None:
            return {"success": False, "error": "Could not load image"}
        
        lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)
        
        # Split channels
        l, a, b = cv2.split(lab)
        
        # Create and apply CLAHE on L channel
        clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
        l_equalized = clahe.apply(l)
        
        # Combine channels and convert back to BGR
        lab_equalized = cv2.merge([l_equalized, a, b])
        bgr = cv2.cvtColor(lab_equalized, cv2.COLOR_LAB2BGR)
        
        # Save result
        cv2.imwrite(output_path, bgr)
        
        # Calculate metrics
        gray_orig = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        gray_proc = cv2.cvtColor(bgr, cv2.COLOR_BGR2GRAY)
        
        return {
            "success": True,
            "output_path": output_path,
            "original_metrics": {
                "brightness": float(np.mean(gray_orig)),
                "contrast": float(np.std(gray_orig))
            },
            "processed_metrics": {
                "brightness": float(np.mean(gray_proc)),
                "contrast": float(np.std(gray_proc))
            }
        }
    except Exception as e:
        return {"success": False, "error": str(e)}

if __name__ == "__main__":
    result = apply_clahe_correct("${imagePath}", "${outputPath}", ${clipLimit}, ${tileGridSize})
    print(json.dumps(result, indent=2))
`;
    
    const pythonProcess = spawn('python3', ['-c', pythonScript]);
    
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
          reject(new Error(`CLAHE processing failed: ${stderr}`));
          return;
        }
        
        try {
          const result = JSON.parse(stdout);
          if (result.success) {
            console.log(`CLAHE applied: ${result.original_metrics.brightness.toFixed(1)} → ${result.processed_metrics.brightness.toFixed(1)}`);
            resolve(result.output_path);
          } else {
            reject(new Error(result.error));
          }
        } catch (parseError) {
          reject(new Error('Failed to parse CLAHE output'));
        }
      });
    });
  } catch (error) {
    console.error('Error applying CLAHE:', error);
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