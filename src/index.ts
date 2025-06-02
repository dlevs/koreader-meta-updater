#!/usr/bin/env node

import { Command } from 'commander';
import * as fs from 'fs';
import * as path from 'path';
import { fixKoReaderMetadata } from './koreader-fixer.js';

const program = new Command();

program
  .name('koreader-fix')
  .description('Fix KOReader sidecar files when epub filenames are updated')
  .version('1.0.0')
  .requiredOption('-e, --epub-dir <path>', 'Directory containing epub files')
  .requiredOption('-d, --docsettings-dir <path>', 'Directory containing KOReader docsettings')
  .option('-v, --verbose', 'Enable verbose output', false)
  .option('--dry-run', 'Show what would be changed without making any modifications', false)
  .action(async (options) => {
    try {
      // Validate directories exist
      if (!fs.existsSync(options.epubDir)) {
        console.error(`Error: Epub directory "${options.epubDir}" does not exist`);
        process.exit(1);
      }

      if (!fs.existsSync(options.docsettingsDir)) {
        console.error(`Error: Docsettings directory "${options.docsettingsDir}" does not exist`);
        process.exit(1);
      }

      // Convert to absolute paths
      const epubDir = path.resolve(options.epubDir);
      const docsettingsDir = path.resolve(options.docsettingsDir);

      if (options.dryRun) {
        console.log('🔍 DRY RUN MODE - No changes will be made');
      }
      
      console.log(`🔧 ${options.dryRun ? 'Analyzing' : 'Fixing'} KOReader metadata...`);
      console.log(`📚 Epub directory: ${epubDir}`);
      console.log(`⚙️  Docsettings directory: ${docsettingsDir}`);
      console.log('');

      await fixKoReaderMetadata(epubDir, docsettingsDir, options.verbose, options.dryRun);

      console.log(`✅ ${options.dryRun ? 'Analysis complete!' : 'Done!'}`);
    } catch (error) {
      console.error('❌ Error:', error instanceof Error ? error.message : error);
      process.exit(1);
    }
  });

program.parse(); 
