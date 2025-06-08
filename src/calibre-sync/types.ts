export interface BookMetadata {
  id: number;
  title: string;
  author_sort: string;
  authors: string;
  series?: string;
  series_index?: number;
  timestamp: Date;
  last_modified: Date;
  path: string;
  formats: string[];
  [key: string]: any; // Support custom fields
}

export interface SyncResult {
  processed: number;
  updated: number;
  errors: Array<{ book: string; error: string }>;
  koreaderUpdates: number;
}

export interface FieldMapping {
  fieldName: string;
  mappings: Record<string, string>;
  defaultValue?: string;
}

export interface Config {
  paths: {
    calibreLibrary: string;
    syncTarget: string;
    koreaderSettings: string;
  };
  files: {
    supportedExtensions: string[];
    backupSdrFiles: boolean;
  };
  buildFilename(book: BookMetadata): string;
}
