import { Command } from 'commander';
import fs from 'fs/promises';
import path from 'path';
import { CalibreSync } from './main-sync.ts';
import type { SyncConfig } from './types.ts';

const program = new Command();

program
  .name('calibre-sync')
  .description('Sync Calibre library to folder while maintaining KOReader metadata')
  .version('1.0.0');

program
  .command('sync')
  .description('Sync books from Calibre to target folder')
  .option('-c, --config <path>', 'Path to config file', 'config/sync-config.json')
  .option('-v, --verbose', 'Verbose output')
  .option('--calibre-library <path>', 'Override Calibre library path')
  .option('--sync-target <path>', 'Override sync target path')
  .option('--koreader-path <path>', 'Override KOReader path')
  .action(async (options) => {
    try {
      // Load configuration
      const config = await loadConfig(options.config);
      
      // Apply command line overrides
      if (options.calibreLibrary) config.calibreLibraryPath = options.calibreLibrary;
      if (options.syncTarget) config.syncTargetPath = options.syncTarget;
      if (options.koreaderPath) config.koreaderPath = options.koreaderPath;

      // Validate paths
      await validateConfig(config);

      // Run sync
      console.log('🚀 Starting Calibre → Folder sync...');

      const sync = new CalibreSync(config);
      const result = await sync.sync();

      // Report results
      console.log('\n📊 Sync Results:');
      console.log(`   📚 Books processed: ${result.processed}`);
      console.log(`   ✅ Files updated: ${result.updated}`);
      console.log(`   🔄 KOReader updates: ${result.koreaderUpdates}`);
      console.log(`   ❌ Errors: ${result.errors.length}`);

      if (result.errors.length > 0) {
        console.log('\n❌ Errors encountered:');
        for (const error of result.errors) {
          console.log(`   • ${error.book}: ${error.error}`);
        }
      }

      if (result.updated > 0) {
        console.log('\n✨ Sync completed successfully!');
      }

    } catch (error) {
      console.error('❌ Sync failed:', error instanceof Error ? error.message : String(error));
      process.exit(1);
    }
  });

program
  .command('config')
  .description('Generate a sample configuration file')
  .option('-o, --output <path>', 'Output path for config file', 'sync-config.json')
  .action(async (options) => {
    const sampleConfig: SyncConfig = {
      calibreLibraryPath: '/path/to/your/calibre/library',
      syncTargetPath: '/path/to/your/sync/folder',
      koreaderPath: '/path/to/your/koreader/docsettings',
      template: '{#genre} - {author_sort} - {series:|| }{series_index:|| - }{title} ({id})',
      supportedExtensions: ['.epub', '.cbz', '.pdf', '.mobi', '.azw3', '.fb2'],
      fieldMappings: {
        '#genre': {
          'Fiction': '0100 - Fiction',
          'Fantasy': '0200 - Fantasy',
          'Science Fiction': '0300 - Science Fiction',
          'Non-Fiction': '1000 - Non-Fiction',
          'Biography': '1100 - Biography'
        }
      },
      mappedFields: ['#genre'],
      backupSdrFiles: true
    };

    try {
      await fs.writeFile(options.output, JSON.stringify(sampleConfig, null, 2));
      console.log(`✅ Sample configuration written to: ${options.output}`);
      console.log('📝 Edit the file to match your setup before running sync.');
    } catch (error) {
      console.error('❌ Failed to write config file:', error);
      process.exit(1);
    }
  });

async function loadConfig(configPath: string): Promise<SyncConfig> {
  try {
    const content = await fs.readFile(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (error) {
    throw new Error(`Failed to load config from ${configPath}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

async function validateConfig(config: SyncConfig): Promise<void> {
  const errors: string[] = [];

  // Check required paths
  try {
    await fs.access(config.calibreLibraryPath);
  } catch {
    errors.push(`Calibre library path does not exist: ${config.calibreLibraryPath}`);
  }

  try {
    await fs.access(path.join(config.calibreLibraryPath, 'metadata.db'));
  } catch {
    errors.push(`Calibre metadata.db not found in: ${config.calibreLibraryPath}`);
  }

  if (!config.syncTargetPath) {
    errors.push('Sync target path is required');
  }

  if (!config.koreaderPath) {
    errors.push('KOReader path is required');
  }

  if (errors.length > 0) {
    throw new Error('Configuration validation failed:\n' + errors.map(e => `  • ${e}`).join('\n'));
  }
}

export { program }; 
