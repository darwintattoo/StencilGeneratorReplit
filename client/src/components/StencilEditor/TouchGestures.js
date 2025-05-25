/**
 * TouchGestures.js - Implementación de gestos táctiles al estilo Procreate para Konva.js
 * Proporciona pinch-zoom, paneo con dos dedos e inercia para una experiencia móvil premium
 */

// Variables de estado para gestos táctiles
let isPinching = false;
let startDist = 0;
let startScale = 1;
let lastCenter = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let lastPos = { x: 0, y: 0 };
let lastTimestamp = 0;
let animationFrame = null;
let inertiaAnimation = null;

// Límites de zoom
const MIN_SCALE = 0.2;
const MAX_SCALE = 8;

/**
 * Calcula la distancia entre dos puntos táctiles
 * @param {Touch} touch1 - Primer punto de contacto
 * @param {Touch} touch2 - Segundo punto de contacto
 * @return {number} Distancia en píxeles
 */
function getDist(touch1, touch2) {
  return Math.sqrt(
    Math.pow(touch2.clientX - touch1.clientX, 2) +
    Math.pow(touch2.clientY - touch1.clientY, 2)
  );
}

/**
 * Calcula el punto medio entre dos puntos táctiles
 * @param {Touch} touch1 - Primer punto de contacto
 * @param {Touch} touch2 - Segundo punto de contacto
 * @return {Object} Coordenadas {x, y} del punto medio
 */
function getCenter(touch1, touch2) {
  return {
    x: (touch1.clientX + touch2.clientX) / 2,
    y: (touch1.clientY + touch2.clientY) / 2
  };
}

/**
 * Aplica throttling a una función para limitar su frecuencia de ejecución
 * @param {Function} func - Función a ejecutar
 * @return {Function} Función throttled con requestAnimationFrame
 */
function throttle(func) {
  return function(...args) {
    if (!animationFrame) {
      animationFrame = requestAnimationFrame(() => {
        func.apply(this, args);
        animationFrame = null;
      });
    }
  };
}

/**
 * Maneja el inicio de un gesto de pinch/zoom con dos dedos
 * @param {Object} stage - Referencia al stage de Konva
 * @param {Object} stageState - Estado actual del stage {scale, position, etc}
 * @param {TouchEvent} e - Evento táctil
 */
function handlePinchStart(stage, stageState, e) {
  // Si hay una animación de inercia activa, cancelarla
  if (inertiaAnimation) {
    inertiaAnimation.stop();
    inertiaAnimation = null;
  }

  // Solo proceder si hay exactamente dos dedos en la pantalla
  if (e.touches.length !== 2) return;

  e.evt.preventDefault();
  isPinching = true;
  
  // Desactivar arrastre y otros modos durante el pinch
  stage.draggable(false);
  
  // Guardar estado inicial
  const touch1 = e.evt.touches[0];
  const touch2 = e.evt.touches[1];
  
  startDist = getDist(touch1, touch2);
  startScale = stageState.scale;
  lastCenter = getCenter(touch1, touch2);
  lastPos = { ...stageState.position };
  lastTimestamp = Date.now();
  velocity = { x: 0, y: 0 };
  
  // Indicador visual para el usuario
  document.body.style.cursor = 'grabbing';
}

/**
 * Maneja el movimiento durante un gesto de pinch/zoom
 * @param {Object} stage - Referencia al stage de Konva
 * @param {Object} stageState - Estado actual del stage {scale, position, etc}
 * @param {Function} setStageState - Función para actualizar el estado del stage
 * @param {TouchEvent} e - Evento táctil
 */
const handlePinchMove = throttle((stage, stageState, setStageState, e) => {
  if (!isPinching || e.evt.touches.length !== 2) return;
  
  e.evt.preventDefault();
  
  const touch1 = e.evt.touches[0];
  const touch2 = e.evt.touches[1];
  const currentDist = getDist(touch1, touch2);
  const currentCenter = getCenter(touch1, touch2);
  
  // Calcular la diferencia de tiempo para la velocidad
  const now = Date.now();
  const dt = (now - lastTimestamp) / 1000; // en segundos
  lastTimestamp = now;
  
  // CASO 1: Si la distancia entre dedos cambia significativamente = ZOOM
  if (Math.abs(currentDist - startDist) > 4) {
    let newScale = (startScale * currentDist) / startDist;
    
    // Aplicar límites de zoom
    newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
    
    // Ajustar posición para mantener el punto entre los dedos como centro del zoom
    const oldScale = stageState.scale;
    const oldPos = stageState.position;
    const mousePointTo = {
      x: (currentCenter.x - oldPos.x) / oldScale,
      y: (currentCenter.y - oldPos.y) / oldScale
    };
    
    const newPos = {
      x: currentCenter.x - mousePointTo.x * newScale,
      y: currentCenter.y - mousePointTo.y * newScale
    };
    
    // Actualizar estado y renderizar
    setStageState({
      scale: newScale,
      position: newPos
    });
  } 
  // CASO 2: Si la distancia apenas cambia = PANEO (dos dedos)
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
    
    // Actualizar estado y renderizar
    setStageState({
      position: newPos
    });
    
    // Actualizar posición para referencia
    lastPos = newPos;
  }
  
  lastCenter = currentCenter;
  stage.batchDraw();
});

