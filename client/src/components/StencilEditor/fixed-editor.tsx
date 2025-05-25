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
  const [lines, setLines] = useState<Line[]>([]);
  const [undoHistory, setUndoHistory] = useState<Line[][]>([]);
  const [redoHistory, setRedoHistory] = useState<Line[][]>([]);
  const [isDrawing, setIsDrawing] = useState(false);
  const [brushSize, setBrushSize] = useState(2);
  const [eraserSize, setEraserSize] = useState(10); // Tamaño específico para el borrador, más grande para mejor usabilidad
  const [brushColor, setBrushColor] = useState('#ff0000');
  // Estado para determinar la capa objetivo del borrador
  const [eraserTarget, setEraserTarget] = useState<'drawing' | 'stencil'>('drawing');
  
  // Variables para rastrear gestos táctiles (estilo Procreate)
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
  
  // Función para calcular el centro y la distancia entre dos toques táctiles
  const getMultitouchCenter = useCallback((touch1: Touch, touch2: Touch) => {
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
      distance: Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2))
    };
  }, []);
  
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

  // Función para calcular el centro entre dos puntos táctiles
  const getTouchCenter = useCallback((touches: TouchList): { x: number, y: number } => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return {
      x: (touch1.clientX + touch2.clientX) / 2,
      y: (touch1.clientY + touch2.clientY) / 2
    };
  }, []);
  
  // Función para calcular la distancia entre dos puntos táctiles
  const getTouchDistance = useCallback((touches: TouchList): number => {
    const touch1 = touches[0];
    const touch2 = touches[1];
    return Math.sqrt(
      Math.pow(touch2.clientX - touch1.clientX, 2) + 
      Math.pow(touch2.clientY - touch1.clientY, 2)
    );
  }, []);
  
  // Función para manejar el movimiento táctil (con dos dedos)
  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    if (!stageRef.current) return;
    
    const stage = stageRef.current;
    
    // Manejo de pinch-zoom (con dos dedos)
    if (e.evt.touches.length === 2) {
      // Obtener información de los toques
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
  }, [isDrawing, lines, position, scale, mode, isDragging]);
  
  // Función para manejar el inicio de toques táctiles - Con soporte para borrador en ambas capas
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
          // Marcar si este trazo debe afectar también al stencil
          affectsStencil: tool === 'eraser' && eraserTarget === 'stencil'
        };
        
        // Actualizar estado
        setLines(prevLines => [...prevLines, newLine]);
        setUndoHistory(prev => [...prev, [...lines]]);
        setRedoHistory([]);
        
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
      // Desactivar dibujo cuando hay dos dedos
      setIsDrawing(false);
      
      // Resetear información para evitar problemas de paneo
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
      
      document.body.style.cursor = 'grab';
    }
  }, [lines, position, scale, mode, eraserSize, brushSize, brushColor]);
  
  // Función para terminar el trazo cuando se levanta el dedo
  const handleTouchEnd = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    // Actualizar contador de dedos
    touchFingerCount.current = e.evt.touches.length;
    
    // Si ya no hay dedos en pantalla
    if (e.evt.touches.length === 0) {
      // Terminar modo dibujo si estaba activo
      if (isDrawing) {
        setIsDrawing(false);
        lastPointerPosition.current = null;
      }
      
      // Terminar modo arrastre si estaba activo y aplicar inercia
      if (isDragging) {
        setIsDragging(false);
        applyInertia();
      }
      
      // Restaurar cursor
      document.body.style.cursor = mode === 'panning' ? 'grab' : 'default';
    }
    // Si pasamos de dos dedos a uno, restaurar el modo dibujo si estábamos en ese modo
    else if (e.evt.touches.length === 1 && mode === 'drawing') {
      setIsDragging(false);
      document.body.style.cursor = 'default';
      
      // No activamos isDrawing hasta que el usuario levante y vuelva a tocar
      // Esto evita trazos inesperados después de usar paneo con dos dedos
    }
  }, [mode]);
  
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
    const effectiveSize = tool === 'eraser' ? eraserSize : brushSize;
    
    const newLine: Line = {
      tool,
      points: [adjustedPoint.x, adjustedPoint.y],
      color: tool === 'brush' ? brushColor : '#ffffff', // Blanco para el borrador
      strokeWidth: effectiveSize,
      affectsStencil: tool === 'eraser' && eraserTarget === 'stencil'
    };
    
    setLines([...lines, newLine]);
    setUndoHistory([...undoHistory, [...lines]]);
    setRedoHistory([]);
  };
  
  // Función para continuar dibujando (mouse)
  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    // Si estamos en modo movimiento, manejar desplazamiento del canvas con animación suave
    if (mode === 'panning' && isDragging) {
      const stage = e.target.getStage();
      if (!stage) return;
      
      // Mantener cursor de "mano cerrada" durante el arrastre
      document.body.style.cursor = 'grabbing';
      
      // Obtener posición actual del puntero
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos || !stage.lastMousePos) return;
      
      // Calcular desplazamiento desde la última posición
      const dx = pointerPos.x - stage.lastMousePos.x;
      const dy = pointerPos.y - stage.lastMousePos.y;
      
      // Actualizar posición del stage
      const newPos = {
        x: position.x + dx,
        y: position.y + dy
      };
      
      setPosition(newPos);
      
      // Actualizar referencia para el próximo movimiento
      stage.lastMousePos = pointerPos;
      
      // Forzar renderizado para movimiento más fluido
      stage.batchDraw();
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
        const lastPoint = {
          x: lastLine.points[lastLine.points.length - 2],
          y: lastLine.points[lastLine.points.length - 1]
        };
        
        // Calcular distancia con el punto actual
        const distance = Math.sqrt(
          Math.pow(point.x - lastPoint.x, 2) + 
          Math.pow(point.y - lastPoint.y, 2)
        );
        
        // Si la distancia es significativa, añadir puntos intermedios para un borrado más uniforme
        if (distance > eraserSize / 4) {
          const numPoints = Math.ceil(distance / (eraserSize / 8));
          const dx = (point.x - lastPoint.x) / numPoints;
          const dy = (point.y - lastPoint.y) / numPoints;
          
          const newPoints = [...lastLine.points];
          
          for (let i = 1; i <= numPoints; i++) {
            const x = lastPoint.x + dx * i;
            const y = lastPoint.y + dy * i;
            newPoints.push(x, y);
          }
          
          const newLines = [...lines];
          newLines[newLines.length - 1].points = newPoints;
          setLines(newLines);
        } else {
          // Añadir punto normal si la distancia es pequeña
          const newLines = [...lines];
          newLines[newLines.length - 1].points.push(point.x, point.y);
          setLines(newLines);
        }
      } 
      // Para el pincel, añadir puntos normalmente
      else {
        const newLines = [...lines];
        newLines[newLines.length - 1].points.push(point.x, point.y);
        setLines(newLines);
      }
    }
  };
  
  // Función para terminar el dibujo
  const handleMouseUp = () => {
    if (mode === 'drawing') {
      setIsDrawing(false);
    }
  };
  
  // Iniciar arrastre en modo movimiento
  const handleDragStart = (e: KonvaEventObject<MouseEvent>) => {
    if (mode !== 'panning') return;
    
    const stage = e.target.getStage();
    if (!stage) return;
    
    // Cambiar el cursor a "mano cerrada" para indicar el arrastre
    document.body.style.cursor = 'grabbing';
    
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
        {/* Barra de herramientas mejorada con diseño más intuitivo */}
        <div className="flex flex-col space-y-3 mb-3">
          {/* Título de sección */}
          <div className="text-sm font-semibold mb-1 text-white/80">Herramientas</div>
          
          {/* Grupo de herramientas principales */}
          <div className="flex flex-wrap gap-2 p-2 bg-black/20 rounded-lg">
            {/* Herramienta de dibujo */}
            <Button
              variant={tool === 'brush' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setTool('brush');
                document.body.style.cursor = 'crosshair';
              }}
              className={tool === 'brush' 
                ? "bg-blue-600 hover:bg-blue-700 border-2 border-white/80" 
                : "hover:bg-blue-700/20"
              }
            >
              <Brush className="h-5 w-5 mr-2" />
              <span className="font-medium">Dibujar</span>
            </Button>
            
            {/* Separador visual */}
            <div className="h-8 w-px bg-white/20 mx-1"></div>
            
            {/* Grupo de borradores */}
            <div className="flex items-center gap-1">
              {/* Borrador para capa de dibujo */}
              <Button
                variant={tool === 'eraser' && eraserTarget === 'drawing' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setTool('eraser');
                  setEraserTarget('drawing');
                  document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%230000ff\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M19 15l-1 2a1 1 0 01-1 1H7a1 1 0 01-1-1L3.4 5.3a1 1 0 011-1.3H19a1 1 0 011 1v10z\'%3E%3C/path%3E%3C/svg%3E") 0 24, auto';
                }}
                className={tool === 'eraser' && eraserTarget === 'drawing' 
                  ? "bg-blue-600 hover:bg-blue-700 border-2 border-white/80" 
                  : "hover:bg-blue-700/20"
                }
              >
                <Eraser className="h-5 w-5 mr-2" />
                <span className="font-medium">Borrar dibujo</span>
              </Button>
              
              {/* Borrador para capa de stencil */}
              <Button
                variant={tool === 'eraser' && eraserTarget === 'stencil' ? 'default' : 'outline'}
                size="sm"
                onClick={() => {
                  setTool('eraser');
                  setEraserTarget('stencil');
                  document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ff0000\' stroke-width=\'2\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M19 15l-1 2a1 1 0 01-1 1H7a1 1 0 01-1-1L3.4 5.3a1 1 0 011-1.3H19a1 1 0 011 1v10z\'%3E%3C/path%3E%3C/svg%3E") 0 24, auto';
                }}
                className={tool === 'eraser' && eraserTarget === 'stencil' 
                  ? "bg-red-600 hover:bg-red-700 border-2 border-white/80" 
                  : "hover:bg-red-700/20"
                }
              >
                <Eraser className="h-5 w-5 mr-2" />
                <span className="font-medium">Borrar stencil</span>
              </Button>
            </div>
          </div>
          
          {/* Controles adicionales */}
          <div className="flex flex-wrap gap-2 p-2 bg-black/20 rounded-lg">
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
            
            <Button
              variant={mode === 'panning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setMode(mode === 'panning' ? 'drawing' : 'panning');
                document.body.style.cursor = mode === 'panning' ? 'default' : 'grab';
              }}
              className={mode === 'panning' ? "bg-green-600 hover:bg-green-700" : ""}
            >
              <Move className="h-4 w-4 mr-1" />
              {mode === 'panning' ? (t("exit_move_mode") || "Salir modo mover") : (t("move_mode") || "Modo mover")}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(prev => Math.min(prev * 1.2, 10))}
            >
              <ZoomIn className="h-4 w-4 mr-1" />
              {t("zoom_in") || "Acercar"}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setScale(prev => Math.max(prev / 1.2, 0.2))}
            >
              <ZoomOut className="h-4 w-4 mr-1" />
              {t("zoom_out") || "Alejar"}
            </Button>
          </div>
        </div>

        {/* Exportar y guardar */}
        <div className="flex flex-wrap gap-2 mt-2">
          <Button variant="outline" onClick={exportAsPNG}>
            <Download className="h-4 w-4 mr-2" />
            {t("export_stencil_png") || "Exportar stencil (PNG)"}
          </Button>
          
          <Button variant="outline" onClick={exportAsMergedPNG}>
            <ImageDown className="h-4 w-4 mr-2" />
            {t("export_merged_png") || "Exportar combinado (PNG)"}
          </Button>
          
          {onSave && (
            <Button variant="default" onClick={saveEditedImage} className="bg-blue-600 hover:bg-blue-700">
              <Save className="h-4 w-4 mr-2" />
              {t("save") || "Guardar"}
            </Button>
          )}
        </div>
      </div>

      {/* Editor Canvas */}
      <div className="relative" style={containerStyle}>
        <div
          className="w-full h-full border border-gray-700 rounded-lg overflow-hidden"
          style={{
            backgroundColor: '#333',
            touchAction: 'none'
          }}
        >
          <Stage
            width={width}
            height={height}
            scaleX={scale}
            scaleY={scale}
            x={position.x}
            y={position.y}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
            onMouseDown={mode === 'drawing' ? handleMouseDown : handleDragStart}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            ref={stageRef}
            draggable={false}
          >
            {/* Capa de fondo (opcional, para mejor contraste) */}
            <Layer name="background">
              <Rect
                x={0}
                y={0}
                width={width}
                height={height}
                fill="#333"
              />
            </Layer>
            
            {/* Capa de imagen original (referencia) */}
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
            
            {/* IMPLEMENTACIÓN CON CAPAS INDEPENDIENTES Y BORRADOR SELECTIVO */}
            
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
                .filter(line => line.tool === 'eraser' && line.affectsStencil)
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
                .filter(line => line.tool === 'eraser' && !line.affectsStencil)
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
                fill="transparent"
                listening={true}
              />
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  );
}