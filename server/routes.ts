import express, { type Express } from "express";
import { createServer, type Server } from "http";

export function registerRoutes(app: Express): Server {
  // Ruta básica de API
  app.get("/api/hello", (_req, res) => {
    res.json({ message: "Stencil Editor API" });
  });

  const httpServer = createServer(app);
  
  return httpServer;
}