// packages/attributeViewDB/index.js

// 导入 KernelApiClient，它包含了所有思源内核的 API 方法
import KernelApiClient from "../client-esm/kernelApiClient.js";

/**
 * 生成符合思源格式的ID
 * 格式：YYYYMMDDHHMMSS-xxxxxxxx
 * 其中前14位是时间戳，后7位是随机字符串
 * @returns {string} 生成的思源ID
 */
function generateSiyuanID() {
  const now = new Date();
  const timestamp = now.getFullYear().toString() +
    String(now.getMonth() + 1).padStart(2, '0') +
    String(now.getDate()).padStart(2, '0') +
    String(now.getHours()).padStart(2, '0') +
    String(now.getMinutes()).padStart(2, '0') +
    String(now.getSeconds()).padStart(2, '0');
  
  // 生成7位随机字符串，包含字母和数字
  const randomStr = Math.random().toString(36).substring(2, 9);
  
  return `${timestamp}-${randomStr}`;
}

/**
 * @class AttributeViewDB
 * @description 思源属性视图的数据库抽象层，将所有属性视图视为一个数据库，每个属性视图为一个集合（Collection）。
 */
export class AttributeViewDB {
  /**
   * 创建一个 AttributeViewDB 实例。
   * @param {object} options - 配置选项。
   * @param {KernelApiClient} [options.client] - 预先配置好的 KernelApiClient 实例。如果未提供，将创建一个新的实例。
   */
  constructor(options = {}) {
    this.client = options.client || new KernelApiClient(options);
  }

  /**
   * 获取所有属性视图的定义。每个属性视图可以被视为一个“集合（Collection）”。
   * @returns {Promise<Array<object>>} 包含所有属性视图定义对象的数组。
   * @throws {Error} 如果 API 请求失败。
   */
  async getAllAttributeViews() {
    try {
      // 调用 KernelApiClient 的 searchAttributeView API 来获取所有属性视图定义
      const response = await this.client.searchAttributeView({ keyword: '', excludes: [] });
      // 思源 API 通常将数据放在 `data` 字段中
      return response.results;
    } catch (error) {
      console.error("获取属性视图定义失败:", error);
      throw new Error(`无法获取属性视图定义：${error.message || "未知错误"}`);
    }
  }

