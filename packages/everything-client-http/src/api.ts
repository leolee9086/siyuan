/**
 * @fileoverview Core API functions for Everything HTTP service.
 */

import type {
  SearchExecutionOptions,
  SearchResult,
  RawFileResult,
} from './types';
import { computeSearchUrl } from './url';

/**
 * 测试 Everything HTTP 服务是否可用。
 * @async
 * @param host - Everything 服务的主机名或 IP 地址。
 * @param port - Everything 服务的端口号。
 * @returns 如果服务响应正常则返回 true，否则返回 false。
 */
export const useServiceTest = async (
  host: string,
  port: number | string
): Promise<boolean> => {
  try {
    const url = computeSearchUrl(host, port, { search: '', count: 1 });
    const response = await fetch(url);
    if (!response.ok) {
      console.warn(`Everything service test failed: HTTP status ${response.status}`);
      return false;
    }
    const data = await response.json();
    if (typeof data !== 'object' || !data || !Array.isArray(data.results)) {
      console.warn('Everything service test failed: Invalid JSON response format.');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error testing Everything service:', error);
    return false;
  }
};

/**
 * 通过 Everything HTTP 服务执行搜索并处理结果。
 * @async
 * @param searchValue - 搜索查询字符串。
 * @param port - Everything 服务的端口号。
 * @param options - 包含 host 和其他搜索配置的选项对象。
 * @returns {Promise<SearchResult>} 一个解析为 SearchResult 对象的 Promise，包含 enabled 状态和 fileList 文件列表。
 */
export const useSearch = async (
  searchValue: string,
  port: number | string,
  options: SearchExecutionOptions = {}
): Promise<SearchResult> => {
  const { host = 'localhost', noError = false, ...searchOptions } = options;

  if ((!searchValue || searchValue.length < 2) && !searchOptions.count) {
    if (!noError) {
      console.log("Search value is too short or empty, and no specific count provided.");
    }
    return { enabled: false, fileList: null };
  }

  const everythingURL = computeSearchUrl(host, port, {
    search: searchValue,
    showPathColumn: true,
    showSizeColumn: true,
    showDateModifiedColumn: true,
    showDateCreatedColumn: true,
    ...searchOptions,
  });

  try {
    const response = await fetch(everythingURL);
    if (!response.ok) {
      if (!noError) {
        console.error(`Everything search failed: HTTP status ${response.status}`);
      }
      return { enabled: false, fileList: null };
    }
    const json = await response.json();

    if (json && Array.isArray(json.results)) {
      const fileList = json.results
        .filter((item: RawFileResult) => item.type === 'file')
        .map((item: RawFileResult, index: number) => ({
          ...item,
          id: `local_entry_${item.path.replace(/\\/g, '/')}_${item.name}`.replace(/\s/g, '_'),
          type: "local",
          path: `${item.path}\\${item.name}`.replace(/\\/g, '/'),
          mtimeMs: Number(item.date_modified) || 0,
          ctimeMs: Number(item.date_created) || 0,
          size: Number(item.size) || 0,
          index,
        }));
      return { enabled: true, fileList };
    } else {
      if (!noError) {
        console.warn('Everything search failed: Invalid JSON response format.');
      }
      return { enabled: false, fileList: null };
    }
  } catch (e) {
    if (!noError) {
      console.error('Error during Everything search:', e);
    }
    return { enabled: false, fileList: null };
  }
}; 