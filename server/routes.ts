import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import { storage as appStorage } from "./storage";
import axios from "axios";
import dotenv from "dotenv";
import multer from "multer";
import path from "path";
import fs from "fs";
import { v4 as uuidv4 } from "uuid";

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
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("El archivo debe ser una imagen (JPEG, PNG, etc.)")); 
  }
};

const upload = multer({ 
  storage: multerStorage, 
  fileFilter,
  limits: {
    fileSize: 5 * 1024 * 1024, // Limite de 5MB
  },
});

export async function registerRoutes(app: Express): Promise<Server> {
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
      
      // Llamar a la API externa con la URL del archivo subido
      const parsedTransparency = transparentBackground === 'true';
      const response = await axios.post(
        "https://api.comfydeploy.com/api/run/deployment/queue",
        {
          deployment_id: "c0887fe6-13b0-4406-a8d1-f596b1fdab8d",
          inputs: {
            "Darwin Enriquez": fileUrl,
            line_color: lineColor,
            activar_transparencia: parsedTransparency
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          }
        }
      );
      
      return res.status(200).json(response.data);
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
      
      const apiKey = process.env.API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ 
          error: "API_KEY no configurada",
          message: "No se ha configurado la API_KEY en el servidor"
        });
      }
      
      // Llamar a la API externa para verificar el estado
      const response = await axios.get(
        `https://api.comfydeploy.com/api/run/${runId}`,
        {
          headers: {
            "Authorization": `Bearer ${apiKey}`
          }
        }
      );
      
      console.log("ComfyDeploy API respuesta completa:", JSON.stringify(response.data, null, 2));
      
      // Según la documentación de ComfyDeploy, necesitamos extraer la imagen del campo output
      if (response.data.status === 'completed' && response.data.outputs) {
        console.log("Claves disponibles en outputs:", Object.keys(response.data.outputs));
        
        // Buscar en todas las propiedades posibles para encontrar la URL de la imagen
        // Estas son posibles claves según el modelo utilizado
        const possibleImageKeys = ['Darwin_out', 'image', 'output', 'result', 'stencil', 'stencil_output', 'stencil_image'];
        
        // Verificar si alguna de estas claves contiene una URL de imagen
        for (const key of possibleImageKeys) {
          if (response.data.outputs[key] && typeof response.data.outputs[key] === 'string' && 
              (response.data.outputs[key].startsWith('http') || response.data.outputs[key].startsWith('data:'))) {
            console.log(`Encontrada URL de imagen en clave ${key}:`, response.data.outputs[key]);
            response.data.outputs.image = response.data.outputs[key];
            break;
          }
        }
        
        // Si todavía no tenemos imagen, busca cualquier propiedad que parezca una URL
        if (!response.data.outputs.image) {
          for (const key of Object.keys(response.data.outputs)) {
            const value = response.data.outputs[key];
            if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:'))) {
              console.log(`Encontrada posible URL de imagen en clave genérica ${key}:`, value);
              response.data.outputs.image = value;
              break;
            }
          }
        }
      }
      
      return res.status(200).json(response.data);
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

      const apiKey = process.env.API_KEY;
      
      if (!apiKey) {
        return res.status(500).json({ error: "API_KEY is not configured" });
      }

      const response = await axios.post(
        "https://api.comfydeploy.com/api/run/deployment/queue",
        {
          deployment_id: "c0887fe6-13b0-4406-a8d1-f596b1fdab8d",
          inputs: {
            "Darwin Enriquez": imageUrl,
            line_color: lineColor,
            activar_transparencia: transparentBackground
          }
        },
        {
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiKey}`
          }
        }
      );

      return res.status(200).json(response.data);
    } catch (error) {
      console.error("Error generating stencil:", error);
      
      if (axios.isAxiosError(error)) {
        return res.status(error.response?.status || 500).json({
          error: error.response?.data || "Failed to generate stencil",
          message: error.message
        });
      }
      
      return res.status(500).json({ 
        error: "Internal server error",
        message: error instanceof Error ? error.message : "Unknown error occurred"
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