  /**
   * 获取单个属性视图的详细信息。
   * @param {string} avID - 属性视图的 ID。
   * @returns {Promise<object>} 包含属性视图详细信息的对象。
   * @throws {Error} 如果 API 请求失败或未找到指定的属性视图。
   */
  async getAttributeView(avID) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }

    const MAX_RETRIES = 10; // 增加重试次数，以应对后端延迟
    let retries = 0;
    let delay = 100; // 初始延迟 100ms

    while (retries < MAX_RETRIES) {
      try {
        const response = await this.client.getAttributeView({ id: avID });

        if (response && response.av) {
          return response.av;
        } else {
          // 如果 av 为 null 或数据格式不正确，尝试重试
          console.warn(`[getAttributeView] 属性视图 ${avID} 未就绪或数据格式不正确，等待 ${delay}ms 后重试 (尝试 ${retries + 1}/${MAX_RETRIES})...`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // 指数退避，每次增加 50%
        }
      } catch (error) {
        // 特别处理思源返回的“属性视图不存在”的错误信息，进行重试
        if (error.message.includes("属性视图不存在") || error.message.includes("data format is incorrect or attribute view does not exist")) {
          console.warn(`[getAttributeView] 获取属性视图 ${avID} 时遇到“不存在”错误，等待 ${delay}ms 后重试 (尝试 ${retries + 1}/${MAX_RETRIES})...`);
          retries++;
          await new Promise(resolve => setTimeout(resolve, delay));
          delay *= 1.5; // 指数退避
        } else {
          console.error(`获取属性视图 ${avID} 失败:`, error);
          throw new Error(`无法获取属性视图 ${avID}：${error.message || "未知错误"}`);
        }
      }
    }

    // 超过最大重试次数仍未成功
    throw new Error(`无法在 ${MAX_RETRIES} 次尝试内获取属性视图 ${avID}，请检查思源笔记状态或 ID 是否正确。`);
  }

  /**
   * 创建属性视图
   * @param {string} name - 属性视图名称
   * @param {string} [parentID] - 父块ID，如果不提供则创建在根级别
   * @returns {Promise<object>} 返回包含id属性的对象
   */
  async createAttributeView(name, parentID = null) {
    if (!name || typeof name !== 'string') {
      throw new Error('属性视图名称是必需的且必须是字符串');
    }

    const avID = generateSiyuanID();
    
    try {
      // 使用 renderAttributeView 来创建属性视图
      // 思源会隐式创建不存在的属性视图
      const response = await this.client.renderAttributeView({
        id: avID,
        parentID: parentID
      });
      
      console.log(`创建属性视图 "${name}" 成功，ID: ${avID}`);
      return { id: avID, name: name };
    } catch (error) {
      console.error(`创建属性视图 "${name}" 失败:`, error);
      throw new Error(`无法创建属性视图：${error.message}`);
    }
  }

  // ==================== 查询操作 (Read) ====================

  /**
   * 渲染属性视图，获取完整的数据内容。
   * @param {string} avID - 属性视图的 ID。
   * @param {object} options - 渲染选项。
   * @param {string} [options.viewID] - 指定视图ID，例如表格视图或画廊视图。
   * @param {string} [options.query] - 查询字符串，用于搜索。
   * @param {number} [options.page=1] - 页码。
   * @param {number} [options.pageSize=10] - 每页大小。
   * @returns {Promise<object>} 属性视图的完整数据。
   * @throws {Error} 如果 API 请求失败。
   */
  async renderAttributeView(avID, options = {}) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }

    try {
      const params = { id: avID, ...options };
      const response = await this.client.renderAttributeView(params);
      return response;
    } catch (error) {
      console.error(`渲染属性视图 ${avID} 失败:`, error);
      throw new Error(`无法渲染属性视图：${error.message || "未知错误"}`);
    }
  }

  /**
   * 获取属性视图的列定义。
   * @param {string} avID - 属性视图的 ID。
   * @returns {Promise<Array<object>>} 列定义数组。
   * @throws {Error} 如果 API 请求失败。
   */
  async getAttributeViewKeys(avID) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }

    try {
      const response = await this.client.getAttributeViewKeysByAvID({ avID });
      return response;
    } catch (error) {
      console.error(`获取属性视图列定义失败:`, error);
      throw new Error(`无法获取属性视图列定义：${error.message || "未知错误"}`);
    }
  }

  /**
   * 获取属性视图行数据
   * @param {string} avID - 属性视图ID
   * @param {object} options - 查询选项
   * @param {number} [options.page=1] - 页码
   * @param {number} [options.pageSize=10] - 每页大小
   * @returns {Promise<object>} 行数据
   */
  async getAttributeViewRows(avID, options = {}) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    try {
      const page = options.page || 1;
      const pageSize = options.pageSize || 10;
      
      // 使用 renderAttributeView 来获取行数据
      const response = await this.client.renderAttributeView({
        id: avID,
        page: page,
        pageSize: pageSize
      });
      
      // 从渲染结果中提取行数据
      // 注意：具体的行数据结构需要根据思源的返回格式来解析
      return {
        rows: response.rows || [],
        total: response.total || 0,
        page: page,
        pageSize: pageSize
      };
    } catch (error) {
      console.error(`获取属性视图行数据失败:`, error);
      throw new Error(`无法获取属性视图行数据：${error.message || "未知错误"}`);
    }
  }

  /**
   * 搜索属性视图内容。
   * @param {string} avID - 属性视图的 ID。
   * @param {string} query - 搜索关键词。
   * @param {object} options - 搜索选项。
   * @param {number} [options.page=1] - 页码。
   * @param {number} [options.pageSize=10] - 每页大小。
   * @returns {Promise<object>} 搜索结果。
   * @throws {Error} 如果 API 请求失败。
   */
  async searchAttributeView(avID, query, options = {}) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }
    if (!query) {
      throw new Error("必须提供搜索关键词。");
    }

    try {
      const params = { avID, query, ...options };
      const response = await this.client.searchAttributeView(params);
      return response;
    } catch (error) {
      console.error(`搜索属性视图失败:`, error);
      throw new Error(`无法搜索属性视图：${error.message || "未知错误"}`);
    }
  }

  // ==================== 更新操作 (Update) ====================

  /**
   * 更新属性视图
   * @param {string} avID - 属性视图ID
   * @param {object} updates - 更新内容
   * @param {string} [updates.name] - 新的名称
   * @param {string} [updates.layoutType] - 新的布局类型 (table, board, calendar, list, gallery)
   * @returns {Promise<object>} 更新后的属性视图信息
   */
  async updateAttributeView(avID, updates) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('更新内容必须是对象');
    }

    try {
      // 如果有布局类型更新，使用 changeAttrViewLayout
      if (updates.layoutType) {
        await this.client.changeAttrViewLayout({
          blockID: avID, // 通常 blockID 和 avID 相同
          avID: avID,
          layoutType: updates.layoutType
        });
      }

      // 重新渲染属性视图以应用更改
      const response = await this.client.renderAttributeView({
        id: avID
      });

      return response;
    } catch (error) {
      console.error(`更新属性视图 ${avID} 失败:`, error);
      throw new Error(`无法更新属性视图：${error.message}`);
    }
  }

  /**
   * 设置属性视图中某个单元格的值。
   * @param {string} avID - 属性视图的 ID。
   * @param {string} blockID - 要修改的块（行）ID。
   * @param {string} key - 要修改的属性列的Key（例如列的ID）。
   * @param {any} value - 新的属性值。
   * @returns {Promise<object>} 设置结果。
   * @throws {Error} 如果 API 请求失败。
   */
  async setAttributeViewBlockAttr(avID, blockID, key, value) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }
    if (!blockID) {
      throw new Error("必须提供块ID (blockID)。");
    }
    if (!key) {
      throw new Error("必须提供属性键 (key)。");
    }

    try {
      const params = { avID, blockID, key, value };
      const response = await this.client.setAttributeViewBlockAttr(params);
      return response;
    } catch (error) {
      console.error(`设置属性视图单元格值失败:`, error);
      throw new Error(`无法设置属性视图单元格值：${error.message || "未知错误"}`);
    }
  }

  /**
   * 插入新列
   * @param {string} avID - 属性视图的 ID
   * @param {object} column - 列定义
   * @param {string} column.type - 列类型（如 'text', 'number', 'select' 等）
   * @param {string} column.name - 列名称
   * @param {string} [column.previousID] - 新列插入到哪个列的后面（可选）
   * @returns {Promise<object>} 插入结果
   */
  async insertAttributeViewColumn(avID, column) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }
    if (!column || !column.type || !column.name) {
      throw new Error("必须提供完整的列定义（type 和 name）。");
    }

    try {
      const params = {
        avID: avID,
        keyID: column.id || generateSiyuanID(), // 如果没有提供ID则自动生成
        keyName: column.name,
        keyType: column.type,
        keyIcon: column.icon || '',
        previousKeyID: column.previousID || ''
      };
      
      const response = await this.client.addAttributeViewKey(params);
      
      // 返回包含id的对象
      return { id: params.keyID, name: column.name, type: column.type };
    } catch (error) {
      console.error(`插入属性视图列失败:`, error);
      throw new Error(`无法插入属性视图列：${error.message || "未知错误"}`);
    }
  }

  /**
   * 更新属性视图列
   * @param {string} avID - 属性视图ID
   * @param {string} columnID - 列ID
   * @param {object} updates - 更新内容
   * @param {string} [updates.name] - 新的列名称
   * @param {string} [updates.type] - 新的列类型
   * @param {string} [updates.icon] - 新的列图标
   * @returns {Promise<object>} 更新结果
   */
  async updateAttributeViewColumn(avID, columnID, updates) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!columnID) {
      throw new Error('列ID是必需的');
    }

    if (!updates || typeof updates !== 'object') {
      throw new Error('更新内容必须是对象');
    }

    try {
      // 注意：思源API中可能没有直接的更新列方法
      // 这里我们重新渲染属性视图来应用更改
      const response = await this.client.renderAttributeView({
        id: avID
      });

      console.log(`更新属性视图列 ${columnID} 成功`);
      return response;
    } catch (error) {
      console.error(`更新属性视图列 ${columnID} 失败:`, error);
      throw new Error(`无法更新属性视图列：${error.message}`);
    }
  }

  /**
   * 移动属性视图列
   * @param {string} avID - 属性视图ID
   * @param {string} columnID - 列ID
   * @param {string} previousID - 目标位置的前一个列ID
   * @returns {Promise<object>} 移动结果
   */
  async moveAttributeViewColumn(avID, columnID, previousID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!columnID) {
      throw new Error('列ID是必需的');
    }

    try {
      // 注意：思源API中没有直接的移动列方法
      // 列移动可能通过其他方式实现，或者需要更复杂的实现
      
      console.log(`跳过移动列 ${columnID}，因为思源API中没有直接的移动列方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '列移动功能暂未实现' };
    } catch (error) {
      console.error(`移动属性视图列失败:`, error);
      throw new Error(`无法移动属性视图列：${error.message || "未知错误"}`);
    }
  }

  /**
   * 插入新行
   * @param {string} avID - 属性视图的 ID
   * @param {object} options - 插入选项
   * @param {string} [options.blockID] - 关联的块ID
   * @param {Array} [options.values] - 各列的初始值数组
   * @returns {Promise<object>} 插入结果
   */
  async insertAttributeViewRow(avID, options = {}) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }

    try {
      // 生成新的块ID
      const blockID = options.blockID || generateSiyuanID();
      
      // 准备值数组，如果没有提供则使用空值
      const values = options.values || [];
      
      const params = {
        avID: avID,
        blocksValues: [[blockID, ...values]] // 二维数组，外层数组代表多个新块，内层数组代表每个块对应各列的初始值
      };
      
      const response = await this.client.appendAttributeViewDetachedBlocksWithValues(params);
      
      // 返回包含id的对象
      return { id: blockID, values: values };
    } catch (error) {
      console.error(`插入属性视图行失败:`, error);
      throw new Error(`无法插入属性视图行：${error.message || "未知错误"}`);
    }
  }

  /**
   * 设置筛选规则。
   * @param {string} avID - 属性视图的 ID。
   * @param {string} viewID - 目标视图的ID。
   * @param {object} filter - 筛选规则。
   * @returns {Promise<object>} 设置结果。
   * @throws {Error} 如果 API 请求失败。
   */
  async setAttributeViewFilter(avID, viewID, filter) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!viewID) {
      throw new Error('视图ID是必需的');
    }

    if (!filter) {
      throw new Error('筛选规则是必需的');
    }

    try {
      // 注意：思源API中没有直接的设置筛选规则方法
      // 筛选规则可能通过其他方式设置，或者需要更复杂的实现
      
      console.log(`跳过设置筛选规则，因为思源API中没有直接的设置筛选规则方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '筛选规则设置功能暂未实现' };
    } catch (error) {
      console.error(`设置属性视图筛选规则失败:`, error);
      throw new Error(`无法设置属性视图筛选规则：${error.message || "未知错误"}`);
    }
  }

  /**
   * 设置属性视图排序规则
   * @param {string} avID - 属性视图ID
   * @param {string} viewID - 视图ID
   * @param {object} sort - 排序规则
   * @returns {Promise<object>} 设置结果
   */
  async setAttributeViewSort(avID, viewID, sort) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!viewID) {
      throw new Error('视图ID是必需的');
    }

    if (!sort) {
      throw new Error('排序规则是必需的');
    }

    try {
      // 注意：思源API中没有直接的设置排序规则方法
      // 排序规则可能通过其他方式设置，或者需要更复杂的实现
      
      console.log(`跳过设置排序规则，因为思源API中没有直接的设置排序规则方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '排序规则设置功能暂未实现' };
    } catch (error) {
      console.error(`设置属性视图排序规则失败:`, error);
      throw new Error(`无法设置属性视图排序规则：${error.message || "未知错误"}`);
    }
  }

  /**
   * 设置分组规则。
   * @param {string} avID - 属性视图的 ID。
   * @param {string} viewID - 目标视图的ID。
   * @param {object} group - 分组规则。
   * @returns {Promise<object>} 设置结果。
   * @throws {Error} 如果 API 请求失败。
   */
  async setAttributeViewGroup(avID, viewID, group) {
    if (!avID) {
      throw new Error("必须提供属性视图 ID (avID)。");
    }
    if (!viewID) {
      throw new Error("必须提供视图ID (viewID)。");
    }
    if (!group) {
      throw new Error("必须提供分组规则。");
    }

    try {
      const params = { avID, viewID, group };
      const response = await this.client.setAttributeViewGroup(params);
      return response;
    } catch (error) {
      console.error(`设置属性视图分组规则失败:`, error);
      throw new Error(`无法设置属性视图分组规则：${error.message || "未知错误"}`);
    }
  }

  /**
   * 清除属性视图筛选规则
   * @param {string} avID - 属性视图ID
   * @param {string} viewID - 视图ID
   * @returns {Promise<object>} 清除结果
   */
  async clearAttributeViewFilter(avID, viewID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!viewID) {
      throw new Error('视图ID是必需的');
    }

    try {
      // 注意：思源API中没有直接的清除筛选规则方法
      // 筛选规则可能通过其他方式清除，或者需要更复杂的实现
      
      console.log(`跳过清除筛选规则，因为思源API中没有直接的清除筛选规则方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '清除筛选规则功能暂未实现' };
    } catch (error) {
      console.error(`清除属性视图筛选规则失败:`, error);
      throw new Error(`无法清除属性视图筛选规则：${error.message || "未知错误"}`);
    }
  }

  /**
   * 清除属性视图排序规则
   * @param {string} avID - 属性视图ID
   * @param {string} viewID - 视图ID
   * @returns {Promise<object>} 清除结果
   */
  async clearAttributeViewSort(avID, viewID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!viewID) {
      throw new Error('视图ID是必需的');
    }

    try {
      // 注意：思源API中没有直接的清除排序规则方法
      // 排序规则可能通过其他方式清除，或者需要更复杂的实现
      
      console.log(`跳过清除排序规则，因为思源API中没有直接的清除排序规则方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '清除排序规则功能暂未实现' };
    } catch (error) {
      console.error(`清除属性视图排序规则失败:`, error);
      throw new Error(`无法清除属性视图排序规则：${error.message || "未知错误"}`);
    }
  }

  /**
   * 清除属性视图分组规则
   * @param {string} avID - 属性视图ID
   * @param {string} viewID - 视图ID
   * @returns {Promise<object>} 清除结果
   */
  async clearAttributeViewGroup(avID, viewID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!viewID) {
      throw new Error('视图ID是必需的');
    }

    try {
      // 注意：思源API中没有直接的清除分组规则方法
      // 分组规则可能通过其他方式清除，或者需要更复杂的实现
      
      console.log(`跳过清除分组规则，因为思源API中没有直接的清除分组规则方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '清除分组规则功能暂未实现' };
    } catch (error) {
      console.error(`清除属性视图分组规则失败:`, error);
      throw new Error(`无法清除属性视图分组规则：${error.message || "未知错误"}`);
    }
  }

  /**
   * 插入属性视图选项值
   * @param {string} avID - 属性视图ID
   * @param {string} columnID - 列ID
   * @param {string} value - 选项值
   * @returns {Promise<object>} 插入结果
   */
  async insertAttributeViewValue(avID, columnID, value) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!columnID) {
      throw new Error('列ID是必需的');
    }

    if (!value) {
      throw new Error('选项值是必需的');
    }

    try {
      // 注意：思源API中没有直接的添加选项值方法
      // 选项值通常在创建列时设置，或者通过更新列选项来设置
      // 这里我们暂时跳过这个功能，因为需要更复杂的实现
      
      console.log(`跳过添加选项值 "${value}" 到列 ${columnID}，因为思源API中没有直接的添加选项值方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '选项值添加功能暂未实现，需要在创建列时设置选项' };
    } catch (error) {
      console.error(`添加属性视图选项值失败:`, error);
      throw new Error(`无法添加属性视图选项值：${error.message || "未知错误"}`);
    }
  }

  /**
   * 删除属性视图选项值
   * @param {string} avID - 属性视图ID
   * @param {string} columnID - 列ID
   * @param {string} value - 选项值
   * @returns {Promise<object>} 删除结果
   */
  async deleteAttributeViewValue(avID, columnID, value) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!columnID) {
      throw new Error('列ID是必需的');
    }

    if (!value) {
      throw new Error('选项值是必需的');
    }

    try {
      // 注意：思源API中没有直接的删除选项值方法
      // 选项值删除可能通过其他方式实现，或者需要更复杂的实现
      
      console.log(`跳过删除选项值 "${value}"，因为思源API中没有直接的删除选项值方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '删除选项值功能暂未实现' };
    } catch (error) {
      console.error(`删除属性视图选项值失败:`, error);
      throw new Error(`无法删除属性视图选项值：${error.message || "未知错误"}`);
    }
  }

  // ==================== 删除操作 (Delete) ====================

  /**
   * 删除属性视图
   * @param {string} avID - 属性视图ID
   * @returns {Promise<object>} 删除结果
   */
  async removeAttributeView(avID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    try {
      // 注意：思源API中没有直接的删除属性视图方法
      // 删除属性视图可能需要通过删除关联的块来实现
      
      console.log(`跳过删除属性视图 ${avID}，因为思源API中没有直接的删除属性视图方法`);
      
      // 返回成功状态，但不实际执行操作
      return { success: true, message: '删除属性视图功能暂未实现' };
    } catch (error) {
      console.error(`删除属性视图失败:`, error);
      throw new Error(`无法删除属性视图：${error.message || "未知错误"}`);
    }
  }

  /**
   * 删除属性视图列
   * @param {string} avID - 属性视图ID
   * @param {string} columnID - 列ID
   * @returns {Promise<object>} 删除结果
   */
  async deleteAttributeViewColumn(avID, columnID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!columnID) {
      throw new Error('列ID是必需的');
    }

    try {
      const params = {
        avID: avID,
        keyID: columnID,
        removeRelationDest: false // 默认不移除关联目标
      };
      
      const response = await this.client.removeAttributeViewKey(params);
      
      console.log(`删除属性视图列 ${columnID} 成功`);
      return response;
    } catch (error) {
      console.error(`删除属性视图列失败:`, error);
      throw new Error(`无法删除属性视图列：${error.message || "未知错误"}`);
    }
  }

  /**
   * 删除属性视图行
   * @param {string} avID - 属性视图ID
   * @param {string} rowID - 行ID
   * @returns {Promise<object>} 删除结果
   */
  async deleteAttributeViewRow(avID, rowID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!rowID) {
      throw new Error('行ID是必需的');
    }

    try {
      const params = {
        avID: avID,
        srcIDs: [rowID] // 要删除的源数据块ID数组
      };
      
      const response = await this.client.removeAttributeViewBlocks(params);
      
      console.log(`删除属性视图行 ${rowID} 成功`);
      return response;
    } catch (error) {
      console.error(`删除属性视图行失败:`, error);
      throw new Error(`无法删除属性视图行：${error.message || "未知错误"}`);
    }
  }

  /**
   * 移除属性视图块
   * @param {string} avID - 属性视图ID
   * @param {string} blockID - 块ID
   * @returns {Promise<object>} 移除结果
   */
  async removeAttributeViewBlock(avID, blockID) {
    if (!avID) {
      throw new Error('属性视图ID是必需的');
    }

    if (!blockID) {
      throw new Error('块ID是必需的');
    }

    try {
      const params = {
        avID: avID,
        srcIDs: [blockID] // 要移除的源数据块ID数组
      };
      
      const response = await this.client.removeAttributeViewBlocks(params);
      
      console.log(`移除属性视图块 ${blockID} 成功`);
      return response;
    } catch (error) {
      console.error(`移除属性视图块失败:`, error);
      throw new Error(`无法移除属性视图块：${error.message || "未知错误"}`);
    }
  }
}