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
      
      // Llamar a la API externa con la URL del archivo subido
      // Crear un objeto payload EXACTAMENTE como se ve en la interfaz original
      const payload = {
        deployment_id: "c0887fe6-13b0-4406-a8d1-f596b1fdab8d",
        inputs: {
          "Darwin Enriquez": fileUrl,
          "line_color": lineColor,
          "activar_transparencia": parsedTransparency,
          "iluminar sombras": enhanceShadows,
          "estilo de linea": presetLora,
          "AI Model": aiModel,
          "Posterize": posterizeValue,
          "activar_Posterize": activarPosterize,
          "Activar Auto Gamma": activarAutoGamma
        }
      };

      console.log("API PAYLOAD ENVIADO:", JSON.stringify(payload, null, 2));

      const response = await axios.post(
        "https://api.comfydeploy.com/api/run/deployment/queue",
        payload,
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
      
      // Verificar si hay problemas con la API y el estado
      if (response.data.status === "not-started" && response.data.queue_position === null) {
        console.log("ADVERTENCIA: El trabajo está en estado 'not-started' sin posición en cola después de tiempo de espera significativo");
        
        // Agregar información adicional para diagnóstico
        response.data._diagnosticInfo = {
          serverTime: new Date().toISOString(),
          jobCreatedAt: response.data.created_at,
          timeElapsedSinceCreation: new Date().getTime() - new Date(response.data.created_at).getTime(),
          message: "El trabajo parece estar atascado en estado 'not-started'. Esto puede indicar problemas con la API externa."
        };
      }
      
      console.log("ComfyDeploy API respuesta completa:", JSON.stringify(response.data, null, 2));
      
      // Según la documentación de ComfyDeploy, necesitamos extraer la imagen del campo output
      if (response.data.status === 'completed' || response.data.status === 'success') {
        console.log("ComfyDeploy API respuesta status:", response.data.status);

        // Caso especial: respuesta con formato de ComfyDeploy API
        if (Array.isArray(response.data.outputs)) {
          console.log("Procesando array de outputs, cantidad:", response.data.outputs.length);
          
          // Buscar en cada output si hay imágenes
          for (const output of response.data.outputs) {
            console.log("Analizando output id:", output.id, "output_id:", output.output_id);
            
            // Buscar imágenes en formato de nodo ComfyUI
            if (output.data && output.node_meta && output.node_meta.node_class === "SaveImage") {
              console.log("Encontrado nodo SaveImage");
              
              // SaveImage guarda imágenes en data.images
              if (output.data.images && Array.isArray(output.data.images)) {
                console.log("Encontradas imágenes en output:", output.data.images.length);
                
                for (const image of output.data.images) {
                  if (image.url && typeof image.url === 'string') {
                    console.log("Encontrada URL de imagen en SaveImage:", image.url);
                    
                    // Asegurarse de que outputs sea un objeto si no lo es
                    if (!response.data.outputs || Array.isArray(response.data.outputs)) {
                      response.data.outputs = {};
                    }
                    
                    // Almacenar la URL en outputs.image para compatibilidad con el frontend
                    response.data.outputs.image = image.url;
                    break;
                  } else if (typeof image === 'string' && (image.startsWith('http') || image.startsWith('data:'))) {
                    console.log("Encontrada URL de imagen en SaveImage (string directo):", image);
                    
                    if (!response.data.outputs || Array.isArray(response.data.outputs)) {
                      response.data.outputs = {};
                    }
                    
                    response.data.outputs.image = image;
                    break;
                  }
                }
                
                // Si encontramos una imagen, salir del bucle
                if (response.data.outputs.image) break;
              }
            }
            
            // Buscar en ComfyDeployOutputImage - formato específico de ComfyDeploy
            if (output.node_meta && output.node_meta.node_class === "ComfyDeployOutputImage") {
              console.log("Encontrado nodo ComfyDeployOutputImage");
              
              if (output.data && typeof output.data === 'object') {
                if (typeof output.data.image === 'string') {
                  console.log("Encontrada URL de imagen en ComfyDeployOutputImage:", output.data.image);
                  
                  if (!response.data.outputs || Array.isArray(response.data.outputs)) {
                    response.data.outputs = {};
                  }
                  
                  response.data.outputs.image = output.data.image;
                  break;
                }
              }
            }
            
            // Si hay una propiedad data.images genérica, buscar URLs ahí
            if (output.data && output.data.images && Array.isArray(output.data.images)) {
              console.log("Encontradas imágenes en output.data.images:", output.data.images.length);
              
              for (const image of output.data.images) {
                if (image.url && typeof image.url === 'string') {
                  console.log("Encontrada URL de imagen:", image.url);
                  
                  // Asegurarse de que outputs sea un objeto si no lo es
                  if (!response.data.outputs || Array.isArray(response.data.outputs)) {
                    response.data.outputs = {};
                  }
                  
                  // Almacenar la URL en outputs.image para compatibilidad con el frontend
                  response.data.outputs.image = image.url;
                  break;
                }
              }
              
              // Si encontramos una imagen, salir del bucle
              if (response.data.outputs.image) break;
            }
          }
        }
        
        // Si después de comprobar los outputs, aún no tenemos imagen, buscar en cualquier lugar
        if (!response.data.outputs || !response.data.outputs.image) {
          console.log("Buscando URL de imagen en cualquier parte de la respuesta...");
          
          // Asegurarse de que outputs sea un objeto
          if (!response.data.outputs || Array.isArray(response.data.outputs)) {
            response.data.outputs = {};
          }
          
          // Función recursiva para buscar en cualquier nivel
          const searchForImageUrls = (obj: any, path = ''): string | null => {
            if (!obj || typeof obj !== 'object') return null;
            
            // Si es un objeto, busca en sus propiedades
            if (!Array.isArray(obj)) {
              for (const [key, value] of Object.entries(obj)) {
                const currentPath = path ? `${path}.${key}` : key;
                
                // Evitar buscar en workflow_inputs (que contiene la imagen original, no el resultado)
                if (currentPath.includes('workflow_inputs')) {
                  continue;
                }
                
                // Si encontramos una URL directamente
                if (typeof value === 'string' && 
                    (value.startsWith('http') || value.startsWith('data:')) &&
                    (value.includes('.png') || value.includes('.jpg') || value.includes('.jpeg') || value.includes('.webp'))) {
                  console.log(`Encontrada URL de imagen en ${currentPath}:`, value);
                  return value;
                }
                
                // Recursivamente busca en objetos anidados
                const result = searchForImageUrls(value, currentPath);
                if (result) return result;
              }
            } 
            // Si es un array, busca en sus elementos
            else {
              for (let i = 0; i < obj.length; i++) {
                const currentPath = `${path}[${i}]`;
                const result = searchForImageUrls(obj[i], currentPath);
                if (result) return result;
              }
            }
            
            return null;
          };
          
          const imageUrl = searchForImageUrls(response.data);
          if (imageUrl) {
            response.data.outputs.image = imageUrl;
            console.log("URL de imagen encontrada y guardada en outputs.image");
          } else {
            console.log("ADVERTENCIA: No se encontró URL de imagen en la respuesta");
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

      // Extraer y validar los parámetros nuevos
      // Convertir valores a booleanos explícitos como requiere la API
      const parsedTransparency = transparentBackground === 'true' || transparentBackground === true ? true : false;
      
      // Corrigiendo el manejo de enhanceShadows para que sea explícitamente un booleano
      const enhanceShadows = req.body.enhanceShadows === 'true' || req.body.enhanceShadows === true || req.body.enhanceShadows === 1 ? true : false;
      
      // Parámetros para el nuevo formato de API
      const aiModel = req.body.aiModel || "SDXL-Flash.safetensors";
      const presetLora = req.body.presetLora || "LoraLineart/Darwinstencil3-000007.safetensors";
      const posterizeValue = req.body.posterizeValue || 8;
      const activarPosterize = req.body.activarPosterize === 'true' || req.body.activarPosterize === true ? true : false;
      const activarAutoGamma = req.body.activarAutoGamma === 'true' || req.body.activarAutoGamma === true ? true : false;
      
      console.log("Parámetros API enviados a ComfyDeploy:", {
        "Darwin Enriquez": imageUrl,
        "line_color": lineColor,
        "activar_transparencia": parsedTransparency,
        "iluminar sombras": enhanceShadows,
        "estilo de linea": presetLora,
        "AI Model": aiModel,
        "Posterize": posterizeValue,
        "activar_Posterize": activarPosterize,
        "Activar Auto Gamma": activarAutoGamma
      });
      
      // Crear un objeto payload EXACTAMENTE como se ve en la interfaz original
      const payload = {
        deployment_id: "c0887fe6-13b0-4406-a8d1-f596b1fdab8d",
        inputs: {
          "Darwin Enriquez": imageUrl,
          "line_color": lineColor,
          "activar_transparencia": parsedTransparency,
          "iluminar sombras": enhanceShadows,
          "estilo de linea": presetLora,
          "AI Model": aiModel,
          "Posterize": posterizeValue,
          "activar_Posterize": activarPosterize,
          "Activar Auto Gamma": activarAutoGamma
        }
      };

      console.log("API PAYLOAD ENVIADO (generate-stencil):", JSON.stringify(payload, null, 2));

      const response = await axios.post(
        "https://api.comfydeploy.com/api/run/deployment/queue",
        payload,
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
  
  // Guardar un stencil generado en la base de datos
  app.post("/api/save-stencil", requireAuth, async (req, res) => {
    try {
      const { imageUrl, lineColor, transparentBackground } = req.body;
      
      if (!imageUrl) {
        return res.status(400).json({ 
          error: "URL de imagen requerida",
          message: "Es necesario proporcionar una URL de imagen" 
        });
      }
      
      if (!lineColor || !["black", "red", "blue"].includes(lineColor)) {
        return res.status(400).json({ 
          error: "Color de línea inválido", 
          message: "El color de línea debe ser negro, rojo o azul" 
        });
      }
      
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          error: "No autenticado", 
          message: "Debe iniciar sesión para guardar stencils" 
        });
      }
      
      // Guardar el stencil en la base de datos
      const stencil = await appStorage.saveStencil({
        userId,
        imageUrl,
        lineColor,
        transparentBackground: typeof transparentBackground === 'boolean' 
          ? transparentBackground 
          : transparentBackground === 'true'
      });
      
      return res.status(201).json(stencil);
    } catch (error) {
      console.error("Error al guardar stencil:", error);
      return res.status(500).json({ 
        error: "Error interno del servidor", 
        message: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });
  
  // Obtener todos los stencils del usuario
  app.get("/api/my-stencils", requireAuth, async (req, res) => {
    try {
      const userId = req.user?.id;
      
      if (!userId) {
        return res.status(401).json({ 
          error: "No autenticado", 
          message: "Debe iniciar sesión para ver sus stencils" 
        });
      }
      
      // Obtener stencils del usuario
      const stencils = await appStorage.getUserStencils(userId);
      
      return res.status(200).json(stencils);
    } catch (error) {
      console.error("Error al obtener stencils del usuario:", error);
      return res.status(500).json({ 
        error: "Error interno del servidor", 
        message: error instanceof Error ? error.message : "Error desconocido" 
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
