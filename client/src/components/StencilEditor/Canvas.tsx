import React from 'react';
import { Stage, Layer, Image as KonvaImage, Line } from 'react-konva';
import { Slider } from '@/components/ui/slider';

interface CanvasProps {
  stageRef: React.RefObject<any>;
  isLayersOpen: boolean;
  viewTransform: { x: number; y: number; scale: number };
  handleMouseDown: (e: any) => void;
  handleMouseMove: (e: any) => void;
  handleMouseUp: () => void;
  handleWheel: (e: any) => void;
  handleTouchStart: (e: any) => void;
  handleTouchMove: (e: any) => void;
  handleTouchEnd: (e: any) => void;
  handleDoubleTap: () => void;
  layers: any;
  originalImg: HTMLImageElement | null;
  stencilImg: HTMLImageElement | null;
  filteredStencilImg: HTMLImageElement | null;
  lines: any[];
  brushColor: string;
  tool: 'brush' | 'eraser' | 'move';
  brushSize: number;
  setBrushSize: (size: number) => void;
  eraserSize: number;
  setEraserSize: (size: number) => void;
  nativeSize: { width: number; height: number };
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
  lines,
  brushColor,
  tool,
  brushSize,
  setBrushSize,
  eraserSize,
  setEraserSize,
  nativeSize
}: CanvasProps) {
  return (
    <>
      <Stage
        width={window.innerWidth - (isLayersOpen ? 320 : 0)}
        height={window.innerHeight}
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
      >
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
            {lines
              .filter((line) => line.layer === 'drawing')
              .map((line, i) => (
                <Line
                  key={i}
                  points={line.points}
                  stroke={line.tool === 'brush' ? line.color || brushColor : '#ffffff'}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.globalCompositeOperation}
                  perfectDrawEnabled={true}
                  shadowForStrokeEnabled={false}
                />
              ))}
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
            {lines
              .filter((line) => line.layer === 'stencil')
              .map((line, i) => (
                <Line
                  key={`stencil-${i}`}
                  points={line.points}
                  stroke={line.tool === 'brush' ? '#ef4444' : '#ffffff'}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation={line.globalCompositeOperation}
                  perfectDrawEnabled={true}
                  shadowForStrokeEnabled={false}
                />
              ))}
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