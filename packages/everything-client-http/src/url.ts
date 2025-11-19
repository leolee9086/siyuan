/**
 * @fileoverview URL computation for Everything HTTP service.
 */

import type { SearchOptions } from './types';

/**
 * 构建访问 Everything HTTP 服务的 URL。
 * @param host - Everything 服务的主机名或 IP 地址。
 * @param port - Everything 服务的端口号。
 * @param options - 查询选项。
 * @returns 构建好的 URL 字符串。
 */
export const computeSearchUrl = (
  host: string,
  port: number | string,
  options: SearchOptions = {}
): string => {
  const {
    // General
    search = '',
    count,
    offset,

    // Search modifiers
    caseSensitive,
    wholeWord,
    searchPath,
    regex,
    matchDiacritics,

    // Columns
    showPathColumn = true, // Default to true for minimum functionality
    showSizeColumn = true,
    showDateModifiedColumn = true,
    showDateCreatedColumn = true,
    showAttributesColumn,

    // Sorting
    sort,
    sortAscending,
  } = options;

  const params: Record<string, string> = {
    search,
    json: '1',
  };

  // General
  if (count !== undefined) params.count = String(count);
  if (offset !== undefined) params.o = String(offset);

  // Search Modifiers
  if (caseSensitive) params.case = '1';
  if (wholeWord) params.wholeword = '1';
  if (searchPath) params.p = '1';
  if (regex) params.r = '1';
  if (matchDiacritics) params.m = '1';

  // Columns
  if (showPathColumn) params.path_column = '1';
  if (showSizeColumn) params.size_column = '1';
  if (showDateModifiedColumn) params.date_modified_column = '1';
  if (showDateCreatedColumn) params.date_created_column = '1';
  if (showAttributesColumn) params.attributes_column = '1';
  
  // Sorting
  if (sort) params.sort = sort;
  if (sortAscending !== undefined) {
    params.ascending = sortAscending ? '1' : '0';
  }

  const searchParams = new URLSearchParams(params);

  return `http://${host}:${port}/?${searchParams.toString()}`;
}; 