/**
 * PanInertia.js
 * Implementación de inercia para arrastrar en Konva.js ≥ 9
 */

// Variable global para la animación de inercia
let inertiaAnimation = null;

// Variables para seguimiento del movimiento
let lastPos = null;
let startTime = 0;
let velocity = { x: 0, y: 0 };

/**
 * Configurar los eventos de inercia en un stage de Konva
 * @param {Object} stage - Stage de Konva
 * @param {Function} updatePosition - Función para actualizar estado de posición
 */
function setupPanInertia(stage, updatePosition) {
  // Iniciar arrastre
  stage.on('dragstart', () => {
    // Si hay una animación en curso, intentar detenerla de forma segura
    if (inertiaAnimation) {
      try {
        // Verificar si existe el método isRunning (versiones recientes de Konva)
        if (inertiaAnimation.isRunning && inertiaAnimation.isRunning()) {
          inertiaAnimation.stop();
        } 
        // Para versiones que no tienen isRunning
        else if (typeof inertiaAnimation.stop === 'function') {
          inertiaAnimation.stop();
        }
      } catch (error) {
        console.log('Error al detener animación:', error);
      }
      inertiaAnimation = null;
    }
    
    // Inicializar variables de seguimiento
    lastPos = stage.position();
    startTime = Date.now();
    
    // Cambiar cursor
    document.body.style.cursor = 'grabbing';
  });
  
  // Durante el arrastre
  stage.on('dragmove', () => {
    // Calcular velocidad instantánea
    const currentTime = Date.now();
    const currentPos = stage.position();
    
    if (lastPos && currentTime > startTime) {
      const elapsed = (currentTime - startTime) / 1000; // segundos
      
      if (elapsed > 0) {
        // Calcular velocidad con suavizado (80% nuevo, 20% anterior)
        velocity = {
          x: 0.8 * ((currentPos.x - lastPos.x) / elapsed) + 0.2 * velocity.x,
          y: 0.8 * ((currentPos.y - lastPos.y) / elapsed) + 0.2 * velocity.y
        };
      }
    }
    
    // Actualizar posición y tiempo para siguiente cálculo
    lastPos = currentPos;
    startTime = currentTime;
  });
  
  // Finalizar arrastre y aplicar inercia
  stage.on('dragend', () => {
    // Restaurar cursor
    document.body.style.cursor = 'default';
    
    // Calcular velocidad total
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    // Solo aplicar inercia si hay suficiente velocidad
    if (speed > 50) {
      const currentPos = stage.position();
      
      // Calcular posición final con inercia
      const targetPos = {
        x: currentPos.x + velocity.x * 0.3, // Factor de desaceleración
        y: currentPos.y + velocity.y * 0.3
      };
      
      try {
        // Crear animación con Konva.Tween
        inertiaAnimation = new Konva.Tween({
          node: stage,
          duration: 0.4,
          easing: Konva.Easings.EaseOut,
          x: targetPos.x,
          y: targetPos.y,
          onUpdate: () => {
            // Actualizar estado en React durante la animación
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
      } catch (error) {
        console.error('Error al crear animación:', error);
        inertiaAnimation = null;
      }
    }
  });
}

export default setupPanInertia;