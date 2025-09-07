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
  KonvaMouseEvent,
  KonvaTouchEvent,
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
  const [eyedropperPosition, setEyedropperPosition] = useState<Position | null>(null);
  const [previewColor, setPreviewColor] = useState<string | null>('#ffffff');
  const throttleTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
  const touchesRef = useRef<Touch[]>([]);
  const lastPinchDistanceRef = useRef<number>(0);
  const lastTouchCenterRef = useRef<TouchCenter>({ x: 0, y: 0 });
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
    // Priorizar imagen filtrada si existe, sino usar original
    const sourceImg = filteredStencilImg || stencilImg;
    if (!sourceImg) return '#ffffff';
    
    try {
      // Crear canvas temporal para muestreo rápido
      const canvas = document.createElement('canvas');
      canvas.width = sourceImg.width;
      canvas.height = sourceImg.height;
      const ctx = canvas.getContext('2d');
      
      if (!ctx) return '#ffffff';
      ctx.drawImage(sourceImg, 0, 0);
      
      // Clampear coordenadas
      const clampedX = Math.max(0, Math.min(sourceImg.width - 1, Math.round(x)));
      const clampedY = Math.max(0, Math.min(sourceImg.height - 1, Math.round(y)));
      
      const { data } = ctx.getImageData(clampedX, clampedY, 1, 1);
      const r = data[0];
      const g = data[1];
      const b = data[2];
      const a = data[3];
      
      // Si es transparente o blanco puro, mantener blanco
      if (a < 128 || (r > 240 && g > 240 && b > 240)) {
        return '#ffffff';
      }
      
      return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, '0')}`;
    } catch (error) {
      return '#ffffff';
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

  // Manejo de gestos táctiles y mouse
  const handleMouseDown = (e: KonvaMouseEvent | KonvaTouchEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;
    
    const mouseEvent = e.evt as MouseEvent;
    if (tool === 'move' || mouseEvent.button === 1 || mouseEvent.button === 2) { // Move tool, middle click or right click for panning
      e.evt.preventDefault();
      setIsPanning(true);
      setLastPointerPosition(pos);
      return;
    }

    if (tool === 'eyedropper') {
      e.evt.preventDefault();
      
      // Obtener posición transformada para picking
      const transform = stage.getAbsoluteTransform().copy().invert();
      const { x, y } = transform.point(pos);
      
      // Seleccionar color y cambiar a brush
      const picked = pickColorAt(x, y);
      if (picked) {
        setBrushColor(picked);
      }
      
      // Limpiar preview y cambiar herramienta
      setEyedropperPosition(null);
      setPreviewColor(null);
      setTool('brush');
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      // Ignorar gestos de dibujo/borrado si el pointerType es 'touch'
      const pointerEvent = e.evt as any;
      if (pointerEvent.pointerType === 'touch') {
        return;
      }

      const transform = stage.getAbsoluteTransform().copy().invert();
      const point = transform.point(pos);
      const x = Math.max(0, Math.min(nativeSize.width, point.x));
      const y = Math.max(0, Math.min(nativeSize.height, point.y));

      // Alt+click para gotero
      if (mouseEvent.altKey) {
        const picked = pickColorAt(x, y);
        if (picked) {
          setBrushColor(picked);
        }
        return;
      }

      setIsDrawing(true);

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

  const handleMouseMove = (e: KonvaMouseEvent | KonvaTouchEvent) => {
    const stage = stageRef.current;
    if (!stage) return;
    const pos = stage.getPointerPosition();
    if (!pos) return;

    // Preview del eyedropper con throttling
    if (tool === 'eyedropper' && !isPanning) {
      setEyedropperPosition(pos);
      
      // Throttle el picking de colores para mejor rendimiento
      if (throttleTimeoutRef.current) {
        clearTimeout(throttleTimeoutRef.current);
      }
      
      throttleTimeoutRef.current = setTimeout(() => {
        const transform = stage.getAbsoluteTransform().copy().invert();
        const { x, y } = transform.point(pos);
        const color = pickColorAt(x, y);
        setPreviewColor(color);
      }, 16); // ~60fps throttling
      
      return;
    }

    if (isPanning) {
      const deltaX = pos.x - lastPointerPosition.x;
      const deltaY = pos.y - lastPointerPosition.y;
      handleGesture('pan', { deltaX, deltaY });
      setLastPointerPosition(pos);
      return;
    }

    if (!isDrawing) return;
    
    // Ignorar gestos de dibujo/borrado si el pointerType es 'touch'
    const pointerEvent = e.evt as any;
    if (pointerEvent.pointerType === 'touch') {
      return;
    }
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

  const handleMouseUp = () => {
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

  const handleMouseEnter = () => {
    if (tool === 'eyedropper') {
      document.body.style.cursor = 'none'; // Ocultar cursor por defecto
    }
  };

  const handleMouseLeave = () => {
    if (tool === 'eyedropper') {
      setEyedropperPosition(null);
      setPreviewColor('#ffffff');
      document.body.style.cursor = 'auto'; // Restaurar cursor
    }
  };

  // Limpiar cursor cuando cambie herramienta
  useEffect(() => {
    if (tool !== 'eyedropper') {
      setEyedropperPosition(null);
      setPreviewColor('#ffffff');
      document.body.style.cursor = 'auto';
    } else {
      // Inicializar con blanco cuando se selecciona eyedropper
      setPreviewColor('#ffffff');
    }
  }, [tool]);

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

  // Funciones para gestos táctiles
  const getDistance = (touch1: Touch, touch2: Touch): number => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touch1: Touch, touch2: Touch): TouchCenter => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const getAngle = (touch1: Touch, touch2: Touch): number => {
    const dx = touch2.clientX - touch1.clientX;
    const dy = touch2.clientY - touch1.clientY;
    return (Math.atan2(dy, dx) * 180) / Math.PI;
  };

  const handleTouchStart = (e: KonvaTouchEvent) => {
    const touchList = Array.from(e.evt.touches) as Touch[];
    touchesRef.current = touchList;

    if (touchList.length === 2) {
      // Inicio de pinch/rotación
      const distance = getDistance(touchList[0], touchList[1]);
      const center = getCenter(touchList[0], touchList[1]);
      const angle = getAngle(touchList[0], touchList[1]);
      lastPinchDistanceRef.current = distance;
      lastTouchCenterRef.current = center;
      lastAngleRef.current = angle;
      setIsPanning(false);
      setIsDrawing(false);
    } else if (touchList.length === 1) {
      // Toque único - dibujo o pan
      handleMouseDown(e);
    }
  };

  const handleTouchMove = (e: KonvaTouchEvent) => {
    e.evt.preventDefault();
    const touchList = Array.from(e.evt.touches) as Touch[];
    touchesRef.current = touchList;

    if (touchList.length === 2) {
      // Pinch zoom, pan y rotación con dos dedos
      const distance = getDistance(touchList[0], touchList[1]);
      const center = getCenter(touchList[0], touchList[1]);
      const angle = getAngle(touchList[0], touchList[1]);

      if (lastPinchDistanceRef.current > 0) {
        // Zoom
        const scale = distance / lastPinchDistanceRef.current;
        const newScale = Math.max(0.1, Math.min(5, viewTransform.scale * scale));
        
        // Pan
        const deltaX = center.x - lastTouchCenterRef.current.x;
        const deltaY = center.y - lastTouchCenterRef.current.y;

        // Rotación
        const deltaRotation = angle - lastAngleRef.current;

        handleGesture('pinch', {
          scale: newScale,
          centerX: center.x,
          centerY: center.y
        });

        handleGesture('pan', { deltaX, deltaY });
        handleGesture('rotate', {
          deltaRotation,
          centerX: center.x,
          centerY: center.y
        });
      }

      lastPinchDistanceRef.current = distance;
      lastTouchCenterRef.current = center;
      lastAngleRef.current = angle;
    } else if (touchList.length === 1 && (tool === 'brush' || tool === 'eraser') && isDrawing) {
      // Dibujo con un dedo
      handleMouseMove(e);
    }
  };

  const handleTouchEnd = (e: KonvaTouchEvent) => {
    const touchList = Array.from(e.evt.touches) as Touch[];
    touchesRef.current = touchList;

    if (touchList.length < 2) {
      lastPinchDistanceRef.current = 0;
      lastAngleRef.current = 0;
    }

    if (touchList.length === 0) {
      handleMouseUp();
    }
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
          handleMouseDown={handleMouseDown}
          handleMouseMove={handleMouseMove}
          handleMouseUp={handleMouseUp}
          handleMouseEnter={handleMouseEnter}
          handleMouseLeave={handleMouseLeave}
          handleWheel={handleWheel}
          handleTouchStart={handleTouchStart}
          handleTouchMove={handleTouchMove}
          handleTouchEnd={handleTouchEnd}
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
          eyedropperPosition={eyedropperPosition}
          previewColor={previewColor}
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