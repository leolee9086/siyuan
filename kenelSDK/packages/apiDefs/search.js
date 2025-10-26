export const searchApiDefs = [
  {
    method: "POST",
    endpoint: "/api/search/findReplace",
    en: "findReplace",
    zh_cn: "查找并替换",
    description: "在指定的块ID范围、路径、笔记本、类型中查找内容并进行替换。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      k: z.string().describe("必需。要查找的关键词。"),
      r: z.string().describe("必需。要替换的字符串。"),
      ids: z.array(z.string()).describe("必需。要进行查找替换操作的块 ID 数组。"),
      paths: z.array(z.string()).optional().describe("可选。限制查找范围的路径数组，每个路径格式为 '笔记本ID/文档路径' 或仅 '笔记本ID'。"),
      boxes: z.array(z.string()).optional().describe("可选。限制查找范围的笔记本 ID 数组。如果提供了 paths，此参数通常会自动从中提取。"),
      types: z.record(z.boolean()).optional().describe("可选。指定要搜索的块类型，例如 {'paragraph': true, 'heading': false}。具体可用类型参考 model.ReplaceTypes。"),
      method: z.number().int().min(0).max(3).optional().describe("可选。搜索方法：0：关键字（默认），1：查询语法，2：SQL，3：正则表达式。"),
      orderBy: z.number().int().min(0).max(7).optional().describe("可选。排序方式：0：按块类型（默认），1：按创建时间升序，2：按创建时间降序，3：按更新时间升序，4：按更新时间降序，5：按内容顺序（仅在按文档分组时），6：按相关度升序，7：按相关度降序。"),
      groupBy: z.number().int().min(0).max(1).optional().describe("可选。分组方式：0：不分组（默认），1：按文档分组。"),
      replaceTypes: z.record(z.boolean()).optional().describe("可选。指定替换时要处理的文本类型，例如 {'text': true, 'imgText': true}。可用键包括：'text', 'imgText', 'imgTitle', 'imgSrc', 'aText', 'aTitle', 'aHref', 'code', 'em', 'strong', 'inlineMath', 'inlineMemo', 'blockRef', 'fileAnnotationRef', 'kbd', 'mark', 's', 'sub', 'sup', 'tag', 'u', 'docTitle', 'codeBlock', 'mathBlock', 'htmlBlock'。具体参考 Go 源码 model.FindReplace。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        closeTimeout: z.number().optional().describe("可选。如果替换过程中出现需要用户确认的对话框（例如替换了文档标题），此字段表示对话框的关闭延迟时间（毫秒）。")
      }).nullable().describe("成功时 Data 可能为 null 或包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/fullTextSearchAssetContent",
    en: "fullTextSearchAssetContent",
    zh_cn: "全文搜索资源文件内容",
    description: "对资源文件内容进行全文搜索（此功能需要付费订阅）。",
    needAuth: true,
    needAdminRole: false, // Go 源码中是 model.IsPaidUser() 检查，非 AdminRole
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      query: z.string().describe("必需。搜索查询语句。"),
      page: z.number().int().min(1).optional().describe("可选。页码，从 1 开始，默认为 1。"),
      pageSize: z.number().int().min(1).optional().describe("可选。每页数量，默认为 32。"),
      types: z.record(z.boolean()).optional().describe("可选。指定要搜索的资源文件类型（基于文件扩展名），例如 {'pdf': true, 'txt': false}。具体可用类型参考 model.QueryAssetContentTypes。"),
      method: z.number().int().min(0).max(3).optional().describe("可选。搜索方法：0：关键字（默认），1：查询语法，2：SQL，3：正则表达式。"),
      orderBy: z.number().int().min(0).max(3).optional().describe("可选。排序方式：0：按相关度降序（默认），1：按相关度升序，2：按更新时间升序，3：按更新时间降序。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功。如果未付费，Code 为 1。"),
      Msg: z.string().describe("错误信息，成功时为空字符串。"),
      Data: z.object({
        assetContents: z.array(z.object({
          id: z.string().describe("资源文件块 ID。"),
          box: z.string().describe("笔记本 ID。"),
          docID: z.string().describe("所属文档 ID。"),
          path: z.string().describe("资源文件路径。"),
          name: z.string().describe("资源文件名称。"),
          title: z.string().describe("文档标题。"),
          updated: z.string().describe("更新时间（YYYYMMDDHHmmss）。"),
          content: z.string().describe("匹配到的内容片段。"),
          count: z.number().int().describe("匹配数量。")
        })).describe("当前页的搜索结果列表。"),
        matchedAssetCount: z.number().int().describe("匹配到的资源文件总数。"),
        pageCount: z.number().int().describe("总页数。")
      }).nullable().describe("成功时返回搜索结果列表及分页信息；如果未付费，Data 为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/fullTextSearchBlock",
    en: "fullTextSearchBlock",
    zh_cn: "全文搜索块内容",
    description: "对块内容进行全文搜索，支持多种搜索方式和过滤条件。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      query: z.string().describe("必需。搜索查询语句。"),
      page: z.number().int().min(1).optional().describe("可选。页码，从 1 开始，默认为 1。"),
      pageSize: z.number().int().min(1).optional().describe("可选。每页数量，默认为 32。"),
      paths: z.array(z.string()).optional().describe("可选。限制查找范围的路径数组，每个路径格式为 '笔记本ID/文档路径' 或仅 '笔记本ID'。"),
      boxes: z.array(z.string()).optional().describe("可选。限制查找范围的笔记本 ID 数组。如果提供了 paths，此参数通常会自动从中提取。"),
      types: z.record(z.boolean()).optional().describe("可选。指定要搜索的块类型，例如 {'paragraph': true, 'heading': false}。具体可用类型参考 model.QueryBlockTypes。"),
      method: z.number().int().min(0).max(3).optional().describe("可选。搜索方法：0：关键字（默认），1：查询语法，2：SQL，3：正则表达式。"),
      orderBy: z.number().int().min(0).max(7).optional().describe("可选。排序方式：0：按块类型（默认），1：按创建时间升序，2：按创建时间降序，3：按更新时间升序，4：按更新时间降序，5：按内容顺序（仅在按文档分组时），6：按相关度升序，7：按相关度降序。"),
      groupBy: z.number().int().min(0).max(1).optional().describe("可选。分组方式：0：不分组（默认），1：按文档分组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.any()).describe("当前页的搜索结果块列表。每个块的结构根据其类型而定，通常包含 id, type, content, path, box, docID 等字段。"),
        matchedBlockCount: z.number().int().describe("匹配到的块总数。"),
        matchedRootCount: z.number().int().describe("匹配到的根块（文档）总数。"),
        pageCount: z.number().int().describe("总页数。"),
        docMode: z.boolean().describe("是否为文档模式搜索结果（groupBy=1 时为 true）。")
      }).nullable().describe("成功时返回搜索结果列表及分页信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/getAssetContent",
    en: "getAssetContent",
    zh_cn: "获取资源文件指定内容片段",
    description: "获取资源文件内容中，与指定查询相关的片段。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。资源文件块的 ID。"),
      query: z.string().describe("必需。查询关键词。"),
      queryMethod: z.number().int().min(0).max(3).describe("必需。查询方法：0：关键字，1：查询语法，2：SQL，3：正则表达式。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        assetContent: z.string().describe("匹配到的资源文件内容片段。")
      }).nullable().describe("成功时返回内容片段。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/getEmbedBlock",
    en: "getEmbedBlock",
    zh_cn: "获取嵌入块内容",
    description: "获取指定嵌入块的渲染内容，支持包含其子块或显示面包屑。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      embedBlockID: z.string().describe("必需。嵌入块（通常是 `((块ID))` 引用的块）的 ID。"),
      includeIDs: z.array(z.string()).describe("必需。要实际嵌入显示的块 ID 数组（通常只包含 embedBlockID，但在特殊情况下可能包含其子块）。"),
      headingMode: z.number().int().min(0).optional().describe("可选。标题处理模式：0：带标题下方块（默认），其他值行为需参照 model.GetEmbedBlock 实现。"),
      breadcrumb: z.boolean().optional().describe("可选。是否显示面包屑路径，默认为 false。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.any()).describe("渲染后的嵌入块内容数组。每个元素的具体结构取决于块类型。")
      }).nullable().describe("成功时返回渲染后的块内容。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/listInvalidBlockRefs",
    en: "listInvalidBlockRefs",
    zh_cn: "列出无效的块引用",
    description: "分页列出在当前工作空间中所有无效的块引用（例如，引用的块已被删除）。",
    needAuth: true,
    needAdminRole: false, // 源码中无 AdminRole 校验
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      page: z.number().int().min(1).optional().describe("可选。页码，从 1 开始，默认为 1。"),
      pageSize: z.number().int().min(1).optional().describe("可选。每页数量，默认为 32。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.object({
          id: z.string().describe("包含无效引用的块的 ID。"),
          box: z.string().describe("笔记本 ID。"),
          path: z.string().describe("文档路径。"),
          hPath: z.string().describe("文档层级路径。"),
          content: z.string().describe("块内容预览。"),
          updated: z.string().describe("块更新时间（YYYYMMDDHHmmss）。")
        })).describe("当前页的无效引用块列表。"),
        matchedBlockCount: z.number().int().describe("匹配到的无效引用块总数。"),
        matchedRootCount: z.number().int().describe("匹配到的包含无效引用的文档总数。"),
        pageCount: z.number().int().describe("总页数。")
      }).nullable().describe("成功时返回无效引用块列表及分页信息。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/removeTemplate",
    en: "removeTemplate",
    zh_cn: "移除模板",
    description: "根据路径移除指定的模板文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("必需。要移除的模板文件的相对路径（相对于模板文件夹）。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，-1 表示失败"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功或失败时 Data 均为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/searchAsset",
    en: "searchAsset",
    zh_cn: "搜索资源文件",
    description: "根据文件名关键词和可选的文件扩展名搜索资源文件。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      k: z.string().describe("必需。搜索关键词。"),
      exts: z.array(z.string()).optional().describe("可选。文件扩展名数组，用于过滤结果，例如 ['.png', '.jpg']。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.array(z.object({
        id: z.string().describe("资源文件块 ID。"),
        box: z.string().describe("笔记本 ID。"),
        docID: z.string().describe("所属文档 ID。"),
        path: z.string().describe("资源文件路径。"),
        name: z.string().describe("资源文件名称。"),
        title: z.string().describe("文档标题。"),
        hPath: z.string().describe("文档层级路径。"),
        updated: z.string().describe("更新时间（YYYYMMDDHHmmss）。")
      })).describe("匹配到的资源文件列表。如果没有结果，则为空数组。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/searchEmbedBlock",
    en: "searchEmbedBlock",
    zh_cn: "搜索嵌入块内容 (SQL查询)",
    description: "在指定的嵌入块（及其可能的子块）中使用 SQL 语句进行内容搜索。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      embedBlockID: z.string().describe("必需。作为搜索范围根的嵌入块 ID。"),
      stmt: z.string().describe("必需。用于搜索的 SQL 语句。查询的表名通常为 'blocks'，可查询的字段如 id, content, markdown, type 等。"),
      excludeIDs: z.array(z.string()).optional().describe("可选。在搜索结果中排除的块 ID 数组。"),
      headingMode: z.number().int().min(0).optional().describe("可选。标题处理模式：0：带标题下方块（默认），其他值行为需参照 model.SearchEmbedBlock 实现。"),
      breadcrumb: z.boolean().optional().describe("可选。是否显示面包屑路径，默认为 false。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.any()).describe("满足 SQL 查询条件的块内容数组。每个元素的具体结构取决于块类型和查询语句。")
      }).nullable().describe("成功时返回搜索到的块内容。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/searchRefBlock",
    en: "searchRefBlock",
    zh_cn: "搜索引用块建议",
    description: "在输入引用（例如 `((` 或 `[[`）时，根据关键词动态搜索可能的引用块建议。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。当前正在编辑的块的 ID。"),
      rootID: z.string().describe("必需。当前文档的根块 ID。"),
      k: z.string().describe("必需。用户输入的搜索关键词。"),
      beforeLen: z.number().int().optional().describe("可选。光标前字符长度，用于辅助判断引用类型，默认为0。"),
      isSquareBrackets: z.boolean().optional().describe("可选。是否为双方括号引用 `[[`，默认为 false。"),
      isDatabase: z.boolean().optional().describe("可选。是否在数据库视图中搜索，默认为 false。"),
      reqId: z.any().optional().describe("可选。请求 ID，会透传到响应中，用于前端跟踪异步请求。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.object({
          id: z.string().describe("建议引用的块 ID。"),
          type: z.string().describe("块类型。"),
          content: z.string().describe("块内容预览或标题。"),
          // 根据 searchRefBlock 返回，可能还有其他字段如 box, path, hPath, markdown, name, alias 等
        }).catchall(z.any())).describe("引用建议块列表。"),
        newDoc: z.boolean().describe("是否建议创建一个新文档（当搜索关键词在 `isSquareBrackets` 为 true 时可能触发）。"),
        k: z.string().describe("原始搜索关键词 (HTML转义后)。"),
        reqId: z.any().optional().describe("透传的请求 ID。")
      }).nullable().describe("成功时返回引用建议列表。如果 id 参数为空，Data 可能为仅包含 reqId 的对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/searchTag",
    en: "searchTag",
    zh_cn: "搜索标签",
    description: "根据关键词搜索已存在的标签。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      k: z.string().describe("必需。搜索关键词。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        tags: z.array(z.string()).describe("匹配到的标签列表。如果无结果则为空数组。"),
        k: z.string().describe("原始搜索关键词。")
      }).nullable().describe("成功时返回标签列表和关键词。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/searchTemplate",
    en: "searchTemplate",
    zh_cn: "搜索模板",
    description: "根据关键词搜索模板（通常是模板文件名或内容）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      k: z.string().describe("必需。搜索关键词。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.object({
          content: z.string().describe("模板内容片段或文件名。"),
          path: z.string().describe("模板文件的相对路径。"),
          docpath: z.string().optional().describe("关联的文档路径（如果适用）。")
          // 可能还有其他字段如 icon, id, name, type
        }).catchall(z.any())).describe("匹配到的模板列表。"),
        k: z.string().describe("原始搜索关键词。")
      }).nullable().describe("成功时返回模板列表和关键词。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/searchWidget",
    en: "searchWidget",
    zh_cn: "搜索挂件",
    description: "根据关键词搜索挂件块。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      k: z.string().describe("必需。搜索关键词。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        blocks: z.array(z.object({
          id: z.string().describe("挂件块 ID。"),
          markdown: z.string().describe("挂件块的 Markdown 内容。"),
          name: z.string().describe("挂件块的名称 (ial中的name属性)。")
          // 可能还有其他与块相关的通用字段
        }).catchall(z.any())).describe("匹配到的挂件块列表。"),
        k: z.string().describe("原始搜索关键词。")
      }).nullable().describe("成功时返回挂件列表和关键词。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/search/updateEmbedBlock",
    en: "updateEmbedBlock",
    zh_cn: "更新查询嵌入块内容",
    description: "更新指定**查询嵌入块（`query_embed` 类型）**的原始查询语句或脚本内容。此接口专门用于处理查询嵌入块，不适用于普通块的自定义属性更新。",
    needAuth: true,
    needAdminRole: false, // 源码中无 AdminRole 校验
    unavailableIfReadonly: false, // 源码中无 Readonly 校验
    zodRequestSchema: (z) => ({
      id: z.string().describe("必需。要更新的查询嵌入块的 ID。"),
      content: z.string().describe("必需。查询嵌入块新的原始 Markdown 内容，通常是 SQL 查询语句或 JavaScript 脚本。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，-1 表示失败"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().describe("成功或失败时 Data 均为 null。")
    })
  }
];
