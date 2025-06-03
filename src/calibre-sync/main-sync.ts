import path from 'path';
import { CalibreClient } from './calibre-client.ts';
import { TemplateEngine, sanitizeFilename } from './template-engine.ts';
import { FileOperations } from './file-operations.ts';
import { KOReaderManager } from './koreader-manager.ts';
import type { BookMetadata, SyncConfig, SyncResult } from './types.ts';

export class CalibreSync {
  private config: SyncConfig;
  private calibreClient: CalibreClient;
  private templateEngine: TemplateEngine;
  private fileOps: FileOperations;
  private koreaderManager: KOReaderManager;

  constructor(config: SyncConfig) {
    this.config = config;
    this.calibreClient = new CalibreClient(config.calibreLibraryPath);
    this.templateEngine = new TemplateEngine(config.template, config.fieldMappings);
    this.fileOps = new FileOperations();
    this.koreaderManager = new KOReaderManager(config.koreaderPath);
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
      await this.calibreClient.connect();

      console.log('📚 Reading book metadata...');
      const books = await this.calibreClient.getAllBooks();
      const customFields = await this.calibreClient.getCustomFields();

      console.log(`📖 Found ${books.length} books in Calibre library`);

      // Track current filenames for cleanup
      const currentFiles = new Set<string>();

      for (const book of books) {
        result.processed++;
        
        try {
          // Get custom field values
          const customFieldValues = await this.calibreClient.getBookCustomFieldValues(book.id, customFields);
          const enrichedBook = { ...book, ...customFieldValues };

          console.dir(book, { depth: null });

          // Generate filename using template
          const baseName = this.templateEngine.render(enrichedBook);
          const safeBaseName = sanitizeFilename(baseName);
          const filename = FileOperations.buildFilenameWithId(safeBaseName, book.id);
          
          currentFiles.add(filename);

          // Target path for sync
          const targetPath = path.join(this.config.syncTargetPath, filename);

          // Check if book has EPUB format
          if (!enrichedBook.formats?.includes('EPUB')) {
            result.errors.push({
              book: `${book.title} (${book.id})`,
              error: 'No EPUB format found'
            });
            continue;
          }

          // Check if file needs updating (compare book's last_modified with target file)
          const needsUpdate = await this.bookNeedsUpdate(enrichedBook, targetPath);
          
          if (!needsUpdate) {
            continue; // File is up to date
          }

          // Export book with embedded metadata using Calibre
          const exportResult = await this.calibreClient.exportBook(book.id, targetPath);
          
          if (!exportResult.success) {
            result.errors.push({
              book: `${book.title} (${book.id})`,
              error: exportResult.error || 'Export failed'
            });
            continue;
          }

          result.updated++;
          console.log(`📄 Updated: ${filename}`);

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
      console.log('🧹 Cleaning up obsolete files...');
      const removed = await this.fileOps.removeObsoleteFiles(this.config.syncTargetPath, currentFiles);
      if (removed.length > 0) {
        console.log(`🗑️  Removed ${removed.length} obsolete files`);
      }

    } catch (error) {
      result.errors.push({
        book: 'System',
        error: error instanceof Error ? error.message : String(error)
      });
    } finally {
      await this.calibreClient.close();
    }

    return result;
  }

  private async findBookEpubPath(book: BookMetadata): Promise<string | null> {
    const bookDir = path.join(this.config.calibreLibraryPath, book.path);
    
    try {
      const epubFiles = await this.fileOps.findEpubFiles(bookDir);
      return epubFiles[0] ?? null;
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
            console.log(`📁 Renamed SDR: ${path.basename(sdrDir)} → ${path.basename(newSdrPath)}`);
            updated = true;
          }
        }
        
        if (metadataUpdated) {
          console.log(`🔄 Updated KOReader metadata for: ${filename}`);
          updated = true;
        }
      }
      
      return updated;
    } catch (error) {
      console.warn(`Warning: Could not update KOReader metadata for book ${bookId}: ${error}`);
      return false;
    }
  }

  private async bookNeedsUpdate(book: BookMetadata, targetPath: string): Promise<boolean> {
    try {
      const fs = await import('fs/promises');
      const targetStats = await fs.stat(targetPath);
      
      // If book's last_modified is newer than target file, we need to update
      return book.last_modified > targetStats.mtime;
    } catch (error) {
      // If target file doesn't exist, we need to update
      return true;
    }
  }
} 
