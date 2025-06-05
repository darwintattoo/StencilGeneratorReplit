// server/image-processing.ts
export async function applyAutoExposureCorrection(
  imagePath: string,
  clipLimit: number = 2.0,
  tileGridSize: number = 8
): Promise<string> {
  // No aplicar ningún procesamiento, devolver la imagen original
  return imagePath;
}