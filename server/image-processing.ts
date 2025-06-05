// server/image-processing.ts
import cv from 'opencv4nodejs';
import path from 'path';

export async function applyCLAHE(
  imagePath: string,
  clipLimit = 2.0,
  tileGridSize = 8
): Promise<string> {
  const ext = path.extname(imagePath);
  const basename = path.basename(imagePath, ext);
  const outputPath = path.join(path.dirname(imagePath), `${basename}_clahe${ext}`);

  // Leer imagen en BGR
  const img = await cv.imreadAsync(imagePath);

  // Convertir a LAB y separar canales
  const lab = img.cvtColor(cv.COLOR_BGR2Lab);
  const [l, a, b] = lab.split();

  // Crear CLAHE y aplicarlo sobre L
  const clahe = new cv.CLAHE(clipLimit, new cv.Size(tileGridSize, tileGridSize));
  const lEqualized = clahe.apply(l);

  // Unir canales y volver a RGB
  const labMerged = new cv.Mat([lEqualized, a, b]).merge();
  const resultBGR = labMerged.cvtColor(cv.COLOR_Lab2BGR);

  await cv.imwriteAsync(outputPath, resultBGR);
  return outputPath;
}

export async function applyAutoExposureCorrection(
  imagePath: string,
  clipLimit: number = 2.0,
  tileGridSize: number = 8
): Promise<string> {
  return await applyCLAHE(imagePath, clipLimit, tileGridSize);
}