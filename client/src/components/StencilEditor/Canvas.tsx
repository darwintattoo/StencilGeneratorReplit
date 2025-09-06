import React, { useMemo } from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect } from 'react-konva';
import { Slider } from '@/components/ui/slider';
import Konva from 'konva';
import type {
  DrawingLine,
  ViewTransform,
  LayersState,
  Tool,
  NativeSize,
  KonvaMouseEvent,
  KonvaTouchEvent,
  KonvaWheelEvent,
  StageRef,
  LineRef
} from './types';

interface CanvasProps {
  stageRef: React.RefObject<StageRef>;
  isLayersOpen: boolean;
  viewTransform: ViewTransform;
  handleMouseDown: (e: KonvaMouseEvent | KonvaTouchEvent) => void;
  handleMouseMove: (e: KonvaMouseEvent | KonvaTouchEvent) => void;
  handleMouseUp: () => void;
  handleWheel: (e: KonvaWheelEvent) => void;
  handleTouchStart: (e: KonvaTouchEvent) => void;
  handleTouchMove: (e: KonvaTouchEvent) => void;
  handleTouchEnd: (e: KonvaTouchEvent) => void;
  handleDoubleTap: () => void;
  layers: LayersState;
  originalImg: HTMLImageElement | null;
  stencilImg: HTMLImageElement | null;
  filteredStencilImg: HTMLImageElement | null;
  drawingLines: DrawingLine[];
  stencilLines: DrawingLine[];
  currentLineRef: React.RefObject<DrawingLine | null>;
  drawingPointsRef: React.RefObject<number[]>;
  tempLineRef: React.RefObject<LineRef>;
  isErasingStencil: boolean;
  brushColor: string;
  setBrushColor: (color: string) => void;
  tool: Tool;
  brushSize: number;
  setBrushSize: (size: number) => void;
  eraserSize: number;
  setEraserSize: (size: number) => void;
  drawingHue: number;
  drawingSaturation: number;
  drawingBrightness: number;
  stencilHue: number;
  stencilSaturation: number;
  stencilBrightness: number;
  nativeSize: NativeSize;
  canvasSize: NativeSize;
}

