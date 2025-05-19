import express from "express";
import { queueRun } from "../comfy";

const router = express.Router();

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

export default router;