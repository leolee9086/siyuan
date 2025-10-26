export const cloudApiDefs = [
  {
    method: "POST",
    endpoint: "/api/cloud/getCloudSpace",
    en: "getCloudSpace",
    zh_cn: "获取云端空间与流量信息",
    description: "获取用户的云端存储空间使用情况、流量消耗以及同步和备份状态等信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("API 调用返回码，0 表示成功，1 表示获取信息时发生错误"),
      Msg: z.string().describe("API 调用返回消息，错误时包含错误信息"),
      Data: z.object({
        sync: z.object({
          size: z.number().int().describe("云端同步数据的大小 (字节)"),
          hSize: z.string().describe("人类可读的云端同步数据大小 (例如 '1.2 GB')，仅当服务商为思源官方时有效，其他为'-'"),
          updated: z.string().describe("云端同步数据最后更新时间戳 (格式可能为 Unix 时间戳或特定日期字符串)"),
          cloudName: z.string().describe("云端同步数据存放的目录名 (例如 'main')"),
          saveDir: z.string().describe("本地同步数据实际存放的目录绝对路径")
        }).describe("云同步相关信息"),
        backup: z.object({
          size: z.number().int().describe("云端备份数据的大小 (字节)"),
          hSize: z.string().describe("人类可读的云端备份数据大小 (例如 '500 MB')，仅当服务商为思源官方时有效，其他为'-'"),
          updated: z.string().describe("云端备份数据最后更新时间戳 (格式可能为 Unix 时间戳或特定日期字符串)"),
          saveDir: z.string().describe("本地备份数据实际存放的目录绝对路径")
        }).describe("云备份相关信息"),
        hAssetSize: z.string().describe("人类可读的云端资源文件总大小 (例如 '300 MB')，仅当服务商为思源官方时有效，其他为'-'"),
        hSize: z.string().describe("人类可读的云端已用空间总大小 (同步数据 + 备份数据 + 资源文件，例如 '2 GB')，仅当服务商为思源官方时有效，其他为'-'"),
        hTotalSize: z.string().describe("人类可读的云端总可用空间大小 (例如 '10 GB')，仅当服务商为思源官方时有效，其他为'-'"),
        hExchangeSize: z.string().describe("人类可读的积分兑换云空间大小 (例如 '1 GB')，仅当服务商为思源官方时有效，其他为'-'"),
        hTrafficUploadSize: z.string().describe("人类可读的当月已用上传流量 (例如 '5 GB')，仅当服务商为思源官方时有效，其他为'-'"),
        hTrafficDownloadSize: z.string().describe("人类可读的当月已用下载流量 (例如 '12 GB')，仅当服务商为思源官方时有效，其他为'-'"),
        hTrafficAPIGet: z.string().describe("人类可读的当月 API GET 请求次数 (例如 '1.5 k')，仅当服务商为思源官方时有效，其他为'-'"),
        hTrafficAPIPut: z.string().describe("人类可读的当月 API PUT 请求次数 (例如 '800')，仅当服务商为思源官方时有效，其他为'-'")
      }).describe("云端空间和流量的详细信息")
    })
  }
];
