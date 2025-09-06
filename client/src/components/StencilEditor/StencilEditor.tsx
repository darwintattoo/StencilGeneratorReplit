import React, { useState, useRef, useEffect } from 'react';
import { useLocation } from 'wouter';
import Canvas from './Canvas';
import LayerPanel from './LayerPanel';
import Toolbar from './Toolbar';

// Colores disponibles para el dibujo - solo negro, rojo y azul
const DRAWING_COLORS = [
  '#000000', // Negro
  '#ef4444', // Rojo
  '#3b82f6', // Azul
];

// Hook personalizado para manejar la lógica del canvas
function useStencilCanvas() {
  const [tool, setTool] = useState<'brush' | 'eraser' | 'move'>('brush');
  const [brushSize, setBrushSize] = useState(4);
  const [eraserSize, setEraserSize] = useState(10);
  const [activeLayer, setActiveLayer] = useState<'drawing' | 'stencil'>('drawing');
  const [brushColor, setBrushColor] = useState('#ef4444'); // Rojo por defecto
  const [stencilHue, setStencilHue] = useState(0); // Control de tono para stencil
  const [layers, setLayers] = useState({
    drawing: { visible: true, opacity: 100 },
    stencil: { visible: true, opacity: 100 },
    original: { visible: true, opacity: 20 }
  });
  const [viewTransform, setViewTransform] = useState({
    x: 0,
    y: 0,
    scale: 1
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

  const handleGesture = (type: 'pan' | 'pinch', data: any) => {
    if (type === 'pan') {
      setViewTransform(prev => ({
        ...prev,
        x: prev.x + data.deltaX,
        y: prev.y + data.deltaY
      }));
    } else if (type === 'pinch') {
      const newScale = Math.max(0.1, Math.min(5, data.scale));
      setViewTransform(prev => ({
        ...prev,
        scale: newScale,
        x: data.centerX - (data.centerX - prev.x) * (newScale / prev.scale),
        y: data.centerY - (data.centerY - prev.y) * (newScale / prev.scale)
      }));
    }
  };

  const resetView = () => {
    setViewTransform({ x: 0, y: 0, scale: 1 });
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
  const stageRef = useRef<any>(null);
  const [originalImg, setOriginalImg] = useState<HTMLImageElement | null>(null);
  const [stencilImg, setStencilImg] = useState<HTMLImageElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [lines, setLines] = useState<any[]>([]);
  const [nativeSize, setNativeSize] = useState({ width: 800, height: 600 });
  const [isPanning, setIsPanning] = useState(false);
  const [lastPointerPosition, setLastPointerPosition] = useState({ x: 0, y: 0 });
  const [isLayersOpen, setIsLayersOpen] = useState(false);
  const [touches, setTouches] = useState<Touch[]>([]);
  const [lastPinchDistance, setLastPinchDistance] = useState(0);
  const [lastTouchCenter, setLastTouchCenter] = useState({ x: 0, y: 0 });
  const [stencilCanvas, setStencilCanvas] = useState<HTMLCanvasElement | null>(null);
  const [isErasingStencil, setIsErasingStencil] = useState(false);
  const [filteredStencilImg, setFilteredStencilImg] = useState<HTMLImageElement | null>(null);

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
    layers,
    toggleLayer,
    setOpacity,
    viewTransform,
    handleGesture,
    resetView
  } = useStencilCanvas();

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

  // Aplicar filtro de tono al stencil
  useEffect(() => {
    if (stencilImg) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (ctx) {
        canvas.width = stencilImg.width;
        canvas.height = stencilImg.height;
        
        // Dibujar imagen original
        ctx.drawImage(stencilImg, 0, 0);
        
        if (stencilHue !== 0) {
          // Obtener datos de píxeles
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
          const data = imageData.data;
          
          // Aplicar transformación de tono
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            
            // Convertir RGB a HSL
            const [h, s, l] = rgbToHsl(r, g, b);
            
            // Aplicar cambio de tono
            const newH = (h + stencilHue / 360) % 1;
            
            // Convertir de vuelta a RGB
            const [newR, newG, newB] = hslToRgb(newH, s, l);
            
            data[i] = newR;
            data[i + 1] = newG;
            data[i + 2] = newB;
          }
          
          // Aplicar datos modificados
          ctx.putImageData(imageData, 0, 0);
        }
        
        // Crear nueva imagen
        const newImg = new Image();
        newImg.onload = () => {
          setFilteredStencilImg(newImg);
        };
        newImg.src = canvas.toDataURL();
      }
    }
  }, [stencilImg, stencilHue]);

  // Funciones de conversión de color
  const rgbToHsl = (r: number, g: number, b: number): [number, number, number] => {
    r /= 255;
    g /= 255;
    b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h = 0, s = 0, l = (max + min) / 2;

    if (max !== min) {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
      switch (max) {
        case r: h = (g - b) / d + (g < b ? 6 : 0); break;
        case g: h = (b - r) / d + 2; break;
        case b: h = (r - g) / d + 4; break;
      }
      h /= 6;
    }
    return [h, s, l];
  };

  const hslToRgb = (h: number, s: number, l: number): [number, number, number] => {
    let r, g, b;
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
    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
  };

  // Manejo de gestos táctiles y mouse
  const handleMouseDown = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();
    
    if (tool === 'move' || e.evt.button === 1 || e.evt.button === 2) { // Move tool, middle click or right click for panning
      e.evt.preventDefault();
      setIsPanning(true);
      setLastPointerPosition(pos);
      return;
    }

    if (tool === 'brush' || tool === 'eraser') {
      setIsDrawing(true);
      const adjustedPos = {
        x: (pos.x - viewTransform.x) / viewTransform.scale,
        y: (pos.y - viewTransform.y) / viewTransform.scale
      };

      // Si es borrador en capa stencil, preparar canvas para edición
      if (tool === 'eraser' && activeLayer === 'stencil' && stencilImg) {
        setIsErasingStencil(true);
        
        // Crear canvas de trabajo si no existe
        if (!stencilCanvas) {
          const canvas = document.createElement('canvas');
          canvas.width = stencilImg.width;
          canvas.height = stencilImg.height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(stencilImg, 0, 0);
            setStencilCanvas(canvas);
          }
        }
        
        // Aplicar borrado inicial
        if (stencilCanvas) {
          const ctx = stencilCanvas.getContext('2d');
          if (ctx) {
            ctx.save();
            ctx.globalCompositeOperation = 'destination-out';
            ctx.beginPath();
            ctx.arc(adjustedPos.x, adjustedPos.y, eraserSize, 0, 2 * Math.PI);
            ctx.fill();
            ctx.restore();
          }
        }
        return;
      }
      
      const newLine = {
        tool,
        points: [adjustedPos.x, adjustedPos.y],
        strokeWidth: tool === 'brush' ? brushSize : eraserSize,
        globalCompositeOperation: tool === 'eraser' ? 'destination-out' : 'source-over',
        layer: activeLayer,
        color: tool === 'brush' ? brushColor : '#ffffff'
      };
      setLines([...lines, newLine]);
    }
  };

  const handleMouseMove = (e: any) => {
    const stage = e.target.getStage();
    const pos = stage.getPointerPosition();

    if (isPanning) {
      const deltaX = pos.x - lastPointerPosition.x;
      const deltaY = pos.y - lastPointerPosition.y;
      handleGesture('pan', { deltaX, deltaY });
      setLastPointerPosition(pos);
      return;
    }

    if (!isDrawing) return;
    
    const adjustedPos = {
      x: (pos.x - viewTransform.x) / viewTransform.scale,
      y: (pos.y - viewTransform.y) / viewTransform.scale
    };

    // Si es borrador en capa stencil, usar técnica de borrado inmediato ultra-rápido
    if (tool === 'eraser' && activeLayer === 'stencil' && stencilCanvas && isErasingStencil) {
      const ctx = stencilCanvas.getContext('2d');
      
      if (ctx) {
        // Borrado inmediato sin operaciones bloqueantes
        ctx.globalCompositeOperation = 'destination-out';
        ctx.fillStyle = '#000';
        
        // Borrado instantáneo con mínimo procesamiento
        ctx.beginPath();
        ctx.arc(adjustedPos.x, adjustedPos.y, eraserSize, 0, 2 * Math.PI);
        ctx.fill();
        
        // Sin restaurar contexto durante movimiento para máxima velocidad
      }
      return;
    }
    
    const newLines = [...lines];
    const lastLine = newLines[newLines.length - 1];
    lastLine.points = lastLine.points.concat([adjustedPos.x, adjustedPos.y]);
    setLines(newLines);
  };

  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsPanning(false);

    
    // Finalizar borrado de stencil con restauración del contexto
    if (isErasingStencil && stencilCanvas) {
      // Restaurar contexto una sola vez al final
      const ctx = stencilCanvas.getContext('2d');
      if (ctx) {
        ctx.globalCompositeOperation = 'source-over'; // Restaurar modo normal
      }
      
      // Actualización diferida para no bloquear
      setTimeout(() => {
        const newImg = new Image();
        newImg.onload = () => {
          setStencilImg(newImg);
          if (stencilHue !== 0) {
            setFilteredStencilImg(null);
          }
        };
        newImg.src = stencilCanvas.toDataURL();
      }, 0);
      setIsErasingStencil(false);
    }
    
    if (tool === 'eraser' && stageRef.current) {
      setTimeout(() => {
        if (stageRef.current) {
          const layers = stageRef.current.find('Layer');
          layers.forEach((layer: any) => {
            try {
              const hitCanvas = layer.getHitCanvas();
              if (hitCanvas) {
                const hitContext = hitCanvas.getContext('2d');
                hitContext.clearRect(0, 0, nativeSize.width, nativeSize.height);
                layer.clearHitCache();
              }
            } catch (e) {
              console.log('Error limpiando hit canvas:', e);
            }
            layer.batchDraw();
          });
          stageRef.current.batchDraw();
        }
      }, 50);
    }
  };

  const handleWheel = (e: any) => {
    e.evt.preventDefault();
    const scaleBy = 1.1;
    const stage = e.target.getStage();
    const oldScale = viewTransform.scale;
    const pointer = stage.getPointerPosition();

    const newScale = e.evt.deltaY > 0 ? oldScale / scaleBy : oldScale * scaleBy;
    handleGesture('pinch', {
      scale: Math.max(0.1, Math.min(5, newScale)),
      centerX: pointer.x,
      centerY: pointer.y
    });
  };

  // Funciones para gestos táctiles
  const getDistance = (touch1: Touch, touch2: Touch) => {
    const dx = touch1.clientX - touch2.clientX;
    const dy = touch1.clientY - touch2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const getCenter = (touch1: Touch, touch2: Touch) => {
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  };

  const handleTouchStart = (e: any) => {
    const touchList = Array.from(e.evt.touches) as Touch[];
    setTouches(touchList);

    if (touchList.length === 2) {
      // Inicio de pinch
      const distance = getDistance(touchList[0], touchList[1]);
      const center = getCenter(touchList[0], touchList[1]);
      setLastPinchDistance(distance);
      setLastTouchCenter(center);
      setIsPanning(false);
      setIsDrawing(false);
    } else if (touchList.length === 1) {
      // Toque único - dibujo o pan
      handleMouseDown(e);
    }
  };

  const handleTouchMove = (e: any) => {
    e.evt.preventDefault();
    const touchList = Array.from(e.evt.touches) as Touch[];

    if (touchList.length === 2) {
      // Pinch zoom y pan con dos dedos
      const distance = getDistance(touchList[0], touchList[1]);
      const center = getCenter(touchList[0], touchList[1]);

      if (lastPinchDistance > 0) {
        // Zoom
        const scale = distance / lastPinchDistance;
        const newScale = Math.max(0.1, Math.min(5, viewTransform.scale * scale));
        
        // Pan
        const deltaX = center.x - lastTouchCenter.x;
        const deltaY = center.y - lastTouchCenter.y;

        handleGesture('pinch', {
          scale: newScale,
          centerX: center.x,
          centerY: center.y
        });

        handleGesture('pan', { deltaX, deltaY });
      }

      setLastPinchDistance(distance);
      setLastTouchCenter(center);
    } else if (touchList.length === 1 && (tool === 'brush' || tool === 'eraser') && isDrawing) {
      // Dibujo con un dedo
      handleMouseMove(e);
    }
  };

  const handleTouchEnd = (e: any) => {
    const touchList = Array.from(e.evt.touches) as Touch[];
    setTouches(touchList);

    if (touchList.length < 2) {
      setLastPinchDistance(0);
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
    <div className="h-screen bg-gray-100 relative flex">
      {/* Canvas principal */}
      <div className="flex-1 relative">
        <Canvas
          stageRef={stageRef}
          isLayersOpen={isLayersOpen}
          viewTransform={viewTransform}
          handleMouseDown={handleMouseDown}
          handleMouseMove={handleMouseMove}
          handleMouseUp={handleMouseUp}
          handleWheel={handleWheel}
          handleTouchStart={handleTouchStart}
          handleTouchMove={handleTouchMove}
          handleTouchEnd={handleTouchEnd}
          handleDoubleTap={handleDoubleTap}
          layers={layers}
          originalImg={originalImg}
          stencilImg={stencilImg}
          filteredStencilImg={filteredStencilImg}
          lines={lines}
          brushColor={brushColor}
          tool={tool}
          brushSize={brushSize}
          setBrushSize={setBrushSize}
          eraserSize={eraserSize}
          setEraserSize={setEraserSize}
          nativeSize={nativeSize}
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
        onClose={() => setIsLayersOpen(false)}
      />
    </div>
  );
}