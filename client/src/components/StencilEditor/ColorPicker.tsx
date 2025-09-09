import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ColorPickerProps {
  color: string;
  onChange: (color: string) => void;
  isOpen: boolean;
  onClose: () => void;
}

export default function ColorPicker({ color, onChange, isOpen, onClose }: ColorPickerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [hue, setHue] = useState(0);
  const [saturation, setSaturation] = useState(100);
  const [brightness, setBrightness] = useState(100);
  const [isDragging, setIsDragging] = useState(false);
  const [dragType, setDragType] = useState<'wheel' | 'square' | null>(null);

  // Convertir hex a HSV
  const hexToHsv = useCallback((hex: string) => {
    const r = parseInt(hex.slice(1, 3), 16) / 255;
    const g = parseInt(hex.slice(3, 5), 16) / 255;
    const b = parseInt(hex.slice(5, 7), 16) / 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const diff = max - min;

    let h = 0;
    let s = max === 0 ? 0 : diff / max;
    let v = max;

    if (diff !== 0) {
      switch (max) {
        case r: h = ((g - b) / diff + (g < b ? 6 : 0)) / 6; break;
        case g: h = ((b - r) / diff + 2) / 6; break;
        case b: h = ((r - g) / diff + 4) / 6; break;
      }
    }

    return { h: h * 360, s: s * 100, v: v * 100 };
  }, []);

  // Convertir HSV a RGB según la documentación
  const hsvToRgb = useCallback((h: number, s: number, v: number) => {
    h = h / 60;
    s = s / 100;
    v = v / 100;
    
    const c = v * s;
    const x = c * (1 - Math.abs((h % 2) - 1));
    const m = v - c;
    
    let r, g, b;
    
    if (h < 1) { r = c; g = x; b = 0; }
    else if (h < 2) { r = x; g = c; b = 0; }
    else if (h < 3) { r = 0; g = c; b = x; }
    else if (h < 4) { r = 0; g = x; b = c; }
    else if (h < 5) { r = x; g = 0; b = c; }
    else { r = c; g = 0; b = x; }
    
    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((b + m) * 255)
    };
  }, []);

  // Convertir RGB a hex
  const rgbToHex = useCallback((r: number, g: number, b: number) => {
    const toHex = (c: number) => {
      const hex = c.toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }, []);

  // Inicializar con color actual
  useEffect(() => {
    if (color && isOpen) {
      const hsv = hexToHsv(color);
      setHue(hsv.h);
      setSaturation(hsv.s);
      setBrightness(hsv.v);
    }
  }, [color, isOpen, hexToHsv]);

  // Dibujar la rueda de color según la documentación
  useEffect(() => {
    if (!isOpen) return;
    
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 15;
    const ringInnerRadius = outerRadius * 0.78;
    const circleRadius = ringInnerRadius - 5; // Radio del círculo central

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // 1. Dibujar el anillo exterior con todos los colores (hue wheel)
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let y = 0; y < canvas.height; y++) {
      for (let x = 0; x < canvas.width; x++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        // Solo dibujar píxeles dentro del anillo
        if (distance >= ringInnerRadius && distance <= outerRadius) {
          // Calcular el ángulo para el hue
          let angle = Math.atan2(dy, dx);
          // Convertir a grados (0-360)
          let hueAngle = ((angle + Math.PI) / (2 * Math.PI)) * 360;
          
          const rgb = hsvToRgb(hueAngle, 100, 100);
          
          const index = (y * canvas.width + x) * 4;
          data[index] = rgb.r;
          data[index + 1] = rgb.g;
          data[index + 2] = rgb.b;
          data[index + 3] = 255;
        }
      }
    }
    
    ctx.putImageData(imageData, 0, 0);

    // 2. Dibujar el círculo central con gradiente de saturación/brillo
    
    // Gradiente radial de saturación (centro blanco a borde con color)
    const satGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, circleRadius);
    satGradient.addColorStop(0, `hsl(${hue}, 0%, 100%)`);
    satGradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = satGradient;
    ctx.fill();
    
    // Gradiente vertical de brillo (arriba blanco a abajo negro)
    const brightGradient = ctx.createLinearGradient(centerX, centerY - circleRadius, centerX, centerY + circleRadius);
    brightGradient.addColorStop(0, 'rgba(255, 255, 255, 0)');
    brightGradient.addColorStop(0.5, 'rgba(0, 0, 0, 0)');
    brightGradient.addColorStop(1, 'rgba(0, 0, 0, 0.9)');
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, circleRadius, 0, Math.PI * 2);
    ctx.fillStyle = brightGradient;
    ctx.fill();

    // 3. Dibujar indicadores
    // Indicador en el anillo de hue
    const hueAngle = (hue * Math.PI / 180);
    const hueRadius = (outerRadius + ringInnerRadius) / 2;
    const hueX = centerX + Math.cos(hueAngle) * hueRadius;
    const hueY = centerY + Math.sin(hueAngle) * hueRadius;
    
    ctx.beginPath();
    ctx.arc(hueX, hueY, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
    
    const hueRgb = hsvToRgb(hue, 100, 100);
    ctx.beginPath();
    ctx.arc(hueX, hueY, 7, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
    ctx.fill();

    // Indicador en el círculo de saturación/brillo
    // Mapear saturación y brillo a coordenadas polares
    const angle = 0; // Por simplicidad, usar ángulo 0
    const radius = (saturation / 100) * circleRadius;
    const satX = centerX + Math.cos(angle) * radius;
    const satY = centerY + Math.sin(angle) * radius;
    
    ctx.beginPath();
    ctx.arc(satX, satY, 8, 0, Math.PI * 2);
    ctx.strokeStyle = 'white';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 1;
    ctx.stroke();
  }, [hue, saturation, brightness, hsvToRgb, isOpen]);

  // Manejar clics según la documentación
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const outerRadius = Math.min(centerX, centerY) - 15;
    const ringInnerRadius = outerRadius * 0.78;
    const circleRadius = ringInnerRadius - 5;

    setIsDragging(true);

    if (distance >= ringInnerRadius && distance <= outerRadius) {
      // Click en el anillo de hue
      setDragType('wheel');
      const angle = Math.atan2(y - centerY, x - centerX);
      const degrees = ((angle + Math.PI) / (2 * Math.PI)) * 360;
      setHue(degrees);
    } else if (distance < circleRadius) {
      // Click en el círculo central
      setDragType('square');
      // Por ahora, mapear simplemente basado en distancia del centro
      const s = Math.min(100, (distance / circleRadius) * 100);
      setSaturation(s);
      // Brillo basado en posición vertical
      const normalizedY = (y - centerY) / circleRadius;
      const b = Math.max(0, Math.min(100, 50 - normalizedY * 50));
      setBrightness(b);
    }
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDragging || !dragType) return;

    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 15;
    const ringInnerRadius = outerRadius * 0.78;
    const circleRadius = ringInnerRadius - 5;

    if (dragType === 'wheel') {
      const angle = Math.atan2(y - centerY, x - centerX);
      const degrees = ((angle + Math.PI) / (2 * Math.PI)) * 360;
      setHue(degrees);
    } else if (dragType === 'square') {
      const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
      if (distance <= circleRadius) {
        const s = Math.min(100, (distance / circleRadius) * 100);
        setSaturation(s);
        // Brillo basado en posición vertical
        const normalizedY = (y - centerY) / circleRadius;
        const b = Math.max(0, Math.min(100, 50 - normalizedY * 50));
        setBrightness(b);
      }
    }
  }, [isDragging, dragType]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  // Actualizar color cuando cambian los valores
  useEffect(() => {
    const rgb = hsvToRgb(hue, saturation, brightness);
    const newColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    if (newColor !== color) {
      onChange(newColor);
    }
  }, [hue, saturation, brightness, onChange, color, hsvToRgb, rgbToHex]);

  if (!isOpen) return null;

  return (
    <>
      {/* Overlay para cerrar al hacer click fuera */}
      <div 
        className="fixed inset-0 z-40" 
        onClick={onClose}
      />
      
      <div 
        className="absolute top-full left-0 mt-2 bg-gray-800 rounded-lg p-4 shadow-xl border border-gray-600 z-50"
        onClick={(e) => e.stopPropagation()}
        style={{ transform: 'translateX(-50px)' }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-medium text-lg">Colors</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white text-2xl leading-none px-2"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center space-y-3">
          {/* Rueda de color */}
          <canvas
            ref={canvasRef}
            width={280}
            height={280}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair"
            style={{ touchAction: 'none' }}
          />

          {/* Preview del color actual */}
          <div className="flex items-center gap-3 w-full bg-gray-700 rounded p-2">
            <div 
              className="w-10 h-10 rounded-full border-2 border-white shadow-md"
              style={{ backgroundColor: color }}
            />
            <div className="text-white font-mono text-sm uppercase">{color}</div>
          </div>
        </div>
      </div>
    </>
  );
}