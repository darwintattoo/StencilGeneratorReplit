// Definición de tipos para evitar errores con window.Image en react-konva
interface Window {
  Image: {
    new(): HTMLImageElement;
    prototype: HTMLImageElement;
  }
}