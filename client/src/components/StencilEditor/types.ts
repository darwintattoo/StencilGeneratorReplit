import type { KonvaEventObject } from 'konva/lib/Node';
import type { Stage } from 'konva/lib/Stage';
import type { Layer } from 'konva/lib/Layer';
import type { Line } from 'konva/lib/shapes/Line';

export type Tool = 'brush' | 'eraser' | 'move' | 'eyedropper';
export type ActiveLayer = 'drawing' | 'stencil';

export interface DrawingLine {
  tool: Tool;
  points: number[];
  strokeWidth: number;
  layer: ActiveLayer;
  color: string;
  baseColor: string;
  globalCompositeOperation: 'source-over' | 'destination-out';
}

export interface ViewTransform {
  x: number;
  y: number;
  scale: number;
  rotation: number;
}

export interface LayerState {
  visible: boolean;
  opacity: number;
}

export interface LayersState {
  drawing: LayerState;
  stencil: LayerState;
  original: LayerState;
  background: LayerState;
}

export interface TouchCenter {
  x: number;
  y: number;
}

export interface Position {
  x: number;
  y: number;
}

export interface NativeSize {
  width: number;
  height: number;
}

// Konva event types
export type KonvaMouseEvent = KonvaEventObject<MouseEvent>;
export type KonvaTouchEvent = KonvaEventObject<TouchEvent>;
export type KonvaWheelEvent = KonvaEventObject<WheelEvent>;

// Konva element refs
export type StageRef = Stage;
export type LayerRef = Layer;
export type LineRef = Line;

// Gesture data interfaces
export interface PanGestureData {
  deltaX: number;
  deltaY: number;
}

export interface PinchGestureData {
  scale: number;
  centerX: number;
  centerY: number;
}

export interface RotateGestureData {
  deltaRotation: number;
  centerX: number;
  centerY: number;
}

export type GestureData = PanGestureData | PinchGestureData | RotateGestureData;