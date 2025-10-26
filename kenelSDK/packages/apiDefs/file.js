export const fileApiDefs = [
  {
    method: "POST",
    endpoint: "/api/file/copyFile",
    en: "copyFile",
    zh_cn: "复制文件",
    description: "复制工作空间内的单个文件或资源文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      src: z.string().describe("源文件路径。如果是资源文件，则为相对于 assets 目录的路径；如果是普通工作空间文件，则为相对于工作空间根目录的路径。后端会尝试将其解析为绝对路径。注意：此接口不能直接复制目录。后台实现会先尝试将其作为资源文件解析，如果失败则作为工作空间普通文件解析。若要复制普通文件，建议使用 /api/file/globalCopyFiles。 "),
      dest: z.string().describe("目标文件绝对路径。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({ closeTimeout: z.number().optional().describe("在操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。") }).nullable().describe("成功时 Data 为 null；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/file/getFile",
    en: "getFile",
    zh_cn: "获取文件内容",
    description: "获取指定路径的文件内容。注意：此接口不通过JSON返回文件内容，而是直接在HTTP响应体中返回文件数据流，Content-Type 根据文件类型确定。因此，zodResponseSchema 仅用于描述可能的错误情况下的JSON响应。成功获取文件时，HTTP状态码为200，响应体为文件内容。",
    needAuth: true,
    needAdminRole: false, // 根据 router.go，普通用户即可访问，但 getFile 函数内部对 conf.json 有额外管理员权限校验
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ path: z.string().describe("要获取内容的文件路径 (相对于工作空间根目录)。") }),
    zodResponseSchema: (z) => ({
      // 成功时直接返回文件流，HTTP状态码为200。以下 schema 仅用于描述请求失败时的JSON响应。
      Code: z.number().describe("错误状态码 (例如 403, 404, 500)"),
      Msg: z.string().describe("错误消息")
    })
  },
  {
    method: "POST",
    endpoint: "/api/file/getUniqueFilename",
    en: "getUniqueFilename",
    zh_cn: "获取文件唯一名",
    description: "根据输入的文件路径，生成一个在目标位置唯一的、不冲突的文件名版本。例如，输入 'assets/image.png'，如果已存在，则可能返回 'assets/image_1.png'。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ path: z.string().describe("原始文件路径 (通常包含期望的文件名和扩展名)。") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({ path: z.string().describe("处理后的唯一文件路径。") })
    })
  },
  {
    method: "POST",
    endpoint: "/api/file/globalCopyFiles",
    en: "globalCopyFiles",
    zh_cn: "全局复制多个文件",
    description: "将多个源文件复制到指定的目标目录 (相对于工作空间)。源文件路径必须是绝对路径。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      srcs: z.array(z.string()).describe("要复制的源文件绝对路径数组。如果任何一个文件不存在，操作将失败。注意：不能是目录。"),
      destDir: z.string().describe("目标目录路径 (相对于工作空间根目录)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/file/putFile",
    en: "putFile",
    zh_cn: "上传/创建文件或目录",
    description: "上传文件或创建目录。这是一个 multipart/form-data 请求。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    formDataRequest:true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("目标文件或目录在工作空间内的相对路径。文件名需要符合规范，否则请求失败。") /* FormData */,
      isDir: z.boolean().describe("是否创建目录。如果为 true，则创建目录；如果为 false 或未提供，则上传文件。") /* FormData */,
      modTime: z.string().optional().describe("可选的文件修改时间戳 (毫秒级字符串)。如果提供，则设置文件或目录的修改时间。") /* FormData */
      // 如果 isDir 为 false，还需要一个名为 'file' 的 FormData 文件字段。
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/file/readDir",
    en: "readDir",
    zh_cn: "读取目录内容",
    description: "读取指定目录下的文件和子目录列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ path: z.string().describe("要读取的目录路径 (相对于工作空间根目录)。") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.array(z.object({
        name: z.string().describe("文件名或目录名"),
        isDir: z.boolean().describe("是否为目录"),
        isSymlink: z.boolean().describe("是否为符号链接"),
        updated: z.number().describe("最后修改时间的Unix时间戳 (秒)")
      })).describe("目录中的条目列表")
    })
  },
  {
    method: "POST",
    endpoint: "/api/file/removeFile",
    en: "removeFile",
    zh_cn: "移除文件或目录",
    description: "移除指定路径的文件或目录。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ path: z.string().describe("要移除的文件或目录路径 (相对于工作空间根目录)。") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/file/renameFile",
    en: "renameFile",
    zh_cn: "重命名文件或目录",
    description: "重命名指定路径的文件或目录。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("原始文件或目录路径 (相对于工作空间根目录)。"),
      newPath: z.string().describe("新的文件或目录路径 (相对于工作空间根目录)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据")
    })
  }
];
