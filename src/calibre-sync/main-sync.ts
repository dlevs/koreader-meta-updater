import path from 'path';
import { CalibreReader } from './calibre-reader.js';
import { TemplateEngine, sanitizeFilename } from './template-engine.js';
import { FileOperations } from './file-operations.js';
import { KOReaderManager } from './koreader-manager.js';
import { BookMetadata, SyncConfig, SyncResult } from './types.js';

export class CalibreSync {
  private calibreReader: CalibreReader;
  private templateEngine: TemplateEngine;
  private fileOps: FileOperations;
  private koreaderManager: KOReaderManager;

  constructor(private config: SyncConfig) {
    this.calibreReader = new CalibreReader(config.calibreLibraryPath);
    this.templateEngine = new TemplateEngine(config.template, config.fieldMappings);
    this.fileOps = new FileOperations(config.dryRun);
    this.koreaderManager = new KOReaderManager(config.koreaderPath, config.dryRun);
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      updated: 0,
      errors: [],
      koreaderUpdates: 0
    };

    try {
      console.log('🔗 Connecting to Calibre database...');
      await this.calibreReader.connect();

      console.log('📚 Reading book metadata...');
      const books = await this.calibreReader.getAllBooks();
      const customFields = await this.calibreReader.getCustomFields();

      console.log(`📖 Found ${books.length} books in Calibre library`);

      // Track current filenames for cleanup
      const currentFiles = new Set<string>();

      for (const book of books) {
        result.processed++;
        
        try {
          // Get custom field values
          const customFieldValues = await this.calibreReader.getBookCustomFieldValues(book.id, customFields);
          const enrichedBook = { ...book, ...customFieldValues };

          // Generate filename using template
          const baseName = this.templateEngine.render(enrichedBook);
          const safeBaseName = sanitizeFilename(baseName);
          const filename = FileOperations.buildFilenameWithId(safeBaseName, book.id);
          
          currentFiles.add(filename);

          // Find source epub file in Calibre library
          const sourceEpubPath = await this.findBookEpubPath(enrichedBook);
          if (!sourceEpubPath) {
            result.errors.push({
              book: `${book.title} (${book.id})`,
              error: 'No EPUB format found'
            });
            continue;
          }

          // Target path for sync
          const targetPath = path.join(this.config.syncTargetPath, filename);

          // Copy/update the file
          const copyResult = await this.fileOps.copyEpubFile(enrichedBook, sourceEpubPath, targetPath);
          
          if (!copyResult.success) {
            result.errors.push({
              book: `${book.title} (${book.id})`,
              error: copyResult.error || 'Copy failed'
            });
            continue;
          }

          if (copyResult.error !== 'File is up to date') {
            result.updated++;
            console.log(`📄 ${this.config.dryRun ? '[DRY RUN] ' : ''}Updated: ${filename}`);
          }

          // Handle KOReader metadata
          const koreaderUpdated = await this.updateKOReaderMetadata(book.id, targetPath, filename);
          if (koreaderUpdated) {
            result.koreaderUpdates++;
          }

        } catch (error) {
          result.errors.push({
            book: `${book.title} (${book.id})`,
            error: error instanceof Error ? error.message : String(error)
          });
        }
      }

      // Clean up obsolete files
      if (!this.config.dryRun) {
        console.log('🧹 Cleaning up obsolete files...');
        const removed = await this.fileOps.removeObsoleteFiles(this.config.syncTargetPath, currentFiles);
        if (removed.length > 0) {
          console.log(`🗑️  Removed ${removed.length} obsolete files`);
        }
      }

    } catch (error) {
      result.errors.push({
        book: 'System',
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      await this.calibreReader.close();
    }

    return result;
  }

  private async findBookEpubPath(book: BookMetadata): Promise<string | null> {
    const bookDir = path.join(this.config.calibreLibraryPath, book.path);
    
    try {
      const epubFiles = await this.fileOps.findEpubFiles(bookDir);
      return epubFiles.length > 0 ? epubFiles[0] : null;
    } catch (error) {
      return null;
    }
  }

  private async updateKOReaderMetadata(bookId: number, targetPath: string, filename: string): Promise<boolean> {
    try {
      // Find existing .sdr directories for this book ID
      const sdrDirs = await this.koreaderManager.findSdrDirectories(bookId);
      
      let updated = false;
      
      for (const sdrDir of sdrDirs) {
        // Update the doc_path in metadata
        const metadataUpdated = await this.koreaderManager.updateSdrMetadata(sdrDir, targetPath);
        
        // Rename .sdr directory if needed
        const currentSdrName = path.basename(sdrDir);
        const expectedSdrName = filename.replace(/\.epub$/i, '.sdr');
        
        if (currentSdrName !== expectedSdrName) {
          const newSdrPath = await this.koreaderManager.renameSdrDirectory(sdrDir, filename);
          if (newSdrPath) {
            console.log(`📁 ${this.config.dryRun ? '[DRY RUN] ' : ''}Renamed SDR: ${path.basename(sdrDir)} → ${path.basename(newSdrPath)}`);
            updated = true;
          }
        }
        
        if (metadataUpdated) {
          console.log(`🔄 ${this.config.dryRun ? '[DRY RUN] ' : ''}Updated KOReader metadata for: ${filename}`);
          updated = true;
        }
      }
      
      return updated;
    } catch (error) {
      console.warn(`Warning: Could not update KOReader metadata for book ${bookId}: ${error}`);
      return false;
    }
  }
} 
