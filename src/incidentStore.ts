import { IncidentRecord } from "./types";

const incidentHistory: IncidentRecord[] = [];

export function addIncident(record: IncidentRecord): void {
  incidentHistory.push(record);
}

export function getAllIncidents(): IncidentRecord[] {
  return incidentHistory;
}

export function getIncidentById(id: string): IncidentRecord | undefined {
  return incidentHistory.find((r) => r.id === id);
}
