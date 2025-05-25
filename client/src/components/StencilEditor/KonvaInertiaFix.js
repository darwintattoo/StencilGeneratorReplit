/**
 * Solución para el error "inertiaAnimation.stop is not a function" 
 * Compatible con Konva ≥ 9
 */

// Variable global para la animación de inercia
let inertiaAnimation = null;

// Listener dragstart para detener animaciones anteriores
stage.on('dragstart', () => {
  if (inertiaAnimation && inertiaAnimation.isRunning()) inertiaAnimation.stop();
  inertiaAnimation = null;
  
  document.body.style.cursor = 'grabbing';
  
  // Inicializar variables para calcular velocidad
  lastPos = stage.position();
  lastTime = Date.now();
  velocity = { x: 0, y: 0 };
});

// Listener dragmove para calcular velocidad
stage.on('dragmove', () => {
  const now = Date.now();
  const dt = (now - lastTime) / 1000; // en segundos
  lastTime = now;
  
  const pos = stage.position();
  
  // Calcular velocidad con suavizado
  if (dt > 0) {
    velocity = {
      x: 0.8 * ((pos.x - lastPos.x) / dt) + 0.2 * velocity.x,
      y: 0.8 * ((pos.y - lastPos.y) / dt) + 0.2 * velocity.y
    };
  }
  
  lastPos = { ...pos };
});

// Listener dragend para aplicar inercia
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
    
    // Crear animación de inercia
    inertiaAnimation = new Konva.Tween({
      node: stage,
      duration: 0.4,
      easing: Konva.Easings.EaseOut,
      x: newPos.x,
      y: newPos.y,
      onUpdate: () => {
        // Actualizar estado en React
        if (onPositionChange) {
          onPositionChange({
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
  }
});