import fs from 'fs/promises';
import path from 'path';
import type { BookMetadata } from './types.ts';

export interface CopyResult {
  success: boolean;
  sourcePath: string;
  targetPath: string;
  error?: string;
}

export class FileOperations {
  private supportedExtensions: string[];

  constructor(supportedExtensions: string[] = ['.epub', '.cbz', '.pdf', '.mobi', '.azw3', '.fb2']) {
    this.supportedExtensions = supportedExtensions.map(ext => ext.toLowerCase());
  }

  async copyBookFile(book: BookMetadata, sourcePath: string, targetPath: string): Promise<CopyResult> {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      
      await fs.mkdir(targetDir, { recursive: true });

      // Check if file already exists and is newer
      const shouldCopy = await this.shouldCopyFile(sourcePath, targetPath);
      
      if (!shouldCopy) {
        return {
          success: true,
          sourcePath,
          targetPath,
          error: 'File is up to date'
        };
      }

      await fs.copyFile(sourcePath, targetPath);
      
      // Copy file timestamps
      const stats = await fs.stat(sourcePath);
      await fs.utimes(targetPath, stats.atime, stats.mtime);

      return {
        success: true,
        sourcePath,
        targetPath
      };
    } catch (error) {
      return {
        success: false,
        sourcePath,
        targetPath,
        error: error instanceof Error ? error.message : String(error)
      };
    }
  }

  private async shouldCopyFile(sourcePath: string, targetPath: string): Promise<boolean> {
    try {
      const [sourceStats, targetStats] = await Promise.all([
        fs.stat(sourcePath),
        fs.stat(targetPath).catch(() => null)
      ]);

      // If target doesn't exist, we should copy
      if (!targetStats) {
        return true;
      }

      // If source is newer, we should copy
      return sourceStats.mtime > targetStats.mtime;
    } catch (error) {
      // If we can't read source, don't copy
      return false;
    }
  }

  async needsUpdate(sourcePath: string, targetPath: string): Promise<boolean> {
    return this.shouldCopyFile(sourcePath, targetPath);
  }

  async removeObsoleteFiles(targetDir: string, currentFiles: Set<string>): Promise<string[]> {
    const removed: string[] = [];
    
    try {
      const existingFiles = await this.findBookFiles(targetDir);
      
      for (const filePath of existingFiles) {
        const fileName = path.basename(filePath);
        if (!currentFiles.has(fileName)) {
          await fs.unlink(filePath);
          removed.push(filePath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not clean up obsolete files: ${error}`);
    }

    return removed;
  }

  async findBookFiles(directory: string): Promise<string[]> {
    const bookFiles: string[] = [];
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findBookFiles(fullPath);
          bookFiles.push(...subFiles);
        } else if (this.isSupportedBookFile(entry.name)) {
          bookFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return bookFiles;
  }

  private isSupportedBookFile(filename: string): boolean {
    const extension = path.extname(filename).toLowerCase();
    return this.supportedExtensions.includes(extension);
  }

  async ensureDirectoryExists(dirPath: string): Promise<void> {
    await fs.mkdir(dirPath, { recursive: true });
  }

  // Extract ID from filename like "Book Title (123).epub" or "Book Title (123).cbz" etc.
  static extractIdFromFilename(filename: string): number | null {
    // Match pattern like "(123).ext" where ext is any supported extension
    const match = filename.match(/\((\d+)\)\.[^.]+$/i);
    return match?.[1] ? parseInt(match[1], 10) : null;
  }

  // Build filename with ID, preserving the original extension
  static buildFilenameWithId(baseName: string, id: number, extension: string): string {
    // Ensure extension starts with a dot
    const ext = extension.startsWith('.') ? extension : `.${extension}`;
    return `${baseName} (${id})${ext}`;
  }

  // Get file extension from a filename
  static getFileExtension(filename: string): string {
    return path.extname(filename);
  }

  // Check if a file extension is supported
  isSupportedExtension(extension: string): boolean {
    return this.supportedExtensions.includes(extension.toLowerCase());
  }

  // Get list of supported extensions
  getSupportedExtensions(): string[] {
    return [...this.supportedExtensions];
  }
} 
