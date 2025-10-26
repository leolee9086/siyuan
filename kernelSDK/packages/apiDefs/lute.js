export const luteApiDefs = [
  {
    method: "POST",
    endpoint: "/api/lute/copyStdMarkdown",
    en: "copyStdMarkdown",
    zh_cn: "导出标准Markdown",
    description: "将指定ID的块内容导出为标准 Markdown 格式的字符串。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要导出内容的块的ID")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.string().describe("导出的标准 Markdown 内容")
    })
  },
  {
    method: "POST",
    endpoint: "/api/lute/html2BlockDOM",
    en: "html2BlockDOM",
    zh_cn: "HTML转块DOM",
    description: "将输入的 HTML 字符串转换为思源笔记的块级 DOM 结构 (仍为HTML字符串，但经过Lute处理)。会处理本地资源路径、空列表项、单列表格转段落等情况。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      dom: z.string().describe("要转换的 HTML 字符串")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.string().describe("转换后的块级 DOM (HTML 格式的字符串)")
    })
  },
  {
    method: "POST",
    endpoint: "/api/lute/spinBlockDOM",
    en: "spinBlockDOM",
    zh_cn: "处理块DOM(原生渲染优化)",
    description: "对传入的块级 DOM 字符串执行 Lute 引擎的 SpinBlockDOM 处理，进行原生渲染相关的优化。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      dom: z.string().describe("要处理的块级 DOM 字符串 (HTML 格式)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        dom: z.string().describe("经过 SpinBlockDOM 处理后的块级 DOM 字符串 (HTML 格式)")
      })
    })
  }
];
