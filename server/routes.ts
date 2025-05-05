import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import axios from "axios";
import dotenv from "dotenv";

dotenv.config();

export async function registerRoutes(app: Express): Promise<Server> {
  // API endpoint to generate stencil
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
            "API_KEY": apiKey
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
