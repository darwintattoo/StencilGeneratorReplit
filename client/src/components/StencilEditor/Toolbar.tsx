import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PenTool, ArrowLeft, Move, Pipette } from 'lucide-react';

// Iconos personalizados
const CustomEraser = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="4" y="8" width="16" height="8" rx="2" ry="2" fill="currentColor" />
    <rect x="7" y="5" width="10" height="3" rx="1" ry="1" fill="currentColor" opacity="0.7" />
  </svg>
);

const CustomLayers = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="12" height="12" rx="2" ry="2" fill="currentColor" opacity="0.6" />
    <rect x="8" y="8" width="12" height="12" rx="2" ry="2" fill="currentColor" />
  </svg>
);

// Icono de rectángulo (para stencil)
const RectangleIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none">
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" stroke="currentColor" strokeWidth="2" fill="none" />
  </svg>
);

// Icono de círculo para color
const CircleIcon = ({ color, isSelected }: { color: string; isSelected: boolean }) => (
  <div 
    className={`w-8 h-8 rounded-full border-2 transition-all ${
      isSelected ? 'border-white scale-110' : 'border-gray-500'
    }`}
    style={{ backgroundColor: color }}
  />
);

import type { LayersState, Tool, ActiveLayer, ViewTransform } from './types';

const COLORS = [
  '#000000', // Negro
  '#ef4444', // Rojo
  '#3b82f6', // Azul
  '#22c55e', // Verde
];

interface ToolbarProps {
  tool: Tool;
  setTool: (tool: Tool) => void;
  activeLayer: ActiveLayer;
  setActiveLayer: (layer: ActiveLayer) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  layers: LayersState;
  setOpacity: (key: string, opacity: number) => void;
  viewTransform: Pick<ViewTransform, 'scale'>;
  isLayersOpen: boolean;
  setIsLayersOpen: (open: boolean) => void;
  onBack: () => void;
}

export default function Toolbar({
  tool,
  setTool,
  activeLayer,
  setActiveLayer,
  brushColor,
  setBrushColor,
  layers,
  setOpacity,
  viewTransform,
  isLayersOpen,
  setIsLayersOpen,
  onBack
}: ToolbarProps) {
  return (
    <div className="absolute top-4 left-4 right-4 z-40">
      <div className="flex items-center justify-between w-full bg-gray-800 bg-opacity-90 rounded-lg px-4 py-2 backdrop-blur-sm">
        
        {/* IZQUIERDA: Galería + Herramientas básicas */}
        <div className="flex items-center gap-3">
          {/* Galería */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="text-gray-300 hover:text-white hover:bg-gray-700 h-8 px-3"
          >
            Galería
          </Button>

          {/* Pincel */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool('brush')}
            className={`h-8 w-8 p-0 ${
              tool === 'brush' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <PenTool className="w-5 h-5" />
          </Button>

          {/* Borrador */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool('eraser')}
            className={`h-8 w-8 p-0 ${
              tool === 'eraser' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CustomEraser className="w-5 h-5" />
          </Button>

          {/* Gotero */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool('eyedropper')}
            className={`h-8 w-8 p-0 ${
              tool === 'eyedropper' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Pipette className="w-5 h-5" />
          </Button>

          {/* Mover */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool('move')}
            className={`h-8 w-8 p-0 ${
              tool === 'move' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <Move className="w-5 h-5" />
          </Button>
        </div>

        {/* CENTRO: Menú de tres puntos */}
        <div className="text-gray-400 text-xl font-bold">
          •••
        </div>

        {/* DERECHA: Herramientas avanzadas + Color */}
        <div className="flex items-center gap-3">
          {/* Pincel azul (activo) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool('brush')}
            className={`h-8 w-8 p-0 ${
              tool === 'brush' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <PenTool className="w-5 h-5" />
          </Button>

          {/* Borrador */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setTool('eraser')}
            className={`h-8 w-8 p-0 ${
              tool === 'eraser' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CustomEraser className="w-5 h-5" />
          </Button>

          {/* Rectángulo (stencil) */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setActiveLayer('stencil')}
            className={`h-8 w-8 p-0 ${
              activeLayer === 'stencil' ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <RectangleIcon className="w-5 h-5" />
          </Button>

          {/* Capas */}
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsLayersOpen(!isLayersOpen)}
            className={`h-8 w-8 p-0 ${
              isLayersOpen ? 'text-blue-400' : 'text-gray-400 hover:text-white'
            }`}
          >
            <CustomLayers className="w-5 h-5" />
          </Button>

          {/* Color actual (círculo grande) */}
          <button
            onClick={() => {
              // Ciclar entre los colores disponibles
              const currentIndex = COLORS.indexOf(brushColor);
              const nextIndex = (currentIndex + 1) % COLORS.length;
              setBrushColor(COLORS[nextIndex]);
            }}
            className="w-10 h-10 rounded-full border-2 border-white transition-all hover:scale-105"
            style={{ backgroundColor: brushColor }}
          />
        </div>
      </div>
    </div>
  );
}