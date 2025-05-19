import express from "express";
import { queueRun, checkRunStatus } from "../comfy";

const router = express.Router();

// Endpoint para enviar trabajos a ComfyDeploy
router.post("/", async (req, res) => {
  try {
    console.log("Recibida solicitud en /api/queue:", req.body);
    const { run_id } = await queueRun(req.body.inputs);
    res.json({ run_id });
  } catch (e: any) {
    console.error("Error en la ruta de queue:", e);
    res.status(500).json({ error: e.message });
  }
});

// Endpoint para verificar el estado de un trabajo
router.get("/:runId", async (req, res) => {
  try {
    const { runId } = req.params;
    const status = await checkRunStatus(runId);
    res.json(status);
  } catch (e: any) {
    console.error("Error al verificar estado:", e);
    res.status(500).json({ error: e.message });
  }
});

export default router;