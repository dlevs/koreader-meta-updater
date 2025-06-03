import { Command } from "commander";
import fs from "fs/promises";
import path from "path";
import { CalibreSync } from "./main-sync.ts";
import { config } from "../config.ts";

const program = new Command();

program
  .name("calibre-sync")
  .description(
    "Sync Calibre library to folder while maintaining KOReader metadata"
  )
  .version("1.0.0");

program
  .command("sync")
  .description("Sync books from Calibre to target folder")
  .option("-v, --verbose", "Verbose output")
  .action(async (options) => {
    try {
      // Validate paths
      await validateConfig();

      // Run sync
      console.log("🚀 Starting Calibre → Folder sync...");

      const sync = new CalibreSync();
      const result = await sync.sync();

      // Report results
      console.log("\n📊 Sync Results:");
      console.log(`   📚 Books processed: ${result.processed}`);
      console.log(`   ✅ Files updated: ${result.updated}`);
      console.log(`   🔄 KOReader updates: ${result.koreaderUpdates}`);
      console.log(`   ❌ Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log("\n❌ Errors encountered:");
        for (const error of result.errors) {
          console.log(`   • ${error.book}: ${error.error}`);
        }
      }

      if (result.updated > 0) {
        console.log("\n✨ Sync completed successfully!");
      }
    } catch (error) {
      console.error(
        "❌ Sync failed:",
        error instanceof Error ? error.message : String(error)
      );
      process.exit(1);
    }
  });

async function validateConfig(): Promise<void> {
  const errors: string[] = [];

  // Check required paths
  try {
    await fs.access(config.paths.calibreLibrary);
  } catch {
    errors.push(
      `Calibre library path does not exist: ${config.paths.calibreLibrary}`
    );
  }

  try {
    await fs.access(path.join(config.paths.calibreLibrary, "metadata.db"));
  } catch {
    errors.push(
      `Calibre metadata.db not found in: ${config.paths.calibreLibrary}`
    );
  }

  if (!config.paths.syncTarget) {
    errors.push("Sync target path is required");
  }

  if (!config.paths.koreaderSettings) {
    errors.push("KOReader settings path is required");
  }

  if (errors.length > 0) {
    throw new Error(
      "Configuration validation failed:\n" +
        errors.map((e) => `  • ${e}`).join("\n")
    );
  }
}

export { program };
