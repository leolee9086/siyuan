export const filetreeApiDefs = [
  {
    method: "POST",
    endpoint: "/api/filetree/changeSort",
    en: "changeSort",
    zh_cn: "更改文档树排序",
    description: "更改指定笔记本下，特定路径列表的文档树排序方式。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要更改排序的笔记本ID。"),
      paths: z.array(z.string()).describe("需要调整排序的文档路径列表。这些路径通常是文档在其笔记本内的相对路径。后端会根据这些路径的顺序来更新文档树的排序。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/createDailyNote",
    en: "createDailyNote",
    zh_cn: "创建或获取今日日记",
    description: "根据用户配置的日记模板创建今日的日记文档。如果今日的日记已存在，则直接返回该日记的信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要在哪个笔记本下创建日记的ID。"),
      app: z.string().optional().describe("发起创建请求的应用标识，可选参数，用于事件推送时的识别。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码。0 表示成功创建或获取；1 表示笔记本未找到；-1 表示其他错误。"),
      Msg: z.string().describe("响应消息。"),
      Data: z.object({
        id: z.string().describe("创建或获取到的日记文档的根块ID。")
      }).optional().describe("成功时返回日记文档的ID；笔记本未找到时此字段不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/createDoc",
    en: "createDoc",
    zh_cn: "创建文档",
    description: "在指定的笔记本和路径下创建一个新的文档，并可以附带初始Markdown内容和排序信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("文档所属的笔记本ID。"),
      path: z.string().describe("文档的存储路径 (相对于笔记本根目录，例如 '/folder/documentName')。"),
      title: z.string().describe("文档的标题。"),
      md: z.string().describe("文档的初始 Markdown 内容。"),
      sorts: z.array(z.string()).optional().describe("可选的排序信息数组。"),
      listDocTree: z.boolean().optional().describe("是否在创建后触发文档树列表更新事件，默认为 false。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        id: z.string().describe("新创建文档的根块ID。"),
        closeTimeout: z.number().optional().describe("操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).describe("成功时返回新文档的ID；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/createDocWithMd",
    en: "createDocWithMd",
    zh_cn: "通过Markdown创建文档",
    description: "在指定笔记本、路径下，使用提供的Markdown内容创建一个新文档。可以指定父文档ID、新文档ID、标签等。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("文档所属的笔记本ID。"),
      path: z.string().describe("文档的人类可读路径 (HPath)，例如 '/My Notes/New Document'。后端会处理路径中的非法字符和长度限制。"),
      markdown: z.string().describe("新文档的Markdown内容。"),
      parentID: z.string().optional().describe("可选的父文档ID。如果提供，新文档将作为该文档的子文档创建。"),
      id: z.string().optional().describe("可选的新文档ID。如果提供且合法，将使用此ID创建文档；否则自动生成。"),
      tags: z.string().optional().describe("可选的文档标签字符串，多个标签以逗号分隔。"),
      withMath: z.boolean().optional().describe("Markdown内容中是否包含数学公式，默认为false。"),
      clippingHref: z.string().optional().describe("如果是通过剪藏创建的，可以提供原始剪藏页面的URL。"),
      listDocTree: z.boolean().optional().describe("是否在创建后触发文档树列表更新事件，默认为 false。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.string().optional().describe("成功时返回新创建文档的ID。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/doc2Heading",
    en: "doc2Heading",
    zh_cn: "文档转换为标题块",
    description: "将一个源文档的内容转换为一个标题块，并将其插入到目标文档的指定标题块之后或之前。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      srcID: z.string().describe("要转换的源文档的ID。"),
      targetID: z.string().describe("目标文档中，新标题块将插入到其后的那个标题块的ID。如果 after 为 false，则插入其前。"),
      after: z.boolean().describe("是否将源文档内容插入到 targetID 块之后 (true) 或之前 (false)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        srcTreeBox: z.string().describe("源文档所在的笔记本ID。"),
        srcTreePath: z.string().describe("源文档的路径。"),
        closeTimeout: z.number().optional().describe("操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).describe("成功时返回源文档的笔记本和路径信息；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/duplicateDoc",
    en: "duplicateDoc",
    zh_cn: "复制文档",
    description: "复制（克隆）一个指定的文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要复制的源文档的ID。"),
      listDocTree: z.boolean().optional().describe("是否在复制后触发文档树列表更新事件，默认为 true (根据 Go 源码，此参数会添加到推送事件中)。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        id: z.string().describe("新复制出来的文档的根块ID。"),
        notebook: z.string().describe("新文档所在的笔记本ID。"),
        path: z.string().describe("新文档的存储路径。"),
        hPath: z.string().describe("新文档的人类可读路径 (HPath)。"),
        closeTimeout: z.number().optional().describe("操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).describe("成功时返回新文档的相关信息；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getDoc",
    en: "getDoc",
    zh_cn: "获取文档内容和结构",
    description: "获取指定文档（或文档中的一部分内容）的详细信息，包括块内容、结构、属性等。支持多种加载模式和查询参数。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要获取的文档或块的ID。"),
      index: z.number().optional().describe("当 id 指向一个列表项容器块时，用于指定获取第几个列表项，从0开始。默认为0。主要用于动态加载长列表。"),
      query: z.string().optional().describe("搜索关键词，用于在文档内容中进行搜索和高亮。与 queryMethod 和 queryTypes 配合使用。"),
      queryMethod: z.number().optional().describe("搜索方法。0: 关键词，1: 查询语法。默认为0。"),
      queryTypes: z.record(z.boolean()).optional().describe("搜索类型。一个键值对对象，如 {'blockquote': true, 'codeBlock': false}，表示搜索哪些类型的块。默认为搜索所有类型。"),
      mode: z.number().optional().describe("加载模式。0: 仅当前ID内容；1: 向上加载；2: 向下加载；3: 上下都加载；4: 加载末尾。默认为0。"),
      size: z.number().optional().describe("加载块的数量。默认为102400。当提供了 startID 和 endID 时，此值会被配置项 editor.dynamicLoadBlocks 覆盖。"),
      startID: z.string().optional().describe("动态加载范围的起始块ID。通常与 endID 一起使用。"),
      endID: z.string().optional().describe("动态加载范围的结束块ID。通常与 startID 一起使用。"),
      isBacklink: z.boolean().optional().describe("是否为反向链接视图的上下文加载，默认为 false。"),
      originalRefBlockIDs: z.record(z.string()).optional().describe("原始引用块ID的映射，用于反链高亮等场景。键为当前文档中的块ID，值为原始文档中的块ID。"),
      highlight: z.boolean().optional().describe("是否对内容进行高亮处理（例如搜索结果高亮），默认为 true。"),
      reqId: z.string().optional().describe("请求ID，会透传到响应中，用于跟踪请求。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码。0: 成功；1: 通用错误；3: 块未找到。"),
      Msg: z.string().describe("响应消息。"),
      Data: z.object({
        id: z.string().describe("请求的原始块ID。"),
        mode: z.number().describe("请求的加载模式。"),
        parentID: z.string().describe("父块ID。"),
        parent2ID: z.string().describe("父父块ID。"),
        rootID: z.string().describe("文档根块ID。"),
        type: z.number().describe("块类型。"),
        content: z.string().describe("块的DOM内容 (HTML字符串)。"),
        blockCount: z.number().describe("返回的块数量。"),
        eof: z.boolean().describe("是否已到达文档末尾 (在向下加载模式时)。"),
        scroll: z.boolean().describe("是否需要滚动定位。"),
        box: z.string().describe("文档所属的笔记本ID。"),
        path: z.string().describe("文档的存储路径。"),
        isSyncing: z.boolean().describe("文档当前是否正在同步中。"),
        isBacklinkExpand: z.boolean().describe("是否为反链展开上下文。"),
        keywords: z.array(z.string()).optional().describe("搜索时匹配到的关键词列表。"),
        reqId: z.string().optional().describe("请求时传递的 reqId。")
      }).optional().describe("成功时返回文档内容和结构信息；失败时此字段可能不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getDocCreateSavePath",
    en: "getDocCreateSavePath",
    zh_cn: "获取新文档的默认保存位置",
    description: "根据当前笔记本和全局配置，计算并返回创建新文档时应使用的默认笔记本ID和保存路径 (HPath)。路径支持Go模板。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("当前操作的笔记本ID。计算默认保存位置时会参考此笔记本的配置及全局配置。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        box: z.string().describe("计算得出的用于保存新文档的笔记本ID。"),
        path: z.string().describe("计算得出的用于保存新文档的人类可读路径 (HPath)。")
      }).optional().describe("成功时返回 box 和 path；失败时此字段可能不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getFullHPathByID",
    en: "getFullHPathByID",
    zh_cn: "通过ID获取完整层级路径",
    description: "根据文档或块的ID，获取其在笔记本中的完整层级标题路径 (HPath)，例如 '/父文档标题/子文档标题/当前文档标题'。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要查询的文档或块的ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.string().optional().describe("成功时返回完整的层级路径字符串；如果ID无效或未找到，则此字段可能不存在或为空。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getHPathByID",
    en: "getHPathByID",
    zh_cn: "通过ID获取文档的人类可读路径",
    description: "根据文档或块的ID，获取其在笔记本中的人类可读路径 (HPath)，即文件路径形式的标题路径，例如 '/父文档标题/子文档标题/当前文档标题.sy' 的 Sy 文件名部分。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要查询的文档或块的ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.string().optional().describe("成功时返回人类可读路径 (HPath)；如果ID无效或未找到，则此字段可能不存在或为空。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getHPathByPath",
    en: "getHPathByPath",
    zh_cn: "通过文档实际路径获取人类可读路径",
    description: "根据文档在笔记本中的实际存储路径 (相对于笔记本根目录)，获取其人类可读路径 (HPath)。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("文档所在的笔记本ID。"),
      path: z.string().describe("文档的实际存储路径 (相对于笔记本根目录，例如 '/folderName/documentName.sy')。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.string().optional().describe("成功时返回人类可读路径 (HPath)；如果路径无效或未找到文档，则此字段可能不存在或为空。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getHPathsByPaths",
    en: "getHPathsByPaths",
    zh_cn: "批量通过文档实际路径获取人类可读路径",
    description: "根据一组文档的实际存储路径 (包含笔记本ID和文档相对路径)，批量获取它们对应的人类可读路径 (HPath)。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      paths: z.array(z.object({
        notebook: z.string().describe("文档所在的笔记本ID。"),
        path: z.string().describe("文档的实际存储路径 (相对于笔记本根目录)。")
      })).describe("包含笔记本ID和文档路径的对象数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.array(z.string()).optional().describe("成功时返回与输入顺序对应的人类可读路径 (HPath) 数组；如果某个输入无效，对应位置可能为空字符串或数组长度可能不匹配。")
      // 注意：Go 源码中 model.GetHPathsByPaths 的实现是直接返回 []string 和 error，对于错误情况，外层 API 会设置 Code 和 Msg，Data 可能为 nil。
      // 但这里的 zod 描述Data为可选数组，是为了兼容更广泛的情况和前端处理的便利性。
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getIDsByHPath",
    en: "getIDsByHPath",
    zh_cn: "通过人类可读路径获取文档ID列表",
    description: "根据文档的人类可读路径 (HPath) 和其所在的笔记本ID，获取所有匹配该路径的文档的ID列表。因为HPath可能不唯一，所以返回的是数组。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("文档所在的笔记本ID。"),
      path: z.string().describe("要查询的文档的人类可读路径 (HPath)，例如 '/My Notes/Topic'。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.array(z.string()).optional().describe("成功时返回匹配的文档ID数组；如果未找到或路径无效，则数组可能为空或此字段不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getPathByID",
    en: "getPathByID",
    zh_cn: "通过ID获取文档的实际存储路径和笔记本ID",
    description: "根据文档或块的ID，获取其在工作空间中的实际存储路径 (相对于笔记本根目录) 和所在的笔记本ID。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要查询的文档或块的ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        path: z.string().describe("文档的实际存储路径 (相对于笔记本根目录，例如 '/folderName/documentName.sy')。"),
        notebook: z.string().describe("文档所在的笔记本ID。")
      }).optional().describe("成功时返回 path 和 notebook；如果ID无效或未找到，则此字段可能不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/getRefCreateSavePath",
    en: "getRefCreateSavePath",
    zh_cn: "获取新块引的默认保存位置",
    description: "根据当前笔记本和全局配置，计算并返回创建新块引文档时应使用的默认笔记本ID和保存路径 (HPath)。路径支持Go模板。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("当前操作的笔记本ID。计算默认保存位置时会参考此笔记本的配置及全局配置。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        box: z.string().describe("计算得出的用于保存新块引文档的笔记本ID。"),
        path: z.string().describe("计算得出的用于保存新块引文档的人类可读路径 (HPath)。")
      }).optional().describe("成功时返回 box 和 path；失败时此字段可能不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/heading2Doc",
    en: "heading2Doc",
    zh_cn: "标题块转换为文档",
    description: "将源文档中的一个标题块及其后续同级内容，转换为一个新的独立文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      srcHeadingID: z.string().describe("源文档中要转换为新文档的标题块的ID。"),
      targetNoteBook: z.string().describe("新文档将要创建在哪个笔记本的ID。"),
      targetPath: z.string().optional().describe("新文档在目标笔记本中的可选保存路径 (HPath)。如果未提供，则根据配置或默认规则生成。"),
      previousPath: z.string().optional().describe("可选参数，用于指定新文档在文档树中的排序位置，它应该是目标位置前一个文档的路径。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        srcRootBlockID: z.string().describe("转换后新文档的根块ID。"),
        path: z.string().describe("新文档在目标笔记本中的实际存储路径。"),
        closeTimeout: z.number().optional().describe("操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).describe("成功时返回新文档的ID和路径；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/li2Doc",
    en: "li2Doc",
    zh_cn: "列表项转换为文档",
    description: "将源文档中的一个列表项（及其所有子项）转换为一个新的独立文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      srcListItemID: z.string().describe("源文档中要转换为新文档的列表项的ID。"),
      targetNoteBook: z.string().describe("新文档将要创建在哪个笔记本的ID。"),
      targetPath: z.string().optional().describe("新文档在目标笔记本中的可选保存路径 (HPath)。如果未提供，则根据配置或默认规则生成。"),
      previousPath: z.string().optional().describe("可选参数，用于指定新文档在文档树中的排序位置，它应该是目标位置前一个文档的路径。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        srcRootBlockID: z.string().describe("转换后新文档的根块ID。"),
        path: z.string().describe("新文档在目标笔记本中的实际存储路径。"),
        closeTimeout: z.number().optional().describe("操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).describe("成功时返回新文档的ID和路径；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/listDocTree",
    en: "listDocTree",
    zh_cn: "列出文档树",
    description: "列出指定笔记本的文档树结构，支持过滤、排序等。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要列出文档树的笔记本ID。"),
      path: z.string().describe("要列出文档树的起始路径 (相对于笔记本根目录，例如 '/folderName')。通常用于列出某个文件夹下的文档结构。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        tree: z.array(z.object({
          id: z.string().describe("文档或目录的ID。"),
          children: z.array(z.any()).optional().describe("子文档或子目录的数组，结构与父级相同。如果当前项是文档文件或者没有子目录，则此字段不存在或为空。注意：为了简化类型定义，children内部元素类型设为z.any()，实际应为与父级相同的 DocFile 结构。") // DocFile: {id: string, children?: DocFile[]}
        })).describe("文档树结构数组。")
      }).optional().describe("成功时返回文档树结构；失败时此字段可能不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/listDocsByPath",
    en: "listDocsByPath",
    zh_cn: "获取指定路径下的文档列表",
    description: "获取指定笔记本和路径下的文档及子文件夹列表，支持排序、闪卡过滤和数量限制。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("笔记本ID。"),
      path: z.string().describe("要列出文档的路径 (相对于笔记本根目录，例如 '/folderName')。空字符串表示笔记本根目录。"),
      sort: z.number().optional().describe("排序模式，具体值参考思源笔记内核定义 (util.SortModeXXX)。如果未提供，则使用笔记本或全局配置的默认排序。例如: 0-默认, 1-按创建日期升序, 2-按创建日期降序, 3-按修改日期升序, 4-按修改日期降序, 5-按字母升序, 6-按字母降序, 7-按引用数升序, 8-按引用数降序, 等。"),
      flashcard: z.boolean().optional().describe("是否仅列出包含闪卡的文档，默认为 false (列出所有)。"),
      maxListCount: z.number().optional().describe("最大列出数量。如果未提供或为0，则使用系统配置 (fileTree.maxListCount 或 math.MaxInt)。"),
      showHidden: z.boolean().optional().describe("是否显示隐藏文件/文件夹，默认为 false。"),
      ignoreMaxListHint: z.boolean().optional().describe("当实际数量超过 maxListCount 时，是否忽略弹出的提示消息。默认为 false (即会提示)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        box: z.string().describe("请求的笔记本ID。"),
        path: z.string().describe("请求的路径。"),
        files: z.array(z.object({
          type: z.string().describe("条目类型，'d' 表示目录 (doc file)，'f' 表示文件 (asset file)。在 filetree 上下文，通常都是文档，但 model.File 的定义更通用。"), 
          name: z.string().describe("文档名或目录名 (不含.sy后缀)。"),
          alias: z.string().optional().describe("文档别名 (如果设置了)。"),
          memo: z.string().optional().describe("文档备注 (如果设置了)。"),
          bookmark: z.string().optional().describe("文档书签内容 (如果设置了)。"),
          hPath: z.string().describe("人类可读路径 (HPath)。"),
          id: z.string().describe("文档ID。"),
          path: z.string().describe("文档的实际存储路径 (相对于笔记本根目录)。"),
          nameCount: z.number().optional().describe("文档名中的字符数。"),
          updated: z.number().describe("文档最后修改时间的Unix时间戳 (秒)。"),
          subFileCount: z.number().describe("如果是目录，表示其下子文档/目录的数量。"),
          icon: z.string().optional().describe("文档图标的Base64编码或Emoji字符。"),
          sort: z.number().optional().describe("排序权重值。"),
          refCount: z.number().optional().describe("被引用计数。"),
          newFlashcardCount: z.number().optional().describe("新闪卡数量。"),
          dueFlashcardCount: z.number().optional().describe("到期闪卡数量。"),
          flashcardCount: z.number().optional().describe("总闪卡数量。"),
          hidden: z.boolean().optional().describe("是否为隐藏文档。")
          // 其他 model.File 中的字段也可能存在，这里仅列出常见和 filetree.go 中明确处理的
        })).describe("文档和子目录列表。")
      }).optional().describe("成功时返回文档列表信息；失败时此字段可能不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/moveDocs",
    en: "moveDocs",
    zh_cn: "批量移动文档 (基于路径)",
    description: "将一组源文档（通过其在各自笔记本中的相对路径指定）移动到目标笔记本的指定路径下。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      fromPaths: z.array(z.string()).describe("要移动的源文档路径数组。每个路径字符串应为 '笔记本ID/文档相对路径.sy' 或 '笔记本ID/文档相对路径' 的形式。后端会处理。例如：['box123/notes/docA.sy', 'box456/folder/docB']"),
      toNotebook: z.string().describe("目标笔记本的ID。"),
      toPath: z.string().describe("目标路径 (HPath 或实际路径均可，后端会尝试解析)。文档将被移动到此路径下。例如 '/Target Folder' 或 '/Target Folder/NewName.sy' (如果只移动一个文件且想重命名)。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        closeTimeout: z.number().optional().describe("操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).nullable().describe("成功时 Data 为 null；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/moveDocsByID",
    en: "moveDocsByID",
    zh_cn: "批量移动文档 (基于ID)",
    description: "将一组源文档（通过其ID指定）移动到目标文档（通过其ID指定）的目录下或成为其子文档（取决于目标ID是文件夹还是文件）。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      fromIDs: z.array(z.string()).describe("要移动的源文档ID数组。"),
      toID: z.string().describe("目标文档或目录的ID。如果 toID 是一个文档，则 fromIDs 中的文档会成为其子文档（如果内核逻辑支持）；如果 toID 是一个目录（通常是一个文档的HPath的父级），则 fromIDs 中的文档会被移动到该目录下。具体行为需参考内核实现细节。后台实现中，会先通过 toID 获取其 toNotebook 和 toPath，然后调用 model.MoveDocs。"),
      callback: z.string().optional().describe("回调标识，可选参数，用于事件推送。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        closeTimeout: z.number().optional().describe("操作失败时，可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).nullable().describe("成功时 Data 为 null；失败时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/moveLocalShorthands",
    en: "moveLocalShorthands",
    zh_cn: "移动本地的闪念速记",
    description: "将指定笔记本中的本地闪念速记（通常是未整理的、直接记录在本地的摘录或想法）移动到配置的闪念速记存放位置。这是一个待改进的旧接口，未来可能基于文档树配置实现。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要处理闪念速记的笔记本ID。"),
      path: z.string().optional().describe("可选的目标路径 (HPath)。此参数在当前实现中可能未完全按预期工作，接口计划改造。请参考接口描述中的 GitHub issue 链接。若提供，会尝试将速记移动到此路径下。注意路径合法性，过长或非法字符会被处理。"),
      parentID: z.string().optional().describe("可选的目标父文档ID。此参数在当前实现中可能未完全按预期工作。若提供，会尝试将速记作为此文档的子文档。")
      // 注意：后端 `model.MoveLocalShorthands` 的参数是 (notebook, hPath, parentID)。此处的 `path` 对应 `hPath`。
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据，即使实际移动了文件。失败时 Data 可能不存在。") // Go 源码中 `model.MoveLocalShorthands` 返回 `ids []string, err error`，但API层面未将ids透出。
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/refreshFiletree",
    en: "refreshFiletree",
    zh_cn: "刷新文档树并重建索引",
    description: "触发一次全局的文档树刷新和全量索引重建。这是一个耗时操作，请谨慎调用。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true, // 尽管 Go 源码 model.FullReindex() 本身不检查只读，但 router.go 中此API路由配置了 model.CheckReadonly
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功（操作已异步启动）"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口不返回具体数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/removeDoc",
    en: "removeDoc",
    zh_cn: "移除文档 (基于路径)",
    description: "根据指定的笔记本ID和文档相对路径，移除（删除）该文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("文档所在的笔记本ID。"),
      path: z.string().describe("要移除的文档的相对路径 (相对于笔记本根目录，例如 '/notes/docToRemove.sy')。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/removeDocByID",
    en: "removeDocByID",
    zh_cn: "移除文档 (基于ID)",
    description: "根据指定的文档ID，移除（删除）该文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要移除的文档的ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        closeTimeout: z.number().optional().describe("操作失败时（例如ID未找到），可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).nullable().describe("成功时 Data 为 null；ID未找到等错误时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/removeDocs",
    en: "removeDocs",
    zh_cn: "批量移除文档 (基于复合路径)",
    description: "根据一组复合路径（包含笔记本ID和文档相对路径）批量移除（删除）文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      paths: z.array(z.string()).describe("要移除的文档的复合路径数组。每个路径字符串应为 '笔记本ID/文档相对路径.sy' 或 '笔记本ID/文档相对路径' 的形式。例如：['box123/notes/docA.sy', 'box456/folder/docB']")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功（即使部分路径无效也可能返回0，具体需看Msg）"),
      Msg: z.string().describe("响应消息。如果部分文档移除失败，Msg中可能会有提示。"),
      Data: z.null().optional().describe("此接口通常不返回具体数据，或在特定错误情况下可能为null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/removeIndexes",
    en: "removeIndexes",
    zh_cn: "移除指定路径列表的索引",
    description: "根据指定的文档路径列表（通常是 .sy 文件路径），从搜索引擎中移除这些文档的索引。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      paths: z.array(z.string()).describe("需要移除索引的文档绝对路径列表。这些路径通常指向 data 目录下的 .sy 文件，例如 '/data/notebookId/path/to/doc.sy'。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功（操作已接受）"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口不返回具体数据")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/renameDoc",
    en: "renameDoc",
    zh_cn: "重命名文档 (基于路径)",
    description: "根据指定的笔记本ID、旧文档相对路径和新标题，重命名该文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("文档所在的笔记本ID。"),
      path: z.string().describe("要重命名的文档的当前相对路径 (相对于笔记本根目录，例如 '/notes/oldName.sy')。"),
      title: z.string().describe("文档的新标题 (不需要带 .sy 后缀)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口成功时不返回具体数据") // Go 源码 model.RenameDoc 返回 error，API层面成功时不设Data
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/renameDocByID",
    en: "renameDocByID",
    zh_cn: "重命名文档 (基于ID)",
    description: "根据指定的文档ID和新标题，重命名该文档。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要重命名的文档的ID。"),
      title: z.string().describe("文档的新标题 (不需要带 .sy 后缀)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.object({
        closeTimeout: z.number().optional().describe("操作失败时（例如ID未找到），可能返回此字段，建议客户端在此毫秒数后关闭相关提示。")
      }).nullable().describe("成功时 Data 通常为 null (Go源码中 model.RenameDoc 成功时返回的 error 为 nil，API层面不设Data)；ID未找到等错误时可能包含 closeTimeout。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/searchDocs",
    en: "searchDocs",
    zh_cn: "搜索文档标题和别名",
    description: "根据关键词搜索匹配的文档标题和别名。主要用于快速查找文档，不支持全文搜索。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      k: z.string().describe("搜索关键词。"),
      flashcard: z.boolean().optional().describe("是否仅在包含闪卡的文档中搜索，默认为 false (搜索所有文档)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功"),
      Msg: z.string().describe("响应消息"),
      Data: z.array(z.object({
        box: z.string().describe("文档所属的笔记本ID。"),
        path: z.string().describe("文档的实际存储路径。"),
        hPath: z.string().describe("文档的人类可读路径。"),
        id: z.string().describe("文档ID。"),
        name: z.string().describe("文档名。"),
        nameRaw: z.string().describe("文档名原文（可能包含高亮标签）。"),
        alias: z.string().optional().describe("文档别名 (如果匹配到的是别名)。"),
        aliasRaw: z.string().optional().describe("文档别名原文（可能包含高亮标签）。"),
        memo: z.string().optional().describe("文档备注。")
        // 其他 model.SearchDoc 中的字段也可能存在
      })).optional().describe("成功时返回匹配的文档信息数组；如果无匹配或出错，则数组可能为空或此字段不存在。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/filetree/upsertIndexes",
    en: "upsertIndexes",
    zh_cn: "更新或插入指定路径列表的索引",
    description: "根据指定的文档路径列表（通常是 .sy 文件路径），更新或插入这些文档在搜索引擎中的索引。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      paths: z.array(z.string()).describe("需要更新/插入索引的文档绝对路径列表。这些路径通常指向 data 目录下的 .sy 文件，例如 '/data/notebookId/path/to/doc.sy'。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("响应状态码，0 表示成功（操作已接受）"),
      Msg: z.string().describe("响应消息"),
      Data: z.null().optional().describe("此接口不返回具体数据")
    })
  }
];