export default function Canvas({
  stageRef,
  isLayersOpen,
  viewTransform,
  handleMouseDown,
  handleMouseMove,
  handleMouseUp,
  handleWheel,
  handleTouchStart,
  handleTouchMove,
  handleTouchEnd,
  handleDoubleTap,
  layers,
  originalImg,
  stencilImg,
  filteredStencilImg,
  drawingLines,
  stencilLines,
  currentLineRef,
  drawingPointsRef,
  tempLineRef,
  isErasingStencil,
  brushColor,
  setBrushColor,
  tool,
  brushSize,
  setBrushSize,
  eraserSize,
  setEraserSize,
  drawingHue,
  drawingSaturation,
  drawingBrightness,
  stencilHue,
  stencilSaturation,
  stencilBrightness,
  nativeSize,
  canvasSize
}: CanvasProps) {
  
  // Función para cambiar color con HSL
  const adjustColor = useMemo(() => {
    return (color: string, hue: number, sat: number, bright: number): string => {
      if (hue === 0 && sat === 100 && bright === 100) return color;
      
      // Convertir hex a RGB
      const hexToRgb = (hex: string) => {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
      };
      
      // Convertir RGB a HSL
      const rgbToHsl = (r: number, g: number, b: number) => {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h: number, s: number, l = (max + min) / 2;
        
        if (max === min) {
          h = s = 0;
        } else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
            default: h = 0;
          }
          h /= 6;
        }
        return { h, s, l };
      };
      
      // Convertir HSL a RGB
      const hslToRgb = (h: number, s: number, l: number) => {
        let r: number, g: number, b: number;
        
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p: number, q: number, t: number) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
          };
          
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1/3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1/3);
        }
        
        return {
          r: Math.round(r * 255),
          g: Math.round(g * 255),
          b: Math.round(b * 255)
        };
      };
      
      const rgb = hexToRgb(color);
      const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
      
      // Aplicar transformaciones
      let newH = (hsl.h + hue / 360) % 1;
      let newS = Math.max(0, Math.min(1, hsl.s * (sat / 100)));
      let newL = Math.max(0, Math.min(1, hsl.l * (bright / 100)));
      
      const newRgb = hslToRgb(newH, newS, newL);
      
      // Convertir de vuelta a hex
      const componentToHex = (c: number) => {
        const hex = c.toString(16);
        return hex.length === 1 ? "0" + hex : hex;
      };
      
      return `#${componentToHex(newRgb.r)}${componentToHex(newRgb.g)}${componentToHex(newRgb.b)}`;
    };
  }, []);
  return (
    <>
      <Stage
        width={canvasSize.width - (isLayersOpen ? 320 : 0)}
        height={canvasSize.height}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onWheel={handleWheel}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onDblTap={handleDoubleTap}
        ref={stageRef}
        scaleX={viewTransform.scale}
        scaleY={viewTransform.scale}
        x={viewTransform.x}
        y={viewTransform.y}
        rotation={viewTransform.rotation}
      >
        {/* Capa de fondo blanco */}
        {layers.background.visible && (
          <Layer opacity={layers.background.opacity / 100}>
            <Rect
              x={0}
              y={0}
              width={nativeSize.width}
              height={nativeSize.height}
              fill="white"
            />
          </Layer>
        )}

        {layers.original.visible && (
          <Layer opacity={layers.original.opacity / 100}>
            {originalImg && (
              <KonvaImage
                image={originalImg}
                width={nativeSize.width}
                height={nativeSize.height}
              />
            )}
          </Layer>
        )}

        {layers.stencil.visible && (
          <Layer opacity={layers.stencil.opacity / 100}>
            {filteredStencilImg ? (
              <KonvaImage
                image={filteredStencilImg}
                width={nativeSize.width}
                height={nativeSize.height}
              />
            ) : stencilImg ? (
              <KonvaImage
                image={stencilImg}
                width={nativeSize.width}
                height={nativeSize.height}
              />
            ) : null}
          </Layer>
        )}

        {layers.drawing.visible && (
          <Layer opacity={layers.drawing.opacity / 100}>
            {drawingLines.map((line, i) => (
              <Line
                key={i}
                points={line.points}
                stroke={adjustColor(line.baseColor || line.color, drawingHue, drawingSaturation, drawingBrightness)}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={line.globalCompositeOperation}
                perfectDrawEnabled={true}
                shadowForStrokeEnabled={false}
              />
            ))}
            {currentLineRef.current?.layer === 'drawing' && !isErasingStencil && (
              <Line
                ref={tempLineRef}
                points={drawingPointsRef.current || []}
                stroke={adjustColor(currentLineRef.current?.baseColor || currentLineRef.current?.color || '#ef4444', drawingHue, drawingSaturation, drawingBrightness)}
                strokeWidth={currentLineRef.current?.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={currentLineRef.current?.globalCompositeOperation}
                perfectDrawEnabled={true}
                shadowForStrokeEnabled={false}
              />
            )}
          </Layer>
        )}

        {layers.stencil.visible && (
          <Layer opacity={layers.stencil.opacity / 100}>
            {stencilImg && (
              <KonvaImage
                image={filteredStencilImg || stencilImg}
                width={nativeSize.width}
                height={nativeSize.height}
              />
            )}
            {stencilLines.map((line, i) => (
              <Line
                key={`stencil-${i}`}
                points={line.points}
                stroke={adjustColor(line.baseColor || line.color, stencilHue, stencilSaturation)}
                strokeWidth={line.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={line.globalCompositeOperation}
                perfectDrawEnabled={true}
                shadowForStrokeEnabled={false}
              />
            ))}
            {currentLineRef.current?.layer === 'stencil' && !isErasingStencil && (
              <Line
                ref={tempLineRef}
                points={drawingPointsRef.current || []}
                stroke={adjustColor(currentLineRef.current?.baseColor || currentLineRef.current?.color || '#ef4444', stencilHue, stencilSaturation)}
                strokeWidth={currentLineRef.current?.strokeWidth}
                tension={0.5}
                lineCap="round"
                lineJoin="round"
                globalCompositeOperation={currentLineRef.current?.globalCompositeOperation}
                perfectDrawEnabled={true}
                shadowForStrokeEnabled={false}
              />
            )}
          </Layer>
        )}
      </Stage>

      {tool === 'brush' && (
        <div className="absolute left-6 top-1/2 transform -translate-y-1/2 z-30">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-4 h-44 w-14 flex flex-col items-center justify-center shadow-lg border border-gray-200">
            <div className="transform -rotate-90 w-28 flex flex-col items-center">
              <Slider
                value={[brushSize]}
                onValueChange={([value]) => setBrushSize(value)}
                max={30}
                min={1}
                step={1}
                className="w-28 mb-2"
              />
              <div className="text-xs font-medium text-gray-700 transform rotate-90 whitespace-nowrap">
                {brushSize}
              </div>
            </div>
          </div>
        </div>
      )}

      {tool === 'eraser' && (
        <div className="absolute right-6 top-1/2 transform -translate-y-1/2 z-30">
          <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-4 h-44 w-14 flex flex-col items-center justify-center shadow-lg border border-gray-200">
            <div className="transform -rotate-90 w-28 flex flex-col items-center">
              <Slider
                value={[eraserSize]}
                onValueChange={([value]) => setEraserSize(value)}
                max={100}
                min={1}
                step={1}
                className="w-28 mb-2"
              />
              <div className="text-xs font-medium text-gray-700 transform rotate-90 whitespace-nowrap">
                {eraserSize}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}