/**
 * @fileoverview 与 Everything HTTP 服务交互的函数。
 * 依赖 fetch API。
 */

/**
 * @typedef {object} EverythingSearchOptions
 * @property {string} [search=''] - 搜索查询字符串。
 * @property {boolean} [showPathColumn=true] - 是否包含路径列。
 * @property {boolean} [showSizeColumn=true] - 是否包含大小列。
 * @property {boolean} [showDateModifiedColumn=true] - 是否包含修改日期列。
 * @property {boolean} [showDateCreatedColumn=true] - 是否包含创建日期列。
 * @property {number} [count=100000] - 最大返回结果数。
 * @property {boolean} [noError=false] - searchByEverything 中是否禁止打印错误日志
 */

/**
 * 构建访问 Everything HTTP 服务的 URL。
 * @param {string} host - Everything 服务的主机名或 IP 地址。
 * @param {number|string} port - Everything 服务的端口号。
 * @param {EverythingSearchOptions} [options={}] - 查询选项。
 * @returns {string} 构建好的 URL 字符串。
 */
export const formatEverythingSearchUrl = (host, port, options = {}) => {
    const {
        search = '',
        showPathColumn = true,
        showSizeColumn = true,
        showDateModifiedColumn = true,
        showDateCreatedColumn = true,
        count = 100000 // 默认值设大一些以匹配原代码
    } = options;

    const params = new URLSearchParams({
        search: search,
        json: '1', // 明确指定为字符串 '1'
        path_column: showPathColumn ? '1' : '0',
        size_column: showSizeColumn ? '1' : '0',
        date_modified_column: showDateModifiedColumn ? '1' : '0',
        date_created_column: showDateCreatedColumn ? '1' : '0',
        count: String(count) // 明确转换为字符串
    });

    return `http://${host}:${port}/?${params.toString()}`;
};

/**
 * 测试 Everything HTTP 服务是否可用。
 * @async
 * @param {string} host - Everything 服务的主机名或 IP 地址。
 * @param {number|string} port - Everything 服务的端口号。
 * @returns {Promise<boolean>} 如果服务响应正常则返回 true，否则返回 false。
 */
export const useEverything_testService = async (host, port) => {
    try {
        // 使用 count=1 进行最小请求测试
        const url = formatEverythingSearchUrl(host, port, { search: '', count: 1 });
        const response = await fetch(url);
        if (!response.ok) {
            // 不抛出错误，仅记录并返回 false
            console.warn(`Everything service test failed: HTTP status ${response.status}`);
            return false;
        }
        const data = await response.json();
        // 检查返回的基本结构
        if (typeof data !== 'object' || !data || !Array.isArray(data.results)) {
             console.warn('Everything service test failed: Invalid JSON response format.');
            return false;
        }
        return true; // 服务正常
    } catch (error) {
        console.error('Error testing Everything service:', error);
        return false; // 服务不可用
    }
};

/**
 * @typedef {object} EverythingFileResult
 * @property {string} id - 生成的唯一 ID (local_entry + path)。
 * @property {string} type - 固定为 'local'。
 * @property {string} path - 完整文件路径 (使用 / 分隔符)。
 * @property {number} mtimeMs - 修改时间的毫秒时间戳。
 * @property {number} index - 在结果数组中的索引。
 * // 其他从 Everything 返回的原始属性，如 name, size, date_created 等
 */

/**
 * @typedef {object} EverythingSearchResult
 * @property {boolean} enabled - 搜索是否成功执行并返回结果。
 * @property {EverythingFileResult[] | null} fileList - 搜索到的文件列表，如果失败则为 null。
 */

/**
 * 通过 Everything HTTP 服务执行搜索并处理结果。
 * @async
 * @param {string} searchValue - 搜索查询字符串。
 * @param {number|string} port - Everything 服务的端口号。
 * @param {object} [options={}] - 包含 host 和其他 EverythingSearchOptions 的选项对象。
 * @param {string} [options.host='localhost'] - Everything 服务的主机名或 IP 地址。
 * @returns {Promise<EverythingSearchResult>} 返回搜索结果对象。
 */
export const useEverything_search = async (searchValue, port, options = {}) => {
    const { host = 'localhost', noError = false, ...searchOptions } = options;

    // 原代码逻辑：如果搜索值为空或太短，并且没有指定 count，则直接返回失败
    // 但如果指定了 count (例如获取全部文件)，即使 searchValue 为空也应该执行？
    // 暂时保留原逻辑，但可能需要根据实际场景调整
    // TODO: Review the logic for handling empty searchValue when count is specified.
    if ((!searchValue || searchValue.length < 2) && !searchOptions.count) {
        if (!noError) {
          console.log("Search value is too short or empty, and no specific count provided.");
        }
        return { enabled: false, fileList: null };
    }

    const everythingURL = formatEverythingSearchUrl(host, port, {
        search: searchValue,
        showPathColumn: true, // 确保获取必要信息
        showSizeColumn: true,
        showDateModifiedColumn: true,
        showDateCreatedColumn: true,
        ...searchOptions // 应用其他传入的选项，如 count
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
                .filter(item => item.type === 'file') // 只保留文件类型
                .map((item, index) => ({
                    ...item, // 保留原始字段
                    id: `local_entry_${item.path.replace(/\\/g, '/')}_${item.name}`.replace(/\s/g, '_'), // 更可靠的ID?
                    type: "local", // 固定类型
                    path: (item.path + '/' + item.name).replace(/\\/g, '/'), // 组合完整路径并统一分隔符
                    mtimeMs: Number(item.date_modified) || 0, // 转换时间戳，提供默认值
                    ctimeMs: Number(item.date_created) || 0, // 转换时间戳，提供默认值
                    size: Number(item.size) || 0, // 转换大小，提供默认值
                    index // 保留原始索引
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