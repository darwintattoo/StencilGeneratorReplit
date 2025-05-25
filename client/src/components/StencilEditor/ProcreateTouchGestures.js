/**
 * ProcreateTouchGestures.js
 * Implementación de gestos táctiles avanzados al estilo Procreate para
 * el editor de stencils
 */

// Variables globales para el seguimiento de gestos
let isPinching = false;
let startDist = 0;
let startScale = 1;
let lastCenter = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let lastPos = { x: 0, y: 0 };
let lastTimestamp = 0;
let animFrame = null;
let inertiaAnimation = null;

// Límites de zoom
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

/**
 * Calcula la distancia entre dos puntos táctiles
 */
function getDist(touch1, touch2) {
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
}

/**
 * Calcula el punto medio entre dos puntos táctiles
 */
function getCenter(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
}

/**
 * Aplica throttling a una función usando requestAnimationFrame
 */
function throttle(func) {
  return function(...args) {
    if (!animFrame) {
      animFrame = requestAnimationFrame(() => {
        func.apply(this, args);
        animFrame = null;
      });
    }
  };
}

// Función auxiliar para obtener posición del puntero dentro del Stage
function getRelativePointerPosition(stage, clientX, clientY) {
  const rect = stage.container().getBoundingClientRect();
  return {
    x: clientX - rect.left,
    y: clientY - rect.top
  };
}

/**
 * Inicia un gesto de pinch-zoom
 */
function handlePinchStart(evt, stage, scale, position) {
  // Cancelar cualquier animación de inercia
  if (inertiaAnimation) {
    inertiaAnimation.stop();
    inertiaAnimation = null;
  }
  
  // Solo proceder si hay exactamente dos dedos
  if (evt.touches.length !== 2) return false;
  
  isPinching = true;
  
  const touch1 = evt.touches[0];
  const touch2 = evt.touches[1];
  
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
 * Maneja el movimiento durante un gesto de pinch-zoom
 */
const handlePinchMove = throttle((evt, stage, scale, position, onUpdateState) => {
  if (!isPinching || evt.touches.length !== 2) return;
  
  const touch1 = evt.touches[0];
  const touch2 = evt.touches[1];
  const currentDist = getDist(touch1, touch2);
  const currentCenter = getCenter(touch1, touch2);
  
  // Calcular delta de tiempo para velocidad
  const now = Date.now();
  const dt = (now - lastTimestamp) / 1000; // en segundos
  lastTimestamp = now;
  
  // CASO 1: Si la distancia cambia significativamente = ZOOM
  if (Math.abs(currentDist - startDist) > 4) {
    let newScale = (startScale * currentDist) / startDist;
    
    // Aplicar límites de zoom
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    
    // Ajustar posición para mantener el punto central
    const mousePointTo = {
      x: (currentCenter.x - position.x) / scale,
      y: (currentCenter.y - position.y) / scale
    };
    
    const newPos = {
      x: currentCenter.x - mousePointTo.x * newScale,
      y: currentCenter.y - mousePointTo.y * newScale
    };
    
    // Actualizar estado
    onUpdateState({
      scale: newScale,
      position: newPos
    });
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
        x: dx / dt,
        y: dy / dt
      };
    }
    
    // Actualizar estado
    onUpdateState({
      position: newPos
    });
    
    lastPos = newPos;
  }
  
  lastCenter = currentCenter;
});

/**
 * Finaliza un gesto de pinch-zoom y aplica inercia
 */
function handlePinchEnd(evt, stage, position, onUpdateState) {
  if (!isPinching) return;
  
  isPinching = false;
  document.body.style.cursor = 'default';
  
  // Aplicar inercia solo si hay suficiente velocidad
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  
  if (speed > 50) {
    // Calcular posición final con inercia
    const newPos = {
      x: position.x + velocity.x * 0.3, // Factor de inercia
      y: position.y + velocity.y * 0.3
    };
    
    // Animar con inercia
    inertiaAnimation = new Konva.Tween({
      node: stage,
      duration: 0.4,
      easing: Konva.Easings.EaseOut,
      x: newPos.x,
      y: newPos.y,
      onUpdate: () => {
        onUpdateState({
          position: { x: stage.x(), y: stage.y() }
        });
      },
      onFinish: () => {
        inertiaAnimation = null;
      }
    });
    
    inertiaAnimation.play();
  }
}

