export const storageApiDefs = [
  {
    method: "POST",
    endpoint: "/api/storage/getCriteria",
    en: "getCriteria",
    zh_cn: "获取所有已保存的搜索标准",
    description: "获取所有用户已保存的搜索标准（过滤条件）列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.array(z.object({
        name: z.string().describe("搜索标准的唯一名称。"),
        id: z.string().optional().describe("搜索标准的ID。"),
        box: z.string().optional().describe("笔记本 ID。"),
        type: z.string().optional().describe("类型，例如 'doc', 'asset' 等。"),
        query: z.string().optional().describe("搜索关键词或 SQL 查询语句。"),
        sort: z.number().optional().describe("排序方式。"),
        group: z.number().optional().describe("分组方式。"),
        types: z.any().optional().describe("类型筛选条件，具体结构未知。"),
        customSort: z.array(z.any()).optional().describe("自定义排序规则，具体结构未知。"),
        filter: z.number().optional().describe("过滤条件。"),
        docIDs: z.array(z.string()).optional().describe("文档 ID 列表。"),
        blockIDs: z.array(z.string()).optional().describe("块 ID 列表。"),
        tagIDs: z.array(z.string()).optional().describe("标签 ID 列表。"),
        attrIDs: z.array(z.string()).optional().describe("属性 ID 列表。"),
        refs: z.array(z.string()).optional().describe("引用 ID 列表。"),
        parentID: z.string().optional().describe("父块 ID。"),
        rootID: z.string().optional().describe("根块 ID。"),
        kwd: z.string().optional().describe("关键词。")
      })).describe("已保存的搜索标准列表。每个元素代表一个搜索标准，具体字段请参考思源笔记内核 model.Criterion 结构。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/storage/getLocalStorage",
    en: "getLocalStorage",
    zh_cn: "获取所有本地存储项",
    description: "获取浏览器 LocalStorage 中的所有键值对。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.record(z.any()).describe("包含 LocalStorage 所有键值对的对象。值的类型可能多样，取决于存储时的数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/storage/getRecentDocs",
    en: "getRecentDocs",
    zh_cn: "获取最近打开的文档列表",
    description: "获取用户最近打开过的文档列表。这些文档按最近打开时间排序。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.array(z.object({
        id: z.string().describe("文档的 ID。"),
        notebookID: z.string().describe("文档所属笔记本的 ID。"),
        name: z.string().describe("文档的名称。"),
        icon: z.string().describe("文档的图标，如果设置了的话。"),
        hPath: z.string().describe("文档的人类可读路径。"),
        path: z.string().describe("文档的存储路径。"),
        sort: z.number().describe("文档的排序值。"),
        type: z.string().describe("文档的类型，例如 'd' 表示文档。"),
        subFileCount: z.number().describe("子文件数量 (通常用于笔记本或文件夹)。"),
        updated: z.string().datetime().describe("文档的最后更新时间 (ISO 8601 格式)。")
      })).describe("最近打开的文档列表。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/storage/removeCriterion",
    en: "removeCriterion",
    zh_cn: "移除搜索标准",
    description: "根据名称移除一个已保存的搜索标准（过滤条件）。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      name: z.string().describe("要移除的搜索标准的名称。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/storage/removeLocalStorageVals",
    en: "removeLocalStorageVals",
    description: "根据提供的键名列表，批量移除浏览器 LocalStorage 中的项目。同时会广播事件通知其他客户端同步移除。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zh_cn: "批量移除本地存储项",
    zodRequestSchema: (z) => ({
      keys: z.array(z.string()).describe("要移除的 LocalStorage 项目的键名数组。"),
      app: z.string().describe("发起操作的 App ID，用于事件广播。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/storage/setCriterion",
    en: "setCriterion",
    zh_cn: "保存搜索标准",
    description: "保存或更新一个搜索标准（过滤条件）。搜索标准可用于后续的文档或内容搜索。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      criterion: z.object({
        name: z.string().describe("搜索标准的唯一名称。"),
        id: z.string().optional().describe("搜索标准的ID，通常在更新时提供。"),
        box: z.string().optional().describe("笔记本 ID。"),
        type: z.string().optional().describe("类型，例如 'doc', 'asset' 等。"),
        query: z.string().optional().describe("搜索关键词或 SQL 查询语句。"),
        sort: z.number().optional().describe("排序方式。"),
        group: z.number().optional().describe("分组方式。"),
        types: z.any().optional().describe("类型筛选条件，具体结构未知，可能是一个对象或数组。"),
        customSort: z.array(z.any()).optional().describe("自定义排序规则，具体结构未知。"),
        filter: z.number().optional().describe("过滤条件。"),
        docIDs: z.array(z.string()).optional().describe("文档 ID 列表。"),
        blockIDs: z.array(z.string()).optional().describe("块 ID 列表。"),
        tagIDs: z.array(z.string()).optional().describe("标签 ID 列表。"),
        attrIDs: z.array(z.string()).optional().describe("属性 ID 列表。"),
        refs: z.array(z.string()).optional().describe("引用 ID 列表。"),
        parentID: z.string().optional().describe("父块 ID。"),
        rootID: z.string().optional().describe("根块 ID。"),
        kwd: z.string().optional().describe("关键词。"),
      }).describe("要保存或更新的搜索标准对象。具体字段请参考思源笔记内核 model.Criterion 结构。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/storage/setLocalStorage",
    en: "setLocalStorage",
    zh_cn: "整体设置本地存储",
    description: "使用一个完整的对象来覆盖整个浏览器 LocalStorage 的内容。通常用于导入或恢复 LocalStorage 数据。同时会广播事件通知其他客户端同步设置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      val: z.record(z.any()).describe("一个对象，其键值对将完全替换现有的 LocalStorage 内容。"),
      app: z.string().describe("发起操作的 App ID，用于事件广播。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/storage/setLocalStorageVal",
    en: "setLocalStorageVal",
    zh_cn: "设置单个本地存储项",
    description: "设置浏览器 LocalStorage 中的单个键值对。同时会广播事件通知其他客户端同步设置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      key: z.string().describe("要设置的 LocalStorage 项目的键名。"),
      val: z.any().describe("要设置的 LocalStorage 项目的值，可以是任意类型，但最终会序列化为字符串存储。"),
      app: z.string().describe("发起操作的 App ID，用于事件广播。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  }
];
