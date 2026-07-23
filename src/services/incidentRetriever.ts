import pastIncidents from "../data/pastIncidents.json";
import { Alert, PastIncident } from "../types";

/**
 * Retrieves the most relevant past incidents for a given alert.
 *
 * This uses a lightweight tag/keyword overlap score so the project runs
 * fully offline with zero external dependencies. In production this
 * retrieval step would be swapped for a real embedding index (e.g.
 * pgvector, Pinecone, or Supabase Vector) over a corpus of historical
 * postmortems — the interface below (`retrieveSimilarIncidents`) would
 * stay identical, only the implementation changes.
 */
export function retrieveSimilarIncidents(alert: Alert, topK = 2): PastIncident[] {
  const queryTokens = tokenize(
    `${alert.service} ${alert.message} ${alert.metric ?? ""}`
  );

  const scored = (pastIncidents as PastIncident[]).map((incident) => {
    const incidentTokens = new Set([
      ...tokenize(incident.title),
      ...tokenize(incident.rootCause),
      ...incident.tags.map((t) => t.toLowerCase()),
    ]);

    const serviceMatchBonus = incident.service === alert.service ? 3 : 0;
    const overlap = queryTokens.filter((t) => incidentTokens.has(t)).length;

    return { incident, score: overlap + serviceMatchBonus };
  });

  return scored
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, topK)
    .map((s) => s.incident);
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 2);
}
