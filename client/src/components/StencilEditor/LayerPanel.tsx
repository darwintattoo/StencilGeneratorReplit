import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { GripVertical, Eye, EyeOff, Link, Unlink } from 'lucide-react';
import type { LayersState } from './types';

const DRAWING_COLORS = ['#000000', '#ef4444', '#3b82f6'];

interface LayerPanelProps {
  isOpen: boolean;
  layers: LayersState;
  toggleLayer: (key: string, visible: boolean) => void;
  setOpacity: (key: string, opacity: number) => void;
  brushColor: string;
  setBrushColor: (color: string) => void;
  stencilHue: number;
  setStencilHue: (hue: number) => void;
  stencilSaturation: number;
  setStencilSaturation: (saturation: number) => void;
  drawingHue: number;
  setDrawingHue: (hue: number) => void;
  drawingSaturation: number;
  setDrawingSaturation: (saturation: number) => void;
  drawingBrightness: number;
  setDrawingBrightness: (brightness: number) => void;
  stencilBrightness: number;
  setStencilBrightness: (brightness: number) => void;
  isColorLinked: boolean;
  setIsColorLinked: (linked: boolean) => void;
  onClose: () => void;
}

export default function LayerPanel({
  isOpen,
  layers,
  toggleLayer,
  setOpacity,
  brushColor,
  setBrushColor,
  stencilHue,
  setStencilHue,
  stencilSaturation,
  setStencilSaturation,
  drawingHue,
  setDrawingHue,
  drawingSaturation,
  setDrawingSaturation,
  drawingBrightness,
  setDrawingBrightness,
  stencilBrightness,
  setStencilBrightness,
  isColorLinked,
  setIsColorLinked,
  onClose
}: LayerPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 h-full w-full max-w-sm sm:w-80 border-l border-gray-600 p-2 sm:p-4 overflow-y-auto z-50" style={{ backgroundColor: '#1a1a1a' }}>
      <div className="flex items-center justify-between mb-4 sticky top-0 pb-2 z-50" style={{ backgroundColor: '#1a1a1a' }}>
        <h3 className="text-white font-medium">Capas</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white bg-gray-800 hover:bg-gray-700 min-w-[32px] h-8"
        >
          ×
        </Button>
      </div>


      <div className="space-y-4">
        <div className="rounded-lg p-3" style={{ backgroundColor: '#2d2d2d' }}>
          <div className="flex items-center gap-3 mb-2">
            <GripVertical className="w-4 h-4 text-gray-300" />
            <Switch
              checked={layers.drawing.visible}
              onCheckedChange={(checked) => toggleLayer('drawing', checked)}
            />
            <span className="text-white text-sm font-medium flex-1">Drawing</span>
            <span className="text-gray-300 text-xs">N</span>
            {layers.drawing.visible ? (
              <Eye className="w-4 h-4 text-gray-300" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-300" />
            )}
          </div>
          <div className="ml-7 space-y-3">
            <div>
              <div className="text-xs text-gray-300 mb-2 flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsColorLinked(!isColorLinked)}
                  className={`w-3 h-3 p-0 ${
                    isColorLinked 
                      ? 'text-blue-400 hover:text-blue-300' 
                      : 'text-gray-500 hover:text-gray-400'
                  }`}
                >
                  {isColorLinked ? <Link className="w-2 h-2" /> : <Unlink className="w-2 h-2" />}
                </Button>
                <span>Hue:</span>
                <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(drawingHue)}</span>
              </div>
              <div className="relative mb-4">
                <div className="h-3 rounded-full" style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                }}></div>
                <Slider
                  value={[drawingHue]}
                  onValueChange={([value]) => {
                    setDrawingHue(value);
                    if (isColorLinked) {
                      setStencilHue(value);
                    }
                  }}
                  max={360}
                  min={0}
                  step={1}
                  className="absolute inset-0 opacity-75"
                />
              </div>
              <div className="text-xs text-gray-300 mb-2 flex items-center gap-2">
                <span>Saturation:</span>
                <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(drawingSaturation)}</span>
              </div>
              <div className="relative mb-4">
                <div className="h-3 rounded-full" style={{
                  background: 'linear-gradient(to right, #808080, #ff0000)'
                }}></div>
                <Slider
                  value={[drawingSaturation]}
                  onValueChange={([value]) => {
                    setDrawingSaturation(value);
                    if (isColorLinked) {
                      setStencilSaturation(value);
                    }
                  }}
                  max={200}
                  min={0}
                  step={1}
                  className="absolute inset-0 opacity-75"
                />
              </div>
              <div className="text-xs text-gray-300 mb-2 flex items-center gap-2">
                <span>Brightness:</span>
                <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(drawingBrightness)}</span>
              </div>
              <div className="relative">
                <div className="h-3 rounded-full" style={{
                  background: 'linear-gradient(to right, #000000, #ffffff)'
                }}></div>
                <Slider
                  value={[drawingBrightness]}
                  onValueChange={([value]) => {
                    setDrawingBrightness(value);
                    if (isColorLinked) {
                      setStencilBrightness(value);
                    }
                  }}
                  max={200}
                  min={0}
                  step={1}
                  className="absolute inset-0 opacity-75"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ backgroundColor: '#2d2d2d' }}>
          <div className="flex items-center gap-3 mb-2">
            <GripVertical className="w-4 h-4 text-gray-300" />
            <Switch
              checked={layers.stencil.visible}
              onCheckedChange={(checked) => toggleLayer('stencil', checked)}
            />
            <span className="text-white text-sm font-medium flex-1">Stencil</span>
            <span className="text-gray-300 text-xs">N</span>
            {layers.stencil.visible ? (
              <Eye className="w-4 h-4 text-gray-300" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-300" />
            )}
          </div>
          <div className="ml-7 mt-2 space-y-3">
            <div>
              <div className="text-xs text-gray-300 mb-2 flex items-center gap-2">
                <span>Hue:</span>
                <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(stencilHue)}</span>
              </div>
              <div className="relative mb-4">
                <div className="h-3 rounded-full" style={{
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
                }}></div>
                <Slider
                  value={[stencilHue]}
                  onValueChange={([value]) => {
                    setStencilHue(value);
                    if (isColorLinked) {
                      setDrawingHue(value);
                    }
                  }}
                  max={360}
                  min={0}
                  step={1}
                  className="absolute inset-0 opacity-75"
                />
              </div>
              <div className="text-xs text-gray-300 mb-2 flex items-center gap-2">
                <span>Saturation:</span>
                <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(stencilSaturation)}</span>
              </div>
              <div className="relative mb-4">
                <div className="h-3 rounded-full" style={{
                  background: 'linear-gradient(to right, #808080, #ff0000)'
                }}></div>
                <Slider
                  value={[stencilSaturation]}
                  onValueChange={([value]) => {
                    setStencilSaturation(value);
                    if (isColorLinked) {
                      setDrawingSaturation(value);
                    }
                  }}
                  max={200}
                  min={0}
                  step={1}
                  className="absolute inset-0 opacity-75"
                />
              </div>
              <div className="text-xs text-gray-300 mb-2 flex items-center gap-2">
                <span>Brightness:</span>
                <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(stencilBrightness)}</span>
              </div>
              <div className="relative">
                <div className="h-3 rounded-full" style={{
                  background: 'linear-gradient(to right, #000000, #ffffff)'
                }}></div>
                <Slider
                  value={[stencilBrightness]}
                  onValueChange={([value]) => {
                    setStencilBrightness(value);
                    if (isColorLinked) {
                      setDrawingBrightness(value);
                    }
                  }}
                  max={200}
                  min={0}
                  step={1}
                  className="absolute inset-0 opacity-75"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ backgroundColor: '#2d2d2d' }}>
          <div className="flex items-center gap-3 mb-2">
            <GripVertical className="w-4 h-4 text-gray-400" />
            <Switch
              checked={layers.original.visible}
              onCheckedChange={(checked) => toggleLayer('original', checked)}
            />
            <span className="text-white text-sm font-medium flex-1">Original</span>
            <span className="text-gray-400 text-xs">N</span>
            {layers.original.visible ? (
              <Eye className="w-4 h-4 text-gray-400" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-400" />
            )}
          </div>
          <div className="ml-7 mt-2">
            <Slider
              value={[layers.original.opacity]}
              onValueChange={([value]) => setOpacity('original', value)}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ backgroundColor: '#2d2d2d' }}>
          <div className="flex items-center gap-3 mb-2">
            <GripVertical className="w-4 h-4 text-gray-300" />
            <Switch
              checked={layers.background.visible}
              onCheckedChange={(checked) => toggleLayer('background', checked)}
            />
            <span className="text-white text-sm font-medium flex-1">Color de fondo</span>
            <span className="text-gray-300 text-xs">N</span>
            {layers.background.visible ? (
              <Eye className="w-4 h-4 text-gray-300" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-300" />
            )}
          </div>
          <div className="ml-7 mt-2">
            <Slider
              value={[layers.background.opacity]}
              onValueChange={([value]) => setOpacity('background', value)}
              max={100}
              min={0}
              step={1}
              className="w-full"
            />
          </div>
        </div>
      </div>
    </div>
  );
}