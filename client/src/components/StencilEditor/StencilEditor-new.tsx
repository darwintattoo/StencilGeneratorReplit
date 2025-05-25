import { useState, useRef, useEffect, useCallback } from 'react';
import { Stage, Layer, Image, Line, Rect } from 'react-konva';
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

// Tipo para los trazos de pincel/borrador
interface Line {
  tool: 'brush' | 'eraser';
  points: number[];
  color: string;
  strokeWidth: number;
  affectsStencil?: boolean; // Indica si el trazo debe afectar también a la capa del stencil
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
  // Separamos las líneas por capa para evitar conflictos entre el borrador de stencil y el de dibujo
  const [drawingLines, setDrawingLines] = useState<Line[]>([]);
  const [stencilLines, setStencilLines] = useState<Line[]>([]);
  const [undoHistory, setUndoHistory] = useState<{drawing: Line[][], stencil: Line[][]}>(
    {drawing: [], stencil: []}
  );
  const [redoHistory, setRedoHistory] = useState<{drawing: Line[][], stencil: Line[][]}>(
    {drawing: [], stencil: []}
  );
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(10); 
  const [brushColor, setBrushColor] = useState('#ff0000');
  
  // Estado para determinar la capa objetivo del borrador
  const [eraserTarget, setEraserTarget] = useState<'drawing' | 'stencil'>('drawing');
  // Estado para controlar el panel de ajustes
  const [showToolSettings, setShowToolSettings] = useState(false);
  
  // Variables para rastrear gestos táctiles
  const touchFingerCount = useRef<number>(0);
  const lastPointerPosition = useRef<{ x: number, y: number } | null>(null);
  const lastTouchDistance = useRef<number | null>(null);
  const lastTouchCenter = useRef<{ x: number, y: number } | null>(null);
  
  // Variables para inercia y gestos
  const velocity = useRef<{ x: number, y: number }>({ x: 0, y: 0 });
  const lastPanTime = useRef<number>(0);
  const lastPanPosition = useRef<{ x: number, y: number } | null>(null);
  const animationFrameId = useRef<number | null>(null);
  const isPinching = useRef<boolean>(false);
  const inertiaAnimationId = useRef<number | null>(null);
  
  // Estados para controlar las capas
  const [originalLayerOpacity, setOriginalLayerOpacity] = useState(0.3);
  const [originalLayerVisible, setOriginalLayerVisible] = useState(true);
  const [stencilLayerVisible, setStencilLayerVisible] = useState(true);
  
  // Estados para el zoom y movimiento del canvas
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [mode, setMode] = useState<'drawing' | 'panning'>('drawing');
  
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
  
  // Función para aplicar inercia de desplazamiento
  const applyInertia = useCallback(() => {
    if (!stageRef.current) return;
    
    // Cancelar cualquier animación anterior
    if (inertiaAnimationId.current) {
      cancelAnimationFrame(inertiaAnimationId.current);
    }
    
    // Factores de inercia
    const friction = 0.90; // Reducción por frame (0-1)
    const duration = 400; // Duración máxima en ms
    const startTime = performance.now();
    
    // Velocidad inicial (guardada durante el paneo)
    const initialVelocity = { ...velocity.current };
    
    // Función de animación de inercia
    const animate = (time: number) => {
      const elapsed = time - startTime;
      
      if (elapsed < duration && (Math.abs(velocity.current.x) > 0.1 || Math.abs(velocity.current.y) > 0.1)) {
        // Aplicar fricción
        velocity.current.x *= friction;
        velocity.current.y *= friction;
        
        // Actualizar posición según velocidad
        setPosition(prevPos => ({
          x: prevPos.x + velocity.current.x,
          y: prevPos.y + velocity.current.y
        }));
        
        // Continuar animación
        inertiaAnimationId.current = requestAnimationFrame(animate);
      } else {
        // Detener cuando la velocidad es muy baja o se alcanza el tiempo máximo
        velocity.current = { x: 0, y: 0 };
        inertiaAnimationId.current = null;
      }
    };
    
    // Iniciar animación solo si hay velocidad suficiente
    if (Math.abs(initialVelocity.x) > 1 || Math.abs(initialVelocity.y) > 1) {
      inertiaAnimationId.current = requestAnimationFrame(animate);
    }
  }, []);

