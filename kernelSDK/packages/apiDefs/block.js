export const blockApiDefs = [
  {
    method: "POST",
    endpoint: "/api/block/appendBlock",
    en: "appendBlock",
    zh_cn: "插入后置子块",
    description: "在指定父块的末尾插入新的子块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      data: z.string().describe("要插入的内容，可以是 Markdown 或 DOM 字符串"),
      dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型"),
      parentID: z.string().describe("父块的 ID")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("新创建块的 ID") })).nullable().describe("成功时返回包含新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/appendDailyNoteBlock",
    en: "appendDailyNoteBlock",
    zh_cn: "追加日记块",
    description: "向指定笔记本的当日日记文档末尾追加新的内容块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      data: z.string().describe("要追加的内容，可以是 Markdown 或 DOM 字符串"),
      dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型"),
      notebook: z.string().describe("目标笔记本的 ID")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("新创建块的 ID") })).nullable().describe("成功时返回包含新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/appendHeadingChildren",
    en: "appendHeadingChildren",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/block/batchAppendBlock",
    en: "batchAppendBlock",
    zh_cn: "批量后置插入块",
    description: "在指定父块的末尾批量插入新的子块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      blocks: z.array(
        z.object({
          data: z.string().describe("要插入的内容，可以是 Markdown 或 DOM 字符串"),
          dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型"),
          parentID: z.string().describe("父块的 ID")
        })
      ).describe("包含多个待插入块信息的数组")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("新创建块的 ID") })).nullable().describe("成功时返回包含新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/batchInsertBlock",
    en: "batchInsertBlock",
    zh_cn: "批量插入块",
    description: "在指定的锚点块（anchorID）之前或之后批量插入新的内容块。每个新块可以指定其插入位置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      blocks: z.array(
        z.object({
          data: z.string().describe("要插入的内容，可以是 Markdown 或 DOM 字符串"),
          dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型"),
          parentID: z.string().optional().describe("父块的 ID (可选，如果提供 previousID 或 nextID 则父块 ID 优先)"),
          previousID: z.string().optional().describe("前一个同级块的 ID (可选，如果提供，则新块将插入在此块之后)"),
          nextID: z.string().optional().describe("后一个同级块的 ID (可选，如果提供，则新块将插入在此块之前)")
        })
      ).describe("包含多个待插入块信息的数组")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("新创建块的 ID") })).nullable().describe("成功时返回包含新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/batchPrependBlock",
    en: "batchPrependBlock",
    zh_cn: "批量前置插入块",
    description: "在指定父块的开头批量插入新的子块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      blocks: z.array(
        z.object({
          data: z.string().describe("要插入的内容，可以是 Markdown 或 DOM 字符串"),
          dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型"),
          parentID: z.string().describe("父块的 ID")
        })
      ).describe("包含多个待插入块信息的数组")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("新创建块的 ID") })).nullable().describe("成功时返回包含新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/batchUpdateBlock",
    en: "batchUpdateBlock",
    zh_cn: "批量更新块内容",
    description: "批量更新多个块的内容。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      blocks: z.array(
        z.object({
          id: z.string().describe("要更新的块 ID"),
          data: z.string().describe("新的块内容，可以是 Markdown 或 DOM 字符串"),
          dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型")
        })
      ).describe("包含多个待更新块信息的数组")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("已更新块的 ID") })).nullable().describe("成功时返回包含已更新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/checkBlockExist",
    en: "checkBlockExist",
    zh_cn: "检查块是否存在",
    description: "检查指定的块ID是否存在。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("要检查的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.boolean().describe("块是否存在")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/checkBlockFold",
    en: "checkBlockFold",
    zh_cn: "检查块是否折叠",
    description: "检查指定的块ID是否已折叠，并返回其是否为根块。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("要检查的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({
        isFolded: z.boolean().describe("块是否已折叠"),
        isRoot: z.boolean().describe("块是否为根块（通常指文档块）")
      }).describe("包含折叠状态和是否为根块的信息")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/checkBlockRef",
    en: "checkBlockRef",
    zh_cn: "检查块引用状态",
    description: "检查一批块ID的引用状态（例如，是否被其他块引用，是否定义了其他块等）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ ids: z.array(z.string()).describe("要检查的块 ID 数组") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.record(z.string().describe("块 ID"), z.object({
        defCount: z.number().describe("该块作为定义块被引用的次数"),
        refCount: z.number().describe("该块作为引用块引用其他块的次数")
      })).describe("一个记录对象，键为块 ID，值为该块的引用统计信息")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/deleteBlock",
    en: "deleteBlock",
    zh_cn: "删除块",
    description: "删除指定的块ID。此操作通过事务完成。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ id: z.string().describe("要删除的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.any()).nullable().describe("通常为 null，具体结构未在 Go 源码中明确，保持 any 以兼容") // Go: model.DeleteBlock 返回 (transaction *model.Transaction, err error)
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/foldBlock",
    en: "foldBlock",
    zh_cn: "折叠块",
    description: "折叠指定的块ID。对于标题块，执行 foldHeading 操作；对于其他类型的块，设置其 fold 属性。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ id: z.string().describe("要折叠的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.any()).nullable().describe("通常为 null，具体结构未在 Go 源码中明确，保持 any 以兼容") // Go: model.FoldBlock / model.FoldHeading 返回 (transaction *model.Transaction, err error)
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockBreadcrumb",
    en: "getBlockBreadcrumb",
    zh_cn: "获取块面包屑",
    description: "获取指定块ID到其根块（通常是文档块）的面包屑路径，可以排除特定类型的块。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("目标块的 ID"),
      excludeTypes: z.array(z.string()).optional().describe("可选，需要从面包屑中排除的块类型数组")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(
        z.object({
          id: z.string().describe("面包屑项的块 ID"),
          name: z.string().describe("面包屑项的名称（通常是块内容或标题）"),
          type: z.string().describe("面包屑项的块类型"),
          icon: z.string().optional().describe("面包屑项的图标（如果适用）")
        })
      ).describe("面包屑路径数组，从根到目标块的父块")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockDOM",
    en: "getBlockDOM",
    zh_cn: "获取块DOM",
    description: "获取指定块ID的DOM表示（HTML字符串）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("要获取 DOM 的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({
        id: z.string().describe("块 ID"),
        dom: z.string().describe("块的 DOM 内容 (HTML 字符串)"),
        isFullWidth: z.boolean().optional().describe("是否为页宽块") // kernel.GetBlockDOM 返回的结构
      }).describe("包含块 ID 和其 DOM 内容的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockDOMs",
    en: "getBlockDOMs",
    zh_cn: "批量获取块DOM",
    description: "批量获取指定块ID列表的DOM表示（HTML字符串）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      ids: z.array(z.string()).describe("要获取 DOM 的块 ID 数组")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.record(z.string().describe("块 ID"), z.string().describe("块的 DOM 内容 (HTML 字符串)"))
        .describe("一个记录对象，键为块 ID，值为该块的 DOM 内容")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockDefIDsByRefText",
    en: "getBlockDefIDsByRefText",
    zh_cn: "根据引用文本获取块定义ID",
    description: "根据引用文本（锚文本）搜索并返回其可能指向的块定义ID列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      anchor: z.string().describe("要搜索的引用锚文本"),
      excludeIDs: z.array(z.string()).optional().describe("可选，需要排除的块 ID 数组")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // kernel.GetBlockDefIDsByRefText 返回 []*model.RefDef
        refDefs: z.array(
          z.object({
            RefID: z.string().describe("引用块的ID (发起引用的块)"), // model.RefDef 结构
            DefIDs: z.array(z.string()).describe("被引用的定义块ID列表")
          })
        ).describe("引用定义对的列表")
      }).describe("包含引用定义对列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockIndex",
    en: "getBlockIndex",
    zh_cn: "获取块在父级中的位置",
    description: "获取指定块ID在其父级块的子块列表中的位置索引（从0开始）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("要获取索引的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.number().describe("块在其父块子节点中的索引位置，-1 表示未找到或出错")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockInfo",
    en: "getBlockInfo",
    zh_cn: "获取块信息",
    description: "获取指定块ID的详细信息，包括其所在的笔记本ID(box)、路径(path)、根块ID(rootID)、根块标题(rootTitle)、根块图标(rootIcon)以及其在根块下的直接子块ID(rootChildID)。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("要获取信息的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // kernel.GetBlockInfo 返回的结构
        box: z.string().describe("块所在的笔记本 ID"),
        path: z.string().describe("块在笔记本中的绝对路径"),
        rootID: z.string().describe("块所属的根文档块 ID"),
        rootTitle: z.string().describe("根文档块的标题"),
        rootChildID: z.string().describe("该块在根文档块下的一级子块ID (如果自身不是一级子块，则为空)"),
        rootIcon: z.string().describe("根文档块的图标")
      }).describe("包含块的详细路径和上下文信息的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockKramdown",
    en: "getBlockKramdown",
    zh_cn: "获取块Kramdown源码",
    description: "获取指定块ID的Kramdown源码表示。可选模式：'md'（Markdown标记符模式，默认）或 'textmark'（文本标记模式，使用span标签）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要获取 Kramdown 源码的块 ID"),
      mode: z.enum(["md", "textmark"]).optional().describe("获取模式：'md' (Markdown 标记符) 或 'textmark' (文本标记)。默认为 'md'")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // kernel.GetBlockKramdown 返回的结构
        id: z.string().describe("块 ID"),
        kramdown: z.string().describe("块的 Kramdown 源码")
      }).describe("包含块 ID 和其 Kramdown 源码的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockRelevantIDs",
    en: "getBlockRelevantIDs",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockSiblingID",
    en: "getBlockSiblingID",
    zh_cn: "获取块的同级和父级ID",
    description: "获取指定块ID的父块ID、上一个同级块ID和下一个同级块ID。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("目标块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // api.getBlockSiblingID 返回的结构
        parent: z.string().describe("父块 ID，如果目标块是根块则为空字符串"),
        previous: z.string().describe("上一个同级块 ID，如果没有则为空字符串"),
        next: z.string().describe("下一个同级块 ID，如果没有则为空字符串")
      }).describe("包含父块、上一个和下一个同级块 ID 的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlockTreeInfos",
    en: "getBlockTreeInfos",
    zh_cn: "获取多个块的树信息",
    description: "批量获取指定块ID列表对应的块树（BlockTree）信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ ids: z.array(z.string()).describe("要获取块树信息的块 ID 数组") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ // model.GetBlockTreeInfos 返回 []*BlockTreeInfo
        id: z.string().describe("块 ID"),
        box: z.string().describe("笔记本 ID"),
        path: z.string().describe("块的路径"),
        hPath: z.string().describe("块的人类可读路径"),
        name: z.string().describe("块的名称（通常是内容的前缀）"),
        alias: z.string().describe("块的别名"),
        memo: z.string().describe("块的备注"),
        tag: z.string().describe("块的标签"),
        bookmark: z.string().describe("块的书签内容"),
        type: z.string().describe("块的类型"),
        subType: z.string().describe("块的子类型"),
        depth: z.number().describe("块在树中的深度"),
        sort: z.number().describe("块的排序值"),
        created: z.string().describe("块的创建时间 (Unix 时间戳字符串)"),
        updated: z.string().describe("块的更新时间 (Unix 时间戳字符串)"),
        "f Suprema": z.string().describe("块的 F Suprema 值，用途未知"), // BlockTreeInfo 结构中的字段，保持原样
        fcontent: z.string().describe("块的 FContent 值，可能是格式化内容预览"), // BlockTreeInfo 结构中的字段
        markdown: z.string().describe("块的 Markdown 内容"), // BlockTreeInfo 结构中的字段
        length: z.number().describe("块内容的长度"), // BlockTreeInfo 结构中的字段
        refCount: z.number().describe("块的引用计数"), // BlockTreeInfo 结构中的字段
        defCount: z.number().describe("块的定义计数"), // BlockTreeInfo 结构中的字段
        refID: z.string().describe("块的引用目标 ID (如果该块是引用块)"), // BlockTreeInfo 结构中的字段
        parentID: z.string().describe("父块 ID"), // BlockTreeInfo 结构中的字段
        parent2ID: z.string().describe("祖父块 ID"), // BlockTreeInfo 结构中的字段
        rootID: z.string().describe("根块 ID (文档块 ID)"), // BlockTreeInfo 结构中的字段
        childrenCount: z.number().describe("直接子块数量"), // BlockTreeInfo 结构中的字段
        codeBlockCount: z.number().describe("代码块数量"), // BlockTreeInfo 结构中的字段
        avCount: z.number().describe("属性视图数量"), // BlockTreeInfo 结构中的字段
        docSize: z.number().describe("文档大小 (如果该块是文档块)"), // BlockTreeInfo 结构中的字段
        subFileCount: z.number().describe("子文件数量 (如果该块是文档块)"), // BlockTreeInfo 结构中的字段
        headingCount: z.number().describe("标题数量"), // BlockTreeInfo 结构中的字段
        listCount: z.number().describe("列表数量"), // BlockTreeInfo 结构中的字段
        listItemCount: z.number().describe("列表项数量"), // BlockTreeInfo 结构中的字段
        mathBlockCount: z.number().describe("数学公式块数量"), // BlockTreeInfo 结构中的字段
        htmlBlockCount: z.number().describe("HTML 块数量"), // BlockTreeInfo 结构中的字段
        tableCount: z.number().describe("表格数量"), // BlockTreeInfo 结构中的字段
        quoteCount: z.number().describe("引述块数量"), // BlockTreeInfo 结构中的字段
        superBlockCount: z.number().describe("超级块数量"), // BlockTreeInfo 结构中的字段
        paragraphCount: z.number().describe("段落数量"), // BlockTreeInfo 结构中的字段
        todoCount: z.number().describe("待办事项数量"), // BlockTreeInfo 结构中的字段
        imageCount: z.number().describe("图片数量"), // BlockTreeInfo 结构中的字段
        audioCount: z.number().describe("音频数量"), // BlockTreeInfo 结构中的字段
        videoCount: z.number().describe("视频数量"), // BlockTreeInfo 结构中的字段
        otherAssetCount: z.number().describe("其他资源数量"), // BlockTreeInfo 结构中的字段
        isBacklink: z.boolean().describe("是否为反向链接提及"), // BlockTreeInfo 结构中的字段
        isRef: z.boolean().describe("是否为引用"), // BlockTreeInfo 结构中的字段
        isDef: z.boolean().describe("是否为定义"), // BlockTreeInfo 结构中的字段
        isComment: z.boolean().describe("是否为评论"), // BlockTreeInfo 结构中的字段
        hasMemo: z.boolean().describe("是否有备注"), // BlockTreeInfo 结构中的字段
        hasTag: z.boolean().describe("是否有标签"), // BlockTreeInfo 结构中的字段
        hasBookmark: z.boolean().describe("是否有书签"), // BlockTreeInfo 结构中的字段
        hasAlias: z.boolean().describe("是否有别名"), // BlockTreeInfo 结构中的字段
        hidden: z.boolean().describe("是否隐藏"), // BlockTreeInfo 结构中的字段
        folded: z.boolean().describe("是否折叠"), // BlockTreeInfo 结构中的字段
        refText: z.string().describe("引用文本 (如果该块是引用块)"), // BlockTreeInfo 结构中的字段
        refPath: z.string().describe("引用路径 (如果该块是引用块)"), // BlockTreeInfo 结构中的字段
        refPath2: z.string().describe("引用路径2 (如果该块是引用块)"), // BlockTreeInfo 结构中的字段
        refCreate: z.string().describe("引用创建时间 (如果该块是引用块, Unix 时间戳字符串)"), // BlockTreeInfo 结构中的字段
        refUpdate: z.string().describe("引用更新时间 (如果该块是引用块, Unix 时间戳字符串)"), // BlockTreeInfo 结构中的字段
        defPath: z.string().describe("定义路径 (如果该块是定义块)"), // BlockTreeInfo 结构中的字段
        defPath2: z.string().describe("定义路径2 (如果该块是定义块)"), // BlockTreeInfo 结构中的字段
        ial: z.record(z.string(), z.string()).describe("块的 IAL 属性键值对"), // BlockTreeInfo 结构中的字段
        children: z.array(z.any()).optional().describe("子块的树信息 (递归结构，具体内容取决于请求深度，此处用 any 简化)"), // BlockTreeInfo 结构中的字段 (BlockTrees)
        attrs: z.record(z.string(), z.string()).optional().describe("块的命名属性 (Name-Value)") // BlockTreeInfo 结构中的字段
      })).describe("一个包含多个块树信息的数组，每个对象代表一个块及其详细信息和可能的子节点")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlocksIndexes",
    en: "getBlocksIndexes",
    zh_cn: "批量获取块在父级中的位置",
    description: "批量获取指定块ID列表各自在其父级块的子块列表中的位置索引。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ ids: z.array(z.string()).describe("要获取索引的块 ID 数组") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.record(z.string().describe("块 ID"), z.number().describe("块在其父块子节点中的索引位置，-1 表示未找到或出错"))
        .describe("一个记录对象，键为块 ID，值为该块在其父块中的索引")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getBlocksWordCount",
    en: "getBlocksWordCount",
    zh_cn: "获取多块字数统计",
    description: "获取指定块ID列表的总字数、字符数和链接数统计信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      ids: z.array(z.string()).describe("要统计字数的块 ID 数组"),
      reqId: z.string().optional().describe("可选的请求 ID，用于异步跟踪")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({
        reqId: z.string().optional().describe("如果请求中提供了 reqId，则在此返回"),
        stat: z.object({ // kernel.CountBlocks 返回的结构
          wordCount: z.number().describe("总字数"),
          charCount: z.number().describe("总字符数"),
          linkCount: z.number().describe("总链接数")
        }).describe("字数统计结果")
      }).describe("包含字数统计结果和可选请求 ID 的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getChildBlocks",
    en: "getChildBlocks",
    zh_cn: "获取子块基本信息",
    description: "获取指定块ID的所有直接子块的基本信息列表（仅包含ID和类型）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("父块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(
        z.object({ // kernel.GetChildBlocks 返回 []*Block
          id: z.string().describe("子块的 ID"),
          type: z.string().describe("子块的类型")
          // 注意：Go 源码中的 model.Block 结构非常庞大，这里只取了 ID 和 Type，因为 API 文档暗示只返回基本信息
        })
      ).describe("直接子块的基本信息数组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getContentWordCount",
    en: "getContentWordCount",
    zh_cn: "获取内容字数统计",
    description: "获取给定内容字符串的字数、字符数和链接数统计信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      content: z.string().describe("要统计字数的文本内容"),
      reqId: z.string().optional().describe("可选的请求 ID，用于异步跟踪")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({
        reqId: z.string().optional().describe("如果请求中提供了 reqId，则在此返回"),
        stat: z.object({ // kernel.CountContent 返回的结构
          wordCount: z.number().describe("总字数"),
          charCount: z.number().describe("总字符数"),
          linkCount: z.number().describe("总链接数")
        }).describe("字数统计结果")
      }).describe("包含字数统计结果和可选请求 ID 的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getDOMText",
    en: "getDOMText",
    zh_cn: "获取DOM中的纯文本内容",
    description: "提取给定DOM字符串中的纯文本内容。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ dom: z.string().describe("包含 HTML 标签的 DOM 字符串") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.string().describe("从 DOM 中提取的纯文本内容")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getDocInfo",
    en: "getDocInfo",
    zh_cn: "获取文档信息",
    description: "获取指定文档块ID的信息，包括其内容（DOM）、标题、图标、面包屑路径和是否为模板。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("目标文档块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // kernel.GetDocInfo 返回的结构
        id: z.string().describe("文档块 ID"),
        box: z.string().describe("笔记本 ID"),
        path: z.string().describe("文档的存储路径"),
        dom: z.string().describe("文档内容的 DOM (HTML 字符串)"),
        title: z.string().describe("文档标题"),
        icon: z.string().describe("文档图标的 Base64 编码或 Emoji"),
        iconURL: z.string().describe("文档图标的 URL"),
        breadcrumb: z.string().describe("文档的面包屑路径 (HTML 字符串)"),
        isTemplate: z.boolean().describe("该文档是否为模板"),
        updated: z.string().describe("文档更新时间 (yyyyMMddHHmmss格式)")
      }).describe("包含文档详细信息的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getDocsInfo",
    en: "getDocsInfo",
    zh_cn: "批量获取多个文档信息",
    description: "批量获取多个指定文档块ID的信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ ids: z.array(z.string()).describe("包含多个文档块 ID 的数组") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ // kernel.GetDocsInfo 返回 []*DocInfo
        id: z.string().describe("文档块 ID"),
        box: z.string().describe("笔记本 ID"),
        path: z.string().describe("文档的存储路径"),
        title: z.string().describe("文档标题"),
        icon: z.string().describe("文档图标的 Base64 编码或 Emoji"),
        iconURL: z.string().describe("文档图标的 URL"),
        isTemplate: z.boolean().describe("该文档是否为模板"),
        updated: z.string().describe("文档更新时间 (yyyyMMddHHmmss格式)")
      })).describe("包含多个文档详细信息的数组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getHeadingChildrenDOM",
    en: "getHeadingChildrenDOM",
    zh_cn: "获取标题块下所有子孙块的DOM",
    description: "获取指定标题块ID下的所有子孙块的DOM内容。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("目标标题块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.string().describe("标题块下所有子孙块合并的 DOM (HTML 字符串)")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getHeadingChildrenIDs",
    en: "getHeadingChildrenIDs",
    zh_cn: "获取标题块下所有子孙块的ID",
    description: "获取指定标题块ID下的所有子孙块的ID列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("目标标题块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.string()).describe("标题块下所有子孙块的 ID 数组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getHeadingDeleteTransaction",
    en: "getHeadingDeleteTransaction",
    zh_cn: "获取删除标题块的事务",
    description: "获取删除指定标题块（及其所有子孙块）所需的事务操作列表。此接口仅返回事务，不实际执行删除。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("要获取删除事务的标题块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // model.Transaction 结构
        doOperations: z.array(z.object({ // model.Operation 结构
          action: z.string().describe("操作类型 (例如: delete, update, insert等)"),
          id: z.string().optional().describe("操作的块 ID"),
          data: z.string().optional().describe("操作相关数据 (例如 Markdown, DOM)"),
          parentID: z.string().optional().describe("父块 ID (用于插入等操作)"),
          previousID: z.string().optional().describe("前一个同级块 ID (用于插入等操作)"),
          dataType: z.string().optional().describe("数据类型 (markdown, dom)")
        })).describe("正向操作列表")
        // undoOperations 理论上也应该有，但此API的Go源码中只填充了doOperations
      }).describe("包含删除操作的事务对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getHeadingInsertTransaction",
    en: "getHeadingInsertTransaction",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/block/getHeadingLevelTransaction",
    en: "getHeadingLevelTransaction",
    zh_cn: "获取调整标题级别的事务",
    description: "获取调整指定标题块级别所需的事务操作列表。此接口仅返回事务，不实际执行调整。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要调整级别的标题块 ID"),
      level: z.number().int().min(1).max(6).describe("新的标题级别 (1-6)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // model.Transaction 结构
        doOperations: z.array(z.object({ // model.Operation 结构
          action: z.string().describe("操作类型 (例如: updateial)"),
          id: z.string().describe("操作的块 ID"),
          data: z.string().optional().describe("操作相关数据 (通常是 IAL 字符串)")
        })).describe("正向操作列表")
      }).describe("包含调整级别操作的事务对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getRecentUpdatedBlocks",
    en: "getRecentUpdatedBlocks",
    zh_cn: "获取最近更新的块列表",
    description: "获取最近更新的块列表，按更新时间倒序排列。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ // 对应 model.Block.Upgrade() 返回的结构子集
        id: z.string().describe("块 ID"),
        box: z.string().describe("笔记本 ID"),
        path: z.string().describe("块所在文档的路径"),
        hPath: z.string().describe("块所在文档的人类可读路径"),
        name: z.string().describe("块的名称/内容预览"),
        bookmark: z.string().describe("块的书签内容"),
        memo: z.string().describe("块的备注内容"),
        alias: z.string().describe("块的别名"),
        type: z.string().describe("块类型"),
        updated: z.string().describe("块更新时间 (yyyyMMddHHmmss 格式)")
      })).describe("最近更新的块信息数组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getRefIDs",
    en: "getRefIDs",
    zh_cn: "获取块引用的所有定义块ID",
    description: "获取指定块ID所引用的所有定义块的ID列表。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("发起引用的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.string()).describe("该块引用的所有定义块的 ID 数组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getRefIDsByFileAnnotationID",
    en: "getRefIDsByFileAnnotationID",
    zh_cn: "通过文件注解ID获取相关的引用ID和定义ID",
    description: "根据文件注解块的ID，查找与该注解相关的引用块ID和定义块ID。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("文件注解块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({
        refID: z.string().describe("相关的引用块 ID"),
        defID: z.string().describe("相关的定义块 ID")
      }).describe("包含相关引用ID和定义ID的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getRefText",
    en: "getRefText",
    zh_cn: "获取引用块的锚文本",
    description: "获取指定引用块ID的锚文本内容。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("引用块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.string().describe("引用块的锚文本")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getTailChildBlocks",
    en: "getTailChildBlocks",
    zh_cn: "获取块的尾部若干子块",
    description: "获取指定块ID的尾部（最后）指定数量的直接子块的基本信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("父块的 ID"),
      size: z.number().int().positive().describe("要获取的尾部子块数量")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ // 与 getChildBlocks 结构类似
        id: z.string().describe("子块的 ID"),
        type: z.string().describe("子块的类型")
      })).describe("尾部子块的基本信息数组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getTreeStat",
    en: "getTreeStat",
    zh_cn: "获取块树统计信息",
    description: "获取指定块ID（通常是文档块）的树结构统计信息，如各种类型子块的数量等。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("目标块的 ID，通常为文档块") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.object({ // kernel.GetTreeStat 返回的结构
        id: z.string().describe("块 ID"),
        box: z.string().describe("笔记本 ID"),
        path: z.string().describe("块路径"),
        refCount: z.number().describe("引用数量"),
        defCount: z.number().describe("定义数量"),
        childrenCount: z.number().describe("直接子块数量"),
        codeBlockCount: z.number().describe("代码块数量"),
        avCount: z.number().describe("属性视图数量"),
        docSize: z.number().describe("文档大小 (字节)"),
        subFileCount: z.number().describe("子文件数量 (文档内文档)"),
        headingCount: z.number().describe("标题块数量"),
        listCount: z.number().describe("列表块数量"),
        listItemCount: z.number().describe("列表项数量"),
        mathBlockCount: z.number().describe("数学公式块数量"),
        htmlBlockCount: z.number().describe("HTML块数量"),
        tableCount: z.number().describe("表格块数量"),
        quoteCount: z.number().describe("引述块数量"),
        superBlockCount: z.number().describe("超级块数量"),
        paragraphCount: z.number().describe("段落数量"),
        todoCount: z.number().describe("待办事项数量 (已完成或未完成)"),
        imageCount: z.number().describe("图片资源数量"),
        audioCount: z.number().describe("音频资源数量"),
        videoCount: z.number().describe("视频资源数量"),
        otherAssetCount: z.number().describe("其他资源数量")
      }).describe("块树的统计信息对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/getUnfoldedParentID",
    en: "getUnfoldedParentID",
    zh_cn: "获取块的最近展开的父块ID",
    description: "向上查找指定块ID的父块链，返回最近的一个已展开（未折叠）的父块ID。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({ id: z.string().describe("起始块的 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.string().describe("最近的已展开父块的 ID，如果无此类父块或出错则为空字符串")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/insertBlock",
    en: "insertBlock",
    zh_cn: "插入块",
    description: "在指定的锚点块（anchorID）之前或之后插入新的内容块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      anchorID: z.string().describe("锚点块的 ID"),
      data: z.string().describe("要插入的内容，可以是 Markdown 或 DOM 字符串"),
      dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型"),
      isBefore: z.boolean().describe("是否在锚点块之前插入 (true: 之前, false: 之后)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("新创建块的 ID") })).nullable().describe("成功时返回包含新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/moveBlock",
    en: "moveBlock",
    zh_cn: "移动块",
    description: "将指定的块移动到新的父块下或同级块的特定位置。移动后会触发相关文档编辑器的重载。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要移动的块的 ID。"),
      parentID: z.string().optional().describe("新的父块 ID。如果提供了 previousID，则此字段可选。如果两者都未提供或均为空，则行为未定义或可能出错。不能是文档块ID。 "),
      previousID: z.string().optional().describe("新的前一个同级块的 ID。如果提供此字段，块将被移动到该同级块之后。如果未提供，将尝试基于 parentID 移动到父块的末尾（若 parentID 有效）。不能是文档块ID。 ")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.null().describe("此接口成功时不返回具体数据，UI 通常通过 WebSocket 消息更新。")
      // Go 源码中 moveBlock 函数没有显式设置 ret.Data，但调用了 model.PerformTransactions 和 model.ReloadProtyle
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/moveOutlineHeading",
    en: "moveOutlineHeading",
    zh_cn: "移动大纲标题块",
    description: "移动大纲中的标题块到新的父级或同级位置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要移动的大纲标题块的 ID。"),
      parentID: z.string().optional().describe("新的父块 ID (可以是文档块或其他标题块)。如果提供了 previousID，则此字段可选。 "),
      previousID: z.string().optional().describe("新的前一个同级标题块的 ID。如果提供此字段，标题块将被移动到该同级块之后。 ")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.any()).nullable().describe("操作成功时返回事务列表，失败时可能为 null。具体结构请参考 Transaction 对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/prependBlock",
    en: "prependBlock",
    zh_cn: "插入前置子块",
    description: "在指定父块的开头插入新的子块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      data: z.string().describe("要插入的内容，可以是 Markdown 或 DOM 字符串"),
      dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型"),
      parentID: z.string().describe("父块的 ID")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("新创建块的 ID") })).nullable().describe("成功时返回包含新块 ID 的数组，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/prependDailyNoteBlock",
    en: "prependDailyNoteBlock",
    zh_cn: "前置追加日记块",
    description: "在指定笔记本的当日日记文档开头追加新的内容块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      data: z.string().describe("要追加的内容，可以是 Markdown 或 DOM 字符串。如果 dataType 为 'markdown'，内容会先转换为 DOM。注意：后端实现中此接口行为类似 appendDailyNoteBlock，均在末尾追加，但定义保留 prepend 以匹配接口名和潜在的未来行为调整。建议使用 appendDailyNoteBlock 以获得明确的末尾追加行为。后端 action 为 prependInsert。 "),
      dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型 ('markdown' 或 'dom')。 "),
      notebook: z.string().describe("目标笔记本的 ID。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.any()).nullable().describe("操作成功时返回事务列表，失败时可能为 null。具体结构请参考 Transaction 对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/setBlockReminder",
    en: "setBlockReminder",
    zh_cn: "设置块提醒时间",
    description: "为指定的块ID设置一个提醒时间。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要设置提醒的块 ID"),
      timed: z.string().regex(/^\d{14}$/).describe("提醒时间，格式为 yyyyMMddHHmmss (例如: 20230815103000)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.null().describe("成功时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/swapBlockRef",
    en: "swapBlockRef",
    zh_cn: "交换引用块和定义块",
    description: "交换指定的引用块和其指向的定义块的角色。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      refID: z.string().describe("原引用块的 ID"),
      defID: z.string().describe("原定义块的 ID"),
      includeChildren: z.boolean().describe("是否包含子块进行交换 (通常用于嵌入块)")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.null().describe("成功时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/transferBlockRef",
    en: "transferBlockRef",
    zh_cn: "转移块引用关系",
    description: "将原块（fromID）的所有引用关系（或指定的引用关系 refIDs）转移到目标块（toID）。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      fromID: z.string().describe("原块的 ID，其引用关系将被转移"),
      toID: z.string().describe("目标块的 ID，将接收引用关系"),
      refIDs: z.array(z.string()).optional().describe("可选，如果提供，则只转移这些指定的引用块ID；否则转移 fromID 的所有引用块"),
      reloadUI: z.boolean().optional().default(true).describe("操作完成后是否重新加载UI，默认为 true")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.null().describe("成功时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/unfoldBlock",
    en: "unfoldBlock",
    zh_cn: "展开块",
    description: "展开指定的块ID。对于标题块，执行 unfoldHeading 操作；对于其他类型的块，设置其 fold 属性为 false。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({ id: z.string().describe("要展开的块 ID") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.any()).nullable().describe("通常为 null，具体结构未在 Go 源码中明确，保持 any 以兼容") // Go: model.UnfoldBlock / model.UnfoldHeading 返回 (transaction *model.Transaction, err error)
    })
  },
  {
    method: "POST",
    endpoint: "/api/block/updateBlock",
    en: "updateBlock",
    zh_cn: "更新块内容",
    description: "更新指定块ID的内容。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要更新的块 ID"),
      data: z.string().describe("新的块内容，可以是 Markdown 或 DOM 字符串"),
      dataType: z.enum(["markdown", "dom"]).describe("指定 data 参数的类型")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功"),
      Msg: z.string().describe("API 调用返回消息"),
      Data: z.array(z.object({ id: z.string().describe("已更新块的 ID") })).nullable().describe("成功时返回包含已更新块 ID 的数组，失败时为 null")
    })
  }
];
