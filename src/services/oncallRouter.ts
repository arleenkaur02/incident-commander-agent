import axios from "axios";
import serviceOwnership from "../data/serviceOwnership.json";
import { Alert, RootCauseHypothesis, ServiceOwner } from "../types";

export function findServiceOwner(service: string): ServiceOwner {
  const owner = (serviceOwnership as ServiceOwner[]).find(
    (s) => s.service === service
  );
  if (!owner) {
    // Safe default so the pipeline never throws on an unmapped service.
    return {
      service,
      team: "Unassigned",
      slackChannel: "#incident-response",
      onCallEngineer: "unassigned",
    };
  }
  return owner;
}

export async function notifyOnCall(
  alert: Alert,
  hypothesis: RootCauseHypothesis,
  owner: ServiceOwner
): Promise<void> {
  const text = `:rotating_light: *${alert.severity} incident on ${alert.service}*\n` +
    `> ${alert.message}\n` +
    `*Hypothesis (${hypothesis.confidence} confidence):* ${hypothesis.summary}\n` +
    `*Routed to:* ${owner.onCallEngineer} (${owner.team})`;

  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log(`[oncallRouter] SLACK_WEBHOOK_URL not set — printing notification instead:\n${text}`);
    return;
  }

  try {
    await axios.post(webhookUrl, { channel: owner.slackChannel, text });
  } catch (err) {
    console.error("[oncallRouter] Failed to post Slack notification:", err);
  }
}
