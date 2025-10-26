export const inboxApiDefs = [
  {
    method: "POST",
    endpoint: "/api/inbox/getShorthand",
    en: "getShorthand",
    zh_cn: "获取单个速记",
    description: "根据ID获取单个云端速记条目的详细内容。速记内容会从 Markdown 转换为 HTML。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要获取的速记的唯一标识符 (通常为时间戳字符串)"),
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        id: z.string().optional().describe("速记的唯一标识符 (通常为时间戳字符串)"), // oId 在 getShorthands 中，这里直接是 id
        shorthandContent: z.string().describe("速记内容 (经过 Lute 引擎处理后的 HTML 格式)"),
        shorthandMd: z.string().describe("速记内容的原始 Markdown 格式"),
        hCreated: z.string().describe("格式化后的创建时间 (YYYY-MM-DD HH:mm)"),
        // 根据 model/cloud_service.go GetCloudShorthand 函数，其他字段直接来自云端 map[string]interface{}
        // box, hPath, created, updated 等字段可能存在但非固定，故用 catchall
      }).catchall(z.any()).describe("包含速记详细信息的对象"),
    }),
  },
  {
    method: "POST",
    endpoint: "/api/inbox/getShorthands",
    en: "getShorthands",
    zh_cn: "获取速记列表",
    description: "分页获取云端速记条目列表。速记内容会从 Markdown 转换为 HTML，描述会做简化处理。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      page: z.number().int().min(1).describe("要获取的速记列表的页码，从 1 开始"),
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        shorthands: z.array(z.object({
          oId: z.string().describe("速记的原始唯一标识符 (通常为时间戳字符串)"),
          shorthandContent: z.string().describe("速记内容 (经过 Lute 引擎处理后的 HTML 格式)"),
          shorthandMd: z.string().describe("速记内容的原始 Markdown 格式"),
          shorthandDesc: z.string().describe("速记的描述 (经过处理，例如音视频标签被替换为文字)"),
          hCreated: z.string().describe("格式化后的创建时间 (YYYY-MM-DD HH:mm)"),
          // 根据 model/cloud_service.go GetCloudShorthands 函数，其他字段直接来自云端 map[string]interface{}
        }).catchall(z.any())).describe("速记对象列表"),
        // 分页信息等其他字段可能存在于 Data 对象顶层
      }).catchall(z.any()).describe("包含速记列表及可能的分页信息的对象"),
    }),
  },
  {
    method: "POST",
    endpoint: "/api/inbox/removeShorthands",
    en: "removeShorthands",
    zh_cn: "移除速记",
    description: "根据ID列表批量移除云端速记条目。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      ids: z.array(z.string()).describe("要移除的速记的唯一标识符数组"),
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null"),
    }),
  },
];
