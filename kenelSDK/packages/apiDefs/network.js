export const networkApiDefs = [
  {
    method: "POST",
    endpoint: "/api/network/forwardProxy",
    en: "forwardProxy",
    zh_cn: "转发HTTP代理请求",
    description: "作为代理，将客户端构造的HTTP(S)请求转发到指定的目标URL，并返回目标服务器的响应。支持多种请求体编码方式。",
    needAuth: true,       // from router.go: model.CheckAuth
    needAdminRole: true,  // from router.go: model.CheckAdminRole
    unavailableIfReadonly: false, // from router.go: model.CheckReadonly
    zodRequestSchema: (z) => ({
      url: z.string().url().describe("必需。要请求的目标 URL，必须是合法的 HTTP 或 HTTPS 地址。"),
      method: z.string().optional().default("POST").describe("可选。HTTP 请求方法，如 GET, POST, PUT, DELETE 等。默认为 POST。"),
      timeout: z.number().int().positive().optional().default(7000).describe("可选。请求超时时间，单位毫秒。默认为 7000ms。"),
      headers: z.array(z.record(z.string(), z.any())).optional().describe("可选。HTTP 请求头数组，每个元素是一个包含单个键值对的对象，例如 [{'User-Agent': 'Siyuan-Proxy'}, {'Authorization': 'Bearer token'}]。"),
      contentType: z.string().optional().default("application/json").describe("可选。请求体的 Content-Type。默认为 'application/json'。"),
      payload: z.any().optional().describe("可选。HTTP 请求体内容。其格式和编码由 payloadEncoding 决定。"),
      payloadEncoding: z.enum(["json", "text", "base64", "base64-std", "base64-url", "base32", "base32-std", "base32-hex", "hex"]).optional().default("json")
        .describe("可选。payload 字段的编码方式。'json' 和 'text' 表示直接使用 payload 值 (json 会被序列化)；其他选项表示 payload 是对应编码的字符串，代理服务器会先解码再发送。默认为 'json' (如果 contentType 是 application/json 则 payload 会被序列化，否则视为 text)。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码。0 表示代理请求成功（无论目标服务器返回何种状态码），非 0 表示代理请求本身失败。"),
      Msg: z.string().describe("错误信息。代理请求成功时为空字符串。"),
      Data: z.object({
        status: z.string().describe("目标服务器返回的 HTTP 状态文本，例如 '200 OK'。"),
        statusCode: z.number().int().describe("目标服务器返回的 HTTP 状态码，例如 200。"),
        proto: z.string().describe("目标服务器响应的 HTTP 协议版本，例如 'HTTP/1.1'。"),
        headers: z.record(z.array(z.string())).describe("目标服务器返回的 HTTP 响应头，键为头域名，值为字符串数组织。例如 {'Content-Type': ['application/json']}"),
        cookies: z.array(z.object({
          Name: z.string(),
          Value: z.string(),
          Path: z.string().optional(),
          Domain: z.string().optional(),
          Expires: z.string().datetime({ offset: true }).optional(), // Assuming ISO 8601 format from Go time.Time
          RawExpires: z.string().optional(),
          MaxAge: z.number().int().optional(),
          Secure: z.boolean().optional(),
          HttpOnly: z.boolean().optional(),
          SameSite: z.union([z.literal(0), z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).optional().describe("SameSite policy: 0 (None), 1 (Lax), 2 (Strict), 3 (default)"), // http.SameSite
          Raw: z.string().optional(),
          Unparsed: z.array(z.string()).optional()
        })).optional().describe("目标服务器返回的 Cookies 数组。"),
        body: z.string().describe("目标服务器返回的响应体内容，经过 Base64 编码。"),
        url: z.string().url().describe("实际请求的最终 URL (可能经过重定向)。"),
        length: z.number().int().describe("目标服务器返回的响应体原始长度 (解码前)。"),
        isText: z.boolean().describe("指示目标服务器返回的响应体是否为文本类型。"),
      }).nullable().describe("当代理请求成功时，包含目标服务器的详细响应信息。代理失败时为 null。"),
    })
  }
];
