export const formatApiDefs = [
  {
    method: "POST",
    endpoint: "/api/format/autoSpace",
    en: "autoSpace",
    zh_cn: "自动空格",
    description: "为指定块ID的内容（Markdown原文）在中文与英文、数字之间自动添加空格，以优化排版。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要处理的块 ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.null().describe("操作成功时为 null") 
    })
  },
  {
    method: "POST",
    endpoint: "/api/format/netAssets2LocalAssets",
    en: "netAssets2LocalAssets",
    zh_cn: "网络资源转本地资源",
    description: "将指定块ID内的所有外部网络资源（如图片、附件等，但不包括仅被引用的网络图片链接）下载并转存为本地资源。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要处理的块 ID，该块内的网络资源将被转存。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.null().describe("操作成功时为 null") 
    })
  },
  {
    method: "POST",
    endpoint: "/api/format/netImg2LocalAssets",
    en: "netImg2LocalAssets",
    zh_cn: "网络图片转本地资源",
    description: "将指定块ID内的网络图片（Markdown中实际嵌入的图片，非普通链接）转存为本地资源。可以指定单个图片URL进行转存，或留空以转存块内所有网络图片。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要处理的块 ID。块内的网络图片将被转存。"),
      url: z.string().url().optional().describe("可选。如果提供，则只转存此 URL 对应的网络图片。如果未提供或为空，则转存块内所有网络图片。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.null().describe("操作成功时为 null") 
    })
  }
];
