export const snippetApiDefs = [
  {
    method: "POST",
    endpoint: "/api/snippet/getSnippet",
    en: "getSnippet",
    zh_cn: "获取代码片段",
    description: "获取已保存的代码片段列表。可以根据类型（js/css/all）、启用状态（0-禁用, 1-启用, 2-全部）和关键字进行过滤。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      type: z.enum(["js", "css", "all"]).describe("要获取的代码片段类型：'js', 'css', 或 'all'。"),
      enabled: z.number().int().min(0).max(2).describe("根据启用状态进行过滤：0-仅禁用, 1-仅启用, 2-全部。"),
      keyword: z.string().optional().describe("可选的搜索关键字，用于在代码片段的名称和内容中查找（不区分大小写）。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        snippets: z.array(z.object({
          id: z.string().describe("代码片段的唯一ID。"),
          name: z.string().describe("代码片段的名称。"),
          type: z.enum(["js", "css"]).describe("代码片段的类型：'js' 或 'css'。"),
          enabled: z.boolean().describe("代码片段是否启用。"),
          content: z.string().describe("代码片段的实际内容。")
        })).describe("符合过滤条件的代码片段对象数组。")
      }).nullable().describe("包含代码片段列表的对象，获取失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/snippet/setSnippet",
    en: "setSnippet",
    zh_cn: "设置代码片段列表",
    description: "设置全新的代码片段列表。这是一个全量替换操作，提供的 snippets 数组将完全覆盖当前所有的代码片段。如果只想修改或添加单个片段，需要先获取所有现有片段，在本地修改/添加后，将修改后的完整列表通过此API发送。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      snippets: z.array(z.object({
        id: z.string().describe("片段的唯一ID。对于新片段或希望系统生成ID的片段，可设置为空字符串。"),
        name: z.string().describe("代码片段的名称。"),
        type: z.enum(["js", "css"]).describe("代码片段的类型，必须是 'js' 或 'css'。"),
        content: z.string().describe("代码片段的实际内容（JavaScript 或 CSS 代码）。"),
        enabled: z.boolean().describe("代码片段是否启用。")
      })).describe("包含一个或多个代码片段对象的数组。此数组将成为操作完成后系统中全新的、完整的代码片段列表。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据，直接修改配置。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/snippet/removeSnippet",
    en: "removeSnippet",
    zh_cn: "移除代码片段",
    description: "根据ID移除指定的代码片段。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要移除的代码片段的唯一ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        id: z.string().describe("被移除代码片段的唯一ID。"),
        name: z.string().describe("被移除代码片段的名称。"),
        type: z.enum(["js", "css"]).describe("被移除代码片段的类型。"),
        enabled: z.boolean().describe("被移除代码片段的启用状态。"),
        content: z.string().describe("被移除代码片段的内容。")
      }).nullable().describe("包含被移除代码片段信息的对象，操作失败或未找到时可能为 null 或不返回 Data。")
    })
  }
];
