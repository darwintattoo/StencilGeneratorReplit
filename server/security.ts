import { Request, Response, NextFunction } from 'express';

// Middleware de validación de entrada para prevenir inyecciones
export function validateInput(req: Request, res: Response, next: NextFunction) {
  const { body, query, params } = req;
  
  // Patrones peligrosos que podrían indicar ataques
  const dangerousPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi,
    /eval\s*\(/gi,
    /expression\s*\(/gi,
    /vbscript:/gi,
    /data:text\/html/gi
  ];
  
  // Función para validar recursivamente objetos
  function validateObject(obj: any): boolean {
    if (typeof obj === 'string') {
      return !dangerousPatterns.some(pattern => pattern.test(obj));
    }
    if (typeof obj === 'object' && obj !== null) {
      return Object.values(obj).every(validateObject);
    }
    return true;
  }
  
  // Validar todas las entradas
  if (!validateObject(body) || !validateObject(query) || !validateObject(params)) {
    return res.status(400).json({ message: 'Invalid input detected' });
  }
  
  next();
}

// Middleware para sanitizar file uploads
export function validateFileUpload(req: Request, res: Response, next: NextFunction) {
  if (req.files || req.file) {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg', 
      'image/png',
      'image/webp'
    ];
    
    const files = req.files as any || [req.file];
    
    for (const file of Array.isArray(files) ? files : [files]) {
      if (file && !allowedMimeTypes.includes(file.mimetype)) {
        return res.status(400).json({ message: 'Invalid file type. Only images allowed.' });
      }
      
      // Limitar tamaño de archivo (20MB)
      if (file && file.size > 20 * 1024 * 1024) {
        return res.status(400).json({ message: 'File too large. Maximum size is 20MB.' });
      }
    }
  }
  
  next();
}

// Middleware para prevenir path traversal
export function preventPathTraversal(req: Request, res: Response, next: NextFunction) {
  const { path } = req;
  
  // Patrones peligrosos para path traversal
  const dangerousPaths = [
    /\.\./g,
    /~\//g,
    /\/\.\//g,
    /\\\.\.\\?/g
  ];
  
  if (dangerousPaths.some(pattern => pattern.test(path))) {
    return res.status(403).json({ message: 'Access denied' });
  }
  
  next();
}

// Middleware para logging de seguridad (solo en producción)
export function securityLogging(req: Request, res: Response, next: NextFunction) {
  if (process.env.NODE_ENV === "production") {
    const suspiciousPatterns = [
      /admin/i,
      /\.env/i,
      /config/i,
      /wp-admin/i,
      /phpMyAdmin/i,
      /\.git/i
    ];
    
    if (suspiciousPatterns.some(pattern => pattern.test(req.path))) {
      console.warn(`Suspicious access attempt: ${req.ip} -> ${req.method} ${req.path}`);
    }
  }
  
  next();
}

// Middleware para proteger rutas administrativas
export function adminRouteProtection(req: Request, res: Response, next: NextFunction) {
  const adminPaths = ['/api/admin', '/api/debug', '/api/internal'];
  
  if (adminPaths.some(path => req.path.startsWith(path))) {
    // Solo permitir en desarrollo o con token específico
    if (process.env.NODE_ENV !== "development" && !req.headers['x-admin-token']) {
      return res.status(404).json({ message: 'Not found' });
    }
  }
  
  next();
}