  // Función para calcular la distancia entre dos puntos táctiles
  const getDistance = (p1: { x: number, y: number }, p2: { x: number, y: number }): number => {
    return Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
  };

  // Función para calcular el centro entre dos puntos táctiles
  const getCenter = (p1: { x: number, y: number }, p2: { x: number, y: number }): { x: number, y: number } => {
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2
    };
  };

  // Función útil para calcular información de multitáctil
  const getMultitouchCenter = (touch1: Touch, touch2: Touch) => {
    if (!stageRef.current) return null;
    
    const stage = stageRef.current;
    const p1 = {
      x: touch1.clientX,
      y: touch1.clientY
    };
    const p2 = {
      x: touch2.clientX,
      y: touch2.clientY
    };
    
    return {
      x: (p1.x + p2.x) / 2,
      y: (p1.y + p2.y) / 2,
      distance: getDistance(p1, p2)
    };
  };

  // Función para terminar el dibujo
  const endDrawing = useCallback(() => {
    setIsDrawing(false);
    lastPointerPosition.current = null;
  }, []);

  // Función para manejar el inicio de toques táctiles - Con soporte para borrador en capas separadas
  const handleTouchStart = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    if (!stageRef.current) return;
    
    // Reset tracking variables
    lastPointerPosition.current = null;
    
    // Actualizar contador de dedos
    touchFingerCount.current = e.evt.touches.length;
    
    // CASO 1: Un solo dedo en pantalla - modo dibujo o navegación normal
    if (e.evt.touches.length === 1) {
      const touch = e.evt.touches[0];
      const stage = stageRef.current;
      
      // Coordenadas dentro del stage
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
      
      // Convertir a coordenadas reales con el zoom
      const actualPos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };
      
      // Modo dibujo
      if (mode === 'drawing') {
        setIsDrawing(true);
        
        // Tamaño basado en la herramienta
        const effectiveSize = tool === 'eraser' 
          ? eraserSize // Usar el tamaño específico del borrador
          : brushSize;
        
        // Nueva línea con punto inicial duplicado (técnica para puntos individuales)
        const newLine: Line = {
          tool,
          points: [actualPos.x, actualPos.y, actualPos.x, actualPos.y],
          color: tool === 'brush' ? brushColor : '#ffffff',
          strokeWidth: effectiveSize,
        };
        
        // Actualizar estado de la capa correspondiente
        if (tool === 'brush' || (tool === 'eraser' && eraserTarget === 'drawing')) {
          // Para pincel o borrador de dibujo, afectamos la capa de dibujo
          setDrawingLines(prevLines => [...prevLines, newLine]);
          setUndoHistory(prev => ({
            ...prev,
            drawing: [...prev.drawing, [...drawingLines]]
          }));
        } else if (tool === 'eraser' && eraserTarget === 'stencil') {
          // Para borrador de stencil, afectamos la capa de stencil
          setStencilLines(prevLines => [...prevLines, newLine]);
          setUndoHistory(prev => ({
            ...prev,
            stencil: [...prev.stencil, [...stencilLines]]
          }));
        }
        
        // Resetear historial de rehacer
        setRedoHistory({drawing: [], stencil: []});
        
        // Guardar posición para suavizado
        lastPointerPosition.current = actualPos;
        
        // Renderizar inmediatamente
        stage.batchDraw();
      } 
      // Modo navegación
      else if (mode === 'panning') {
        setIsDragging(true);
        document.body.style.cursor = 'grabbing';
        
        // Guardar punto inicial del movimiento
        lastPointerPosition.current = {
          x: touch.clientX,
          y: touch.clientY
        };
      }
    }
    
    // CASO 2: Dos dedos en pantalla - siempre activar paneo temporal (independiente del modo)
    else if (e.evt.touches.length === 2) {
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      
      // Guardar estado inicial para seguimiento de gestos
      const touchInfo = getMultitouchCenter(touch1, touch2);
      if (touchInfo) {
        lastTouchDistance.current = touchInfo.distance;
        lastTouchCenter.current = {
          x: touchInfo.x,
          y: touchInfo.y
        };
      }
      
      // Activar modo pinch-zoom temporalmente
      isPinching.current = true;
      
      // Desactivar dibujo si estaba activo
      if (isDrawing) {
        setIsDrawing(false);
      }
    }
  }, [brushColor, brushSize, eraserSize, isDrawing, lines, mode, position.x, position.y, scale, tool, eraserTarget]);

  // Función para manejar el movimiento de toques táctiles
  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    if (!stageRef.current) return;
    const stage = stageRef.current;
    
    // CASO 1: Dos dedos - paneo y zoom con gestos mejorados
    if (e.evt.touches.length === 2) {
      // Implementación de pinch-zoom/pan con mejor respuesta
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      
      // Verificar que tengamos la información inicial del pellizco
      if (!lastTouchDistance.current || !lastTouchCenter.current) {
        const touchInfo = getMultitouchCenter(touch1, touch2);
        if (!touchInfo) return;
        
        lastTouchDistance.current = touchInfo.distance;
        lastTouchCenter.current = { x: touchInfo.x, y: touchInfo.y };
        return;
      }
      
      // Obtener información actual del gesto
      const touchInfo = getMultitouchCenter(touch1, touch2);
      if (!touchInfo) return;
      
      // PANEO: Enfoque mejorado para calcular desplazamiento con dos dedos
      if (lastTouchCenter.current) {
        // Implementación mejorada con mejor respuesta táctil y precisión
        // Usar movimiento relativo sin amortiguación para mayor precisión
        const dx = touchInfo.x - lastTouchCenter.current.x;
        const dy = touchInfo.y - lastTouchCenter.current.y;
        
        // Solo aplicar cambios si el movimiento es significativo
        if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
          if (stageRef.current) {
            // Calcular nueva posición
            const newX = position.x + dx;
            const newY = position.y + dy;
            
            // Aplicar la posición directamente al stage para respuesta inmediata
            stageRef.current.x(newX);
            stageRef.current.y(newY);
            
            // Actualizar el state
            setPosition({
              x: newX,
              y: newY
            });
          }
        }
      }
      
      // ZOOM: Separar gestión de zoom para simplificar
      if (lastTouchDistance.current && touchInfo.distance > 0) {
        // Calcular el factor de escala comparando distancias
        const scaleFactor = touchInfo.distance / lastTouchDistance.current;
        
        // Sólo aplicar zoom si el cambio es sustancial
        // Un umbral más alto (0.02) evita cambios inadvertidos
        if (Math.abs(scaleFactor - 1) > 0.02) {
          // Calcular centro del zoom (punto medio entre los dedos)
          const zoomCenter = {
            x: touchInfo.x,
            y: touchInfo.y
          };
          
          // Calcular la nueva escala con limitaciones
          const newScale = scale * scaleFactor;
          const limitedScale = Math.min(Math.max(0.1, newScale), 10);
          
          if (stageRef.current) {
            // Punto antes del zoom (posición en coordenadas del mundo)
            const mousePointTo = {
              x: (zoomCenter.x - position.x) / scale,
              y: (zoomCenter.y - position.y) / scale
            };
            
            // Nueva posición que mantiene el punto centrado
            const newPos = {
              x: zoomCenter.x - mousePointTo.x * limitedScale,
              y: zoomCenter.y - mousePointTo.y * limitedScale
            };
            
            // Aplicar cambios directamente para respuesta inmediata
            stageRef.current.scale({ x: limitedScale, y: limitedScale });
            stageRef.current.position(newPos);
            
            // Actualizar estado
            setScale(limitedScale);
            setPosition(newPos);
          }
        }
      }
      
      // Actualizar referencias para el próximo evento
      lastTouchCenter.current = { x: touchInfo.x, y: touchInfo.y };
      lastTouchDistance.current = touchInfo.distance;
      
      // Forzar renderizado para movimiento fluido
      if (stageRef.current) {
        stageRef.current.batchDraw();
      }
      
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
    
    // Dibujo con un dedo en modo dibujo
    if (isDrawing && mode === 'drawing' && e.evt.touches.length === 1) {
      // Obtener posición del puntero
      const pointerPos = stageRef.current.getPointerPosition();
      if (!pointerPos) return;
      
      // Convertir a coordenadas reales teniendo en cuenta zoom y posición
      const actualPos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };
      
      // Si es el primer punto, establecer posición y salir
      if (!lastPointerPosition.current) {
        lastPointerPosition.current = actualPos;
        return;
      }
      
      // Obtener última línea
      const lastLineIdx = lines.length - 1;
      if (lastLineIdx < 0) return;
      
      // Copiar array para inmutabilidad
      const newLines = [...lines];
      
      // Añadir nuevos puntos a la última línea
      const newPoints = [...newLines[lastLineIdx].points, actualPos.x, actualPos.y];
      newLines[lastLineIdx].points = newPoints;
      
      // Actualizar estado
      setLines(newLines);
      
      // Actualizar posición para suavizado
      lastPointerPosition.current = actualPos;
      
      // Renderizar inmediatamente
      stage.batchDraw();
    }
  }, [isDrawing, isDragging, lines, mode, position, scale]);

  // Función para manejar el fin de toques táctiles
  const handleTouchEnd = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    // Actualizar contador de dedos
    touchFingerCount.current = e.evt.touches.length;
    
    // Si estábamos pinchando, aplicar inercia
    if (isPinching.current && e.evt.touches.length < 2) {
      isPinching.current = false;
      
      // No aplicamos inercia para el pinch-zoom
      // ya que podría resultar en comportamiento impredecible
    }
    
    // Si soltamos todos los dedos, finalizar dibujo y arrastre
    if (e.evt.touches.length === 0) {
      if (isDrawing) {
        endDrawing();
      }
      
      if (isDragging) {
        setIsDragging(false);
        document.body.style.cursor = 'default';
        
        // Aplicar inercia para movimiento natural
        applyInertia();
      }
    }
    // Si pasamos de dos dedos a uno, restaurar el modo dibujo si estábamos en ese modo
    else if (e.evt.touches.length === 1 && mode === 'drawing') {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      
      // No activamos isDrawing hasta que el usuario levante y vuelva a tocar
      // Esto evita trazos inesperados después de usar paneo con dos dedos
    }
  }, [applyInertia, endDrawing, isDragging, isDrawing, mode]);

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
    <div className="flex flex-col w-full space-y-2">
      <div className="flex flex-col">
        {/* Barra de herramientas organizada en 3 secciones */}
        <div className="flex flex-wrap justify-between items-center bg-gray-900 p-2 rounded-lg mb-2">
          {/* Sección 1: Herramientas de dibujo */}
          <div className="flex gap-1 items-center">
            {/* Toggle Dibujar/Mover */}
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setMode(mode === 'drawing' ? 'panning' : 'drawing')}
              className={`rounded-full ${mode === 'panning' ? "bg-gray-700" : ""} w-8 h-8 p-0`}
              title={mode === 'drawing' ? t("pan_mode") || "Mover lienzo" : t("draw_mode") || "Dibujar"}
            >
              {mode === 'drawing' ? <Move className="h-4 w-4" /> : <Brush className="h-4 w-4" />}
            </Button>
            
            {/* Separador */}
            <div className="h-6 w-px bg-gray-700 mx-1"></div>
            
            {/* Pincel */}
            <Button
              variant={tool === 'brush' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => {
                setTool('brush');
                document.body.style.cursor = 'crosshair';
                setShowToolSettings(true);
              }}
              className={`rounded-full ${tool === 'brush' ? "bg-blue-600 hover:bg-blue-700" : ""} w-8 h-8 p-0`}
              title={t("brush") || "Pincel"}
            >
              <Brush className="h-4 w-4" />
            </Button>
            
            {/* Borrar Dibujo */}
            <Button
              variant={tool === 'eraser' && eraserTarget === 'drawing' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => {
                setTool('eraser');
                setEraserTarget('drawing');
                document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%230000ff\' stroke-width=\'1\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M19 15l-1 2a1 1 0 01-1 1H7a1 1 0 01-1-1L3.4 5.3a1 1 0 011-1.3H19a1 1 0 011 1v10z\'%3E%3C/path%3E%3C/svg%3E") 0 24, auto';
                setShowToolSettings(true);
              }}
              className={`rounded-full ${tool === 'eraser' && eraserTarget === 'drawing' ? "bg-blue-600 hover:bg-blue-700" : ""} w-8 h-8 p-0`}
              title={t("erase_drawing") || "Borrar dibujo"}
            >
              <Eraser className="h-4 w-4" />
            </Button>
            
            {/* Borrar Stencil */}
            <Button
              variant={tool === 'eraser' && eraserTarget === 'stencil' ? 'default' : 'ghost'}
              size="icon"
              onClick={() => {
                setTool('eraser');
                setEraserTarget('stencil');
                document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ff0000\' stroke-width=\'1\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M19 15l-1 2a1 1 0 01-1 1H7a1 1 0 01-1-1L3.4 5.3a1 1 0 011-1.3H19a1 1 0 011 1v10z\'%3E%3C/path%3E%3C/svg%3E") 0 24, auto';
                setShowToolSettings(true);
              }}
              className={`rounded-full ${tool === 'eraser' && eraserTarget === 'stencil' ? "bg-red-600 hover:bg-red-700" : ""} w-8 h-8 p-0`}
              title={t("erase_stencil") || "Borrar stencil"}
            >
              <Eraser className="h-4 w-4 text-red-500" />
            </Button>
          </div>
          
          {/* Sección 2: Acciones (undo/redo) */}
          <div className="flex gap-1 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (undoHistory.length > 0) {
                  const prevLines = undoHistory[undoHistory.length - 1];
                  setRedoHistory([...redoHistory, [...lines]]);
                  setLines(prevLines);
                  setUndoHistory(undoHistory.slice(0, -1));
                }
              }}
              disabled={undoHistory.length === 0}
              className="rounded-full w-8 h-8 p-0"
              title={t("undo") || "Deshacer"}
            >
              <Undo2 className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                if (redoHistory.length > 0) {
                  const nextLines = redoHistory[redoHistory.length - 1];
                  setUndoHistory([...undoHistory, [...lines]]);
                  setLines(nextLines);
                  setRedoHistory(redoHistory.slice(0, -1));
                }
              }}
              disabled={redoHistory.length === 0}
              className="rounded-full w-8 h-8 p-0"
              title={t("redo") || "Rehacer"}
            >
              <Redo2 className="h-4 w-4" />
            </Button>
          </div>
          
          {/* Sección 3: Controles de zoom */}
          <div className="flex gap-1 items-center">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Reset zoom y posición
                setScale(1);
                setPosition({ x: 0, y: 0 });
              }}
              className="rounded-full w-8 h-8 p-0"
              title={t("reset_view") || "Restablecer vista"}
            >
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
              </svg>
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Zoom in (aumentar escala)
                const newScale = Math.min(scale * 1.2, 10);
                setScale(newScale);
                
                // Centrar zoom
                if (stageRef.current) {
                  const stage = stageRef.current;
                  const stageWidth = stage.width();
                  const stageHeight = stage.height();
                  
                  const centerX = stageWidth / 2;
                  const centerY = stageHeight / 2;
                  
                  setPosition({
                    x: centerX - (centerX - position.x) * (newScale / scale),
                    y: centerY - (centerY - position.y) * (newScale / scale)
                  });
                }
              }}
              className="rounded-full w-8 h-8 p-0"
              title={t("zoom_in") || "Acercar"}
            >
              <ZoomIn className="h-4 w-4" />
            </Button>
            
            <Button
              variant="ghost"
              size="icon"
              onClick={() => {
                // Zoom out (reducir escala)
                const newScale = Math.max(scale / 1.2, 0.1);
                setScale(newScale);
                
                // Centrar zoom
                if (stageRef.current) {
                  const stage = stageRef.current;
                  const stageWidth = stage.width();
                  const stageHeight = stage.height();
                  
                  const centerX = stageWidth / 2;
                  const centerY = stageHeight / 2;
                  
                  setPosition({
                    x: centerX - (centerX - position.x) * (newScale / scale),
                    y: centerY - (centerY - position.y) * (newScale / scale)
                  });
                }
              }}
              className="rounded-full w-8 h-8 p-0"
              title={t("zoom_out") || "Alejar"}
            >
              <ZoomOut className="h-4 w-4" />
            </Button>
            
            <span className="text-xs bg-gray-800 px-2 py-1 rounded ml-1">{Math.round(scale * 100)}%</span>
          </div>
        </div>
        
        {/* Panel desplegable de ajustes de herramienta */}
        {showToolSettings && (
          <div className="bg-gray-800 p-3 rounded-lg mb-2 flex flex-col space-y-2 animate-in fade-in duration-300">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium">
                {tool === 'brush' 
                  ? t("brush_settings") || "Ajustes del pincel" 
                  : eraserTarget === 'drawing' 
                    ? t("drawing_eraser") || "Borrador de dibujo" 
                    : t("stencil_eraser") || "Borrador de stencil"
                }
              </h3>
              <Button 
                variant="ghost" 
                size="icon" 
                className="h-6 w-6 rounded-full"
                onClick={() => setShowToolSettings(false)}
              >
                ✕
              </Button>
            </div>
            
            <div className="flex items-center gap-2">
              <span className="text-xs w-12">{t("size") || "Tamaño"}:</span>
              <input
                type="range"
                min="1"
                max={tool === 'eraser' ? 50 : 20}
                value={tool === 'brush' ? brushSize : eraserSize}
                onChange={(e) => {
                  const value = parseInt(e.target.value);
                  if (tool === 'brush') {
                    setBrushSize(value);
                  } else {
                    setEraserSize(value);
                  }
                }}
                className="flex-1"
              />
              <span className="text-xs w-6 text-center">{tool === 'brush' ? brushSize : eraserSize}</span>
            </div>
            
            {tool === 'brush' && (
              <div className="flex items-center gap-2">
                <span className="text-xs w-12">{t("color") || "Color"}:</span>
                <div className="flex gap-1">
                  {['#ff0000', '#0000ff', '#00ff00', '#ffffff', '#000000'].map(color => (
                    <button 
                      key={color}
                      className={`w-6 h-6 rounded-full border ${brushColor === color ? 'border-white ring-2 ring-blue-500' : 'border-gray-600'}`}
                      style={{ backgroundColor: color }}
                      onClick={() => setBrushColor(color)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
        
        {/* Panel de control de capas */}
        <div className="border border-gray-700 rounded-lg bg-gray-900 p-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-white">{t("layers") || "CAPAS"}</h3>
            
            {/* Control de capa original */}
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
            
            {/* Control de capa stencil */}
            <div className="flex items-center gap-2 border border-gray-600 rounded-md p-2 bg-gray-800">
              <span className="h-4 w-4 bg-blue-600 rounded-full inline-block mr-1"></span>
              <label className="text-sm font-medium whitespace-nowrap text-blue-300">{t("stencil") || "STENCIL"}</label>
              <input
                type="checkbox"
                checked={stencilLayerVisible}
                onChange={(e) => setStencilLayerVisible(e.target.checked)}
                className="h-5 w-5 rounded border-gray-700 text-blue-400"
              />
            </div>
          </div>
        </div>
        
        {/* Contenedor del canvas con tamaño ajustable */}
        <div style={containerStyle} className="border border-gray-700 rounded-lg bg-black overflow-hidden">
          <Stage
            width={width}
            height={height}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            ref={stageRef}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* Capa de imagen original con opacidad ajustable */}
            <Layer name="original">
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
            
            {/* Capa 1: Stencil (imagen base) */}
            <Layer name="stencil" ref={node => {
              if (node) (window as any).layerStencil = node;
            }}>
              {stencilLayerVisible && stencilImageObj && (
                <Image
                  image={stencilImageObj}
                  width={width}
                  height={height}
                  ref={stencilImageRef}
                  listening={false}
                />
              )}
              
              {/* Borrador aplicado SOLO a la capa de stencil */}
              {lines
                .filter(line => line.tool === 'eraser' && eraserTarget === 'stencil')
                .map((line, i) => (
                  <Line
                    key={`stencil-eraser-${i}`}
                    points={line.points}
                    stroke="#ffffff" // El color no importa con destination-out
                    strokeWidth={line.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation="destination-out"
                    perfectDrawEnabled={true}
                    shadowForStrokeEnabled={false}
                    listening={false}
                  />
                ))
              }
            </Layer>
            
            {/* Capa 2: Dibujo (trazos del usuario) */}
            <Layer name="drawingLayer" ref={node => {
              if (node) (window as any).layerDraw = node;
            }}>
              {/* Trazos de pincel (dibujo) */}
              {lines
                .filter(line => line.tool === 'brush')
                .map((line, i) => (
                  <Line
                    key={`brush-${i}`}
                    points={line.points}
                    stroke={line.color}
                    strokeWidth={line.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    perfectDrawEnabled={true}
                    shadowForStrokeEnabled={false}
                    listening={false}
                  />
                ))
              }
              
              {/* Borrador aplicado SOLO a la capa de dibujo */}
              {lines
                .filter(line => line.tool === 'eraser' && eraserTarget === 'drawing')
                .map((line, i) => (
                  <Line
                    key={`drawing-eraser-${i}`}
                    points={line.points}
                    stroke="#ffffff"
                    strokeWidth={line.strokeWidth}
                    tension={0.5}
                    lineCap="round"
                    lineJoin="round"
                    globalCompositeOperation="destination-out"
                    perfectDrawEnabled={true}
                    shadowForStrokeEnabled={false}
                    listening={false}
                  />
                ))
              }
            </Layer>
            
            {/* Capa para capturar eventos */}
            <Layer name="eventCatcher">
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="rgba(0,0,0,0.001)"
              />
            </Layer>
          </Stage>
        </div>
        
        {/* Acciones de exportación */}
        <div className="flex flex-wrap gap-2 mt-4 justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!stageRef.current || !onSave) return;
              
              const uri = stageRef.current.toDataURL({
                pixelRatio: 2
              });
              
              onSave(uri);
              toast({
                title: t("saved") || "Guardado",
                description: t("stencil_saved") || "Stencil guardado correctamente",
              });
            }}
          >
            <Save className="h-4 w-4 mr-1" />
            {t("save") || "Guardar"}
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              if (!stageRef.current) return;
              
              const uri = stageRef.current.toDataURL({
                pixelRatio: 2
              });
              
              saveAs(uri, 'stencil-edited.png');
            }}
          >
            <Download className="h-4 w-4 mr-1" />
            {t("download") || "Descargar"}
          </Button>
        </div>
      </div>
    </div>
  );
}