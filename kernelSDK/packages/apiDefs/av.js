export const avApiDefs = [
  {
    method: "POST",
    endpoint: "/api/av/addAttributeViewBlocks",
    en: "addAttributeViewBlocks",
    zh_cn: "添加属性视图块",
    description: "向指定的属性视图中添加一个或多个数据块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      blockID: z.string().optional().describe("可选，新块将插入到此块 ID 之后"),
      previousID: z.string().optional().describe("可选，新块将插入到此块 ID 之前，如果 blockID 也提供，则此参数优先"),
      ignoreFillFilter: z.boolean().optional().describe("可选，是否忽略填充过滤器，默认为 false"),
      srcs: z.array(z.record(z.any())).describe("要添加的源数据块信息数组，具体结构取决于源类型")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/addAttributeViewKey",
    en: "addAttributeViewKey",
    zh_cn: "添加属性视图列",
    description: "向指定的属性视图添加一个新的列定义。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      keyID: z.string().describe("新列的 ID，如果为空则自动生成"),
      keyName: z.string().describe("新列的名称"),
      keyType: z.string().describe("新列的类型 (e.g., 'text', 'number', 'select')"),
      keyIcon: z.string().describe("新列的图标 (Emoji 或思源图标名)"),
      previousKeyID: z.string().describe("新列将插入到此列 ID 之前")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/appendAttributeViewDetachedBlocksWithValues",
    en: "appendAttributeViewDetachedBlocksWithValues",
    zh_cn: "追加独立的属性视图块（带值）",
    description: "向属性视图追加多个新的独立块，并为这些块设置初始值。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      blocksValues: z.array(z.array(z.any())).describe("二维数组，外层数组代表多个新块，内层数组代表每个块对应各列的初始值")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("返回新创建的块的 ID 列表或其他相关信息，具体结构依赖后端实现")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/batchReplaceAttributeViewBlocks",
    en: "batchReplaceAttributeViewBlocks",
    zh_cn: "批量替换属性视图块",
    description: "批量替换属性视图中的现有块ID。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      isDetached: z.boolean().describe("是否处理独立的（未附加的）属性视图块"),
      oldNew: z.array(
        z.record(z.string(), z.string()).describe("一个键值对对象，键为旧块 ID，值为新块 ID")
      ).describe("包含旧块 ID 和新块 ID 映射关系的数组，例如：[{'oldID1': 'newID1'}, {'oldID2': 'newID2'}]"),
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.null().optional().describe("成功时通常为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/batchSetAttributeViewBlockAttrs",
    en: "batchSetAttributeViewBlockAttrs",
    zh_cn: "批量设置属性视图块单元格值",
    description: "批量更新属性视图中多个单元格（行和列）的值。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      values: z.array(
        z.object({
          blockID: z.string().describe("数据块的 ID"),
          keyID: z.string().describe("列的 ID (Key ID)"),
          value: z.any().describe("要设置的新值，具体类型取决于列的类型"),
        })
      ).describe("包含多个要更新单元格信息的数组，每个对象包含 blockID, keyID 和 value"),
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.null().optional().describe("成功时通常为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/changeAttrViewLayout",
    en: "changeAttrViewLayout",
    zh_cn: "改变属性视图布局",
    description: "改变指定属性视图的显示布局类型（如表格、看板、日历等）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      blockID: z.string().describe("属性视图块的 ID"),
      avID: z.string().describe("属性视图的 ID"),
      layoutType: z.enum(["table", "board", "calendar", "list", "gallery"]).describe("新的布局类型：table, board, calendar, list, gallery"),
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        name: z.string().describe("属性视图的名称"),
        id: z.string().describe("属性视图的 ID"),
        viewType: z.any().describe("当前视图的类型 (具体类型需查阅 kernel.AVViewType)"),
        viewID: z.any().describe("当前视图的 ID (具体类型需查阅 kernel.AVViewID)"),
        views: z.array(z.any()).describe("属性视图包含的所有视图定义数组，元素结构参考 `kernel.AVView`"),
        view: z.any().describe("当前渲染的视图的详细数据，结构复杂，取决于视图类型"),
        isMirror: z.boolean().describe("是否为镜像属性视图")
      }).nullable().describe("包含渲染结果的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/duplicateAttributeViewBlock",
    en: "duplicateAttributeViewBlock",
    zh_cn: "复制属性视图块",
    description: "复制一个属性视图块（数据库块）。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("要复制的属性视图块的 ID")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        avID: z.string().describe("新复制的属性视图的 ID"),
        blockID: z.string().describe("新复制的属性视图块的 ID")
      }).nullable().describe("成功时返回新属性视图和块的ID")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeView",
    en: "getAttributeView",
    zh_cn: "获取属性视图",
    description: "获取指定ID的属性视图的详细信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("属性视图的 ID")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        av: z.any().describe("属性视图对象的详细信息，具体结构复杂，参考前端实际使用或Go源码 `kernel.AttributeView`")
      }).nullable().describe("包含属性视图详细信息的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewAddingBlockDefaultValues",
    en: "getAttributeViewAddingBlockDefaultValues",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewBoundBlockIDsByItemIDs",
    en: "getAttributeViewBoundBlockIDsByItemIDs",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewFilterSort",
    en: "getAttributeViewFilterSort",
    zh_cn: "获取属性视图的筛选和排序规则",
    description: "获取指定属性视图（或其关联块）的筛选条件和排序规则。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("属性视图的 ID"),
      blockID: z.string().describe("属性视图关联的块 ID (通常与属性视图ID相同)")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        filters: z.array(z.any()).describe("筛选条件对象数组，具体结构参考 `kernel.AVFilter`"),
        sorts: z.array(z.any()).describe("排序规则对象数组，具体结构参考 `kernel.AVSort`")
      }).nullable().describe("包含筛选和排序规则的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewItemIDsByBoundIDs",
    en: "getAttributeViewItemIDsByBoundIDs",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewKeys",
    en: "getAttributeViewKeys",
    zh_cn: "获取属性视图的列定义",
    description: "获取指定属性视图ID的所有列定义 (keys)。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("属性视图的 ID")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.array(z.any()).nullable().describe("属性视图的列定义对象数组，具体结构参考 `kernel.AVKey`")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewKeysByAvID",
    en: "getAttributeViewKeysByAvID",
    zh_cn: "通过属性视图ID获取列定义",
    description: "通过属性视图ID获取其所有列定义 (keys)。(此接口功能上可能与 getAttributeViewKeys 重复，需确认)",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.array(z.any()).nullable().describe("属性视图的列定义对象数组，具体结构参考 `kernel.AVKey`")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewKeysByID",
    en: "getAttributeViewKeysByID",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/av/getAttributeViewPrimaryKeyValues",
    en: "getAttributeViewPrimaryKeyValues",
    zh_cn: "获取属性视图主键列的值",
    description: "获取指定属性视图的主键列的值，支持分页和关键词搜索。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("属性视图的 ID"),
      keyword: z.string().optional().describe("可选，搜索关键词"),
      page: z.number().optional().describe("可选，页码，从 1 开始"),
      pageSize: z.number().optional().describe("可选，每页数量")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        name: z.string().describe("主键列的名称"),
        blockIDs: z.array(z.string()).describe("匹配的主键值对应的块 ID 列表"),
        rows: z.array(z.any()).describe("匹配的行数据数组，具体结构可能包含主键值和其他相关信息")
      }).nullable().describe("包含主键列值和相关信息的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/getCurrentAttrViewImages",
    en: "getCurrentAttrViewImages",
    zh_cn: "获取当前属性视图的图片",
    description: "获取当前属性视图中包含的所有图片资源。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("属性视图的 ID"),
      viewID: z.string().optional().describe("可选，当前视图的 ID"),
      query: z.string().optional().describe("可选，查询关键词"),
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.array(z.string()).describe("当前属性视图中图片 URL 数组"), // Go 源码中 `images` 变量直接赋值给 `ret.Data`，类型推测为 `[]string` 或 `[]interface{}`。暂定为 string 数组。
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/getMirrorDatabaseBlocks",
    en: "getMirrorDatabaseBlocks",
    zh_cn: "获取镜像数据库块",
    description: "获取指定属性视图ID的镜像数据库块ID列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        refDefs: z.array(z.object({
          RefID: z.string().describe("引用的块ID (通常是属性视图本身)"),
          DefIDs: z.array(z.string()).describe("被引用的定义块ID列表 (镜像块)")
        })).describe("引用定义对象数组")
      }).nullable().describe("包含镜像数据库块引用信息的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/removeAttributeViewBlocks",
    en: "removeAttributeViewBlocks",
    zh_cn: "移除属性视图块",
    description: "从指定的属性视图中移除一个或多个数据块。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      srcIDs: z.array(z.string()).describe("要移除的源数据块的 ID 数组")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/removeAttributeViewKey",
    en: "removeAttributeViewKey",
    zh_cn: "移除属性视图列",
    description: "从指定的属性视图移除一个列定义。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      keyID: z.string().describe("要移除的列的 ID"),
      removeRelationDest: z.boolean().optional().describe("可选，如果是关联列，是否同时移除关联目标，默认为 false")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/renderAttributeView",
    en: "renderAttributeView",
    zh_cn: "渲染属性视图",
    description: "渲染属性视图，获取其名称、视图类型、视图ID、所有视图、当前视图详情以及是否为镜像等信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("属性视图的 ID"),
      viewID: z.string().optional().describe("可选，要渲染的特定视图的 ID"),
      query: z.string().optional().describe("可选，查询关键词或条件"),
      page: z.number().optional().describe("可选，页码，从 1 开始"),
      pageSize: z.number().optional().describe("可选，每页数量")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        name: z.string().describe("属性视图的名称"),
        id: z.string().describe("属性视图的 ID"),
        viewType: z.any().describe("当前视图的类型 (具体类型需查阅 kernel.AVViewType)"),
        viewID: z.any().describe("当前视图的 ID (具体类型需查阅 kernel.AVViewID)"),
        views: z.array(z.any()).describe("属性视图包含的所有视图定义数组，元素结构参考 `kernel.AVView`"),
        view: z.any().describe("当前渲染的视图的详细数据，结构复杂，取决于视图类型"),
        isMirror: z.boolean().describe("是否为镜像属性视图")
      }).nullable().describe("包含渲染结果的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/renderHistoryAttributeView",
    en: "renderHistoryAttributeView",
    zh_cn: "渲染历史版本属性视图",
    description: "渲染指定历史版本的属性视图。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      id: z.string().describe("属性视图的 ID"),
      created: z.string().describe("历史版本创建的时间戳字符串 (毫秒级)")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        name: z.string().describe("属性视图的名称"),
        id: z.string().describe("属性视图的 ID"),
        viewType: z.any().describe("视图的类型"),
        viewID: z.any().describe("视图的 ID"),
        views: z.array(z.any()).describe("所有视图定义数组"),
        view: z.any().describe("当前渲染的视图的详细数据"),
        isMirror: z.boolean().describe("是否为镜像")
      }).nullable().describe("包含历史版本渲染结果的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/renderSnapshotAttributeView",
    en: "renderSnapshotAttributeView",
    zh_cn: "渲染快照属性视图",
    description: "渲染指定快照索引的属性视图。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      snapshot: z.string().describe("快照的路径或标识"),
      id: z.string().describe("属性视图的 ID")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        name: z.string().describe("属性视图的名称"),
        id: z.string().describe("属性视图的 ID"),
        viewType: z.any().describe("视图的类型"),
        viewID: z.any().describe("视图的 ID"),
        views: z.array(z.any()).describe("所有视图定义数组"),
        view: z.any().describe("当前渲染的视图的详细数据"),
        isMirror: z.boolean().describe("是否为镜像")
      }).nullable().describe("包含快照渲染结果的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/searchAttributeView",
    en: "searchAttributeView",
    zh_cn: "搜索属性视图",
    description: "根据关键词搜索属性视图，可排除指定ID。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      keyword: z.string().describe("搜索关键词"),
      excludes: z.array(z.string()).optional().describe("可选，要排除的属性视图 ID 数组")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        results: z.array(z.any()).describe("搜索结果对象数组，每个对象包含属性视图的基本信息 (如 id, name)")
      }).nullable().describe("包含搜索结果的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/searchAttributeViewNonRelationKey",
    en: "searchAttributeViewNonRelationKey",
    zh_cn: "搜索属性视图的非关联列",
    description: "根据关键词搜索指定属性视图的非关联列 (Non-relation Key)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      keyword: z.string().describe("搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        keys: z.array(z.any()).describe("匹配的非关联列定义对象数组，结构参考 `kernel.AVKey`")
      }).nullable().describe("包含搜索到的非关联列的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/searchAttributeViewRelationKey",
    en: "searchAttributeViewRelationKey",
    zh_cn: "搜索属性视图的关联列",
    description: "根据关键词搜索指定属性视图的关联列 (Relation Key)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      keyword: z.string().describe("搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        keys: z.array(z.any()).describe("匹配的关联列定义对象数组，结构参考 `kernel.AVKey`")
      }).nullable().describe("包含搜索到的关联列的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/searchAttributeViewRollupDestKeys",
    en: "searchAttributeViewRollupDestKeys",
    zh_cn: undefined,
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({})
  },
  {
    method: "POST",
    endpoint: "/api/av/setAttrViewGroup",
    en: "setAttrViewGroup",
    zh_cn: "设置属性视图分组",
    description: "设置属性视图的块分组规则。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      blockID: z.string().describe("属性视图关联的块 ID"),
      group: z.any().describe("分组配置对象，具体结构请参考 Go 源码 `av.ViewGroup`"),
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.null().optional().describe("成功时通常为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/setAttributeViewBlockAttr",
    en: "setAttributeViewBlockAttr",
    zh_cn: "设置属性视图块的单元格属性值",
    description: "更新属性视图中指定行（块ID）、指定列（KeyID）的单元格的值。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      keyID: z.string().describe("列的 ID (Key ID)"),
      rowID: z.string().describe("行的 ID (通常是数据块的 ID)"),
      value: z.any().describe("要设置的新值，具体类型取决于列的类型")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.object({
        value: z.any().describe("成功设置后的值，可能经过转换或处理")
      }).nullable().describe("包含更新后值的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/setDatabaseBlockView",
    en: "setDatabaseBlockView",
    zh_cn: "设置数据库块的默认视图",
    description: "设置指定数据库块（属性视图块）的默认视图ID。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("数据库块（属性视图块）的 ID"),
      viewID: z.string().describe("要设置为默认视图的视图 ID")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/sortAttributeViewKey",
    en: "sortAttributeViewKey",
    zh_cn: "排序属性视图列",
    description: "对属性视图的列进行排序。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      keyID: z.string().describe("要移动的列的 ID"),
      previousKeyID: z.string().describe("目标位置：将列移动到此列 ID 之前")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/av/sortAttributeViewViewKey",
    en: "sortAttributeViewViewKey",
    zh_cn: "排序属性视图中特定视图的列",
    description: "对属性视图中某个特定视图（如图表、看板等）的列进行排序。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      avID: z.string().describe("属性视图的 ID"),
      viewID: z.string().describe("特定视图的 ID"),
      keyID: z.string().describe("要移动的列的 ID"),
      previousKeyID: z.string().describe("目标位置：将列移动到此列 ID 之前")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("返回码，0 表示成功"),
      msg: z.string().describe("返回消息"),
      data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  }
];
