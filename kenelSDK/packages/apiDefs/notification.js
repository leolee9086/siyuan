export const notificationApiDefs = [
  {
    method: "POST",
    endpoint: "/api/notification/pushErrMsg",
    en: "pushErrMsg",
    zh_cn: "推送错误消息",
    description: "向前端推送一条错误类型的消息通知，通常用于显示操作失败或异常情况。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      msg: z.string().describe("必需。要推送的错误消息内容。"),
      timeout: z.number().int().positive().optional().default(7000).describe("可选。消息通知在前端显示的持续时间，单位毫秒。默认为 7000ms。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        id: z.string().describe("推送的消息的唯一标识符。")
      }).describe("包含消息ID的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/notification/pushMsg",
    en: "pushMsg",
    zh_cn: "推送普通消息",
    description: "向前端推送一条普通类型的消息通知，通常用于显示操作成功或提示信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      msg: z.string().min(1, "消息内容不能为空").describe("必需。要推送的普通消息内容。"),
      timeout: z.number().int().positive().optional().default(7000).describe("可选。消息通知在前端显示的持续时间，单位毫秒。默认为 7000ms。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串。如果 msg 为空，则 Code 为 -1，Msg 为 'msg can\'t be empty'。"),
      Data: z.object({
        id: z.string().describe("推送的消息的唯一标识符。")
      }).nullable().describe("成功时包含消息ID的对象，如果请求的 msg 为空则为 null。")
    })
  }
];
