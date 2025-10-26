export const iconApiDefs = [
  {
    method: "GET",
    endpoint: "/api/icon/getDynamicIcon",
    en: "getDynamicIcon",
    zh_cn: "获取动态图标",
    description: "根据参数动态生成一个SVG格式的日期或文字图标。此接口直接返回 SVG 图像数据。",
    needAuth: false,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      type: z.string().optional().describe("图标类型，可选值 '1'-'8'，默认为 '1'。例如：'1' 年月日星期, '6' 星期, '7' 倒计时, '8' 文字图标"),
      color: z.string().optional().describe("图标颜色，可以是预定义颜色名 (如 'red', 'blue') 或十六进制颜色值 (如 '#ff0000', 'ff0000')"),
      date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("目标日期，格式 YYYY-MM-DD，用于日期相关类型的图标"),
      lang: z.string().optional().describe("语言代码，例如 'zh_CN', 'en_US'。默认为内核当前语言"),
      weekdayType: z.string().optional().describe("星期显示格式，不同语言下有不同选项，默认为 '1'"),
      content: z.string().optional().describe("文字内容，当 type='8' (文字图标) 时使用"),
      id: z.string().optional().describe("图标ID，当 type='8' (文字图标) 时使用，用于生成固定的背景色")
    }),
    zodResponseSchema: (z) => z.any().describe("此接口不返回 JSON。成功时直接返回 image/svg+xml 类型的 SVG 图像数据 (HTTP 200)。失败时可能返回其他 HTTP 错误状态码。")
  }
];
