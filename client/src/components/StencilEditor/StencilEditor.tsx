import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import Canvas from './Canvas';
import LayerPanel from './LayerPanel';
import Toolbar from './Toolbar';
import { rgbToHsl, hslToRgb } from '@/lib/color';
import type {
  DrawingLine,
  ViewTransform,
  LayersState,
  Tool,
  ActiveLayer,
  Position,
  TouchCenter,
  NativeSize,
  KonvaPointerEvent,
  KonvaWheelEvent,
  StageRef,
  LineRef,
  LayerRef,
  StencilImage,
  PanGestureData,
  PinchGestureData,
  RotateGestureData
} from './types';

// Colores disponibles para el dibujo - solo negro, rojo y azul
const DRAWING_COLORS = [
  '#000000', // Negro
  '#ef4444', // Rojo
  '#3b82f6', // Azul
];

// Hook personalizado para manejar la lógica del canvas
function useStencilCanvas() {
  const [tool, setTool] = useState<Tool>('brush');
  const [brushSize, setBrushSize] = useState<number>(4);
  const [eraserSize, setEraserSize] = useState<number>(10);
  const [activeLayer, setActiveLayer] = useState<ActiveLayer>('drawing');
  const [brushColor, setBrushColor] = useState<string>('#ef4444'); // Rojo por defecto
  const [stencilHue, setStencilHue] = useState<number>(0); // Control de tono para stencil
  const [stencilSaturation, setStencilSaturation] = useState<number>(100); // Control de saturación para stencil
  const [drawingHue, setDrawingHue] = useState<number>(0); // Control de tono para drawing
  const [drawingSaturation, setDrawingSaturation] = useState<number>(100); // Control de saturación para drawing
  const [drawingBrightness, setDrawingBrightness] = useState<number>(100); // Control de brillo para drawing
  const [stencilBrightness, setStencilBrightness] = useState<number>(100); // Control de brillo para stencil
  const [isColorLinked, setIsColorLinked] = useState<boolean>(true); // Control para enlazar colores
  const [layers, setLayers] = useState<LayersState>({
    drawing: { visible: true, opacity: 100 },
    stencil: { visible: true, opacity: 100 },
    original: { visible: true, opacity: 20 },
    background: { visible: true, opacity: 100 }
  });
  const [viewTransform, setViewTransform] = useState<ViewTransform>({
    x: 0,
    y: 0,
    scale: 1,
    rotation: 0
  });

  const toggleLayer = (key: string, visible: boolean) => {
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], visible }
    }));
  };

  const setOpacity = (key: string, opacity: number) => {
    setLayers(prev => ({
      ...prev,
      [key]: { ...prev[key as keyof typeof prev], opacity }
    }));
  };

  const handleGesture = (type: 'pan' | 'pinch' | 'rotate', data: PanGestureData | PinchGestureData | RotateGestureData) => {
    if (type === 'pan') {
      const panData = data as PanGestureData;
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + panData.deltaX,
        y: prev.y + panData.deltaY
      }));
    } else if (type === 'pinch') {
      const pinchData = data as PinchGestureData;
      const newScale = Math.max(0.1, Math.min(5, pinchData.scale));
      setViewTransform(prev => ({
        ...prev,
        scale: newScale,
        x: pinchData.centerX - (pinchData.centerX - prev.x) * (newScale / prev.scale),
        y: pinchData.centerY - (pinchData.centerY - prev.y) * (newScale / prev.scale)
      }));
    } else if (type === 'rotate') {
      const rotateData = data as RotateGestureData;
      setViewTransform(prev => {
        const angleRad = (rotateData.deltaRotation * Math.PI) / 180;
        const cos = Math.cos(angleRad);
        const sin = Math.sin(angleRad);
        const x = prev.x - rotateData.centerX;
        const y = prev.y - rotateData.centerY;

        return {
          ...prev,
          rotation: prev.rotation + rotateData.deltaRotation,
          x: rotateData.centerX + x * cos - y * sin,
          y: rotateData.centerY + x * sin + y * cos
        };
      });
    }
  };

  const resetView = () => {
    setViewTransform({ x: 0, y: 0, scale: 1, rotation: 0 });
  };

  return {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    eraserSize,
    setEraserSize,
    activeLayer,
    setActiveLayer,
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
    layers,
    toggleLayer,
    setOpacity,
    viewTransform,
    handleGesture,
    resetView
  };
}

interface StencilEditorProps {
  originalImage?: string;
  stencilImage?: string;
}

