export const systemApiDefs = [
  {
    method: "POST",
    endpoint: "/api/system/addMicrosoftDefenderExclusion",
    en: "addMicrosoftDefenderExclusion",
    zh_cn: "添加 Microsoft Defender 排除项",
    description: "将思源笔记相关目录添加到 Microsoft Defender 的排除项中，以避免潜在的性能问题或冲突。此操作仅在 Windows 系统上有效。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "GET",
    endpoint: "/api/system/bootProgress",
    en: "bootProgress",
    zh_cn: "获取启动进度",
    description: "获取思源笔记内核的启动进度。此接口也接受 POST 请求。",
    needAuth: false,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.object({
        progress: z.number().describe("启动进度百分比，例如 89"),
        state: z.number().describe("当前启动状态码"),
        details: z.string().describe("当前启动状态的详细描述文本"),
      }).nullable().describe("启动进度信息，启动完成或未开始时可能为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/bootProgress",
    en: "bootProgress",
    zh_cn: "获取启动进度 (POST)",
    description: "获取思源笔记内核的启动进度。此接口也接受 GET 请求。",
    needAuth: false,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.object({
        progress: z.number().describe("启动进度百分比，例如 89"),
        state: z.number().describe("当前启动状态码"),
        details: z.string().describe("当前启动状态的详细描述文本"),
      }).nullable().describe("启动进度信息，启动完成或未开始时可能为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/checkUpdate",
    en: "checkUpdate",
    zh_cn: "检查更新",
    description: "检查思源笔记是否有新版本。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false, // 理论上检查更新不应受只读模式影响，但源码中未标记 CheckReadonly，故保持 false
    zodRequestSchema: (z) => ({
      showMsg: z.boolean().describe("是否在检查后显示提示消息给用户")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null，更新信息通过 WebSocket 推送或直接在 UI 弹出"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/checkWorkspaceDir",
    en: "checkWorkspaceDir",
    zh_cn: "检查工作空间目录",
    description: "检查指定路径是否可以作为思源笔记的工作空间目录。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("要检查的目录绝对路径")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功，-1 表示无效路径或检查失败"),
      msg: z.string().describe("错误或提示信息"),
      data: z.object({
        isWorkspace: z.boolean().describe("该路径是否已经是或可以成为一个有效的工作空间"),
        // 根据 model.CheckWorkspaceDir 实现，还可能有其他字段，但主要是 isWorkspace
      }).nullable().describe("检查结果，code 非 0 时可能为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/createWorkspaceDir",
    en: "createWorkspaceDir",
    zh_cn: "创建工作空间目录",
    description: "在指定路径创建一个新的思源笔记工作空间。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("要创建工作空间的目录绝对路径")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/currentTime",
    en: "currentTime",
    zh_cn: "获取当前服务器时间",
    description: "获取思源笔记服务器当前的 Unix 时间戳 (毫秒)。",
    needAuth: false, // router.go 中未标记 model.CheckAuth
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.number().describe("当前的 Unix 时间戳 (毫秒)"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/exit",
    en: "exit",
    zh_cn: "退出程序",
    description: "关闭并退出思源笔记程序。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false, // 退出操作不应受只读限制
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/exportConf",
    en: "exportConf",
    zh_cn: "导出配置",
    description: "导出一份包含当前用户所有配置的 JSON 文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false, // 导出配置不应受只读限制
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.object({
        path: z.string().describe("导出的配置文件 `conf.json` 所在临时目录的绝对路径。前端通常会触发下载此目录下的 `conf.json`。"),
        name: z.string().describe("导出的配置文件名，通常是 `conf.json`")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/exportLog",
    en: "exportLog",
    zh_cn: "导出日志",
    description: "导出包含系统运行日志的压缩文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false, // 导出日志不应受只读限制
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.object({
        zip: z.string().describe("导出的日志压缩文件 `log.zip` 的绝对路径。前端通常会触发此文件的下载。")
      })
    })
  },
  {
    method: "GET",
    endpoint: "/api/system/getCaptcha",
    en: "GetCaptcha",
    zh_cn: "获取验证码",
    description: "获取用于登录验证的图片验证码。",
    needAuth: false,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    // 响应体是图片流，而非 JSON 对象。此处 schema 描述其元数据。
    // 实际调用时，浏览器会直接显示图片或下载。
    zodResponseSchema: (z) => ({
      code: z.number().int().optional().describe("通常不适用，因为响应是图片流"),
      msg: z.string().optional().describe("通常不适用"),
      data: z.string().optional().describe("通常不适用。实际是图片二进制数据。"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getChangelog",
    en: "getChangelog",
    zh_cn: "获取更新日志",
    description: "获取当前版本的更新日志内容 (Markdown 格式转换为 HTML)。",
    needAuth: true,
    needAdminRole: false, // 根据 router.go
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.object({
        show: z.boolean().describe("是否需要显示更新日志（例如，新版本首次启动后）"),
        html: z.string().describe("更新日志的 HTML 内容")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getConf",
    en: "getConf",
    zh_cn: "获取所有配置",
    description: "获取思源笔记的全部配置信息。配置项繁多，具体结构请参考 `siyuan/kernel/conf/conf.go` 中的 `Conf` 结构体。",
    needAuth: true,
    needAdminRole: false, // 根据 router.go
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.any().describe("包含所有配置项的对象，结构复杂，请参考 `siyuan/kernel/conf/conf.go` 中的 `Conf` 结构体。例如 `data.appearance.mode` 等。")
      // 由于配置结构庞大且可能随版本变化，这里使用 z.any()。
      // 开发者应参照 conf.go 自行定义具体需要的配置项 schema。
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getEmojiConf",
    en: "getEmojiConf",
    zh_cn: "获取 Emoji 配置",
    description: "获取内置及自定义 Emoji 的配置信息，用于 Emoji 选择器等功能。",
    needAuth: true,
    needAdminRole: false, // 根据 router.go
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.array(z.object({
        id: z.string().describe("Emoji 分组 ID，例如 'custom', 'people'"),
        title: z.string().describe("Emoji 分组标题 (英文)"),
        title_zh_cn: z.string().optional().describe("Emoji 分组标题 (简体中文)"),
        title_ja_jp: z.string().optional().describe("Emoji 分组标题 (日文)"),
        items: z.array(z.object({
          unicode: z.string().describe("Emoji 的 Unicode 表示或自定义 Emoji 的文件名/路径"),
          description: z.string().describe("Emoji 描述 (英文)"),
          description_zh_cn: z.string().optional().describe("Emoji 描述 (简体中文)"),
          description_ja_jp: z.string().optional().describe("Emoji 描述 (日文)"),
          keywords: z.string().optional().describe("Emoji 搜索关键词"),
        })).describe("该分组下的 Emoji项列表")
      })).describe("Emoji 配置数组，每个元素是一个 Emoji 分组")
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getMobileWorkspaces",
    en: "getMobileWorkspaces",
    zh_cn: "获取移动端工作空间列表",
    description: "获取用于移动端同步的工作空间列表。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false, // 源码中未标记 CheckReadonly
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.array(z.object({
        path: z.string().describe("工作空间的绝对路径"),
        name: z.string().describe("工作空间的名称 (目录名)"),
        title: z.string().describe("工作空间的标题 (通常与名称相同)"),
        bookmark: z.string().describe("工作空间的备注/书签"), // 根据以往经验推断，可能为空
        closed: z.boolean().describe("工作空间是否已关闭"), // 根据以往经验推断
      })).describe("移动端工作空间列表")
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getNetwork",
    en: "getNetwork",
    zh_cn: "获取网络配置",
    description: "获取当前的网络代理等配置信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false, // 源码中未标记 CheckReadonly
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.object({
        proxy: z.string().describe("网络代理配置字符串，例如 'socks5://127.0.0.1:1080' 或空字符串")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getSysFonts",
    en: "getSysFonts",
    zh_cn: "获取系统字体列表",
    description: "获取当前操作系统上安装的可用字体列表。",
    needAuth: true,
    needAdminRole: true, // 根据 router.go
    unavailableIfReadonly: false, // 获取字体列表不应受只读限制
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.array(z.object({
        label: z.string().describe("字体名称，用于显示和选择"),
        value: z.string().describe("字体族名称，用于 CSS font-family")
      })).describe("系统字体列表")
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getWorkspaceInfo",
    en: "getWorkspaceInfo",
    zh_cn: "获取当前工作空间信息",
    description: "获取当前打开的工作空间目录路径和思源版本号。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true, // 源码中明确有 CheckReadonly
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.object({
        workspaceDir: z.string().describe("当前工作空间的绝对路径"),
        siyuanVer: z.string().describe("当前思源笔记的版本号")
      })
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/getWorkspaces",
    en: "getWorkspaces",
    zh_cn: "获取所有工作空间列表",
    description: "获取所有已配置或曾经打开过的工作空间列表。",
    needAuth: true,
    needAdminRole: false, // 根据 router.go
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.array(z.object({
        path: z.string().describe("工作空间的绝对路径"),
        name: z.string().describe("工作空间的名称 (目录名)"),
        title: z.string().describe("工作空间的标题 (通常与名称相同，可由用户设置)"),
        bookmark: z.string().describe("工作空间的备注/书签"),
        closed: z.boolean().describe("工作空间当前是否处于关闭状态"),
      })).describe("工作空间列表")
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/ignoreAddMicrosoftDefenderExclusion",
    en: "ignoreAddMicrosoftDefenderExclusion",
    zh_cn: "忽略添加 Microsoft Defender 排除项",
    description: "设置不再提示用户添加 Microsoft Defender 排除项。此操作仅在 Windows 系统上有效。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/importConf",
    en: "importConf",
    zh_cn: "导入配置",
    description: "通过上传 `conf.json` 文件来导入用户配置。导入成功后通常需要重启或刷新UI生效。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      file: z.any().describe("上传的 `conf.json` 文件。通常通过 FormData 提交。`z.instanceof(File)` 在此场景不适用，因为这是后端定义。前端应使用 `FormData`。"),
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/loginAuth",
    en: "LoginAuth",
    zh_cn: "登录授权",
    description: "使用访问授权码或用户名密码进行登录验证。",
    needAuth: false, // 登录操作本身不需要预先授权
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      authcode: z.string().optional().describe("访问授权码 (如果设置了)"),
      captcha: z.string().optional().describe("图片验证码的识别结果 (如果需要验证码)"),
      // username 和 password 字段在 model.LoginAuth 中没有直接体现，
      // 但社区版登录场景可能会用到。此处暂时不添加，以官方实现为准。
      // 如果需要用户名密码登录，通常是桌面端配置了，这里仅处理 authcode。
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功，其他表示失败 (如授权码错误、验证码错误等)"),
      msg: z.string().describe("错误或提示信息"),
      data: z.null().describe("成功时为 null，失败时也可能为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/logoutAuth",
    en: "LogoutAuth",
    zh_cn: "退出登录",
    description: "清除当前的登录授权状态。",
    needAuth: false, // 退出登录操作，可能在已登录或未登录状态下执行，但操作本身不依赖于当前是否已登录
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/reloadUI",
    en: "reloadUI",
    zh_cn: "重新加载UI",
    description: "命令客户端重新加载思源笔记的用户界面。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/removeWorkspaceDir",
    en: "removeWorkspaceDir",
    zh_cn: "移除工作空间",
    description: "从工作空间列表中移除指定的目录（逻辑删除，不删除物理文件）。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("要移除的工作空间的绝对路径")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/removeWorkspaceDirPhysically",
    en: "removeWorkspaceDirPhysically",
    zh_cn: "物理删除工作空间",
    description: "从工作空间列表中移除并物理删除指定目录及其所有内容。这是一个危险操作！",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      paths: z.array(z.string()).describe("要物理删除的工作空间的绝对路径列表")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setAPIToken",
    en: "setAPIToken",
    zh_cn: "设置 API 令牌",
    description: "设置或清空 API 访问令牌 (token)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      token: z.string().describe("新的 API 令牌。如果为空字符串，则表示清空令牌。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setAccessAuthCode",
    en: "setAccessAuthCode",
    zh_cn: "设置访问授权码",
    description: "设置或清空访问思源笔记的授权码。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      code: z.string().describe("新的访问授权码。如果为空字符串，则表示清空授权码。"),
      permanent: z.boolean().optional().describe("是否永久有效（此参数在后端实现中可能未直接使用，主要通过 code 是否为空判断）")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setAppearanceMode",
    en: "setAppearanceMode",
    zh_cn: "设置外观模式",
    description: "设置思源笔记的外观模式 (亮色/暗色)。",
    needAuth: true,
    needAdminRole: true, // 源码中是 CheckAdminRole
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      mode: z.number().int().min(0).max(1).describe("外观模式：0 表示亮色 (Light)，1 表示暗色 (Dark)")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setAutoLaunch",
    en: "setAutoLaunch",
    zh_cn: "设置开机自启动",
    description: "设置思源笔记是否开机自启动 (仅对桌面客户端有效)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      autoLaunch: z.boolean().describe("是否开机自启动")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setDownloadInstallPkg",
    en: "setDownloadInstallPkg",
    zh_cn: "设置自动下载并安装更新包",
    description: "设置是否在检测到新版本后自动下载并安装更新包。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      downloadInstallPkg: z.boolean().describe("是否自动下载并安装更新包")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setFollowSystemLockScreen",
    en: "setFollowSystemLockScreen",
    zh_cn: "设置跟随系统锁屏",
    description: "设置思源笔记是否在系统锁屏时自动锁定 (仅对桌面客户端有效)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      follow: z.boolean().describe("是否跟随系统锁屏")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setGoogleAnalytics",
    en: "setGoogleAnalytics",
    zh_cn: "设置 Google Analytics 追踪",
    description: "启用或禁用 Google Analytics 数据追踪。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    deprecated: true,
    zodRequestSchema: (z) => ({
      enabled: z.boolean().describe("是否启用 Google Analytics")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setNetworkProxy",
    en: "setNetworkProxy",
    zh_cn: "设置网络代理",
    description: "设置网络连接时使用的代理服务器。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      proxy: z.string().describe("代理服务器地址，例如 'http://127.0.0.1:7890', 'socks5://127.0.0.1:1080'。如果为空字符串，则表示清除代理设置。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setNetworkServe",
    en: "setNetworkServe",
    zh_cn: "设置网络服务",
    description: "配置思源笔记的网络服务，如服务端口、是否允许其他设备访问等。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      serve: z.boolean().describe("是否启用网络服务"),
      port: z.string().describe("网络服务端口号，字符串形式，例如 '6806'"), // conf.go 中 ServerPort 是 string
      accessPermission: z.string().describe("网络访问权限：'lan' (仅局域网), 'wan' (允许公网，需谨慎), 'localhost' (仅本机)") // 根据以往经验推断，具体值需核实
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setUILayout",
    en: "setUILayout",
    zh_cn: "设置 UI 布局",
    description: "设置用户界面的布局模式，例如左右布局、顶部分栏等。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      // 从 system.go setUILayout 函数中看到是 model.Conf.Editor.Layout = arg["layout"].(string)
      // 具体 layout 的可选值需要参考前端或 conf.go 的 EditorConf 结构
      layout: z.string().describe("UI 布局模式的标识符字符串")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/setWorkspaceDir",
    en: "setWorkspaceDir",
    zh_cn: "设置当前工作空间",
    description: "切换到指定路径的工作空间。成功后通常需要重启或刷新 UI。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      path: z.string().describe("要切换到的工作空间的绝对路径")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/uiproc",
    en: "addUIProcess",
    zh_cn: "添加 UI 进程信息",
    description: "（内部接口）用于桌面端添加 UI 进程的相关信息，如 PID。通常不由普通用户或第三方应用直接调用。",
    needAuth: false, // 内部接口，通常在启动时由 UI 调用，不进行鉴权
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      pid: z.number().int().optional().describe("UI 进程的 PID (可选)"),
      // 可能还有其他与 UI 进程相关的参数
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.null().describe("成功时总是为 null"),
    })
  },
  {
    method: "GET",
    endpoint: "/api/system/version",
    en: "version",
    zh_cn: "获取版本号",
    description: "获取当前思源笔记内核的版本号。此接口也接受 POST 请求。",
    needAuth: false,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.string().describe("当前思源笔记的版本号字符串，例如 '2.10.0'"),
    })
  },
  {
    method: "POST",
    endpoint: "/api/system/version",
    en: "version",
    zh_cn: "获取版本号 (POST)",
    description: "获取当前思源笔记内核的版本号。此接口也接受 GET 请求。",
    needAuth: false,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功"),
      msg: z.string().describe("错误信息"),
      data: z.string().describe("当前思源笔记的版本号字符串，例如 '2.10.0'"),
    })
  }
];
