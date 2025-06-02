import sqlite3 from 'sqlite3';
import { promisify } from 'util';
import path from 'path';
import type { BookMetadata } from './types.ts';

export class CalibreReader {
  private db: sqlite3.Database | null = null;
  private libraryPath: string;

  constructor(libraryPath: string) {
    this.libraryPath = libraryPath;
  }

  async connect(): Promise<void> {
    const dbPath = path.join(this.libraryPath, 'metadata.db');
    
    return new Promise((resolve, reject) => {
      this.db = new sqlite3.Database(dbPath, (err: Error | null) => {
        if (err) {
          reject(new Error(`Failed to open Calibre database at ${dbPath}: ${err.message}`));
        } else {
          resolve();
        }
      });
    });
  }

  async getAllBooks(): Promise<BookMetadata[]> {
    if (!this.db) throw new Error('Database not connected');

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

    return new Promise((resolve, reject) => {
      this.db!.all(query, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const books: BookMetadata[] = rows.map(row => ({
          id: row.id,
          title: row.title,
          author_sort: row.author_sort,
          authors: row.authors || '',
          series: row.series_name,
          series_index: row.series_index,
          timestamp: new Date(row.timestamp),
          last_modified: new Date(row.last_modified),
          path: row.path,
          formats: row.formats ? row.formats.split(',') : []
        }));

        resolve(books);
      });
    });
  }

  async getCustomFields(): Promise<Record<string, any>> {
    if (!this.db) throw new Error('Database not connected');

    const query = `
      SELECT 
        cc.id,
        cc.label,
        cc.name,
        cc.datatype
      FROM custom_columns cc
      WHERE cc.display != '{}'
    `;

    return new Promise((resolve, reject) => {
      this.db!.all(query, (err: Error | null, rows: any[]) => {
        if (err) {
          reject(err);
          return;
        }

        const fields = rows.reduce((acc, row) => {
          acc[row.label] = {
            name: row.name,
            datatype: row.datatype,
            id: row.id
          };
          return acc;
        }, {});

        resolve(fields);
      });
    });
  }

  async getBookCustomFieldValues(bookId: number, customFields: Record<string, any>): Promise<Record<string, any>> {
    if (!this.db) throw new Error('Database not connected');
    
    const values: Record<string, any> = {};

    for (const [label, field] of Object.entries(customFields)) {
      const tableName = `custom_column_${field.id}`;
      const query = `SELECT value FROM ${tableName} WHERE book = ?`;

      try {
        const value = await new Promise((resolve, reject) => {
          this.db!.get(query, [bookId], (err: Error | null, row: any) => {
            if (err) {
              reject(err);
            } else {
              resolve(row?.value || null);
            }
          });
        });
        
        if (value !== null) {
          values[label] = value;
        }
      } catch (error) {
        // Ignore missing custom field tables
        console.warn(`Could not read custom field ${label} for book ${bookId}`);
      }
    }

    return values;
  }

  async close(): Promise<void> {
    if (this.db) {
      return new Promise((resolve, reject) => {
        this.db!.close((err: Error | null) => {
          if (err) {
            reject(err);
          } else {
            this.db = null;
            resolve();
          }
        });
      });
    }
  }
} 
