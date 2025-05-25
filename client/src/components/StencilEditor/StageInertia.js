/**
 * StageInertia.js
 * Implementación de inercia para arrastrar y gestos táctiles en Konva
 * Soluciona el error "inertiaAnimation.stop is not a function"
 */

// Variable global para la animación de inercia
let inertiaAnimation = null;

// Variables para seguimiento del movimiento
let lastPos = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let lastTime = 0;
let isPinching = false;
let startDist = 0;
let startScale = 1;
let lastCenter = { x: 0, y: 0 };

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
 * Configura la inercia para un stage de Konva
 * @param {Konva.Stage} stage - Referencia al stage
 * @param {Function} updatePosition - Callback para actualizar posición
 */
function setupStageInertia(stage, updatePosition) {
  // Detener inercia cuando comienza un nuevo arrastre
  stage.on('dragstart', () => {
    // Verificar si hay una animación activa y detenerla con seguridad
    if (inertiaAnimation) {
      try {
        if (typeof inertiaAnimation.isRunning === 'function') {
          if (inertiaAnimation.isRunning()) {
            inertiaAnimation.stop();
          }
        } else if (typeof inertiaAnimation.stop === 'function') {
          inertiaAnimation.stop();
        }
      } catch (e) {
        console.log('Error al detener animación:', e);
      }
      inertiaAnimation = null;
    }
    
    // Inicializar variables de seguimiento
    lastTime = Date.now();
    lastPos = stage.position();
    velocity = { x: 0, y: 0 };
    
    // Cambiar cursor
    document.body.style.cursor = 'grabbing';
  });
  
  // Calcular velocidad durante el arrastre
  stage.on('dragmove', () => {
    const now = Date.now();
    const dt = (now - lastTime) / 1000; // en segundos
    lastTime = now;
    
    if (dt > 0) {
      const pos = stage.position();
      
      // Calcular velocidad con suavizado
      velocity = {
        x: 0.8 * ((pos.x - lastPos.x) / dt) + 0.2 * velocity.x,
        y: 0.8 * ((pos.y - lastPos.y) / dt) + 0.2 * velocity.y
      };
      
      lastPos = { ...pos };
    }
  });
  
  // Aplicar inercia al final del arrastre
  stage.on('dragend', () => {
    document.body.style.cursor = 'default';
    
    // Calcular magnitud de velocidad
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    // Solo aplicar inercia si hay suficiente velocidad
    if (speed > 50) {
      const pos = stage.position();
      const newPos = {
        x: pos.x + velocity.x * 0.3, // Factor de inercia
        y: pos.y + velocity.y * 0.3
      };
      
      try {
        // Crear animación de inercia
        inertiaAnimation = new Konva.Tween({
          node: stage,
          duration: 0.4,
          easing: Konva.Easings.EaseOut,
          x: newPos.x,
          y: newPos.y,
          onUpdate: () => {
            // Actualizar estado en React
            if (updatePosition) {
              updatePosition({
                x: stage.x(),
                y: stage.y()
              });
            }
          },
          onFinish: () => {
            inertiaAnimation = null;
          }
        });
        
        // Iniciar animación
        inertiaAnimation.play();
      } catch (e) {
        console.error('Error al crear animación:', e);
        inertiaAnimation = null;
      }
    }
  });
}

/**
 * Inicia un gesto de pinch-zoom
 */
function handlePinchStart(evt, stage, scale, position) {
  if (evt.touches.length !== 2) return false;
  
  // Detener cualquier animación activa
  if (inertiaAnimation) {
    try {
      // Verificar y usar el método correcto para detener
      if (typeof inertiaAnimation.isRunning === 'function') {
        if (inertiaAnimation.isRunning()) {
          inertiaAnimation.stop();
        }
      } else if (typeof inertiaAnimation.stop === 'function') {
        inertiaAnimation.stop();
      }
    } catch (e) {
      console.log('Error al detener animación:', e);
    }
    inertiaAnimation = null;
  }
  
  isPinching = true;
  
  const touch1 = evt.touches[0];
  const touch2 = evt.touches[1];
  
  startDist = getDist(touch1, touch2);
  startScale = scale;
  lastCenter = getCenter(touch1, touch2);
  lastPos = { ...position };
  lastTime = Date.now();
  velocity = { x: 0, y: 0 };
  
  // Cambiar cursor
  document.body.style.cursor = 'grabbing';
  
  return true;
}

/**
 * Maneja el movimiento durante un gesto de pinch/zoom
 */
function handlePinchMove(evt, stage, scale, position, onUpdate) {
  if (!isPinching || evt.touches.length !== 2) return null;
  
  const touch1 = evt.touches[0];
  const touch2 = evt.touches[1];
  const currentDist = getDist(touch1, touch2);
  const currentCenter = getCenter(touch1, touch2);
  
  // Calcular delta de tiempo para velocidad
  const now = Date.now();
  const dt = (now - lastTime) / 1000; // en segundos
  lastTime = now;
  
  // Resultado para actualizaciones
  const result = {};
  
  // CASO 1: Si la distancia cambia significativamente = ZOOM
  if (Math.abs(currentDist - startDist) > 4) {
    let newScale = (startScale * currentDist) / startDist;
    
    // Aplicar límites de zoom
    newScale = Math.max(0.2, Math.min(8, newScale));
    
    // Ajustar posición para mantener centro
    const mousePointTo = {
      x: (currentCenter.x - position.x) / scale,
      y: (currentCenter.y - position.y) / scale
    };
    
    const newPos = {
      x: currentCenter.x - mousePointTo.x * newScale,
      y: currentCenter.y - mousePointTo.y * newScale
    };
    
    result.scale = newScale;
    result.position = newPos;
  } 
  // CASO 2: Si la distancia apenas cambia = PANEO
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
    
    result.position = newPos;
    lastPos = { ...newPos };
  }
  
  lastCenter = { ...currentCenter };
  
  // Aplicar cambios
  if (onUpdate) {
    onUpdate(result);
  }
  
  return result;
}

/**
 * Finaliza un gesto de pinch/zoom y aplica inercia
 */
function handlePinchEnd(evt, stage, position, onUpdate) {
  if (!isPinching) return null;
  
  isPinching = false;
  document.body.style.cursor = 'default';
  
  // Calcular magnitud de velocidad
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  
  // Solo aplicar inercia si hay suficiente velocidad
  if (speed > 50) {
    // Posición final con inercia
    const newPos = {
      x: position.x + velocity.x * 0.3, // Factor de inercia
      y: position.y + velocity.y * 0.3
    };
    
    try {
      // Crear y ejecutar animación de inercia
      inertiaAnimation = new Konva.Tween({
        node: stage,
        duration: 0.4,
        easing: Konva.Easings.EaseOut,
        x: newPos.x,
        y: newPos.y,
        onUpdate: () => {
          if (onUpdate) {
            onUpdate({
              position: { 
                x: stage.x(), 
                y: stage.y() 
              }
            });
          }
        },
        onFinish: () => {
          inertiaAnimation = null;
        }
      });
      
      // Iniciar animación
      inertiaAnimation.play();
      
      return newPos;
    } catch (e) {
      console.error('Error en animación:', e);
      inertiaAnimation = null;
    }
  }
  
  return null;
}

// Exportar todas las funciones
export {
  setupStageInertia,
  handlePinchStart,
  handlePinchMove,
  handlePinchEnd,
  getDist,
  getCenter
};