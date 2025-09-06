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
  tool: Tool;
  brushSize: number;
  setBrushSize: (size: number) => void;
  eraserSize: number;
  setEraserSize: (size: number) => void;
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
  tool,
  brushSize,
  setBrushSize,
  eraserSize,
  setEraserSize,
  nativeSize,
  canvasSize
}: CanvasProps) {
  return (
    <>
      <div 
        className="inline-block border border-gray-600 rounded-lg overflow-hidden shadow-lg"
        style={{
          margin: 'auto',
          alignSelf: 'center'
        }}
      >
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
            {currentLineRef.current?.layer === 'drawing' && !isErasingStencil && (
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
      </div>

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