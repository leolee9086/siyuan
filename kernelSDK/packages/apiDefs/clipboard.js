export const clipboardApiDefs = [
  {
    method: "POST",
    endpoint: "/api/clipboard/readFilePaths",
    en: "readFilePaths",
    zh_cn: "读取剪贴板文件路径",
    description: "从系统剪贴板中读取文件路径列表。注意：在 Linux 上此功能可能受限或不可用。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.string()).describe("从剪贴板中读取到的文件绝对路径列表。如果剪贴板中不是文件路径，或在 Linux 等受限情况下，可能返回空数组。")
    })
  }
];
