// Run via: npm run reminders
// Designed for cron / Vercel cron / GitHub Actions.
import { config as loadEnv } from "dotenv";
import path from "path";

// Load Next.js-style env files (.env.local takes precedence)
loadEnv({ path: path.resolve(process.cwd(), ".env.local") });
loadEnv({ path: path.resolve(process.cwd(), ".env") });

import { runReminderSweep } from "../src/lib/reminders";

async function main() {
  const { sent } = await runReminderSweep();
  // eslint-disable-next-line no-console
  console.log(`Reminder sweep complete. ${sent} reminder(s) sent.`);
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error(err);
  process.exit(1);
});
