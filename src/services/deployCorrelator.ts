import deploys from "../data/mockDeploys.json";
import { Alert, Deploy } from "../types";

/**
 * In production this would call the GitHub Deployments API or your CI/CD
 * provider (Argo, Spinnaker, etc.) filtered by service + a time window
 * around the alert. Here we simulate that lookup against mock data.
 */
export function findSuspectDeploy(alert: Alert, windowMinutes = 120): Deploy | null {
  const alertTime = new Date(alert.timestamp).getTime();
  const candidates = (deploys as Deploy[])
    .filter((d) => d.service === alert.service)
    .filter((d) => {
      const deployTime = new Date(d.deployedAt).getTime();
      const diffMinutes = (alertTime - deployTime) / (1000 * 60);
      return diffMinutes >= 0 && diffMinutes <= windowMinutes;
    })
    .sort(
      (a, b) => new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
    );

  return candidates[0] ?? null;
}
