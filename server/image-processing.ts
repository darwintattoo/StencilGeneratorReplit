// server/image-processing.ts
import { exec } from 'child_process';
import { promisify } from 'util';
import path from 'path';

const execAsync = promisify(exec);

export async function applyCLAHE(
  imagePath: string,
  clipLimit = 2.0,
  tileGridSize = 8
): Promise<string> {
  const ext = path.extname(imagePath);
  const basename = path.basename(imagePath, ext);
  const outputPath = path.join(path.dirname(imagePath), `${basename}_clahe${ext}`);

  // Ejecutar el script Python con OpenCV real
  const command = `python3 server/autoenhancer_clahe.py "${imagePath}" "${outputPath}"`;
  
  try {
    const { stdout, stderr } = await execAsync(command);
    const result = JSON.parse(stdout);
    
    if (!result.success) {
      throw new Error(result.error);
    }
    
    return outputPath;
  } catch (error) {
    console.error('Error applying CLAHE:', error);
    throw new Error(`Failed to apply CLAHE: ${error}`);
  }
}

export async function applyAutoExposureCorrection(
  imagePath: string,
  clipLimit: number = 2.0,
  tileGridSize: number = 8
): Promise<string> {
  return await applyCLAHE(imagePath, clipLimit, tileGridSize);
}