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
  Move,
  Layers,
  Eye,
  EyeOff
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
  
  // Referencia para cerrar menús al hacer clic fuera
  const eraserMenuRef = useRef<HTMLDivElement | null>(null);
  
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
  // Estado para gestionar el borrador
  const [eraserTarget, setEraserTarget] = useState<'drawing' | 'stencil'>('drawing');
  const [eraserMenuOpen, setEraserMenuOpen] = useState<boolean>(false);
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
  
  // Función para manejar gestos táctiles con soporte mejorado para paneo con dos dedos
  const handleTouchMove = useCallback((e: KonvaEventObject<TouchEvent>) => {
    e.evt.preventDefault();
    
    if (!stageRef.current) return;
    const stage = stageRef.current;
    
    // CASO 1: Dibujando con un dedo en modo dibujo
    if (mode === 'drawing' && isDrawing && e.evt.touches.length === 1) {
      // Obtener coordenadas del puntero (ajustadas por el container)
      const pointerPos = stage.getPointerPosition();
      if (!pointerPos) return;
      
      // Transformar a coordenadas del canvas con el zoom aplicado
      const adjustedPos = {
        x: (pointerPos.x - position.x) / scale,
        y: (pointerPos.y - position.y) / scale
      };
      
      // Obtener la última línea para añadir puntos
      const lastLineIndex = lines.length - 1;
      if (lastLineIndex < 0) return;
      
      // Crear una copia de las líneas y de la última línea
      const updatedLines = [...lines];
      const lastLine = { ...updatedLines[lastLineIndex] };
      
      // Si hay un punto anterior, interpolar para trazos suaves
      if (lastPointerPosition.current) {
        const dx = adjustedPos.x - lastPointerPosition.current.x;
        const dy = adjustedPos.y - lastPointerPosition.current.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        // Si el movimiento es significativo, crear varios puntos intermedios
        if (distance > 1) {
          // Para el borrador, usar más puntos para asegurar cobertura total
          const steps = tool === 'eraser' ? Math.ceil(distance) * 2 : Math.max(1, Math.floor(distance / 2));
          const newPoints = [];
          
          for (let i = 1; i <= steps; i++) {
            const ratio = i / steps;
            const x = lastPointerPosition.current.x + dx * ratio;
            const y = lastPointerPosition.current.y + dy * ratio;
            newPoints.push(x, y);
          }
          
          // Actualizar los puntos de la línea
          lastLine.points = [...lastLine.points, ...newPoints];
        } else {
          // Añadir solo el punto actual si la distancia es pequeña
          lastLine.points = [...lastLine.points, adjustedPos.x, adjustedPos.y];
        }
      } else {
        // Si no hay punto anterior, añadir el punto actual
        lastLine.points = [...lastLine.points, adjustedPos.x, adjustedPos.y];
      }
      
      // Actualizar el punto de referencia para el próximo evento
      lastPointerPosition.current = adjustedPos;
      
      // Actualizar el estado con las nuevas líneas
      updatedLines[lastLineIndex] = lastLine;
      setLines(updatedLines);
      
      // Forzar el renderizado inmediato para ver los cambios
      stage.batchDraw();
      return;
    }
    
    // CASO 2: Paneo con DOS DEDOS - Implementación optimizada para mayor fluidez
    else if (e.evt.touches.length === 2) {
      // Asegurarnos de que estamos en modo arrastre para dos dedos
      if (!isDragging) {
        setIsDragging(true);
      }
      
      // Obtener información de los dos toques
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
          affectsStencil: tool === 'eraser' // Solo los trazos de borrador afectan al stencil
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
      // Pausar cualquier dibujo en progreso
      setIsDrawing(false);
      
      // Marcar que estamos arrastrando con dos dedos
      setIsDragging(true);
      
      // Cambiar cursor visual
      document.body.style.cursor = 'grabbing';
      
      // Obtener información de los dos toques
      const touch1 = e.evt.touches[0];
      const touch2 = e.evt.touches[1];
      
      // Guardar datos iniciales para calcular distancia y centro del pellizco
      const touchInfo = getMultitouchCenter(touch1, touch2);
      if (!touchInfo) return;
      
      // Guardar valores iniciales para calcular el zoom y el desplazamiento
      lastTouchDistance.current = touchInfo.distance;
      lastTouchCenter.current = { 
        x: touchInfo.x, 
        y: touchInfo.y 
      };
    }
  }, [mode, tool, brushSize, brushColor, lines, undoHistory, position, scale]);

  // Función para manejar el final de toques táctiles
  const handleTouchEnd = useCallback((e: KonvaEventObject<TouchEvent>) => {
    // Actualizar contador de dedos
    touchFingerCount.current = e.evt.touches.length;
    
    // Si ya no hay toques, finalizar todos los estados
    if (e.evt.touches.length === 0) {
      setIsDrawing(false);
      setIsDragging(false);
      
      // Restaurar cursor apropiado según el modo
      if (mode === 'panning') {
        document.body.style.cursor = 'grab';
      } else {
        document.body.style.cursor = 'default';
      }
      
      // Limpiar referencias temporales para pinch-to-zoom
      lastTouchDistance.current = null;
      lastTouchCenter.current = null;
      lastPointerPosition.current = null;
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
  
  // Función para terminar de dibujar o mover con mejor manejo del cursor
  const handleMouseUp = () => {
    setIsDrawing(false);
    
    if (isDragging) {
      setIsDragging(false);
      
      // Actualizar el cursor según el modo actual cuando se termina el arrastre
      if (mode === 'panning' && stageRef.current) {
        document.body.style.cursor = 'grab';
      } else {
        document.body.style.cursor = 'default';
      }
    }
  };
  
  // Función para comenzar a mover el canvas
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
        <div className="flex flex-wrap gap-2 mb-2">
          <Button
            variant={tool === 'brush' ? 'default' : 'outline'}
            size="sm"
            onClick={() => {
              setTool('brush');
              // Restaurar globalCompositeOperation normal
              // (aunque esto se maneja automáticamente en el renderizado de Line)
            }}
            className={tool === 'brush' ? "bg-blue-600 hover:bg-blue-700" : ""}
          >
            <Brush className="h-4 w-4 mr-1" />
            {t("brush") || "Pincel"}
          </Button>
          {/* Botón de borrador con menú desplegable */}
          <div className="relative" ref={eraserMenuRef}>
            <Button
              variant={tool === 'eraser' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setEraserMenuOpen(!eraserMenuOpen)}
              className={tool === 'eraser' ? "bg-red-600 hover:bg-red-700" : ""}
            >
              <Eraser className="h-4 w-4 mr-1" />
              {t("eraser") || "Borrador"}
            </Button>
            
            {/* Menú desplegable de opciones de borrador */}
            {eraserMenuOpen && (
              <div className="absolute z-50 mt-1 right-0 w-48 rounded-md shadow-lg bg-gray-800 border border-gray-700">
                <div className="py-1">
                  <div className="px-4 py-2 text-xs text-gray-400 border-b border-gray-700">
                    {t("erase_from") || "Borrar de:"}
                  </div>
                  
                  {/* Borrar capa de dibujo */}
                  <button 
                    className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-700 text-blue-400"
                    onClick={() => {
                      setTool('eraser');
                      setEraserTarget('drawing');
                      setEraserMenuOpen(false);
                      document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%230000ff\' stroke-width=\'1\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M19 15l-1 2a1 1 0 01-1 1H7a1 1 0 01-1-1L3.4 5.3a1 1 0 011-1.3H19a1 1 0 011 1v10z\'%3E%3C/path%3E%3C/svg%3E") 0 24, auto';
                    }}
                  >
                    <Eraser className="h-4 w-4 mr-2 text-blue-500" />
                    <span>{t("erase_drawing") || "Borrar Dibujo"}</span>
                  </button>
                  
                  {/* Borrar capa de stencil */}
                  <button 
                    className="flex items-center w-full px-4 py-2 text-sm text-left hover:bg-gray-700 text-red-400"
                    onClick={() => {
                      setTool('eraser');
                      setEraserTarget('stencil');
                      setEraserMenuOpen(false);
                      document.body.style.cursor = 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' width=\'24\' height=\'24\' viewBox=\'0 0 24 24\' fill=\'none\' stroke=\'%23ff0000\' stroke-width=\'1\' stroke-linecap=\'round\' stroke-linejoin=\'round\'%3E%3Cpath d=\'M19 15l-1 2a1 1 0 01-1 1H7a1 1 0 01-1-1L3.4 5.3a1 1 0 011-1.3H19a1 1 0 011 1v10z\'%3E%3C/path%3E%3C/svg%3E") 0 24, auto';
                    }}
                  >
                    <Eraser className="h-4 w-4 mr-2 text-red-500" />
                    <span>{t("erase_stencil") || "Borrar Stencil"}</span>
                  </button>
                </div>
              </div>
            )}
          </div>
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
            <label className="text-sm mr-2">
              {tool === 'brush' 
                ? (t("brush_size") || "Tamaño del pincel") 
                : (t("eraser_size") || "Tamaño del borrador")}:
            </label>
            <input
              type="range"
              min="1"
              max={tool === 'eraser' ? 30 : 20} // Mayor rango para el borrador
              value={tool === 'brush' ? brushSize : eraserSize}
              onChange={(e) => {
                const value = parseInt(e.target.value);
                if (tool === 'brush') {
                  setBrushSize(value);
                } else {
                  setEraserSize(value);
                }
              }}
              className="w-24"
            />
            <span className="text-sm ml-1">
              {tool === 'brush' ? brushSize : eraserSize}px
            </span>
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
              onClick={() => {
                setMode('drawing');
                if (stageRef.current) {
                  document.body.style.cursor = 'default';
                }
              }}
              className={mode === 'drawing' ? "bg-blue-600 hover:bg-blue-700" : ""}
            >
              <Brush className="h-4 w-4 mr-1" />
              {t("drawing_mode") || "Dibujar"}
            </Button>
            <Button
              variant={mode === 'panning' ? 'default' : 'outline'}
              size="sm"
              onClick={() => {
                setMode('panning');
                if (stageRef.current) {
                  document.body.style.cursor = 'grab';
                }
              }}
              className={mode === 'panning' ? "bg-green-600 hover:bg-green-700" : ""}
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
            onDragStart={() => {
              document.body.style.cursor = 'grabbing';
            }}
            onDragMove={(e) => {
              // Actualizar la posición durante el arrastre
              const newPos = e.target.position();
              setPosition(newPos);
            }}
            onDragEnd={() => {
              document.body.style.cursor = 'default';
              // Asegurar que el estado refleje la posición final
              if (stageRef.current) {
                const newPos = stageRef.current.position();
                setPosition(newPos);
              }
            }}
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
            
            {/* IMPLEMENTACIÓN MEJORADA PARA PERMITIR DIBUJAR DONDE SE HA BORRADO */}
            
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
            </Layer>
            
            {/* SOLUCIÓN MEJORADA: Reorganizar capas para corregir el borrado */}
            
            {/* SOLUCIÓN ALTERNATIVA PARA BORRADO DEL STENCIL */}
            {/* Primero una capa base para el stencil */}
            <Layer name="stencilBase">
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
            
            {/* Segunda capa exclusivamente para el borrador del stencil con canvas directo */}
            <Layer 
              name="stencilEraser" 
              ref={node => {
                if (node) (window as any).layerStencil = node;
              }}
            >
              <Group>
                {lines
                  .filter(line => line.tool === 'eraser' && eraserTarget === 'stencil')
                  .map((line, i) => (
                    <Line
                      key={`stencil-eraser-${i}`}
                      points={line.points}
                      stroke="#ffffff"
                      strokeWidth={line.strokeWidth * 2} // Doble de grosor para borrar más efectivamente
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
              </Group>
            </Layer>
            
            {/* Capa 2: Dibujo (trazos del usuario) con borrador integrado */}
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
                    globalCompositeOperation="source-over" // Asegurar que siempre sea source-over para el pincel
                    perfectDrawEnabled={true}
                    shadowForStrokeEnabled={false}
                    listening={false}
                  />
                ))
              }
              
              {/* Trazos de borrador directamente en la capa de dibujo */}
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