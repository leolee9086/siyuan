export const petalApiDefs = [
  {
    method: "POST",
    endpoint: "/api/petal/loadPetals",
    en: "loadPetals",
    zh_cn: "加载插件列表",
    description: "加载指定前端界面的所有已启用且兼容的插件（Petals）及其代码和配置信息。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      frontend: z.string().describe("必需。指定要加载插件的前端界面，例如 'desktop', 'mobile', 'browser-extension'。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功"),
      Msg: z.string().describe("错误信息，成功时为空字符串"),
      Data: z.array(z.object({
        name: z.string().describe("插件的包名 (唯一标识符)"),
        displayName: z.string().describe("插件的显示名称 (来自 plugin.json)"),
        enabled: z.boolean().describe("插件是否已在配置中启用"),
        incompatible: z.boolean().describe("插件是否与当前前端版本不兼容"),
        js: z.string().optional().describe("插件的 JavaScript 代码内容 (来自 index.js)。仅当插件启用且兼容时加载。"),
        css: z.string().optional().describe("插件的 CSS 代码内容 (来自 index.css)。仅当插件启用且兼容时加载。"),
        i18n: z.record(z.any()).optional().describe("插件的国际化 (i18n) 文本资源对象。仅当插件启用且兼容时加载。")
      })).nullable().describe("一个插件对象数组。如果没有任何可加载的插件，可能为 null 或空数组。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/petal/setPetalEnabled",
    en: "setPetalEnabled",
    zh_cn: "设置插件启用状态",
    description: "设置指定前端界面中特定插件（由包名识别）的启用或禁用状态。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      packageName: z.string().describe("必需。要设置启用状态的插件的包名 (唯一标识符)。"),
      enabled: z.boolean().describe("必需。设置插件的启用状态，true 表示启用，false 表示禁用。"),
      frontend: z.string().describe("必需。指定要设置插件状态的前端界面，例如 'desktop', 'mobile'。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，-1 表示插件不兼容或其他错误"),
      Msg: z.string().describe("错误信息，成功时为空字符串，失败时包含具体错误，如不兼容提示。"),
      Data: z.object({
        name: z.string().describe("插件的包名"),
        displayName: z.string().describe("插件的显示名称"),
        enabled: z.boolean().describe("插件更新后的启用状态"),
        incompatible: z.boolean().describe("插件是否不兼容")
      }).nullable().describe("操作成功时返回更新后的插件状态对象 (不含代码)；失败时可能为 null。")
    })
  }
];
