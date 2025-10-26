export const extensionApiDefs = [
  {
    method: "POST",
    endpoint: "/api/extension/copy",
    en: "extensionCopy",
    zh_cn: "扩展内容复制处理",
    description: "处理来自浏览器扩展（如剪藏）复制过来的内容。将 HTML DOM 转换为 Markdown，并处理其中包含的图片等资源，将其保存到指定的笔记本或默认的 assets 目录。支持从链滴剪藏时直接获取 Markdown。这是一个 multipart/form-data 请求，除了明确定义的字段外，还可以包含多个文件字段。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      dom: z.string().describe("要处理的 HTML DOM 内容字符串。这是必须的字段。注意：即使是从链滴剪藏（href 指向链滴文章），也需要传递一个 dom 参数，内容可以为空字符串。") /* FormData */,
      notebook: z.string().optional().describe("目标笔记本的ID。如果提供，资源文件将保存到该笔记本的 assets 文件夹下；否则保存到工作空间根目录的 assets 文件夹下。") /* FormData */,
      href: z.string().optional().describe("原始剪藏页面的 URL。如果此 URL 指向链滴文章 (ld246.com 或 liuyun.io)，后端会尝试直接获取文章的 Markdown 内容，并优先使用此内容而非 dom 参数中的 HTML。") /* FormData */
      // 其他动态的文件字段 (key: 原始文件名/URL, value: File对象) 会被处理并保存为资源文件。
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息，失败时错误信息显示在这里"),
      Data: z.object({
        md: z.string().describe("转换后或直接获取的 Markdown 内容"),
        withMath: z.boolean().describe("指示转换后的 Markdown 内容中是否包含数学公式 (KaTeX)")
        // `uploaded` 字段在 Go 源码中存在，但并未包含在最终返回给客户端的 Data 中，因此此处不定义。
      }).nullable().describe("成功时返回的数据，如果处理失败或没有有效内容则可能为 null")
    })
  }
];
