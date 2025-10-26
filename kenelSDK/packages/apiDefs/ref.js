export const refApiDefs = [
  {
    method: "POST",
    endpoint: "/api/ref/getBacklink",
    en: "getBacklink",
    zh_cn: "获取反向链接和提及(旧)",
    description: "获取指定块ID的反向链接和反向提及列表。此接口为旧版，建议使用 /api/ref/getBacklink2。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要查询反向链接和提及的目标块的 ID。"),
      k: z.string().describe("用于筛选反向链接结果的关键词。"),
      mk: z.string().describe("用于筛选反向提及结果的关键词。"),
      beforeLen: z.number().int().optional().default(12).describe("可选。上下文截取长度或其他用途，默认为 12。具体作用需进一步确认。"),
      containChildren: z.boolean().optional().describe("可选。是否包含子块内容进行搜索。默认为内核配置 `conf.editor.backlinkContainChildren`。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        backlinks: z.array(z.any()).describe("反向链接块的详细信息数组，具体结构复杂，参考 model.Backlink。"),
        linkRefsCount: z.number().int().describe("反向链接的总数量。"),
        backmentions: z.array(z.any()).describe("反向提及块的详细信息数组，具体结构复杂，参考 model.Backmention。"),
        mentionsCount: z.number().int().describe("反向提及的总数量。"),
        k: z.string().describe("实际用于筛选反向链接的关键词。"),
        mk: z.string().describe("实际用于筛选反向提及的关键词。"),
        box: z.string().describe("目标块所在的笔记本 ID。")
      }).nullable().describe("包含反向链接、反向提及列表及相关信息的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ref/getBacklink2",
    en: "getBacklink2",
    zh_cn: "获取反向链接和提及(新)",
    description: "获取指定块ID的反向链接和反向提及列表，支持排序。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要查询反向链接和提及的目标块的 ID。"),
      k: z.string().describe("用于筛选反向链接结果的关键词。"),
      mk: z.string().describe("用于筛选反向提及结果的关键词。"),
      sort: z.string().optional().describe("可选。反向链接的排序模式。具体值参考内核 `util.SortMode*` 常量 (例如 '0'-按更新时间倒序, '1'-按更新时间顺序, '6'-按相关度等)。默认为按更新时间倒序。"),
      mSort: z.string().optional().describe("可选。反向提及的排序模式。规则同 `sort`。"),
      containChildren: z.boolean().optional().describe("可选。是否包含子块内容进行搜索。默认为内核配置 `conf.editor.backlinkContainChildren`。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        backlinks: z.array(z.any()).describe("反向链接块的详细信息数组，具体结构复杂，参考 model.Backlink。"),
        linkRefsCount: z.number().int().describe("反向链接的总数量。"),
        backmentions: z.array(z.any()).describe("反向提及块的详细信息数组，具体结构复杂，参考 model.Backmention。"),
        mentionsCount: z.number().int().describe("反向提及的总数量。"),
        k: z.string().describe("实际用于筛选反向链接的关键词。"),
        mk: z.string().describe("实际用于筛选反向提及的关键词。"),
        box: z.string().describe("目标块所在的笔记本 ID。")
      }).nullable().describe("包含反向链接、反向提及列表及相关信息的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ref/getBacklinkDoc",
    en: "getBacklinkDoc",
    zh_cn: "获取文档内反向链接",
    description: "获取指定 定义块 在某个特定 文档树 内的反向链接列表。用于在打开一个文档时，显示该文档中有哪些块引用了当前面板的文档。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      defID: z.string().describe("必需。定义块的 ID (即被其他块引用的块)。"),
      refTreeID: z.string().describe("必需。引用块所在文档树的根块 ID (通常是当前打开的文档的根块 ID)。"),
      keyword: z.string().describe("用于筛选结果的关键词。"),
      containChildren: z.boolean().optional().describe("可选。是否包含子块内容进行搜索。默认为内核配置 `conf.editor.backlinkContainChildren`。"),
      highlight: z.boolean().optional().default(true).describe("可选。是否高亮关键词，默认为 true。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        backlinks: z.array(z.any()).describe("反向链接块的详细信息数组，具体结构复杂，参考 model.Backlink。"),
        keywords: z.array(z.string()).describe("实际用于高亮的关键词列表。")
      }).nullable().describe("包含反向链接列表和高亮关键词的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ref/getBackmentionDoc",
    en: "getBackmentionDoc",
    zh_cn: "获取文档内反向提及",
    description: "获取指定 定义块 在某个特定 文档树 内的反向提及列表 (提及了定义块的名称或别名，但未直接引用的块)。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      defID: z.string().describe("必需。定义块的 ID (即被其他块提及的块)。"),
      refTreeID: z.string().describe("必需。提及块所在文档树的根块 ID (通常是当前打开的文档的根块 ID)。"),
      keyword: z.string().describe("用于筛选结果的关键词。"),
      containChildren: z.boolean().optional().describe("可选。是否包含子块内容进行搜索。默认为内核配置 `conf.editor.backlinkContainChildren`。"),
      highlight: z.boolean().optional().default(true).describe("可选。是否高亮关键词，默认为 true。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        backmentions: z.array(z.any()).describe("反向提及块的详细信息数组，具体结构复杂，参考 model.Backmention。"),
        keywords: z.array(z.string()).describe("实际用于高亮的关键词列表。")
      }).nullable().describe("包含反向提及列表和高亮关键词的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ref/refreshBacklink",
    en: "refreshBacklink",
    zh_cn: "刷新反向链接",
    description: "手动触发指定块的反向链接和提及关系的刷新计算。通常在数据发生变更后，系统会自动更新，但此接口可用于强制刷新。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false, // 虽然可能修改数据，但router中未限制readonly
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要刷新反向链接和提及信息的目标块的 ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功时 Data 固定为 null。")
    })
  }
];
