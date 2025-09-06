import React from 'react';
import { Stage, Layer, Image as KonvaImage, Line, Rect } from 'react-konva';
import { Slider } from '@/components/ui/slider';
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
  nativeSize,
  canvasSize
}: CanvasProps) {
  
  // Helper function to adjust color based on hue and saturation
  const adjustColor = (color: string, hue: number, saturation: number): string => {
    if (hue === 0 && saturation === 100) return color;
    
    // Convert hex to RGB
    const hex = color.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16) / 255;
    const g = parseInt(hex.substr(2, 2), 16) / 255;
    const b = parseInt(hex.substr(4, 2), 16) / 255;
    
    // Convert RGB to HSL
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;
    
    if (max === min) {
      h = s = 0; // achromatic
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
    
    // Apply hue and saturation adjustments
    h = (h + hue / 360) % 1;
    s = Math.min(1, Math.max(0, s * (saturation / 100)));
    
    // Convert HSL back to RGB
    const hue2rgb = (p: number, q: number, t: number): number => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1/6) return p + (q - p) * 6 * t;
      if (t < 1/2) return q;
      if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
      return p;
    };
    
    let newR, newG, newB;
    if (s === 0) {
      newR = newG = newB = l; // achromatic
    } else {
      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      newR = hue2rgb(p, q, h + 1/3);
      newG = hue2rgb(p, q, h);
      newB = hue2rgb(p, q, h - 1/3);
    }
    
    // Convert back to hex
    const toHex = (c: number) => {
      const hex = Math.round(c * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };
    
    return `#${toHex(newR)}${toHex(newG)}${toHex(newB)}`;
  };
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
                stroke={adjustColor(line.color, drawingHue, drawingSaturation)}
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
                stroke={adjustColor(currentLineRef.current?.color || '#000000', drawingHue, drawingSaturation)}
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
                image={stencilImg}
                width={nativeSize.width}
                height={nativeSize.height}
              />
            )}
            {stencilLines.map((line, i) => (
              <Line
                key={`stencil-${i}`}
                points={line.points}
                stroke={line.color}
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
                stroke={currentLineRef.current?.color}
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