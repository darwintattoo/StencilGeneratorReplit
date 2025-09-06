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
        
        {/* Gallery + Herramientas principales */}
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onBack}
            style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }} 
            className="hover:text-white shadow-sm text-gray-300 border-gray-600" 
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
            className={tool === 'brush' 
              ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm border-blue-500" 
              : "shadow-sm text-gray-300 border-gray-600"
            }
          >
            <PenTool className={`w-4 h-4 ${tool === 'brush' ? 'text-white' : 'text-gray-400'}`} />
          </Button>

          <Button
            variant={tool === 'eraser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('eraser')}
            className={tool === 'eraser' 
              ? "bg-red-500 hover:bg-red-600 text-white shadow-sm border-red-500" 
              : "shadow-sm text-gray-300 border-gray-600"
            }
          >
            <CustomEraser className={`w-4 h-4 ${tool === 'eraser' ? 'text-white' : 'text-gray-400'}`} />
          </Button>

          <Button
            variant={tool === 'move' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('move')}
            className={tool === 'move' 
              ? "bg-green-500 hover:bg-green-600 text-white shadow-sm border-green-500" 
              : "shadow-sm text-gray-300 border-gray-600"
            }
          >
            <Move className={`w-4 h-4 ${tool === 'move' ? 'text-white' : 'text-gray-400'}`} />
          </Button>
        </div>

        {/* Colores + Gotero */}
        <div className="flex items-center gap-2">
          {(tool === 'brush' || tool === 'eyedropper') && (
            <div className="flex items-center gap-2 rounded-md px-3 py-2 shadow-sm border border-gray-600 h-10" style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }}>
              {COLORS.map((color, index) => (
                <button
                  key={color}
                  onClick={() => setBrushColor(color)}
                  className={`w-7 h-7 rounded-full border-2 transition-all ${
                    brushColor === color 
                      ? 'border-gray-800 ring-2 ring-blue-400 scale-105' 
                      : 'border-gray-400 hover:border-gray-600'
                  }`}
                  style={{ backgroundColor: color }}
                  title={['Negro', 'Rojo', 'Azul', 'Verde'][index]}
                />
              ))}
              
              <div className="w-px h-6 bg-gray-600 mx-1"></div>
              
              <Button
                variant={tool === 'eyedropper' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setTool('eyedropper')}
                className={`h-7 px-2 ${tool === 'eyedropper' 
                  ? "bg-orange-500 hover:bg-orange-600 text-white shadow-sm border-orange-500" 
                  : "shadow-sm text-gray-300 border-gray-600"
                }`}
              >
                <Pipette className={`w-3 h-3 ${tool === 'eyedropper' ? 'text-white' : 'text-gray-400'}`} />
              </Button>
            </div>
          )}
        </div>

        {/* Layer Controls + Layers + Opacity */}
        <div className="flex items-center gap-2">
          <div className="flex gap-2">
            <Button
              size="sm"
              variant={activeLayer === 'drawing' ? 'default' : 'outline'}
              onClick={() => setActiveLayer('drawing')}
              className={`px-3 py-2 ${
                activeLayer === 'drawing' 
                  ? 'bg-blue-500 hover:bg-blue-600 text-white border-blue-500' 
                  : 'shadow-sm text-gray-300 border-gray-600'
              }`}
            >
              Draw
            </Button>
            
            <Button
              size="sm"
              variant={activeLayer === 'stencil' ? 'default' : 'outline'}
              onClick={() => setActiveLayer('stencil')}
              className={`px-3 py-2 ${
                activeLayer === 'stencil' 
                  ? 'bg-purple-500 hover:bg-purple-600 text-white border-purple-500' 
                  : 'shadow-sm text-gray-300 border-gray-600'
              }`}
            >
              Edit
            </Button>
          </div>

          <Button
            variant={isLayersOpen ? 'default' : 'outline'}
            size="sm"
            onClick={() => setIsLayersOpen(!isLayersOpen)}
            className={`h-10 px-3 ${isLayersOpen
              ? 'bg-gray-100 hover:bg-gray-200 text-gray-900 border-gray-300'
              : 'shadow-sm text-gray-300 border-gray-600'
            }`}
          >
            <CustomLayers className={`w-4 h-4 ${isLayersOpen ? 'text-gray-900' : 'text-gray-400'}`} />
          </Button>

          <div className="flex items-center gap-2 rounded-md px-3 py-2 shadow-sm border border-gray-600 h-10" style={{ backgroundColor: 'rgba(45, 45, 45, 0.95)' }}>
            <Slider
              value={[layers.original.opacity]}
              onValueChange={([value]) => setOpacity('original', value)}
              max={100}
              min={0}
              step={1}
              className="w-16 h-4"
            />
            <span className="text-sm text-gray-300 font-mono">{layers.original.opacity}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}