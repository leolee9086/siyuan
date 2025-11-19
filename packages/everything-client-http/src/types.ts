/**
 * @fileoverview Types for Everything HTTP client.
 */

/**
 * Raw search result item directly from the Everything HTTP API.
 * The API tends to return numbers as strings.
 */
export interface RawFileResult {
  type: 'file' | 'folder';
  name: string;
  path: string;
  size: string;
  date_modified: string;
  date_created: string;
  [key: string]: any;
}

/**
 * Processed file result after parsing and transformation.
 */
export interface ProcessedFileResult {
  id: string;
  type: "local";
  path: string; // Combined path + name
  name: string;
  mtimeMs: number;
  ctimeMs: number;
  size: number;
  index: number;
  // Includes all raw fields from the original item
  [key: string]: any;
}

/**
 * The final result object returned by the search function.
 */
export interface SearchResult {
  enabled: boolean;
  fileList: ProcessedFileResult[] | null;
}

/**
 * Options for building the search URL.
 */
export interface SearchOptions {
  search?: string;
  count?: number;
  offset?: number;

  // Search modifiers
  caseSensitive?: boolean;
  wholeWord?: boolean;
  searchPath?: boolean;
  regex?: boolean;
  matchDiacritics?: boolean;

  // Column visibility
  showPathColumn?: boolean;
  showSizeColumn?: boolean;
  showDateModifiedColumn?: boolean;
  showDateCreatedColumn?: boolean;
  showAttributesColumn?: boolean;

  // Sorting
  sort?: 'name' | 'path' | 'size' | 'date_modified';
  sortAscending?: boolean;
}

/**
 * Options for executing a search, including host and error handling flags.
 */
export interface SearchExecutionOptions extends SearchOptions {
  host?: string;
  noError?: boolean;
} 