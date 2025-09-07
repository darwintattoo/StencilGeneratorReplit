import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { Pencil, Eraser, Layers, ArrowLeft, Move, Pipette } from 'lucide-react';
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
    <div className="fixed top-2 sm:top-4 left-2 sm:left-4 right-2 sm:right-4 flex items-center justify-between z-50">
      {/* IZQUIERDA: Gallery + Herramientas principales */}
      <div className="flex items-center gap-1 sm:gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onBack}
          style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }} 
          className="hover:text-white shadow-sm text-gray-300 border-gray-600 h-8 sm:h-9 px-2 sm:px-3 text-xs sm:text-sm" 
          onMouseEnter={(e) => e.currentTarget.style.backgroundColor = 'rgba(35, 35, 35, 0.95)'} 
          onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'rgba(45, 45, 45, 0.95)'}
        >
          <ArrowLeft className="w-4 h-4 mr-2 text-gray-400" />
          Gallery
        </Button>

        <Button
          variant={tool === 'brush' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('brush')}
          className={`h-8 sm:h-9 px-2 sm:px-3 ${tool === 'brush' 
            ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm border-blue-500" 
            : "shadow-sm text-gray-300 border-gray-600"
          }`}
        >
          <Pencil className={`w-4 h-4 ${tool === 'brush' ? 'text-white' : 'text-gray-400'}`} />
        </Button>

        <Button
          variant={tool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('eraser')}
          className={`h-8 sm:h-9 px-2 sm:px-3 ${tool === 'eraser' 
            ? "bg-red-500 hover:bg-red-600 text-white shadow-sm border-red-500" 
            : "shadow-sm text-gray-300 border-gray-600"
          }`}
        >
          <Eraser className={`w-4 h-4 ${tool === 'eraser' ? 'text-white' : 'text-gray-400'}`} />
        </Button>

        <Button
          variant={tool === 'move' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('move')}
          className={`h-8 sm:h-9 px-2 sm:px-3 ${tool === 'move' 
            ? "bg-green-500 hover:bg-green-600 text-white shadow-sm border-green-500" 
            : "shadow-sm text-gray-300 border-gray-600"
          }`}
        >
          <Move className={`w-4 h-4 ${tool === 'move' ? 'text-white' : 'text-gray-400'}`} />
        </Button>

        <Button
          variant={tool === 'eyedropper' ? 'default' : 'outline'}
          size="sm"
          onClick={() => {
            console.log('[DEBUG] Eyedropper button clicked, setting tool to eyedropper');
            setTool('eyedropper');
          }}
          className={`h-8 sm:h-9 px-2 sm:px-3 ${tool === 'eyedropper' 
            ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm border-orange-500" 
            : "shadow-sm text-gray-300 border-gray-600"
          }`}
        >
          <Pipette className={`w-4 h-4 ${tool === 'eyedropper' ? 'text-white' : 'text-gray-400'}`} />
        </Button>
      </div>

      {/* CENTRO: Menú simple */}
      <div className="flex items-center">
        <div className="text-gray-400 text-lg font-bold px-2">•••</div>
      </div>

      {/* DERECHA: Layers + Controles + Colores */}
      <div className="flex items-center gap-1 sm:gap-2">
        {(tool === 'brush' || tool === 'eyedropper') && (
          <div className="flex items-center gap-1 sm:gap-2 rounded-md px-2 sm:px-3 py-1 sm:py-2 shadow-sm border border-gray-600 h-8 sm:h-10" style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }}>
            {COLORS.map((color, index) => (
              <button
                key={color}
                onClick={() => setBrushColor(color)}
                className={`w-5 h-5 sm:w-7 sm:h-7 rounded-full border-2 transition-all ${
                  brushColor === color 
                    ? 'border-gray-800 ring-2 ring-blue-400 scale-105' 
                    : 'border-gray-400 hover:border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={['Negro', 'Rojo', 'Azul', 'Verde'][index]}
              />
            ))}
            
          </div>
        )}

        {tool === 'eraser' && (
          <div className="flex gap-1 rounded-md p-1 shadow-sm border border-gray-600" style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }}>
            <Button
              variant={activeLayer === 'drawing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveLayer('drawing')}
              className={`text-xs px-2 py-1 h-auto ${
                activeLayer === 'drawing' 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white border-gray-600' 
                  : 'bg-transparent hover:bg-gray-700 text-gray-300 border-gray-500'
              }`}
            >
              Dibujo
            </Button>
            <Button
              variant={activeLayer === 'stencil' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveLayer('stencil')}
              className={`text-xs px-2 py-1 h-auto ${
                activeLayer === 'stencil' 
                  ? 'bg-gray-600 hover:bg-gray-500 text-white border-gray-600' 
                  : 'bg-transparent hover:bg-gray-700 text-gray-300 border-gray-500'
              }`}
            >
              Stencil
            </Button>
          </div>
        )}

        <Button
          variant={isLayersOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsLayersOpen(!isLayersOpen)}
          className={`h-8 sm:h-10 px-2 sm:px-3 ${isLayersOpen
            ? "bg-purple-500 hover:bg-purple-600 text-white shadow-sm border-purple-500"
            : "shadow-sm text-gray-300 border-gray-600"
          }`}
        >
          <Layers className={`w-4 h-4 ${isLayersOpen ? 'text-white' : 'text-gray-400'}`} />
        </Button>

        <div className="hidden sm:flex items-center gap-3 rounded-md px-3 py-2 shadow-sm border border-gray-600 h-10" style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }}>
          <span className="text-sm text-gray-300 font-medium">Original</span>
          <div className="w-20">
            <Slider
              value={[layers.original.opacity]}
              onValueChange={([value]) => setOpacity('original', value)}
              max={100}
              min={0}
              step={1}
              className="w-20"
            />
          </div>
          <span className="text-sm text-gray-300 font-mono">{layers.original.opacity}%</span>
        </div>

        <div className="hidden sm:flex text-sm text-gray-300 px-3 py-2 rounded-md shadow-sm border border-gray-600 h-10 items-center font-mono justify-center" style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }}>
          {Math.round(viewTransform.scale * 100)}%
        </div>
      </div>
    </div>
  );
}