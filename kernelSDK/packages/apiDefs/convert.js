export const convertApiDefs = [
  {
    method: "POST",
    endpoint: "/api/convert/pandoc",
    en: "pandoc",
    zh_cn: "Pandoc 格式转换",
    description: "调用系统安装的 Pandoc 工具进行文档格式转换。需要提供 Pandoc 命令行参数。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ dir: z.string().optional().describe("Pandoc 命令执行的工作目录路径，如果为空则在临时目录中执行"), args: z.array(z.string()).describe("Pandoc 命令行参数数组") }),
    zodResponseSchema: (z) => ({ Code: z.number().describe("响应状态码，0 表示成功"), Msg: z.string().describe("响应消息"), Data: z.object({ path: z.string().describe("转换后输出文件的路径") }).describe("成功时返回的数据") })
  }
];
