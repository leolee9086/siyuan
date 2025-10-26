export const miscApiDefs = [
  {
    method: "GET",
    endpoint: "/es/broadcast/subscribe",
    en: "broadcastSubscribe",
    zh_cn: "订阅广播(SSE)",
    description: "通过 Server-Sent Events (SSE) 订阅一个或多个指定广播频道的消息。连接建立后，服务器会持续推送所订阅频道的消息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      channel: z.string().describe("要订阅的一个或多个广播频道名称，多个频道用逗号分隔。此参数通过 URL Query String 传递。"),
      retry: z.number().int().positive().optional().describe("SSE 连接断开后的重试间隔时间 (毫秒)。此参数通过 URL Query String 传递。")
    }),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "GET",
    endpoint: "/ws/broadcast",
    en: "broadcast",
    zh_cn: "连接广播(WebSocket)",
    description: "通过 WebSocket 连接到指定的广播频道，用于双向实时通讯。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      channel: z.string().describe("要连接的广播频道名称。此参数通过 URL Query String 传递。")
    }),
    zodResponseSchema: (z) => ({})
  }
];
