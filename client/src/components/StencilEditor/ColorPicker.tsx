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
  const [dragType, setDragType] = useState<'wheel' | 'center' | null>(null);

  // Convertir hex a HSB
  const hexToHsb = useCallback((hex: string) => {
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

    return { h: h * 360, s: s * 100, b: v * 100 };
  }, []);

  // Convertir HSB a RGB
  const hsbToRgb = useCallback((h: number, s: number, b: number) => {
    h = h / 360;
    s = s / 100;
    b = b / 100;

    const c = b * s;
    const x = c * (1 - Math.abs((h * 6) % 2 - 1));
    const m = b - c;

    let r, g, bl;
    
    if (h >= 0 && h < 1/6) {
      r = c; g = x; bl = 0;
    } else if (h >= 1/6 && h < 2/6) {
      r = x; g = c; bl = 0;
    } else if (h >= 2/6 && h < 3/6) {
      r = 0; g = c; bl = x;
    } else if (h >= 3/6 && h < 4/6) {
      r = 0; g = x; bl = c;
    } else if (h >= 4/6 && h < 5/6) {
      r = x; g = 0; bl = c;
    } else {
      r = c; g = 0; bl = x;
    }

    return {
      r: Math.round((r + m) * 255),
      g: Math.round((g + m) * 255),
      b: Math.round((bl + m) * 255)
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
      const hsb = hexToHsb(color);
      setHue(hsb.h);
      setSaturation(hsb.s);
      setBrightness(hsb.b);
    }
  }, [color, isOpen, hexToHsb]);

  // Dibujar la rueda de color
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 20;
    const innerRadius = outerRadius * 0.7;

    // Limpiar canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar el anillo exterior con colores HSB
    for (let angle = 0; angle < 360; angle += 1) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      
      const rgb = hsbToRgb(angle, 100, 100);
      ctx.fillStyle = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
      ctx.fill();
    }

    // Dibujar el área central con gradiente de saturación y brillo
    // Crear imagen pixel por pixel para el área central
    const imageData = ctx.createImageData(canvas.width, canvas.height);
    const data = imageData.data;

    for (let x = 0; x < canvas.width; x++) {
      for (let y = 0; y < canvas.height; y++) {
        const dx = x - centerX;
        const dy = y - centerY;
        const distance = Math.sqrt(dx * dx + dy * dy);

        if (distance <= innerRadius) {
          // Mapear x a saturación (izquierda = 0, derecha = 100)
          const s = ((x - (centerX - innerRadius)) / (innerRadius * 2)) * 100;
          
          // Mapear y a brillo (arriba = 100, abajo = 0)
          const b = (1 - ((y - (centerY - innerRadius)) / (innerRadius * 2))) * 100;
          
          const rgb = hsbToRgb(hue, Math.max(0, Math.min(100, s)), Math.max(0, Math.min(100, b)));
          
          const index = (y * canvas.width + x) * 4;
          data[index] = rgb.r;
          data[index + 1] = rgb.g;
          data[index + 2] = rgb.b;
          data[index + 3] = 255;
        }
      }
    }

    // Aplicar la imagen al área central
    ctx.save();
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.clip();
    ctx.putImageData(imageData, 0, 0);
    ctx.restore();

    // Dibujar indicador en el anillo exterior (hue)
    const hueAngle = (hue - 90) * Math.PI / 180;
    const hueRadius = (outerRadius + innerRadius) / 2;
    const hueX = centerX + Math.cos(hueAngle) * hueRadius;
    const hueY = centerY + Math.sin(hueAngle) * hueRadius;
    
    ctx.beginPath();
    ctx.arc(hueX, hueY, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
    
    const hueRgb = hsbToRgb(hue, 100, 100);
    ctx.beginPath();
    ctx.arc(hueX, hueY, 7, 0, Math.PI * 2);
    ctx.fillStyle = `rgb(${hueRgb.r}, ${hueRgb.g}, ${hueRgb.b})`;
    ctx.fill();

    // Dibujar indicador en el área central (saturación/brillo)
    const satX = centerX - innerRadius + (saturation / 100) * innerRadius * 2;
    const brightY = centerY - innerRadius + ((100 - brightness) / 100) * innerRadius * 2;
    
    // Verificar que está dentro del círculo
    const dx = satX - centerX;
    const dy = brightY - centerY;
    const dist = Math.sqrt(dx * dx + dy * dy);
    
    if (dist <= innerRadius) {
      ctx.beginPath();
      ctx.arc(satX, brightY, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'white';
      ctx.fill();
      ctx.strokeStyle = '#333';
      ctx.lineWidth = 2;
      ctx.stroke();
      
      const currentRgb = hsbToRgb(hue, saturation, brightness);
      ctx.beginPath();
      ctx.arc(satX, brightY, 5, 0, Math.PI * 2);
      ctx.fillStyle = `rgb(${currentRgb.r}, ${currentRgb.g}, ${currentRgb.b})`;
      ctx.fill();
    }
  }, [hue, saturation, brightness, hsbToRgb]);

  // Manejar clics y arrastre
  const handleMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const outerRadius = Math.min(centerX, centerY) - 20;
    const innerRadius = outerRadius * 0.7;

    setIsDragging(true);

    if (distance > innerRadius && distance < outerRadius) {
      // Click en el anillo exterior (hue)
      setDragType('wheel');
      const angle = Math.atan2(y - centerY, x - centerX);
      const degrees = ((angle * 180 / Math.PI) + 90 + 360) % 360;
      setHue(degrees);
    } else if (distance <= innerRadius) {
      // Click en el área central (saturación/brillo)
      setDragType('center');
      const s = ((x - (centerX - innerRadius)) / (innerRadius * 2)) * 100;
      const b = (1 - ((y - (centerY - innerRadius)) / (innerRadius * 2))) * 100;
      setSaturation(Math.max(0, Math.min(100, s)));
      setBrightness(Math.max(0, Math.min(100, b)));
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
    const outerRadius = Math.min(centerX, centerY) - 20;
    const innerRadius = outerRadius * 0.7;

    if (dragType === 'wheel') {
      const angle = Math.atan2(y - centerY, x - centerX);
      const degrees = ((angle * 180 / Math.PI) + 90 + 360) % 360;
      setHue(degrees);
    } else if (dragType === 'center') {
      const s = ((x - (centerX - innerRadius)) / (innerRadius * 2)) * 100;
      const b = (1 - ((y - (centerY - innerRadius)) / (innerRadius * 2))) * 100;
      setSaturation(Math.max(0, Math.min(100, s)));
      setBrightness(Math.max(0, Math.min(100, b)));
    }
  }, [isDragging, dragType]);

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setDragType(null);
  }, []);

  // Actualizar color cuando cambian los valores
  useEffect(() => {
    const rgb = hsbToRgb(hue, saturation, brightness);
    const newColor = rgbToHex(rgb.r, rgb.g, rgb.b);
    if (newColor !== color) {
      onChange(newColor);
    }
  }, [hue, saturation, brightness, onChange, color, hsbToRgb, rgbToHex]);

  if (!isOpen) return null;

  return (
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
          width={260}
          height={260}
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
  );
}