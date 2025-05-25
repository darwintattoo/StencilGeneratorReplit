/**
 * ProcreateTouchHandler.js
 * Implementación de gestos táctiles avanzados estilo Procreate para Konva.js
 * Optimizado para tabletas y dispositivos móviles
 */

// Variables globales para gestos
let isPinching = false;
let startDist = 0;
let startScale = 1;
let lastCenter = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let lastPos = { x: 0, y: 0 };
let lastTimestamp = 0;
let inertiaAnimation = null;

// Constantes para límites y comportamiento
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;
const PINCH_THRESHOLD = 4; // Umbral para distinguir pinch vs pan
const VELOCITY_FACTOR = 0.3; // Factor para inercia

/**
 * Calcula distancia entre dos puntos táctiles
 */
function getDist(touch1, touch2) {
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
}

/**
 * Calcula el centro entre dos toques
 */
function getCenter(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
}

/**
 * Inicia un gesto de pinch-zoom o paneo con dos dedos
 */
function handlePinchStart(e, stage, scale, position) {
  if (e.touches.length !== 2) return false;
  
  // Cancelar cualquier animación de inercia
  if (inertiaAnimation) {
    inertiaAnimation.stop();
    inertiaAnimation = null;
  }
  
  isPinching = true;
  
  const touch1 = e.touches[0];
  const touch2 = e.touches[1];
  
  startDist = getDist(touch1, touch2);
  startScale = scale;
  lastCenter = getCenter(touch1, touch2);
  lastPos = { ...position };
  lastTimestamp = Date.now();
  velocity = { x: 0, y: 0 };
  
  // Cambiar cursor
  document.body.style.cursor = 'grabbing';
  
  return true;
}

/**
 * Maneja el movimiento durante un gesto de pinch/zoom o paneo
 * Devuelve un objeto con las actualizaciones de estado necesarias
 */
function handlePinchMove(e, stage, scale, position) {
  if (!isPinching || e.touches.length !== 2) return null;
  
  const touch1 = e.touches[0];
  const touch2 = e.touches[1];
  const currentDist = getDist(touch1, touch2);
  const currentCenter = getCenter(touch1, touch2);
  
  // Calcular delta de tiempo para velocidad
  const now = Date.now();
  const dt = (now - lastTimestamp) / 1000; // Convertir a segundos
  lastTimestamp = now;
  
  // Resultado para actualizaciones de estado
  const result = {};
  
  // CASO 1: Si la distancia cambia significativamente = ZOOM
  if (Math.abs(currentDist - startDist) > PINCH_THRESHOLD) {
    let newScale = (startScale * currentDist) / startDist;
    
    // Aplicar límites de zoom
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    
    // Ajustar posición para mantener el punto central
    const oldScale = scale;
    const oldPos = position;
    
    // Punto que debe mantenerse fijo durante el zoom
    const mousePointTo = {
      x: (currentCenter.x - oldPos.x) / oldScale,
      y: (currentCenter.y - oldPos.y) / oldScale
    };
    
    // Nueva posición que mantiene el centro fijo
    const newPos = {
      x: currentCenter.x - mousePointTo.x * newScale,
      y: currentCenter.y - mousePointTo.y * newScale
    };
    
    result.scale = newScale;
    result.position = newPos;
  } 
  // CASO 2: Si la distancia apenas cambia = PANEO con dos dedos
  else {
    const dx = currentCenter.x - lastCenter.x;
    const dy = currentCenter.y - lastCenter.y;
    
    const newPos = {
      x: lastPos.x + dx,
      y: lastPos.y + dy
    };
    
    // Calcular velocidad para inercia
    if (dt > 0) {
      velocity = {
        x: dx / dt, // pixels/segundo
        y: dy / dt
      };
    }
    
    result.position = newPos;
    lastPos = newPos;
  }
  
  lastCenter = currentCenter;
  return result;
}

/**
 * Finaliza un gesto de pinch/zoom y aplica inercia
 */
function handlePinchEnd(e, stage, position) {
  if (!isPinching) return null;
  
  isPinching = false;
  document.body.style.cursor = 'default';
  
  // Aplicar inercia solo si hay suficiente velocidad
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  if (speed > 50) {
    // Posición final con inercia
    const newPos = {
      x: position.x + velocity.x * VELOCITY_FACTOR,
      y: position.y + velocity.y * VELOCITY_FACTOR
    };
    
    // Crear animación de inercia
    inertiaAnimation = new Konva.Tween({
      node: stage,
      duration: 0.4,
      easing: Konva.Easings.EaseOut,
      x: newPos.x,
      y: newPos.y,
      onFinish: () => {
        inertiaAnimation = null;
      }
    });
    
    inertiaAnimation.play();
    return newPos;
  }
  
  return null;
}

/**
 * Función principal que conecta los gestos táctiles con Konva
 */
export function setupProcreateTouchGestures(
  stageRef, // Referencia al Stage de Konva
  scale, // Escala actual
  position, // Posición actual {x, y}
  setScale, // Función para actualizar escala
  setPosition, // Función para actualizar posición
  setIsDrawing, // Función para indicar si estamos dibujando
  setMode, // Función para cambiar entre modos (dibujo/paneo)
  previousMode, // Modo anterior al que volver
  draggableElement // Elemento que debe ser draggable/no-draggable
) {
  // Manejador de inicio de toques con detección de gestos
  const handleTouchStart = (e) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    // Si hay dos dedos, iniciar gesto de pinch/zoom
    if (e.evt.touches.length === 2) {
      const started = handlePinchStart(e.evt, stage, scale, position);
      if (started) {
        // Desactivar modo dibujo durante pinch
        setIsDrawing(false);
        // Desactivar draggable
        if (draggableElement) {
          draggableElement.draggable(false);
        }
        
        // Cambiar al modo paneo temporalmente
        setMode('panning');
      }
    }
  };
  
  // Manejador de movimiento con procesamiento por frame
  const handleTouchMove = (e) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    // Si hay dos dedos, manejar gesto de pinch/zoom
    if (e.evt.touches.length === 2) {
      const updates = handlePinchMove(e.evt, stage, scale, position);
      if (updates) {
        // Actualizar escala si cambió
        if (updates.scale !== undefined) {
          setScale(updates.scale);
          stage.scale({ x: updates.scale, y: updates.scale });
        }
        
        // Actualizar posición si cambió
        if (updates.position !== undefined) {
          setPosition(updates.position);
          stage.position(updates.position);
        }
        
        // Renderizar cambios inmediatamente
        stage.batchDraw();
      }
    }
  };
  
  // Manejador de fin de toque con inercia
  const handleTouchEnd = (e) => {
    e.evt.preventDefault();
    
    const stage = stageRef.current;
    if (!stage) return;
    
    // Finalizar gesto de pinch/zoom y aplicar inercia
    const newPosition = handlePinchEnd(e.evt, stage, position);
    if (newPosition) {
      setPosition(newPosition);
    }
    
    // Si ya no quedan dedos, restaurar el modo anterior
    if (e.evt.touches.length === 0) {
      setMode(previousMode);
      
      // Restaurar draggable según el modo
      if (draggableElement && previousMode === 'panning') {
        draggableElement.draggable(true);
      }
    }
  };
  
  return {
    handleTouchStart,
    handleTouchMove,
    handleTouchEnd
  };
}

// Exportar también utilidades individuales para casos específicos
export {
  getDist,
  getCenter,
  handlePinchStart,
  handlePinchMove,
  handlePinchEnd
};