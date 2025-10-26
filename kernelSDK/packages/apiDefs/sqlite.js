export const sqliteApiDefs = [
  {
    method: "POST",
    endpoint: "/api/sqlite/flushTransaction",
    en: "flushTransaction",
    zh_cn: "刷新事务队列",
    description: "将内核中待处理的数据库事务队列立即刷新到磁盘。这通常用于确保在关键操作后数据被持久化。该接口不接收参数。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  }
];
