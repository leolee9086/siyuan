export const syncApiDefs = [
  {
    method: "POST",
    endpoint: "/api/sync/createCloudSyncDir",
    en: "createCloudSyncDir",
    zh_cn: "创建云端同步目录",
    description: "在云端存储中创建一个新的同步目录。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      name: z.string().describe("要创建的云端同步目录的名称。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。如果创建失败，Data 可能包含 { closeTimeout: 5000 }。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/exportSyncProviderS3",
    en: "exportSyncProviderS3",
    zh_cn: "导出S3同步配置",
    description: "将会话中当前的 S3 同步配置加密并打包成 .zip 文件供导出。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.object({
        name: z.string().describe("导出的文件名 (不含 .zip 后缀)。"),
        zip: z.string().describe("导出的 .zip 文件在服务端的临时路径，前端可据此下载。")
      }).nullable().describe("成功时返回导出文件的名称和路径，失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/exportSyncProviderWebDAV",
    en: "exportSyncProviderWebDAV",
    zh_cn: "导出WebDAV同步配置",
    description: "将会话中当前的 WebDAV 同步配置加密并打包成 .zip 文件供导出。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.object({
        name: z.string().describe("导出的文件名 (不含 .zip 后缀)。"),
        zip: z.string().describe("导出的 .zip 文件在服务端的临时路径，前端可据此下载。")
      }).nullable().describe("成功时返回导出文件的名称和路径，失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/getBootSync",
    en: "getBootSync",
    zh_cn: "检查启动时同步状态",
    description: "检查应用启动时数据同步是否成功完成。此接口仅在管理员角色下，且同步已启用且成功时返回特定提示。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码。0 表示未满足特定条件（非管理员、同步未启用、启动时同步未成功），1 表示启动时同步成功。其他值表示失败。注意这里的 Code 含义比较特殊。 "),
      Msg: z.string().describe("接口返回的消息。Code 为 1 时，Msg 为提示信息（如 '启动时同步数据完毕'）。Code 为 0 时通常为空。 "),
      Data: z.null().describe("此接口不通过 Data 返回数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/getSyncInfo",
    en: "getSyncInfo",
    zh_cn: "获取当前同步状态信息",
    description: "获取当前的同步状态、最后同步时间、以及当前在线的内核实例等信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.object({
        synced: z.string().describe("最后成功同步的时间戳 (格式如 'YYYY-MM-DD HH:mm:ss')，如果从未同步则为空字符串。"),
        stat: z.string().describe("当前的同步状态文本描述。如果同步未启用，则为 '同步未启用' 或类似提示。"),
        kernels: z.array(z.string()).describe("当前在线的其他内核实例的 ID 列表。"),
        kernel: z.string().describe("当前内核实例的 ID。")
      }).nullable().describe("成功时返回同步状态信息对象，失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/importSyncProviderS3",
    en: "importSyncProviderS3",
    zh_cn: "导入S3同步配置",
    description: "通过上传的 .zip 或 .json 文件导入 S3 同步配置。导入的配置会经过解密和验证。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.object({
        s3: z.object({
          endpoint: z.string().describe("S3 服务的 Endpoint。如：s3.amazonaws.com"),
          accessKeyID: z.string().describe("S3 Access Key ID。敏感信息，通常前端不直接展示。"),
          secretAccessKey: z.string().describe("S3 Secret Access Key。敏感信息，通常前端不直接展示。"),
          bucket: z.string().describe("S3 Bucket 名称。"),
          region: z.string().describe("S3 Bucket 所在区域。如：us-east-1"),
          cdn: z.string().optional().describe("CDN 地址，可选。")
        }).describe("导入并应用成功的 S3 配置对象。部分敏感字段可能不会完整返回或不应直接展示。")
      }).nullable().describe("成功时返回导入的 S3 配置对象，失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/importSyncProviderWebDAV",
    en: "importSyncProviderWebDAV",
    zh_cn: "导入WebDAV同步配置",
    description: "通过上传的 .zip 或 .json 文件导入 WebDAV 同步配置。导入的配置会经过解密和验证。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.object({
        webdav: z.object({
          endpoint: z.string().describe("WebDAV 服务的 URL。如：https://dav.example.com/dav"),
          username: z.string().describe("WebDAV 用户名。敏感信息，通常前端不直接展示。"),
          password: z.string().describe("WebDAV 密码。敏感信息，通常前端不直接展示。")
        }).describe("导入并应用成功的 WebDAV 配置对象。部分敏感字段可能不会完整返回或不应直接展示。")
      }).nullable().describe("成功时返回导入的 WebDAV 配置对象，失败时为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/listCloudSyncDir",
    en: "listCloudSyncDir",
    zh_cn: "列出云端同步目录",
    description: "列出当前配置的云端存储中可用的同步目录及其大小信息。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，1 表示获取失败（如网络错误、配置错误）。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串，失败时包含错误信息。"),
      Data: z.object({
        syncDirs: z.array(z.object({
          name: z.string().describe("同步目录的名称。"),
          hSize: z.string().describe("目录大小的人类可读格式 (例如 '1.2 MB')。"),
          size: z.number().describe("目录大小，单位字节。")
        })).describe("云端同步目录列表。"),
        hSize: z.string().describe("所有同步目录的总大小的人类可读格式。"),
        checkedSyncDir: z.string().describe("当前内核配置中正在使用的云端同步目录名称。")
      }).nullable().describe("成功时返回包含目录列表和总大小等信息的对象。如果获取失败（Code为1），Data 可能包含 { closeTimeout: 5000 }。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/performBootSync",
    en: "performBootSync",
    zh_cn: "执行启动时数据同步",
    description: "执行启动时的数据同步流程。此接口会触发 model.BootSyncData()。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({}),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码。model.BootSyncSucc (通常为0或1，表示启动同步的结果) 会被赋给 Code。具体含义需参考内核实现。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("此接口不通过 Data 返回具体数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/performSync",
    en: "performSync",
    zh_cn: "执行数据同步",
    description: "执行数据同步操作。对于非云端同步模式 (mode != 3)，将触发 model.SyncData(true)。对于云端同步模式 (mode === 3)，需要明确指定同步方向 (upload: true/false)。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      mobileSwitch: z.boolean().optional().describe("是否为移动端前后台切换触发的同步。如果是 true，且用户未登录或同步未启用，则不执行操作。仅对 Android 端有特殊逻辑。 "),
      upload: z.boolean().optional().describe("仅在同步模式为3 (云端同步-完全手动) 时有效。true 表示上传，false 表示下载。如果同步模式为3但此参数未提供，则不执行操作。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功接收请求并开始处理（同步是异步过程），其他表示接收参数错误等。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("此接口不通过 Data 返回具体数据。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/removeCloudSyncDir",
    en: "removeCloudSyncDir",
    zh_cn: "移除云端同步目录",
    description: "从云端存储中移除指定的同步目录。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      name: z.string().describe("要移除的云端同步目录的名称。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。如果移除失败，Data 可能包含 { closeTimeout: 5000 }。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setCloudSyncDir",
    en: "setCloudSyncDir",
    zh_cn: "设置当前云端同步目录",
    description: "设置当前内核实例使用的云端同步目录。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      name: z.string().describe("要设置为当前同步目录的云端目录名称。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。如果设置失败，Data 可能包含 { closeTimeout: 5000 }。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncEnable",
    en: "setSyncEnable",
    zh_cn: "设置是否启用同步",
    description: "设置是否启用数据同步功能。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      enabled: z.boolean().describe("是否启用同步。true 为启用，false 为禁用。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncGenerateConflictDoc",
    en: "setSyncGenerateConflictDoc",
    zh_cn: "设置同步是否生成冲突文档",
    description: "设置在数据同步过程中发生内容冲突时，是否自动生成冲突副本文件。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      generateConflictDoc: z.boolean().describe("是否生成冲突文档。true 为生成，false 为不生成。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncInterval",
    en: "setSyncInterval",
    zh_cn: "设置自动同步间隔",
    description: "设置自动数据同步的时间间隔（单位：分钟）。设置后会重置同步计时器。",
    needAuth: true,
    needAdminRole: false,
    unavailableIfReadonly: false,
    zodRequestSchema: (z) => ({
      syncInterval: z.number().int().min(1).describe("自动同步的时间间隔，单位为分钟。例如，输入 5 表示每5分钟同步一次。最小值为1分钟。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncMode",
    en: "setSyncMode",
    zh_cn: "设置同步模式",
    description: "设置数据同步的模式。例如：0 表示自动同步，1 表示手动同步，3 表示云端双向同步时需手动触发单向同步。设置后会重置同步计时器。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      syncMode: z.number().int().min(0).describe("同步模式。例如：0-自动, 1-手动, 3-云端完全手动。具体可用值请参考内核实现或相关文档。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncPerception",
    en: "setSyncPerception",
    zh_cn: "设置同步感知",
    description: "设置是否启用同步感知功能。启用后，当检测到远程数据更新时，可能会有相应的提示或行为。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      syncPerception: z.boolean().describe("是否启用同步感知。true 为启用，false 为禁用。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncProvider",
    en: "setSyncProvider",
    zh_cn: "设置同步服务提供商",
    description: "设置当前使用的数据同步服务提供商，例如 S3、WebDAV 或本地文件夹。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      syncProvider: z.string().describe("同步服务提供商的标识符。例如：'S3', 'WebDAV', 'LocalFolder'。具体可用值请参考内核实现。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncProviderLocal",
    en: "setSyncProviderLocal",
    zh_cn: "设置本地文件夹同步路径",
    description: "设置当同步服务提供商为本地文件夹时，所使用的本地文件夹路径。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      syncProviderLocalPath: z.string().describe("本地同步文件夹的绝对路径。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncProviderS3",
    en: "setSyncProviderS3",
    zh_cn: "设置S3同步配置",
    description: "设置使用 S3作为同步服务提供商时的详细配置信息，如 Access Key, Secret Key, Endpoint, Bucket 等。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      s3AccessKeyID: z.string().describe("S3 Access Key ID."),
      s3SecretAccessKey: z.string().describe("S3 Secret Access Key."),
      s3Endpoint: z.string().describe("S3 服务的 Endpoint。例如：s3.amazonaws.com"),
      s3Region: z.string().describe("S3 Bucket 所在区域。例如：us-east-1"),
      s3Bucket: z.string().describe("S3 Bucket 名称。"),
      s3CDN: z.string().optional().describe("S3 关联的 CDN 地址，可选。如果为空字符串，表示不使用 CDN。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  },
  {
    method: "POST",
    endpoint: "/api/sync/setSyncProviderWebDAV",
    en: "setSyncProviderWebDAV",
    zh_cn: "设置WebDAV同步配置",
    description: "设置使用 WebDAV 作为同步服务提供商时的详细配置信息，如 Endpoint, 用户名和密码。",
    needAuth: true,
    needAdminRole: true,
    unavailableIfReadonly: true,
    zodRequestSchema: (z) => ({
      webdavEndpoint: z.string().url().describe("WebDAV 服务的 URL。例如：https://dav.example.com/remote.php/dav"),
      webdavUsername: z.string().describe("WebDAV 用户名。"),
      webdavPassword: z.string().describe("WebDAV 密码。")
    }),
    zodResponseSchema: (z) => ({
      Code: z.number().describe("错误码，0 表示成功，其他表示失败。"),
      Msg: z.string().describe("接口返回的消息，成功时通常为空字符串。"),
      Data: z.null().describe("接口成功执行时，Data 固定为 null。")
    })
  }
];
