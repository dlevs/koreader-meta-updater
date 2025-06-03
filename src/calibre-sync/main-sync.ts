import path from "path";
import { CalibreClient } from "./calibre-client.ts";
import { FileOperations } from "./file-operations.ts";
import { KOReaderManager } from "./koreader-manager.ts";
import { config } from "../config.ts";
import type { BookMetadata, SyncResult } from "./types.ts";

export class CalibreSync {
  private calibreClient: CalibreClient;
  private fileOps: FileOperations;
  private koreaderManager: KOReaderManager;

  constructor() {
    this.calibreClient = new CalibreClient(config.paths.calibreLibrary);
    this.fileOps = new FileOperations(config.files.supportedExtensions);
    this.koreaderManager = new KOReaderManager(config.paths.koreaderSettings);
  }

  async sync(): Promise<SyncResult> {
    const result: SyncResult = {
      processed: 0,
      updated: 0,
      errors: [],
      koreaderUpdates: 0,
    };

    try {
      console.log("📚 Reading book metadata...");
      const books = this.calibreClient.getAllBooks();
      const customFields = this.calibreClient.getCustomFields();

      console.log(`📖 Found ${books.length} books in Calibre library`);

      // Track current filenames for cleanup
      const currentFiles = new Set<string>();

      for (const book of books) {
        result.processed++;

        try {
          // Get custom field values
          const customFieldValues = this.calibreClient.getBookCustomFieldValues(
            book.id,
            customFields
          );
          const enrichedBook = { ...book, ...customFieldValues };

          // Find preferred format from available formats
          const preferredFormat = this.getPreferredFormat(
            enrichedBook.formats || []
          );

          if (!preferredFormat) {
            result.errors.push({
              book: `${book.title} (${book.id})`,
              error: `No supported format found. Available: ${enrichedBook.formats?.join(", ") || "none"}`,
            });
            continue;
          }

          // Generate filename using config function
          const baseName = config.buildFilename(enrichedBook);
          const filename = FileOperations.buildFilenameWithId(
            baseName,
            book.id,
            preferredFormat.toLowerCase()
          );

          currentFiles.add(filename);

          // Target path for sync
          const targetPath = path.join(config.paths.syncTarget, filename);

          // Check if file needs updating (compare book's last_modified with target file)
          const needsUpdate = await this.bookNeedsUpdate(
            enrichedBook,
            targetPath
          );

          if (!needsUpdate) {
            continue; // File is up to date
          }

          // Export book with embedded metadata using Calibre
          const exportResult = await this.calibreClient.exportBook(
            book.id,
            targetPath,
            preferredFormat
          );

          if (!exportResult.success) {
            result.errors.push({
              book: `${book.title} (${book.id})`,
              error: exportResult.error || "Export failed",
            });
            continue;
          }

          result.updated++;
          console.log(`📄 Updated: ${filename}`);

          // Handle KOReader metadata
          const koreaderUpdated = await this.updateKOReaderMetadata(
            book.id,
            targetPath,
            filename
          );
          if (koreaderUpdated) {
            result.koreaderUpdates++;
          }
        } catch (error) {
          result.errors.push({
            book: `${book.title} (${book.id})`,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Clean up obsolete files
      console.log("🧹 Cleaning up obsolete files...");
      const removed = await this.fileOps.removeObsoleteFiles(
        config.paths.syncTarget,
        currentFiles
      );
      if (removed.length > 0) {
        console.log(`🗑️  Removed ${removed.length} obsolete files`);
      }
    } catch (error) {
      result.errors.push({
        book: "System",
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      this.calibreClient.close();
    }

    return result;
  }

  private getPreferredFormat(availableFormats: string[]): string | null {
    // Define format preference order (EPUB is preferred, then others)
    const formatPreference = ["EPUB", "CBZ", "PDF", "MOBI", "AZW3", "FB2"];

    for (const preferredFormat of formatPreference) {
      if (availableFormats.includes(preferredFormat)) {
        return preferredFormat;
      }
    }

    // If none of the preferred formats are available, check if any available format is supported
    const supportedExtensions = this.fileOps.getSupportedExtensions();
    for (const format of availableFormats) {
      const extension = `.${format.toLowerCase()}`;
      if (supportedExtensions.includes(extension)) {
        return format;
      }
    }

    return null;
  }

  private async findBookFilePath(book: BookMetadata): Promise<string | null> {
    const bookDir = path.join(config.paths.calibreLibrary, book.path);

    try {
      const bookFiles = await this.fileOps.findBookFiles(bookDir);
      return bookFiles[0] ?? null;
    } catch (error) {
      return null;
    }
  }

  private async updateKOReaderMetadata(
    bookId: number,
    targetPath: string,
    filename: string
  ): Promise<boolean> {
    try {
      // Find existing .sdr directories for this book ID
      const sdrDirs = await this.koreaderManager.findSdrDirectories(bookId);

      let updated = false;

      for (const sdrDir of sdrDirs) {
        // Update the doc_path in metadata
        const metadataUpdated = await this.koreaderManager.updateSdrMetadata(
          sdrDir,
          targetPath
        );

        // Rename .sdr directory if needed
        const currentSdrName = path.basename(sdrDir);
        const fileExtension = FileOperations.getFileExtension(filename);
        const expectedSdrName = filename.replace(
          new RegExp(`\\${fileExtension}$`, "i"),
          ".sdr"
        );

        if (currentSdrName !== expectedSdrName) {
          const newSdrPath = await this.koreaderManager.renameSdrDirectory(
            sdrDir,
            filename
          );
          if (newSdrPath) {
            console.log(
              `📁 Renamed SDR: ${path.basename(sdrDir)} → ${path.basename(newSdrPath)}`
            );
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
      console.warn(
        `Warning: Could not update KOReader metadata for book ${bookId}: ${error}`
      );
      return false;
    }
  }

  private async bookNeedsUpdate(
    book: BookMetadata,
    targetPath: string
  ): Promise<boolean> {
    try {
      const fs = await import("fs/promises");
      const targetStats = await fs.stat(targetPath);

      // If book's last_modified is newer than target file, we need to update
      return book.last_modified > targetStats.mtime;
    } catch (error) {
      // If target file doesn't exist, we need to update
      return true;
    }
  }
}
