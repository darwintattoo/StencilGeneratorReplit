// server/image-processing.ts
import { spawn } from 'child_process';
import path from 'path';

export async function applyCLAHE(
  imagePath: string,
  clipLimit = 2.0,
  tileGridSize = 8
): Promise<string> {
  const ext = path.extname(imagePath);
  const basename = path.basename(imagePath, ext);
  const dirname = path.dirname(imagePath);
  const outputPath = path.join(dirname, `${basename}_clahe${ext}`);

  // Python script implementing exact OpenCV CLAHE as specified in your research
  const pythonScript = `
import cv2
import numpy as np
import sys

# Read command line arguments
input_path = sys.argv[1]
output_path = sys.argv[2]
clip_limit = float(sys.argv[3])
tile_grid_size = int(sys.argv[4])

try:
    # Cargar imagen y convertir a espacio LAB
    img = cv2.imread(input_path)
    lab = cv2.cvtColor(img, cv2.COLOR_BGR2LAB)

    # Dividir canales
    l, a, b = cv2.split(lab)

    # Crear y aplicar CLAHE en el canal L
    clahe = cv2.createCLAHE(clipLimit=clip_limit, tileGridSize=(tile_grid_size, tile_grid_size))
    l_equalized = clahe.apply(l)

    # Combinar canales y volver a RGB
    lab_equalized = cv2.merge([l_equalized, a, b])
    bgr = cv2.cvtColor(lab_equalized, cv2.COLOR_LAB2BGR)

    cv2.imwrite(output_path, bgr)
    print("SUCCESS")
except Exception as e:
    print(f"ERROR: {e}")
    sys.exit(1)
`;

  return new Promise((resolve, reject) => {
    const process = spawn('python3', [
      '-c', pythonScript,
      imagePath,
      outputPath,
      clipLimit.toString(),
      tileGridSize.toString()
    ]);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
    });

    process.on('close', (code) => {
      if (code === 0 && stdout.includes('SUCCESS')) {
        resolve(outputPath);
      } else {
        reject(new Error(`CLAHE failed: ${stderr}`));
      }
    });
  });
}