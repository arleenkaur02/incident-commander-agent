import { Alert, RootCauseHypothesis } from "../types";

/**
 * Drafts a structured postmortem in Markdown from the alert + hypothesis.
 * This is template-based rather than an extra LLM call, since the
 * root-cause agent has already done the reasoning work — the draft's job
 * is just faithful, well-formatted synthesis for a human to review/edit.
 */
export function draftPostmortem(
  alert: Alert,
  hypothesis: RootCauseHypothesis
): string {
  const deploySection = hypothesis.suspectedDeploy
    ? `- **Suspected deploy:** \`${hypothesis.suspectedDeploy.sha}\` — "${hypothesis.suspectedDeploy.message}" by ${hypothesis.suspectedDeploy.author}\n- **Deployed at:** ${hypothesis.suspectedDeploy.deployedAt}\n- **Files changed:** ${hypothesis.suspectedDeploy.filesChanged.join(", ")}`
    : `- No recent deploy correlated with this alert.`;

  const relatedIncidentsSection = hypothesis.similarPastIncidents.length
    ? hypothesis.similarPastIncidents
        .map(
          (i) =>
            `- **${i.title}** (${i.id})\n  - Root cause: ${i.rootCause}\n  - Resolution: ${i.resolution}`
        )
        .join("\n")
    : "- No closely related past incidents found.";

  return `# Postmortem Draft — ${alert.service} (${alert.severity})

**Status:** Draft — pending on-call review
**Alert ID:** ${alert.id}
**Detected at:** ${alert.timestamp}
**Metric:** ${alert.metric ?? "n/a"} (threshold: ${alert.threshold ?? "n/a"}, observed: ${alert.observedValue ?? "n/a"})

## Summary
${hypothesis.summary}

## Root Cause Hypothesis (confidence: ${hypothesis.confidence})
${hypothesis.reasoning}

## Suspected Change
${deploySection}

## Related Past Incidents
${relatedIncidentsSection}

## Suggested Next Steps
1. Confirm or rule out the suspected deploy above with the owning engineer.
2. If confirmed, roll back or hotfix and monitor the affected metric for recovery.
3. If ruled out, escalate to infrastructure/dependency investigation.
4. Fill in customer impact, timeline, and action items once resolved.

---
*This draft was generated automatically by the Incident Commander Agent and requires human review before publishing.*
`;
}
