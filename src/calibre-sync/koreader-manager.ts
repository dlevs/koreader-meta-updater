import fs from 'fs/promises';
import path from 'path';

export interface KOReaderMetadata {
  doc_path: string;
  [key: string]: any;
}

export class KOReaderManager {
  private koreaderPath: string;

  constructor(koreaderPath: string) {
    this.koreaderPath = koreaderPath;
  }

  async findSdrDirectories(bookId: number): Promise<string[]> {
    const sdrDirs: string[] = [];
    
    try {
      await this.searchSdrDirectories(this.koreaderPath, bookId, sdrDirs);
    } catch (error) {
      console.warn(`Warning: Could not search KOReader directories: ${error}`);
    }

    return sdrDirs;
  }

  private async searchSdrDirectories(dir: string, bookId: number, results: string[]): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });
      
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        
        if (entry.isDirectory()) {
          if (entry.name.endsWith('.sdr')) {
            // Extract ID from .sdr directory name
            const extractedId = this.extractIdFromSdrName(entry.name);
            if (extractedId === bookId) {
              results.push(fullPath);
            }
          } else {
            // Recursively search subdirectories
            await this.searchSdrDirectories(fullPath, bookId, results);
          }
        }
      }
    } catch (error) {
      // Ignore directories we can't read
    }
  }

  private extractIdFromSdrName(sdrName: string): number | null {
    const match = sdrName.match(/\((\d+)\)\.sdr$/);
    return match?.[1] ? parseInt(match[1], 10) : null;
  }

  async updateSdrMetadata(sdrDir: string, newDocPath: string): Promise<boolean> {
    const metadataFile = path.join(sdrDir, 'metadata.epub.lua');
    
    try {
      // Check if metadata file exists
      await fs.access(metadataFile);
      
      // Read current metadata
      const content = await fs.readFile(metadataFile, 'utf-8');
      
      // Update doc_path
      const updatedContent = this.updateDocPath(content, newDocPath);
      
      if (content !== updatedContent) {
        await fs.writeFile(metadataFile, updatedContent, 'utf-8');
        return true;
      }
      
      return content !== updatedContent;
    } catch (error) {
      console.warn(`Warning: Could not update metadata in ${metadataFile}: ${error}`);
      return false;
    }
  }

  private updateDocPath(content: string, newDocPath: string): string {
    // Match the doc_path assignment in Lua format
    const docPathRegex = /(\s*\["doc_path"\]\s*=\s*")([^"]+)(")/;
    const match = content.match(docPathRegex);
    
    if (match) {
      return content.replace(docPathRegex, `$1${newDocPath}$3`);
    }
    
    // If no doc_path found, add it (shouldn't happen in normal cases)
    const insertPoint = content.indexOf('return {');
    if (insertPoint !== -1) {
      const beforeReturn = content.substring(0, insertPoint + 9);
      const afterReturn = content.substring(insertPoint + 9);
      return `${beforeReturn}\n    ["doc_path"] = "${newDocPath}",${afterReturn}`;
    }
    
    return content;
  }

  async renameSdrDirectory(oldPath: string, newFilename: string): Promise<string | null> {
    try {
      const dir = path.dirname(oldPath);
      const newSdrName = newFilename.replace(/\.epub$/i, '.sdr');
      const newPath = path.join(dir, newSdrName);
      
      if (oldPath !== newPath) {
        await fs.rename(oldPath, newPath);
      }
      
      return newPath;
    } catch (error) {
      console.warn(`Warning: Could not rename SDR directory from ${oldPath}: ${error}`);
      return null;
    }
  }

  static buildSdrPath(epubPath: string): string {
    return epubPath.replace(/\.epub$/i, '.sdr');
  }
} 
