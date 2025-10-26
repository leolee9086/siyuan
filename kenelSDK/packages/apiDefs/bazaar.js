export const bazaarApiDefs = [
  {
    method: "POST",
    endpoint: "/api/bazaar/batchUpdatePackage",
    en: "batchUpdatePackage",
    zh_cn: "批量更新集市包",
    description: "根据指定的客户端类型（如 \'frontend\'）批量更新思源笔记本地缓存的集市包信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      frontend: z.string().describe("客户端类型，通常为 \'frontend\' 或 \'app\'")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("此接口通常不返回具体数据，null 表示成功")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getBazaarIcon",
    en: "getBazaarIcon",
    zh_cn: "获取集市图标包列表",
    description: "从集市获取所有可用的图标包列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("集市图标包对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含图标包列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getBazaarPackageREAME",
    en: "getBazaarPackageREAME",
    zh_cn: "获取集市包的README",
    description: "获取指定集市包（通过仓库URL、哈希和类型指定）的 README 文件内容 (HTML格式)。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      repoURL: z.string().describe("包所在的仓库 URL"),
      repoHash: z.string().describe("包在仓库中的特定提交哈希或版本标签"),
      packageType: z.string().describe("包类型 (例如 \'icons\', \'plugins\', \'themes\', \'templates\', \'widgets\')")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        html: z.string().describe("README 文件的 HTML 内容")
      }).nullable().describe("包含 README HTML 的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getBazaarPlugin",
    en: "getBazaarPlugin",
    zh_cn: "获取集市插件列表",
    description: "从集市获取所有可用的插件列表，支持按前端类型和关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      frontend: z.string().describe("客户端类型，通常为 \'frontend\' 或 \'app\'"),
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("集市插件包对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含插件列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getBazaarTemplate",
    en: "getBazaarTemplate",
    zh_cn: "获取集市模板列表",
    description: "从集市获取所有可用的模板列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("集市模板包对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含模板列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getBazaarTheme",
    en: "getBazaarTheme",
    zh_cn: "获取集市主题列表",
    description: "从集市获取所有可用的主题列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("集市主题包对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含主题列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getBazaarWidget",
    en: "getBazaarWidget",
    zh_cn: "获取集市挂件列表",
    description: "从集市获取所有可用的挂件列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("集市挂件包对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含挂件列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getInstalledIcon",
    en: "getInstalledIcon",
    zh_cn: "获取已安装的图标包列表",
    description: "获取本地已安装的图标包列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("已安装图标包对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含已安装图标包列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getInstalledPlugin",
    en: "getInstalledPlugin",
    zh_cn: "获取已安装的插件列表",
    description: "获取本地已安装的插件列表，支持按前端类型和关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      frontend: z.string().describe("客户端类型，通常为 \'frontend\' 或 \'app\'"),
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("已安装插件对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含已安装插件列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getInstalledTemplate",
    en: "getInstalledTemplate",
    zh_cn: "获取已安装的模板列表",
    description: "获取本地已安装的模板列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("已安装模板对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含已安装模板列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getInstalledTheme",
    en: "getInstalledTheme",
    zh_cn: "获取已安装的主题列表",
    description: "获取本地已安装的主题列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("已安装主题对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含已安装主题列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getInstalledWidget",
    en: "getInstalledWidget",
    zh_cn: "获取已安装的挂件列表",
    description: "获取本地已安装的挂件列表，支持关键词筛选。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      keyword: z.string().optional().describe("可选，搜索关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("已安装挂件对象数组，具体结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含已安装挂件列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/getUpdatedPackage",
    en: "getUpdatedPackage",
    zh_cn: "获取可更新的集市包",
    description: "检查并返回所有已安装且存在更新的集市包（插件、挂件、图标、主题、模板）。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      frontend: z.string().describe("客户端类型，通常为 \'frontend\' 或 \'app\'")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        plugins: z.array(z.any()).describe("可更新的插件列表，元素结构参考 `kernel.BazaarPackage`"),
        widgets: z.array(z.any()).describe("可更新的挂件列表，元素结构参考 `kernel.BazaarPackage`"),
        icons: z.array(z.any()).describe("可更新的图标包列表，元素结构参考 `kernel.BazaarPackage`"),
        themes: z.array(z.any()).describe("可更新的主题列表，元素结构参考 `kernel.BazaarPackage`"),
        templates: z.array(z.any()).describe("可更新的模板列表，元素结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含各类可更新包列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/installBazaarIcon",
    en: "installBazaarIcon",
    zh_cn: "安装集市图标包",
    description: "从集市安装指定的图标包。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      repoURL: z.string().describe("图标包所在的仓库 URL"),
      repoHash: z.string().describe("图标包在仓库中的特定提交哈希或版本标签"),
      packageName: z.string().describe("图标包的名称 (通常是仓库名)"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词，通常在安装后传递以更新UI")
    }),
    zodResponseSchema: (z) => ({ // 响应结构可能包含安装后的包列表及外观设置
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装图标包列表，元素结构参考 `kernel.BazaarPackage`"),
        appearance: z.any().describe("更新后的外观设置对象，具体结构参考 `conf.Appearance`")
      }).nullable().describe("包含更新后包列表和外观设置的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/installBazaarPlugin",
    en: "installBazaarPlugin",
    zh_cn: "安装集市插件",
    description: "从集市安装指定的插件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      repoURL: z.string().describe("插件所在的仓库 URL"),
      repoHash: z.string().describe("插件在仓库中的特定提交哈希或版本标签"),
      packageName: z.string().describe("插件的名称 (通常是仓库名)"),
      frontend: z.string().describe("客户端类型，通常为 \'frontend\' 或 \'app\'"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装插件列表，元素结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含更新后插件列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/installBazaarTemplate",
    en: "installBazaarTemplate",
    zh_cn: "安装集市模板",
    description: "从集市安装指定的模板。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      repoURL: z.string().describe("模板所在的仓库 URL"),
      repoHash: z.string().describe("模板在仓库中的特定提交哈希或版本标签"),
      packageName: z.string().describe("模板的名称 (通常是仓库名)"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装模板列表，元素结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含更新后模板列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/installBazaarTheme",
    en: "installBazaarTheme",
    zh_cn: "安装集市主题",
    description: "从集市安装指定的主题，并可指定主题模式 (mode) 和是否为更新 (update)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      repoURL: z.string().describe("主题所在的仓库 URL"),
      repoHash: z.string().describe("主题在仓库中的特定提交哈希或版本标签"),
      packageName: z.string().describe("主题的名称 (通常是仓库名)"),
      mode: z.number().describe("主题模式 (0: 亮色, 1: 暗色, 2: 根据系统)"),
      update: z.boolean().optional().describe("可选，是否为更新操作，默认为 false"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({ // 响应结构可能包含安装后的包列表及外观设置
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装主题列表，元素结构参考 `kernel.BazaarPackage`"),
        appearance: z.any().describe("更新后的外观设置对象，具体结构参考 `conf.Appearance`")
      }).nullable().describe("包含更新后包列表和外观设置的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/installBazaarWidget",
    en: "installBazaarWidget",
    zh_cn: "安装集市挂件",
    description: "从集市安装指定的挂件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      repoURL: z.string().describe("挂件所在的仓库 URL"),
      repoHash: z.string().describe("挂件在仓库中的特定提交哈希或版本标签"),
      packageName: z.string().describe("挂件的名称 (通常是仓库名)"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装挂件列表，元素结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含更新后挂件列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/uninstallBazaarIcon",
    en: "uninstallBazaarIcon",
    zh_cn: "卸载图标包",
    description: "卸载本地已安装的指定图标包。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      packageName: z.string().describe("要卸载的图标包的名称"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({ // 响应结构可能包含卸载后的包列表及外观设置
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装图标包列表，元素结构参考 `kernel.BazaarPackage`"),
        appearance: z.any().describe("更新后的外观设置对象，具体结构参考 `conf.Appearance`")
      }).nullable().describe("包含更新后包列表和外观设置的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/uninstallBazaarPlugin",
    en: "uninstallBazaarPlugin",
    zh_cn: "卸载插件",
    description: "卸载本地已安装的指定插件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      packageName: z.string().describe("要卸载的插件的名称"),
      frontend: z.string().describe("客户端类型，通常为 \'frontend\' 或 \'app\'"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装插件列表，元素结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含更新后插件列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/uninstallBazaarTemplate",
    en: "uninstallBazaarTemplate",
    zh_cn: "卸载模板",
    description: "卸载本地已安装的指定模板。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      packageName: z.string().describe("要卸载的模板的名称"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装模板列表，元素结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含更新后模板列表的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/uninstallBazaarTheme",
    en: "uninstallBazaarTheme",
    zh_cn: "卸载主题",
    description: "卸载本地已安装的指定主题。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      packageName: z.string().describe("要卸载的主题的名称"),
      mode: z.number().describe("主题模式 (0: 亮色, 1: 暗色, 2: 根据系统)，用于确定要卸载哪个模式下的主题或重置相关配置"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({ // 响应结构可能包含卸载后的包列表及外观设置
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装主题列表，元素结构参考 `kernel.BazaarPackage`"),
        appearance: z.any().describe("更新后的外观设置对象，具体结构参考 `conf.Appearance`")
      }).nullable().describe("包含更新后包列表和外观设置的对象")
    })
  },
  {
    method: "POST",
    endpoint: "/api/bazaar/uninstallBazaarWidget",
    en: "uninstallBazaarWidget",
    zh_cn: "卸载挂件",
    description: "卸载本地已安装的指定挂件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      packageName: z.string().describe("要卸载的挂件的名称"),
      keyword: z.string().optional().describe("可选，用于刷新列表的关键词")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("返回消息"),
      Data: z.object({
        packages: z.array(z.any()).describe("更新后的已安装挂件列表，元素结构参考 `kernel.BazaarPackage`")
      }).nullable().describe("包含更新后挂件列表的对象")
    })
  }
];
