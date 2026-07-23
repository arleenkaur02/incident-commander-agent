import { v4 as uuidv4 } from "uuid";
import { Alert, IncidentRecord } from "./types";
import { findSuspectDeploy } from "./services/deployCorrelator";
import { retrieveSimilarIncidents } from "./services/incidentRetriever";
import { generateRootCauseHypothesis } from "./services/rootCauseAgent";
import { draftPostmortem } from "./services/postmortemGenerator";
import { findServiceOwner, notifyOnCall } from "./services/oncallRouter";

/**
 * Runs the full Incident Commander pipeline for a single alert:
 *
 *   Alert ──▶ Deploy Correlation ──▶ Past-Incident Retrieval (RAG)
 *          └────────────────┬────────────────┘
 *                            ▼
 *                 Root Cause Reasoning Agent (LLM)
 *                            ▼
 *                  Postmortem Draft Generator
 *                            ▼
 *              On-Call Routing + Slack Notification
 */
export async function handleAlert(alert: Alert): Promise<IncidentRecord> {
  const suspectDeploy = findSuspectDeploy(alert);
  const similarIncidents = retrieveSimilarIncidents(alert);

  const hypothesis = await generateRootCauseHypothesis(
    alert,
    suspectDeploy,
    similarIncidents
  );

  const postmortemDraft = draftPostmortem(alert, hypothesis);
  const owner = findServiceOwner(alert.service);

  await notifyOnCall(alert, hypothesis, owner);

  const record: IncidentRecord = {
    id: uuidv4(),
    alert,
    hypothesis,
    postmortemDraft,
    routedTo: owner,
    createdAt: new Date().toISOString(),
  };

  return record;
}
