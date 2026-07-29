import Anthropic from "@anthropic-ai/sdk";
import pastIncidents from "../data/pastIncidents.json";
import serviceOwnership from "../data/serviceOwnership.json";
import { IncidentRecord } from "../types";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

const SYSTEM_PROMPT = `You are the assistant layer of the Incident Commander Agent, an
SRE incident-response system. You have access to:

1. The live incident log from this session (alerts that have actually been
   processed by the pipeline, with their root-cause hypotheses and postmortems).
2. A historical postmortem archive of past incidents.
3. A service-ownership map (which team/engineer owns which service).

Answer questions about incidents, root causes, on-call ownership, and patterns
across incidents concisely and factually, citing specific incident IDs or
service names where relevant. If asked something outside this scope (general
chit-chat, unrelated topics), gently redirect to what you can help with:
questions about the incidents this system has processed or has on record.
Keep answers to 2-5 sentences unless the question genuinely requires more.`;

export async function answerQuestion(
  message: string,
  history: ChatMessage[],
  liveIncidents: IncidentRecord[]
): Promise<string> {
  if (!process.env.ANTHROPIC_API_KEY) {
    return heuristicFallback(message, liveIncidents);
  }

  const contextBlock = buildContextBlock(liveIncidents);

  try {
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: `${SYSTEM_PROMPT}\n\n${contextBlock}`,
      messages: [
        ...history.slice(-8).map((m) => ({ role: m.role, content: m.content })),
        { role: "user" as const, content: message },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    return (textBlock as any)?.text?.trim() ?? "I wasn't able to generate a response.";
  } catch (err) {
    console.error("Chat agent LLM call failed:", err);
    return heuristicFallback(message, liveIncidents);
  }
}

function buildContextBlock(liveIncidents: IncidentRecord[]): string {
  const liveSummary = liveIncidents.length
    ? liveIncidents
        .map(
          (r) =>
            `- [${r.id.slice(0, 8)}] ${r.alert.service} (${r.alert.severity}, confidence: ${r.hypothesis.confidence}): ${r.hypothesis.summary} → routed to ${r.routedTo.onCallEngineer}`
        )
        .join("\n")
    : "No incidents have been processed yet in this session.";

  return `LIVE INCIDENT LOG (this session):
${liveSummary}

HISTORICAL POSTMORTEM ARCHIVE:
${JSON.stringify(pastIncidents, null, 2)}

SERVICE OWNERSHIP MAP:
${JSON.stringify(serviceOwnership, null, 2)}`;
}

/**
 * Deterministic fallback when no ANTHROPIC_API_KEY is configured, so the
 * chatbot is still demoable without credentials.
 */
function heuristicFallback(message: string, liveIncidents: IncidentRecord[]): string {
  const lower = message.toLowerCase();

  if (liveIncidents.length === 0) {
    return "No incidents have been processed yet in this session — fire an alert from the Live Demo tab first, then ask me about it.";
  }

  const matchedService = liveIncidents.find((r) =>
    lower.includes(r.alert.service.split("-")[0])
  );

  if (matchedService) {
    return `The most recent incident on ${matchedService.alert.service} was a ${matchedService.alert.severity} with ${matchedService.hypothesis.confidence} confidence. Hypothesis: ${matchedService.hypothesis.summary} It was routed to ${matchedService.routedTo.onCallEngineer} on the ${matchedService.routedTo.team} team.`;
  }

  if (lower.includes("how many") || lower.includes("count")) {
    return `${liveIncidents.length} incident(s) have been processed in this session so far.`;
  }

  const latest = liveIncidents[liveIncidents.length - 1];
  return `Here's the most recent incident I have: ${latest.alert.service} (${latest.alert.severity}, ${latest.hypothesis.confidence} confidence) — ${latest.hypothesis.summary} (Note: connect an ANTHROPIC_API_KEY for full conversational reasoning over all incidents.)`;
}
