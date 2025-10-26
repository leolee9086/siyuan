export const notebookApiDefs = [
  {
    method: "POST",
    endpoint: "/api/notebook/changeSortNotebook",
    en: "changeSortNotebook",
    zh_cn: "改变笔记本排序",
    description: "批量更改笔记本的显示顺序。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebooks: z.array(z.string()).describe("按新的期望顺序排列的笔记本 ID 数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/closeNotebook",
    en: "closeNotebook",
    zh_cn: "关闭笔记本",
    description: "关闭一个指定的笔记本。关闭后，笔记本内容将不再可访问，直到再次打开。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要关闭的笔记本的唯一标识符 (ID)。"),
      callback: z.string().optional().describe("可选的回调命令ID，用于操作完成后的事件通知。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/createNotebook",
    en: "createNotebook",
    zh_cn: "创建笔记本",
    description: "创建一个新的笔记本。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      name: z.string().min(1).describe("新笔记本的名称，不能为空。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        notebook: z.object({
          id: z.string().describe("新创建的笔记本ID"),
          name: z.string().describe("新创建的笔记本名称"),
          icon: z.string().describe("笔记本图标"),
          sort: z.number().int().describe("笔记本排序值"),
          closed: z.boolean().describe("笔记本是否关闭 (刚创建时应为 false)"),
          sortMode: z.number().int().describe("文档排序模式"),
        }).describe("新创建的笔记本对象信息。"),
      }).describe("包含新创建笔记本信息的对象。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/getNotebookConf",
    en: "getNotebookConf",
    zh_cn: "获取笔记本配置",
    description: "获取指定笔记本的配置信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要获取配置的笔记本的唯一标识符 (ID)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        conf: z.object({
          name: z.string().describe("笔记本名称"),
          sort: z.number().int().describe("笔记本的排序值"),
          icon: z.string().describe("笔记本图标 (Emoji 或 Base64)"),
          closed: z.boolean().describe("笔记本是否关闭"),
          sortMode: z.number().int().describe("文档排序模式: 0(自定义拖拽), 1(修改时间升序), 2(修改时间降序), 3(创建时间升序), 4(创建时间降序), 5(字母升序), 6(字母降序), 7(HPath升序), 8(HPath降序), 11(文档包含块升序), 12(文档包含块降序), 13(子文档数升序), 14(子文档数降序)"),
          refCreateSavePath: z.string().describe("块引目标文档默认保存路径 (HPath)"),
          docCreateSavePath: z.string().describe("新文档默认保存路径 (HPath)"),
          dailyNoteSavePath: z.string().describe("日记默认保存路径 (HPath)"),
          dailyNoteTemplatePath: z.string().describe("日记模板路径 (HPath)"),
          boxStat: z.object({
            docCount: z.number().int().describe("文档数量"),
            assetCount: z.number().int().describe("资源文件数量"),
            assetSize: z.number().int().describe("资源文件总大小 (字节)"),
            refCount: z.number().int().describe("引用数量"),
            headingCount: z.number().int().describe("标题数量"),
            listCount: z.number().int().describe("列表数量"),
            listItemCount: z.number().int().describe("列表项数量"),
            codeBlockCount: z.number().int().describe("代码块数量"),
            htmlBlockCount: z.number().int().describe("HTML块数量"),
            mathBlockCount: z.number().int().describe("数学公式块数量"),
            tableCount: z.number().int().describe("表格数量"),
            quoteCount: z.number().int().describe("引述块数量"),
            superBlockCount: z.number().int().describe("超级块数量"),
            paragraphCount: z.number().int().describe("段落数量"),
            fileAnnotationCount: z.number().int().describe("文件标注数量"),
            updated: z.number().int().describe("最后更新时间 (Unix时间戳，秒)"),
          }).optional().describe("笔记本统计信息 (可能不存在，例如笔记本关闭时)")
        }).describe("笔记本的配置对象。")
      }).describe("包含笔记本配置的对象。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/getNotebookInfo",
    en: "getNotebookInfo",
    zh_cn: "获取笔记本信息",
    description: "获取指定笔记本的详细信息，包括其配置和统计数据。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要获取信息的笔记本的唯一标识符 (ID)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        boxInfo: z.object({
          id: z.string().describe("笔记本ID"),
          name: z.string().describe("笔记本名称"),
          icon: z.string().describe("笔记本图标"),
          sort: z.number().int().describe("笔记本排序值"),
          closed: z.boolean().describe("笔记本是否关闭"),
          sortMode: z.number().int().describe("文档排序模式"),
          refCreateSavePath: z.string().describe("块引默认保存路径"),
          docCreateSavePath: z.string().describe("新文档默认保存路径"),
          dailyNoteSavePath: z.string().describe("日记默认保存路径"),
          dailyNoteTemplatePath: z.string().describe("日记模板路径"),
          boxStat: z.object({
            docCount: z.number().int().describe("文档数量"),
            assetCount: z.number().int().describe("资源文件数量"),
            assetSize: z.number().int().describe("资源文件总大小 (字节)"),
            refCount: z.number().int().describe("引用数量"),
            headingCount: z.number().int().describe("标题数量"),
            listCount: z.number().int().describe("列表数量"),
            listItemCount: z.number().int().describe("列表项数量"),
            codeBlockCount: z.number().int().describe("代码块数量"),
            htmlBlockCount: z.number().int().describe("HTML块数量"),
            mathBlockCount: z.number().int().describe("数学公式块数量"),
            tableCount: z.number().int().describe("表格数量"),
            quoteCount: z.number().int().describe("引述块数量"),
            superBlockCount: z.number().int().describe("超级块数量"),
            paragraphCount: z.number().int().describe("段落数量"),
            fileAnnotationCount: z.number().int().describe("文件标注数量"),
            updated: z.number().int().describe("最后更新时间 (Unix时间戳，秒)"),
          }).describe("笔记本统计信息。")
        }).describe("笔记本的详细信息对象。")
      }).describe("包含笔记本详细信息的对象。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/lsNotebooks",
    en: "lsNotebooks",
    zh_cn: "列出所有笔记本",
    description: "获取当前工作空间中所有笔记本的列表，包含已打开和未打开的笔记本。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
        notebooks: z.array(z.object({
          id: z.string().describe("笔记本的唯一标识符 (ID)"),
          name: z.string().describe("笔记本的名称"),
          icon: z.string().describe("笔记本图标的 Base64 编码或 Emoji 字符"),
          sort: z.number().int().describe("笔记本的排序值"),
          closed: z.boolean().describe("笔记本是否已关闭"),
          sortMode: z.number().int().optional().describe("笔记本内文档的排序模式 (仅在笔记本打开时存在)"),
        })).describe("笔记本对象数组。")
      }).describe("包含笔记本列表的对象。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/openNotebook",
    en: "openNotebook",
    zh_cn: "打开笔记本",
    description: "打开一个指定的笔记本。如果笔记本已经是打开状态，此操作可能仅刷新其状态。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要打开的笔记本的唯一标识符 (ID)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.object({
      }).catchall(z.any()).nullable().describe("成功时可能返回空对象或 null，主要通过推送事件传递笔记本信息。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/removeNotebook",
    en: "removeNotebook",
    zh_cn: "删除笔记本",
    description: "删除一个指定的笔记本。此操作会从工作空间移除笔记本及其所有内容。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要删除的笔记本的唯一标识符 (ID)。"),
      callback: z.string().optional().describe("可选的回调命令ID，用于操作完成后的事件通知。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/renameNotebook",
    en: "renameNotebook",
    zh_cn: "重命名笔记本",
    description: "重命名一个指定的笔记本。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要重命名的笔记本的唯一标识符 (ID)。"),
      name: z.string().min(1).describe("笔记本的新名称，不能为空。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功, -1 表示失败 (例如名称冲突)。"),
      Msg: z.string().describe("错误信息，成功时为空字符串。"),
      Data: z.object({
        closeTimeout: z.number().int().optional().describe("如果重命名失败，可能有关闭提示框的超时时间。")
      }).catchall(z.any()).nullable().describe("成功时为 null 或空对象，失败时可能包含 closeTimeout。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/setNotebookConf",
    en: "setNotebookConf",
    zh_cn: "设置笔记本配置",
    description: "更新指定笔记本的配置信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要设置配置的笔记本的唯一标识符 (ID)。"),
      conf: z.object({
        name: z.string().optional().describe("可选。新的笔记本名称。"),
        icon: z.string().optional().describe("可选。新的笔记本图标 (Emoji 或 Base64)。"),
        sortMode: z.number().int().optional().describe("可选。新的文档排序模式。"),
        refCreateSavePath: z.string().optional().describe("可选。新的块引目标文档默认保存路径 (HPath)。"),
        docCreateSavePath: z.string().optional().describe("可选。新的新文档默认保存路径 (HPath)。"),
        dailyNoteSavePath: z.string().optional().describe("可选。新的日记默认保存路径 (HPath)。"),
        dailyNoteTemplatePath: z.string().optional().describe("可选。新的日记模板路径 (HPath)。")
      }).describe("要更新的配置项对象。只提供需要修改的字段。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/notebook/setNotebookIcon",
    en: "setNotebookIcon",
    zh_cn: "设置笔记本图标",
    description: "设置指定笔记本的显示图标。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      notebook: z.string().describe("要设置图标的笔记本的唯一标识符 (ID)。"),
      icon: z.string().describe("笔记本的新图标，可以是 Emoji 字符或图片的 Base64 编码字符串。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.null().optional().describe("成功时通常为 null。"),
    })
  }
];
