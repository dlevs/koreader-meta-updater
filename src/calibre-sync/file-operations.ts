import fs from 'fs/promises';
import path from 'path';
import { BookMetadata } from './types.js';

export interface CopyResult {
  success: boolean;
  sourcePath: string;
  targetPath: string;
  error?: string;
}

export class FileOperations {
  constructor(private dryRun: boolean = false) {}

  async copyEpubFile(book: BookMetadata, sourcePath: string, targetPath: string): Promise<CopyResult> {
    try {
      // Ensure target directory exists
      const targetDir = path.dirname(targetPath);
      
      if (!this.dryRun) {
        await fs.mkdir(targetDir, { recursive: true });
      }

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

      if (!this.dryRun) {
        await fs.copyFile(sourcePath, targetPath);
        
        // Copy file timestamps
        const stats = await fs.stat(sourcePath);
        await fs.utimes(targetPath, stats.atime, stats.mtime);
      }

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

  async removeObsoleteFiles(targetDir: string, currentFiles: Set<string>): Promise<string[]> {
    const removed: string[] = [];
    
    try {
      const existingFiles = await this.findEpubFiles(targetDir);
      
      for (const filePath of existingFiles) {
        const fileName = path.basename(filePath);
        if (!currentFiles.has(fileName)) {
          if (!this.dryRun) {
            await fs.unlink(filePath);
          }
          removed.push(filePath);
        }
      }
    } catch (error) {
      console.warn(`Warning: Could not clean up obsolete files: ${error}`);
    }

    return removed;
  }

  async findEpubFiles(directory: string): Promise<string[]> {
    const epubFiles: string[] = [];
    
    try {
      const entries = await fs.readdir(directory, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(directory, entry.name);
        
        if (entry.isDirectory()) {
          const subFiles = await this.findEpubFiles(fullPath);
          epubFiles.push(...subFiles);
        } else if (entry.name.toLowerCase().endsWith('.epub')) {
          epubFiles.push(fullPath);
        }
      }
    } catch (error) {
      // Directory doesn't exist or can't be read
    }

    return epubFiles;
  }

  async ensureDirectoryExists(dirPath: string): Promise<void> {
    if (!this.dryRun) {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  // Extract ID from filename like "Book Title (123).epub"
  static extractIdFromFilename(filename: string): number | null {
    const match = filename.match(/\((\d+)\)\.epub$/i);
    return match ? parseInt(match[1], 10) : null;
  }

  // Build filename with ID
  static buildFilenameWithId(baseName: string, id: number): string {
    return `${baseName} (${id}).epub`;
  }
} 
