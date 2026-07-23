export interface Alert {
  id: string;
  source: "datadog" | "pagerduty";
  service: string;
  severity: "P1" | "P2" | "P3" | "P4";
  message: string;
  metric?: string;
  threshold?: string;
  observedValue?: string;
  timestamp: string;
}

export interface Deploy {
  sha: string;
  service: string;
  author: string;
  message: string;
  filesChanged: string[];
  deployedAt: string;
}

export interface PastIncident {
  id: string;
  service: string;
  title: string;
  rootCause: string;
  resolution: string;
  tags: string[];
}

export interface ServiceOwner {
  service: string;
  team: string;
  slackChannel: string;
  onCallEngineer: string;
}

export interface RootCauseHypothesis {
  summary: string;
  confidence: "low" | "medium" | "high";
  suspectedDeploy: Deploy | null;
  similarPastIncidents: PastIncident[];
  reasoning: string;
}

export interface IncidentRecord {
  id: string;
  alert: Alert;
  hypothesis: RootCauseHypothesis;
  postmortemDraft: string;
  routedTo: ServiceOwner;
  createdAt: string;
}
