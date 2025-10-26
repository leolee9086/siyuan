export const assetApiDefs = [
  {
    method: "POST",
    endpoint: "/api/asset/fullReindexAssetContent",
    en: "fullReindexAssetContent",
    zh_cn: "重建资源文件内容索引",
    description: "完全重新索引工作空间中所有资源文件的内容，用于搜索。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("此接口通常不返回数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/getDocAssets",
    en: "getDocAssets",
    zh_cn: "获取文档资源列表",
    description: "获取指定文档块所引用的所有资源文件列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("文档块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().describe("资源文件对象数组，具体结构未定义")
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/getDocImageAssets",
    en: "getDocImageAssets",
    zh_cn: "获取文档图片资源列表",
    description: "获取指定文档块所引用的所有图片类型资源文件列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("文档块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().describe("图片资源文件对象数组，具体结构未定义")
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/getFileAnnotation",
    en: "getFileAnnotation",
    zh_cn: "获取文件标注",
    description: "获取指定资源文件的标注信息（通常是 XFDF 格式的 PDF 标注）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ path: z.string().describe("资源文件的路径 (例如 assets/xxx.pdf)") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        path: z.string().describe("资源文件的路径"),
        data: z.string().describe("标注数据 (通常为 XFDF 格式的字符串)")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/getImageOCRText",
    en: "getImageOCRText",
    zh_cn: "获取图片 OCR 文本",
    description: "获取指定图片资源文件后台 OCR 识别的文本内容。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ path: z.string().describe("图片资源文件的路径 (例如 assets/xxx.png)") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        text: z.string().describe("OCR 识别出的文本内容"),
        ocrJSON: z.any().describe("原始 OCR 结果，通常为 JSON 对象，具体结构取决于 OCR 引擎")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/getMissingAssets",
    en: "getMissingAssets",
    zh_cn: "获取丢失的资源列表",
    description: "获取所有在文档中被引用但实际资源文件已不存在的资源路径列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        missingAssets: z.array(z.any()).describe("丢失的资源路径列表，具体元素结构未定义")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/getUnusedAssets",
    en: "getUnusedAssets",
    zh_cn: "获取未使用资源列表",
    description: "获取工作空间中存在但未被任何文档引用的资源文件列表（最多返回512条）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        unusedAssets: z.array(z.any()).describe("未使用的资源文件对象列表，具体元素结构未定义")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/insertLocalAssets",
    en: "insertLocalAssets",
    zh_cn: "插入本地资源文件",
    description: "将指定的本地文件复制到当前笔记本的 assets 文件夹中，并在指定文档中插入对这些资源的引用。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      assetPaths: z.array(z.string()).describe("本地资源文件的绝对路径数组"),
      id: z.string().describe("要插入资源引用的目标文档块 ID"),
      isUpload: z.boolean().optional().describe("是否为上传操作，默认为 false")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        succMap: z.record(z.string()).describe("成功插入的资源映射，键为原始文件名，值为在思源中的新资源路径")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/ocr",
    en: "ocr",
    zh_cn: "对图片进行 OCR",
    description: "对指定的图片资源文件执行光学字符识别，并返回识别出的文本及原始 OCR 结果。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ path: z.string() }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        text: z.string().describe("OCR 识别出的文本内容"),
        ocrJSON: z.any().describe("原始 OCR 结果，通常为 JSON 对象，具体结构取决于 OCR 引擎")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/removeUnusedAsset",
    en: "removeUnusedAsset",
    zh_cn: "移除单个未使用资源",
    description: "删除工作空间中指定的单个未使用（未被任何文档引用）的资源文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ path: z.string() }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        path: z.string().describe("被成功移除的资源文件的路径")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/removeUnusedAssets",
    en: "removeUnusedAssets",
    zh_cn: "移除所有未使用资源",
    description: "删除工作空间中所有未被任何文档引用的资源文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        paths: z.array(z.string()).describe("被成功移除的所有未使用资源文件的路径列表")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/renameAsset",
    en: "renameAsset",
    zh_cn: "重命名资源文件",
    description: "重命名指定的资源文件，并自动更新所有文档中对该资源的引用。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      oldPath: z.string().describe("资源文件的当前路径 (例如 assets/old_name.png)"),
      newName: z.string().describe("资源文件的新名称 (不含路径，例如 new_name.png)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        newPath: z.string().describe("资源文件重命名后的新路径 (例如 assets/new_name.png)")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/resolveAssetPath",
    en: "resolveAssetPath",
    zh_cn: "解析资源绝对路径",
    description: "将资源文件在思源笔记中的相对路径（如 'assets/image.png'）转换为其在文件系统中的绝对路径。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      path: z.string().describe("思源笔记中的资源相对路径 (例如 assets/image.png)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.string().describe("资源文件在文件系统中的绝对路径")
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/setFileAnnotation",
    en: "setFileAnnotation",
    zh_cn: "设置文件标注",
    description: "为指定的资源文件（通常是 PDF）保存或更新其标注信息（通常是 XFDF 格式）。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("资源文件的路径 (例如 assets/xxx.pdf)"),
      data: z.string().describe("要设置的标注数据 (通常为 XFDF 格式的字符串)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/setImageOCRText",
    en: "setImageOCRText",
    zh_cn: "设置图片 OCR 文本",
    description: "手动为指定的图片资源文件设置或更新其 OCR 文本内容，并刷新到数据库。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("图片资源文件的路径 (例如 assets/xxx.png)"),
      text: z.string().describe("要设置的 OCR 文本内容")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/statAsset",
    en: "statAsset",
    zh_cn: "获取文件元信息",
    description: "获取指定资源文件（assets/ 路径）或本地文件（file:/// 路径）的大小、创建及修改时间等元信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      path: z.string().describe("资源文件的 assets/ 路径或本地文件的 file:/// 绝对路径")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        size: z.number().describe("文件大小（字节）"),
        hSize: z.string().describe("人类可读的文件大小 (例如 1.2MB)"),
        created: z.number().describe("文件创建时间戳 (毫秒)"),
        hCreated: z.string().describe("人类可读的文件创建时间"),
        updated: z.number().describe("文件最后修改时间戳 (毫秒)"),
        hUpdated: z.string().describe("人类可读的文件最后修改时间")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/upload",
    en: "Upload",
    zh_cn: "上传文件",
    description: "处理文件上传。通常用于将文件上传到服务器的临时目录或直接作为资源插入。参数通过 FormData 传递，如 assetPath (可选，指定保存路径) 和 id (可选，关联的文档ID)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) =>({
      assetPath: z.string().optional().describe("可选，指定资源在 assets 目录中保存的相对路径 (例如 myfolder/image.png)"),
      id: z.string().optional().describe("可选，关联的文档块 ID，如果提供，则会在该文档中插入对上传资源的引用"),
      files: z.any().describe("通过 FormData 上传的文件对象或文件对象列表，此字段仅用于类型提示，实际通过 FormData 传递")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        errFiles: z.array(z.string()).describe("上传失败的文件名列表"),
        succMap: z.record(z.string()).describe("上传成功的文件映射，键为原始文件名，值为在思源中的新资源路径 (例如 assets/image.png)")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/asset/uploadCloud",
    en: "uploadCloud",
    zh_cn: "上传资源到云端",
    description: "将指定文档（及其子文档中）引用的所有本地资源文件上传到用户配置的云存储服务。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("文档块的 ID，将上传此文档及其子文档中引用的所有本地资源")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  }
];
