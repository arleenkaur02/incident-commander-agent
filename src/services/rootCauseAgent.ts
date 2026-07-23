import Anthropic from "@anthropic-ai/sdk";
import { Alert, Deploy, PastIncident, RootCauseHypothesis } from "../types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const SYSTEM_PROMPT = `You are an SRE root-cause reasoning agent embedded in an
incident response pipeline. You are given a live production alert, the most
recent deploy to that service (if any), and the most similar past incidents
retrieved from the postmortem archive.

Your job:
1. Propose the single most likely root cause hypothesis.
2. State your confidence (low, medium, high) based on how strong the
   correlation is (e.g. a deploy 15 minutes before an alert on the exact
   file path involved is high confidence; a deploy 100 minutes prior with no
   file overlap is low confidence).
3. Justify your reasoning in 2-4 sentences, explicitly referencing the
   deploy and/or past incidents that informed your hypothesis.

Respond ONLY as JSON matching this shape, no prose outside the JSON:
{
  "summary": string,
  "confidence": "low" | "medium" | "high",
  "reasoning": string
}`;

interface LLMHypothesis {
  summary: string;
  confidence: "low" | "medium" | "high";
  reasoning: string;
}

export async function generateRootCauseHypothesis(
  alert: Alert,
  suspectDeploy: Deploy | null,
  similarIncidents: PastIncident[]
): Promise<RootCauseHypothesis> {
  const userPrompt = buildUserPrompt(alert, suspectDeploy, similarIncidents);

  // If no API key is configured, fall back to a deterministic heuristic so
  // the pipeline is still fully runnable/demoable without credentials.
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicFallback(alert, suspectDeploy, similarIncidents);
  }

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: SYSTEM_PROMPT,
      messages: [{ role: "user", content: userPrompt }],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    const parsed: LLMHypothesis = JSON.parse(
      (textBlock as any)?.text?.trim() ?? "{}"
    );

    return {
      summary: parsed.summary,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      suspectedDeploy: suspectDeploy,
      similarPastIncidents: similarIncidents,
    };
  } catch (err) {
    console.error("Root cause agent LLM call failed, using fallback:", err);
    return heuristicFallback(alert, suspectDeploy, similarIncidents);
  }
}

function buildUserPrompt(
  alert: Alert,
  suspectDeploy: Deploy | null,
  similarIncidents: PastIncident[]
): string {
  return `ALERT:
${JSON.stringify(alert, null, 2)}

MOST RECENT DEPLOY TO THIS SERVICE (within lookback window):
${suspectDeploy ? JSON.stringify(suspectDeploy, null, 2) : "None found in window."}

SIMILAR PAST INCIDENTS:
${
  similarIncidents.length
    ? JSON.stringify(similarIncidents, null, 2)
    : "None found."
}`;
}

/**
 * Deterministic fallback used when no ANTHROPIC_API_KEY is present, so the
 * repo is runnable and demoable out of the box without requiring keys.
 */
function heuristicFallback(
  alert: Alert,
  suspectDeploy: Deploy | null,
  similarIncidents: PastIncident[]
): RootCauseHypothesis {
  if (suspectDeploy) {
    return {
      summary: `Likely regression introduced by deploy ${suspectDeploy.sha} ("${suspectDeploy.message}") shortly before the alert fired.`,
      confidence: similarIncidents.length ? "high" : "medium",
      reasoning: `The deploy ${suspectDeploy.sha} by ${suspectDeploy.author} landed at ${suspectDeploy.deployedAt}, shortly before the ${alert.severity} alert on ${alert.service}. ${
        similarIncidents.length
          ? `This matches the pattern seen in past incident "${similarIncidents[0].title}", where a similar deploy caused a comparable failure mode.`
          : "No closely matching past incident was found, so this is a preliminary hypothesis pending on-call confirmation."
      }`,
      suspectedDeploy: suspectDeploy,
      similarPastIncidents: similarIncidents,
    };
  }

  return {
    summary: `No recent deploy correlates with this alert; likely an environmental or dependency-side issue rather than a code regression.`,
    confidence: "low",
    reasoning: `No deploy to ${alert.service} was found within the lookback window, so this is unlikely to be a direct code regression. Recommend checking upstream dependencies, infrastructure events, or traffic anomalies.`,
    suspectedDeploy: null,
    similarPastIncidents: similarIncidents,
  };
}
