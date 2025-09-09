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

  // Dibujar la rueda de color estilo Procreate
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const outerRadius = Math.min(centerX, centerY) - 15;
    const innerRadius = outerRadius * 0.65;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Dibujar rueda de hue exterior
    for (let angle = 0; angle < 360; angle++) {
      const startAngle = (angle - 0.5) * Math.PI / 180;
      const endAngle = (angle + 0.5) * Math.PI / 180;
      
      ctx.beginPath();
      ctx.arc(centerX, centerY, outerRadius, startAngle, endAngle);
      ctx.arc(centerX, centerY, innerRadius + 5, endAngle, startAngle, true);
      ctx.closePath();
      
      ctx.fillStyle = `hsl(${angle}, 100%, 50%)`;
      ctx.fill();
    }

    // Área central - gradiente de saturación y brillo
    // Primero el gradiente de saturación (blanco a color puro)
    const satGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, innerRadius);
    satGradient.addColorStop(0, `hsl(${hue}, 0%, 100%)`); // Blanco en el centro
    satGradient.addColorStop(1, `hsl(${hue}, 100%, 50%)`); // Color puro en el borde
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = satGradient;
    ctx.fill();

    // Gradiente vertical de brillo (sombra negra desde abajo)
    const brightGradient = ctx.createLinearGradient(centerX, centerY - innerRadius, centerX, centerY + innerRadius);
    brightGradient.addColorStop(0, `rgba(0, 0, 0, ${(100 - brightness) / 100 * 0.1})`); // Arriba más claro
    brightGradient.addColorStop(0.6, `rgba(0, 0, 0, ${(100 - brightness) / 100 * 0.3})`); // Medio
    brightGradient.addColorStop(1, `rgba(0, 0, 0, ${(100 - brightness) / 100 * 0.8})`); // Abajo más oscuro
    
    ctx.beginPath();
    ctx.arc(centerX, centerY, innerRadius, 0, Math.PI * 2);
    ctx.fillStyle = brightGradient;
    ctx.fill();

    // Indicador de hue en el anillo exterior
    const hueAngle = (hue - 90) * Math.PI / 180;
    const hueRadius = (outerRadius + innerRadius + 5) / 2;
    const hueX = centerX + Math.cos(hueAngle) * hueRadius;
    const hueY = centerY + Math.sin(hueAngle) * hueRadius;
    
    // Círculo exterior blanco
    ctx.beginPath();
    ctx.arc(hueX, hueY, 10, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Círculo interior del color
    ctx.beginPath();
    ctx.arc(hueX, hueY, 7, 0, Math.PI * 2);
    ctx.fillStyle = `hsl(${hue}, 100%, 50%)`;
    ctx.fill();

    // Indicador de saturación/brillo en el área central
    const satRadius = (saturation / 100) * innerRadius * 0.9;
    const brightFactor = 1 - (brightness / 100) * 0.3; // Menos movimento vertical
    const satX = centerX + Math.cos(0) * satRadius;
    const satY = centerY + Math.sin(0) * satRadius + (innerRadius * (1 - brightness / 100) * 0.5);
    
    // Círculo exterior blanco
    ctx.beginPath();
    ctx.arc(satX, satY, 8, 0, Math.PI * 2);
    ctx.fillStyle = 'white';
    ctx.fill();
    
    // Círculo interior con el color seleccionado
    ctx.beginPath();
    ctx.arc(satX, satY, 5, 0, Math.PI * 2);
    ctx.fillStyle = hsbToHex(hue, saturation, brightness);
    ctx.fill();
  }, [hue, saturation, brightness, hsbToHex]);

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
    const outerRadius = Math.min(centerX, centerY) - 15;
    const innerRadius = outerRadius * 0.65;

    if (distance > innerRadius + 5 && distance < outerRadius) {
      // Clic en el anillo de hue
      const angle = Math.atan2(y - centerY, x - centerX);
      const degrees = ((angle * 180 / Math.PI) + 90 + 360) % 360;
      setHue(degrees);
    } else if (distance <= innerRadius) {
      // Clic en el área central de saturación/brillo
      const newSaturation = Math.min(100, (distance / innerRadius) * 100);
      setSaturation(newSaturation);
      
      // Ajustar brillo basado en la posición vertical
      const normalizedY = (y - centerY) / innerRadius;
      const newBrightness = Math.max(10, Math.min(100, 100 - (normalizedY * 50 + 50)));
      setBrightness(newBrightness);
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
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-white font-medium text-lg">Colors</h3>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white text-xl"
        >
          ×
        </button>
      </div>

      <div className="flex flex-col items-center space-y-3">
        {/* Rueda de color */}
        <div className="relative">
          <canvas
            ref={canvasRef}
            width={240}
            height={240}
            onClick={handleCanvasClick}
            className="cursor-pointer"
          />
        </div>

        {/* Preview del color actual */}
        <div className="flex items-center gap-3 w-full bg-gray-700 rounded p-2">
          <div 
            className="w-8 h-8 rounded-full border-2 border-white shadow-md"
            style={{ backgroundColor: color }}
          />
          <div className="text-white font-mono text-sm">{color.toUpperCase()}</div>
        </div>
      </div>
    </div>
  );
}