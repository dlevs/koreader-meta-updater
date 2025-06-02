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

export interface SyncConfig {
  calibreLibraryPath: string;
  syncTargetPath: string;
  koreaderPath: string;
  template: string;
  fieldMappings: Record<string, Record<string, string>>;
  mappedFields: string[];
  backupSdrFiles: boolean;
  dryRun: boolean;
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
