import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { storage as appStorage } from "./storage";
import { setupAuth } from "./auth";
import { InsertStencil } from "@shared/schema";
import axios from "axios";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";
import queueRouter from "./routes/queue";
import { checkRunStatus } from "./comfy";
import { applyAutoExposureCorrection } from "./image-processing";

dotenv.config();

// Configuración para guardar archivos subidos
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const uploadsDir = path.join(__dirname, "../uploads");

// Aseguramos que el directorio de uploads exista
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Configuración de multer para subida de archivos
const multerStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (_req, file, cb) => {
    // Genera un nombre único para cada archivo
    const uniqueName = `${uuidv4()}${path.extname(file.originalname)}`;
    cb(null, uniqueName);
  },
});

// Filtro para permitir solo archivos de imagen
const fileFilter = (_req: any, file: Express.Multer.File, cb: multer.FileFilterCallback) => {
  // Lista explícita de tipos MIME permitidos
  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/jpg'];
  
  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    console.log("Tipo de archivo rechazado:", file.mimetype, "nombre:", file.originalname);
    cb(new Error(`El archivo debe ser una imagen en formato permitido. Recibido: ${file.mimetype}`)); 
  }
};

const upload = multer({ 
  storage: multerStorage, 
  fileFilter,
  limits: {
    fileSize: 15 * 1024 * 1024, // Limite aumentado a 15MB
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
  // Configuración de autenticación
  const requireAuth = setupAuth(app);
  
  // Montar la ruta de queue para ComfyDeploy
  app.use("/api/queue", queueRouter);
  
  // API endpoint para subir una imagen
  app.post("/api/upload-image", upload.single("image"), async (req, res) => {
    try {
      // Si no hay archivo
      if (!req.file) {
        return res.status(400).json({ 
          error: "No se ha subido ninguna imagen",
          message: "Es necesario subir una imagen"
        });
      }
      
      const { lineColor, transparentBackground } = req.body;
      
      if (!lineColor || !['black', 'red', 'blue'].includes(lineColor)) {
        return res.status(400).json({ 
          error: "Color de línea inválido",
          message: "El color de línea debe ser negro, rojo o azul"
        });
      }
      
      // Construir URL para el archivo subido (relativa a nuestro servidor)
      const protocol = req.protocol;
      const host = req.get('host');
      const baseUrl = `${protocol}://${host}`;
      const fileUrl = `${baseUrl}/uploads/${path.basename(req.file.path)}`;
      
      // Obtener la API key
      const apiKey = process.env.API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          error: "API_KEY no configurada",
          message: "No se ha configurado la API_KEY en el servidor"
        });
      }
      
      // Extraer y validar los parámetros nuevos
      // Convertir valores a booleanos explícitos como requiere la API
      const parsedTransparency = transparentBackground === 'true' || transparentBackground === true ? true : false;
      
      // Corrigiendo el manejo de enhanceShadows para que sea explícitamente un booleano
      // Verificar el valor de enhanceShadows sea cual sea su formato
      const enhanceShadows = req.body.enhanceShadows === 'true' || req.body.enhanceShadows === true || req.body.enhanceShadows === 1 ? true : false;
      
      // Parámetros para el nuevo formato de API
      const aiModel = req.body.aiModel || "SDXL-Flash.safetensors";
      const presetLora = req.body.presetLora || "LoraLineart/Darwinstencil3-000007.safetensors";
      const posterizeValue = req.body.posterizeValue || 8;
      const activarPosterize = req.body.activarPosterize === 'true' || req.body.activarPosterize === true ? true : false;
      const activarAutoGamma = req.body.activarAutoGamma === 'true' || req.body.activarAutoGamma === true ? true : false;

      
      console.log("Parámetros API enviados a ComfyDeploy:", {
        "Darwin Enriquez": fileUrl,
        "line_color": lineColor,
        "activar_transparencia": parsedTransparency,
        "iluminar sombras": enhanceShadows,
        "estilo de linea": presetLora,
        "AI Model": aiModel,
        "Posterize": posterizeValue,
        "activar_Posterize": activarPosterize,
        "Activar Auto Gamma": activarAutoGamma
      });
      
      try {
        let finalImageUrl = fileUrl;
        
        // Usar nuestro nuevo sistema de API para generar el stencil
        const inputs = {
          "input_image": finalImageUrl,
          "line_color": lineColor,
          "activate_transparency": parsedTransparency,
          "brighten_shadows": enhanceShadows,
          "line_style": presetLora,
          "checkpoint": aiModel,
          "posterize_level": parseInt(posterizeValue),
          "activate_posterize": activarPosterize,
          "activate_auto_gamma": activarAutoGamma
        };
        
        console.log("Enviando solicitud a /api/queue con inputs:", inputs);
        console.log("JSON enviado:", JSON.stringify({ inputs }, null, 2));
        
        // Comprobaciones de validación
        if (!inputs.input_image) {
          throw new Error("La URL de la imagen es obligatoria");
        }
        
        const queueResponse = await axios.post(
          `${baseUrl}/api/queue`,
          { inputs },
          {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 60000 // Aumentado a 60 segundos para imágenes grandes
          }
        );
        
        const response = queueResponse.data;
        
        // Devolver la respuesta al cliente
        return res.status(200).json(response);
      } catch (apiError) {
        console.error("Error al llamar a la API de ComfyDeploy:", apiError);
        
        if (axios.isAxiosError(apiError)) {
          return res.status(apiError.response?.status || 500).json({
            error: apiError.response?.data || "Error al generar el stencil",
            message: apiError.message
          });
        }
        
        return res.status(500).json({ 
          error: "Error en la API externa",
          message: apiError instanceof Error ? apiError.message : "Error desconocido en la API externa"
        });
      }
    } catch (error) {
      console.error("Error al procesar la imagen subida:", error);
      
      if (axios.isAxiosError(error)) {
        return res.status(error.response?.status || 500).json({
          error: error.response?.data || "Error al generar el stencil",
          message: error.message
        });
      }
      
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // API endpoint para acceder a los archivos subidos
  app.use('/uploads', express.static(uploadsDir));
  
  // API endpoint para verificar el estado de un trabajo
  app.get("/api/job-status/:runId", async (req, res) => {
    try {
      const { runId } = req.params;
      
      if (!runId) {
        return res.status(400).json({ 
          error: "ID de trabajo requerido",
          message: "Es necesario proporcionar un ID de trabajo válido"
        });
      }
      
      // Usar nuestra nueva ruta centralizada para comprobar el estado
      try {
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        const response = await axios.get(`${baseUrl}/api/queue/${runId}`, {
          timeout: 30000
        });
        
        const jobStatus = response.data;
        
        // Verificar si hay problemas con la API y el estado
        if (jobStatus.status === "not-started" && jobStatus.queue_position === null) {
          console.log("ADVERTENCIA: El trabajo está en estado 'not-started' sin posición en cola después de tiempo de espera significativo");
        }
      
        console.log("ComfyDeploy API respuesta completa:", JSON.stringify(jobStatus, null, 2));
        
        // Devolver el estado al cliente
        return res.status(200).json(jobStatus);
      } catch (apiError) {
        console.error("Error al verificar el estado en ComfyDeploy:", apiError);
        
        if (axios.isAxiosError(apiError)) {
          return res.status(apiError.response?.status || 500).json({
            error: apiError.response?.data || "Error al verificar el estado",
            message: apiError.message
          });
        }
        
        return res.status(500).json({ 
          error: "Error en la API externa",
          message: apiError instanceof Error ? apiError.message : "Error desconocido en la API externa"
        });
      }
    } catch (error) {
      console.error("Error al verificar el estado del trabajo:", error);
      
      if (axios.isAxiosError(error)) {
        return res.status(error.response?.status || 500).json({
          error: error.response?.data || "Error al verificar el estado",
          message: error.message
        });
      }
      
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // API endpoint to generate stencil from URL
  app.post("/api/generate-stencil", async (req, res) => {
    try {
      const { imageUrl, lineColor, transparentBackground } = req.body;

      if (!imageUrl) {
        return res.status(400).json({ error: "Image URL is required" });
      }

      if (!lineColor || !["black", "red", "blue"].includes(lineColor)) {
        return res.status(400).json({ error: "Valid line color is required (black, red, or blue)" });
      }

      // Convertir valores a booleanos explícitos como requiere la API
      const parsedTransparency = transparentBackground === 'true' || transparentBackground === true ? true : false;
      
      // Usar el módulo centralizado para generar el stencil
      try {
        // Usar nuestra nueva ruta centralizada para generar el stencil
        const protocol = req.protocol;
        const host = req.get('host');
        const baseUrl = `${protocol}://${host}`;
        
        const inputs = {
          "input_image": imageUrl,
          "line_color": lineColor,
          "activate_transparency": parsedTransparency,
          "brighten_shadows": false,
          "line_style": "LoraLineart/Darwinstencil3-000007.safetensors",
          "checkpoint": "SDXL-Flash.safetensors",
          "posterize_level": 8,
          "activate_posterize": false,
          "activate_auto_gamma": false
        };
        
        const queueResponse = await axios.post(
          `${baseUrl}/api/queue`,
          { inputs },
          {
            headers: {
              "Content-Type": "application/json"
            },
            timeout: 30000
          }
        );
        
        const response = queueResponse.data;
        
        // Devolver la respuesta al cliente
        return res.status(200).json(response);
      } catch (apiError) {
        console.error("Error al llamar a la API de ComfyDeploy:", apiError);
        
        if (axios.isAxiosError(apiError)) {
          return res.status(apiError.response?.status || 500).json({
            error: apiError.response?.data || "Error al generar el stencil",
            message: apiError.message
          });
        }
        
        return res.status(500).json({ 
          error: "Error en la API externa",
          message: apiError instanceof Error ? apiError.message : "Error desconocido en la API externa"
        });
      }
    } catch (error) {
      console.error("Error al generar el stencil:", error);
      
      if (axios.isAxiosError(error)) {
        return res.status(error.response?.status || 500).json({
          error: error.response?.data || "Error al generar el stencil",
          message: error.message
        });
      }
      
      return res.status(500).json({ 
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // Guardar un stencil generado en la base de datos
  app.post("/api/save-stencil", requireAuth, async (req, res) => {
    try {
      const { imageUrl, lineColor, transparentBackground } = req.body;
      
      if (!req.user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      if (!imageUrl) {
        return res.status(400).json({ error: "URL de imagen requerida" });
      }
      
      const stencilData: InsertStencil = {
        userId: req.user.id,
        imageUrl,
        lineColor,
        transparentBackground: transparentBackground === true || transparentBackground === 'true'
      };
      
      const stencil = await appStorage.saveStencil(stencilData);
      
      res.status(201).json(stencil);
    } catch (error) {
      console.error("Error al guardar el stencil:", error);
      res.status(500).json({ 
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  // Obtener los stencils guardados por el usuario
  app.get("/api/my-stencils", requireAuth, async (req, res) => {
    try {
      if (!req.user) {
        return res.status(401).json({ error: "Usuario no autenticado" });
      }
      
      const stencils = await appStorage.getUserStencils(req.user.id);
      
      res.status(200).json(stencils);
    } catch (error) {
      console.error("Error al obtener los stencils:", error);
      res.status(500).json({ 
        error: "Error interno del servidor",
        message: error instanceof Error ? error.message : "Error desconocido"
      });
    }
  });
  
  const httpServer = createServer(app);
  
  return httpServer;
}