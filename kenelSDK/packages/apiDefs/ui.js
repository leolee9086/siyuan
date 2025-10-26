export const uiApiDefs = [
  {
    method: "POST",
    endpoint: "/api/ui/reloadAttributeView",
    en: "reloadAttributeView",
    zh_cn: "重新加载属性视图",
    description: "重新加载指定的属性视图。通常在属性视图的结构或数据发生变化后调用，以刷新显示。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要重新加载的属性视图的 ID。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息，成功时为空字符串。"),
      data: z.null().describe("成功时总是为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ui/reloadFiletree",
    en: "reloadFiletree",
    zh_cn: "重新加载文件树",
    description: "重新加载文件树。当文档结构发生变化（如创建、删除、移动文档或笔记本）后，调用此接口以刷新文件树显示。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息，成功时为空字符串。"),
      data: z.null().describe("成功时总是为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ui/reloadProtyle",
    en: "reloadProtyle",
    zh_cn: "重新加载编辑器",
    description: "重新加载指定的 Protyle 编辑器实例。通常在编辑器内容或状态在后端被修改后调用，以刷新前端显示。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      id: z.string().describe("要重新加载的 Protyle 编辑器实例对应的块 ID 或文档 ID。")
    }),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息，成功时为空字符串。"),
      data: z.null().describe("成功时总是为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ui/reloadTag",
    en: "reloadTag",
    zh_cn: "重新加载标签列表",
    description: "重新加载标签列表。当标签被创建、删除、重命名或引用发生变化后，调用此接口以刷新标签面板的显示。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息，成功时为空字符串。"),
      data: z.null().describe("成功时总是为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/ui/reloadUI",
    en: "reloadUI",
    zh_cn: "重新加载整个用户界面",
    description: "触发整个用户界面的重新加载。这是一个比较重的操作，通常在发生可能影响全局UI状态的重大变更后使用，或者作为一种通用的刷新手段。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      code: z.number().describe("错误码，0 表示成功。"),
      msg: z.string().describe("错误信息，成功时为空字符串。"),
      data: z.null().describe("成功时总是为 null。")
    })
  }
];
