import fs from "fs/promises";
import path from "path";

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

  private async searchSdrDirectories(
    dir: string,
    bookId: number,
    results: string[],
  ): Promise<void> {
    try {
      const entries = await fs.readdir(dir, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);

        if (entry.isDirectory()) {
          if (entry.name.endsWith(".sdr")) {
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

  async updateSdrMetadata(
    sdrDir: string,
    newDocPath: string,
  ): Promise<boolean> {
    // Try to find the metadata file - KOReader creates different metadata files for different formats
    const possibleMetadataFiles = [
      "metadata.epub.lua", // EPUB
      "metadata.pdf.lua", // PDF
      "metadata.cbz.lua", // CBZ
      "metadata.mobi.lua", // MOBI
      "metadata.azw3.lua", // AZW3
      "metadata.fb2.lua", // FB2
    ];

    let metadataFile: string | null = null;

    // Find existing metadata file
    for (const filename of possibleMetadataFiles) {
      const filepath = path.join(sdrDir, filename);
      try {
        await fs.access(filepath);
        metadataFile = filepath;
        break;
      } catch {
        // File doesn't exist, continue
      }
    }

    if (!metadataFile) {
      console.warn(`Warning: No metadata file found in ${sdrDir}`);
      return false;
    }

    try {
      // Read current metadata
      const content = await fs.readFile(metadataFile, "utf-8");

      // Update doc_path
      const updatedContent = this.updateDocPath(content, newDocPath);

      if (content !== updatedContent) {
        await fs.writeFile(metadataFile, updatedContent, "utf-8");
        return true;
      }

      return false;
    } catch (error) {
      console.warn(
        `Warning: Could not update metadata in ${metadataFile}: ${error}`,
      );
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
    const insertPoint = content.indexOf("return {");
    if (insertPoint !== -1) {
      const beforeReturn = content.substring(0, insertPoint + 9);
      const afterReturn = content.substring(insertPoint + 9);
      return `${beforeReturn}\n    ["doc_path"] = "${newDocPath}",${afterReturn}`;
    }

    return content;
  }

  async renameSdrDirectory(
    oldPath: string,
    newFilename: string,
  ): Promise<string | null> {
    try {
      const dir = path.dirname(oldPath);
      const newSdrName = this.buildSdrNameFromFilename(newFilename);
      const newPath = path.join(dir, newSdrName);

      if (oldPath !== newPath) {
        await fs.rename(oldPath, newPath);
      }

      return newPath;
    } catch (error) {
      console.warn(
        `Warning: Could not rename SDR directory from ${oldPath}: ${error}`,
      );
      return null;
    }
  }

  private buildSdrNameFromFilename(filename: string): string {
    // Remove any file extension and add .sdr
    const extension = path.extname(filename);
    const baseName = filename.substring(0, filename.length - extension.length);
    return `${baseName}.sdr`;
  }

  static buildSdrPath(bookPath: string): string {
    // Remove any file extension and add .sdr
    const extension = path.extname(bookPath);
    const basePath = bookPath.substring(0, bookPath.length - extension.length);
    return `${basePath}.sdr`;
  }
}
