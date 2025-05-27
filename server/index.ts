import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { validateInput, validateFileUpload, preventPathTraversal, securityLogging, adminRouteProtection } from "./security";

const app = express();

// Configuración de seguridad robusta
app.disable('x-powered-by'); // Ocultar que usa Express
app.use(express.json({ limit: "10mb" })); // Limitar tamaño de payload
app.use(express.urlencoded({ extended: false, limit: "10mb" }));

// Headers de seguridad esenciales
app.use((req, res, next) => {
  // Prevenir ataques de clickjacking
  res.setHeader('X-Frame-Options', 'DENY');
  // Prevenir ataques MIME type sniffing
  res.setHeader('X-Content-Type-Options', 'nosniff');
  // Habilitar protección XSS del navegador
  res.setHeader('X-XSS-Protection', '1; mode=block');
  // Política de referrer más restrictiva
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  // Política de contenido estricta para TattooStencilPro
  res.setHeader('Content-Security-Policy', 
    "default-src 'self'; " +
    "img-src 'self' data: blob: https://comfy-deploy-output.s3.us-east-2.amazonaws.com; " +
    "script-src 'self' 'unsafe-inline' 'unsafe-eval'; " +
    "style-src 'self' 'unsafe-inline'; " +
    "font-src 'self' data:; " +
    "connect-src 'self' https://api.comfydeploy.com ws: wss:;"
  );
  next();
});

// Rate limiting inteligente
const requestCounts = new Map();
app.use((req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = Date.now();
  const windowMs = 60000; // 1 minuto
  const maxRequests = req.path.startsWith('/api/generate') ? 10 : 100; // Límite más estricto para generación
  
  if (!requestCounts.has(ip)) {
    requestCounts.set(ip, { count: 1, resetTime: now + windowMs });
  } else {
    const clientData = requestCounts.get(ip);
    if (now > clientData.resetTime) {
      clientData.count = 1;
      clientData.resetTime = now + windowMs;
    } else {
      clientData.count++;
      if (clientData.count > maxRequests) {
        return res.status(429).json({ message: 'Rate limit exceeded. Please try again later.' });
      }
    }
  }
  next();
});

// Aplicar middlewares de seguridad
app.use(securityLogging);
app.use(preventPathTraversal);
app.use(adminRouteProtection);
app.use(validateInput);
app.use(validateFileUpload);

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    
    // En producción, no exponer detalles internos del servidor
    let message;
    if (process.env.NODE_ENV === "production") {
      if (status >= 500) {
        message = "Service temporarily unavailable";
        // Loggear el error real internamente sin exponerlo
        console.error(`Internal error on ${req.method} ${req.path}:`, err.message);
      } else {
        message = err.message || "Request failed";
      }
    } else {
      // Solo en desarrollo mostrar detalles completos
      message = err.message || "Internal Server Error";
    }

    res.status(status).json({ message });
  });

  // importantly only setup vite in development and after
  // setting up all the other routes so the catch-all route
  // doesn't interfere with the other routes
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  // ALWAYS serve the app on port 5000
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = 5000;
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true,
  }, () => {
    log(`serving on port ${port}`);
  });
})();
