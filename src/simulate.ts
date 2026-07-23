import "dotenv/config";
import mockAlerts from "./data/mockAlerts.json";
import { Alert } from "./types";
import { handleAlert } from "./orchestrator";

/**
 * Runs every mock alert through the full pipeline and prints a readable
 * summary for each — no server, no webhook, no API keys required.
 * Usage: npm run simulate
 */
async function main() {
  console.log("Incident Commander Agent — simulation run\n" + "=".repeat(60));

  for (const alert of mockAlerts as Alert[]) {
    console.log(`\n▶ Processing alert ${alert.id} (${alert.service}, ${alert.severity})`);
    const record = await handleAlert(alert);

    console.log(`  Hypothesis: ${record.hypothesis.summary}`);
    console.log(`  Confidence: ${record.hypothesis.confidence}`);
    console.log(`  Routed to: ${record.routedTo.onCallEngineer} (${record.routedTo.team})`);
    console.log(`  Postmortem draft generated: ${record.postmortemDraft.split("\n")[0]}`);
    console.log("-".repeat(60));
  }

  console.log("\nSimulation complete.");
}

main().catch((err) => {
  console.error("Simulation failed:", err);
  process.exit(1);
});
