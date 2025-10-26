export const importApiDefs = [
  {
    method: "POST",
    endpoint: "/api/import/importData",
    en: "importData",
    zh_cn: "导入数据包",
    description: "导入完整的数据包备份 (.zip)。此操作会覆盖当前工作空间的数据。请求体为 FormData，必须包含 'file' 字段，值为 .zip 数据包文件。由于是 FormData，具体字段不在 Zod schema 中定义。代码实现详见 kernel/api/import.go:importData。导入过程会将文件暂存并在处理后删除。注意：此操作会覆盖当前工作空间。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    formDataRequest: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/import/importSY",
    en: "importSY",
    zh_cn: "导入 .sy 文件",
    description: "导入 .sy 文件 (思源笔记的标准文档/子文档包) 到指定的笔记本和路径下。请求体为 FormData。必须包含 'file' 字段 (值为 .sy.zip 文件), 'notebook' 字段 (目标笔记本ID), 'toPath' 字段 (目标文档父路径，例如 '/' 表示笔记本根目录)。由于是 FormData，具体字段不在 Zod schema 中定义。代码实现详见 kernel/api/import.go:importSY。导入过程会将文件暂存并在处理后删除。后台会显示进度。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    formDataRequest: true,
    zodRequestSchema: (z) =>({
      // FormData fields: file (required), notebook (string, required), toPath (string, required)
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/import/importStdMd",
    en: "importStdMd",
    zh_cn: "导入标准 Markdown",
    description: "从本地文件系统导入标准 Markdown 文件或包含 Markdown 文件的文件夹到指定的笔记本和路径下。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("目标笔记本的 ID"),
      localPath: z.string().describe("本地 Markdown 文件或文件夹的绝对路径"),
      toPath: z.string().describe("导入到笔记本内的目标父路径，例如 '/' 表示笔记本根目录"),
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/import/importZipMd",
    en: "importZipMd",
    zh_cn: "导入 zip 格式 Markdown 包",
    description: "导入包含 Markdown 文件和资源的 zip 包到指定的笔记本和路径下。请求体为 FormData。必须包含 'file' 字段 (值为 .zip 文件), 'notebook' 字段 (目标笔记本ID), 'toPath' 字段 (导入到笔记本内的目标父路径，例如 '/' 表示笔记本根目录)。由于是 FormData，具体字段不在 Zod schema 中定义。导入过程会将文件暂存、解压并在处理后删除。后台会显示进度。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    formDataRequest: true,
    zodRequestSchema: (z) =>({
      // FormData fields: file (required), notebook (string, required), toPath (string, required)
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null"),
    })
  }
];
