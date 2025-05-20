import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { Stage, Layer, Image, Line, Group, Rect } from 'react-konva';
import { KonvaEventObject } from 'konva/lib/Node';
import Konva from 'konva';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { 
  Brush, 
  Eraser, 
  Undo2, 
  Redo2, 
  Download, 
  Save,
  ImageDown,
  ZoomIn,
  ZoomOut,
  Move
} from 'lucide-react';
import { useLanguage } from '@/hooks/use-language';
import { saveAs } from 'file-saver';

// Extensión de los tipos de Konva para propiedades personalizadas
declare module 'konva/lib/Stage' {
  interface Stage {
    touchDistance?: number;
    lastTouchClientX?: number;
    lastTouchClientY?: number;
    lastMousePos?: {
      x: number;
      y: number;
    };
  }
}

// Tipo para los trazos de pincel
interface Line {
  tool: 'brush' | 'eraser';
  points: number[];
  color: string;
  strokeWidth: number;
}

interface StencilEditorProps {
  originalImage: string;
  stencilImage: string;
  onSave?: (editedImageUrl: string) => void;
}

export default function StencilEditor({ originalImage, stencilImage, onSave }: StencilEditorProps) {
  const { t } = useLanguage();
  const { toast } = useToast();
  
  // Referencias a los elementos de canvas
  const stageRef = useRef<Konva.Stage | null>(null);
  const stencilImageRef = useRef<Konva.Image | null>(null);
  
  // Estado para las imágenes
  const [originalImageObj, setOriginalImageObj] = useState<HTMLImageElement | null>(null);
  const [stencilImageObj, setStencilImageObj] = useState<HTMLImageElement | null>(null);
  
  // Estados para la herramienta de dibujo
  const [tool, setTool] = useState<'brush' | 'eraser'>('brush');
  const [lines, setLines] = useState<Line[]>([]);
  const [undoHistory, setUndoHistory] = useState<Line[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Line[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(2);
  const [brushColor, setBrushColor] = useState('#ff0000');
  
  // Estados para controlar las capas
  const [originalLayerOpacity, setOriginalLayerOpacity] = useState(0.3);
  const [originalLayerVisible, setOriginalLayerVisible] = useState(true);
  const [stencilLayerVisible, setStencilLayerVisible] = useState(true);
  
  // Estados para el zoom y movimiento del canvas
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'drawing' | 'panning'>('drawing');
  
  // Estado para puntos temporales (para dibujo más suave)
  const lastPointerPosition = useRef<{ x: number, y: number } | null>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number, y: number } | null>(null);
  
  // Cargar las imágenes cuando los props cambien
  useEffect(() => {
    // Cargar imagen original
    const origImg = new window.Image();
    origImg.crossOrigin = 'anonymous';
    origImg.src = originalImage;
    origImg.onload = () => {
      setOriginalImageObj(origImg);
    };
    
    // Cargar imagen del stencil
    const stencilImg = new window.Image();
    stencilImg.crossOrigin = 'anonymous';
    stencilImg.src = stencilImage;
    stencilImg.onload = () => {
      setStencilImageObj(stencilImg);
    };
  }, [originalImage, stencilImage]);
  
  // Funciones para zoom y movimiento del canvas
  const handleWheel = (e: KonvaEventObject<WheelEvent>) => {
    e.evt.preventDefault();
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    const oldScale = scale;
    const pointer = stage.getPointerPosition();
    if (!pointer) return;
    
    const mousePointTo = {
      x: (pointer.x - position.x) / oldScale,
      y: (pointer.y - position.y) / oldScale,
    };
    
    // Ajuste de zoom con la rueda
    const newScale = e.evt.deltaY < 0 ? oldScale * 1.1 : oldScale / 1.1;
    
    // Limitar el zoom mínimo y máximo
    const limitedScale = Math.max(0.1, Math.min(newScale, 10));
    
    setScale(limitedScale);
    
    const newPos = {
      x: pointer.x - mousePointTo.x * limitedScale,
      y: pointer.y - mousePointTo.y * limitedScale,
    };
    
    setPosition(newPos);
  };
  
  // Función para calcular la posición exacta con cualquier entrada (mouse o touch)
  const getRelativePointerPosition = (evt: MouseEvent | Touch) => {
    if (!stageRef.current) return null;
    
    const stage = stageRef.current;
    // Obtener el rectángulo del contenedor para coordenadas precisas
    const rect = stage.container().getBoundingClientRect();
    
    // Calcular coordenadas relativas al contenedor
    const pointX = evt.clientX - rect.left;
    const pointY = evt.clientY - rect.top;
    
    // Convertir a coordenadas del canvas ajustando escala y posición
    return {
      x: (pointX - position.x) / scale,
      y: (pointY - position.y) / scale
    };
  };
  
  // Función para calcular el centro y distancia en gestos multitáctiles
  const getMultitouchCenter = (touch1: Touch, touch2: Touch) => {
    const stage = stageRef.current;
    if (!stage) return null;
    
    const rect = stage.container().getBoundingClientRect();
    return {
      x: (touch1.clientX + touch2.clientX) / 2 - rect.left,
      y: (touch1.clientY + touch2.clientY) / 2 - rect.top,
      distance: Math.sqrt(
        Math.pow(touch2.clientX - touch1.clientX, 2) +
        Math.pow(touch2.clientY - touch1.clientY, 2)
      )
    };
  };
  
  // Función para manejar gestos táctiles con enfoque Procreate
  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    if (!stageRef.current) return;
    const stage = stageRef.current;
    
    // Si estamos dibujando con un dedo
    if (mode === 'drawing' && isDrawing && e.evt.touches.length === 1) {
      const touch = e.evt.touches[0];
      const pointerPos = getRelativePointerPosition(touch);
      if (!pointerPos) return;
      
      // Obtener la última línea
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;
      
      // Calcular la distancia desde el último punto
      if (lastPointerPosition.current) {
        const dx = pointerPos.x - lastPointerPosition.current.x;
        const dy = pointerPos.y - lastPointerPosition.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Si la distancia es significativa, añadir puntos intermedios para suavizar
        if (distance > 5) {
          // Usar más puntos para el borrador para asegurar borrado completo
          const steps = tool === 'eraser' ? Math.ceil(distance / 1.5) : Math.floor(distance / 2);
          
          for (let i = 1; i <= steps; i++) {
            const ratio = i / steps;
            const x = lastPointerPosition.current.x + dx * ratio;
            const y = lastPointerPosition.current.y + dy * ratio;
            lastLine.points = lastLine.points.concat([x, y]);
          }
        } else {
          // Si no, añadir el punto actual
          lastLine.points = lastLine.points.concat([pointerPos.x, pointerPos.y]);
        }
      } else {
        // Si no hay posición anterior, simplemente añadir el punto
        lastLine.points = lastLine.points.concat([pointerPos.x, pointerPos.y]);
      }
      
      // Guardar la posición actual para la próxima vez
      lastPointerPosition.current = pointerPos;
      
      // Actualizar el estado de inmediato para ver el trazo en tiempo real
      setLines([...lines.slice(0, -1), lastLine]);
      return;
    }
    
    // Zoom con dos dedos (pinch-to-zoom)
    if (e.evt.touches.length === 2) {
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      
      // Obtener información del gesto
      const touchInfo = getMultitouchCenter(touch1, touch2);
      if (!touchInfo) return;
      
      // Primera vez del gesto
      if (lastTouchDistance.current === null) {
        lastTouchDistance.current = touchInfo.distance;
        lastTouchCenter.current = { x: touchInfo.x, y: touchInfo.y };
        return;
      }
      
      // Calcular nuevo nivel de zoom
      const newScale = scale * (touchInfo.distance / lastTouchDistance.current);
      const limitedScale = Math.max(0.1, Math.min(newScale, 10));
      
      // Calcular nueva posición centrada en el punto de pellizco
      const mousePointTo = {
        x: (touchInfo.x - position.x) / scale,
        y: (touchInfo.y - position.y) / scale,
      };
      
      const newPos = {
        x: touchInfo.x - mousePointTo.x * limitedScale,
        y: touchInfo.y - mousePointTo.y * limitedScale,
      };
      
      // Actualizar estado
      setScale(limitedScale);
      setPosition(newPos);
      
      // Guardar valores para el próximo evento
      lastTouchDistance.current = touchInfo.distance;
      lastTouchCenter.current = { x: touchInfo.x, y: touchInfo.y };
      return;
    }
    
    // Movimiento (panning) con un dedo en modo movimiento
    if (mode === 'panning' && isDragging && e.evt.touches.length === 1) {
      const touch = e.evt.touches[0];
      
      if (lastPointerPosition.current) {
        const newPosition = {
          x: position.x + (touch.clientX - lastPointerPosition.current.x),
          y: position.y + (touch.clientY - lastPointerPosition.current.y),
        };
        
        setPosition(newPosition);
      }
      
      // Actualizar posición para el próximo evento
      const rect = stage.container().getBoundingClientRect();
      lastPointerPosition.current = {
        x: touch.clientX,
        y: touch.clientY
      };
    }
  }, [isDrawing, lines, position, scale, mode, isDragging]);

  // Función para manejar el inicio de toques táctiles en estilo Procreate
  const handleTouchStart = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    if (!stageRef.current) return;
    
    // Limpiar el último punto de referencia para dibujo suave
    lastPointerPosition.current = null;
    
    // Si hay un solo toque
    if (e.evt.touches.length === 1) {
      const touch = e.evt.touches[0];
      const pointerPos = getRelativePointerPosition(touch);
      if (!pointerPos) return;
      
      // Si estamos en modo dibujo
      if (mode === 'drawing') {
        setIsDrawing(true);
        
        // Crear una nueva línea con el tamaño adecuado para el borrador o pincel
        const effectiveSize = tool === 'eraser' ? brushSize * 3 : brushSize;
        
        const newLine: Line = {
          tool,
          points: [pointerPos.x, pointerPos.y],
          color: tool === 'brush' ? brushColor : '#ffffff', // Blanco para el borrador
          strokeWidth: effectiveSize
        };
        
        // Guardar posición para suavizado de trazos
        lastPointerPosition.current = pointerPos;
        
        // Actualizar estado
        setLines([...lines, newLine]);
        setUndoHistory([...undoHistory, [...lines]]);
        setRedoHistory([]);
      } else if (mode === 'panning') {
        // Modo de navegación: estamos empezando a mover el canvas
        setIsDragging(true);
        
        // Guardar la posición inicial para calcular el desplazamiento
        lastPointerPosition.current = {
          x: touch.clientX,
          y: touch.clientY
        };
      }
    } 
    // Si hay dos toques, preparar para zoom (estilo pellizco)
    else if (e.evt.touches.length === 2) {
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      
      // Obtener información inicial del gesto
      const touchInfo = getMultitouchCenter(touch1, touch2);
      if (!touchInfo) return;
      
      // Guardar valores iniciales para calcular el zoom
      lastTouchDistance.current = touchInfo.distance;
      lastTouchCenter.current = { x: touchInfo.x, y: touchInfo.y };
    }
  }, [mode, tool, brushSize, brushColor, lines, undoHistory, position, scale]);

  // Función para manejar el final de toques táctiles
  const handleTouchEnd = useCallback(() => {
    // Finalizar los estados de dibujo y arrastre
    setIsDrawing(false);
    setIsDragging(false);
    
    // Limpiar referencias temporales para pinch-to-zoom
    lastTouchDistance.current = null;
    lastTouchCenter.current = null;
    lastPointerPosition.current = null;
  }, []);
  
  // Función para comenzar a dibujar (mouse)
  const handleMouseDown = (e: KonvaEventObject<MouseEvent>) => {
    if (mode !== 'drawing') return;
    
    setIsDrawing(true);
    const stage = e.target.getStage();
    if (!stage) return;
    
    // Obtener posición exacta del ratón relativa al contenedor
    const rect = stage.container().getBoundingClientRect();
    const mouseX = e.evt.clientX - rect.left;
    const mouseY = e.evt.clientY - rect.top;
    
    // Convertir a coordenadas del canvas (ajustando por la escala y posición)
    const adjustedPoint = {
      x: (mouseX - position.x) / scale,
      y: (mouseY - position.y) / scale
    };
    
    // Aumentar el tamaño del borrador para que borre más rápido y sea más eficiente
    const effectiveSize = tool === 'eraser' ? brushSize * 2.5 : brushSize;
    
    const newLine: Line = {
      tool,
      points: [adjustedPoint.x, adjustedPoint.y],
      color: tool === 'brush' ? brushColor : '#ffffff', // Blanco para el borrador
      strokeWidth: effectiveSize
    };
    
    setLines([...lines, newLine]);
    setUndoHistory([...undoHistory, [...lines]]);
    setRedoHistory([]);
  };
  
  // Función para continuar dibujando (mouse)
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    // Si estamos en modo movimiento, manejar desplazamiento del canvas
    if (mode === 'panning' && isDragging) {
      const stage = e.target.getStage();
      if (!stage) return;
      
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos || !stage.lastMousePos) return;
      
      const dx = pointerPos.x - stage.lastMousePos.x;
      const dy = pointerPos.y - stage.lastMousePos.y;
      
      setPosition({
        x: position.x + dx,
        y: position.y + dy
      });
      
      stage.lastMousePos = pointerPos;
      return;
    }
    
    // Si estamos en modo dibujo, manejar el dibujo
    if (mode === 'drawing' && isDrawing) {
      const stage = e.target.getStage();
      if (!stage) return;
      
      // Obtener posición exacta del ratón relativa al contenedor
      const rect = stage.container().getBoundingClientRect();
      const mouseX = e.evt.clientX - rect.left;
      const mouseY = e.evt.clientY - rect.top;
      
      // Convertir a coordenadas del canvas (ajustando por la escala y posición)
      const point = {
        x: (mouseX - position.x) / scale,
        y: (mouseY - position.y) / scale
      };
      
      const lastLine = lines[lines.length - 1];
      if (!lastLine) return;
      
      // Para el borrador, mejorar la densidad de puntos para un borrado más completo
      if (tool === 'eraser') {
        // Obtener el último punto registrado
        const len = lastLine.points.length;
        if (len >= 2) {
          const prevX = lastLine.points[len - 2];
          const prevY = lastLine.points[len - 1];
          
          // Calculamos la distancia entre el punto anterior y el actual
          const dx = point.x - prevX;
          const dy = point.y - prevY;
          const distance = Math.sqrt(dx * dx + dy * dy);
          
          // Si hay una distancia significativa, interpolamos puntos intermedios
          // para asegurar un borrado continuo y completo
          if (distance > 5) {
            const steps = Math.ceil(distance / 2); // Más puntos = borrado más completo
            for (let i = 1; i < steps; i++) {
              const ratio = i / steps;
              const x = prevX + dx * ratio;
              const y = prevY + dy * ratio;
              lastLine.points = lastLine.points.concat([x, y]);
            }
          }
        }
      }
      
      lastLine.points = lastLine.points.concat([point.x, point.y]);
      
      // Actualizar inmediatamente para mayor precisión
      setLines([...lines.slice(0, -1), lastLine]);
    }
  };
  
  // Función para terminar de dibujar o mover
  const handleMouseUp = () => {
    setIsDrawing(false);
    setIsDragging(false);
  };
  
  // Función para comenzar a mover el canvas
  const handleDragStart = (e: KonvaEventObject<MouseEvent>) => {
    if (mode !== 'panning') return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    setIsDragging(true);
    const pos = stage.getPointerPosition();
    if (pos) {
      stage.lastMousePos = pos;
    }
  };
  
  // Función para deshacer
  const handleUndo = () => {
    if (undoHistory.length === 0) return;
    
    const previousLines = undoHistory[undoHistory.length - 1];
    setRedoHistory([...redoHistory, [...lines]]);
    setLines(previousLines);
    setUndoHistory(undoHistory.slice(0, -1));
  };
  
  // Función para rehacer
  const handleRedo = () => {
    if (redoHistory.length === 0) return;
    
    const nextLines = redoHistory[redoHistory.length - 1];
    setUndoHistory([...undoHistory, [...lines]]);
    setLines(nextLines);
    setRedoHistory(redoHistory.slice(0, -1));
  };
  
  // Función para exportar como PNG (solo stencil)
  const exportAsPNG = () => {
    if (!stageRef.current) return;
    
    const uri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    
    saveAs(uri, 'stencil-edited.png');
  };
  
  // Función para exportar como PNG (combinado)
  const exportAsMergedPNG = () => {
    if (!stageRef.current) return;
    
    const uri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    saveAs(uri, 'stencil-merged.png');
  };
  
  // Función para exportar como PSD (simulado para compatibilidad con Procreate)
  const exportAsPSD = () => {
    alert("Esta función exportará un archivo compatible con Procreate que contendrá dos capas: la imagen original y el stencil editado.");
    
    // En una implementación real, aquí generaríamos un PSD con las capas
    // Para este ejercicio, exportamos las dos imágenes por separado
    // y mostramos una instrucción al usuario
    
    if (!stageRef.current) return;
    
    // Exportar la capa del stencil
    const stencilUri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    saveAs(stencilUri, 'stencil-layer.png');
    
    // Exportar la imagen original
    saveAs(originalImage, 'original-layer.png');
    
    // Mensaje con instrucciones
    alert("Se han descargado dos archivos PNG separados: la imagen original y el stencil editado. Puedes importarlos como capas en Procreate para continuar tu trabajo.");
  };
  
  // Guardar la imagen editada
  const saveEditedImage = () => {
    if (!stageRef.current || !onSave) return;
    
    const uri = stageRef.current.toDataURL({
      pixelRatio: 2
    });
    
    onSave(uri);
  };
  
  // Si no tenemos ambas imágenes cargadas, mostramos un indicador de carga
  if (!originalImageObj || !stencilImageObj) {
    return (
      <div className="flex items-center justify-center p-8 bg-black bg-opacity-30 rounded-xl">
        <div className="animate-spin mr-2">
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 12a9 9 0 1 1-6.219-8.56" />
          </svg>
        </div>
        <span>Cargando imágenes...</span>
      </div>
    );
  }
  
  // Usamos el tamaño original sin modificar, pero con manejo mejorado del contenedor
  const width = originalImageObj.width;
  const height = originalImageObj.height;
  
  // Función para verificar si el contenedor necesita scroll
  const containerStyle = {
    maxWidth: '100%',
    maxHeight: '80vh',
    overflow: 'auto'
  };
  
  return (
    <div className="flex flex-col w-full space-y-4">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            variant={tool === 'brush' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('brush')}
          >
            <Brush className="h-4 w-4 mr-1" />
            {t("brush") || "Pincel"}
          </Button>
          <Button
            variant={tool === 'eraser' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setTool('eraser')}
          >
            <Eraser className="h-4 w-4 mr-1" />
            {t("eraser") || "Borrador"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleUndo}
            disabled={undoHistory.length === 0}
          >
            <Undo2 className="h-4 w-4 mr-1" />
            {t("undo") || "Deshacer"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRedo}
            disabled={redoHistory.length === 0}
          >
            <Redo2 className="h-4 w-4 mr-1" />
            {t("redo") || "Rehacer"}
          </Button>
          
          <div className="flex items-center ml-2">
            <label className="text-sm mr-2">{t("size") || "Tamaño"}:</label>
            <input
              type="range"
              min="1"
              max="20"
              value={brushSize}
              onChange={(e) => setBrushSize(parseInt(e.target.value))}
              className="w-24"
            />
            <span className="text-sm ml-1">{brushSize}px</span>
          </div>
          
          {tool === 'brush' && (
            <div className="flex items-center ml-2">
              <label className="text-sm mr-2">{t("color") || "Color"}:</label>
              <input
                type="color"
                value={brushColor}
                onChange={(e) => setBrushColor(e.target.value)}
                className="w-8 h-8 rounded-full cursor-pointer border-none"
              />
            </div>
          )}
        </div>
        
        {/* Panel de control de capas - Ahora en la parte superior con mejor distinción visual */}
        <div className="border border-gray-700 rounded-lg bg-gray-900 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t("layers") || "CAPAS"}</h3>
            
            {/* Control de capa original con mejor contraste visual */}
            <div className="flex items-center gap-2 border border-gray-600 rounded-md p-2 bg-gray-800">
              <span className="h-4 w-4 bg-gray-600 rounded-full inline-block mr-1"></span>
              <label className="text-sm font-medium whitespace-nowrap text-yellow-300">{t("original_image") || "FOTO ORIGINAL"}</label>
              <input
                type="checkbox"
                checked={originalLayerVisible}
                onChange={(e) => setOriginalLayerVisible(e.target.checked)}
                className="h-5 w-5 rounded border-gray-700 text-yellow-400"
              />
              
              {originalLayerVisible && (
                <div className="flex items-center gap-2 ml-2">
                  <label className="text-xs whitespace-nowrap text-yellow-200">{t("opacity") || "Opacidad"}: {Math.round(originalLayerOpacity * 100)}%</label>
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={originalLayerOpacity}
                    onChange={(e) => setOriginalLayerOpacity(parseFloat(e.target.value))}
                    className="w-32"
                  />
                </div>
              )}
            </div>
            
            {/* Control de capa stencil con mejor contraste visual */}
            <div className="flex items-center gap-2 border border-gray-600 rounded-md p-2 bg-gray-800">
              <span className="h-4 w-4 bg-red-500 rounded-full inline-block mr-1"></span>
              <label className="text-sm font-medium whitespace-nowrap text-red-300">{t("stencil") || "STENCIL"}</label>
              <input
                type="checkbox"
                checked={stencilLayerVisible}
                onChange={(e) => setStencilLayerVisible(e.target.checked)}
                className="h-5 w-5 rounded border-gray-700 text-red-400"
              />
            </div>
          </div>
        </div>
        
        {/* Controles de zoom y modo de interacción */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <Button
              variant={mode === 'drawing' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('drawing')}
            >
              <Brush className="h-4 w-4 mr-1" />
              {t("drawing_mode") || "Dibujar"}
            </Button>
            <Button
              variant={mode === 'panning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setMode('panning')}
            >
              <Move className="h-4 w-4 mr-1" />
              {t("move_mode") || "Mover/Zoom"}
            </Button>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setScale(scale * 1.2);
              }}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setScale(Math.max(0.1, scale / 1.2));
              }}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M9 12h6" />
              </svg>
            </Button>
          </div>
        </div>

        {/* Lienzo de edición con mejor manejo de dimensiones */}
        <div className="border border-gray-700 rounded-lg" style={containerStyle}>
          <Stage
            width={width}
            height={height}
            onMouseDown={mode === 'drawing' ? handleMouseDown : handleDragStart}
            onMousemove={handleMouseMove}
            onMouseup={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onWheel={handleWheel}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            ref={stageRef}
            draggable={mode === 'panning'}
          >
            {/* Capa de fondo: imagen original */}
            <Layer name="background">
              {originalLayerVisible && originalImageObj && (
                <Image
                  image={originalImageObj}
                  width={width}
                  height={height}
                  opacity={originalLayerOpacity}
                  listening={false}
                />
              )}
            </Layer>
            
            {/* Capa de stencil */}
            <Layer name="stencil">
              {stencilLayerVisible && stencilImageObj && (
                <Image
                  image={stencilImageObj}
                  width={width}
                  height={height}
                  ref={stencilImageRef}
                  listening={false}
                />
              )}
            </Layer>
            
            {/* Capa de dibujo: todas las líneas de pincel */}
            <Layer name="brushStrokes">
              {lines.filter(line => line.tool === 'brush').map((line, i) => (
                <Line
                  key={`brush-${i}`}
                  points={line.points}
                  stroke={line.color}
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  listening={false}
                />
              ))}
            </Layer>
            
            {/* Capa de borrado */}
            <Layer name="eraser">
              {lines.filter(line => line.tool === 'eraser').map((line, i) => (
                <Line
                  key={`eraser-${i}`}
                  points={line.points}
                  stroke="white"
                  strokeWidth={line.strokeWidth}
                  tension={0.5}
                  lineCap="round"
                  lineJoin="round"
                  globalCompositeOperation="destination-out"
                  listening={false}
                />
              ))}
            </Layer>
            
            {/* Capa para capturar eventos */}
            <Layer name="eventCatcher">
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="rgba(0,0,0,0)"
                listening={true}
              />
            </Layer>
          </Stage>
        </div>
        
        <div className="text-center text-sm text-gray-400">
          {t("use_tools_to_retouch") || "Usa las herramientas para retocar el stencil"}
        </div>
      </div>
      
      <div className="flex flex-wrap gap-2 mt-4">
        <Button variant="outline" onClick={exportAsPNG}>
          <Download className="h-4 w-4 mr-2" />
          {t("export_stencil_png") || "Exportar stencil (PNG)"}
        </Button>
        <Button variant="outline" onClick={exportAsMergedPNG}>
          <ImageDown className="h-4 w-4 mr-2" />
          {t("export_merged_png") || "Exportar combinado (PNG)"}
        </Button>
        {onSave && (
          <Button variant="default" onClick={saveEditedImage}>
            <Save className="h-4 w-4 mr-2" />
            {t("save") || "Guardar"}
          </Button>
        )}
      </div>
    </div>
  );
}