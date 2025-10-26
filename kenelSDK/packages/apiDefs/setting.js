export const settingApiDefs = [
  {
    method: "POST",
    endpoint: "/api/setting/addVirtualBlockRefExclude",
    en: "addVirtualBlockRefExclude",
    zh_cn: "添加虚拟引用排除关键字",
    description: "将指定的关键字列表添加到虚拟块引用的全局排除列表中。这些关键字将不会用于生成虚拟引用。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      keywords: z.array(z.string()).describe("要添加到排除列表的关键字数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/addVirtualBlockRefInclude",
    en: "addVirtualBlockRefInclude",
    zh_cn: "添加虚拟引用包含关键字",
    description: "将指定的关键字列表添加到虚拟块引用的全局包含列表中。只有这些关键字才可能用于生成虚拟引用（如果全局虚拟引用开关已打开）。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      keywords: z.array(z.string()).describe("要添加到包含列表的关键字数组。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/getCloudUser",
    en: "getCloudUser",
    zh_cn: "获取云端用户信息",
    description: "刷新并获取当前登录的思源云端账户信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      token: z.string().optional().describe("可选的访问令牌，用于刷新用户信息。如果未提供，则尝试使用现有会话。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        userId: z.string().describe("用户ID。"),
        userName: z.string().describe("用户名。"),
        userAvatarURL: z.string().describe("用户头像URL。"),
        userHomeBImgURL: z.string().describe("用户主页背景图URL。"),
        userTitles: z.array(z.object({
            name: z.string().describe("称号名称。"),
            icon: z.string().describe("称号图标URL。"),
            url: z.string().describe("称号链接URL。")
        })).describe("用户获得的称号列表。"),
        userIntro: z.string().describe("用户简介。"),
        userNickname: z.string().describe("用户昵称。"),
        userCreateTime: z.string().describe("用户账户创建时间。"),
        userSiYuanProExpireTime: z.number().describe("思源笔记专业版到期时间戳 (毫秒)。"),
        userToken: z.string().describe("用户访问令牌。"),
        userTokenExpireTime: z.string().describe("用户访问令牌到期时间。"),
        userSiYuanRepoSize: z.number().describe("思源笔记云端仓库已用空间大小 (字节)。"),
        userSiYuanPointExchangeRepoSize: z.number().describe("通过积分兑换的云端仓库空间大小 (字节)。"),
        userSiYuanAssetSize: z.number().describe("思源笔记云端资源文件已用空间大小 (字节)。"),
        userTrafficUpload: z.number().describe("当月已用上传流量 (字节)。"),
        userTrafficDownload: z.number().describe("当月已用下载流量 (字节)。"),
        userSiYuanProExpireDays: z.number().describe("思源笔记专业版剩余天数。"),
        userSiYuanAIMaxFreeRequestCount: z.number().describe("AI功能免费版最大请求次数。"),
        userSiYuanAIMaxProRequestCount: z.number().describe("AI功能专业版最大请求次数。"),
        userSiYuanAIProRequestCount: z.number().describe("AI功能专业版当前已用请求次数。"),
        userSiYuanAISubscriptionPlan: z.number().describe("AI功能订阅计划类型。"),
        userSiYuanPro: z.boolean().describe("是否为思源笔记专业版用户。"),
        userSiYuanLifetimePro: z.boolean().describe("是否为思源笔记终身专业版用户。"),
        userSiYuanTeam: z.boolean().describe("是否为思源笔记团队版用户。")
      }).nullable().describe("包含用户详细信息的对象，获取失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/getPublish",
    en: "getPublish",
    zh_cn: "获取发布服务配置",
    description: "获取当前的发布服务配置信息，包括端口和具体的发布设置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        port: z.number().describe("发布服务当前监听的端口号。"),
        publish: z.object({
          enable: z.boolean().describe("是否启用发布服务。"),
          port: z.number().int().min(0).max(65535).describe("发布服务配置的端口号。"),
          auth: z.object({
            enable: z.boolean().describe("是否启用 Basic 认证。"),
            accounts: z.array(z.object({
              username: z.string().describe("Basic 认证用户名。"),
              password: z.string().describe("Basic 认证密码。"),
              memo: z.string().optional().describe("账户备注信息。")
            })).describe("Basic 认证账户列表。")
          }).describe("Basic 认证配置。")
        }).describe("详细的发布配置项。")
      }).nullable().describe("包含发布服务端口和配置信息的对象，获取失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/login2faCloudUser",
    en: "login2faCloudUser",
    zh_cn: "云端用户两步验证登录",
    description: "使用令牌和两步验证码完成云端用户的登录过程。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      token: z.string().describe("登录过程中的临时令牌。"),
      code: z.string().min(6).max(6).describe("6位数字的两步验证码。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.record(z.string(), z.any()).nullable().describe("登录成功后返回的数据，通常包含新的用户信息或会话信息。具体结构依赖于云端服务的响应。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/logoutCloudUser",
    en: "logoutCloudUser",
    zh_cn: "登出云端用户",
    description: "登出当前已登录的思源云端账户。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/refreshVirtualBlockRef",
    en: "refreshVirtualBlockRef",
    zh_cn: "刷新虚拟引用缓存",
    description: "清除并重建虚拟块引用的缓存。当虚拟引用的相关配置（如包含/排除列表、编辑器中的开关）发生变化后，可能需要调用此接口。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setAI",
    en: "setAI",
    zh_cn: "设置AI配置",
    description: "更新AI相关的配置，主要针对OpenAI服务。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      openAI: z.object({
        apiKey: z.string().optional().describe("OpenAI API 密钥。"),
        apiTimeout: z.number().int().min(5).max(600).optional().describe("OpenAI API 请求超时时间 (秒)，范围 5-600。"),
        apiProxy: z.string().optional().describe("OpenAI API 代理地址。"),
        apiModel: z.string().optional().describe("OpenAI API 模型名称。"),
        apiMaxTokens: z.number().int().min(0).optional().describe("OpenAI API 最大 token 数，0表示不限制。"),
        apiTemperature: z.number().min(0).max(2).optional().describe("OpenAI API 温度系数，范围 0-2。"),
        apiMaxContexts: z.number().int().min(1).max(64).optional().describe("OpenAI API 最大上下文数量，范围 1-64。"),
        apiBaseURL: z.string().optional().describe("OpenAI API 基础 URL，用于兼容第三方 OpenAI 兼容接口。"),
        apiUserAgent: z.string().optional().describe("OpenAI API 请求的 User-Agent。"),
        apiProvider: z.string().optional().describe("API 提供商，例如 'OpenAI', 'Azure'。"),
        apiVersion: z.string().optional().describe("Azure API 版本，当 provider 为 Azure 时使用。")
      }).describe("OpenAI 相关配置。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        openAI: z.object({
          apiKey: z.string().optional().describe("OpenAI API 密钥。"),
          apiTimeout: z.number().int().min(5).max(600).optional().describe("OpenAI API 请求超时时间 (秒)。"),
          apiProxy: z.string().optional().describe("OpenAI API 代理地址。"),
          apiModel: z.string().optional().describe("OpenAI API 模型名称。"),
          apiMaxTokens: z.number().int().min(0).optional().describe("OpenAI API 最大 token 数。"),
          apiTemperature: z.number().min(0).max(2).optional().describe("OpenAI API 温度系数。"),
          apiMaxContexts: z.number().int().min(1).max(64).optional().describe("OpenAI API 最大上下文数量。"),
          apiBaseURL: z.string().optional().describe("OpenAI API 基础 URL。"),
          apiUserAgent: z.string().optional().describe("OpenAI API 请求的 User-Agent。"),
          apiProvider: z.string().optional().describe("API 提供商。"),
          apiVersion: z.string().optional().describe("Azure API 版本。")
        }).describe("OpenAI 相关配置。")
      }).nullable().describe("更新后的 AI 配置对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setAccount",
    en: "setAccount",
    zh_cn: "设置账户相关配置",
    description: "更新用户账户相关的显示配置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      displayTitle: z.boolean().optional().describe("是否在用户头像旁显示称号。"),
      displayVIP: z.boolean().optional().describe("是否在用户头像旁显示Pro标识。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        displayTitle: z.boolean().describe("是否在用户头像旁显示称号。"),
        displayVIP: z.boolean().describe("是否在用户头像旁显示Pro标识。")
      }).nullable().describe("更新后的账户配置对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setAppearance",
    en: "setAppearance",
    zh_cn: "设置外观配置",
    description: "更新应用的外观相关配置，如主题、字体、语言等。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      mode: z.number().int().optional().describe("外观模式，0：跟随系统，1：亮色，2：暗色。"),
      themeDark: z.string().optional().describe("暗色模式使用的主题名称。"),
      themeLight: z.string().optional().describe("亮色模式使用的主题名称。"),
      darkThemes: z.array(z.string()).optional().describe("可选的暗色主题列表。"),
      lightThemes: z.array(z.string()).optional().describe("可选的亮色主题列表。"),
      icons: z.array(z.string()).optional().describe("已安装的图标包名称列表。"),
      lang: z.string().optional().describe("界面语言代码，如 'zh_CN', 'en_US'。"),
      codeFontFamily: z.string().optional().describe("代码块等宽字体。"),
      fontSize: z.number().int().optional().describe("编辑器字体大小。"),
      fontFamily: z.string().optional().describe("编辑器字体。"),
      hideStatusBar: z.boolean().optional().describe("是否隐藏状态栏。"),
      customCSS: z.string().optional().describe("自定义全局 CSS。"),
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        mode: z.number().int().optional().describe("外观模式。"),
        themeDark: z.string().optional().describe("暗色模式主题。"),
        themeLight: z.string().optional().describe("亮色模式主题。"),
        darkThemes: z.array(z.string()).optional().describe("可选暗色主题列表。"),
        lightThemes: z.array(z.string()).optional().describe("可选亮色主题列表。"),
        icons: z.array(z.string()).optional().describe("已安装图标包列表。"),
        lang: z.string().optional().describe("界面语言。"),
        fontSize: z.number().int().optional().describe("编辑器字体大小。"),
        fontFamily: z.string().optional().describe("编辑器字体。"),
        codeFontFamily: z.string().optional().describe("代码块字体。"),
        hideStatusBar: z.boolean().optional().describe("是否隐藏状态栏。"),
        customCSS: z.string().optional().describe("自定义全局 CSS。"),
      }).nullable().describe("更新后的外观配置对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setBazaar",
    en: "setBazaar",
    zh_cn: "设置集市配置",
    description: "更新与集市相关的配置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      trust: z.boolean().optional().describe("是否信任所有社区插件和主题（跳过安全警告）。"),
      petalDisabled: z.boolean().optional().describe("是否禁用所有插件（花瓣）。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        trust: z.boolean().optional().describe("是否信任所有社区包。"),
        petalDisabled: z.boolean().optional().describe("是否禁用所有插件。")
      }).nullable().describe("更新后的集市配置对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setEditor",
    en: "setEditor",
    zh_cn: "设置编辑器配置",
    description: "更新编辑器相关的各种配置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      allowHTMLBLockScript: z.boolean().optional().describe("是否允许执行 HTML 块内脚本。"),
      fontSize: z.number().int().optional().describe("编辑器字体大小。"),
      fontSizeScrollZoom: z.boolean().optional().describe("字体大小是否支持滚轮缩放。"),
      fontFamily: z.string().optional().describe("编辑器字体。"),
      codeSyntaxHighlightLineNum: z.boolean().optional().describe("代码块是否显示行号。"),
      codeTabSpaces: z.number().int().optional().describe("代码块中 Tab 转换空格数，0表示不转换。"),
      codeLineWrap: z.boolean().optional().describe("代码块是否自动折行。"),
      codeLigatures: z.boolean().optional().describe("代码块是否启用连字。"),
      displayBookmarkIcon: z.boolean().optional().describe("是否显示书签图标。"),
      displayNetImgMark: z.boolean().optional().describe("是否显示网络图片角标。"),
      generateHistoryInterval: z.number().int().optional().describe("文档历史生成时间间隔（分钟）。"),
      historyRetentionDays: z.number().int().optional().describe("文档历史保留天数。"),
      emoji: z.array(z.string()).optional().describe("常用表情符号列表。"),
      virtualBlockRef: z.boolean().optional().describe("是否启用虚拟引用。"),
      virtualBlockRefExclude: z.string().optional().describe("虚拟引用关键字排除列表（逗号分隔）。"),
      virtualBlockRefInclude: z.string().optional().describe("虚拟引用关键字包含列表（逗号分隔）。"),
      blockRefDynamicAnchorTextMaxLen: z.number().int().optional().describe("块引动态锚文本最大长度。"),
      plantUMLServePath: z.string().optional().describe("PlantUML 服务地址。"),
      fullWidth: z.boolean().optional().describe("编辑器是否默认使用最大宽度。"),
      katexMacros: z.string().optional().describe("KaTeX 宏定义 (JSON格式字符串)。"),
      readOnly: z.boolean().optional().describe("是否全局启用编辑器只读模式。"),
      embedBlockBreadcrumb: z.boolean().optional().describe("嵌入块是否显示面包屑。"),
      listLogicalOutdent: z.boolean().optional().describe("列表项在退格时是否进行逻辑反向缩进。"),
      listItemDotNumberClickFocus: z.boolean().optional().describe("是否允许通过单击列表项标记（点或数字）来聚焦块。"),
      floatWindowMode: z.number().int().optional().describe("浮窗触发模式，0：光标悬停，1：按住Ctrl悬停，2：不触发。"),
      dynamicLoadBlocks: z.number().int().optional().describe("动态加载块的数量，区间 [48, 1024]。"),
      justify: z.boolean().optional().describe("内容是否两端对齐。"),
      rtl: z.boolean().optional().describe("是否启用从右到左的文本显示。"),
      spellcheck: z.boolean().optional().describe("是否启用拼写检查。"),
      onlySearchForDoc: z.boolean().optional().describe("是否启用 '[[' 仅搜索文档块。"),
      backlinkExpandCount: z.number().int().optional().describe("反向链接面板中默认展开的项目数量。"),
      backmentionExpandCount: z.number().int().optional().describe("反链提及面板中默认展开的项目数量。"),
      backlinkContainChildren: z.boolean().optional().describe("计算反向链接时是否包含子块。"),
      markdown: z.any().optional().describe("Markdown 解析和渲染相关的详细配置对象。具体结构请参考 util.Markdown。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.any().nullable().describe("更新后的编辑器配置对象。结构与请求体类似。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setEditorReadOnly",
    en: "setEditorReadOnly",
    zh_cn: "设置编辑器只读模式",
    description: "单独设置整个编辑器的只读状态。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      readonly: z.boolean().describe("是否将编辑器设置为只读模式。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setEmoji",
    en: "setEmoji",
    zh_cn: "设置常用表情",
    description: "更新编辑器配置中的常用表情列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      emoji: z.array(z.string()).describe("新的常用表情符号列表。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据，直接修改配置。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setExport",
    en: "setExport",
    zh_cn: "设置导出配置",
    description: "更新与导出功能相关的配置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      paragraphBeginningSpace: z.boolean().optional().describe("导出Markdown时段落开头是否空两格（中文排版）。"),
      addTitle: z.boolean().optional().describe("导出时是否自动添加文档标题。"),
      blockRefMode: z.number().int().optional().describe("内容块引用导出模式（Markdown）：2-锚文本块链, 3-仅锚文本, 4-块引转脚注+锚点哈希。"),
      blockEmbedMode: z.number().int().optional().describe("内容块嵌入导出模式（Markdown）：0-原始文本, 1-Blockquote。"),
      blockRefTextLeft: z.string().optional().describe("内容块引用导出锚文本左侧符号。"),
      blockRefTextRight: z.string().optional().describe("内容块引用导出锚文本右侧符号。"),
      tagOpenMarker: z.string().optional().describe("标签导出时的开始标记符，默认为 '#'。"),
      tagCloseMarker: z.string().optional().describe("标签导出时的结束标记符，默认为空字符串。"),
      fileAnnotationRefMode: z.number().int().optional().describe("文件标注引用导出模式：0-文件名-页码-锚文本，1-仅锚文本。"),
      pandocBin: z.string().optional().describe("Pandoc 可执行文件路径。"),
      markdownYFM: z.boolean().optional().describe("Markdown 导出时是否添加 YAML Front Matter。"),
      inlineMemo: z.boolean().optional().describe("导出时是否包含行级备忘录。"),
      pdfFooter: z.string().optional().describe("PDF 导出时的页脚内容，可用占位符 %page 和 %pages。"),
      docxTemplate: z.string().optional().describe("Docx 导出时使用的模板文件路径。"),
      pdfWatermarkStr: z.string().optional().describe("PDF 导出时的水印文本或水印图片文件路径。"),
      pdfWatermarkDesc: z.string().optional().describe("PDF 导出时的水印位置、大小和样式等描述。"),
      imageWatermarkStr: z.string().optional().describe("图片导出时的水印文本或水印图片文件路径。"),
      imageWatermarkDesc: z.string().optional().describe("图片导出时的水印位置、大小和样式等描述。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.any().nullable().describe("更新后的导出配置对象。结构与请求体类似。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setFiletree",
    en: "setFiletree",
    zh_cn: "设置文件树配置",
    description: "更新文件树（文档列表）相关的配置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      alwaysSelectOpenedFile: z.boolean().optional().describe("打开文件时，文件树是否自动选中该文件。"),
      openFilesUseCurrentTab: z.boolean().optional().describe("是否总是在当前页签打开文件，而不是新页签。"),
      refCreateSaveBox: z.string().optional().describe("通过块引创建新文档时，默认保存到的笔记本ID。"),
      refCreateSavePath: z.string().optional().describe("通过块引创建新文档时，默认保存的路径。"),
      docCreateSaveBox: z.string().optional().describe("直接创建新文档时，默认保存到的笔记本ID。"),
      docCreateSavePath: z.string().optional().describe("直接创建新文档时，默认保存的路径。"),
      maxListCount: z.number().int().optional().describe("文件树中列出文档的最大数量限制。"),
      maxOpenTabCount: z.number().int().min(1).max(32).optional().describe("编辑器最大可打开的页签数量，范围 1-32。"),
      allowCreateDeeper: z.boolean().optional().describe("是否允许创建超过7层深度的子文档。"),
      removeDocWithoutConfirm: z.boolean().optional().describe("删除文档时是否不需要二次确认。"),
      closeTabsOnStart: z.boolean().optional().describe("启动思源笔记时是否关闭所有已打开的页签。"),
      useSingleLineSave: z.boolean().optional().describe("是否使用单行格式保存 .sy 文档和属性视图 .json 文件。"),
      sort: z.number().int().optional().describe("文件树默认排序方式的数字代码。具体含义需参考 util.SortMode* 常量。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.any().nullable().describe("更新后的文件树配置对象。结构与请求体类似。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setFlashcard",
    en: "setFlashcard",
    zh_cn: "设置闪卡配置",
    description: "更新与闪卡（FSRS算法）相关的配置。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      newCardLimit: z.number().int().min(0).optional().describe("每日新建卡片上限。"),
      reviewCardLimit: z.number().int().min(0).optional().describe("每日复习卡片上限。"),
      requestRetention: z.number().min(0.7).max(0.97).optional().describe("期望记忆留存率 (FSRS)。"),
      maximumInterval: z.number().int().min(1).optional().describe("最大复习间隔天数 (FSRS)。"),
      easyBonus: z.number().min(1).optional().describe("简单奖励系数 (FSRS)。"),
      hardInterval: z.number().min(1).optional().describe("困难间隔系数 (FSRS)。"),
      lapseInterval: z.number().min(0.01).optional().describe("失误间隔系数 (FSRS)。"),
      againInterval: z.number().min(0.01).optional().describe("重来间隔系数 (FSRS)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        newCardLimit: z.number().int().describe("每日新建卡片上限。"),
        reviewCardLimit: z.number().int().describe("每日复习卡片上限。"),
        requestRetention: z.number().describe("期望记忆留存率。"),
        maximumInterval: z.number().int().describe("最大复习间隔天数。"),
        easyBonus: z.number().describe("简单奖励系数。"),
        hardInterval: z.number().describe("困难间隔系数。"),
        lapseInterval: z.number().describe("失误间隔系数。"),
        againInterval: z.number().describe("重来间隔系数。")
      }).nullable().describe("更新后的闪卡配置对象。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setKeymap",
    en: "setKeymap",
    zh_cn: "设置快捷键配置",
    description: "更新用户自定义的快捷键映射。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      data: z.object({
        editor: z.record(z.string(), z.string()).optional().describe("编辑器通用快捷键。键为命令ID，值为快捷键组合字符串。"),
        protyleIR: z.record(z.string(), z.string()).optional().describe("Protyle (IR模式) 快捷键。"),
        protyleSV: z.record(z.string(), z.string()).optional().describe("Protyle (SV模式) 快捷键。"),
        protyleWYSIWYG: z.record(z.string(), z.string()).optional().describe("Protyle (所见即所得模式) 快捷键。"),
        fileTree: z.record(z.string(), z.string()).optional().describe("文件树快捷键。"),
        notebook: z.record(z.string(), z.string()).optional().describe("笔记本操作快捷键。"),
        global: z.record(z.string(), z.string()).optional().describe("全局快捷键。")
      }).describe("包含各类快捷键映射的对象。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.null().describe("此接口成功时不返回具体数据，直接修改配置。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setPublish",
    en: "setPublish",
    zh_cn: "设置发布服务配置",
    description: "更新发布服务的配置，并尝试根据新配置初始化（或重启）发布服务。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      enable: z.boolean().describe("是否启用发布服务。"),
      port: z.number().int().min(0).max(65535).describe("发布服务监听的端口号。"),
      auth: z.object({
        enable: z.boolean().describe("是否启用 Basic 认证。"),
        accounts: z.array(z.object({
          username: z.string().min(1).describe("Basic 认证用户名。"),
          password: z.string().min(1).describe("Basic 认证密码。"),
          memo: z.string().optional().describe("账户备注信息。")
        })).describe("Basic 认证账户列表。")
      }).describe("Basic 认证配置。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        port: z.number().describe("发布服务实际监听的端口号 (如果成功初始化)。"),
        publish: z.object({
          enable: z.boolean().describe("是否启用发布服务。"),
          port: z.number().int().describe("发布服务配置的端口号。"),
          auth: z.object({
            enable: z.boolean().describe("是否启用 Basic 认证。"),
            accounts: z.array(z.object({
              username: z.string().describe("用户名。"),
              password: z.string().describe("密码。"),
              memo: z.string().optional().describe("备注。")
            })).describe("账户列表。")
          }).describe("Basic 认证配置。")
        }).describe("详细的发布配置项。")
      }).nullable().describe("包含更新后配置及服务端口的对象，初始化失败时 Data 可能为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setSearch",
    en: "setSearch",
    zh_cn: "设置搜索配置",
    description: "更新与搜索功能相关的配置，部分配置更改可能触发重建索引。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      document: z.boolean().optional().describe("搜索范围是否包含文档块。"),
      heading: z.boolean().optional().describe("搜索范围是否包含标题块。"),
      list: z.boolean().optional().describe("搜索范围是否包含列表块。"),
      listItem: z.boolean().optional().describe("搜索范围是否包含列表项块。"),
      codeBlock: z.boolean().optional().describe("搜索范围是否包含代码块。"),
      mathBlock: z.boolean().optional().describe("搜索范围是否包含数学公式块。"),
      table: z.boolean().optional().describe("搜索范围是否包含表格块。"),
      blockquote: z.boolean().optional().describe("搜索范围是否包含引用块。"),
      superBlock: z.boolean().optional().describe("搜索范围是否包含超级块。"),
      paragraph: z.boolean().optional().describe("搜索范围是否包含段落块。"),
      htmlBlock: z.boolean().optional().describe("搜索范围是否包含HTML块。"),
      embedBlock: z.boolean().optional().describe("搜索范围是否包含嵌入块。"),
      databaseBlock: z.boolean().optional().describe("搜索范围是否包含数据库块。"),
      audioBlock: z.boolean().optional().describe("搜索范围是否包含音频块。"),
      videoBlock: z.boolean().optional().describe("搜索范围是否包含视频块。"),
      iframeBlock: z.boolean().optional().describe("搜索范围是否包含IFrame块。"),
      widgetBlock: z.boolean().optional().describe("搜索范围是否包含挂件块。"),

      limit: z.number().int().min(32).optional().describe("搜索结果数量限制，最小32。"),
      caseSensitive: z.boolean().optional().describe("搜索时是否区分大小写。更改此项会重建索引。"),
      
      name: z.boolean().optional().describe("搜索时是否匹配块命名。"),
      alias: z.boolean().optional().describe("搜索时是否匹配块别名。"),
      memo: z.boolean().optional().describe("搜索时是否匹配块备注。"),
      ial: z.boolean().optional().describe("搜索时是否匹配IAL属性。"),

      indexAssetPath: z.boolean().optional().describe("是否索引资源文件路径。更改此项会重建索引。"),

      backlinkMentionName: z.boolean().optional().describe("反链提及中是否包含命名。"),
      backlinkMentionAlias: z.boolean().optional().describe("反链提及中是否包含别名。"),
      backlinkMentionAnchor: z.boolean().optional().describe("反链提及中是否包含锚文本。"),
      backlinkMentionDoc: z.boolean().optional().describe("反链提及中是否包含文档标题。"),
      backlinkMentionKeywordsLimit: z.number().int().optional().describe("反链提及的关键字数量限制。"),

      virtualRefName: z.boolean().optional().describe("虚拟引用是否作用于命名。更改此项会刷新虚拟引用缓存。"),
      virtualRefAlias: z.boolean().optional().describe("虚拟引用是否作用于别名。更改此项会刷新虚拟引用缓存。"),
      virtualRefAnchor: z.boolean().optional().describe("虚拟引用是否作用于锚文本。更改此项会刷新虚拟引用缓存。"),
      virtualRefDoc: z.boolean().optional().describe("虚拟引用是否作用于文档标题。更改此项会刷新虚拟引用缓存。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.any().nullable().describe("更新后的搜索配置对象。结构与请求体类似。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/setting/setSnippet",
    en: "setConfSnippet",
    zh_cn: "设置代码片段配置",
    description: "更新代码片段（Snippets）的启用状态，如是否启用自定义CSS和JS。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      enabledCSS: z.boolean().optional().describe("是否启用所有自定义CSS代码片段。"),
      enabledJS: z.boolean().optional().describe("是否启用所有自定义JS代码片段。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 执行结果的状态码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("API 执行结果的描述信息。"),
      Data: z.object({
        enabledCSS: z.boolean().describe("是否启用所有自定义CSS代码片段。"),
        enabledJS: z.boolean().describe("是否启用所有自定义JS代码片段。")
      }).nullable().describe("更新后的代码片段全局配置。")
    })
  }
];  
