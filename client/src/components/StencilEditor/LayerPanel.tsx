import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { GripVertical, Eye, EyeOff, Link, Unlink, ChevronDown, Palette, RotateCcw } from 'lucide-react';
import type { LayersState, ActiveLayer, DrawingLine, StageRef, StencilImage } from './types';

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
  activeLayer: ActiveLayer;
  setActiveLayer: (layer: ActiveLayer) => void;
  stageRef?: React.RefObject<StageRef>;
  originalImage?: HTMLImageElement | null;
  stencilImage?: StencilImage | null;
  drawingLines?: DrawingLine[];
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
  activeLayer,
  setActiveLayer,
  stageRef,
  originalImage,
  stencilImage,
  drawingLines,
  onClose
}: LayerPanelProps) {
  const [isDrawingColorOpen, setIsDrawingColorOpen] = useState(false);
  const [isStencilColorOpen, setIsStencilColorOpen] = useState(false);

  // Componente de miniatura simplificado
  const LayerThumbnail = ({ layerKey }: { layerKey: string }) => {
    let content;
    
    if (layerKey === 'original' && originalImage) {
      // Crear miniatura de imagen original
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = 48;
        canvas.height = 48;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 48, 48);
        
        const aspect = originalImage.width / originalImage.height;
        let drawWidth = 48;
        let drawHeight = 48;
        let offsetX = 0;
        let offsetY = 0;

        if (aspect > 1) {
          drawHeight = 48 / aspect;
          offsetY = (48 - drawHeight) / 2;
        } else {
          drawWidth = 48 * aspect;
          offsetX = (48 - drawWidth) / 2;
        }

        ctx.drawImage(originalImage, offsetX, offsetY, drawWidth, drawHeight);
        content = <img src={canvas.toDataURL()} alt="original" className="w-full h-full object-cover" />;
      }
    } else if (layerKey === 'stencil' && stencilImage) {
      // Crear miniatura de stencil
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = 48;
        canvas.height = 48;
        ctx.fillStyle = '#1a1a1a';
        ctx.fillRect(0, 0, 48, 48);
        
        const aspect = stencilImage.width / stencilImage.height;
        let drawWidth = 48;
        let drawHeight = 48;
        let offsetX = 0;
        let offsetY = 0;

        if (aspect > 1) {
          drawHeight = 48 / aspect;
          offsetY = (48 - drawHeight) / 2;
        } else {
          drawWidth = 48 * aspect;
          offsetX = (48 - drawWidth) / 2;
        }

        ctx.drawImage(stencilImage, offsetX, offsetY, drawWidth, drawHeight);
        content = <img src={canvas.toDataURL()} alt="stencil" className="w-full h-full object-cover" />;
      }
    } else if (layerKey === 'drawing' && drawingLines && drawingLines.length > 0) {
      // Mostrar color del dibujo o placeholder
      content = <div className="w-6 h-6 bg-red-500 rounded" style={{ backgroundColor: brushColor }}></div>;
    }
    
    if (!content) {
      content = <div className="w-6 h-6 bg-gray-600 rounded"></div>;
    }

    return (
      <div className="w-12 h-12 bg-gray-700 rounded border border-gray-600 flex items-center justify-center overflow-hidden">
        {content}
      </div>
    );
  };

  const renderColorControls = (
    type: 'drawing' | 'stencil',
    hue: number,
    setHue: (value: number) => void,
    saturation: number,
    setSaturation: (value: number) => void,
    brightness: number,
    setBrightness: (value: number) => void,
    showLinkButton = false
  ) => (
    <div>
      <div className="text-xs text-gray-300 mb-2 flex items-center gap-2">
        {showLinkButton && (
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
        )}
        <span>Hue:</span>
        <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(hue)}</span>
      </div>
      <div className="relative mb-4">
        <div className="h-3 rounded-full" style={{
          background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)'
        }}></div>
        <Slider
          value={[hue]}
          onValueChange={([value]) => {
            setHue(value);
            if (isColorLinked && type === 'drawing') {
              setStencilHue(value);
            } else if (isColorLinked && type === 'stencil') {
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
        <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(saturation)}</span>
      </div>
      <div className="relative mb-4">
        <div className="h-3 rounded-full" style={{
          background: 'linear-gradient(to right, #808080, #ff0000)'
        }}></div>
        <Slider
          value={[saturation]}
          onValueChange={([value]) => {
            setSaturation(value);
            if (isColorLinked && type === 'drawing') {
              setStencilSaturation(value);
            } else if (isColorLinked && type === 'stencil') {
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
        <span className="text-white bg-gray-600 px-2 py-1 text-xs rounded">{Math.round(brightness)}</span>
      </div>
      <div className="relative">
        <div className="h-3 rounded-full" style={{
          background: 'linear-gradient(to right, #000000, #ffffff)'
        }}></div>
        <Slider
          value={[brightness]}
          onValueChange={([value]) => {
            setBrightness(value);
            if (isColorLinked && type === 'drawing') {
              setStencilBrightness(value);
            } else if (isColorLinked && type === 'stencil') {
              setDrawingBrightness(value);
            }
          }}
          max={200}
          min={0}
          step={1}
          className="absolute inset-0 opacity-75"
        />
      </div>
      
      {/* Botón de Reset */}
      <div className="mt-4 pt-3 border-t border-gray-600">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            setHue(0);
            setSaturation(100);
            setBrightness(100);
            if (isColorLinked) {
              if (type === 'drawing') {
                setStencilHue(0);
                setStencilSaturation(100);
                setStencilBrightness(100);
              } else {
                setDrawingHue(0);
                setDrawingSaturation(100);
                setDrawingBrightness(100);
              }
            }
          }}
          className="w-full flex items-center gap-2 text-xs text-gray-300 hover:text-white border-gray-600 hover:border-gray-500"
        >
          <RotateCcw className="w-3 h-3" />
          Reset
        </Button>
      </div>
    </div>
  );

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 sm:fixed sm:inset-auto sm:right-0 sm:top-0 sm:bottom-0 sm:h-full w-full sm:w-80 sm:border-l border-gray-600 p-3 sm:p-4 overflow-y-auto z-50 bg-black/90 sm:bg-[rgba(26,26,26,0.98)]" style={{ backgroundColor: 'rgba(26, 26, 26, 0.98)' }}>
      <div className="flex items-center justify-between mb-4 sticky top-0 pb-2 z-50" style={{ backgroundColor: 'rgba(26, 26, 26, 0.98)' }}>
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
        <div 
          className={`rounded-lg p-3 cursor-pointer transition-colors ${
            activeLayer === 'drawing' 
              ? 'bg-blue-900/50 border border-blue-500/30' 
              : 'hover:bg-gray-700/50'
          }`} 
          style={{ 
            backgroundColor: activeLayer === 'drawing' 
              ? 'rgba(59, 130, 246, 0.2)' 
              : '#2d2d2d' 
          }}
          onClick={() => setActiveLayer('drawing')}
        >
          <div className="flex items-center gap-3 mb-2">
            <LayerThumbnail layerKey="drawing" />
            <GripVertical className="w-4 h-4 text-gray-300" />
            <Switch
              checked={layers.drawing.visible}
              onCheckedChange={(checked) => toggleLayer('drawing', checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-white text-sm font-medium flex-1">Drawing</span>
            <span className="text-gray-300 text-xs">N</span>
            {layers.drawing.visible ? (
              <Eye className="w-4 h-4 text-gray-300" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-300" />
            )}
          </div>
          
          <div className="ml-16">
            <Collapsible open={isDrawingColorOpen} onOpenChange={setIsDrawingColorOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 w-full justify-start p-0 h-6 text-gray-300 hover:text-white"
                >
                  <Palette className="w-3 h-3" />
                  <span className="text-xs">Color Controls</span>
                  <ChevronDown 
                    className={`w-3 h-3 transition-transform ${isDrawingColorOpen ? 'rotate-180' : ''}`} 
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                {renderColorControls(
                  'drawing',
                  drawingHue,
                  setDrawingHue,
                  drawingSaturation,
                  setDrawingSaturation,
                  drawingBrightness,
                  setDrawingBrightness,
                  true
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <div 
          className={`rounded-lg p-3 cursor-pointer transition-colors ${
            activeLayer === 'stencil' 
              ? 'bg-blue-900/50 border border-blue-500/30' 
              : 'hover:bg-gray-700/50'
          }`} 
          style={{ 
            backgroundColor: activeLayer === 'stencil' 
              ? 'rgba(59, 130, 246, 0.2)' 
              : '#2d2d2d' 
          }}
          onClick={() => setActiveLayer('stencil')}
        >
          <div className="flex items-center gap-3 mb-2">
            <LayerThumbnail layerKey="stencil" />
            <GripVertical className="w-4 h-4 text-gray-300" />
            <Switch
              checked={layers.stencil.visible}
              onCheckedChange={(checked) => toggleLayer('stencil', checked)}
              onClick={(e) => e.stopPropagation()}
            />
            <span className="text-white text-sm font-medium flex-1">Stencil</span>
            <span className="text-gray-300 text-xs">N</span>
            {layers.stencil.visible ? (
              <Eye className="w-4 h-4 text-gray-300" />
            ) : (
              <EyeOff className="w-4 h-4 text-gray-300" />
            )}
          </div>
          
          <div className="ml-16">
            <Collapsible open={isStencilColorOpen} onOpenChange={setIsStencilColorOpen}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="flex items-center gap-2 w-full justify-start p-0 h-6 text-gray-300 hover:text-white"
                >
                  <Palette className="w-3 h-3" />
                  <span className="text-xs">Color Controls</span>
                  <ChevronDown 
                    className={`w-3 h-3 transition-transform ${isStencilColorOpen ? 'rotate-180' : ''}`} 
                  />
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent className="mt-3">
                {renderColorControls(
                  'stencil',
                  stencilHue,
                  setStencilHue,
                  stencilSaturation,
                  setStencilSaturation,
                  stencilBrightness,
                  setStencilBrightness,
                  false
                )}
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        <div className="rounded-lg p-3" style={{ backgroundColor: '#2d2d2d' }}>
          <div className="flex items-center gap-3 mb-2">
            <LayerThumbnail layerKey="original" />
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
          <div className="ml-16 mt-2">
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
            <div className="w-12 h-12 bg-white rounded border border-gray-600"></div>
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
          <div className="ml-16 mt-2">
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