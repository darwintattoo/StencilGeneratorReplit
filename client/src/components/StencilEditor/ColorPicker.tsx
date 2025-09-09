import React, { useRef, useEffect, useState, useCallback } from 'react';
import { Slider } from '@/components/ui/slider';

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

  // Convertir HSB a hex
  const hsbToHex = useCallback((h: number, s: number, b: number) => {
    h = h / 360;
    s = s / 100;
    b = b / 100;

    const i = Math.floor(h * 6);
    const f = h * 6 - i;
    const p = b * (1 - s);
    const q = b * (1 - f * s);
    const t = b * (1 - (1 - f) * s);

    let r, g, bl;
    switch (i % 6) {
      case 0: r = b; g = t; bl = p; break;
      case 1: r = q; g = b; bl = p; break;
      case 2: r = p; g = b; bl = t; break;
      case 3: r = p; g = q; bl = b; break;
      case 4: r = t; g = p; bl = b; break;
      case 5: r = b; g = p; bl = q; break;
      default: r = g = bl = 0;
    }

    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(bl)}`;
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
    const outerRadius = Math.min(centerX, centerY) - 10;
    const innerRadius = outerRadius * 0.7;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar rueda de hue
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 1) * Math.PI / 180;
      const endAngle = angle * Math.PI / 180;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius, endAngle, startAngle, true);
      ctx.closePath();
      
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }

    // Dibujar área de saturación/brillo
    const gradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    gradient.addColorStop(0, `hsl(${hue}, 0%, ${brightness}%)`);
    gradient.addColorStop(1, `hsl(${hue}, 100%, ${brightness / 2}%)`);
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Indicador de hue seleccionado
    const hueAngle = (hue - 90) * Math.PI / 180;
    const hueX = centerX + Math.cos(hueAngle) * (outerRadius - (outerRadius - innerRadius) / 2);
    const hueY = centerY + Math.sin(hueAngle) * (outerRadius - (outerRadius - innerRadius) / 2);
    
    ctx.beginPath();
    ctx.arc(hueX, hueY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();

    // Indicador de saturación/brillo
    const satRadius = (saturation / 100) * innerRadius;
    const satAngle = 0; // En el centro para simplicidad
    const satX = centerX + Math.cos(satAngle) * satRadius * 0.7;
    const satY = centerY + Math.sin(satAngle) * satRadius * 0.7;
    
    ctx.beginPath();
    ctx.arc(satX, satY, 6, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = '#333';
    ctx.lineWidth = 2;
    ctx.stroke();
  }, [hue, saturation, brightness]);

  // Manejar clics en la rueda
  const handleCanvasClick = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const distance = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2);
    const outerRadius = Math.min(centerX, centerY) - 10;
    const innerRadius = outerRadius * 0.7;

    if (distance > innerRadius && distance < outerRadius) {
      // Clic en el anillo de hue
      const angle = Math.atan2(y - centerY, x - centerX);
      const degrees = ((angle * 180 / Math.PI) + 90 + 360) % 360;
      setHue(degrees);
    } else if (distance <= innerRadius) {
      // Clic en el área de saturación
      const newSaturation = Math.min(100, (distance / innerRadius) * 100);
      setSaturation(newSaturation);
    }
  }, []);

  // Actualizar color cuando cambian los valores
  useEffect(() => {
    const newColor = hsbToHex(hue, saturation, brightness);
    if (newColor !== color) {
      onChange(newColor);
    }
  }, [hue, saturation, brightness, onChange, color, hsbToHex]);

  if (!isOpen) return null;

  return (
    <div 
      className="absolute top-full right-0 mt-2 bg-gray-800 rounded-lg p-4 min-w-[280px] shadow-xl border border-gray-600 z-50"
      onClick={(e) => e.stopPropagation()}
    >
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-white font-medium">Colors</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col items-center space-y-4">
          {/* Rueda de color */}
          <canvas
            ref={canvasRef}
            width={200}
            height={200}
            onClick={handleCanvasClick}
            className="cursor-pointer"
          />

          {/* Slider de brillo */}
          <div className="w-full">
            <div className="text-xs text-gray-300 mb-2">Brightness</div>
            <Slider
              value={[brightness]}
              onValueChange={([value]) => setBrightness(value)}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
          </div>

          {/* Preview del color actual */}
          <div className="flex items-center gap-3 w-full">
            <div 
              className="w-12 h-12 rounded border-2 border-white"
              style={{ backgroundColor: color }}
            />
            <div className="text-white font-mono text-sm">{color.toUpperCase()}</div>
          </div>
        </div>
      </div>
    </div>
  );
}