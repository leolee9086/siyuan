export const broadcastApiDefs = [
  {
    method: "POST",
    endpoint: "/api/broadcast/getChannelInfo",
    en: "getChannelInfo",
    zh_cn: "获取频道信息",
    description: "获取指定名称的广播频道的详细信息，如订阅者数量。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      name: z.string().describe("要查询的广播频道名称")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({
        name: z.string().describe("频道名称"),
        count: z.number().int().describe("频道的总订阅者数量 (WebSocket + SSE)")
      }).describe("频道信息对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/broadcast/getChannels",
    en: "getChannels",
    zh_cn: "获取频道列表",
    description: "获取当前所有活跃的广播频道及其订阅者数量的列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(
        z.object({
          name: z.string().describe("频道名称"),
          count: z.number().int().describe("频道的总订阅者数量 (WebSocket + SSE)")
        })
      ).describe("活跃频道信息对象数组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/broadcast/postMessage",
    en: "postMessage",
    zh_cn: "发送消息到频道",
    description: "向指定的广播频道发送文本消息。也可以用于发送特定命令 (cmd)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      channel: z.string().describe("目标广播频道的名称"),
      cmd: z.string().optional().describe("可选，要执行的命令（例如 wsctrl、protyle等）"),
      data: z.string().describe("要发送的消息内容或命令参数 (JSON 字符串)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.any().nullable().describe("通常不返回具体数据，具体依赖于发送的 cmd")
    })
  },
  {
    method: "POST",
    endpoint: "/api/broadcast/publish",
    en: "broadcastPublish",
    zh_cn: "发布消息到频道",
    description: "向指定的广播频道发布消息。可以是文本消息，也可以通过上传文件发布二进制消息。请求体应为 multipart/form-data。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      channel: z.string().describe("目标广播频道的名称"),
      type: z.enum(['string', 'binary']).describe("消息类型：'string' (文本) 或 'binary' (二进制文件)"),
      data: z.string().optional().describe("当 type 为 'string' 时，此字段为消息内容"),
      file: z.any().optional().describe("当 type 为 'binary' 时，此字段为上传的文件 (应通过 FormData 传递)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码 (外层)"),
      Msg: z.string().describe("API 调用返回消息 (外层)"),
      Data: z.object({
        code: z.number().describe("操作结果返回码，0 表示成功"),
        msg: z.string().describe("操作结果消息"),
        channel: z.object({
          name: z.string().describe("目标频道名称"),
          count: z.number().int().describe("发布时频道的订阅者数量")
        }).describe("频道信息"),
        message: z.object({
          type: z.enum(['string', 'binary']).describe("发布的消息类型"),
          size: z.number().int().describe("发布的消息大小 (字节)"),
          filename: z.string().describe("发布的文件名 (如果 type 为 'binary')")
        }).describe("发布的消息详情")
      }).describe("发布操作的结果详情")
    })
  }
];
