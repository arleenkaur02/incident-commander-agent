import "dotenv/config";
import path from "path";
import express from "express";
import { Alert } from "./types";
import { handleAlert } from "./orchestrator";
import { addIncident, getAllIncidents, getIncidentById } from "./incidentStore";
import { answerQuestion, ChatMessage } from "./services/chatAgent";

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, "..", "public")));

const port = process.env.PORT ?? 4000;

/**
 * Simulates the webhook endpoint Datadog/PagerDuty would call when an
 * alert fires. In production this would be secured (shared secret / HMAC
 * signature verification) and would validate the payload shape per
 * provider.
 */
app.post("/webhooks/alert", async (req, res) => {
  const alert = req.body as Alert;

  if (!alert?.service || !alert?.severity || !alert?.message) {
    return res.status(400).json({ error: "Malformed alert payload" });
  }

  try {
    const record = await handleAlert(alert);
    addIncident(record);
    return res.status(200).json(record);
  } catch (err) {
    console.error("Failed to process alert:", err);
    return res.status(500).json({ error: "Internal error processing alert" });
  }
});

app.get("/incidents", (_req, res) => {
  res.json(getAllIncidents());
});

app.get("/incidents/:id", (req, res) => {
  const record = getIncidentById(req.params.id);
  if (!record) return res.status(404).json({ error: "Not found" });
  res.json(record);
});

/**
 * Chat endpoint — lets a user ask natural-language questions about the
 * incidents this session has processed, backed by Claude with the live
 * incident log + historical postmortem archive as context. Falls back to
 * a deterministic heuristic if no ANTHROPIC_API_KEY is configured.
 */
app.post("/api/chat", async (req, res) => {
  const { message, history } = req.body as { message: string; history?: ChatMessage[] };

  if (!message || typeof message !== "string") {
    return res.status(400).json({ error: "Missing 'message' field" });
  }

  try {
    const reply = await answerQuestion(message, history ?? [], getAllIncidents());
    return res.status(200).json({ reply });
  } catch (err) {
    console.error("Chat agent failed:", err);
    return res.status(500).json({ error: "Chat agent failed to respond" });
  }
});

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.listen(port, () => {
  console.log(`Incident Commander Agent listening on port ${port}`);
  console.log(`POST an alert to http://localhost:${port}/webhooks/alert`);
});
