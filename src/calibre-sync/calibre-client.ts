import fs from "fs/promises";
import os from "os";
import Database from "better-sqlite3";
import path, { resolve } from "path";
import { exec } from "child_process";
import { promisify } from "util";
import type { BookMetadata } from "./types.ts";

const execAsync = promisify(exec);

export class CalibreClient {
  private db;
  private libraryPath: string;

  constructor(libraryPath: string) {
    const dbPath = path.join(libraryPath, "metadata.db");
    this.libraryPath = libraryPath;
    this.db = new Database(dbPath);
  }

  getAllBooks(): BookMetadata[] {
    if (!this.db) throw new Error("Database not connected");

    const query = `
      SELECT 
        b.id,
        b.title,
        b.author_sort,
        b.timestamp,
        b.last_modified,
        b.path,
        GROUP_CONCAT(DISTINCT a.name) as authors,
        s.name as series_name,
        b.series_index,
        GROUP_CONCAT(DISTINCT d.format) as formats
      FROM books b
      LEFT JOIN books_authors_link bal ON b.id = bal.book
      LEFT JOIN authors a ON bal.author = a.id
      LEFT JOIN books_series_link bsl ON b.id = bsl.book
      LEFT JOIN series s ON bsl.series = s.id
      LEFT JOIN data d ON b.id = d.book
      GROUP BY b.id
    `;

    const rows = this.db.prepare(query).all() as any[];

    const books: BookMetadata[] = rows.map((row) => ({
      id: row.id,
      title: row.title,
      author_sort: row.author_sort,
      authors: row.authors || "",
      series: row.series_name,
      series_index: row.series_index,
      timestamp: new Date(row.timestamp),
      last_modified: new Date(row.last_modified),
      path: row.path,
      formats: row.formats ? row.formats.split(",") : [],
    }));

    return books;
  }

  getCustomFields(): Record<string, any> {
    if (!this.db) throw new Error("Database not connected");

    const query = `
      SELECT 
        cc.id,
        cc.label,
        cc.name,
        cc.datatype
      FROM custom_columns cc
      WHERE cc.display != '{}'
    `;

    const rows = this.db.prepare(query).all() as any[];

    const fields = rows.reduce((acc, row) => {
      acc[row.label] = {
        name: row.name,
        datatype: row.datatype,
        id: row.id,
      };
      return acc;
    }, {});

    return fields;
  }

  getBookCustomFieldValues(
    bookId: number,
    customFields: Record<string, any>
  ): Record<string, any> {
    if (!this.db) throw new Error("Database not connected");

    const values: Record<string, any> = {};

    for (const [label, field] of Object.entries(customFields)) {
      const tableName = `custom_column_${field.id}`;

      try {
        let value = null;

        if (field.datatype === "enumeration") {
          // Handle enum columns using the linking table
          const linkTableName = `books_custom_column_${field.id}_link`;
          const enumQuery = `
            SELECT GROUP_CONCAT(cc.value, ', ') as value
            FROM ${linkTableName} bcl
            JOIN ${tableName} cc ON bcl.value = cc.id
            WHERE bcl.book = ?
          `;
          const enumResult = this.db.prepare(enumQuery).get(bookId) as any;
          if (enumResult && enumResult.value) {
            value = enumResult.value;
          }
        } else {
          // Handle simple columns (bool, text, int, float, etc.)
          const simpleQuery = `SELECT value FROM ${tableName} WHERE book = ?`;
          const simpleResult = this.db.prepare(simpleQuery).get(bookId) as any;
          if (simpleResult) {
            value = simpleResult.value;
          }
        }

        if (value !== null && value !== undefined) {
          values[`#${label}`] = value;
        }
      } catch (error) {
        console.log(error);
        console.warn(`Could not read custom field ${label} for book ${bookId}`);
      }
    }

    return values;
  }

  close() {
    this.db.close();
  }

  /**
   * Export a book in the specified format with embedded metadata using calibredb
   */
  async exportBook(
    bookId: number,
    outputPath: string,
    format: string = "EPUB"
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Create a temporary directory for export
      const tempDir = await fs.mkdtemp(
        path.join(os.tmpdir(), "calibre-export-")
      );

      try {
        // Use calibredb to export the book with embedded metadata in the specified format
        const formatUpper = format.toUpperCase();
        const command = `calibredb export --library-path="${this.libraryPath}" --formats=${formatUpper} --single-dir --to-dir="${tempDir}" ${bookId}`;

        const { stdout, stderr } = await execAsync(command);

        if (stderr && !stderr.includes("WARNING")) {
          return { success: false, error: stderr };
        }

        // Find the exported book file in the temp directory
        const files = await fs.readdir(tempDir);
        const bookFile = this.findExportedFile(files, format);

        if (!bookFile) {
          return {
            success: false,
            error: `No ${format.toUpperCase()} file found after export`,
          };
        }

        const exportedPath = path.join(tempDir, bookFile);

        // Ensure the output directory exists
        await fs.mkdir(path.dirname(outputPath), { recursive: true });

        // Move the exported file to the desired location
        await fs.rename(exportedPath, outputPath);

        return { success: true };
      } finally {
        // Clean up the temporary directory
        try {
          await fs.rmdir(tempDir, { recursive: true });
        } catch (cleanupError) {
          console.warn(`Could not clean up temp directory: ${cleanupError}`);
        }
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }

  private findExportedFile(files: string[], format: string): string | null {
    const extension = `.${format.toLowerCase()}`;
    return files.find((file) => file.toLowerCase().endsWith(extension)) || null;
  }

  private async findExportedBook(
    exportDir: string,
    bookId: number,
    format: string
  ): Promise<string | null> {
    try {
      const fs = await import("fs/promises");
      const files = await fs.readdir(exportDir, { withFileTypes: true });
      const extension = `.${format.toLowerCase()}`;

      for (const file of files) {
        if (file.isFile() && file.name.toLowerCase().endsWith(extension)) {
          return path.join(exportDir, file.name);
        }
      }
    } catch (error) {
      console.warn(
        `Could not find exported ${format.toUpperCase()} for book ${bookId}: ${error}`
      );
    }

    return null;
  }
}