export default function StencilEditor({ originalImage, stencilImage }: StencilEditorProps) {
  const [location, setLocation] = useLocation();
  const stageRef = useRef<StageRef>(null);
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  const [stencilImg, setStencilImg] = useState<StencilImage | null>(null);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const [drawingLines, setDrawingLines] = useState<DrawingLine[]>([]);
  const [stencilLines, setStencilLines] = useState<DrawingLine[]>([]);
  const drawingPointsRef = useRef<number[]>([]);
  const currentLineRef = useRef<DrawingLine | null>(null);
  const frameRef = useRef<number>(0);
  const tempLineRef = useRef<LineRef>(null);
  const stencilLayerRef = useRef<LayerRef>(null);
  const cleanupTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updateTempLine = () => {
    if (tempLineRef.current) {
      tempLineRef.current.points(drawingPointsRef.current);
      tempLineRef.current.getLayer()?.batchDraw();
    }
    frameRef.current = requestAnimationFrame(updateTempLine);
  };
  const [nativeSize, setNativeSize] = useState<NativeSize>({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState<boolean>(false);
  const [lastPointerPosition, setLastPointerPosition] = useState<Position>({ x: 0, y: 0 });
  const [isLayersOpen, setIsLayersOpen] = useState<boolean>(false);
  const pointersRef = useRef<Map<number, Position>>(new Map());
  const lastPinchDistanceRef = useRef<number>(0);
  const lastCenterRef = useRef<PointerCenter>({ x: 0, y: 0 });
  const lastAngleRef = useRef<number>(0);
  const [stencilCanvas, setStencilCanvas] = useState<HTMLCanvasElement | null>(null);
  const stencilCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const [isErasingStencil, setIsErasingStencil] = useState<boolean>(false);
  const [filteredStencilImg, setFilteredStencilImg] = useState<StencilImage | null>(null);
  const [stencilVersion, setStencilVersion] = useState(0);
  const filterCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [canvasSize, setCanvasSize] = useState<NativeSize>({ 
    width: window.innerWidth, 
    height: window.innerHeight 
  });

  const {
    tool,
    setTool,
    brushSize,
    setBrushSize,
    eraserSize,
    setEraserSize,
    activeLayer,
    setActiveLayer,
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
    layers,
    toggleLayer,
    setOpacity,
    viewTransform,
    handleGesture,
    resetView
  } = useStencilCanvas();

  // Manejar redimensionamiento de ventana para hacer el canvas responsivo
  useEffect(() => {
    const handleResize = (): void => {
      setCanvasSize({ 
        width: window.innerWidth, 
        height: window.innerHeight 
      });
    };
    
    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
    };
  }, []);

  // Cargar imágenes en resolución nativa
  useEffect(() => {
    if (stencilImage) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        setStencilImg(img);
        setNativeSize({ width: img.width, height: img.height });
      };
      img.src = stencilImage;
    }
  }, [stencilImage]);

  useEffect(() => {
    if (originalImage) {
      const img = new window.Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => setOriginalImg(img);
      img.src = originalImage;
    }
  }, [originalImage]);

  const pickColorAt = (x: number, y: number): string | null => {
    const stage = stageRef.current;
    if (!stage) return null;
    
    console.log(`[Eyedropper] Sampling at coordinates: x=${x}, y=${y}`);
    
    try {
      // Crear una región de muestreo más grande y capturar con pixelRatio completo
      const sampleSize = 10;
      const sampleX = Math.floor(x) - Math.floor(sampleSize / 2);
      const sampleY = Math.floor(y) - Math.floor(sampleSize / 2);
      
      // Forzar renderizado del stage antes del muestreo
      stage.draw();
      
      const canvas = stage.toCanvas({
        x: sampleX,
        y: sampleY,
        width: sampleSize,
        height: sampleSize,
        pixelRatio: window.devicePixelRatio || 1
      });
      
      console.log(`[Eyedropper] Canvas created: ${canvas.width}x${canvas.height}`);
      
      const ctx = canvas.getContext('2d');
      if (!ctx) return null;
      
      // Leer múltiples pixeles y promediar para mejor resultado
      const centerX = Math.floor(canvas.width / 2);
      const centerY = Math.floor(canvas.height / 2);
      const sampleArea = 3; // área 3x3 para promediar
      
      let totalR = 0, totalG = 0, totalB = 0, validPixels = 0;
      
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const px = centerX + dx;
          const py = centerY + dy;
          
          if (px >= 0 && py >= 0 && px < canvas.width && py < canvas.height) {
            const { data } = ctx.getImageData(px, py, 1, 1);
            const [r, g, b, a] = data;
            
            if (a > 0) { // Solo contar pixeles no transparentes
              totalR += r;
              totalG += g;
              totalB += b;
              validPixels++;
            }
          }
        }
      }
      
      if (validPixels > 0) {
        // Promediar los pixeles válidos
        const avgR = Math.round(totalR / validPixels);
        const avgG = Math.round(totalG / validPixels);
        const avgB = Math.round(totalB / validPixels);
        const color = `#${((avgR << 16) | (avgG << 8) | avgB).toString(16).padStart(6, '0')}`;
        console.log(`[Eyedropper] Color sampled: ${color} from ${validPixels} pixels`);
        return color;
      }
      
      // Si no hay pixeles válidos, intentar fallback con imagen base
      console.log('[Eyedropper] No valid pixels, trying fallback');
      const sourceImg = filteredStencilImg || stencilImg;
      if (sourceImg) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = sourceImg.width;
        tempCanvas.height = sourceImg.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (tempCtx) {
          tempCtx.drawImage(sourceImg, 0, 0);
          const clampedX = Math.max(0, Math.min(sourceImg.width - 1, Math.round(x)));
          const clampedY = Math.max(0, Math.min(sourceImg.height - 1, Math.round(y)));
          const fallbackData = tempCtx.getImageData(clampedX, clampedY, 1, 1).data;
          const fallbackColor = `#${((fallbackData[0] << 16) | (fallbackData[1] << 8) | fallbackData[2]).toString(16).padStart(6, '0')}`;
          console.log(`[Eyedropper] Fallback color: ${fallbackColor}`);
          return fallbackColor;
        }
      }
      
      console.log('[Eyedropper] No color found, defaulting to white');
      return '#ffffff'; // Blanco por defecto si no hay contenido
      
    } catch (error) {
      console.error('[Eyedropper] Error picking color:', error);
      // Fallback a método anterior si falla
      const sourceImg = filteredStencilImg || stencilImg;
      if (!sourceImg) return null;
      
      const canvas = document.createElement('canvas');
      canvas.width = sourceImg.width;
      canvas.height = sourceImg.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return null;
      ctx.drawImage(sourceImg, 0, 0);
      
      const clampedX = Math.max(0, Math.min(sourceImg.width - 1, Math.round(x)));
      const clampedY = Math.max(0, Math.min(sourceImg.height - 1, Math.round(y)));
      
      const { data } = ctx.getImageData(clampedX, clampedY, 1, 1);
      const r = data[0];
      const g = data[1];
      const b = data[2];
      const errorFallbackColor = `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
      console.log(`[Eyedropper] Error fallback color: ${errorFallbackColor}`);
      return errorFallbackColor;
    }
  };

  const applyHue = (canvas: HTMLCanvasElement, hue: number) => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i];
      const g = data[i + 1];
      const b = data[i + 2];
      const [h, s, l] = rgbToHsl(r, g, b);
      const newH = (h + hue / 360) % 1;
      const [newR, newG, newB] = hslToRgb(newH, s, l);
      data[i] = newR;
      data[i + 1] = newG;
      data[i + 2] = newB;
    }
    ctx.putImageData(imageData, 0, 0);
  };

  // Aplicar filtro de tono y saturación al stencil usando filtros nativos (mucho más rápido)
  useEffect(() => {
    if (stencilImg) {
      // Si no hay cambios, usar imagen original
      if (stencilHue === 0 && stencilSaturation === 100 && stencilBrightness === 100) {
        setFilteredStencilImg(null);
        return;
      }

      // Reutilizar canvas o crear uno nuevo
      const canvas = filterCanvasRef.current ?? document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = stencilImg.width;
        canvas.height = stencilImg.height;
        
        // Limpiar canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Aplicar filtros nativos del canvas (mucho más rápido que píxel a píxel)
        const saturationValue = stencilSaturation / 100;
        const brightnessValue = stencilBrightness / 100;
        ctx.filter = `hue-rotate(${stencilHue}deg) saturate(${saturationValue}) brightness(${brightnessValue})`;
        
        // Dibujar imagen con filtros aplicados
        ctx.drawImage(stencilImg, 0, 0);
        
        // Resetear filtro
        ctx.filter = 'none';
        
        // Usar canvas directamente sin conversión costosa
        setFilteredStencilImg(canvas);
        stencilLayerRef.current?.batchDraw();

        // Guardar referencia del canvas para reutilización
        if (!filterCanvasRef.current) {
          filterCanvasRef.current = canvas;
        }
      }
    }
  }, [stencilImg, stencilHue, stencilSaturation, stencilBrightness, stencilVersion]);

  // Funciones auxiliares para gestos
  const getDistance = (p1: Position, p2: Position): number => {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (p1: Position, p2: Position): PointerCenter => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  };

  const getAngle = (p1: Position, p2: Position): number => {
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  // Manejo unificado de pointer events (mouse, touch, Apple Pencil)
  const handlePointerDown = (e: KonvaPointerEvent) => {
    console.log(`[DEBUG] handlePointerDown called with current tool: ${tool}`);
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const pointerEvent = e.evt;

    // Manejar multi-touch
    if (pointerEvent.pointerType === 'touch') {
      pointersRef.current.set(pointerEvent.pointerId, {
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
      });
      if (pointersRef.current.size === 2) {
        const [p1, p2] = Array.from(pointersRef.current.values());
        lastPinchDistanceRef.current = getDistance(p1, p2);
        lastCenterRef.current = getCenter(p1, p2);
        lastAngleRef.current = getAngle(p1, p2);
        setIsPanning(false);
        setIsDrawing(false);
        return;
      }
    }

    if (tool === 'move' || pointerEvent.button === 1 || pointerEvent.button === 2) {
      pointerEvent.preventDefault();
      setIsPanning(true);
      setLastPointerPosition(pos);
      return;
    }

    if (tool === 'eyedropper') {
      pointerEvent.preventDefault();
      console.log('[Eyedropper] Tool activated, checking API availability');
      
      if (typeof (window as any).EyeDropper === 'function') {
        console.log('[Eyedropper] Using native EyeDropper API');
        const eyeDropper = new (window as any).EyeDropper();
        eyeDropper
          .open()
          .then((result: { sRGBHex: string }) => {
            console.log(`[Eyedropper] Native API color selected: ${result.sRGBHex}`);
            setBrushColor(result.sRGBHex);
            setTool('brush');
          })
          .catch((error: any) => {
            console.log('[Eyedropper] Native API cancelled or failed:', error);
            setTool('brush');
          });
      } else {
        console.log('[Eyedropper] Using fallback color picker');
        const transform = stage.getAbsoluteTransform().copy().invert();
        const { x, y } = transform.point(pos);
        console.log(`[Eyedropper] Transformed coordinates: x=${x}, y=${y}`);
        const picked = pickColorAt(x, y);
        if (picked) {
          console.log(`[Eyedropper] Fallback color selected: ${picked}`);
          setBrushColor(picked);
        } else {
          console.log('[Eyedropper] No color could be picked');
        }
        setTool('brush');
      }
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      setIsDrawing(true);
      const transform = stage.getAbsoluteTransform().copy().invert();
      const { x, y } = transform.point(pos);

      // Si es borrador en capa stencil, preparar canvas para edición
      if (tool === 'eraser' && activeLayer === 'stencil' && stencilImg) {
        setIsErasingStencil(true);
        
        // Crear canvas de trabajo si no existe
        let canvas = stencilCanvas;
        if (!canvas) {
          canvas = document.createElement('canvas');
          canvas.width = stencilImg.width;
          canvas.height = stencilImg.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(stencilImg, 0, 0);
          }
          setStencilCanvas(canvas);
          setStencilImg(canvas);
        }
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          // Cachear contexto y preconfigurar una sola vez
          stencilCtxRef.current = ctx;
          ctx.globalCompositeOperation = 'destination-out';
          ctx.fillStyle = '#000';
          
          ctx.beginPath();
          ctx.arc(x, y, eraserSize, 0, 2 * Math.PI);
          ctx.fill();
          stencilLayerRef.current?.batchDraw();
        }
        return;
      }
      
      const color = tool === 'brush'
        ? (activeLayer === 'stencil' ? '#ef4444' : brushColor)
        : '#ffffff';
      currentLineRef.current = {
        tool,
        points: [],
        strokeWidth: tool === 'brush' ? brushSize : eraserSize,
        globalCompositeOperation: tool === 'eraser' ? 'destination-out' : 'source-over',
        layer: activeLayer,
        color,
        baseColor: color
      };
      drawingPointsRef.current = [x, y];
      frameRef.current = requestAnimationFrame(updateTempLine);
    }
  };

  const handlePointerMove = (e: KonvaPointerEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    const pointerEvent = e.evt;
    
    // Manejar multi-touch
    if (pointerEvent.pointerType === 'touch') {
      pointerEvent.preventDefault();
      pointersRef.current.set(pointerEvent.pointerId, {
        x: pointerEvent.clientX,
        y: pointerEvent.clientY,
      });
      if (pointersRef.current.size === 2) {
        const [p1, p2] = Array.from(pointersRef.current.values());
        const distance = getDistance(p1, p2);
        const center = getCenter(p1, p2);
        const angle = getAngle(p1, p2);
        if (lastPinchDistanceRef.current > 0) {
          const scale = distance / lastPinchDistanceRef.current;
          const newScale = Math.max(0.1, Math.min(5, viewTransform.scale * scale));
          const deltaX = center.x - lastCenterRef.current.x;
          const deltaY = center.y - lastCenterRef.current.y;
          const deltaRotation = angle - lastAngleRef.current;
          handleGesture('pinch', { scale: newScale, centerX: center.x, centerY: center.y });
          handleGesture('pan', { deltaX, deltaY });
          handleGesture('rotate', { deltaRotation, centerX: center.x, centerY: center.y });
        }
        lastPinchDistanceRef.current = distance;
        lastCenterRef.current = center;
        lastAngleRef.current = angle;
        return;
      }
    }

    if (isPanning) {
      const deltaX = pos.x - lastPointerPosition.x;
      const deltaY = pos.y - lastPointerPosition.y;
      handleGesture('pan', { deltaX, deltaY });
      setLastPointerPosition(pos);
      return;
    }

    if (!isDrawing) return;
    const transform = stage.getAbsoluteTransform().copy().invert();
    const point = transform.point(pos);
    const x = Math.max(0, Math.min(nativeSize.width, point.x));
    const y = Math.max(0, Math.min(nativeSize.height, point.y));

    // Si es borrador en capa stencil, usar contexto cacheado (ultra-rápido)
    if (tool === 'eraser' && activeLayer === 'stencil' && isErasingStencil && stencilCtxRef.current) {
      const ctx = stencilCtxRef.current;
      // Borrado instantáneo con contexto preconfigurado
      ctx.beginPath();
      ctx.arc(x, y, eraserSize, 0, 2 * Math.PI);
      ctx.fill();
      // Sin reconfigurar contexto para máxima velocidad
      return;
    }
    
    drawingPointsRef.current.push(x, y);
  };

  const handlePointerUp = (e: KonvaPointerEvent) => {
    const pointerEvent = e.evt;
    if (pointerEvent.pointerType === 'touch') {
      pointersRef.current.delete(pointerEvent.pointerId);
      if (pointersRef.current.size < 2) {
        lastPinchDistanceRef.current = 0;
        lastAngleRef.current = 0;
      }
      if (pointersRef.current.size > 0) {
        return;
      }
    }
    setIsDrawing(false);
    setIsPanning(false);

    if (currentLineRef.current) {
      const newLine = { ...currentLineRef.current, points: [...drawingPointsRef.current] };
      if (currentLineRef.current.layer === 'drawing') {
        setDrawingLines(prev => [...prev, newLine]);
      } else {
        setStencilLines(prev => [...prev, newLine]);
      }
    }
    cancelAnimationFrame(frameRef.current);
    drawingPointsRef.current = [];
    currentLineRef.current = null;

    // Finalizar borrado de stencil con restauración del contexto
    if (isErasingStencil && stencilCanvas) {
      // Restaurar contexto cacheado una sola vez al final
      if (stencilCtxRef.current) {
        stencilCtxRef.current.globalCompositeOperation = 'source-over';
      }
      
      // Usar canvas directamente sin conversiones costosas
      if (stencilHue !== 0 || stencilSaturation !== 100 || stencilBrightness !== 100) {
        setStencilVersion(v => v + 1); // Forzar recálculo de filtros
      } else {
        setFilteredStencilImg(null);
      }
      stencilLayerRef.current?.batchDraw();
      stencilCtxRef.current = null; // Limpiar referencia cacheada
      setIsErasingStencil(false);
    }
    
    if (tool === 'eraser' && stageRef.current) {
      // Cancelar timeout previo si existe
      if (cleanupTimeoutRef.current) {
        clearTimeout(cleanupTimeoutRef.current);
      }
      
      cleanupTimeoutRef.current = setTimeout(() => {
        const stage = stageRef.current;
        if (!stage) return;
        
        // Solo limpiar la capa específica que está siendo editada
        const targetName = isErasingStencil ? 'stencil' : activeLayer;
        const layers = stage.find(`Layer[name="${targetName}"]`);
        
        layers.forEach((layer: any) => {
          try {
            const hitCanvas = layer.getHitCanvas();
            if (hitCanvas) {
              // Técnica más eficiente: resetear dimensiones en lugar de clearRect
              hitCanvas.width = 0;
              hitCanvas.height = 0;
              layer.clearHitCache();
            }
          } catch (e) {
            console.log('Error limpiando hit canvas:', e);
          }
          layer.batchDraw();
        });
      }, 50);
    }
  };

  const handleWheel = (e: KonvaWheelEvent) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    if (!stage) return;
    
    const oldScale = viewTransform.scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    handleGesture('pinch', {
      scale: Math.max(0.1, Math.min(5, newScale)),
      centerX: pointer.x,
      centerY: pointer.y
    });
  };





  // Doble tap para reset
  const handleDoubleTap = () => {
    resetView();
  };

  return (
    <div className="h-screen relative flex" style={{
      backgroundColor: '#2a2a2a',
      backgroundImage: `
        linear-gradient(rgba(255, 255, 255, 0.1) 1px, transparent 1px),
        linear-gradient(90deg, rgba(255, 255, 255, 0.1) 1px, transparent 1px)
      `,
      backgroundSize: '24px 24px'
    }}>
      {/* Canvas principal */}
      <div className="flex-1 relative">
        <Canvas
          stageRef={stageRef}
          isLayersOpen={isLayersOpen}
          viewTransform={viewTransform}
          handlePointerDown={handlePointerDown}
          handlePointerMove={handlePointerMove}
          handlePointerUp={handlePointerUp}
          handleWheel={handleWheel}
          handleDoubleTap={handleDoubleTap}
          layers={layers}
          originalImg={originalImg}
          stencilImg={stencilImg}
          filteredStencilImg={filteredStencilImg}
          drawingLines={drawingLines}
          stencilLines={stencilLines}
          currentLineRef={currentLineRef}
          drawingPointsRef={drawingPointsRef}
          tempLineRef={tempLineRef}
          stencilLayerRef={stencilLayerRef}
          isErasingStencil={isErasingStencil}
          brushColor={brushColor}
          setBrushColor={setBrushColor}
          tool={tool}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          eraserSize={eraserSize}
          setEraserSize={setEraserSize}
          drawingHue={drawingHue}
          drawingSaturation={drawingSaturation}
          drawingBrightness={drawingBrightness}
          stencilHue={stencilHue}
          stencilSaturation={stencilSaturation}
          stencilBrightness={stencilBrightness}
          nativeSize={nativeSize}
          canvasSize={canvasSize}
        />

        <Toolbar
          tool={tool}
          setTool={setTool}
          activeLayer={activeLayer}
          setActiveLayer={setActiveLayer}
          brushColor={brushColor}
          setBrushColor={setBrushColor}
          layers={layers}
          setOpacity={setOpacity}
          viewTransform={viewTransform}
          isLayersOpen={isLayersOpen}
          setIsLayersOpen={setIsLayersOpen}
          onBack={() => setLocation('/')}
        />
      </div>

      <LayerPanel
        isOpen={isLayersOpen}
        layers={layers}
        toggleLayer={toggleLayer}
        setOpacity={setOpacity}
        brushColor={brushColor}
        setBrushColor={setBrushColor}
        stencilHue={stencilHue}
        setStencilHue={setStencilHue}
        stencilSaturation={stencilSaturation}
        setStencilSaturation={setStencilSaturation}
        drawingHue={drawingHue}
        setDrawingHue={setDrawingHue}
        drawingSaturation={drawingSaturation}
        setDrawingSaturation={setDrawingSaturation}
        drawingBrightness={drawingBrightness}
        setDrawingBrightness={setDrawingBrightness}
        stencilBrightness={stencilBrightness}
        setStencilBrightness={setStencilBrightness}
        isColorLinked={isColorLinked}
        setIsColorLinked={setIsColorLinked}
        activeLayer={activeLayer}
        setActiveLayer={setActiveLayer}
        stageRef={stageRef}
        originalImage={originalImg}
        stencilImage={filteredStencilImg || stencilImg}
        drawingLines={drawingLines}
        onClose={() => setIsLayersOpen(false)}
      />
    </div>
  );
}