/**
 * Maneja el evento de rueda de ratón (para zoom en escritorio)
 */
const handleWheel = throttle((evt, stage, scale, position, onUpdateState) => {
  evt.preventDefault();
  
  const oldScale = scale;
  const pointer = stage.getPointerPosition();
  
  // Punto a mantener fijo durante el zoom
  const mousePointTo = {
    x: (pointer.x - position.x) / oldScale,
    y: (pointer.y - position.y) / oldScale,
  };
  
  // Factor de zoom más suave
  const scaleBy = 1.05;
  const direction = evt.deltaY > 0 ? 1 : -1;
  
  // Calcular nuevo zoom
  let newScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;
  newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
  
  // Calcular nueva posición manteniendo el punto bajo el cursor fijo
  const newPos = {
    x: pointer.x - mousePointTo.x * newScale,
    y: pointer.y - mousePointTo.y * newScale,
  };
  
  onUpdateState({
    scale: newScale,
    position: newPos,
  });
});

/**
 * Función principal para configurar los gestos táctiles
 */
export function setupTouchGestures(
  stageRef,         // Referencia al Stage de Konva
  scaleValue,       // Valor actual de escala
  positionValue,    // Valor actual de posición {x, y}
  setScale,         // Función para actualizar escala
  setPosition,      // Función para actualizar posición
  setMode,          // Función para cambiar entre modos (dibujo/navegación)
  setIsDrawing,     // Función para activar/desactivar dibujo
  currentMode,      // Modo actual
  setIsDragging     // Función para activar/desactivar arrastre
) {
  const onUpdateState = (updates) => {
    if (updates.scale !== undefined) {
      setScale(updates.scale);
    }
    if (updates.position !== undefined) {
      setPosition(updates.position);
    }
  };
  
  return {
    handleTouchStart: (e) => {
      const evt = e.evt;
      evt.preventDefault();
      
      const stage = stageRef.current;
      if (!stage) return;
      
      // Caso: dos dedos - iniciar pinch/zoom
      if (evt.touches.length === 2) {
        // Guardar modo actual para restaurarlo después
        const currentModeBeforePinch = currentMode;
        
        // Iniciar gesto de pinch
        if (handlePinchStart(evt, stage, scaleValue, positionValue)) {
          // Desactivar dibujo durante el pinch
          setIsDrawing(false);
          // Cambiar a modo navegación temporalmente
          setMode('panning');
          // Activar arrastre para permitir movimiento
          setIsDragging(true);
        }
      }
    },
    
    handleTouchMove: (e) => {
      const evt = e.evt;
      evt.preventDefault();
      
      const stage = stageRef.current;
      if (!stage) return;
      
      // Caso: dos dedos - pinch/zoom o paneo
      if (evt.touches.length === 2) {
        handlePinchMove(evt, stage, scaleValue, positionValue, onUpdateState);
      }
    },
    
    handleTouchEnd: (e) => {
      const evt = e.evt;
      evt.preventDefault();
      
      const stage = stageRef.current;
      if (!stage) return;
      
      // Finalizar gesto de pinch y aplicar inercia si es necesario
      handlePinchEnd(evt, stage, positionValue, onUpdateState);
      
      // Si ya no quedan dedos, restaurar el modo anterior
      if (evt.touches.length === 0) {
        setIsDragging(false);
      }
    },
    
    // Manejador de rueda para escritorio
    handleWheel: (e) => {
      handleWheel(
        e.evt, 
        stageRef.current, 
        scaleValue, 
        positionValue, 
        onUpdateState
      );
    }
  };
}

// Exportar también las funciones individuales para uso específico
export {
  getDist,
  getCenter,
  handlePinchStart,
  handlePinchMove,
  handlePinchEnd,
  handleWheel
};