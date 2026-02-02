export const templateApiDefs = [
  {
    method: "POST",
    endpoint: "/api/template/docSaveAsTemplate",
    en: "docSaveAsTemplate",
    zh_cn: "文档另存为模板",
    description: "将指定 ID 的文档内容保存为一个模板。可以指定模板名称，以及是否覆盖同名模板。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要作为模板保存的文档ID。"),
      name: z.string().describe("模板的名称。"),
      overwrite: z.boolean().describe("如果已存在同名模板，是否覆盖。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      msg: z.string().describe("错误或成功信息。"),
      data: z.null().describe("成功时总是为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/template/render",
    en: "renderTemplate",
    zh_cn: "渲染模板",
    description: "根据给定的模板文件路径和可选的上下文块ID，渲染模板内容。可以指定是否为预览模式。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("模板文件的绝对路径。"),
      id: z.string().describe("可选的上下文块ID，用于模板内获取该块的信息。"),
      preview: z.boolean().optional().describe("是否为预览模式，默认为 false。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息。"),
      data: z.object({
        path: z.string().describe("渲染的模板文件路径。"),
        content: z.string().describe("渲染后的模板内容 (HTML 字符串)。")
      }).nullable().describe("成功时返回包含路径和渲染后内容的对象，失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/template/renderSprig",
    en: "renderSprig",
    zh_cn: "渲染 Sprig 模板字符串",
    description: "使用 Go 的 Sprig 模板函数库渲染给定的模板字符串。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      template: z.string().describe("包含 Sprig 模板语法的字符串。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息。"),
      data: z.string().nullable().describe("渲染后的字符串内容，失败时为 null。")
    })
  }
];
