import React from 'react';
import { Button } from '@/components/ui/button';
import { Slider } from '@/components/ui/slider';
import { PenTool, Eraser, Layers, ArrowLeft, Move } from 'lucide-react';
import type { LayersState, Tool, ActiveLayer, ViewTransform } from './types';

const COLORS = ['#000000', '#ef4444', '#3b82f6'];

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
    <div className="absolute top-4 left-4 right-4 flex items-center justify-between z-40">
      <Button
        variant="outline"
        size="sm"
        onClick={onBack}
        className="bg-white/95 hover:bg-white shadow-sm text-gray-700 hover:text-gray-900 border-gray-200"
      >
        <ArrowLeft className="w-4 h-4 mr-2 text-gray-600" />
        Galería
      </Button>

      <div className="flex gap-2">
        <Button
          variant={tool === 'brush' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('brush')}
          className={tool === 'brush' 
            ? "bg-blue-500 hover:bg-blue-600 text-white shadow-sm border-blue-500" 
            : "bg-white/95 hover:bg-gray-100 shadow-sm text-gray-700 border-gray-200"
          }
        >
          <PenTool className={`w-4 h-4 ${tool === 'brush' ? 'text-white' : 'text-gray-600'}`} />
        </Button>

        <Button
          variant={tool === 'eraser' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('eraser')}
          className={tool === 'eraser' 
            ? "bg-red-500 hover:bg-red-600 text-white shadow-sm border-red-500" 
            : "bg-white/95 hover:bg-gray-100 shadow-sm text-gray-700 border-gray-200"
          }
        >
          <Eraser className={`w-4 h-4 ${tool === 'eraser' ? 'text-white' : 'text-gray-600'}`} />
        </Button>

        {tool === 'eraser' && (
          <div className="flex gap-1 bg-white/95 rounded-md p-1 shadow-sm border border-gray-200">
            <Button
              variant={activeLayer === 'drawing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setActiveLayer('drawing')}
              className={`text-xs px-2 py-1 h-auto ${
                activeLayer === 'drawing' 
                  ? 'bg-gray-700 hover:bg-gray-800 text-white border-gray-700' 
                  : 'bg-transparent hover:bg-gray-100 text-gray-600 border-gray-300'
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
                  ? 'bg-gray-700 hover:bg-gray-800 text-white border-gray-700' 
                  : 'bg-transparent hover:bg-gray-100 text-gray-600 border-gray-300'
              }`}
            >
              Stencil
            </Button>
          </div>
        )}

        {tool === 'brush' && (
          <div className="flex gap-2 bg-white/95 rounded-md p-2 shadow-sm border border-gray-200">
            {COLORS.map((color, index) => (
              <button
                key={color}
                onClick={() => setBrushColor(color)}
                className={`w-7 h-7 rounded-full border-2 transition-all ${
                  brushColor === color 
                    ? 'border-gray-800 ring-2 ring-blue-400 scale-110' 
                    : 'border-gray-400 hover:border-gray-600'
                }`}
                style={{ backgroundColor: color }}
                title={['Negro', 'Rojo', 'Azul'][index]}
              />
            ))}
          </div>
        )}

        <Button
          variant={tool === 'move' ? 'default' : 'outline'}
          size="sm"
          onClick={() => setTool('move')}
          className={tool === 'move' 
            ? "bg-green-500 hover:bg-green-600 text-white shadow-sm border-green-500" 
            : "bg-white/95 hover:bg-gray-100 shadow-sm text-gray-700 border-gray-200"
          }
        >
          <Move className={`w-4 h-4 ${tool === 'move' ? 'text-white' : 'text-gray-600'}`} />
        </Button>

        <Button
          variant={isLayersOpen ? 'default' : 'outline'}
          size="sm"
          onClick={() => setIsLayersOpen(!isLayersOpen)}
          className={isLayersOpen
            ? "bg-purple-500 hover:bg-purple-600 text-white shadow-sm border-purple-500"
            : "bg-white/95 hover:bg-gray-100 shadow-sm text-gray-700 border-gray-200"
          }
        >
          <Layers className={`w-4 h-4 ${isLayersOpen ? 'text-white' : 'text-gray-600'}`} />
        </Button>
      </div>

      <div className="flex items-center gap-2 bg-white/95 rounded-md px-3 py-2 shadow-sm border border-gray-200">
        <span className="text-xs text-gray-700 font-medium">Original</span>
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
        <span className="text-xs text-gray-700 min-w-[30px]">{layers.original.opacity}%</span>
      </div>

      <div className="text-sm text-gray-700 bg-white/95 px-2 py-1 rounded-md shadow-sm border border-gray-200">
        {Math.round(viewTransform.scale * 100)}%
      </div>
    </div>
  );
}