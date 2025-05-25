/**
 * ProcreateInertia.js
 * 
 * Implementación robusta de gestos táctiles para Canvas/Konva con inercia
 * Soluciona el error "inertiaAnimation.stop is not a function"
 */

// Variable global para la animación de inercia
let inertiaAnimation = null;

// Variables para el seguimiento del movimiento
let lastPosition = { x: 0, y: 0 };
let startTime = 0;
let velocity = { x: 0, y: 0 };
let isPinching = false;
let startDist = 0;
let startScale = 1;
let lastCenter = { x: 0, y: 0 };

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
 * Detiene de forma segura cualquier animación de inercia
 */
function safeStopAnimation() {
  if (!inertiaAnimation) return;
  
  try {
    // Verificar si tiene método isRunning primero (Konva reciente)
    if (typeof inertiaAnimation.isRunning === 'function') {
      if (inertiaAnimation.isRunning()) {
        inertiaAnimation.stop();
      }
    } 
    // Si no tiene isRunning pero sí tiene stop
    else if (typeof inertiaAnimation.stop === 'function') {
      inertiaAnimation.stop();
    }
  } catch (e) {
    console.log('Error al detener animación:', e);
  }
  
  // Siempre establecer a null para limpiar la referencia
  inertiaAnimation = null;
}

/**
 * Configura la inercia para un Stage de Konva
 */
function setupProcreateInertia(stage, updatePosition) {
  if (!stage) return;
  
  // Iniciar arrastre
  stage.on('dragstart', () => {
    // Detener cualquier animación en curso
    safeStopAnimation();
    
    // Inicializar variables de seguimiento
    lastPosition = stage.position();
    startTime = Date.now();
    velocity = { x: 0, y: 0 };
    
    // Cambiar cursor
    document.body.style.cursor = 'grabbing';
  });
  
  // Durante el arrastre
  stage.on('dragmove', () => {
    const currentTime = Date.now();
    const currentPos = stage.position();
    const elapsed = (currentTime - startTime) / 1000; // en segundos
    
    if (elapsed > 0) {
      // Calcular velocidad con factor de suavizado
      velocity = {
        x: 0.8 * ((currentPos.x - lastPosition.x) / elapsed) + 0.2 * velocity.x,
        y: 0.8 * ((currentPos.y - lastPosition.y) / elapsed) + 0.2 * velocity.y
      };
    }
    
    // Actualizar variables para siguiente cálculo
    lastPosition = { ...currentPos };
    startTime = currentTime;
  });
  
  // Finalizar arrastre
  stage.on('dragend', () => {
    document.body.style.cursor = 'default';
    
    // Calcular magnitud de velocidad
    const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
    
    // Solo aplicar inercia si hay suficiente velocidad
    if (speed > 50) {
      const currentPos = stage.position();
      
      // Calcular posición final con inercia
      const targetPos = {
        x: currentPos.x + velocity.x * 0.3, // Factor de inercia
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
      } catch (error) {
        console.error('Error al crear animación:', error);
        inertiaAnimation = null;
      }
    }
  });
  
  // Devolver funciones para gestos táctiles
  return {
    // Iniciar pinch zoom
    handlePinchStart: (e) => {
      const evt = e.evt || e;
      
      if (evt.touches.length !== 2) return false;
      
      // Detener cualquier animación activa
      safeStopAnimation();
      
      isPinching = true;
      
      const touch1 = evt.touches[0];
      const touch2 = evt.touches[1];
      
      startDist = getDist(touch1, touch2);
      startScale = stage.scaleX();
      lastCenter = getCenter(touch1, touch2);
      lastPosition = stage.position();
      startTime = Date.now();
      velocity = { x: 0, y: 0 };
      
      return true;
    },
    
    // Mover durante pinch zoom
    handlePinchMove: (e, onUpdate) => {
      const evt = e.evt || e;
      
      if (!isPinching || evt.touches.length !== 2) return;
      
      const touch1 = evt.touches[0];
      const touch2 = evt.touches[1];
      const currentDist = getDist(touch1, touch2);
      const currentCenter = getCenter(touch1, touch2);
      
      // Calcular tiempo transcurrido
      const currentTime = Date.now();
      const elapsed = (currentTime - startTime) / 1000; // segundos
      
      // CASO 1: Si la distancia entre dedos cambia significativamente = ZOOM
      if (Math.abs(currentDist - startDist) > 4) {
        let newScale = (startScale * currentDist) / startDist;
        
        // Aplicar límites de zoom
        newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, newScale));
        
        // Ajustar posición para mantener el punto entre los dedos fijo
        const stagePos = stage.position();
        const oldScale = stage.scaleX();
        
        const mousePointTo = {
          x: (currentCenter.x - stagePos.x) / oldScale,
          y: (currentCenter.y - stagePos.y) / oldScale
        };
        
        const newPos = {
          x: currentCenter.x - mousePointTo.x * newScale,
          y: currentCenter.y - mousePointTo.y * newScale
        };
        
        // Actualizar escala y posición
        stage.scale({ x: newScale, y: newScale });
        stage.position(newPos);
        
        // Notificar cambios
        if (onUpdate) {
          onUpdate({
            scale: newScale,
            position: newPos
          });
        }
      } 
      // CASO 2: Si la distancia apenas cambia = PANEO con dos dedos
      else {
        const dx = currentCenter.x - lastCenter.x;
        const dy = currentCenter.y - lastCenter.y;
        
        // Calcular nueva posición
        const currentPos = stage.position();
        const newPos = {
          x: currentPos.x + dx,
          y: currentPos.y + dy
        };
        
        // Calcular velocidad para inercia
        if (elapsed > 0) {
          velocity = {
            x: dx / elapsed,
            y: dy / elapsed
          };
        }
        
        // Actualizar posición
        stage.position(newPos);
        
        // Notificar cambios
        if (onUpdate) {
          onUpdate({
            position: newPos
          });
        }
      }
      
      // Actualizar variables para siguiente movimiento
      lastCenter = { ...currentCenter };
      startTime = currentTime;
      
      // Forzar renderizado
      stage.batchDraw();
    },
    
    // Finalizar pinch zoom
    handlePinchEnd: (e, onUpdate) => {
      const evt = e.evt || e;
      
      if (!isPinching) return;
      
      isPinching = false;
      
      // Aplicar inercia solo si hay suficiente velocidad
      const speed = Math.sqrt(velocity.x * velocity.x + velocity.y * velocity.y);
      
      if (speed > 50) {
        const currentPos = stage.position();
        
        // Calcular posición final con inercia
        const targetPos = {
          x: currentPos.x + velocity.x * 0.3,
          y: currentPos.y + velocity.y * 0.3
        };
        
        try {
          // Crear animación
          inertiaAnimation = new Konva.Tween({
            node: stage,
            duration: 0.4,
            easing: Konva.Easings.EaseOut,
            x: targetPos.x,
            y: targetPos.y,
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
        } catch (error) {
          console.error('Error al crear animación de inercia:', error);
          inertiaAnimation = null;
        }
      }
    }
  };
}

// Exportar funciones
export {
  setupProcreateInertia,
  safeStopAnimation,
  getDist,
  getCenter
};