export const accountApiDefs = [
  {
    method: "POST",
    endpoint: "/api/account/checkActivationcode",
    en: "checkActivationcode",
    zh_cn: "检查激活码",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    description: "检查用户输入的激活码是否有效。",
    zodRequestSchema: (z) => ({ data: z.string().describe("要检查的激活码") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，其他表示失败"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("返回数据，此接口通常为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/account/deactivate",
    en: "deactivateUser",
    zh_cn: "注销账号",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    description: "注销当前用户账号。",
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，其他表示失败"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("返回数据，此接口通常为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/account/login",
    en: "login",
    zh_cn: "登录账号",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    description: "用户登录，需要提供用户名、密码、验证码和云端区域。",
    zodRequestSchema: (z) => ({
      userName: z.string().describe("用户名"),
      userPassword: z.string().describe("用户密码"),
      captcha: z.string().describe("验证码"),
      cloudRegion: z.number().describe("云端区域代码，例如 0 表示中国区")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，其他表示失败"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("登录成功时可能包含用户信息，失败时为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/account/startFreeTrial",
    en: "startFreeTrial",
    zh_cn: "开始免费试用",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    description: "为当前用户开启免费试用。",
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，其他表示失败"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("返回数据，此接口通常为 null")
    })
  },
  {
    method: "POST",
    endpoint: "/api/account/useActivationcode",
    en: "useActivationcode",
    zh_cn: "使用激活码",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    description: "使用激活码激活账户。",
    zodRequestSchema: (z) => ({ data: z.string().describe("要使用的激活码") }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("返回码，0 表示成功，其他表示失败"),
      Msg: z.string().describe("返回消息"),
      Data: z.any().nullable().describe("返回数据，此接口通常为 null")
    })
  }
];
