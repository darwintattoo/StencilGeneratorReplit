/**
 * InertiaHandler.js
 * Manejo de inercia para interacciones táctiles en Konva.js (versión ≥ 9)
 */

// Variable global para la animación de inercia
let inertiaAnimation = null;

// Variables para tracking de movimiento
let lastPos = { x: 0, y: 0 };
let velocity = { x: 0, y: 0 };
let lastTimestamp = 0;

/**
 * Configurar la inercia para un Stage de Konva
 * @param {Object} stage - Referencia al Stage de Konva
 */
export function setupStageInertia(stage) {
  // Detener inercia cuando comienza un nuevo arrastre
  stage.on('dragstart', () => {
    // Comprobar si la animación existe y tiene método isRunning
    if (inertiaAnimation) {
      // Verificar si tiene método isRunning primero
      if (typeof inertiaAnimation.isRunning === 'function' && inertiaAnimation.isRunning()) {
        inertiaAnimation.stop();
      } 
      // Si no tiene isRunning pero sí tiene stop, intentar pararlo directamente
      else if (typeof inertiaAnimation.stop === 'function') {
        try {
          inertiaAnimation.stop();
        } catch (e) {
          console.log('Error al detener animación:', e);
        }
      }
    }
    
    // Reiniciar la referencia a la animación
    inertiaAnimation = null;
    
    // Inicializar tracking
    lastTimestamp = Date.now();
    lastPos = stage.position();
    velocity = { x: 0, y: 0 };
  });
  
  // Capturar movimiento para calcular velocidad
  stage.on('dragmove', () => {
    const now = Date.now();
    const dt = (now - lastTimestamp) / 1000; // en segundos
    lastTimestamp = now;
    
    if (dt > 0) {
      const pos = stage.position();
      
      // Calcular velocidad (pixels/segundo)
      velocity = {
        x: (pos.x - lastPos.x) / dt,
        y: (pos.y - lastPos.y) / dt
      };
      
      lastPos = pos;
    }
  });
  
  // Aplicar inercia al final del arrastre
  stage.on('dragend', () => {
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    // Solo aplicar inercia si hay suficiente velocidad
    if (speed > 50) {
      const pos = stage.position();
      const newPos = {
        x: pos.x + velocity.x * 0.3, // Factor de inercia
        y: pos.y + velocity.y * 0.3
      };
      
      // Crear nueva animación
      try {
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
        
        // Ejecutar animación
        inertiaAnimation.play();
      } catch (e) {
        console.error('Error al crear animación:', e);
        inertiaAnimation = null;
      }
    }
  });
}

/**
 * Detener cualquier animación de inercia activa
 */
export function stopInertia() {
  if (!inertiaAnimation) return;
  
  try {
    // Intentar múltiples formas de detener la animación
    if (typeof inertiaAnimation.isRunning === 'function' && inertiaAnimation.isRunning()) {
      inertiaAnimation.stop();
    } else if (typeof inertiaAnimation.stop === 'function') {
      inertiaAnimation.stop();
    } else if (inertiaAnimation._id) {
      // Último recurso: cancelar por ID si existe
      Konva.Tween.prototype._tweens.forEach(tween => {
        if (tween._id === inertiaAnimation._id) {
          tween.destroy();
        }
      });
    }
  } catch (e) {
    console.log('Error al intentar detener inercia:', e);
  }
  
  inertiaAnimation = null;
}

/**
 * Aplicar inercia después de un gesto táctil
 * @param {Object} stage - Referencia al Stage de Konva
 * @param {Object} position - Posición actual {x, y}
 * @param {Object} touchVelocity - Velocidad del gesto {x, y}
 * @param {Function} updatePosition - Función para actualizar el estado
 */
export function applyTouchInertia(stage, position, touchVelocity, updatePosition) {
  // Detener cualquier inercia previa
  stopInertia();
  
  // Calcular magnitud de velocidad
  const speed = Math.sqrt(touchVelocity.x * touchVelocity.x + touchVelocity.y * touchVelocity.y);
  
  if (speed > 50) {
    // Calcular nueva posición con inercia
    const newPos = {
      x: position.x + touchVelocity.x * 0.3,
      y: position.y + touchVelocity.y * 0.3
    };
    
    try {
      // Actualizar posición directamente primero (para respuesta inmediata)
      stage.position(position);
      
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
            updatePosition({ x: stage.x(), y: stage.y() });
          }
        }
      });
      
      // Ejecutar con verificación
      if (inertiaAnimation && typeof inertiaAnimation.play === 'function') {
        inertiaAnimation.play();
      }
    } catch (e) {
      console.error('Error en animación de inercia:', e);
    }
  }
}