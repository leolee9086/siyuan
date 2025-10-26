export const aiApiDefs = [
  {
    method: "POST",
    endpoint: "/api/ai/chatGPT",
    en: "chatGPT",
    zh_cn: "与 ChatGPT 对话",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    description: "与 ChatGPT 进行简单对话。",
    zodRequestSchema: (z) => ({
      msg: z.string().describe("发送给 ChatGPT 的消息内容")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().describe("ChatGPT 的回复内容")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ai/chatGPTWithAction",
    en: "chatGPTWithAction",
    zh_cn: "调用 ChatGPT 执行动作",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    description: "调用 ChatGPT 对指定的块ID列表执行特定动作。",
    zodRequestSchema: (z) => ({
      ids: z.array(z.string()).describe("要操作的块 ID 列表"),
      action: z.string().describe("要执行的动作指令")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().describe("ChatGPT 执行动作后的返回结果")
    })
  }
];
