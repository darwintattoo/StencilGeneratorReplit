import React from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { GripVertical, Eye, EyeOff } from 'lucide-react';
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
  onClose
}: LayerPanelProps) {
  if (!isOpen) return null;

  return (
    <div className="absolute right-0 top-0 h-full w-80 bg-gray-800 border-l border-gray-600 p-4 overflow-y-auto z-50">
      <div className="flex items-center justify-between mb-4 sticky top-0 bg-gray-800 pb-2 z-50">
        <h3 className="text-white font-medium">Capas</h3>
        <Button
          variant="ghost"
          size="sm"
          onClick={onClose}
          className="text-gray-400 hover:text-white bg-gray-700 hover:bg-gray-600 min-w-[32px] h-8"
        >
          ×
        </Button>
      </div>

      <div className="space-y-4">
        <div className="bg-gray-600 rounded-lg p-3">
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
              <div className="text-xs text-gray-300 mb-2">Color</div>
              <div className="flex gap-2 flex-wrap">
                {DRAWING_COLORS.map((color) => (
                  <button
                    key={color}
                    onClick={() => setBrushColor(color)}
                    className={`w-6 h-6 rounded-full border-2 ${
                      brushColor === color ? 'border-white' : 'border-gray-400'
                    }`}
                    style={{ backgroundColor: color }}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="bg-gray-600 rounded-lg p-3">
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
          <div className="ml-7 mt-2">
            <div className="text-xs text-gray-300 mb-2">Color</div>
            <div className="flex gap-2">
              <button
                onClick={() => setStencilHue(200)}
                className={`w-7 h-7 rounded-full border-2 ${
                  stencilHue === 200 ? 'border-white ring-2 ring-gray-400' : 'border-gray-400'
                }`}
                style={{ backgroundColor: '#000000' }}
                title="Negro"
              />
              <button
                onClick={() => setStencilHue(0)}
                className={`w-7 h-7 rounded-full border-2 ${
                  stencilHue === 0 ? 'border-white ring-2 ring-gray-400' : 'border-gray-400'
                }`}
                style={{ backgroundColor: '#ef4444' }}
                title="Rojo"
              />
              <button
                onClick={() => setStencilHue(220)}
                className={`w-7 h-7 rounded-full border-2 ${
                  stencilHue === 220 ? 'border-white ring-2 ring-gray-400' : 'border-gray-400'
                }`}
                style={{ backgroundColor: '#3b82f6' }}
                title="Azul"
              />
            </div>
          </div>
        </div>

        <div className="bg-gray-600 rounded-lg p-3">
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

        <div className="bg-white rounded-lg p-3">
          <div className="flex items-center gap-3">
            <div className="w-4 h-4" />
            <Switch checked={true} disabled />
            <span className="text-gray-800 text-sm font-medium flex-1">Color de fondo</span>
            <Eye className="w-4 h-4 text-gray-600" />
          </div>
        </div>
      </div>
    </div>
  );
}