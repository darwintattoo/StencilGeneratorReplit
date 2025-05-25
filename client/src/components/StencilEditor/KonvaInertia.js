/**
 * KonvaInertia.js
 * Implementación de inercia para arrastrar y gestos táctiles en Konva.js
 * Compatible con Konva ≥ 9
 */

// Variable global para la animación de inercia
let inertiaAnimation = null;

// Variables para seguimiento del movimiento
let lastPosition = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let lastTimestamp = 0;
let isDragging = false;

/**
 * Configura inercia para un stage de Konva
 * @param {Konva.Stage} stage - El stage de Konva
 * @param {Function} onPositionChange - Callback para actualizar estado de posición
 */
function setupInertia(stage, onPositionChange) {
  // Capturar inicio de arrastre
  stage.on('dragstart', () => {
    // Detener cualquier animación existente
    if (inertiaAnimation) {
      try {
        // Verificar si la animación tiene método stop y está corriendo
        if (inertiaAnimation.isRunning && inertiaAnimation.isRunning()) {
          inertiaAnimation.stop();
        } else if (typeof inertiaAnimation.stop === 'function') {
          inertiaAnimation.stop();
        }
      } catch (e) {
        console.log('Error al detener animación:', e);
      }
      inertiaAnimation = null;
    }
    
    isDragging = true;
    lastTimestamp = Date.now();
    lastPosition = stage.position();
    velocity = { x: 0, y: 0 };
    
    // Cambiar cursor durante el arrastre
    document.body.style.cursor = 'grabbing';
  });
  
  // Capturar durante el arrastre para calcular velocidad
  stage.on('dragmove', () => {
    if (!isDragging) return;
    
    // Calcular delta de tiempo
    const now = Date.now();
    const dt = (now - lastTimestamp) / 1000; // en segundos
    lastTimestamp = now;
    
    // Solo actualizar si ha pasado tiempo suficiente
    if (dt > 0) {
      const currentPos = stage.position();
      
      // Calcular velocidad (usar media ponderada para suavizar)
      velocity = {
        x: 0.8 * ((currentPos.x - lastPosition.x) / dt) + 0.2 * velocity.x,
        y: 0.8 * ((currentPos.y - lastPosition.y) / dt) + 0.2 * velocity.y
      };
      
      lastPosition = currentPos;
    }
  });
  
  // Capturar fin de arrastre para aplicar inercia
  stage.on('dragend', () => {
    isDragging = false;
    document.body.style.cursor = 'default';
    
    // Calcular magnitud de velocidad
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    // Solo aplicar inercia si hay suficiente velocidad
    if (speed > 50) {
      // Posición final prevista con inercia
      const currentPos = stage.position();
      const targetPos = {
        x: currentPos.x + velocity.x * 0.3, // Factor de inercia
        y: currentPos.y + velocity.y * 0.3
      };
      
      try {
        // Crear animación de inercia
        inertiaAnimation = new Konva.Tween({
          node: stage,
          duration: 0.4,
          easing: Konva.Easings.EaseOut,
          x: targetPos.x,
          y: targetPos.y,
          onUpdate: () => {
            // Callback para actualizar estado en componente React
            if (onPositionChange) {
              onPositionChange({ x: stage.x(), y: stage.y() });
            }
          },
          onFinish: () => {
            inertiaAnimation = null;
          }
        });
        
        // Iniciar animación
        inertiaAnimation.play();
      } catch (e) {
        console.error('Error al crear animación de inercia:', e);
      }
    }
  });
}

/**
 * Detiene cualquier animación de inercia activa
 */
function stopInertia() {
  if (!inertiaAnimation) return;
  
  try {
    // Verificación robusta para diferentes versiones de Konva
    if (inertiaAnimation.isRunning && inertiaAnimation.isRunning()) {
      inertiaAnimation.stop();
    } else if (typeof inertiaAnimation.stop === 'function') {
      inertiaAnimation.stop();
    }
  } catch (e) {
    console.log('Error al detener inercia:', e);
  }
  
  inertiaAnimation = null;
}

/**
 * Maneja el inicio de un gesto multitáctil (pinch/zoom)
 */
function handlePinchStart() {
  // Detener cualquier animación de inercia
  stopInertia();
  
  // Reiniciar variables
  velocity = { x: 0, y: 0 };
  lastTimestamp = Date.now();
  
  return true;
}

/**
 * Aplica inercia después de un gesto multitáctil
 */
function applyTouchInertia(stage, position, velocity, onPositionChange) {
  // Calcular magnitud de velocidad
  const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
  
  // Solo aplicar inercia si hay suficiente velocidad
  if (speed > 50) {
    // Posición final con inercia
    const targetPos = {
      x: position.x + velocity.x * 0.3,
      y: position.y + velocity.y * 0.3
    };
    
    try {
      // Crear y ejecutar animación de inercia
      inertiaAnimation = new Konva.Tween({
        node: stage,
        duration: 0.4,
        easing: Konva.Easings.EaseOut,
        x: targetPos.x,
        y: targetPos.y,
        onUpdate: () => {
          if (onPositionChange) {
            onPositionChange({ x: stage.x(), y: stage.y() });
          }
        },
        onFinish: () => {
          inertiaAnimation = null;
        }
      });
      
      // Iniciar animación con verificación
      if (inertiaAnimation && typeof inertiaAnimation.play === 'function') {
        inertiaAnimation.play();
      }
    } catch (e) {
      console.error('Error en animación táctil:', e);
      inertiaAnimation = null;
    }
  }
}

// Exportar todas las funciones
export {
  setupInertia,
  stopInertia,
  handlePinchStart,
  applyTouchInertia
};