/**
 * Maneja el final de un gesto de pinch/zoom
 * @param {Object} stage - Referencia al stage de Konva
 * @param {Object} stageState - Estado actual del stage {scale, position, etc}
 * @param {Function} setStageState - Función para actualizar el estado del stage
 * @param {Function} setMode - Función para actualizar el modo actual (dibujo/navegación)
 * @param {string} previousMode - Modo anterior a restaurar cuando termine el gesto
 */
function handlePinchEnd(stage, stageState, setStageState, setMode, previousMode) {
  if (!isPinching) return;
  
  isPinching = false;
  document.body.style.cursor = 'default';
  
  // Restaurar el modo anterior
  setMode(previousMode);
  
  // Aplicar inercia solo si hay suficiente velocidad
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  if (speed > 50) {
    // Calcular posición final con inercia (velocidad decayendo)
    const newPos = {
      x: stageState.position.x + velocity.x * 0.3,
      y: stageState.position.y + velocity.y * 0.3
    };
    
    // Animar con inercia
    inertiaAnimation = new Konva.Tween({
      node: stage,
      duration: 0.4,
      easing: Konva.Easings.EaseOut,
      x: newPos.x,
      y: newPos.y,
      onUpdate: () => {
        setStageState({
          position: { x: stage.x(), y: stage.y() }
        });
      },
      onFinish: () => {
        inertiaAnimation = null;
      }
    }).play();
  }
}

/**
 * Inicializa los eventos táctiles en un componente de Konva
 * @param {Object} stage - Referencia al stage de Konva
 * @param {Object} stageState - Estado actual del stage {scale, position, etc}
 * @param {Function} setStageState - Función para actualizar el estado del stage
 * @param {string} mode - Modo actual ('drawing' o 'panning')
 * @param {Function} setMode - Función para actualizar el modo
 * @param {string} tool - Herramienta actual ('brush' o 'eraser')
 * @return {Object} Handlers para los eventos touch
 */
export function setupTouchGestures(stage, stageState, setStageState, mode, setMode, tool) {
  // Guardamos el modo actual para restaurarlo después del gesto
  const previousMode = mode;
  
  return {
    onTouchStart: (e) => {
      if (e.evt.touches.length === 2) {
        handlePinchStart(stage, stageState, e);
      }
    },
    onTouchMove: (e) => {
      if (e.evt.touches.length === 2) {
        handlePinchMove(stage, stageState, setStageState, e);
      }
    },
    onTouchEnd: (e) => {
      // Al finalizar el último toque, volver al modo previo
      if (e.evt.touches.length === 0) {
        handlePinchEnd(stage, stageState, setStageState, setMode, previousMode);
      }
    },
    // Estos son para la rueda del ratón en desktop
    onWheel: throttle((e) => {
      e.evt.preventDefault();
      
      const stage = e.target.getStage();
      const oldScale = stageState.scale;
      const pointer = stage.getPointerPosition();
      
      const mousePointTo = {
        x: (pointer.x - stageState.position.x) / oldScale,
        y: (pointer.y - stageState.position.y) / oldScale,
      };
      
      // Factor de zoom con la rueda (más suave)
      const scaleBy = 1.05;
      const direction = e.evt.deltaY > 0 ? 1 : -1;
      
      // Calcular nuevo zoom
      let newScale = direction > 0 ? oldScale / scaleBy : oldScale * scaleBy;
      newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
      
      // Calcular nueva posición manteniendo el punto bajo el cursor fijo
      const newPos = {
        x: pointer.x - mousePointTo.x * newScale,
        y: pointer.y - mousePointTo.y * newScale,
      };
      
      setStageState({
        scale: newScale,
        position: newPos,
      });
      
      stage.batchDraw();
    }),
  };
}

/**
 * Componente de botones para alternar entre herramientas
 * @param {string} currentTool - Herramienta actual ('brush' o 'eraser')
 * @param {Function} setTool - Función para actualizar la herramienta
 */
export function ToolButtons({ currentTool, setTool }) {
  // Ejemplo de botones para cambiar entre pincel y borrador
  return `
    <div class="tool-buttons">
      <button 
        class="${currentTool === 'brush' ? 'active' : ''}"
        onclick="setTool('brush')">
        Pincel
      </button>
      <button 
        class="${currentTool === 'eraser' ? 'active' : ''}"
        onclick="setTool('eraser')">
        Borrador
      </button>
    </div>
  `;
}