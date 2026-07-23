import "dotenv/config";
import path from "path";
import express from "express";
import { Alert, IncidentRecord } from "./types";
import { handleAlert } from "./orchestrator";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const port = process.env.PORT ?? 4000;

const incidentHistory: IncidentRecord[] = [];

app.post("/webhooks/alert", async (req, res) => {
  const alert = req.body as Alert;

  if (!alert?.service || !alert?.severity || !alert?.message) {
    return res.status(400).json({ error: "Malformed alert payload" });
  }

  try {
    const record = await handleAlert(alert);
    incidentHistory.push(record);
    return res.status(200).json(record);
  } catch (err) {
    console.error("Failed to process alert:", err);
    return res.status(500).json({ error: "Internal error processing alert" });
  }
});

app.get("/incidents", (_req, res) => {
  res.json(incidentHistory);
});

app.get("/incidents/:id", (req, res) => {
  const record = incidentHistory.find((r) => r.id === req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(port, () => {
  console.log(`Incident Commander Agent listening on port ${port}`);
  console.log(`POST an alert to http://localhost:${port}/webhooks/alert`);
});
