// TypeScript definitions for Siyuan API Client

interface AccountCheckActivationcodeParams {
  data: string; // 要检查的激活码
}

interface AccountCheckActivationcodeResponse {
  Code: number; // 返回码，0 表示成功，其他表示失败
  Msg: string; // 返回消息
  Data: any | null;
}

interface AccountDeactivateUserResponse {
  Code: number; // 返回码，0 表示成功，其他表示失败
  Msg: string; // 返回消息
  Data: any | null;
}

interface AccountLoginParams {
  userName: string; // 用户名
  userPassword: string; // 用户密码
  captcha: string; // 验证码
  cloudRegion: number; // 云端区域代码，例如 0 表示中国区
}

interface AccountLoginResponse {
  Code: number; // 返回码，0 表示成功，其他表示失败
  Msg: string; // 返回消息
  Data: any | null;
}

interface AccountStartFreeTrialResponse {
  Code: number; // 返回码，0 表示成功，其他表示失败
  Msg: string; // 返回消息
  Data: any | null;
}

interface AccountUseActivationcodeParams {
  data: string; // 要使用的激活码
}

interface AccountUseActivationcodeResponse {
  Code: number; // 返回码，0 表示成功，其他表示失败
  Msg: string; // 返回消息
  Data: any | null;
}

interface AiChatGPTParams {
  msg: string; // 发送给 ChatGPT 的消息内容
}

interface AiChatGPTResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any; // ChatGPT 的回复内容
}

interface AiChatGPTWithActionParams {
  ids: Array<string>; // 要操作的块 ID 列表
  action: string; // 要执行的动作指令
}

interface AiChatGPTWithActionResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any; // ChatGPT 执行动作后的返回结果
}

interface ArchiveUnzipParams {
  zipPath: string; // 要解压的 .zip 文件的绝对路径或相对于工作空间的路径
  path: string; // 解压到目标目录的绝对路径或相对于工作空间的路径
}

interface ArchiveUnzipResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface ArchiveZipParams {
  path: string; // 要压缩的文件或目录的绝对路径或相对于工作空间的路径
  zipPath: string; // 生成的 .zip 文件保存的绝对路径或相对于工作空间的路径
}

interface ArchiveZipResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AssetFullReindexAssetContentResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AssetGetDocAssetsParams {
  id: string; // 文档块的 ID
}

interface AssetGetDocAssetsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any; // 资源文件对象数组，具体结构未定义
}

interface AssetGetDocImageAssetsParams {
  id: string; // 文档块的 ID
}

interface AssetGetDocImageAssetsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any; // 图片资源文件对象数组，具体结构未定义
}

interface AssetGetFileAnnotationParams {
  path: string; // 资源文件的路径 (例如 assets/xxx.pdf)
}

interface AssetGetFileAnnotationResponseData {
  path: string; // 资源文件的路径
  data: string; // 标注数据 (通常为 XFDF 格式的字符串)
}

interface AssetGetFileAnnotationResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetGetFileAnnotationResponseData;
}

interface AssetGetImageOCRTextParams {
  path: string; // 图片资源文件的路径 (例如 assets/xxx.png)
}

interface AssetGetImageOCRTextResponseData {
  text: string; // OCR 识别出的文本内容
  ocrJSON: any; // 原始 OCR 结果，通常为 JSON 对象，具体结构取决于 OCR 引擎
}

interface AssetGetImageOCRTextResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetGetImageOCRTextResponseData;
}

interface AssetGetMissingAssetsResponseData {
  missingAssets: Array<any>; // 丢失的资源路径列表，具体元素结构未定义
}

interface AssetGetMissingAssetsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetGetMissingAssetsResponseData;
}

interface AssetGetUnusedAssetsResponseData {
  unusedAssets: Array<any>; // 未使用的资源文件对象列表，具体元素结构未定义
}

interface AssetGetUnusedAssetsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetGetUnusedAssetsResponseData;
}

interface AssetInsertLocalAssetsParams {
  assetPaths: Array<string>; // 本地资源文件的绝对路径数组
  id: string; // 要插入资源引用的目标文档块 ID
  isUpload?: boolean;
}

interface AssetInsertLocalAssetsResponseData {
  succMap: Record<string, string>; // 成功插入的资源映射，键为原始文件名，值为在思源中的新资源路径
}

interface AssetInsertLocalAssetsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetInsertLocalAssetsResponseData;
}

interface AssetOcrParams {
  path: string;
}

interface AssetOcrResponseData {
  text: string; // OCR 识别出的文本内容
  ocrJSON: any; // 原始 OCR 结果，通常为 JSON 对象，具体结构取决于 OCR 引擎
}

interface AssetOcrResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetOcrResponseData;
}

interface AssetRemoveUnusedAssetParams {
  path: string;
}

interface AssetRemoveUnusedAssetResponseData {
  path: string; // 被成功移除的资源文件的路径
}

interface AssetRemoveUnusedAssetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetRemoveUnusedAssetResponseData;
}

interface AssetRemoveUnusedAssetsResponseData {
  paths: Array<string>; // 被成功移除的所有未使用资源文件的路径列表
}

interface AssetRemoveUnusedAssetsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetRemoveUnusedAssetsResponseData;
}

interface AssetRenameAssetParams {
  oldPath: string; // 资源文件的当前路径 (例如 assets/old_name.png)
  newName: string; // 资源文件的新名称 (不含路径，例如 new_name.png)
}

interface AssetRenameAssetResponseData {
  newPath: string; // 资源文件重命名后的新路径 (例如 assets/new_name.png)
}

interface AssetRenameAssetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetRenameAssetResponseData;
}

interface AssetResolveAssetPathParams {
  path: string; // 思源笔记中的资源相对路径 (例如 assets/image.png)
}

interface AssetResolveAssetPathResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: string; // 资源文件在文件系统中的绝对路径
}

interface AssetSetFileAnnotationParams {
  path: string; // 资源文件的路径 (例如 assets/xxx.pdf)
  data: string; // 要设置的标注数据 (通常为 XFDF 格式的字符串)
}

interface AssetSetFileAnnotationResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AssetSetImageOCRTextParams {
  path: string; // 图片资源文件的路径 (例如 assets/xxx.png)
  text: string; // 要设置的 OCR 文本内容
}

interface AssetSetImageOCRTextResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AssetStatAssetParams {
  path: string; // 资源文件的 assets/ 路径或本地文件的 file:/// 绝对路径
}

interface AssetStatAssetResponseData {
  size: number; // 文件大小（字节）
  hSize: string; // 人类可读的文件大小 (例如 1.2MB)
  created: number; // 文件创建时间戳 (毫秒)
  hCreated: string; // 人类可读的文件创建时间
  updated: number; // 文件最后修改时间戳 (毫秒)
  hUpdated: string; // 人类可读的文件最后修改时间
}

interface AssetStatAssetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetStatAssetResponseData;
}

interface AssetUploadParams {
  assetPath?: string;
  id?: string;
  files: any; // 通过 FormData 上传的文件对象或文件对象列表，此字段仅用于类型提示，实际通过 FormData 传递
}

interface AssetUploadResponseData {
  errFiles: Array<string>; // 上传失败的文件名列表
  succMap: Record<string, string>; // 上传成功的文件映射，键为原始文件名，值为在思源中的新资源路径 (例如 assets/image.png)
}

interface AssetUploadResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AssetUploadResponseData;
}

interface AssetUploadCloudParams {
  id: string; // 文档块的 ID，将上传此文档及其子文档中引用的所有本地资源
}

interface AssetUploadCloudResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AttrBatchGetBlockAttrsParams {
  ids: Array<string>; // 要获取属性的块 ID 数组
}

interface AttrBatchGetBlockAttrsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: Record<string, Record<string, string>>; // 一个对象，键为块 ID，值为该块的属性对象 (属性名: 属性值)
}

interface AttrBatchSetBlockAttrsParamsBlockAttrsItem {
  id: string; // 块 ID
  attrs: Record<string, string | null>; // 要设置的属性对象 (属性名: 属性值)。如果属性值为 null，则删除该属性。
}

interface AttrBatchSetBlockAttrsParams {
  blockAttrs: Array<AttrBatchSetBlockAttrsParamsBlockAttrsItem>; // 包含多个块属性设置的对象数组
}

interface AttrBatchSetBlockAttrsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AttrGetBlockAttrsParams {
  id: string; // 要获取属性的块 ID
}

interface AttrGetBlockAttrsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: Record<string, string>; // 该块的属性对象 (属性名: 属性值)
}

interface AttrGetBookmarkLabelsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: Array<string>; // 书签标签字符串数组
}

interface AttrResetBlockAttrsParams {
  id: string; // 要重置属性的块 ID
  attrs: Record<string, string>; // 要重置的属性对象 (属性名: 期望的当前属性值)。只有当块的属性值与此处提供的值匹配时，该属性才会被移除。
}

interface AttrResetBlockAttrsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AttrSetBlockAttrsParams {
  id: string; // 要设置属性的块 ID
  attrs: Record<string, string | null>; // 要设置的属性对象 (属性名: 属性值)。如果属性值为 null，则删除该属性。
}

interface AttrSetBlockAttrsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvAddAttributeViewBlocksParams {
  avID: string; // 属性视图的 ID
  blockID?: string;
  previousID?: string;
  ignoreFillFilter?: boolean;
  srcs: Array<Record<string, any>>; // 要添加的源数据块信息数组，具体结构取决于源类型
}

interface AvAddAttributeViewBlocksResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvAddAttributeViewKeyParams {
  avID: string; // 属性视图的 ID
  keyID: string; // 新列的 ID，如果为空则自动生成
  keyName: string; // 新列的名称
  keyType: string; // 新列的类型 (e.g., 'text', 'number', 'select')
  keyIcon: string; // 新列的图标 (Emoji 或思源图标名)
  previousKeyID: string; // 新列将插入到此列 ID 之前
}

interface AvAddAttributeViewKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvAppendAttributeViewDetachedBlocksWithValuesParams {
  avID: string; // 属性视图的 ID
  blocksValues: Array<Array<any>>; // 二维数组，外层数组代表多个新块，内层数组代表每个块对应各列的初始值
}

interface AvAppendAttributeViewDetachedBlocksWithValuesResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvDuplicateAttributeViewBlockParams {
  avID: string; // 要复制的属性视图块的 ID
}

interface AvDuplicateAttributeViewBlockResponseData {
  avID: string; // 新复制的属性视图的 ID
  blockID: string; // 新复制的属性视图块的 ID
}

interface AvDuplicateAttributeViewBlockResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvDuplicateAttributeViewBlockResponseData | null;
}

interface AvGetAttributeViewParams {
  id: string; // 属性视图的 ID
}

interface AvGetAttributeViewResponseData {
  av: any; // 属性视图对象的详细信息，具体结构复杂，参考前端实际使用或Go源码 `kernel.AttributeView`
}

interface AvGetAttributeViewResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvGetAttributeViewResponseData | null;
}

interface AvGetAttributeViewFilterSortParams {
  id: string; // 属性视图的 ID
  blockID: string; // 属性视图关联的块 ID (通常与属性视图ID相同)
}

interface AvGetAttributeViewFilterSortResponseData {
  filters: Array<any>; // 筛选条件对象数组，具体结构参考 `kernel.AVFilter`
  sorts: Array<any>; // 排序规则对象数组，具体结构参考 `kernel.AVSort`
}

interface AvGetAttributeViewFilterSortResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvGetAttributeViewFilterSortResponseData | null;
}

interface AvGetAttributeViewKeysParams {
  id: string; // 属性视图的 ID
}

interface AvGetAttributeViewKeysResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: Array<any> | null;
}

interface AvGetAttributeViewKeysByAvIDParams {
  avID: string; // 属性视图的 ID
}

interface AvGetAttributeViewKeysByAvIDResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: Array<any> | null;
}

interface AvGetAttributeViewPrimaryKeyValuesParams {
  id: string; // 属性视图的 ID
  keyword?: string;
  page?: number;
  pageSize?: number;
}

interface AvGetAttributeViewPrimaryKeyValuesResponseData {
  name: string; // 主键列的名称
  blockIDs: Array<string>; // 匹配的主键值对应的块 ID 列表
  rows: Array<any>; // 匹配的行数据数组，具体结构可能包含主键值和其他相关信息
}

interface AvGetAttributeViewPrimaryKeyValuesResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvGetAttributeViewPrimaryKeyValuesResponseData | null;
}

interface AvGetMirrorDatabaseBlocksParams {
  avID: string; // 属性视图的 ID
}

interface AvGetMirrorDatabaseBlocksResponseDataRefDefsItem {
  RefID: string; // 引用的块ID (通常是属性视图本身)
  DefIDs: Array<string>; // 被引用的定义块ID列表 (镜像块)
}

interface AvGetMirrorDatabaseBlocksResponseData {
  refDefs: Array<AvGetMirrorDatabaseBlocksResponseDataRefDefsItem>; // 引用定义对象数组
}

interface AvGetMirrorDatabaseBlocksResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvGetMirrorDatabaseBlocksResponseData | null;
}

interface AvRemoveAttributeViewBlocksParams {
  avID: string; // 属性视图的 ID
  srcIDs: Array<string>; // 要移除的源数据块的 ID 数组
}

interface AvRemoveAttributeViewBlocksResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvRemoveAttributeViewKeyParams {
  avID: string; // 属性视图的 ID
  keyID: string; // 要移除的列的 ID
  removeRelationDest?: boolean;
}

interface AvRemoveAttributeViewKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvRenderAttributeViewParams {
  id: string; // 属性视图的 ID
  viewID?: string;
  query?: string;
  page?: number;
  pageSize?: number;
}

interface AvRenderAttributeViewResponseData {
  name: string; // 属性视图的名称
  id: string; // 属性视图的 ID
  viewType: any; // 当前视图的类型 (具体类型需查阅 kernel.AVViewType)
  viewID: any; // 当前视图的 ID (具体类型需查阅 kernel.AVViewID)
  views: Array<any>; // 属性视图包含的所有视图定义数组，元素结构参考 `kernel.AVView`
  view: any; // 当前渲染的视图的详细数据，结构复杂，取决于视图类型
  isMirror: boolean; // 是否为镜像属性视图
}

interface AvRenderAttributeViewResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvRenderAttributeViewResponseData | null;
}

interface AvRenderHistoryAttributeViewParams {
  id: string; // 属性视图的 ID
  created: string; // 历史版本创建的时间戳字符串 (毫秒级)
}

interface AvRenderHistoryAttributeViewResponseData {
  name: string; // 属性视图的名称
  id: string; // 属性视图的 ID
  viewType: any; // 视图的类型
  viewID: any; // 视图的 ID
  views: Array<any>; // 所有视图定义数组
  view: any; // 当前渲染的视图的详细数据
  isMirror: boolean; // 是否为镜像
}

interface AvRenderHistoryAttributeViewResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvRenderHistoryAttributeViewResponseData | null;
}

interface AvRenderSnapshotAttributeViewParams {
  snapshot: string; // 快照的路径或标识
  id: string; // 属性视图的 ID
}

interface AvRenderSnapshotAttributeViewResponseData {
  name: string; // 属性视图的名称
  id: string; // 属性视图的 ID
  viewType: any; // 视图的类型
  viewID: any; // 视图的 ID
  views: Array<any>; // 所有视图定义数组
  view: any; // 当前渲染的视图的详细数据
  isMirror: boolean; // 是否为镜像
}

interface AvRenderSnapshotAttributeViewResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvRenderSnapshotAttributeViewResponseData | null;
}

interface AvSearchAttributeViewParams {
  keyword: string; // 搜索关键词
  excludes?: Array<string>;
}

interface AvSearchAttributeViewResponseData {
  results: Array<any>; // 搜索结果对象数组，每个对象包含属性视图的基本信息 (如 id, name)
}

interface AvSearchAttributeViewResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvSearchAttributeViewResponseData | null;
}

interface AvSearchAttributeViewNonRelationKeyParams {
  avID: string; // 属性视图的 ID
  keyword: string; // 搜索关键词
}

interface AvSearchAttributeViewNonRelationKeyResponseData {
  keys: Array<any>; // 匹配的非关联列定义对象数组，结构参考 `kernel.AVKey`
}

interface AvSearchAttributeViewNonRelationKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvSearchAttributeViewNonRelationKeyResponseData | null;
}

interface AvSearchAttributeViewRelationKeyParams {
  avID: string; // 属性视图的 ID
  keyword: string; // 搜索关键词
}

interface AvSearchAttributeViewRelationKeyResponseData {
  keys: Array<any>; // 匹配的关联列定义对象数组，结构参考 `kernel.AVKey`
}

interface AvSearchAttributeViewRelationKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvSearchAttributeViewRelationKeyResponseData | null;
}

interface AvSetAttributeViewBlockAttrParams {
  avID: string; // 属性视图的 ID
  keyID: string; // 列的 ID (Key ID)
  rowID: string; // 行的 ID (通常是数据块的 ID)
  value: any; // 要设置的新值，具体类型取决于列的类型
}

interface AvSetAttributeViewBlockAttrResponseData {
  value: any; // 成功设置后的值，可能经过转换或处理
}

interface AvSetAttributeViewBlockAttrResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: AvSetAttributeViewBlockAttrResponseData | null;
}

interface AvSetDatabaseBlockViewParams {
  id: string; // 数据库块（属性视图块）的 ID
  viewID: string; // 要设置为默认视图的视图 ID
}

interface AvSetDatabaseBlockViewResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvSortAttributeViewKeyParams {
  avID: string; // 属性视图的 ID
  keyID: string; // 要移动的列的 ID
  previousKeyID: string; // 目标位置：将列移动到此列 ID 之前
}

interface AvSortAttributeViewKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface AvSortAttributeViewViewKeyParams {
  avID: string; // 属性视图的 ID
  viewID: string; // 特定视图的 ID
  keyID: string; // 要移动的列的 ID
  previousKeyID: string; // 目标位置：将列移动到此列 ID 之前
}

interface AvSortAttributeViewViewKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface BazaarBatchUpdatePackageParams {
  frontend: string; // 客户端类型，通常为 'frontend' 或 'app'
}

interface BazaarBatchUpdatePackageResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: any | null;
}

interface BazaarGetBazaarIconParams {
  keyword?: string;
}

interface BazaarGetBazaarIconResponseData {
  packages: Array<any>; // 集市图标包对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetBazaarIconResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetBazaarIconResponseData | null;
}

interface BazaarGetBazaarPackageREAMEParams {
  repoURL: string; // 包所在的仓库 URL
  repoHash: string; // 包在仓库中的特定提交哈希或版本标签
  packageType: string; // 包类型 (例如 'icons', 'plugins', 'themes', 'templates', 'widgets')
}

interface BazaarGetBazaarPackageREAMEResponseData {
  html: string; // README 文件的 HTML 内容
}

interface BazaarGetBazaarPackageREAMEResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetBazaarPackageREAMEResponseData | null;
}

interface BazaarGetBazaarPluginParams {
  frontend: string; // 客户端类型，通常为 'frontend' 或 'app'
  keyword?: string;
}

interface BazaarGetBazaarPluginResponseData {
  packages: Array<any>; // 集市插件包对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetBazaarPluginResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetBazaarPluginResponseData | null;
}

interface BazaarGetBazaarTemplateParams {
  keyword?: string;
}

interface BazaarGetBazaarTemplateResponseData {
  packages: Array<any>; // 集市模板包对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetBazaarTemplateResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetBazaarTemplateResponseData | null;
}

interface BazaarGetBazaarThemeParams {
  keyword?: string;
}

interface BazaarGetBazaarThemeResponseData {
  packages: Array<any>; // 集市主题包对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetBazaarThemeResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetBazaarThemeResponseData | null;
}

interface BazaarGetBazaarWidgetParams {
  keyword?: string;
}

interface BazaarGetBazaarWidgetResponseData {
  packages: Array<any>; // 集市挂件包对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetBazaarWidgetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetBazaarWidgetResponseData | null;
}

interface BazaarGetInstalledIconParams {
  keyword?: string;
}

interface BazaarGetInstalledIconResponseData {
  packages: Array<any>; // 已安装图标包对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetInstalledIconResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetInstalledIconResponseData | null;
}

interface BazaarGetInstalledPluginParams {
  frontend: string; // 客户端类型，通常为 'frontend' 或 'app'
  keyword?: string;
}

interface BazaarGetInstalledPluginResponseData {
  packages: Array<any>; // 已安装插件对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetInstalledPluginResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetInstalledPluginResponseData | null;
}

interface BazaarGetInstalledTemplateParams {
  keyword?: string;
}

interface BazaarGetInstalledTemplateResponseData {
  packages: Array<any>; // 已安装模板对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetInstalledTemplateResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetInstalledTemplateResponseData | null;
}

interface BazaarGetInstalledThemeParams {
  keyword?: string;
}

interface BazaarGetInstalledThemeResponseData {
  packages: Array<any>; // 已安装主题对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetInstalledThemeResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetInstalledThemeResponseData | null;
}

interface BazaarGetInstalledWidgetParams {
  keyword?: string;
}

interface BazaarGetInstalledWidgetResponseData {
  packages: Array<any>; // 已安装挂件对象数组，具体结构参考 `kernel.BazaarPackage`
}

interface BazaarGetInstalledWidgetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetInstalledWidgetResponseData | null;
}

interface BazaarGetUpdatedPackageParams {
  frontend: string; // 客户端类型，通常为 'frontend' 或 'app'
}

interface BazaarGetUpdatedPackageResponseData {
  plugins: Array<any>; // 可更新的插件列表，元素结构参考 `kernel.BazaarPackage`
  widgets: Array<any>; // 可更新的挂件列表，元素结构参考 `kernel.BazaarPackage`
  icons: Array<any>; // 可更新的图标包列表，元素结构参考 `kernel.BazaarPackage`
  themes: Array<any>; // 可更新的主题列表，元素结构参考 `kernel.BazaarPackage`
  templates: Array<any>; // 可更新的模板列表，元素结构参考 `kernel.BazaarPackage`
}

interface BazaarGetUpdatedPackageResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarGetUpdatedPackageResponseData | null;
}

interface BazaarInstallBazaarIconParams {
  repoURL: string; // 图标包所在的仓库 URL
  repoHash: string; // 图标包在仓库中的特定提交哈希或版本标签
  packageName: string; // 图标包的名称 (通常是仓库名)
  keyword?: string;
}

interface BazaarInstallBazaarIconResponseData {
  packages: Array<any>; // 更新后的已安装图标包列表，元素结构参考 `kernel.BazaarPackage`
  appearance: any; // 更新后的外观设置对象，具体结构参考 `conf.Appearance`
}

interface BazaarInstallBazaarIconResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarInstallBazaarIconResponseData | null;
}

interface BazaarInstallBazaarPluginParams {
  repoURL: string; // 插件所在的仓库 URL
  repoHash: string; // 插件在仓库中的特定提交哈希或版本标签
  packageName: string; // 插件的名称 (通常是仓库名)
  frontend: string; // 客户端类型，通常为 'frontend' 或 'app'
  keyword?: string;
}

interface BazaarInstallBazaarPluginResponseData {
  packages: Array<any>; // 更新后的已安装插件列表，元素结构参考 `kernel.BazaarPackage`
}

interface BazaarInstallBazaarPluginResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarInstallBazaarPluginResponseData | null;
}

interface BazaarInstallBazaarTemplateParams {
  repoURL: string; // 模板所在的仓库 URL
  repoHash: string; // 模板在仓库中的特定提交哈希或版本标签
  packageName: string; // 模板的名称 (通常是仓库名)
  keyword?: string;
}

interface BazaarInstallBazaarTemplateResponseData {
  packages: Array<any>; // 更新后的已安装模板列表，元素结构参考 `kernel.BazaarPackage`
}

interface BazaarInstallBazaarTemplateResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarInstallBazaarTemplateResponseData | null;
}

interface BazaarInstallBazaarThemeParams {
  repoURL: string; // 主题所在的仓库 URL
  repoHash: string; // 主题在仓库中的特定提交哈希或版本标签
  packageName: string; // 主题的名称 (通常是仓库名)
  mode: number; // 主题模式 (0: 亮色, 1: 暗色, 2: 根据系统)
  update?: boolean;
  keyword?: string;
}

interface BazaarInstallBazaarThemeResponseData {
  packages: Array<any>; // 更新后的已安装主题列表，元素结构参考 `kernel.BazaarPackage`
  appearance: any; // 更新后的外观设置对象，具体结构参考 `conf.Appearance`
}

interface BazaarInstallBazaarThemeResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarInstallBazaarThemeResponseData | null;
}

interface BazaarInstallBazaarWidgetParams {
  repoURL: string; // 挂件所在的仓库 URL
  repoHash: string; // 挂件在仓库中的特定提交哈希或版本标签
  packageName: string; // 挂件的名称 (通常是仓库名)
  keyword?: string;
}

interface BazaarInstallBazaarWidgetResponseData {
  packages: Array<any>; // 更新后的已安装挂件列表，元素结构参考 `kernel.BazaarPackage`
}

interface BazaarInstallBazaarWidgetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarInstallBazaarWidgetResponseData | null;
}

interface BazaarUninstallBazaarIconParams {
  packageName: string; // 要卸载的图标包的名称
  keyword?: string;
}

interface BazaarUninstallBazaarIconResponseData {
  packages: Array<any>; // 更新后的已安装图标包列表，元素结构参考 `kernel.BazaarPackage`
  appearance: any; // 更新后的外观设置对象，具体结构参考 `conf.Appearance`
}

interface BazaarUninstallBazaarIconResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarUninstallBazaarIconResponseData | null;
}

interface BazaarUninstallBazaarPluginParams {
  packageName: string; // 要卸载的插件的名称
  frontend: string; // 客户端类型，通常为 'frontend' 或 'app'
  keyword?: string;
}

interface BazaarUninstallBazaarPluginResponseData {
  packages: Array<any>; // 更新后的已安装插件列表，元素结构参考 `kernel.BazaarPackage`
}

interface BazaarUninstallBazaarPluginResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarUninstallBazaarPluginResponseData | null;
}

interface BazaarUninstallBazaarTemplateParams {
  packageName: string; // 要卸载的模板的名称
  keyword?: string;
}

interface BazaarUninstallBazaarTemplateResponseData {
  packages: Array<any>; // 更新后的已安装模板列表，元素结构参考 `kernel.BazaarPackage`
}

interface BazaarUninstallBazaarTemplateResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarUninstallBazaarTemplateResponseData | null;
}

interface BazaarUninstallBazaarThemeParams {
  packageName: string; // 要卸载的主题的名称
  mode: number; // 主题模式 (0: 亮色, 1: 暗色, 2: 根据系统)，用于确定要卸载哪个模式下的主题或重置相关配置
  keyword?: string;
}

interface BazaarUninstallBazaarThemeResponseData {
  packages: Array<any>; // 更新后的已安装主题列表，元素结构参考 `kernel.BazaarPackage`
  appearance: any; // 更新后的外观设置对象，具体结构参考 `conf.Appearance`
}

interface BazaarUninstallBazaarThemeResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarUninstallBazaarThemeResponseData | null;
}

interface BazaarUninstallBazaarWidgetParams {
  packageName: string; // 要卸载的挂件的名称
  keyword?: string;
}

interface BazaarUninstallBazaarWidgetResponseData {
  packages: Array<any>; // 更新后的已安装挂件列表，元素结构参考 `kernel.BazaarPackage`
}

interface BazaarUninstallBazaarWidgetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 返回消息
  Data: BazaarUninstallBazaarWidgetResponseData | null;
}

interface BlockAppendBlockParams {
  data: string; // 要插入的内容，可以是 Markdown 或 DOM 字符串
  dataType: 'markdown' | 'dom'; // 指定 data 参数的类型
  parentID: string; // 父块的 ID
}

interface BlockAppendBlockResponseDataItem {
  id: string; // 新创建块的 ID
}

interface BlockAppendBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockAppendBlockResponseDataItem> | null;
}

interface BlockAppendDailyNoteBlockParams {
  data: string; // 要追加的内容，可以是 Markdown 或 DOM 字符串
  dataType: 'markdown' | 'dom'; // 指定 data 参数的类型
  notebook: string; // 目标笔记本的 ID
}

interface BlockAppendDailyNoteBlockResponseDataItem {
  id: string; // 新创建块的 ID
}

interface BlockAppendDailyNoteBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockAppendDailyNoteBlockResponseDataItem> | null;
}

interface BlockBatchUpdateBlockParamsBlocksItem {
  id: string; // 要更新的块 ID
  data: string; // 新的块内容，可以是 Markdown 或 DOM 字符串
  dataType: 'markdown' | 'dom'; // 指定 data 参数的类型
}

interface BlockBatchUpdateBlockParams {
  blocks: Array<BlockBatchUpdateBlockParamsBlocksItem>; // 包含多个待更新块信息的数组
}

interface BlockBatchUpdateBlockResponseDataItem {
  id: string; // 已更新块的 ID
}

interface BlockBatchUpdateBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockBatchUpdateBlockResponseDataItem> | null;
}

interface BlockCheckBlockExistParams {
  id: string; // 要检查的块 ID
}

interface BlockCheckBlockExistResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: boolean; // 块是否存在
}

interface BlockCheckBlockFoldParams {
  id: string; // 要检查的块 ID
}

interface BlockCheckBlockFoldResponseData {
  isFolded: boolean; // 块是否已折叠
  isRoot: boolean; // 块是否为根块（通常指文档块）
}

interface BlockCheckBlockFoldResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockCheckBlockFoldResponseData; // 包含折叠状态和是否为根块的信息
}

interface BlockCheckBlockRefParams {
  ids: Array<string>; // 要检查的块 ID 数组
}

interface BlockCheckBlockRefResponseDataValue {
  defCount: number; // 该块作为定义块被引用的次数
  refCount: number; // 该块作为引用块引用其他块的次数
}

interface BlockCheckBlockRefResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Record<string, BlockCheckBlockRefResponseDataValue>; // 一个记录对象，键为块 ID，值为该块的引用统计信息
}

interface BlockDeleteBlockParams {
  id: string; // 要删除的块 ID
}

interface BlockDeleteBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<any> | null;
}

interface BlockFoldBlockParams {
  id: string; // 要折叠的块 ID
}

interface BlockFoldBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<any> | null;
}

interface BlockGetBlockBreadcrumbParams {
  id: string; // 目标块的 ID
  excludeTypes?: Array<string>;
}

interface BlockGetBlockBreadcrumbResponseDataItem {
  id: string; // 面包屑项的块 ID
  name: string; // 面包屑项的名称（通常是块内容或标题）
  type: string; // 面包屑项的块类型
  icon?: string;
}

interface BlockGetBlockBreadcrumbResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockGetBlockBreadcrumbResponseDataItem>; // 面包屑路径数组，从根到目标块的父块
}

interface BlockGetBlockDOMParams {
  id: string; // 要获取 DOM 的块 ID
}

interface BlockGetBlockDOMResponseData {
  id: string; // 块 ID
  dom: string; // 块的 DOM 内容 (HTML 字符串)
  isFullWidth?: boolean;
}

interface BlockGetBlockDOMResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetBlockDOMResponseData; // 包含块 ID 和其 DOM 内容的对象
}

interface BlockGetBlockDefIDsByRefTextParams {
  anchor: string; // 要搜索的引用锚文本
  excludeIDs?: Array<string>;
}

interface BlockGetBlockDefIDsByRefTextResponseDataRefDefsItem {
  RefID: string; // 引用块的ID (发起引用的块)
  DefIDs: Array<string>; // 被引用的定义块ID列表
}

interface BlockGetBlockDefIDsByRefTextResponseData {
  refDefs: Array<BlockGetBlockDefIDsByRefTextResponseDataRefDefsItem>; // 引用定义对的列表
}

interface BlockGetBlockDefIDsByRefTextResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetBlockDefIDsByRefTextResponseData; // 包含引用定义对列表的对象
}

interface BlockGetBlockIndexParams {
  id: string; // 要获取索引的块 ID
}

interface BlockGetBlockIndexResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: number; // 块在其父块子节点中的索引位置，-1 表示未找到或出错
}

interface BlockGetBlockInfoParams {
  id: string; // 要获取信息的块 ID
}

interface BlockGetBlockInfoResponseData {
  box: string; // 块所在的笔记本 ID
  path: string; // 块在笔记本中的绝对路径
  rootID: string; // 块所属的根文档块 ID
  rootTitle: string; // 根文档块的标题
  rootChildID: string; // 该块在根文档块下的一级子块ID (如果自身不是一级子块，则为空)
  rootIcon: string; // 根文档块的图标
}

interface BlockGetBlockInfoResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetBlockInfoResponseData; // 包含块的详细路径和上下文信息的对象
}

interface BlockGetBlockKramdownParams {
  id: string; // 要获取 Kramdown 源码的块 ID
  mode?: 'md' | 'textmark';
}

interface BlockGetBlockKramdownResponseData {
  id: string; // 块 ID
  kramdown: string; // 块的 Kramdown 源码
}

interface BlockGetBlockKramdownResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetBlockKramdownResponseData; // 包含块 ID 和其 Kramdown 源码的对象
}

interface BlockGetBlockSiblingIDParams {
  id: string; // 目标块的 ID
}

interface BlockGetBlockSiblingIDResponseData {
  parent: string; // 父块 ID，如果目标块是根块则为空字符串
  previous: string; // 上一个同级块 ID，如果没有则为空字符串
  next: string; // 下一个同级块 ID，如果没有则为空字符串
}

interface BlockGetBlockSiblingIDResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetBlockSiblingIDResponseData; // 包含父块、上一个和下一个同级块 ID 的对象
}

interface BlockGetBlockTreeInfosParams {
  ids: Array<string>; // 要获取块树信息的块 ID 数组
}

interface BlockGetBlockTreeInfosResponseDataItem {
  id: string; // 块 ID
  box: string; // 笔记本 ID
  path: string; // 块的路径
  hPath: string; // 块的人类可读路径
  name: string; // 块的名称（通常是内容的前缀）
  alias: string; // 块的别名
  memo: string; // 块的备注
  tag: string; // 块的标签
  bookmark: string; // 块的书签内容
  type: string; // 块的类型
  subType: string; // 块的子类型
  depth: number; // 块在树中的深度
  sort: number; // 块的排序值
  created: string; // 块的创建时间 (Unix 时间戳字符串)
  updated: string; // 块的更新时间 (Unix 时间戳字符串)
  'f Suprema': string; // 块的 F Suprema 值，用途未知
  fcontent: string; // 块的 FContent 值，可能是格式化内容预览
  markdown: string; // 块的 Markdown 内容
  length: number; // 块内容的长度
  refCount: number; // 块的引用计数
  defCount: number; // 块的定义计数
  refID: string; // 块的引用目标 ID (如果该块是引用块)
  parentID: string; // 父块 ID
  parent2ID: string; // 祖父块 ID
  rootID: string; // 根块 ID (文档块 ID)
  childrenCount: number; // 直接子块数量
  codeBlockCount: number; // 代码块数量
  avCount: number; // 属性视图数量
  docSize: number; // 文档大小 (如果该块是文档块)
  subFileCount: number; // 子文件数量 (如果该块是文档块)
  headingCount: number; // 标题数量
  listCount: number; // 列表数量
  listItemCount: number; // 列表项数量
  mathBlockCount: number; // 数学公式块数量
  htmlBlockCount: number; // HTML 块数量
  tableCount: number; // 表格数量
  quoteCount: number; // 引述块数量
  superBlockCount: number; // 超级块数量
  paragraphCount: number; // 段落数量
  todoCount: number; // 待办事项数量
  imageCount: number; // 图片数量
  audioCount: number; // 音频数量
  videoCount: number; // 视频数量
  otherAssetCount: number; // 其他资源数量
  isBacklink: boolean; // 是否为反向链接提及
  isRef: boolean; // 是否为引用
  isDef: boolean; // 是否为定义
  isComment: boolean; // 是否为评论
  hasMemo: boolean; // 是否有备注
  hasTag: boolean; // 是否有标签
  hasBookmark: boolean; // 是否有书签
  hasAlias: boolean; // 是否有别名
  hidden: boolean; // 是否隐藏
  folded: boolean; // 是否折叠
  refText: string; // 引用文本 (如果该块是引用块)
  refPath: string; // 引用路径 (如果该块是引用块)
  refPath2: string; // 引用路径2 (如果该块是引用块)
  refCreate: string; // 引用创建时间 (如果该块是引用块, Unix 时间戳字符串)
  refUpdate: string; // 引用更新时间 (如果该块是引用块, Unix 时间戳字符串)
  defPath: string; // 定义路径 (如果该块是定义块)
  defPath2: string; // 定义路径2 (如果该块是定义块)
  ial: Record<string, string>; // 块的 IAL 属性键值对
  children?: Array<any>;
  attrs?: Record<string, string>;
}

interface BlockGetBlockTreeInfosResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockGetBlockTreeInfosResponseDataItem>; // 一个包含多个块树信息的数组，每个对象代表一个块及其详细信息和可能的子节点
}

interface BlockGetBlocksIndexesParams {
  ids: Array<string>; // 要获取索引的块 ID 数组
}

interface BlockGetBlocksIndexesResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Record<string, number>; // 一个记录对象，键为块 ID，值为该块在其父块中的索引
}

interface BlockGetBlocksWordCountParams {
  ids: Array<string>; // 要统计字数的块 ID 数组
  reqId?: string;
}

interface BlockGetBlocksWordCountResponseDataStat {
  wordCount: number; // 总字数
  charCount: number; // 总字符数
  linkCount: number; // 总链接数
}

interface BlockGetBlocksWordCountResponseData {
  reqId?: string;
  stat: BlockGetBlocksWordCountResponseDataStat; // 字数统计结果
}

interface BlockGetBlocksWordCountResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetBlocksWordCountResponseData; // 包含字数统计结果和可选请求 ID 的对象
}

interface BlockGetChildBlocksParams {
  id: string; // 父块的 ID
}

interface BlockGetChildBlocksResponseDataItem {
  id: string; // 子块的 ID
  type: string; // 子块的类型
}

interface BlockGetChildBlocksResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockGetChildBlocksResponseDataItem>; // 直接子块的基本信息数组
}

interface BlockGetContentWordCountParams {
  content: string; // 要统计字数的文本内容
  reqId?: string;
}

interface BlockGetContentWordCountResponseDataStat {
  wordCount: number; // 总字数
  charCount: number; // 总字符数
  linkCount: number; // 总链接数
}

interface BlockGetContentWordCountResponseData {
  reqId?: string;
  stat: BlockGetContentWordCountResponseDataStat; // 字数统计结果
}

interface BlockGetContentWordCountResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetContentWordCountResponseData; // 包含字数统计结果和可选请求 ID 的对象
}

interface BlockGetDOMTextParams {
  dom: string; // 包含 HTML 标签的 DOM 字符串
}

interface BlockGetDOMTextResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: string; // 从 DOM 中提取的纯文本内容
}

interface BlockGetDocInfoParams {
  id: string; // 目标文档块的 ID
}

interface BlockGetDocInfoResponseData {
  id: string; // 文档块 ID
  box: string; // 笔记本 ID
  path: string; // 文档的存储路径
  dom: string; // 文档内容的 DOM (HTML 字符串)
  title: string; // 文档标题
  icon: string; // 文档图标的 Base64 编码或 Emoji
  iconURL: string; // 文档图标的 URL
  breadcrumb: string; // 文档的面包屑路径 (HTML 字符串)
  isTemplate: boolean; // 该文档是否为模板
  updated: string; // 文档更新时间 (yyyyMMddHHmmss格式)
}

interface BlockGetDocInfoResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetDocInfoResponseData; // 包含文档详细信息的对象
}

interface BlockGetDocsInfoParams {
  ids: Array<string>; // 包含多个文档块 ID 的数组
}

interface BlockGetDocsInfoResponseDataItem {
  id: string; // 文档块 ID
  box: string; // 笔记本 ID
  path: string; // 文档的存储路径
  title: string; // 文档标题
  icon: string; // 文档图标的 Base64 编码或 Emoji
  iconURL: string; // 文档图标的 URL
  isTemplate: boolean; // 该文档是否为模板
  updated: string; // 文档更新时间 (yyyyMMddHHmmss格式)
}

interface BlockGetDocsInfoResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockGetDocsInfoResponseDataItem>; // 包含多个文档详细信息的数组
}

interface BlockGetHeadingChildrenDOMParams {
  id: string; // 目标标题块的 ID
}

interface BlockGetHeadingChildrenDOMResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: string; // 标题块下所有子孙块合并的 DOM (HTML 字符串)
}

interface BlockGetHeadingChildrenIDsParams {
  id: string; // 目标标题块的 ID
}

interface BlockGetHeadingChildrenIDsResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<string>; // 标题块下所有子孙块的 ID 数组
}

interface BlockGetHeadingDeleteTransactionParams {
  id: string; // 要获取删除事务的标题块 ID
}

interface BlockGetHeadingDeleteTransactionResponseDataDoOperationsItem {
  action: string; // 操作类型 (例如: delete, update, insert等)
  id?: string;
  data?: string;
  parentID?: string;
  previousID?: string;
  dataType?: string;
}

interface BlockGetHeadingDeleteTransactionResponseData {
  doOperations: Array<BlockGetHeadingDeleteTransactionResponseDataDoOperationsItem>; // 正向操作列表
}

interface BlockGetHeadingDeleteTransactionResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetHeadingDeleteTransactionResponseData; // 包含删除操作的事务对象
}

interface BlockGetHeadingLevelTransactionParams {
  id: string; // 要调整级别的标题块 ID
  level: number; // 新的标题级别 (1-6)
}

interface BlockGetHeadingLevelTransactionResponseDataDoOperationsItem {
  action: string; // 操作类型 (例如: updateial)
  id: string; // 操作的块 ID
  data?: string;
}

interface BlockGetHeadingLevelTransactionResponseData {
  doOperations: Array<BlockGetHeadingLevelTransactionResponseDataDoOperationsItem>; // 正向操作列表
}

interface BlockGetHeadingLevelTransactionResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetHeadingLevelTransactionResponseData; // 包含调整级别操作的事务对象
}

interface BlockGetRecentUpdatedBlocksResponseDataItem {
  id: string; // 块 ID
  box: string; // 笔记本 ID
  path: string; // 块所在文档的路径
  hPath: string; // 块所在文档的人类可读路径
  name: string; // 块的名称/内容预览
  bookmark: string; // 块的书签内容
  memo: string; // 块的备注内容
  alias: string; // 块的别名
  type: string; // 块类型
  updated: string; // 块更新时间 (yyyyMMddHHmmss 格式)
}

interface BlockGetRecentUpdatedBlocksResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockGetRecentUpdatedBlocksResponseDataItem>; // 最近更新的块信息数组
}

interface BlockGetRefIDsParams {
  id: string; // 发起引用的块 ID
}

interface BlockGetRefIDsResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<string>; // 该块引用的所有定义块的 ID 数组
}

interface BlockGetRefIDsByFileAnnotationIDParams {
  id: string; // 文件注解块的 ID
}

interface BlockGetRefIDsByFileAnnotationIDResponseData {
  refID: string; // 相关的引用块 ID
  defID: string; // 相关的定义块 ID
}

interface BlockGetRefIDsByFileAnnotationIDResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetRefIDsByFileAnnotationIDResponseData; // 包含相关引用ID和定义ID的对象
}

interface BlockGetRefTextParams {
  id: string; // 引用块的 ID
}

interface BlockGetRefTextResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: string; // 引用块的锚文本
}

interface BlockGetTailChildBlocksParams {
  id: string; // 父块的 ID
  size: number; // 要获取的尾部子块数量
}

interface BlockGetTailChildBlocksResponseDataItem {
  id: string; // 子块的 ID
  type: string; // 子块的类型
}

interface BlockGetTailChildBlocksResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockGetTailChildBlocksResponseDataItem>; // 尾部子块的基本信息数组
}

interface BlockGetTreeStatParams {
  id: string; // 目标块的 ID，通常为文档块
}

interface BlockGetTreeStatResponseData {
  id: string; // 块 ID
  box: string; // 笔记本 ID
  path: string; // 块路径
  refCount: number; // 引用数量
  defCount: number; // 定义数量
  childrenCount: number; // 直接子块数量
  codeBlockCount: number; // 代码块数量
  avCount: number; // 属性视图数量
  docSize: number; // 文档大小 (字节)
  subFileCount: number; // 子文件数量 (文档内文档)
  headingCount: number; // 标题块数量
  listCount: number; // 列表块数量
  listItemCount: number; // 列表项数量
  mathBlockCount: number; // 数学公式块数量
  htmlBlockCount: number; // HTML块数量
  tableCount: number; // 表格块数量
  quoteCount: number; // 引述块数量
  superBlockCount: number; // 超级块数量
  paragraphCount: number; // 段落数量
  todoCount: number; // 待办事项数量 (已完成或未完成)
  imageCount: number; // 图片资源数量
  audioCount: number; // 音频资源数量
  videoCount: number; // 视频资源数量
  otherAssetCount: number; // 其他资源数量
}

interface BlockGetTreeStatResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BlockGetTreeStatResponseData; // 块树的统计信息对象
}

interface BlockGetUnfoldedParentIDParams {
  id: string; // 起始块的 ID
}

interface BlockGetUnfoldedParentIDResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: string; // 最近的已展开父块的 ID，如果无此类父块或出错则为空字符串
}

interface BlockInsertBlockParams {
  anchorID: string; // 锚点块的 ID
  data: string; // 要插入的内容，可以是 Markdown 或 DOM 字符串
  dataType: 'markdown' | 'dom'; // 指定 data 参数的类型
  isBefore: boolean; // 是否在锚点块之前插入 (true: 之前, false: 之后)
}

interface BlockInsertBlockResponseDataItem {
  id: string; // 新创建块的 ID
}

interface BlockInsertBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockInsertBlockResponseDataItem> | null;
}

interface BlockPrependBlockParams {
  data: string; // 要插入的内容，可以是 Markdown 或 DOM 字符串
  dataType: 'markdown' | 'dom'; // 指定 data 参数的类型
  parentID: string; // 父块的 ID
}

interface BlockPrependBlockResponseDataItem {
  id: string; // 新创建块的 ID
}

interface BlockPrependBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockPrependBlockResponseDataItem> | null;
}

interface BlockSetBlockReminderParams {
  id: string; // 要设置提醒的块 ID
  timed: string; // 提醒时间，格式为 yyyyMMddHHmmss (例如: 20230815103000)
}

interface BlockSetBlockReminderResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: null; // 成功时为 null
}

interface BlockSwapBlockRefParams {
  refID: string; // 原引用块的 ID
  defID: string; // 原定义块的 ID
  includeChildren: boolean; // 是否包含子块进行交换 (通常用于嵌入块)
}

interface BlockSwapBlockRefResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: null; // 成功时为 null
}

interface BlockTransferBlockRefParams {
  fromID: string; // 原块的 ID，其引用关系将被转移
  toID: string; // 目标块的 ID，将接收引用关系
  refIDs?: Array<string>;
  reloadUI?: boolean;
}

interface BlockTransferBlockRefResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: null; // 成功时为 null
}

interface BlockUnfoldBlockParams {
  id: string; // 要展开的块 ID
}

interface BlockUnfoldBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<any> | null;
}

interface BlockUpdateBlockParams {
  id: string; // 要更新的块 ID
  data: string; // 新的块内容，可以是 Markdown 或 DOM 字符串
  dataType: 'markdown' | 'dom'; // 指定 data 参数的类型
}

interface BlockUpdateBlockResponseDataItem {
  id: string; // 已更新块的 ID
}

interface BlockUpdateBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BlockUpdateBlockResponseDataItem> | null;
}

interface BlockPrependDailyNoteBlockParams {
  data: string; // 要追加的内容，可以是 Markdown 或 DOM 字符串。如果 dataType 为 'markdown'，内容会先转换为 DOM。注意：后端实现中此接口行为类似 appendDailyNoteBlock，均在末尾追加，但定义保留 prepend 以匹配接口名和潜在的未来行为调整。建议使用 appendDailyNoteBlock 以获得明确的末尾追加行为。后端 action 为 prependInsert。 
  dataType: 'markdown' | 'dom'; // 指定 data 参数的类型 ('markdown' 或 'dom')。 
  notebook: string; // 目标笔记本的 ID。
}

interface BlockPrependDailyNoteBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<any> | null;
}

interface BlockMoveBlockParams {
  id: string; // 要移动的块的 ID。
  parentID?: string;
  previousID?: string;
}

interface BlockMoveBlockResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: null; // 此接口成功时不返回具体数据，UI 通常通过 WebSocket 消息更新。
}

interface BlockMoveOutlineHeadingParams {
  id: string; // 要移动的大纲标题块的 ID。
  parentID?: string;
  previousID?: string;
}

interface BlockMoveOutlineHeadingResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<any> | null;
}

interface BookmarkGetBookmarkResponseDataItemBlocksItem {
  id: string; // 块的 ID
  type: string; // 块的类型 (例如 Paragraph, Heading, List, Document 等)
  content: string; // 块的显示内容 (对于普通块可能是名称或概要，对于属性视图是其标题)
  markdown: string; // 块的 Markdown 源码
  name?: string;
  alias?: string;
  memo?: string;
  icon?: string;
  hPath: string; // 块所在文档的人类可读路径 (例如 '/文档名/子文档名')
  path: string; // 块所在文档的绝对存储路径
  box: string; // 块所属的笔记本 ID
  rootID: string; // 块所属的根文档块 ID
}

interface BookmarkGetBookmarkResponseDataItem {
  name: string; // 书签的名称 (用户在 IAL 中为块设置的 bookmark 属性值)
  blocks: Array<BookmarkGetBookmarkResponseDataItemBlocksItem>; // 属于此书签名称下的块对象列表
  type: string; // 固定为 'bookmark'，表示这是一个书签分组
  depth: number; // 层级深度，对于书签固定为 1
  count: number; // 此书签名称下包含的块的数量
}

interface BookmarkGetBookmarkResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BookmarkGetBookmarkResponseDataItem>; // 书签数据数组，每个元素是一个书签分组及其包含的书签块列表
}

interface BookmarkRemoveBookmarkParams {
  bookmark: string; // 要移除的书签的名称 (块 IAL 中 bookmark 属性的值)
}

interface BookmarkRemoveBookmarkResponseData {
  closeTimeout: number; // 一个建议的关闭超时时间 (毫秒)，通常在错误时提供以便UI提示
}

interface BookmarkRemoveBookmarkResponse {
  Code: number; // API 调用返回码，0 表示成功，其他表示失败
  Msg: string; // API 调用返回消息
  Data?: BookmarkRemoveBookmarkResponseData | null;
}

interface BookmarkRenameBookmarkParams {
  oldBookmark: string; // 要重命名的旧书签名称 (块 IAL 中 bookmark 属性的当前值)
  newBookmark: string; // 新的书签名称 (将写入块 IAL 中 bookmark 属性的新值)
}

interface BookmarkRenameBookmarkResponseData {
  closeTimeout: number; // 一个建议的关闭超时时间 (毫秒)，通常在错误时提供以便UI提示
}

interface BookmarkRenameBookmarkResponse {
  Code: number; // API 调用返回码，0 表示成功，其他表示失败
  Msg: string; // API 调用返回消息
  Data?: BookmarkRenameBookmarkResponseData | null;
}

interface BroadcastGetChannelInfoParams {
  name: string; // 要查询的广播频道名称
}

interface BroadcastGetChannelInfoResponseData {
  name: string; // 频道名称
  count: number; // 频道的总订阅者数量 (WebSocket + SSE)
}

interface BroadcastGetChannelInfoResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: BroadcastGetChannelInfoResponseData; // 频道信息对象
}

interface BroadcastGetChannelsResponseDataItem {
  name: string; // 频道名称
  count: number; // 频道的总订阅者数量 (WebSocket + SSE)
}

interface BroadcastGetChannelsResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<BroadcastGetChannelsResponseDataItem>; // 活跃频道信息对象数组
}

interface BroadcastPostMessageParams {
  channel: string; // 目标广播频道的名称
  cmd?: string;
  data: string; // 要发送的消息内容或命令参数 (JSON 字符串)
}

interface BroadcastPostMessageResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: any | null;
}

interface BroadcastBroadcastPublishParams {
  channel: string; // 目标广播频道的名称
  type: 'string' | 'binary'; // 消息类型：'string' (文本) 或 'binary' (二进制文件)
  data?: string;
  file?: any;
}

interface BroadcastBroadcastPublishResponseDataChannel {
  name: string; // 目标频道名称
  count: number; // 发布时频道的订阅者数量
}

interface BroadcastBroadcastPublishResponseDataMessage {
  type: 'string' | 'binary'; // 发布的消息类型
  size: number; // 发布的消息大小 (字节)
  filename: string; // 发布的文件名 (如果 type 为 'binary')
}

interface BroadcastBroadcastPublishResponseData {
  code: number; // 操作结果返回码，0 表示成功
  msg: string; // 操作结果消息
  channel: BroadcastBroadcastPublishResponseDataChannel; // 频道信息
  message: BroadcastBroadcastPublishResponseDataMessage; // 发布的消息详情
}

interface BroadcastBroadcastPublishResponse {
  Code: number; // API 调用返回码 (外层)
  Msg: string; // API 调用返回消息 (外层)
  Data: BroadcastBroadcastPublishResponseData; // 发布操作的结果详情
}

interface ClipboardReadFilePathsResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: Array<string>; // 从剪贴板中读取到的文件绝对路径列表。如果剪贴板中不是文件路径，或在 Linux 等受限情况下，可能返回空数组。
}

interface CloudGetCloudSpaceResponseDataSync {
  size: number; // 云端同步数据的大小 (字节)
  hSize: string; // 人类可读的云端同步数据大小 (例如 '1.2 GB')，仅当服务商为思源官方时有效，其他为'-'
  updated: string; // 云端同步数据最后更新时间戳 (格式可能为 Unix 时间戳或特定日期字符串)
  cloudName: string; // 云端同步数据存放的目录名 (例如 'main')
  saveDir: string; // 本地同步数据实际存放的目录绝对路径
}

interface CloudGetCloudSpaceResponseDataBackup {
  size: number; // 云端备份数据的大小 (字节)
  hSize: string; // 人类可读的云端备份数据大小 (例如 '500 MB')，仅当服务商为思源官方时有效，其他为'-'
  updated: string; // 云端备份数据最后更新时间戳 (格式可能为 Unix 时间戳或特定日期字符串)
  saveDir: string; // 本地备份数据实际存放的目录绝对路径
}

interface CloudGetCloudSpaceResponseData {
  sync: CloudGetCloudSpaceResponseDataSync; // 云同步相关信息
  backup: CloudGetCloudSpaceResponseDataBackup; // 云备份相关信息
  hAssetSize: string; // 人类可读的云端资源文件总大小 (例如 '300 MB')，仅当服务商为思源官方时有效，其他为'-'
  hSize: string; // 人类可读的云端已用空间总大小 (同步数据 + 备份数据 + 资源文件，例如 '2 GB')，仅当服务商为思源官方时有效，其他为'-'
  hTotalSize: string; // 人类可读的云端总可用空间大小 (例如 '10 GB')，仅当服务商为思源官方时有效，其他为'-'
  hExchangeSize: string; // 人类可读的积分兑换云空间大小 (例如 '1 GB')，仅当服务商为思源官方时有效，其他为'-'
  hTrafficUploadSize: string; // 人类可读的当月已用上传流量 (例如 '5 GB')，仅当服务商为思源官方时有效，其他为'-'
  hTrafficDownloadSize: string; // 人类可读的当月已用下载流量 (例如 '12 GB')，仅当服务商为思源官方时有效，其他为'-'
  hTrafficAPIGet: string; // 人类可读的当月 API GET 请求次数 (例如 '1.5 k')，仅当服务商为思源官方时有效，其他为'-'
  hTrafficAPIPut: string; // 人类可读的当月 API PUT 请求次数 (例如 '800')，仅当服务商为思源官方时有效，其他为'-'
}

interface CloudGetCloudSpaceResponse {
  Code: number; // API 调用返回码，0 表示成功，1 表示获取信息时发生错误
  Msg: string; // API 调用返回消息，错误时包含错误信息
  Data: CloudGetCloudSpaceResponseData; // 云端空间和流量的详细信息
}

interface ConvertPandocParams {
  dir?: string;
  args: Array<string>; // Pandoc 命令行参数数组
}

interface ConvertPandocResponseData {
  path: string; // 转换后输出文件的路径
}

interface ConvertPandocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ConvertPandocResponseData; // 成功时返回的数据
}

interface ExportExport2LiandiParams {
  id: string; // 要导出到链滴的文档ID
}

interface ExportExport2LiandiResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface ExportExportAsFileParams {
  type: string; // 上传文件的MIME类型
}

interface ExportExportAsFileResponseData {
  name: string; // 处理后的文件名
  file: string; // 文件在服务器上的可访问路径 (相对于/export/)
}

interface ExportExportAsFileResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportAsFileResponseData; // 成功时返回的数据
}

interface ExportExportAsciiDocParams {
  id: string; // 要导出的文档ID
}

interface ExportExportAsciiDocResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportAsciiDocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportAsciiDocResponseData; // 成功时返回的数据
}

interface ExportExportAttributeViewParams {
  id: string; // 属性视图的ID (avID)
  blockID: string; // 包含该属性视图的块ID
}

interface ExportExportAttributeViewResponseData {
  zip: string; // 导出的CSV压缩文件在服务器上的绝对路径
}

interface ExportExportAttributeViewResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportAttributeViewResponseData; // 成功时返回的数据
}

interface ExportExportDataResponseData {
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportDataResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportDataResponseData; // 成功时返回的数据
}

interface ExportExportDataInFolderParams {
  folder: string; // 要导出数据的文件夹路径 (相对于工作空间data目录)
}

interface ExportExportDataInFolderResponseData {
  name: string; // 导出的压缩包文件名 (不含路径)
}

interface ExportExportDataInFolderResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportDataInFolderResponseData; // 成功时返回的数据
}

interface ExportExportDocxParams {
  id: string; // 要导出的文档ID
  savePath: string; // 服务器上保存 .docx 文件的绝对路径
  removeAssets: boolean; // 是否移除导出的 Word 文件中包含的资源文件（如图片）的原始文件
  merge?: boolean;
}

interface ExportExportDocxResponseData {
  path: string; // 最终生成的 .docx 文件在服务器上的绝对路径
}

interface ExportExportDocxResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportDocxResponseData; // 成功时返回的数据
}

interface ExportExportEPUBParams {
  id: string; // 要导出的文档ID
}

interface ExportExportEPUBResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportEPUBResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportEPUBResponseData; // 成功时返回的数据
}

interface ExportExportHTMLParams {
  id: string; // 要导出的文档ID
  pdf: boolean; // 是否为导出 PDF 进行预处理（例如，处理链接和资源路径以适应 PDF 生成环境）
  savePath: string; // 服务器上保存 HTML 文件的绝对路径 (如果 pdf 为 true，则此路径可能用于临时存储)
  keepFold?: boolean;
  merge?: boolean;
}

interface ExportExportHTMLResponseData {
  id: string; // 导出的文档ID
  name: string; // 文档的原始名称
  content: string; // 生成的 HTML 内容
}

interface ExportExportHTMLResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportHTMLResponseData; // 成功时返回的数据
}

interface ExportExportMdParams {
  id: string; // 要导出的文档ID
}

interface ExportExportMdResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportMdResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportMdResponseData; // 成功时返回的数据
}

interface ExportExportMdContentParams {
  id: string; // 要导出 Markdown 内容的文档ID
  refMode?: number;
  embedMode?: number;
  yfm?: boolean;
}

interface ExportExportMdContentResponseData {
  hPath: string; // 文档的人类可读路径 (面包屑路径)
  content: string; // 导出的 Markdown 文本内容
}

interface ExportExportMdContentResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportMdContentResponseData; // 成功时返回的数据
}

interface ExportExportMdHTMLParams {
  id: string; // 要导出 HTML 内容的文档ID
  savePath: string; // 服务器上保存 HTML 文件的绝对路径 (此参数在后端代码中存在但似乎未实际用于此接口，可能为遗留或通用逻辑)
}

interface ExportExportMdHTMLResponseData {
  id: string; // 导出的文档ID
  name: string; // 文档的原始名称
  content: string; // 生成的纯 HTML 内容
}

interface ExportExportMdHTMLResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportMdHTMLResponseData; // 成功时返回的数据
}

interface ExportExportMdsParams {
  ids: Array<string>; // 要导出的文档ID数组
}

interface ExportExportMdsResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportMdsResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportMdsResponseData; // 成功时返回的数据
}

interface ExportExportMediaWikiParams {
  id: string; // 要导出的文档ID
}

interface ExportExportMediaWikiResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportMediaWikiResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportMediaWikiResponseData; // 成功时返回的数据
}

interface ExportExportNotebookMdParams {
  notebook: string; // 要导出的笔记本ID
}

interface ExportExportNotebookMdResponseData {
  name: string; // 导出的 .zip 文件名 (通常为笔记本名称)
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportNotebookMdResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportNotebookMdResponseData; // 成功时返回的数据
}

interface ExportExportNotebookSYParams {
  id: string; // 要导出的笔记本ID
}

interface ExportExportNotebookSYResponseData {
  zip: string; // 导出的 .sy 文件在服务器上的绝对路径
}

interface ExportExportNotebookSYResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportNotebookSYResponseData; // 成功时返回的数据
}

interface ExportExportODTParams {
  id: string; // 要导出的文档ID
}

interface ExportExportODTResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportODTResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportODTResponseData; // 成功时返回的数据
}

interface ExportExportOPMLParams {
  id: string; // 要导出的文档ID
}

interface ExportExportOPMLResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportOPMLResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportOPMLResponseData; // 成功时返回的数据
}

interface ExportExportOrgModeParams {
  id: string; // 要导出的文档ID
}

interface ExportExportOrgModeResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportOrgModeResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportOrgModeResponseData; // 成功时返回的数据
}

interface ExportExportPreviewHTMLParams {
  id: string; // 要导出预览 HTML 的文档ID
  keepFold?: boolean;
  merge?: boolean;
  image?: boolean;
}

interface ExportExportPreviewHTMLResponseData {
  id: string; // 导出的文档ID
  name: string; // 文档的原始名称
  content: string; // 生成的预览 HTML 内容
  attrs: Record<string, string>; // 文档块的属性 (IAL)
  type: string; // 文档块的类型 (如 'd' 表示文档块)
}

interface ExportExportPreviewHTMLResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportPreviewHTMLResponseData; // 成功时返回的数据
}

interface ExportExportRTFParams {
  id: string; // 要导出的文档ID
}

interface ExportExportRTFResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportRTFResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportRTFResponseData; // 成功时返回的数据
}

interface ExportExportReStructuredTextParams {
  id: string; // 要导出的文档ID
}

interface ExportExportReStructuredTextResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportReStructuredTextResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportReStructuredTextResponseData; // 成功时返回的数据
}

interface ExportExportResourcesParams {
  name?: string;
  paths: Array<string>; // 要导出的文件或文件夹在工作空间中的相对路径数组 (相对于data目录)
}

interface ExportExportResourcesResponseData {
  path: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportResourcesResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportResourcesResponseData; // 成功时返回的数据
}

interface ExportExportSYParams {
  id: string; // 要导出的文档ID
}

interface ExportExportSYResponseData {
  name: string; // 导出的 .sy 文件名
  zip: string; // 导出的 .sy 文件在服务器上的绝对路径
}

interface ExportExportSYResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportSYResponseData; // 成功时返回的数据
}

interface ExportExportTempContentParams {
  content: string; // 要导出预览的 Markdown 内容字符串
  mode?: number;
  theme?: string;
  title?: string;
  type?: string;
  css?: string;
  js?: string;
}

interface ExportExportTempContentResponseData {
  url: string; // 生成的临时内容预览 URL (形如 http://localhost:6806/export/temp/xxxxxxx)
}

interface ExportExportTempContentResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportTempContentResponseData; // 成功时返回的数据
}

interface ExportExportTextileParams {
  id: string; // 要导出的文档ID
}

interface ExportExportTextileResponseData {
  name: string; // 导出的 .zip 文件名
  zip: string; // 导出的 .zip 文件在服务器上的绝对路径
}

interface ExportExportTextileResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportTextileResponseData; // 成功时返回的数据
}

interface ExportExportPreviewParams {
  id: string; // 要获取 HTML 预览的文档ID
}

interface ExportExportPreviewResponseData {
  html: string; // 生成的文档 HTML 预览内容
}

interface ExportExportPreviewResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: ExportExportPreviewResponseData; // 成功时返回的数据
}

interface ExportProcessPDFParams {
  id: string; // 相关文档的ID (用于日志记录或上下文关联)
  path: string; // 已生成的 HTML 文件的绝对路径 (该文件将被用于生成或处理 PDF)
  merge?: boolean;
  removeAssets: boolean; // 处理完成后是否移除相关资源文件
  watermark: boolean; // 是否添加水印
}

interface ExportProcessPDFResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface ExtensionExtensionCopyParams {
  dom: string; // 要处理的 HTML DOM 内容字符串。这是必须的字段。注意：即使是从链滴剪藏（href 指向链滴文章），也需要传递一个 dom 参数，内容可以为空字符串。
  notebook?: string;
  href?: string;
}

interface ExtensionExtensionCopyResponseData {
  md: string; // 转换后或直接获取的 Markdown 内容
  withMath: boolean; // 指示转换后的 Markdown 内容中是否包含数学公式 (KaTeX)
}

interface ExtensionExtensionCopyResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息，失败时错误信息显示在这里
  Data: ExtensionExtensionCopyResponseData | null;
}

interface FileCopyFileParams {
  src: string; // 源文件路径。如果是资源文件，则为相对于 assets 目录的路径；如果是普通工作空间文件，则为相对于工作空间根目录的路径。后端会尝试将其解析为绝对路径。注意：此接口不能直接复制目录。后台实现会先尝试将其作为资源文件解析，如果失败则作为工作空间普通文件解析。若要复制普通文件，建议使用 /api/file/globalCopyFiles。 
  dest: string; // 目标文件绝对路径。
}

interface FileCopyFileResponseData {
  closeTimeout?: number;
}

interface FileCopyFileResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FileCopyFileResponseData | null;
}

interface FileGetFileParams {
  path: string; // 要获取内容的文件路径 (相对于工作空间根目录)。
}

interface FileGetFileResponse {
  Code: number; // 错误状态码 (例如 403, 404, 500)
  Msg: string; // 错误消息
}

interface FileGetUniqueFilenameParams {
  path: string; // 原始文件路径 (通常包含期望的文件名和扩展名)。
}

interface FileGetUniqueFilenameResponseData {
  path: string; // 处理后的唯一文件路径。
}

interface FileGetUniqueFilenameResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FileGetUniqueFilenameResponseData;
}

interface FileGlobalCopyFilesParams {
  srcs: Array<string>; // 要复制的源文件绝对路径数组。如果任何一个文件不存在，操作将失败。注意：不能是目录。
  destDir: string; // 目标目录路径 (相对于工作空间根目录)。
}

interface FileGlobalCopyFilesResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FilePutFileParams {
  path: string; // 目标文件或目录在工作空间内的相对路径。文件名需要符合规范，否则请求失败。
  isDir: boolean; // 是否创建目录。如果为 true，则创建目录；如果为 false 或未提供，则上传文件。
  modTime?: string;
}

interface FilePutFileResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FileReadDirParams {
  path: string; // 要读取的目录路径 (相对于工作空间根目录)。
}

interface FileReadDirResponseDataItem {
  name: string; // 文件名或目录名
  isDir: boolean; // 是否为目录
  isSymlink: boolean; // 是否为符号链接
  updated: number; // 最后修改时间的Unix时间戳 (秒)
}

interface FileReadDirResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: Array<FileReadDirResponseDataItem>; // 目录中的条目列表
}

interface FileRemoveFileParams {
  path: string; // 要移除的文件或目录路径 (相对于工作空间根目录)。
}

interface FileRemoveFileResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FileRenameFileParams {
  path: string; // 原始文件或目录路径 (相对于工作空间根目录)。
  newPath: string; // 新的文件或目录路径 (相对于工作空间根目录)。
}

interface FileRenameFileResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FiletreeChangeSortParams {
  notebook: string; // 要更改排序的笔记本ID。
  paths: Array<string>; // 需要调整排序的文档路径列表。这些路径通常是文档在其笔记本内的相对路径。后端会根据这些路径的顺序来更新文档树的排序。
}

interface FiletreeChangeSortResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FiletreeCreateDailyNoteParams {
  notebook: string; // 要在哪个笔记本下创建日记的ID。
  app?: string;
  callback?: string;
}

interface FiletreeCreateDailyNoteResponseData {
  id: string; // 创建或获取到的日记文档的根块ID。
}

interface FiletreeCreateDailyNoteResponse {
  Code: number; // 响应状态码。0 表示成功创建或获取；1 表示笔记本未找到；-1 表示其他错误。
  Msg: string; // 响应消息。
  Data?: FiletreeCreateDailyNoteResponseData;
}

interface FiletreeCreateDocParams {
  notebook: string; // 文档所属的笔记本ID。
  path: string; // 文档的存储路径 (相对于笔记本根目录，例如 '/folder/documentName')。
  title: string; // 文档的标题。
  md: string; // 文档的初始 Markdown 内容。
  sorts?: Array<string>;
  listDocTree?: boolean;
  callback?: string;
}

interface FiletreeCreateDocResponseData {
  id: string; // 新创建文档的根块ID。
  closeTimeout?: number;
}

interface FiletreeCreateDocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeCreateDocResponseData; // 成功时返回新文档的ID；失败时可能包含 closeTimeout。
}

interface FiletreeCreateDocWithMdParams {
  notebook: string; // 文档所属的笔记本ID。
  path: string; // 文档的人类可读路径 (HPath)，例如 '/My Notes/New Document'。后端会处理路径中的非法字符和长度限制。
  markdown: string; // 新文档的Markdown内容。
  parentID?: string;
  id?: string;
  tags?: string;
  withMath?: boolean;
  clippingHref?: string;
  listDocTree?: boolean;
  callback?: string;
}

interface FiletreeCreateDocWithMdResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: string;
}

interface FiletreeDoc2HeadingParams {
  srcID: string; // 要转换的源文档的ID。
  targetID: string; // 目标文档中，新标题块将插入到其后的那个标题块的ID。如果 after 为 false，则插入其前。
  after: boolean; // 是否将源文档内容插入到 targetID 块之后 (true) 或之前 (false)。
}

interface FiletreeDoc2HeadingResponseData {
  srcTreeBox: string; // 源文档所在的笔记本ID。
  srcTreePath: string; // 源文档的路径。
  closeTimeout?: number;
}

interface FiletreeDoc2HeadingResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeDoc2HeadingResponseData; // 成功时返回源文档的笔记本和路径信息；失败时可能包含 closeTimeout。
}

interface FiletreeDuplicateDocParams {
  id: string; // 要复制的源文档的ID。
  listDocTree?: boolean;
  callback?: string;
}

interface FiletreeDuplicateDocResponseData {
  id: string; // 新复制出来的文档的根块ID。
  notebook: string; // 新文档所在的笔记本ID。
  path: string; // 新文档的存储路径。
  hPath: string; // 新文档的人类可读路径 (HPath)。
  closeTimeout?: number;
}

interface FiletreeDuplicateDocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeDuplicateDocResponseData; // 成功时返回新文档的相关信息；失败时可能包含 closeTimeout。
}

interface FiletreeGetDocParams {
  id: string; // 要获取的文档或块的ID。
  index?: number;
  query?: string;
  queryMethod?: number;
  queryTypes?: Record<string, boolean>;
  mode?: number;
  size?: number;
  startID?: string;
  endID?: string;
  isBacklink?: boolean;
  originalRefBlockIDs?: Record<string, string>;
  highlight?: boolean;
  reqId?: string;
}

interface FiletreeGetDocResponseData {
  id: string; // 请求的原始块ID。
  mode: number; // 请求的加载模式。
  parentID: string; // 父块ID。
  parent2ID: string; // 父父块ID。
  rootID: string; // 文档根块ID。
  type: number; // 块类型。
  content: string; // 块的DOM内容 (HTML字符串)。
  blockCount: number; // 返回的块数量。
  eof: boolean; // 是否已到达文档末尾 (在向下加载模式时)。
  scroll: boolean; // 是否需要滚动定位。
  box: string; // 文档所属的笔记本ID。
  path: string; // 文档的存储路径。
  isSyncing: boolean; // 文档当前是否正在同步中。
  isBacklinkExpand: boolean; // 是否为反链展开上下文。
  keywords?: Array<string>;
  reqId?: string;
}

interface FiletreeGetDocResponse {
  Code: number; // 响应状态码。0: 成功；1: 通用错误；3: 块未找到。
  Msg: string; // 响应消息。
  Data?: FiletreeGetDocResponseData;
}

interface FiletreeGetDocCreateSavePathParams {
  notebook: string; // 当前操作的笔记本ID。计算默认保存位置时会参考此笔记本的配置及全局配置。
}

interface FiletreeGetDocCreateSavePathResponseData {
  box: string; // 计算得出的用于保存新文档的笔记本ID。
  path: string; // 计算得出的用于保存新文档的人类可读路径 (HPath)。
}

interface FiletreeGetDocCreateSavePathResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: FiletreeGetDocCreateSavePathResponseData;
}

interface FiletreeGetFullHPathByIDParams {
  id: string; // 要查询的文档或块的ID。
}

interface FiletreeGetFullHPathByIDResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: string;
}

interface FiletreeGetHPathByIDParams {
  id: string; // 要查询的文档或块的ID。
}

interface FiletreeGetHPathByIDResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: string;
}

interface FiletreeGetHPathByPathParams {
  notebook: string; // 文档所在的笔记本ID。
  path: string; // 文档的实际存储路径 (相对于笔记本根目录，例如 '/folderName/documentName.sy')。
}

interface FiletreeGetHPathByPathResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: string;
}

interface FiletreeGetHPathsByPathsParamsPathsItem {
  notebook: string; // 文档所在的笔记本ID。
  path: string; // 文档的实际存储路径 (相对于笔记本根目录)。
}

interface FiletreeGetHPathsByPathsParams {
  paths: Array<FiletreeGetHPathsByPathsParamsPathsItem>; // 包含笔记本ID和文档路径的对象数组。
}

interface FiletreeGetHPathsByPathsResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: Array<string>;
}

interface FiletreeGetIDsByHPathParams {
  notebook: string; // 文档所在的笔记本ID。
  path: string; // 要查询的文档的人类可读路径 (HPath)，例如 '/My Notes/Topic'。
}

interface FiletreeGetIDsByHPathResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: Array<string>;
}

interface FiletreeGetPathByIDParams {
  id: string; // 要查询的文档或块的ID。
}

interface FiletreeGetPathByIDResponseData {
  path: string; // 文档的实际存储路径 (相对于笔记本根目录，例如 '/folderName/documentName.sy')。
  notebook: string; // 文档所在的笔记本ID。
}

interface FiletreeGetPathByIDResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: FiletreeGetPathByIDResponseData;
}

interface FiletreeGetRefCreateSavePathParams {
  notebook: string; // 当前操作的笔记本ID。计算默认保存位置时会参考此笔记本的配置及全局配置。
}

interface FiletreeGetRefCreateSavePathResponseData {
  box: string; // 计算得出的用于保存新块引文档的笔记本ID。
  path: string; // 计算得出的用于保存新块引文档的人类可读路径 (HPath)。
}

interface FiletreeGetRefCreateSavePathResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: FiletreeGetRefCreateSavePathResponseData;
}

interface FiletreeHeading2DocParams {
  srcHeadingID: string; // 源文档中要转换为新文档的标题块的ID。
  targetNoteBook: string; // 新文档将要创建在哪个笔记本的ID。
  targetPath?: string;
  previousPath?: string;
  callback?: string;
}

interface FiletreeHeading2DocResponseData {
  srcRootBlockID: string; // 转换后新文档的根块ID。
  path: string; // 新文档在目标笔记本中的实际存储路径。
  closeTimeout?: number;
}

interface FiletreeHeading2DocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeHeading2DocResponseData; // 成功时返回新文档的ID和路径；失败时可能包含 closeTimeout。
}

interface FiletreeLi2DocParams {
  srcListItemID: string; // 源文档中要转换为新文档的列表项的ID。
  targetNoteBook: string; // 新文档将要创建在哪个笔记本的ID。
  targetPath?: string;
  previousPath?: string;
  callback?: string;
}

interface FiletreeLi2DocResponseData {
  srcRootBlockID: string; // 转换后新文档的根块ID。
  path: string; // 新文档在目标笔记本中的实际存储路径。
  closeTimeout?: number;
}

interface FiletreeLi2DocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeLi2DocResponseData; // 成功时返回新文档的ID和路径；失败时可能包含 closeTimeout。
}

interface FiletreeListDocTreeParams {
  notebook: string; // 要列出文档树的笔记本ID。
  path: string; // 要列出文档树的起始路径 (相对于笔记本根目录，例如 '/folderName')。通常用于列出某个文件夹下的文档结构。
}

interface FiletreeListDocTreeResponseDataTreeItem {
  id: string; // 文档或目录的ID。
  children?: Array<any>;
}

interface FiletreeListDocTreeResponseData {
  tree: Array<FiletreeListDocTreeResponseDataTreeItem>; // 文档树结构数组。
}

interface FiletreeListDocTreeResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: FiletreeListDocTreeResponseData;
}

interface FiletreeListDocsByPathParams {
  notebook: string; // 笔记本ID。
  path: string; // 要列出文档的路径 (相对于笔记本根目录，例如 '/folderName')。空字符串表示笔记本根目录。
  sort?: number;
  flashcard?: boolean;
  maxListCount?: number;
  showHidden?: boolean;
  ignoreMaxListHint?: boolean;
}

interface FiletreeListDocsByPathResponseDataFilesItem {
  type: string; // 条目类型，'d' 表示目录 (doc file)，'f' 表示文件 (asset file)。在 filetree 上下文，通常都是文档，但 model.File 的定义更通用。
  name: string; // 文档名或目录名 (不含.sy后缀)。
  alias?: string;
  memo?: string;
  bookmark?: string;
  hPath: string; // 人类可读路径 (HPath)。
  id: string; // 文档ID。
  path: string; // 文档的实际存储路径 (相对于笔记本根目录)。
  nameCount?: number;
  updated: number; // 文档最后修改时间的Unix时间戳 (秒)。
  subFileCount: number; // 如果是目录，表示其下子文档/目录的数量。
  icon?: string;
  sort?: number;
  refCount?: number;
  newFlashcardCount?: number;
  dueFlashcardCount?: number;
  flashcardCount?: number;
  hidden?: boolean;
}

interface FiletreeListDocsByPathResponseData {
  box: string; // 请求的笔记本ID。
  path: string; // 请求的路径。
  files: Array<FiletreeListDocsByPathResponseDataFilesItem>; // 文档和子目录列表。
}

interface FiletreeListDocsByPathResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: FiletreeListDocsByPathResponseData;
}

interface FiletreeMoveDocsParams {
  fromPaths: Array<string>; // 要移动的源文档路径数组。每个路径字符串应为 '笔记本ID/文档相对路径.sy' 或 '笔记本ID/文档相对路径' 的形式。后端会处理。例如：['box123/notes/docA.sy', 'box456/folder/docB']
  toNotebook: string; // 目标笔记本的ID。
  toPath: string; // 目标路径 (HPath 或实际路径均可，后端会尝试解析)。文档将被移动到此路径下。例如 '/Target Folder' 或 '/Target Folder/NewName.sy' (如果只移动一个文件且想重命名)。
  callback?: string;
}

interface FiletreeMoveDocsResponseData {
  closeTimeout?: number;
}

interface FiletreeMoveDocsResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeMoveDocsResponseData | null;
}

interface FiletreeMoveDocsByIDParams {
  fromIDs: Array<string>; // 要移动的源文档ID数组。
  toID: string; // 目标文档或目录的ID。如果 toID 是一个文档，则 fromIDs 中的文档会成为其子文档（如果内核逻辑支持）；如果 toID 是一个目录（通常是一个文档的HPath的父级），则 fromIDs 中的文档会被移动到该目录下。具体行为需参考内核实现细节。后台实现中，会先通过 toID 获取其 toNotebook 和 toPath，然后调用 model.MoveDocs。
  callback?: string;
}

interface FiletreeMoveDocsByIDResponseData {
  closeTimeout?: number;
}

interface FiletreeMoveDocsByIDResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeMoveDocsByIDResponseData | null;
}

interface FiletreeMoveLocalShorthandsParams {
  notebook: string; // 要处理闪念速记的笔记本ID。
  path?: string;
  parentID?: string;
}

interface FiletreeMoveLocalShorthandsResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FiletreeRefreshFiletreeResponse {
  Code: number; // 响应状态码，0 表示成功（操作已异步启动）
  Msg: string; // 响应消息
  Data?: null;
}

interface FiletreeRemoveDocParams {
  notebook: string; // 文档所在的笔记本ID。
  path: string; // 要移除的文档的相对路径 (相对于笔记本根目录，例如 '/notes/docToRemove.sy')。
}

interface FiletreeRemoveDocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FiletreeRemoveDocByIDParams {
  id: string; // 要移除的文档的ID。
}

interface FiletreeRemoveDocByIDResponseData {
  closeTimeout?: number;
}

interface FiletreeRemoveDocByIDResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeRemoveDocByIDResponseData | null;
}

interface FiletreeRemoveDocsParams {
  paths: Array<string>; // 要移除的文档的复合路径数组。每个路径字符串应为 '笔记本ID/文档相对路径.sy' 或 '笔记本ID/文档相对路径' 的形式。例如：['box123/notes/docA.sy', 'box456/folder/docB']
}

interface FiletreeRemoveDocsResponse {
  Code: number; // 响应状态码，0 表示成功（即使部分路径无效也可能返回0，具体需看Msg）
  Msg: string; // 响应消息。如果部分文档移除失败，Msg中可能会有提示。
  Data?: null;
}

interface FiletreeRemoveIndexesParams {
  paths: Array<string>; // 需要移除索引的文档绝对路径列表。这些路径通常指向 data 目录下的 .sy 文件，例如 '/data/notebookId/path/to/doc.sy'。
}

interface FiletreeRemoveIndexesResponse {
  Code: number; // 响应状态码，0 表示成功（操作已接受）
  Msg: string; // 响应消息
  Data?: null;
}

interface FiletreeRenameDocParams {
  notebook: string; // 文档所在的笔记本ID。
  path: string; // 要重命名的文档的当前相对路径 (相对于笔记本根目录，例如 '/notes/oldName.sy')。
  title: string; // 文档的新标题 (不需要带 .sy 后缀)。
}

interface FiletreeRenameDocResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: null;
}

interface FiletreeRenameDocByIDParams {
  id: string; // 要重命名的文档的ID。
  title: string; // 文档的新标题 (不需要带 .sy 后缀)。
}

interface FiletreeRenameDocByIDResponseData {
  closeTimeout?: number;
}

interface FiletreeRenameDocByIDResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: FiletreeRenameDocByIDResponseData | null;
}

interface FiletreeSearchDocsParams {
  k: string; // 搜索关键词。
  flashcard?: boolean;
}

interface FiletreeSearchDocsResponseDataItem {
  box: string; // 文档所属的笔记本ID。
  path: string; // 文档的实际存储路径。
  hPath: string; // 文档的人类可读路径。
  id: string; // 文档ID。
  name: string; // 文档名。
  nameRaw: string; // 文档名原文（可能包含高亮标签）。
  alias?: string;
  aliasRaw?: string;
  memo?: string;
}

interface FiletreeSearchDocsResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data?: Array<FiletreeSearchDocsResponseDataItem>;
}

interface FiletreeUpsertIndexesParams {
  paths: Array<string>; // 需要更新/插入索引的文档绝对路径列表。这些路径通常指向 data 目录下的 .sy 文件，例如 '/data/notebookId/path/to/doc.sy'。
}

interface FiletreeUpsertIndexesResponse {
  Code: number; // 响应状态码，0 表示成功（操作已接受）
  Msg: string; // 响应消息
  Data?: null;
}

interface FormatAutoSpaceParams {
  id: string; // 要处理的块 ID。
}

interface FormatAutoSpaceResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: null; // 操作成功时为 null
}

interface FormatNetAssets2LocalAssetsParams {
  id: string; // 要处理的块 ID，该块内的网络资源将被转存。
}

interface FormatNetAssets2LocalAssetsResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: null; // 操作成功时为 null
}

interface FormatNetImg2LocalAssetsParams {
  id: string; // 要处理的块 ID。块内的网络图片将被转存。
  url?: string;
}

interface FormatNetImg2LocalAssetsResponse {
  Code: number; // API 调用返回码，0 表示成功
  Msg: string; // API 调用返回消息
  Data: null; // 操作成功时为 null
}

interface GraphGetGraphParamsConfType {
  tag: boolean; // 是否显示标签节点
  paragraph: boolean; // 是否显示段落块节点
  heading: boolean; // 是否显示标题块节点
  math: boolean; // 是否显示数学公式块节点
  code: boolean; // 是否显示代码块节点
  table: boolean; // 是否显示表格块节点
  list: boolean; // 是否显示列表块节点
  listItem: boolean; // 是否显示列表项块节点
  blockquote: boolean; // 是否显示引述块节点
  super: boolean; // 是否显示超级块节点
}

interface GraphGetGraphParamsConfD3 {
  nodeSize: number; // 节点大小
  linkWidth: number; // 连线宽度
  lineOpacity: number; // 连线不透明度
  centerStrength: number; // 中心力强度
  collideRadius: number; // 碰撞半径
  collideStrength: number; // 碰撞力强度
  linkDistance: number; // 连线距离
  arrow: boolean; // 是否显示箭头
}

interface GraphGetGraphParamsConf {
  minRefs: number; // 节点最少被引用次数（低于此值将被隐藏）
  dailyNote: boolean; // 是否包含日记节点
  type: GraphGetGraphParamsConfType; // 节点类型筛选配置
  d3: GraphGetGraphParamsConfD3; // D3力导向图配置
}

interface GraphGetGraphParams {
  reqId: any; // 请求 ID，用于跟踪异步请求
  k: string; // 搜索关键词，用于筛选关系图中的节点
  conf: GraphGetGraphParamsConf; // 全局关系图配置项
}

interface GraphGetGraphResponseNodesItem {
  id: string; // 节点 ID (通常是块 ID 或标签名)
  box: string; // 节点所属的笔记本 ID
  path: string; // 节点对应的文档路径
  size: number; // 节点在图中的显示大小
  title?: string;
  label: string; // 节点标签 (显示在节点上的文字)
  type: string; // 节点类型 (块类型或 'tag')
  refs: number; // 节点的引用数量
  defs: number; // 节点的被引用数量 (定义数量)
}

interface GraphGetGraphResponseLinksItemArrowsTo {
  enabled: boolean; // 箭头是否启用
}

interface GraphGetGraphResponseLinksItemArrows {
  to?: GraphGetGraphResponseLinksItemArrowsTo;
}

interface GraphGetGraphResponseLinksItem {
  from: string; // 起始节点 ID
  to: string; // 目标节点 ID
  ref: boolean; // 是否为引用关系 (true: 引用关系, false: 父子层级关系)
  arrows?: GraphGetGraphResponseLinksItemArrows;
}

interface GraphGetGraphResponseConfType {
  tag: boolean; // 是否显示标签节点
  paragraph: boolean; // 是否显示段落块节点
  heading: boolean; // 是否显示标题块节点
  math: boolean; // 是否显示数学公式块节点
  code: boolean; // 是否显示代码块节点
  table: boolean; // 是否显示表格块节点
  list: boolean; // 是否显示列表块节点
  listItem: boolean; // 是否显示列表项块节点
  blockquote: boolean; // 是否显示引述块节点
  super: boolean; // 是否显示超级块节点
}

interface GraphGetGraphResponseConfD3 {
  nodeSize: number; // 节点大小
  linkWidth: number; // 连线宽度
  lineOpacity: number; // 连线不透明度
  centerStrength: number; // 中心力强度
  collideRadius: number; // 碰撞半径
  collideStrength: number; // 碰撞力强度
  linkDistance: number; // 连线距离
  arrow: boolean; // 是否显示箭头
}

interface GraphGetGraphResponseConf {
  minRefs: number; // 节点最少被引用次数（低于此值将被隐藏）
  dailyNote: boolean; // 是否包含日记节点
  type: GraphGetGraphResponseConfType; // 节点类型筛选配置
  d3: GraphGetGraphResponseConfD3; // D3力导向图配置
}

interface GraphGetGraphResponse {
  nodes: Array<GraphGetGraphResponseNodesItem>; // 关系图中的节点列表
  links: Array<GraphGetGraphResponseLinksItem>; // 关系图中的边列表
  conf: GraphGetGraphResponseConf; // 更新后的全局关系图配置项
  box: string; // 当前知识空间（笔记本组）ID
  reqId: any; // 请求 ID，与请求参数中的 reqId 一致
}

interface GraphGetLocalGraphParamsConfType {
  tag: boolean; // 是否显示标签节点
  paragraph: boolean; // 是否显示段落块节点
  heading: boolean; // 是否显示标题块节点
  math: boolean; // 是否显示数学公式块节点
  code: boolean; // 是否显示代码块节点
  table: boolean; // 是否显示表格块节点
  list: boolean; // 是否显示列表块节点
  listItem: boolean; // 是否显示列表项块节点
  blockquote: boolean; // 是否显示引述块节点
  super: boolean; // 是否显示超级块节点
}

interface GraphGetLocalGraphParamsConfD3 {
  nodeSize: number; // 节点大小
  linkWidth: number; // 连线宽度
  lineOpacity: number; // 连线不透明度
  centerStrength: number; // 中心力强度
  collideRadius: number; // 碰撞半径
  collideStrength: number; // 碰撞力强度
  linkDistance: number; // 连线距离
  arrow: boolean; // 是否显示箭头
}

interface GraphGetLocalGraphParamsConf {
  dailyNote: boolean; // 是否包含日记节点
  type: GraphGetLocalGraphParamsConfType; // 节点类型筛选配置
  d3: GraphGetLocalGraphParamsConfD3; // D3力导向图配置
}

interface GraphGetLocalGraphParams {
  reqId: any; // 请求 ID，用于跟踪异步请求
  id: string; // 文档 ID，用于构建局部关系图的中心节点
  k: string; // 搜索关键词，用于筛选关系图中的节点
  conf: GraphGetLocalGraphParamsConf; // 局部关系图配置项
}

interface GraphGetLocalGraphResponseNodesItem {
  id: string; // 节点 ID (通常是块 ID 或标签名)
  box: string; // 节点所属的笔记本 ID
  path: string; // 节点对应的文档路径
  size: number; // 节点在图中的显示大小
  title?: string;
  label: string; // 节点标签 (显示在节点上的文字)
  type: string; // 节点类型 (块类型或 'tag')
  refs: number; // 节点的引用数量
  defs: number; // 节点的被引用数量 (定义数量)
}

interface GraphGetLocalGraphResponseLinksItemArrowsTo {
  enabled: boolean; // 箭头是否启用
}

interface GraphGetLocalGraphResponseLinksItemArrows {
  to?: GraphGetLocalGraphResponseLinksItemArrowsTo;
}

interface GraphGetLocalGraphResponseLinksItem {
  from: string; // 起始节点 ID
  to: string; // 目标节点 ID
  ref: boolean; // 是否为引用关系 (true: 引用关系, false: 父子层级关系)
  arrows?: GraphGetLocalGraphResponseLinksItemArrows;
}

interface GraphGetLocalGraphResponseConfType {
  tag: boolean; // 是否显示标签节点
  paragraph: boolean; // 是否显示段落块节点
  heading: boolean; // 是否显示标题块节点
  math: boolean; // 是否显示数学公式块节点
  code: boolean; // 是否显示代码块节点
  table: boolean; // 是否显示表格块节点
  list: boolean; // 是否显示列表块节点
  listItem: boolean; // 是否显示列表项块节点
  blockquote: boolean; // 是否显示引述块节点
  super: boolean; // 是否显示超级块节点
}

interface GraphGetLocalGraphResponseConfD3 {
  nodeSize: number; // 节点大小
  linkWidth: number; // 连线宽度
  lineOpacity: number; // 连线不透明度
  centerStrength: number; // 中心力强度
  collideRadius: number; // 碰撞半径
  collideStrength: number; // 碰撞力强度
  linkDistance: number; // 连线距离
  arrow: boolean; // 是否显示箭头
}

interface GraphGetLocalGraphResponseConf {
  dailyNote: boolean; // 是否包含日记节点
  type: GraphGetLocalGraphResponseConfType; // 节点类型筛选配置
  d3: GraphGetLocalGraphResponseConfD3; // D3力导向图配置
}

interface GraphGetLocalGraphResponse {
  id: string; // 请求的文档 ID
  box: string; // 当前知识空间（笔记本组）ID
  nodes: Array<GraphGetLocalGraphResponseNodesItem>; // 关系图中的节点列表
  links: Array<GraphGetLocalGraphResponseLinksItem>; // 关系图中的边列表
  conf: GraphGetLocalGraphResponseConf; // 更新后的局部关系图配置项
  reqId: any; // 请求 ID，与请求参数中的 reqId 一致
}

interface GraphResetGraphResponseConfType {
  tag: boolean; // 是否显示标签节点
  paragraph: boolean; // 是否显示段落块节点
  heading: boolean; // 是否显示标题块节点
  math: boolean; // 是否显示数学公式块节点
  code: boolean; // 是否显示代码块节点
  table: boolean; // 是否显示表格块节点
  list: boolean; // 是否显示列表块节点
  listItem: boolean; // 是否显示列表项块节点
  blockquote: boolean; // 是否显示引述块节点
  super: boolean; // 是否显示超级块节点
}

interface GraphResetGraphResponseConfD3 {
  nodeSize: number; // 节点大小
  linkWidth: number; // 连线宽度
  lineOpacity: number; // 连线不透明度
  centerStrength: number; // 中心力强度
  collideRadius: number; // 碰撞半径
  collideStrength: number; // 碰撞力强度
  linkDistance: number; // 连线距离
  arrow: boolean; // 是否显示箭头
}

interface GraphResetGraphResponseConf {
  minRefs: number; // 节点最少被引用次数（低于此值将被隐藏）
  dailyNote: boolean; // 是否包含日记节点
  type: GraphResetGraphResponseConfType; // 节点类型筛选配置
  d3: GraphResetGraphResponseConfD3; // D3力导向图配置
}

interface GraphResetGraphResponse {
  conf: GraphResetGraphResponseConf; // 重置后的全局关系图配置项
}

interface GraphResetLocalGraphResponseConfType {
  tag: boolean; // 是否显示标签节点
  paragraph: boolean; // 是否显示段落块节点
  heading: boolean; // 是否显示标题块节点
  math: boolean; // 是否显示数学公式块节点
  code: boolean; // 是否显示代码块节点
  table: boolean; // 是否显示表格块节点
  list: boolean; // 是否显示列表块节点
  listItem: boolean; // 是否显示列表项块节点
  blockquote: boolean; // 是否显示引述块节点
  super: boolean; // 是否显示超级块节点
}

interface GraphResetLocalGraphResponseConfD3 {
  nodeSize: number; // 节点大小
  linkWidth: number; // 连线宽度
  lineOpacity: number; // 连线不透明度
  centerStrength: number; // 中心力强度
  collideRadius: number; // 碰撞半径
  collideStrength: number; // 碰撞力强度
  linkDistance: number; // 连线距离
  arrow: boolean; // 是否显示箭头
}

interface GraphResetLocalGraphResponseConf {
  dailyNote: boolean; // 是否包含日记节点
  type: GraphResetLocalGraphResponseConfType; // 节点类型筛选配置
  d3: GraphResetLocalGraphResponseConfD3; // D3力导向图配置
}

interface GraphResetLocalGraphResponse {
  conf: GraphResetLocalGraphResponseConf; // 重置后的局部关系图配置项
}

interface HistoryClearWorkspaceHistoryResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: null; // 成功时固定为 null
}

interface HistoryGetDocHistoryContentParams {
  historyPath: string; // 文档历史版本的路径，通常从其他历史记录接口获取
  k?: string;
  highlight?: boolean;
}

interface HistoryGetDocHistoryContentResponseData {
  id: string; // 文档的 ID
  rootID: string; // 文档的根块 ID
  content: string; // 文档历史版本的内容 (HTML 格式)
  isLargeDoc: boolean; // 是否为大文档
}

interface HistoryGetDocHistoryContentResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: HistoryGetDocHistoryContentResponseData | null;
}

interface HistoryGetHistoryItemsParams {
  created: string; // 创建日期，格式如 'YYYYMMDD'
  notebook?: string;
  type?: number;
  query: string; // 搜索关键词
  op?: string;
}

interface HistoryGetHistoryItemsResponseDataItemsItem {
  id: string; // 历史记录条目的唯一ID (通常为历史文件名或路径相关ID)
  title: string; // 历史记录条目的标题或名称
  content: string; // 历史记录条目的简要内容或描述
  notebookID: string; // 所属笔记本ID
  notebookName: string; // 所属笔记本名称
  path: string; // 相关文档或资源的路径
  type: number; // 历史记录类型
  created: string; // 创建时间 (Unix时间戳字符串或特定格式日期)
  updated: string; // 更新时间 (Unix时间戳字符串或特定格式日期)
  size: number; // 大小 (字节)
  hSize: string; // 人类可读的大小
  count: number; // 相关计数 (例如，如果是笔记本历史，可能表示包含的文档数)
  repoID?: string;
  historyName?: string;
  historyPath?: string;
  docID?: string;
}

interface HistoryGetHistoryItemsResponseData {
  items: Array<HistoryGetHistoryItemsResponseDataItemsItem>; // 符合条件的历史条目数组
}

interface HistoryGetHistoryItemsResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: HistoryGetHistoryItemsResponseData | null;
}

interface HistoryGetNotebookHistoryResponseDataHistoriesItem {
  id: string; // 历史记录的唯一ID (通常为历史文件名或路径相关ID)
  title: string; // 历史记录的标题 (通常是笔记本名称)
  type: number; // 历史类型 (应为2，代表笔记本历史)
  created: string; // 历史创建的时间戳 (格式：YYYYMMDDHHmmss)
  updated: string; // 历史更新的时间戳 (格式：YYYYMMDDHHmmss)
  count: number; // 该历史版本包含的文档数量
  size: number; // 历史版本占用的磁盘空间大小 (字节)
  hSize: string; // 人类可读的磁盘空间大小
  repoID: string; // 所属版本库ID (通常是笔记本ID)
  historyName: string; // 历史文件名 (例如 '20230315103000.json')
  historyPath: string; // 历史文件的完整存储路径
}

interface HistoryGetNotebookHistoryResponseData {
  histories: Array<HistoryGetNotebookHistoryResponseDataHistoriesItem>; // 笔记本历史记录数组
}

interface HistoryGetNotebookHistoryResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: HistoryGetNotebookHistoryResponseData | null;
}

interface HistoryReindexHistoryResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: null; // 成功时固定为 null
}

interface HistoryRollbackAssetsHistoryParams {
  historyPath: string; // 资源文件历史版本的路径，通常从其他历史记录接口获取
}

interface HistoryRollbackAssetsHistoryResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: null; // 成功时固定为 null
}

interface HistoryRollbackDocHistoryParams {
  notebook: string; // 文档所属的笔记本 ID
  historyPath: string; // 文档历史版本的路径，通常从其他历史记录接口获取
}

interface HistoryRollbackDocHistoryResponseData {
  box: string; // 文档所属的笔记本 ID
}

interface HistoryRollbackDocHistoryResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: HistoryRollbackDocHistoryResponseData | null;
}

interface HistoryRollbackNotebookHistoryParams {
  historyPath: string; // 笔记本历史版本的路径，通常从 getNotebookHistory 接口获取
}

interface HistoryRollbackNotebookHistoryResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: null; // 成功时固定为 null
}

interface HistorySearchHistoryParams {
  notebook?: string;
  type?: number;
  query: string; // 搜索关键词
  page?: number;
  op?: string;
}

interface HistorySearchHistoryResponseDataHistoriesItemItemsItem {
  id: string; // 历史记录条目的唯一ID
  title: string; // 历史记录条目的标题或名称
  content: string; // 历史记录条目的简要内容或描述
  notebookID: string; // 所属笔记本ID
  notebookName: string; // 所属笔记本名称
  path: string; // 相关文档或资源的路径
  type: number; // 历史记录类型
  created: string; // 创建时间 (Unix时间戳字符串或特定格式日期)
  updated: string; // 更新时间 (Unix时间戳字符串或特定格式日期)
  size: number; // 大小 (字节)
  hSize: string; // 人类可读的大小
  count: number; // 相关计数
  repoID?: string;
  historyName?: string;
  historyPath?: string;
  docID?: string;
}

interface HistorySearchHistoryResponseDataHistoriesItem {
  created: string; // 历史记录分组的创建日期 (格式：YYYYMMDD)
  count: number; // 该日期分组下的历史条目数量
  items?: Array<HistorySearchHistoryResponseDataHistoriesItemItemsItem>;
}

interface HistorySearchHistoryResponseData {
  histories: Array<HistorySearchHistoryResponseDataHistoriesItem>; // 按日期分组的历史记录数组
  pageCount: number; // 总页数
  totalCount: number; // 符合条件的总历史记录条目数 (注意，这里可能指分组数量，不是单个item数量)
}

interface HistorySearchHistoryResponse {
  Code: number; // 响应状态码，0 表示成功
  Msg: string; // 响应消息
  Data: HistorySearchHistoryResponseData | null;
}

interface IconGetDynamicIconParams {
  type?: string;
  color?: string;
  date?: string;
  lang?: string;
  weekdayType?: string;
  content?: string;
  id?: string;
}

interface ImportImportDataResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface ImportImportSYResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface ImportImportStdMdParams {
  notebook: string; // 目标笔记本的 ID
  localPath: string; // 本地 Markdown 文件或文件夹的绝对路径
  toPath: string; // 导入到笔记本内的目标父路径，例如 '/' 表示笔记本根目录
}

interface ImportImportStdMdResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface InboxGetShorthandParams {
  id: string; // 要获取的速记的唯一标识符 (通常为时间戳字符串)
}

interface InboxGetShorthandResponseData {
  id?: string;
  shorthandContent: string; // 速记内容 (经过 Lute 引擎处理后的 HTML 格式)
  shorthandMd: string; // 速记内容的原始 Markdown 格式
  hCreated: string; // 格式化后的创建时间 (YYYY-MM-DD HH:mm)
  [key: string]: any; // From .catchall()
}

interface InboxGetShorthandResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: InboxGetShorthandResponseData; // 包含速记详细信息的对象
}

interface InboxGetShorthandsParams {
  page: number; // 要获取的速记列表的页码，从 1 开始
}

interface InboxGetShorthandsResponseDataShorthandsItem {
  oId: string; // 速记的原始唯一标识符 (通常为时间戳字符串)
  shorthandContent: string; // 速记内容 (经过 Lute 引擎处理后的 HTML 格式)
  shorthandMd: string; // 速记内容的原始 Markdown 格式
  shorthandDesc: string; // 速记的描述 (经过处理，例如音视频标签被替换为文字)
  hCreated: string; // 格式化后的创建时间 (YYYY-MM-DD HH:mm)
  [key: string]: any; // From .catchall()
}

interface InboxGetShorthandsResponseData {
  shorthands: Array<InboxGetShorthandsResponseDataShorthandsItem>; // 速记对象列表
  [key: string]: any; // From .catchall()
}

interface InboxGetShorthandsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: InboxGetShorthandsResponseData; // 包含速记列表及可能的分页信息的对象
}

interface InboxRemoveShorthandsParams {
  ids: Array<string>; // 要移除的速记的唯一标识符数组
}

interface InboxRemoveShorthandsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface LuteCopyStdMarkdownParams {
  id: string; // 要导出内容的块的ID
}

interface LuteCopyStdMarkdownResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: string; // 导出的标准 Markdown 内容
}

interface LuteHtml2BlockDOMParams {
  dom: string; // 要转换的 HTML 字符串
}

interface LuteHtml2BlockDOMResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: string; // 转换后的块级 DOM (HTML 格式的字符串)
}

interface LuteSpinBlockDOMParams {
  dom: string; // 要处理的块级 DOM 字符串 (HTML 格式)
}

interface LuteSpinBlockDOMResponseData {
  dom: string; // 经过 SpinBlockDOM 处理后的块级 DOM 字符串 (HTML 格式)
}

interface LuteSpinBlockDOMResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: LuteSpinBlockDOMResponseData;
}

interface MiscBroadcastSubscribeParams {
  channel: string; // 要订阅的一个或多个广播频道名称，多个频道用逗号分隔。此参数通过 URL Query String 传递。
  retry?: number;
}

interface MiscBroadcastParams {
  channel: string; // 要连接的广播频道名称。此参数通过 URL Query String 传递。
}

interface NetworkForwardProxyParams {
  url: string; // 必需。要请求的目标 URL，必须是合法的 HTTP 或 HTTPS 地址。
  method?: string;
  timeout?: number;
  headers?: Array<Record<string, any>>;
  contentType?: string;
  payload?: any;
  payloadEncoding?: 'json' | 'text' | 'base64' | 'base64-std' | 'base64-url' | 'base32' | 'base32-std' | 'base32-hex' | 'hex';
}

interface NetworkForwardProxyResponseDataCookiesItem {
  Name: string;
  Value: string;
  Path?: string;
  Domain?: string;
  Expires?: string;
  RawExpires?: string;
  MaxAge?: number;
  Secure?: boolean;
  HttpOnly?: boolean;
  SameSite?: 0 | 1 | 2 | 3 | 4;
  Raw?: string;
  Unparsed?: Array<string>;
}

interface NetworkForwardProxyResponseData {
  status: string; // 目标服务器返回的 HTTP 状态文本，例如 '200 OK'。
  statusCode: number; // 目标服务器返回的 HTTP 状态码，例如 200。
  proto: string; // 目标服务器响应的 HTTP 协议版本，例如 'HTTP/1.1'。
  headers: Record<string, Array<string>>; // 目标服务器返回的 HTTP 响应头，键为头域名，值为字符串数组织。例如 {'Content-Type': ['application/json']}
  cookies?: Array<NetworkForwardProxyResponseDataCookiesItem>;
  body: string; // 目标服务器返回的响应体内容，经过 Base64 编码。
  url: string; // 实际请求的最终 URL (可能经过重定向)。
  length: number; // 目标服务器返回的响应体原始长度 (解码前)。
  isText: boolean; // 指示目标服务器返回的响应体是否为文本类型。
}

interface NetworkForwardProxyResponse {
  Code: number; // 返回码。0 表示代理请求成功（无论目标服务器返回何种状态码），非 0 表示代理请求本身失败。
  Msg: string; // 错误信息。代理请求成功时为空字符串。
  Data: NetworkForwardProxyResponseData | null;
}

interface NotebookChangeSortNotebookParams {
  notebooks: Array<string>; // 按新的期望顺序排列的笔记本 ID 数组。
}

interface NotebookChangeSortNotebookResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface NotebookCloseNotebookParams {
  notebook: string; // 要关闭的笔记本的唯一标识符 (ID)。
  callback?: string;
}

interface NotebookCloseNotebookResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface NotebookCreateNotebookParams {
  name: string; // 新笔记本的名称，不能为空。
}

interface NotebookCreateNotebookResponseDataNotebook {
  id: string; // 新创建的笔记本ID
  name: string; // 新创建的笔记本名称
  icon: string; // 笔记本图标
  sort: number; // 笔记本排序值
  closed: boolean; // 笔记本是否关闭 (刚创建时应为 false)
  sortMode: number; // 文档排序模式
}

interface NotebookCreateNotebookResponseData {
  notebook: NotebookCreateNotebookResponseDataNotebook; // 新创建的笔记本对象信息。
}

interface NotebookCreateNotebookResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: NotebookCreateNotebookResponseData; // 包含新创建笔记本信息的对象。
}

interface NotebookGetNotebookConfParams {
  notebook: string; // 要获取配置的笔记本的唯一标识符 (ID)。
}

interface NotebookGetNotebookConfResponseDataConfBoxStat {
  docCount: number; // 文档数量
  assetCount: number; // 资源文件数量
  assetSize: number; // 资源文件总大小 (字节)
  refCount: number; // 引用数量
  headingCount: number; // 标题数量
  listCount: number; // 列表数量
  listItemCount: number; // 列表项数量
  codeBlockCount: number; // 代码块数量
  htmlBlockCount: number; // HTML块数量
  mathBlockCount: number; // 数学公式块数量
  tableCount: number; // 表格数量
  quoteCount: number; // 引述块数量
  superBlockCount: number; // 超级块数量
  paragraphCount: number; // 段落数量
  fileAnnotationCount: number; // 文件标注数量
  updated: number; // 最后更新时间 (Unix时间戳，秒)
}

interface NotebookGetNotebookConfResponseDataConf {
  name: string; // 笔记本名称
  sort: number; // 笔记本的排序值
  icon: string; // 笔记本图标 (Emoji 或 Base64)
  closed: boolean; // 笔记本是否关闭
  sortMode: number; // 文档排序模式: 0(自定义拖拽), 1(修改时间升序), 2(修改时间降序), 3(创建时间升序), 4(创建时间降序), 5(字母升序), 6(字母降序), 7(HPath升序), 8(HPath降序), 11(文档包含块升序), 12(文档包含块降序), 13(子文档数升序), 14(子文档数降序)
  refCreateSavePath: string; // 块引目标文档默认保存路径 (HPath)
  docCreateSavePath: string; // 新文档默认保存路径 (HPath)
  dailyNoteSavePath: string; // 日记默认保存路径 (HPath)
  dailyNoteTemplatePath: string; // 日记模板路径 (HPath)
  boxStat?: NotebookGetNotebookConfResponseDataConfBoxStat;
}

interface NotebookGetNotebookConfResponseData {
  conf: NotebookGetNotebookConfResponseDataConf; // 笔记本的配置对象。
}

interface NotebookGetNotebookConfResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: NotebookGetNotebookConfResponseData; // 包含笔记本配置的对象。
}

interface NotebookGetNotebookInfoParams {
  notebook: string; // 要获取信息的笔记本的唯一标识符 (ID)。
}

interface NotebookGetNotebookInfoResponseDataBoxInfoBoxStat {
  docCount: number; // 文档数量
  assetCount: number; // 资源文件数量
  assetSize: number; // 资源文件总大小 (字节)
  refCount: number; // 引用数量
  headingCount: number; // 标题数量
  listCount: number; // 列表数量
  listItemCount: number; // 列表项数量
  codeBlockCount: number; // 代码块数量
  htmlBlockCount: number; // HTML块数量
  mathBlockCount: number; // 数学公式块数量
  tableCount: number; // 表格数量
  quoteCount: number; // 引述块数量
  superBlockCount: number; // 超级块数量
  paragraphCount: number; // 段落数量
  fileAnnotationCount: number; // 文件标注数量
  updated: number; // 最后更新时间 (Unix时间戳，秒)
}

interface NotebookGetNotebookInfoResponseDataBoxInfo {
  id: string; // 笔记本ID
  name: string; // 笔记本名称
  icon: string; // 笔记本图标
  sort: number; // 笔记本排序值
  closed: boolean; // 笔记本是否关闭
  sortMode: number; // 文档排序模式
  refCreateSavePath: string; // 块引默认保存路径
  docCreateSavePath: string; // 新文档默认保存路径
  dailyNoteSavePath: string; // 日记默认保存路径
  dailyNoteTemplatePath: string; // 日记模板路径
  boxStat: NotebookGetNotebookInfoResponseDataBoxInfoBoxStat; // 笔记本统计信息。
}

interface NotebookGetNotebookInfoResponseData {
  boxInfo: NotebookGetNotebookInfoResponseDataBoxInfo; // 笔记本的详细信息对象。
}

interface NotebookGetNotebookInfoResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: NotebookGetNotebookInfoResponseData; // 包含笔记本详细信息的对象。
}

interface NotebookLsNotebooksResponseDataNotebooksItem {
  id: string; // 笔记本的唯一标识符 (ID)
  name: string; // 笔记本的名称
  icon: string; // 笔记本图标的 Base64 编码或 Emoji 字符
  sort: number; // 笔记本的排序值
  closed: boolean; // 笔记本是否已关闭
  sortMode?: number;
}

interface NotebookLsNotebooksResponseData {
  notebooks: Array<NotebookLsNotebooksResponseDataNotebooksItem>; // 笔记本对象数组。
}

interface NotebookLsNotebooksResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: NotebookLsNotebooksResponseData; // 包含笔记本列表的对象。
}

interface NotebookOpenNotebookParams {
  notebook: string; // 要打开的笔记本的唯一标识符 (ID)。
}

interface NotebookOpenNotebookResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: Record<string, never> | null;
}

interface NotebookRemoveNotebookParams {
  notebook: string; // 要删除的笔记本的唯一标识符 (ID)。
  callback?: string;
}

interface NotebookRemoveNotebookResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface NotebookRenameNotebookParams {
  notebook: string; // 要重命名的笔记本的唯一标识符 (ID)。
  name: string; // 笔记本的新名称，不能为空。
}

interface NotebookRenameNotebookResponseData {
  closeTimeout?: number;
  [key: string]: any; // From .catchall()
}

interface NotebookRenameNotebookResponse {
  Code: number; // 返回码，0 表示成功, -1 表示失败 (例如名称冲突)。
  Msg: string; // 错误信息，成功时为空字符串。
  Data: NotebookRenameNotebookResponseData | null;
}

interface NotebookSetNotebookConfParamsConf {
  name?: string;
  icon?: string;
  sortMode?: number;
  refCreateSavePath?: string;
  docCreateSavePath?: string;
  dailyNoteSavePath?: string;
  dailyNoteTemplatePath?: string;
}

interface NotebookSetNotebookConfParams {
  notebook: string; // 要设置配置的笔记本的唯一标识符 (ID)。
  conf: NotebookSetNotebookConfParamsConf; // 要更新的配置项对象。只提供需要修改的字段。
}

interface NotebookSetNotebookConfResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface NotebookSetNotebookIconParams {
  notebook: string; // 要设置图标的笔记本的唯一标识符 (ID)。
  icon: string; // 笔记本的新图标，可以是 Emoji 字符或图片的 Base64 编码字符串。
}

interface NotebookSetNotebookIconResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data?: null;
}

interface NotificationPushErrMsgParams {
  msg: string; // 必需。要推送的错误消息内容。
  timeout?: number;
}

interface NotificationPushErrMsgResponseData {
  id: string; // 推送的消息的唯一标识符。
}

interface NotificationPushErrMsgResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: NotificationPushErrMsgResponseData; // 包含消息ID的对象。
}

interface NotificationPushMsgParams {
  msg: string; // 必需。要推送的普通消息内容。
  timeout?: number;
}

interface NotificationPushMsgResponseData {
  id: string; // 推送的消息的唯一标识符。
}

interface NotificationPushMsgResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串。如果 msg 为空，则 Code 为 -1，Msg 为 'msg can't be empty'。
  Data: NotificationPushMsgResponseData | null;
}

interface OutlineGetDocOutlineParams {
  id: string; // 必需。要获取大纲的文档块的 ID。通常是文档的根块 ID。
  preview?: boolean;
}

// Recursive type OutlineGetDocOutlineResponseDataItem (processing)

interface OutlineGetDocOutlineResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: Array<OutlineGetDocOutlineResponseDataItem> | null;
}

interface PetalLoadPetalsParams {
  frontend: string; // 必需。指定要加载插件的前端界面，例如 'desktop', 'mobile', 'browser-extension'。
}

interface PetalLoadPetalsResponseDataItem {
  name: string; // 插件的包名 (唯一标识符)
  displayName: string; // 插件的显示名称 (来自 plugin.json)
  enabled: boolean; // 插件是否已在配置中启用
  incompatible: boolean; // 插件是否与当前前端版本不兼容
  js?: string;
  css?: string;
  i18n?: Record<string, any>;
}

interface PetalLoadPetalsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: Array<PetalLoadPetalsResponseDataItem> | null;
}

interface PetalSetPetalEnabledParams {
  packageName: string; // 必需。要设置启用状态的插件的包名 (唯一标识符)。
  enabled: boolean; // 必需。设置插件的启用状态，true 表示启用，false 表示禁用。
  frontend: string; // 必需。指定要设置插件状态的前端界面，例如 'desktop', 'mobile'。
}

interface PetalSetPetalEnabledResponseData {
  name: string; // 插件的包名
  displayName: string; // 插件的显示名称
  enabled: boolean; // 插件更新后的启用状态
  incompatible: boolean; // 插件是否不兼容
}

interface PetalSetPetalEnabledResponse {
  Code: number; // 返回码，0 表示成功，-1 表示插件不兼容或其他错误
  Msg: string; // 错误信息，成功时为空字符串，失败时包含具体错误，如不兼容提示。
  Data: PetalSetPetalEnabledResponseData | null;
}

interface QuerySQLParams {
  stmt: string; // 必需。要执行的 SQL 查询语句。
}

interface QuerySQLResponse {
  Code: number; // 返回码，0 表示成功，其他值表示失败。
  Msg: string; // 错误信息，成功时通常为空字符串。
  Data: Array<Record<string, any>> | null;
}

interface RefGetBacklinkParams {
  id: string; // 必需。要查询反向链接和提及的目标块的 ID。
  k: string; // 用于筛选反向链接结果的关键词。
  mk: string; // 用于筛选反向提及结果的关键词。
  beforeLen?: number;
  containChildren?: boolean;
}

interface RefGetBacklinkResponseData {
  backlinks: Array<any>; // 反向链接块的详细信息数组，具体结构复杂，参考 model.Backlink。
  linkRefsCount: number; // 反向链接的总数量。
  backmentions: Array<any>; // 反向提及块的详细信息数组，具体结构复杂，参考 model.Backmention。
  mentionsCount: number; // 反向提及的总数量。
  k: string; // 实际用于筛选反向链接的关键词。
  mk: string; // 实际用于筛选反向提及的关键词。
  box: string; // 目标块所在的笔记本 ID。
}

interface RefGetBacklinkResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RefGetBacklinkResponseData | null;
}

interface RefGetBacklink2Params {
  id: string; // 必需。要查询反向链接和提及的目标块的 ID。
  k: string; // 用于筛选反向链接结果的关键词。
  mk: string; // 用于筛选反向提及结果的关键词。
  sort?: string;
  mSort?: string;
  containChildren?: boolean;
}

interface RefGetBacklink2ResponseData {
  backlinks: Array<any>; // 反向链接块的详细信息数组，具体结构复杂，参考 model.Backlink。
  linkRefsCount: number; // 反向链接的总数量。
  backmentions: Array<any>; // 反向提及块的详细信息数组，具体结构复杂，参考 model.Backmention。
  mentionsCount: number; // 反向提及的总数量。
  k: string; // 实际用于筛选反向链接的关键词。
  mk: string; // 实际用于筛选反向提及的关键词。
  box: string; // 目标块所在的笔记本 ID。
}

interface RefGetBacklink2Response {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RefGetBacklink2ResponseData | null;
}

interface RefGetBacklinkDocParams {
  defID: string; // 必需。定义块的 ID (即被其他块引用的块)。
  refTreeID: string; // 必需。引用块所在文档树的根块 ID (通常是当前打开的文档的根块 ID)。
  keyword: string; // 用于筛选结果的关键词。
  containChildren?: boolean;
  highlight?: boolean;
}

interface RefGetBacklinkDocResponseData {
  backlinks: Array<any>; // 反向链接块的详细信息数组，具体结构复杂，参考 model.Backlink。
  keywords: Array<string>; // 实际用于高亮的关键词列表。
}

interface RefGetBacklinkDocResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RefGetBacklinkDocResponseData | null;
}

interface RefGetBackmentionDocParams {
  defID: string; // 必需。定义块的 ID (即被其他块提及的块)。
  refTreeID: string; // 必需。提及块所在文档树的根块 ID (通常是当前打开的文档的根块 ID)。
  keyword: string; // 用于筛选结果的关键词。
  containChildren?: boolean;
  highlight?: boolean;
}

interface RefGetBackmentionDocResponseData {
  backmentions: Array<any>; // 反向提及块的详细信息数组，具体结构复杂，参考 model.Backmention。
  keywords: Array<string>; // 实际用于高亮的关键词列表。
}

interface RefGetBackmentionDocResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RefGetBackmentionDocResponseData | null;
}

interface RefRefreshBacklinkParams {
  id: string; // 必需。要刷新反向链接和提及信息的目标块的 ID。
}

interface RefRefreshBacklinkResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoCheckoutRepoParams {
  id: string; // 必需。要检出的快照的唯一标识符 (ID)。
}

interface RepoCheckoutRepoResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoCreateSnapshotParams {
  memo?: string;
  tag?: string;
}

interface RepoCreateSnapshotResponseData {
  id: string; // 新创建的快照的唯一标识符 (ID)。
}

interface RepoCreateSnapshotResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RepoCreateSnapshotResponseData; // 包含新快照ID的对象。
}

interface RepoDiffRepoSnapshotsParams {
  left: string; // 必需。左侧快照的 ID，作为比较基准的旧版本。
  right: string; // 必需。右侧快照的 ID，作为比较目标的新版本。
}

interface RepoDiffRepoSnapshotsResponseDataAddsLeftItem {
  id: string; // 文档ID
  hPath: string; // 文档HPath
}

interface RepoDiffRepoSnapshotsResponseDataUpdatesLeftItem {
  id: string; // 文档ID
  hPath: string; // 文档HPath
}

interface RepoDiffRepoSnapshotsResponseDataUpdatesRightItem {
  id: string; // 文档ID
  hPath: string; // 文档HPath
}

interface RepoDiffRepoSnapshotsResponseDataRemovesRightItem {
  id: string; // 文档ID
  hPath: string; // 文档HPath
}

interface RepoDiffRepoSnapshotsResponseDataLeft {
  id: string; // 快照ID
  created: string; // 创建时间戳 (Unix 毫秒)
  memo: string; // 备注
}

interface RepoDiffRepoSnapshotsResponseDataRight {
  id: string; // 快照ID
  created: string; // 创建时间戳 (Unix 毫秒)
  memo: string; // 备注
}

interface RepoDiffRepoSnapshotsResponseData {
  addsLeft: Array<RepoDiffRepoSnapshotsResponseDataAddsLeftItem>; // 右侧快照相对于左侧快照新增的文档列表。
  updatesLeft: Array<RepoDiffRepoSnapshotsResponseDataUpdatesLeftItem>; // 在左侧快照中存在，并在右侧快照中被修改的文档列表。
  updatesRight: Array<RepoDiffRepoSnapshotsResponseDataUpdatesRightItem>; // 在右侧快照中存在，并在左侧快照中被修改的文档列表 (通常为空或与updatesLeft对称，具体含义需结合上下文)。
  removesRight: Array<RepoDiffRepoSnapshotsResponseDataRemovesRightItem>; // 左侧快照中存在，但在右侧快照中被删除的文档列表。
  left: RepoDiffRepoSnapshotsResponseDataLeft; // 左侧快照的元信息。
  right: RepoDiffRepoSnapshotsResponseDataRight; // 右侧快照的元信息。
}

interface RepoDiffRepoSnapshotsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RepoDiffRepoSnapshotsResponseData; // 包含两个快照差异详情的对象。
}

interface RepoDownloadCloudSnapshotParams {
  id: string; // 必需。要下载的云端快照的 ID。
  tag?: string;
}

interface RepoDownloadCloudSnapshotResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoGetCloudRepoSnapshotsParams {
  page: number; // 必需。页码，从 1 开始。
}

interface RepoGetCloudRepoSnapshotsResponseDataSnapshotsItem {
  id: string; // 快照的唯一标识符 (ID)
  created: string; // 快照创建时间 (Unix 时间戳字符串，秒级)
  hCreated: string; // 快照创建时间 (格式化字符串)
  size: number; // 快照大小 (字节)
  hSize: string; // 快照大小 (格式化字符串)
  memo: string; // 快照备注信息
}

interface RepoGetCloudRepoSnapshotsResponseData {
  snapshots: Array<RepoGetCloudRepoSnapshotsResponseDataSnapshotsItem>; // 云端快照对象数组。
  pageCount: number; // 总页数。
  totalCount: number; // 快照总数量。
}

interface RepoGetCloudRepoSnapshotsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RepoGetCloudRepoSnapshotsResponseData; // 包含云端快照列表、总页数和总数量的对象。
}

interface RepoGetCloudRepoTagSnapshotsParams {
  page: number; // 必需。页码，从 1 开始。
}

interface RepoGetCloudRepoTagSnapshotsResponseDataSnapshotsItem {
  id: string; // 快照的唯一标识符 (ID)
  tag: string; // 快照标签名。
  created: string; // 快照创建时间 (Unix 时间戳字符串，秒级)
  hCreated: string; // 快照创建时间 (格式化字符串)
  size: number; // 快照大小 (字节)
  hSize: string; // 快照大小 (格式化字符串)
  memo: string; // 快照备注信息
}

interface RepoGetCloudRepoTagSnapshotsResponseData {
  snapshots: Array<RepoGetCloudRepoTagSnapshotsResponseDataSnapshotsItem>; // 云端标签快照对象数组。
  pageCount: number; // 总页数。
  totalCount: number; // 标签快照总数量。
}

interface RepoGetCloudRepoTagSnapshotsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RepoGetCloudRepoTagSnapshotsResponseData; // 包含云端标签快照列表、总页数和总数量的对象。
}

interface RepoGetRepoFileParams {
  id: string; // 必需。快照的 ID。
  path?: string;
}

interface RepoGetRepoSnapshotsParams {
  page: number; // 必需。页码，从 1 开始。
}

interface RepoGetRepoSnapshotsResponseDataSnapshotsItem {
  id: string; // 快照的唯一标识符 (ID)
  created: string; // 快照创建时间 (Unix 时间戳字符串，秒级)
  hCreated: string; // 快照创建时间 (格式化字符串)
  size: number; // 快照大小 (字节)
  hSize: string; // 快照大小 (格式化字符串)
  memo: string; // 快照备注信息
}

interface RepoGetRepoSnapshotsResponseData {
  snapshots: Array<RepoGetRepoSnapshotsResponseDataSnapshotsItem>; // 本地快照对象数组。
  pageCount: number; // 总页数。
  totalCount: number; // 快照总数量。
}

interface RepoGetRepoSnapshotsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RepoGetRepoSnapshotsResponseData; // 包含本地快照列表、总页数和总数量的对象。
}

interface RepoGetRepoTagSnapshotsParams {
  page: number; // 必需。页码，从 1 开始。
}

interface RepoGetRepoTagSnapshotsResponseDataSnapshotsItem {
  id: string; // 快照的唯一标识符 (ID)
  tag: string; // 快照标签名。
  created: string; // 快照创建时间 (Unix 时间戳字符串，秒级)
  hCreated: string; // 快照创建时间 (格式化字符串)
  size: number; // 快照大小 (字节)
  hSize: string; // 快照大小 (格式化字符串)
  memo: string; // 快照备注信息
}

interface RepoGetRepoTagSnapshotsResponseData {
  snapshots: Array<RepoGetRepoTagSnapshotsResponseDataSnapshotsItem>; // 本地标签快照对象数组。
  pageCount: number; // 总页数。
  totalCount: number; // 标签快照总数量。
}

interface RepoGetRepoTagSnapshotsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RepoGetRepoTagSnapshotsResponseData; // 包含本地标签快照列表、总页数和总数量的对象。
}

interface RepoImportRepoKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoInitRepoKeyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoInitRepoKeyFromPassphraseParams {
  passphrase: string; // 必需。用于生成密钥的用户口令。
}

interface RepoInitRepoKeyFromPassphraseResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoOpenRepoSnapshotDocParams {
  id: string; // 必需。快照中文档的唯一标识符 (通常是 `快照ID/文档ID.sy`)。
}

interface RepoOpenRepoSnapshotDocResponseData {
  title: string; // 文档的标题。
  content: string; // 文档的内容 (HTML格式)。
  displayInText: boolean; // 是否应在纯文本模式下显示 (通常为 false)。
  updated: string; // 文档的最后更新时间 (Unix 时间戳字符串，秒级)。
}

interface RepoOpenRepoSnapshotDocResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RepoOpenRepoSnapshotDocResponseData | null;
}

interface RepoPurgeCloudRepoResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoPurgeRepoResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoRemoveCloudRepoTagSnapshotParams {
  id: string; // 必需。要移除的云端标签快照的 ID。
  tag: string; // 必需。要移除的云端标签快照的标签名。
}

interface RepoRemoveCloudRepoTagSnapshotResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoRemoveRepoTagSnapshotParams {
  id: string; // 必需。要移除的本地标签快照的 ID。
  tag: string; // 必需。要移除的本地标签快照的标签名。
}

interface RepoRemoveRepoTagSnapshotResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoResetRepoResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoSetRepoIndexRetentionDaysParams {
  days: number; // 必需。快照索引保留的天数，必须为正整数。
}

interface RepoSetRepoIndexRetentionDaysResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoSetRetentionIndexesDailyParams {
  indexes: number; // 必需。每日快照的保留数量，必须为正整数。
}

interface RepoSetRetentionIndexesDailyResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoTagSnapshotParams {
  id: string; // 必需。要标记的快照的 ID。
  tag: string; // 必需。要打上的标签名。
  memo?: string;
}

interface RepoTagSnapshotResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RepoUploadCloudSnapshotParams {
  id: string; // 必需。要上传的本地快照的 ID。
  tag?: string;
}

interface RepoUploadCloudSnapshotResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RiffAddRiffCardsParams {
  deckID: string; // 必需。目标闪卡包的 ID。
  blockIDs: Array<string>; // 必需。要添加为闪卡的块 ID 数组。
}

interface RiffAddRiffCardsResponseData {
  id: string; // 闪卡包 ID
  name: string; // 闪卡包名称
  size: number; // 闪卡包中的卡片数量
  created: string; // 闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss
  updated: string; // 闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss
}

interface RiffAddRiffCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffAddRiffCardsResponseData | null;
}

interface RiffBatchSetRiffCardsDueTimeParamsCardDuesItem {
  id: string; // 必需。闪卡块 ID。
  due: string; // 必需。新的到期时间，ISO 8601 格式的日期时间字符串。
}

interface RiffBatchSetRiffCardsDueTimeParams {
  cardDues: Array<RiffBatchSetRiffCardsDueTimeParamsCardDuesItem>; // 必需。包含闪卡 ID 和对应新到期时间的数组。
}

interface RiffBatchSetRiffCardsDueTimeResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RiffCreateRiffDeckParams {
  name: string; // 必需。新闪卡包的名称。
}

interface RiffCreateRiffDeckResponseData {
  id: string; // 新创建的闪卡包 ID
  name: string; // 新创建的闪卡包名称
  size: number; // 新创建的闪卡包中的卡片数量 (初始为0)
  created: string; // 闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss
  updated: string; // 闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss
}

interface RiffCreateRiffDeckResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffCreateRiffDeckResponseData; // 成功时返回新创建的闪卡包信息。
}

interface RiffGetNotebookRiffCardsParams {
  id: string; // 必需。笔记本 ID。
  page: number; // 必需。页码，从 1 开始。
  pageSize?: number;
}

interface RiffGetNotebookRiffCardsResponseData {
  blocks: Array<string>; // 当前页的闪卡块 ID 数组。
  total: number; // 该笔记本下闪卡总数。
  pageCount: number; // 总页数。
}

interface RiffGetNotebookRiffCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffGetNotebookRiffCardsResponseData; // 成功时返回分页的闪卡块 ID 及分页信息。
}

interface RiffGetNotebookRiffDueCardsParamsReviewedCardsItem {
  cardID: string; // 已复习卡片的 ID
}

interface RiffGetNotebookRiffDueCardsParams {
  notebook: string; // 必需。笔记本 ID。
  reviewedCards?: Array<RiffGetNotebookRiffDueCardsParamsReviewedCardsItem>;
}

interface RiffGetNotebookRiffDueCardsResponseDataCardsItem {
  id: string; // 闪卡块 ID
  deckID: string; // 所属闪卡包 ID
  blockID: string; // 原始块 ID
  created: string; // 创建时间戳 (毫秒)
  due: string; // 到期时间戳 (毫秒)
  interval: number; // 复习间隔 (天)
  easeFactor: number; // 易度因子
  reps: number; // 已复习次数
}

interface RiffGetNotebookRiffDueCardsResponseData {
  cards: Array<RiffGetNotebookRiffDueCardsResponseDataCardsItem>; // 到期闪卡列表。
  unreviewedCount: number; // 未复习卡片总数。
  unreviewedNewCardCount: number; // 未复习新卡片数量。
  unreviewedOldCardCount: number; // 未复习旧卡片数量。
}

interface RiffGetNotebookRiffDueCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffGetNotebookRiffDueCardsResponseData; // 成功时返回到期闪卡列表及统计信息。
}

interface RiffGetRiffCardsParams {
  id: string; // 必需。闪卡包 ID。
  page: number; // 必需。页码，从 1 开始。
  pageSize?: number;
}

interface RiffGetRiffCardsResponseDataBlocksItem {
  id: string; // 闪卡块 ID
  deckID: string; // 所属闪卡包 ID
  blockID: string; // 原始块 ID
  created: string; // 创建时间戳 (毫秒)
  due: string; // 到期时间戳 (毫秒)
  interval: number; // 复习间隔 (天)
  easeFactor: number; // 易度因子
  reps: number; // 已复习次数
}

interface RiffGetRiffCardsResponseData {
  blocks: Array<RiffGetRiffCardsResponseDataBlocksItem>; // 当前页的闪卡对象数组。
  total: number; // 该闪卡包下闪卡总数。
  pageCount: number; // 总页数。
}

interface RiffGetRiffCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffGetRiffCardsResponseData; // 成功时返回分页的闪卡对象及分页信息。
}

interface RiffGetRiffCardsByBlockIDsParams {
  blockIDs: Array<string>; // 必需。块 ID 数组。
}

interface RiffGetRiffCardsByBlockIDsResponseDataBlocksItem {
  id: string; // 闪卡块 ID
  deckID: string; // 所属闪卡包 ID
  blockID: string; // 原始块 ID
  created: string; // 创建时间戳 (毫秒)
  due: string; // 到期时间戳 (毫秒)
  interval: number; // 复习间隔 (天)
  easeFactor: number; // 易度因子
  reps: number; // 已复习次数
}

interface RiffGetRiffCardsByBlockIDsResponseData {
  blocks: Array<RiffGetRiffCardsByBlockIDsResponseDataBlocksItem>; // 对应的闪卡信息数组。如果某个 blockID 不是闪卡，则对应项可能缺失或为 null。
}

interface RiffGetRiffCardsByBlockIDsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffGetRiffCardsByBlockIDsResponseData; // 成功时返回闪卡信息。
}

interface RiffGetRiffDecksResponseDataItem {
  id: string; // 闪卡包 ID
  name: string; // 闪卡包名称
  size: number; // 闪卡包中的卡片数量
  created: string; // 闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss
  updated: string; // 闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss
}

interface RiffGetRiffDecksResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: Array<RiffGetRiffDecksResponseDataItem>; // 成功时返回所有闪卡包的信息数组。如果没有闪卡包，则返回空数组。
}

interface RiffGetRiffDueCardsParamsReviewedCardsItem {
  cardID: string; // 已复习卡片的 ID
}

interface RiffGetRiffDueCardsParams {
  deckID: string; // 必需。闪卡包 ID。
  reviewedCards?: Array<RiffGetRiffDueCardsParamsReviewedCardsItem>;
}

interface RiffGetRiffDueCardsResponseDataCardsItem {
  id: string; // 闪卡块 ID
  deckID: string; // 所属闪卡包 ID
  blockID: string; // 原始块 ID
  created: string; // 创建时间戳 (毫秒)
  due: string; // 到期时间戳 (毫秒)
  interval: number; // 复习间隔 (天)
  easeFactor: number; // 易度因子
  reps: number; // 已复习次数
}

interface RiffGetRiffDueCardsResponseData {
  cards: Array<RiffGetRiffDueCardsResponseDataCardsItem>; // 到期闪卡列表。
  unreviewedCount: number; // 未复习卡片总数。
  unreviewedNewCardCount: number; // 未复习新卡片数量。
  unreviewedOldCardCount: number; // 未复习旧卡片数量。
}

interface RiffGetRiffDueCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffGetRiffDueCardsResponseData; // 成功时返回到期闪卡列表及统计信息。
}

interface RiffGetTreeRiffCardsParams {
  id: string; // 必需。文档树的根块 ID。
  page: number; // 必需。页码，从 1 开始。
  pageSize?: number;
}

interface RiffGetTreeRiffCardsResponseData {
  blocks: Array<string>; // 当前页的闪卡块 ID 数组。
  total: number; // 该文档树下闪卡总数。
  pageCount: number; // 总页数。
}

interface RiffGetTreeRiffCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffGetTreeRiffCardsResponseData; // 成功时返回分页的闪卡块 ID 及分页信息。
}

interface RiffGetTreeRiffDueCardsParamsReviewedCardsItem {
  cardID: string; // 已复习卡片的 ID
}

interface RiffGetTreeRiffDueCardsParams {
  rootID: string; // 必需。文档树的根块 ID。
  reviewedCards?: Array<RiffGetTreeRiffDueCardsParamsReviewedCardsItem>;
}

interface RiffGetTreeRiffDueCardsResponseDataCardsItem {
  id: string; // 闪卡块 ID
  deckID: string; // 所属闪卡包 ID
  blockID: string; // 原始块 ID
  created: string; // 创建时间戳 (毫秒)
  due: string; // 到期时间戳 (毫秒)
  interval: number; // 复习间隔 (天)
  easeFactor: number; // 易度因子
  reps: number; // 已复习次数
}

interface RiffGetTreeRiffDueCardsResponseData {
  cards: Array<RiffGetTreeRiffDueCardsResponseDataCardsItem>; // 到期闪卡列表。
  unreviewedCount: number; // 未复习卡片总数。
  unreviewedNewCardCount: number; // 未复习新卡片数量。
  unreviewedOldCardCount: number; // 未复习旧卡片数量。
}

interface RiffGetTreeRiffDueCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffGetTreeRiffDueCardsResponseData; // 成功时返回到期闪卡列表及统计信息。
}

interface RiffRemoveRiffCardsParams {
  deckID: string; // 必需。目标闪卡包的 ID。如果为空字符串，则表示从所有卡包中移除这些卡片（通常用于"All"卡包的操作场景，但后端实际是根据 blockID 移除）。
  blockIDs: Array<string>; // 必需。要移除的闪卡块 ID 数组。
}

interface RiffRemoveRiffCardsResponseData {
  id: string; // 闪卡包 ID
  name: string; // 闪卡包名称
  size: number; // 闪卡包中的卡片数量
  created: string; // 闪卡包创建时间，格式 YYYY-MM-DD HH:mm:ss
  updated: string; // 闪卡包更新时间，格式 YYYY-MM-DD HH:mm:ss
}

interface RiffRemoveRiffCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: RiffRemoveRiffCardsResponseData | null;
}

interface RiffRemoveRiffDeckParams {
  deckID: string; // 必需。要移除的闪卡包 ID。
}

interface RiffRemoveRiffDeckResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RiffRenameRiffDeckParams {
  deckID: string; // 必需。要重命名的闪卡包 ID。
  name: string; // 必需。新的闪卡包名称。
}

interface RiffRenameRiffDeckResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RiffResetRiffCardsParams {
  type: 'notebook' | 'tree' | 'deck'; // 必需。重置类型：'notebook' (笔记本), 'tree' (文档树), 'deck' (闪卡包)。
  id: string; // 必需。对应类型的 ID：笔记本 ID、文档树根块 ID 或闪卡包 ID。
  deckID: string; // 必需。闪卡包 ID。即使 type 是 'notebook' 或 'tree'，也需要指定一个 deckID 来确定操作范围，通常可以是这些卡片实际所属的卡包 ID，或者是全局的卡片操作。具体逻辑需参照后端 model.ResetFlashcards 实现。从 riff.go L89 看，此参数未被直接使用，但model层可能需要。暂时保留。
  blockIDs?: Array<string>;
}

interface RiffResetRiffCardsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RiffReviewRiffCardParamsReviewedCardsItem {
  cardID: string; // 已复习卡片的 ID
}

interface RiffReviewRiffCardParams {
  deckID: string; // 必需。闪卡所属的卡包 ID。
  cardID: string; // 必需。要复习的闪卡块 ID。
  rating: number; // 必需。评分，通常为 0 (Again), 1 (Hard), 2 (Good), 3 (Easy), 4 (Soon)。具体数值对应关系可能依赖于底层的 SM-2 算法实现。参照 riff.Rating 定义，0:Again, 1:Hard, 2:Good, 3:Easy, 4:Soon, (SM2 的0-5 对应这里的0-4?)
  reviewedCards?: Array<RiffReviewRiffCardParamsReviewedCardsItem>;
}

interface RiffReviewRiffCardResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface RiffSkipReviewRiffCardParams {
  deckID: string; // 必需。闪卡所属的卡包 ID。
  cardID: string; // 必需。要跳过复习的闪卡块 ID。
}

interface RiffSkipReviewRiffCardResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功时 Data 固定为 null。
}

interface SearchFindReplaceParams {
  k: string; // 必需。要查找的关键词。
  r: string; // 必需。要替换的字符串。
  ids: Array<string>; // 必需。要进行查找替换操作的块 ID 数组。
  paths?: Array<string>;
  boxes?: Array<string>;
  types?: Record<string, boolean>;
  method?: number;
  orderBy?: number;
  groupBy?: number;
  replaceTypes?: Record<string, boolean>;
}

interface SearchFindReplaceResponseData {
  closeTimeout?: number;
}

interface SearchFindReplaceResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchFindReplaceResponseData | null;
}

interface SearchFullTextSearchAssetContentParams {
  query: string; // 必需。搜索查询语句。
  page?: number;
  pageSize?: number;
  types?: Record<string, boolean>;
  method?: number;
  orderBy?: number;
}

interface SearchFullTextSearchAssetContentResponseDataAssetContentsItem {
  id: string; // 资源文件块 ID。
  box: string; // 笔记本 ID。
  docID: string; // 所属文档 ID。
  path: string; // 资源文件路径。
  name: string; // 资源文件名称。
  title: string; // 文档标题。
  updated: string; // 更新时间（YYYYMMDDHHmmss）。
  content: string; // 匹配到的内容片段。
  count: number; // 匹配数量。
}

interface SearchFullTextSearchAssetContentResponseData {
  assetContents: Array<SearchFullTextSearchAssetContentResponseDataAssetContentsItem>; // 当前页的搜索结果列表。
  matchedAssetCount: number; // 匹配到的资源文件总数。
  pageCount: number; // 总页数。
}

interface SearchFullTextSearchAssetContentResponse {
  Code: number; // 返回码，0 表示成功。如果未付费，Code 为 1。
  Msg: string; // 错误信息，成功时为空字符串。
  Data: SearchFullTextSearchAssetContentResponseData | null;
}

interface SearchFullTextSearchBlockParams {
  query: string; // 必需。搜索查询语句。
  page?: number;
  pageSize?: number;
  paths?: Array<string>;
  boxes?: Array<string>;
  types?: Record<string, boolean>;
  method?: number;
  orderBy?: number;
  groupBy?: number;
}

interface SearchFullTextSearchBlockResponseData {
  blocks: Array<any>; // 当前页的搜索结果块列表。每个块的结构根据其类型而定，通常包含 id, type, content, path, box, docID 等字段。
  matchedBlockCount: number; // 匹配到的块总数。
  matchedRootCount: number; // 匹配到的根块（文档）总数。
  pageCount: number; // 总页数。
  docMode: boolean; // 是否为文档模式搜索结果（groupBy=1 时为 true）。
}

interface SearchFullTextSearchBlockResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchFullTextSearchBlockResponseData | null;
}

interface SearchGetAssetContentParams {
  id: string; // 必需。资源文件块的 ID。
  query: string; // 必需。查询关键词。
  queryMethod: number; // 必需。查询方法：0：关键字，1：查询语法，2：SQL，3：正则表达式。
}

interface SearchGetAssetContentResponseData {
  assetContent: string; // 匹配到的资源文件内容片段。
}

interface SearchGetAssetContentResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchGetAssetContentResponseData | null;
}

interface SearchGetEmbedBlockParams {
  embedBlockID: string; // 必需。嵌入块（通常是 `((块ID))` 引用的块）的 ID。
  includeIDs: Array<string>; // 必需。要实际嵌入显示的块 ID 数组（通常只包含 embedBlockID，但在特殊情况下可能包含其子块）。
  headingMode?: number;
  breadcrumb?: boolean;
}

interface SearchGetEmbedBlockResponseData {
  blocks: Array<any>; // 渲染后的嵌入块内容数组。每个元素的具体结构取决于块类型。
}

interface SearchGetEmbedBlockResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchGetEmbedBlockResponseData | null;
}

interface SearchListInvalidBlockRefsParams {
  page?: number;
  pageSize?: number;
}

interface SearchListInvalidBlockRefsResponseDataBlocksItem {
  id: string; // 包含无效引用的块的 ID。
  box: string; // 笔记本 ID。
  path: string; // 文档路径。
  hPath: string; // 文档层级路径。
  content: string; // 块内容预览。
  updated: string; // 块更新时间（YYYYMMDDHHmmss）。
}

interface SearchListInvalidBlockRefsResponseData {
  blocks: Array<SearchListInvalidBlockRefsResponseDataBlocksItem>; // 当前页的无效引用块列表。
  matchedBlockCount: number; // 匹配到的无效引用块总数。
  matchedRootCount: number; // 匹配到的包含无效引用的文档总数。
  pageCount: number; // 总页数。
}

interface SearchListInvalidBlockRefsResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchListInvalidBlockRefsResponseData | null;
}

interface SearchRemoveTemplateParams {
  path: string; // 必需。要移除的模板文件的相对路径（相对于模板文件夹）。
}

interface SearchRemoveTemplateResponse {
  Code: number; // 返回码，0 表示成功，-1 表示失败
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功或失败时 Data 均为 null。
}

interface SearchSearchAssetParams {
  k: string; // 必需。搜索关键词。
  exts?: Array<string>;
}

interface SearchSearchAssetResponseDataItem {
  id: string; // 资源文件块 ID。
  box: string; // 笔记本 ID。
  docID: string; // 所属文档 ID。
  path: string; // 资源文件路径。
  name: string; // 资源文件名称。
  title: string; // 文档标题。
  hPath: string; // 文档层级路径。
  updated: string; // 更新时间（YYYYMMDDHHmmss）。
}

interface SearchSearchAssetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: Array<SearchSearchAssetResponseDataItem>; // 匹配到的资源文件列表。如果没有结果，则为空数组。
}

interface SearchSearchEmbedBlockParams {
  embedBlockID: string; // 必需。作为搜索范围根的嵌入块 ID。
  stmt: string; // 必需。用于搜索的 SQL 语句。查询的表名通常为 'blocks'，可查询的字段如 id, content, markdown, type 等。
  excludeIDs?: Array<string>;
  headingMode?: number;
  breadcrumb?: boolean;
}

interface SearchSearchEmbedBlockResponseData {
  blocks: Array<any>; // 满足 SQL 查询条件的块内容数组。每个元素的具体结构取决于块类型和查询语句。
}

interface SearchSearchEmbedBlockResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchSearchEmbedBlockResponseData | null;
}

interface SearchSearchRefBlockParams {
  id: string; // 必需。当前正在编辑的块的 ID。
  rootID: string; // 必需。当前文档的根块 ID。
  k: string; // 必需。用户输入的搜索关键词。
  beforeLen?: number;
  isSquareBrackets?: boolean;
  isDatabase?: boolean;
  reqId?: any;
}

interface SearchSearchRefBlockResponseDataBlocksItem {
  id: string; // 建议引用的块 ID。
  type: string; // 块类型。
  content: string; // 块内容预览或标题。
  [key: string]: any; // From .catchall()
}

interface SearchSearchRefBlockResponseData {
  blocks: Array<SearchSearchRefBlockResponseDataBlocksItem>; // 引用建议块列表。
  newDoc: boolean; // 是否建议创建一个新文档（当搜索关键词在 `isSquareBrackets` 为 true 时可能触发）。
  k: string; // 原始搜索关键词 (HTML转义后)。
  reqId?: any;
}

interface SearchSearchRefBlockResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchSearchRefBlockResponseData | null;
}

interface SearchSearchTagParams {
  k: string; // 必需。搜索关键词。
}

interface SearchSearchTagResponseData {
  tags: Array<string>; // 匹配到的标签列表。如果无结果则为空数组。
  k: string; // 原始搜索关键词。
}

interface SearchSearchTagResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchSearchTagResponseData | null;
}

interface SearchSearchTemplateParams {
  k: string; // 必需。搜索关键词。
}

interface SearchSearchTemplateResponseDataBlocksItem {
  content: string; // 模板内容片段或文件名。
  path: string; // 模板文件的相对路径。
  docpath?: string;
  [key: string]: any; // From .catchall()
}

interface SearchSearchTemplateResponseData {
  blocks: Array<SearchSearchTemplateResponseDataBlocksItem>; // 匹配到的模板列表。
  k: string; // 原始搜索关键词。
}

interface SearchSearchTemplateResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchSearchTemplateResponseData | null;
}

interface SearchSearchWidgetParams {
  k: string; // 必需。搜索关键词。
}

interface SearchSearchWidgetResponseDataBlocksItem {
  id: string; // 挂件块 ID。
  markdown: string; // 挂件块的 Markdown 内容。
  name: string; // 挂件块的名称 (ial中的name属性)。
  [key: string]: any; // From .catchall()
}

interface SearchSearchWidgetResponseData {
  blocks: Array<SearchSearchWidgetResponseDataBlocksItem>; // 匹配到的挂件块列表。
  k: string; // 原始搜索关键词。
}

interface SearchSearchWidgetResponse {
  Code: number; // 返回码，0 表示成功
  Msg: string; // 错误信息，成功时为空字符串
  Data: SearchSearchWidgetResponseData | null;
}

interface SearchUpdateEmbedBlockParams {
  id: string; // 必需。要更新的查询嵌入块的 ID。
  content: string; // 必需。查询嵌入块新的原始 Markdown 内容，通常是 SQL 查询语句或 JavaScript 脚本。
}

interface SearchUpdateEmbedBlockResponse {
  Code: number; // 返回码，0 表示成功，-1 表示失败
  Msg: string; // 错误信息，成功时为空字符串
  Data: null; // 成功或失败时 Data 均为 null。
}

interface SettingAddVirtualBlockRefExcludeParams {
  keywords: Array<string>; // 要添加到排除列表的关键字数组。
}

interface SettingAddVirtualBlockRefExcludeResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据。
}

interface SettingAddVirtualBlockRefIncludeParams {
  keywords: Array<string>; // 要添加到包含列表的关键字数组。
}

interface SettingAddVirtualBlockRefIncludeResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据。
}

interface SettingGetCloudUserParams {
  token?: string;
}

interface SettingGetCloudUserResponseDataUserTitlesItem {
  name: string; // 称号名称。
  icon: string; // 称号图标URL。
  url: string; // 称号链接URL。
}

interface SettingGetCloudUserResponseData {
  userId: string; // 用户ID。
  userName: string; // 用户名。
  userAvatarURL: string; // 用户头像URL。
  userHomeBImgURL: string; // 用户主页背景图URL。
  userTitles: Array<SettingGetCloudUserResponseDataUserTitlesItem>; // 用户获得的称号列表。
  userIntro: string; // 用户简介。
  userNickname: string; // 用户昵称。
  userCreateTime: string; // 用户账户创建时间。
  userSiYuanProExpireTime: number; // 思源笔记专业版到期时间戳 (毫秒)。
  userToken: string; // 用户访问令牌。
  userTokenExpireTime: string; // 用户访问令牌到期时间。
  userSiYuanRepoSize: number; // 思源笔记云端仓库已用空间大小 (字节)。
  userSiYuanPointExchangeRepoSize: number; // 通过积分兑换的云端仓库空间大小 (字节)。
  userSiYuanAssetSize: number; // 思源笔记云端资源文件已用空间大小 (字节)。
  userTrafficUpload: number; // 当月已用上传流量 (字节)。
  userTrafficDownload: number; // 当月已用下载流量 (字节)。
  userSiYuanProExpireDays: number; // 思源笔记专业版剩余天数。
  userSiYuanAIMaxFreeRequestCount: number; // AI功能免费版最大请求次数。
  userSiYuanAIMaxProRequestCount: number; // AI功能专业版最大请求次数。
  userSiYuanAIProRequestCount: number; // AI功能专业版当前已用请求次数。
  userSiYuanAISubscriptionPlan: number; // AI功能订阅计划类型。
  userSiYuanPro: boolean; // 是否为思源笔记专业版用户。
  userSiYuanLifetimePro: boolean; // 是否为思源笔记终身专业版用户。
  userSiYuanTeam: boolean; // 是否为思源笔记团队版用户。
}

interface SettingGetCloudUserResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingGetCloudUserResponseData | null;
}

interface SettingGetPublishResponseDataPublishAuthAccountsItem {
  username: string; // Basic 认证用户名。
  password: string; // Basic 认证密码。
  memo?: string;
}

interface SettingGetPublishResponseDataPublishAuth {
  enable: boolean; // 是否启用 Basic 认证。
  accounts: Array<SettingGetPublishResponseDataPublishAuthAccountsItem>; // Basic 认证账户列表。
}

interface SettingGetPublishResponseDataPublish {
  enable: boolean; // 是否启用发布服务。
  port: number; // 发布服务配置的端口号。
  auth: SettingGetPublishResponseDataPublishAuth; // Basic 认证配置。
}

interface SettingGetPublishResponseData {
  port: number; // 发布服务当前监听的端口号。
  publish: SettingGetPublishResponseDataPublish; // 详细的发布配置项。
}

interface SettingGetPublishResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingGetPublishResponseData | null;
}

interface SettingLogin2faCloudUserParams {
  token: string; // 登录过程中的临时令牌。
  code: string; // 6位数字的两步验证码。
}

interface SettingLogin2faCloudUserResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: Record<string, any> | null;
}

interface SettingLogoutCloudUserResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据。
}

interface SettingRefreshVirtualBlockRefResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据。
}

interface SettingSetAIParamsOpenAI {
  apiKey?: string;
  apiTimeout?: number;
  apiProxy?: string;
  apiModel?: string;
  apiMaxTokens?: number;
  apiTemperature?: number;
  apiMaxContexts?: number;
  apiBaseURL?: string;
  apiUserAgent?: string;
  apiProvider?: string;
  apiVersion?: string;
}

interface SettingSetAIParams {
  openAI: SettingSetAIParamsOpenAI; // OpenAI 相关配置。
}

interface SettingSetAIResponseDataOpenAI {
  apiKey?: string;
  apiTimeout?: number;
  apiProxy?: string;
  apiModel?: string;
  apiMaxTokens?: number;
  apiTemperature?: number;
  apiMaxContexts?: number;
  apiBaseURL?: string;
  apiUserAgent?: string;
  apiProvider?: string;
  apiVersion?: string;
}

interface SettingSetAIResponseData {
  openAI: SettingSetAIResponseDataOpenAI; // OpenAI 相关配置。
}

interface SettingSetAIResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingSetAIResponseData | null;
}

interface SettingSetAccountParams {
  displayTitle?: boolean;
  displayVIP?: boolean;
}

interface SettingSetAccountResponseData {
  displayTitle: boolean; // 是否在用户头像旁显示称号。
  displayVIP: boolean; // 是否在用户头像旁显示Pro标识。
}

interface SettingSetAccountResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingSetAccountResponseData | null;
}

interface SettingSetAppearanceParams {
  mode?: number;
  themeDark?: string;
  themeLight?: string;
  darkThemes?: Array<string>;
  lightThemes?: Array<string>;
  icons?: Array<string>;
  lang?: string;
  codeFontFamily?: string;
  fontSize?: number;
  fontFamily?: string;
  hideStatusBar?: boolean;
  customCSS?: string;
}

interface SettingSetAppearanceResponseData {
  mode?: number;
  themeDark?: string;
  themeLight?: string;
  darkThemes?: Array<string>;
  lightThemes?: Array<string>;
  icons?: Array<string>;
  lang?: string;
  fontSize?: number;
  fontFamily?: string;
  codeFontFamily?: string;
  hideStatusBar?: boolean;
  customCSS?: string;
}

interface SettingSetAppearanceResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingSetAppearanceResponseData | null;
}

interface SettingSetBazaarParams {
  trust?: boolean;
  petalDisabled?: boolean;
}

interface SettingSetBazaarResponseData {
  trust?: boolean;
  petalDisabled?: boolean;
}

interface SettingSetBazaarResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingSetBazaarResponseData | null;
}

interface SettingSetEditorParams {
  allowHTMLBLockScript?: boolean;
  fontSize?: number;
  fontSizeScrollZoom?: boolean;
  fontFamily?: string;
  codeSyntaxHighlightLineNum?: boolean;
  codeTabSpaces?: number;
  codeLineWrap?: boolean;
  codeLigatures?: boolean;
  displayBookmarkIcon?: boolean;
  displayNetImgMark?: boolean;
  generateHistoryInterval?: number;
  historyRetentionDays?: number;
  emoji?: Array<string>;
  virtualBlockRef?: boolean;
  virtualBlockRefExclude?: string;
  virtualBlockRefInclude?: string;
  blockRefDynamicAnchorTextMaxLen?: number;
  plantUMLServePath?: string;
  fullWidth?: boolean;
  katexMacros?: string;
  readOnly?: boolean;
  embedBlockBreadcrumb?: boolean;
  listLogicalOutdent?: boolean;
  listItemDotNumberClickFocus?: boolean;
  floatWindowMode?: number;
  dynamicLoadBlocks?: number;
  justify?: boolean;
  rtl?: boolean;
  spellcheck?: boolean;
  onlySearchForDoc?: boolean;
  backlinkExpandCount?: number;
  backmentionExpandCount?: number;
  backlinkContainChildren?: boolean;
  markdown?: any;
}

interface SettingSetEditorResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: any | null;
}

interface SettingSetEditorReadOnlyParams {
  readonly: boolean; // 是否将编辑器设置为只读模式。
}

interface SettingSetEditorReadOnlyResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据。
}

interface SettingSetEmojiParams {
  emoji: Array<string>; // 新的常用表情符号列表。
}

interface SettingSetEmojiResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据，直接修改配置。
}

interface SettingSetExportParams {
  paragraphBeginningSpace?: boolean;
  addTitle?: boolean;
  blockRefMode?: number;
  blockEmbedMode?: number;
  blockRefTextLeft?: string;
  blockRefTextRight?: string;
  tagOpenMarker?: string;
  tagCloseMarker?: string;
  fileAnnotationRefMode?: number;
  pandocBin?: string;
  markdownYFM?: boolean;
  inlineMemo?: boolean;
  pdfFooter?: string;
  docxTemplate?: string;
  pdfWatermarkStr?: string;
  pdfWatermarkDesc?: string;
  imageWatermarkStr?: string;
  imageWatermarkDesc?: string;
}

interface SettingSetExportResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: any | null;
}

interface SettingSetFiletreeParams {
  alwaysSelectOpenedFile?: boolean;
  openFilesUseCurrentTab?: boolean;
  refCreateSaveBox?: string;
  refCreateSavePath?: string;
  docCreateSaveBox?: string;
  docCreateSavePath?: string;
  maxListCount?: number;
  maxOpenTabCount?: number;
  allowCreateDeeper?: boolean;
  removeDocWithoutConfirm?: boolean;
  closeTabsOnStart?: boolean;
  useSingleLineSave?: boolean;
  sort?: number;
}

interface SettingSetFiletreeResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: any | null;
}

interface SettingSetFlashcardParams {
  newCardLimit?: number;
  reviewCardLimit?: number;
  requestRetention?: number;
  maximumInterval?: number;
  easyBonus?: number;
  hardInterval?: number;
  lapseInterval?: number;
  againInterval?: number;
}

interface SettingSetFlashcardResponseData {
  newCardLimit: number; // 每日新建卡片上限。
  reviewCardLimit: number; // 每日复习卡片上限。
  requestRetention: number; // 期望记忆留存率。
  maximumInterval: number; // 最大复习间隔天数。
  easyBonus: number; // 简单奖励系数。
  hardInterval: number; // 困难间隔系数。
  lapseInterval: number; // 失误间隔系数。
  againInterval: number; // 重来间隔系数。
}

interface SettingSetFlashcardResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingSetFlashcardResponseData | null;
}

interface SettingSetKeymapParamsData {
  editor?: Record<string, string>;
  protyleIR?: Record<string, string>;
  protyleSV?: Record<string, string>;
  protyleWYSIWYG?: Record<string, string>;
  fileTree?: Record<string, string>;
  notebook?: Record<string, string>;
  global?: Record<string, string>;
}

interface SettingSetKeymapParams {
  data: SettingSetKeymapParamsData; // 包含各类快捷键映射的对象。
}

interface SettingSetKeymapResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据，直接修改配置。
}

interface SettingSetPublishParamsAuthAccountsItem {
  username: string; // Basic 认证用户名。
  password: string; // Basic 认证密码。
  memo?: string;
}

interface SettingSetPublishParamsAuth {
  enable: boolean; // 是否启用 Basic 认证。
  accounts: Array<SettingSetPublishParamsAuthAccountsItem>; // Basic 认证账户列表。
}

interface SettingSetPublishParams {
  enable: boolean; // 是否启用发布服务。
  port: number; // 发布服务监听的端口号。
  auth: SettingSetPublishParamsAuth; // Basic 认证配置。
}

interface SettingSetPublishResponseDataPublishAuthAccountsItem {
  username: string; // 用户名。
  password: string; // 密码。
  memo?: string;
}

interface SettingSetPublishResponseDataPublishAuth {
  enable: boolean; // 是否启用 Basic 认证。
  accounts: Array<SettingSetPublishResponseDataPublishAuthAccountsItem>; // 账户列表。
}

interface SettingSetPublishResponseDataPublish {
  enable: boolean; // 是否启用发布服务。
  port: number; // 发布服务配置的端口号。
  auth: SettingSetPublishResponseDataPublishAuth; // Basic 认证配置。
}

interface SettingSetPublishResponseData {
  port: number; // 发布服务实际监听的端口号 (如果成功初始化)。
  publish: SettingSetPublishResponseDataPublish; // 详细的发布配置项。
}

interface SettingSetPublishResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingSetPublishResponseData | null;
}

interface SettingSetSearchParams {
  document?: boolean;
  heading?: boolean;
  list?: boolean;
  listItem?: boolean;
  codeBlock?: boolean;
  mathBlock?: boolean;
  table?: boolean;
  blockquote?: boolean;
  superBlock?: boolean;
  paragraph?: boolean;
  htmlBlock?: boolean;
  embedBlock?: boolean;
  databaseBlock?: boolean;
  audioBlock?: boolean;
  videoBlock?: boolean;
  iframeBlock?: boolean;
  widgetBlock?: boolean;
  limit?: number;
  caseSensitive?: boolean;
  name?: boolean;
  alias?: boolean;
  memo?: boolean;
  ial?: boolean;
  indexAssetPath?: boolean;
  backlinkMentionName?: boolean;
  backlinkMentionAlias?: boolean;
  backlinkMentionAnchor?: boolean;
  backlinkMentionDoc?: boolean;
  backlinkMentionKeywordsLimit?: number;
  virtualRefName?: boolean;
  virtualRefAlias?: boolean;
  virtualRefAnchor?: boolean;
  virtualRefDoc?: boolean;
}

interface SettingSetSearchResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: any | null;
}

interface SettingSetConfSnippetParams {
  enabledCSS?: boolean;
  enabledJS?: boolean;
}

interface SettingSetConfSnippetResponseData {
  enabledCSS: boolean; // 是否启用所有自定义CSS代码片段。
  enabledJS: boolean; // 是否启用所有自定义JS代码片段。
}

interface SettingSetConfSnippetResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SettingSetConfSnippetResponseData | null;
}

interface SnippetGetSnippetParams {
  type: 'js' | 'css' | 'all'; // 要获取的代码片段类型：'js', 'css', 或 'all'。
  enabled: number; // 根据启用状态进行过滤：0-仅禁用, 1-仅启用, 2-全部。
  keyword?: string;
}

interface SnippetGetSnippetResponseDataSnippetsItem {
  id: string; // 代码片段的唯一ID。
  name: string; // 代码片段的名称。
  type: 'js' | 'css'; // 代码片段的类型：'js' 或 'css'。
  enabled: boolean; // 代码片段是否启用。
  content: string; // 代码片段的实际内容。
}

interface SnippetGetSnippetResponseData {
  snippets: Array<SnippetGetSnippetResponseDataSnippetsItem>; // 符合过滤条件的代码片段对象数组。
}

interface SnippetGetSnippetResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SnippetGetSnippetResponseData | null;
}

interface SnippetSetSnippetParamsSnippetsItem {
  id: string; // 片段的唯一ID。对于新片段或希望系统生成ID的片段，可设置为空字符串。
  name: string; // 代码片段的名称。
  type: 'js' | 'css'; // 代码片段的类型，必须是 'js' 或 'css'。
  content: string; // 代码片段的实际内容（JavaScript 或 CSS 代码）。
  enabled: boolean; // 代码片段是否启用。
}

interface SnippetSetSnippetParams {
  snippets: Array<SnippetSetSnippetParamsSnippetsItem>; // 包含一个或多个代码片段对象的数组。此数组将成为操作完成后系统中全新的、完整的代码片段列表。
}

interface SnippetSetSnippetResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: null; // 此接口成功时不返回具体数据，直接修改配置。
}

interface SnippetRemoveSnippetParams {
  id: string; // 要移除的代码片段的唯一ID。
}

interface SnippetRemoveSnippetResponseData {
  id: string; // 被移除代码片段的唯一ID。
  name: string; // 被移除代码片段的名称。
  type: 'js' | 'css'; // 被移除代码片段的类型。
  enabled: boolean; // 被移除代码片段的启用状态。
  content: string; // 被移除代码片段的内容。
}

interface SnippetRemoveSnippetResponse {
  Code: number; // API 执行结果的状态码，0 表示成功，其他表示失败。
  Msg: string; // API 执行结果的描述信息。
  Data: SnippetRemoveSnippetResponseData | null;
}

interface SqliteFlushTransactionResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface StorageGetCriteriaResponseDataItem {
  name: string; // 搜索标准的唯一名称。
  id?: string;
  box?: string;
  type?: string;
  query?: string;
  sort?: number;
  group?: number;
  types?: any;
  customSort?: Array<any>;
  filter?: number;
  docIDs?: Array<string>;
  blockIDs?: Array<string>;
  tagIDs?: Array<string>;
  attrIDs?: Array<string>;
  refs?: Array<string>;
  parentID?: string;
  rootID?: string;
  kwd?: string;
}

interface StorageGetCriteriaResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: Array<StorageGetCriteriaResponseDataItem>; // 已保存的搜索标准列表。每个元素代表一个搜索标准，具体字段请参考思源笔记内核 model.Criterion 结构。
}

interface StorageGetLocalStorageResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: Record<string, any>; // 包含 LocalStorage 所有键值对的对象。值的类型可能多样，取决于存储时的数据。
}

interface StorageGetRecentDocsResponseDataItem {
  id: string; // 文档的 ID。
  notebookID: string; // 文档所属笔记本的 ID。
  name: string; // 文档的名称。
  icon: string; // 文档的图标，如果设置了的话。
  hPath: string; // 文档的人类可读路径。
  path: string; // 文档的存储路径。
  sort: number; // 文档的排序值。
  type: string; // 文档的类型，例如 'd' 表示文档。
  subFileCount: number; // 子文件数量 (通常用于笔记本或文件夹)。
  updated: string; // 文档的最后更新时间 (ISO 8601 格式)。
}

interface StorageGetRecentDocsResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: Array<StorageGetRecentDocsResponseDataItem>; // 最近打开的文档列表。
}

interface StorageRemoveCriterionParams {
  name: string; // 要移除的搜索标准的名称。
}

interface StorageRemoveCriterionResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface StorageRemoveLocalStorageValsParams {
  keys: Array<string>; // 要移除的 LocalStorage 项目的键名数组。
  app: string; // 发起操作的 App ID，用于事件广播。
}

interface StorageRemoveLocalStorageValsResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface StorageSetCriterionParamsCriterion {
  name: string; // 搜索标准的唯一名称。
  id?: string;
  box?: string;
  type?: string;
  query?: string;
  sort?: number;
  group?: number;
  types?: any;
  customSort?: Array<any>;
  filter?: number;
  docIDs?: Array<string>;
  blockIDs?: Array<string>;
  tagIDs?: Array<string>;
  attrIDs?: Array<string>;
  refs?: Array<string>;
  parentID?: string;
  rootID?: string;
  kwd?: string;
}

interface StorageSetCriterionParams {
  criterion: StorageSetCriterionParamsCriterion; // 要保存或更新的搜索标准对象。具体字段请参考思源笔记内核 model.Criterion 结构。
}

interface StorageSetCriterionResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface StorageSetLocalStorageParams {
  val: Record<string, any>; // 一个对象，其键值对将完全替换现有的 LocalStorage 内容。
  app: string; // 发起操作的 App ID，用于事件广播。
}

interface StorageSetLocalStorageResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface StorageSetLocalStorageValParams {
  key: string; // 要设置的 LocalStorage 项目的键名。
  val: any; // 要设置的 LocalStorage 项目的值，可以是任意类型，但最终会序列化为字符串存储。
  app: string; // 发起操作的 App ID，用于事件广播。
}

interface StorageSetLocalStorageValResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncCreateCloudSyncDirParams {
  name: string; // 要创建的云端同步目录的名称。
}

interface SyncCreateCloudSyncDirResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。如果创建失败，Data 可能包含 { closeTimeout: 5000 }。
}

interface SyncExportSyncProviderS3ResponseData {
  name: string; // 导出的文件名 (不含 .zip 后缀)。
  zip: string; // 导出的 .zip 文件在服务端的临时路径，前端可据此下载。
}

interface SyncExportSyncProviderS3Response {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: SyncExportSyncProviderS3ResponseData | null;
}

interface SyncExportSyncProviderWebDAVResponseData {
  name: string; // 导出的文件名 (不含 .zip 后缀)。
  zip: string; // 导出的 .zip 文件在服务端的临时路径，前端可据此下载。
}

interface SyncExportSyncProviderWebDAVResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: SyncExportSyncProviderWebDAVResponseData | null;
}

interface SyncGetBootSyncResponse {
  Code: number; // 错误码。0 表示未满足特定条件（非管理员、同步未启用、启动时同步未成功），1 表示启动时同步成功。其他值表示失败。注意这里的 Code 含义比较特殊。 
  Msg: string; // 接口返回的消息。Code 为 1 时，Msg 为提示信息（如 '启动时同步数据完毕'）。Code 为 0 时通常为空。 
  Data: null; // 此接口不通过 Data 返回数据。
}

interface SyncGetSyncInfoResponseData {
  synced: string; // 最后成功同步的时间戳 (格式如 'YYYY-MM-DD HH:mm:ss')，如果从未同步则为空字符串。
  stat: string; // 当前的同步状态文本描述。如果同步未启用，则为 '同步未启用' 或类似提示。
  kernels: Array<string>; // 当前在线的其他内核实例的 ID 列表。
  kernel: string; // 当前内核实例的 ID。
}

interface SyncGetSyncInfoResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: SyncGetSyncInfoResponseData | null;
}

interface SyncImportSyncProviderS3ResponseDataS3 {
  endpoint: string; // S3 服务的 Endpoint。如：s3.amazonaws.com
  accessKeyID: string; // S3 Access Key ID。敏感信息，通常前端不直接展示。
  secretAccessKey: string; // S3 Secret Access Key。敏感信息，通常前端不直接展示。
  bucket: string; // S3 Bucket 名称。
  region: string; // S3 Bucket 所在区域。如：us-east-1
  cdn?: string;
}

interface SyncImportSyncProviderS3ResponseData {
  s3: SyncImportSyncProviderS3ResponseDataS3; // 导入并应用成功的 S3 配置对象。部分敏感字段可能不会完整返回或不应直接展示。
}

interface SyncImportSyncProviderS3Response {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: SyncImportSyncProviderS3ResponseData | null;
}

interface SyncImportSyncProviderWebDAVResponseDataWebdav {
  endpoint: string; // WebDAV 服务的 URL。如：https://dav.example.com/dav
  username: string; // WebDAV 用户名。敏感信息，通常前端不直接展示。
  password: string; // WebDAV 密码。敏感信息，通常前端不直接展示。
}

interface SyncImportSyncProviderWebDAVResponseData {
  webdav: SyncImportSyncProviderWebDAVResponseDataWebdav; // 导入并应用成功的 WebDAV 配置对象。部分敏感字段可能不会完整返回或不应直接展示。
}

interface SyncImportSyncProviderWebDAVResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: SyncImportSyncProviderWebDAVResponseData | null;
}

interface SyncListCloudSyncDirResponseDataSyncDirsItem {
  name: string; // 同步目录的名称。
  hSize: string; // 目录大小的人类可读格式 (例如 '1.2 MB')。
  size: number; // 目录大小，单位字节。
}

interface SyncListCloudSyncDirResponseData {
  syncDirs: Array<SyncListCloudSyncDirResponseDataSyncDirsItem>; // 云端同步目录列表。
  hSize: string; // 所有同步目录的总大小的人类可读格式。
  checkedSyncDir: string; // 当前内核配置中正在使用的云端同步目录名称。
}

interface SyncListCloudSyncDirResponse {
  Code: number; // 错误码，0 表示成功，1 表示获取失败（如网络错误、配置错误）。
  Msg: string; // 接口返回的消息，成功时通常为空字符串，失败时包含错误信息。
  Data: SyncListCloudSyncDirResponseData | null;
}

interface SyncPerformBootSyncResponse {
  Code: number; // 错误码。model.BootSyncSucc (通常为0或1，表示启动同步的结果) 会被赋给 Code。具体含义需参考内核实现。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 此接口不通过 Data 返回具体数据。
}

interface SyncPerformSyncParams {
  mobileSwitch?: boolean;
  upload?: boolean;
}

interface SyncPerformSyncResponse {
  Code: number; // 错误码，0 表示成功接收请求并开始处理（同步是异步过程），其他表示接收参数错误等。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 此接口不通过 Data 返回具体数据。
}

interface SyncRemoveCloudSyncDirParams {
  name: string; // 要移除的云端同步目录的名称。
}

interface SyncRemoveCloudSyncDirResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。如果移除失败，Data 可能包含 { closeTimeout: 5000 }。
}

interface SyncSetCloudSyncDirParams {
  name: string; // 要设置为当前同步目录的云端目录名称。
}

interface SyncSetCloudSyncDirResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。如果设置失败，Data 可能包含 { closeTimeout: 5000 }。
}

interface SyncSetSyncEnableParams {
  enabled: boolean; // 是否启用同步。true 为启用，false 为禁用。
}

interface SyncSetSyncEnableResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncGenerateConflictDocParams {
  generateConflictDoc: boolean; // 是否生成冲突文档。true 为生成，false 为不生成。
}

interface SyncSetSyncGenerateConflictDocResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncIntervalParams {
  syncInterval: number; // 自动同步的时间间隔，单位为分钟。例如，输入 5 表示每5分钟同步一次。最小值为1分钟。
}

interface SyncSetSyncIntervalResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncModeParams {
  syncMode: number; // 同步模式。例如：0-自动, 1-手动, 3-云端完全手动。具体可用值请参考内核实现或相关文档。
}

interface SyncSetSyncModeResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncPerceptionParams {
  syncPerception: boolean; // 是否启用同步感知。true 为启用，false 为禁用。
}

interface SyncSetSyncPerceptionResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncProviderParams {
  syncProvider: string; // 同步服务提供商的标识符。例如：'S3', 'WebDAV', 'LocalFolder'。具体可用值请参考内核实现。
}

interface SyncSetSyncProviderResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncProviderLocalParams {
  syncProviderLocalPath: string; // 本地同步文件夹的绝对路径。
}

interface SyncSetSyncProviderLocalResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncProviderS3Params {
  s3AccessKeyID: string; // S3 Access Key ID.
  s3SecretAccessKey: string; // S3 Secret Access Key.
  s3Endpoint: string; // S3 服务的 Endpoint。例如：s3.amazonaws.com
  s3Region: string; // S3 Bucket 所在区域。例如：us-east-1
  s3Bucket: string; // S3 Bucket 名称。
  s3CDN?: string;
}

interface SyncSetSyncProviderS3Response {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SyncSetSyncProviderWebDAVParams {
  webdavEndpoint: string; // WebDAV 服务的 URL。例如：https://dav.example.com/remote.php/dav
  webdavUsername: string; // WebDAV 用户名。
  webdavPassword: string; // WebDAV 密码。
}

interface SyncSetSyncProviderWebDAVResponse {
  Code: number; // 错误码，0 表示成功，其他表示失败。
  Msg: string; // 接口返回的消息，成功时通常为空字符串。
  Data: null; // 接口成功执行时，Data 固定为 null。
}

interface SystemAddMicrosoftDefenderExclusionResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemBootProgressResponseData {
  progress: number; // 启动进度百分比，例如 89
  state: number; // 当前启动状态码
  details: string; // 当前启动状态的详细描述文本
}

interface SystemBootProgressResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: SystemBootProgressResponseData | null;
}

interface SystemCheckUpdateParams {
  showMsg: boolean; // 是否在检查后显示提示消息给用户
}

interface SystemCheckUpdateResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null，更新信息通过 WebSocket 推送或直接在 UI 弹出
}

interface SystemCheckWorkspaceDirParams {
  path: string; // 要检查的目录绝对路径
}

interface SystemCheckWorkspaceDirResponseData {
  isWorkspace: boolean; // 该路径是否已经是或可以成为一个有效的工作空间
}

interface SystemCheckWorkspaceDirResponse {
  code: number; // 错误码，0 表示成功，-1 表示无效路径或检查失败
  msg: string; // 错误或提示信息
  data: SystemCheckWorkspaceDirResponseData | null;
}

interface SystemCreateWorkspaceDirParams {
  path: string; // 要创建工作空间的目录绝对路径
}

interface SystemCreateWorkspaceDirResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemCurrentTimeResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: number; // 当前的 Unix 时间戳 (毫秒)
}

interface SystemExitResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemExportConfResponseData {
  path: string; // 导出的配置文件 `conf.json` 所在临时目录的绝对路径。前端通常会触发下载此目录下的 `conf.json`。
  name: string; // 导出的配置文件名，通常是 `conf.json`
}

interface SystemExportConfResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: SystemExportConfResponseData;
}

interface SystemExportLogResponseData {
  zip: string; // 导出的日志压缩文件 `log.zip` 的绝对路径。前端通常会触发此文件的下载。
}

interface SystemExportLogResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: SystemExportLogResponseData;
}

interface SystemGetCaptchaResponse {
  code?: number;
  msg?: string;
  data?: string;
}

interface SystemGetChangelogResponseData {
  show: boolean; // 是否需要显示更新日志（例如，新版本首次启动后）
  html: string; // 更新日志的 HTML 内容
}

interface SystemGetChangelogResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: SystemGetChangelogResponseData;
}

interface SystemGetConfResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: any; // 包含所有配置项的对象，结构复杂，请参考 `siyuan/kernel/conf/conf.go` 中的 `Conf` 结构体。例如 `data.appearance.mode` 等。
}

interface SystemGetEmojiConfResponseDataItemItemsItem {
  unicode: string; // Emoji 的 Unicode 表示或自定义 Emoji 的文件名/路径
  description: string; // Emoji 描述 (英文)
  description_zh_cn?: string;
  description_ja_jp?: string;
  keywords?: string;
}

interface SystemGetEmojiConfResponseDataItem {
  id: string; // Emoji 分组 ID，例如 'custom', 'people'
  title: string; // Emoji 分组标题 (英文)
  title_zh_cn?: string;
  title_ja_jp?: string;
  items: Array<SystemGetEmojiConfResponseDataItemItemsItem>; // 该分组下的 Emoji项列表
}

interface SystemGetEmojiConfResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: Array<SystemGetEmojiConfResponseDataItem>; // Emoji 配置数组，每个元素是一个 Emoji 分组
}

interface SystemGetMobileWorkspacesResponseDataItem {
  path: string; // 工作空间的绝对路径
  name: string; // 工作空间的名称 (目录名)
  title: string; // 工作空间的标题 (通常与名称相同)
  bookmark: string; // 工作空间的备注/书签
  closed: boolean; // 工作空间是否已关闭
}

interface SystemGetMobileWorkspacesResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: Array<SystemGetMobileWorkspacesResponseDataItem>; // 移动端工作空间列表
}

interface SystemGetNetworkResponseData {
  proxy: string; // 网络代理配置字符串，例如 'socks5://127.0.0.1:1080' 或空字符串
}

interface SystemGetNetworkResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: SystemGetNetworkResponseData;
}

interface SystemGetSysFontsResponseDataItem {
  label: string; // 字体名称，用于显示和选择
  value: string; // 字体族名称，用于 CSS font-family
}

interface SystemGetSysFontsResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: Array<SystemGetSysFontsResponseDataItem>; // 系统字体列表
}

interface SystemGetWorkspaceInfoResponseData {
  workspaceDir: string; // 当前工作空间的绝对路径
  siyuanVer: string; // 当前思源笔记的版本号
}

interface SystemGetWorkspaceInfoResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: SystemGetWorkspaceInfoResponseData;
}

interface SystemGetWorkspacesResponseDataItem {
  path: string; // 工作空间的绝对路径
  name: string; // 工作空间的名称 (目录名)
  title: string; // 工作空间的标题 (通常与名称相同，可由用户设置)
  bookmark: string; // 工作空间的备注/书签
  closed: boolean; // 工作空间当前是否处于关闭状态
}

interface SystemGetWorkspacesResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: Array<SystemGetWorkspacesResponseDataItem>; // 工作空间列表
}

interface SystemIgnoreAddMicrosoftDefenderExclusionResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemImportConfParams {
  file: any; // 上传的 `conf.json` 文件。通常通过 FormData 提交。`z.instanceof(File)` 在此场景不适用，因为这是后端定义。前端应使用 `FormData`。
}

interface SystemImportConfResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemLoginAuthParams {
  authcode?: string;
  captcha?: string;
}

interface SystemLoginAuthResponse {
  code: number; // 错误码，0 表示成功，其他表示失败 (如授权码错误、验证码错误等)
  msg: string; // 错误或提示信息
  data: null; // 成功时为 null，失败时也可能为 null
}

interface SystemLogoutAuthResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemReloadUIResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemRemoveWorkspaceDirParams {
  path: string; // 要移除的工作空间的绝对路径
}

interface SystemRemoveWorkspaceDirResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemRemoveWorkspaceDirPhysicallyParams {
  paths: Array<string>; // 要物理删除的工作空间的绝对路径列表
}

interface SystemRemoveWorkspaceDirPhysicallyResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetAPITokenParams {
  token: string; // 新的 API 令牌。如果为空字符串，则表示清空令牌。
}

interface SystemSetAPITokenResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetAccessAuthCodeParams {
  code: string; // 新的访问授权码。如果为空字符串，则表示清空授权码。
  permanent?: boolean;
}

interface SystemSetAccessAuthCodeResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetAppearanceModeParams {
  mode: number; // 外观模式：0 表示亮色 (Light)，1 表示暗色 (Dark)
}

interface SystemSetAppearanceModeResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetAutoLaunchParams {
  autoLaunch: boolean; // 是否开机自启动
}

interface SystemSetAutoLaunchResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetDownloadInstallPkgParams {
  downloadInstallPkg: boolean; // 是否自动下载并安装更新包
}

interface SystemSetDownloadInstallPkgResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetFollowSystemLockScreenParams {
  follow: boolean; // 是否跟随系统锁屏
}

interface SystemSetFollowSystemLockScreenResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetGoogleAnalyticsParams {
  enabled: boolean; // 是否启用 Google Analytics
}

interface SystemSetGoogleAnalyticsResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetNetworkProxyParams {
  proxy: string; // 代理服务器地址，例如 'http://127.0.0.1:7890', 'socks5://127.0.0.1:1080'。如果为空字符串，则表示清除代理设置。
}

interface SystemSetNetworkProxyResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetNetworkServeParams {
  serve: boolean; // 是否启用网络服务
  port: string; // 网络服务端口号，字符串形式，例如 '6806'
  accessPermission: string; // 网络访问权限：'lan' (仅局域网), 'wan' (允许公网，需谨慎), 'localhost' (仅本机)
}

interface SystemSetNetworkServeResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetUILayoutParams {
  layout: string; // UI 布局模式的标识符字符串
}

interface SystemSetUILayoutResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemSetWorkspaceDirParams {
  path: string; // 要切换到的工作空间的绝对路径
}

interface SystemSetWorkspaceDirResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemAddUIProcessParams {
  pid?: number;
}

interface SystemAddUIProcessResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: null; // 成功时总是为 null
}

interface SystemVersionResponse {
  code: number; // 错误码，0 表示成功
  msg: string; // 错误信息
  data: string; // 当前思源笔记的版本号字符串，例如 '2.10.0'
}

interface TagGetTagParams {
  sort?: number;
}

interface TagGetTagResponseDataItem {
  label: string; // 标签的名称。
  count: number; // 标签关联的块数量（文档块+列表项块等）。
  blockCount: number; // 标签关联的文档块数量。
  hCreated: string; // 标签创建时间的人类可读格式。
  hUpdated: string; // 标签最后更新时间的人类可读格式。
}

interface TagGetTagResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息，成功时为空字符串。
  data: Array<TagGetTagResponseDataItem> | null;
}

interface TagRemoveTagParams {
  label: string; // 要移除的标签的名称。
}

interface TagRemoveTagResponseData {
  closeTimeout?: number;
}

interface TagRemoveTagResponse {
  code: number; // 错误码，0 表示成功，-1 表示失败。
  msg: string; // 错误信息。
  data: TagRemoveTagResponseData | null;
}

interface TagRenameTagParams {
  oldLabel: string; // 要重命名的旧标签名称。
  newLabel: string; // 新的标签名称。
}

interface TagRenameTagResponseData {
  closeTimeout?: number;
}

interface TagRenameTagResponse {
  code: number; // 错误码，0 表示成功，-1 表示失败。
  msg: string; // 错误信息。
  data: TagRenameTagResponseData | null;
}

interface TemplateDocSaveAsTemplateParams {
  id: string; // 要作为模板保存的文档ID。
  name: string; // 模板的名称。
  overwrite: boolean; // 如果已存在同名模板，是否覆盖。
}

interface TemplateDocSaveAsTemplateResponse {
  code: number; // 错误码，0 表示成功，其他表示失败。
  msg: string; // 错误或成功信息。
  data: null; // 成功时总是为 null。
}

interface TemplateRenderTemplateParams {
  path: string; // 模板文件的绝对路径。
  id: string; // 可选的上下文块ID，用于模板内获取该块的信息。
  preview?: boolean;
}

interface TemplateRenderTemplateResponseData {
  path: string; // 渲染的模板文件路径。
  content: string; // 渲染后的模板内容 (HTML 字符串)。
}

interface TemplateRenderTemplateResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息。
  data: TemplateRenderTemplateResponseData | null;
}

interface TemplateRenderSprigParams {
  template: string; // 包含 Sprig 模板语法的字符串。
}

interface TemplateRenderSprigResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息。
  data: string | null;
}

interface TransactionsPerformTransactionsParamsTransactionsItemDoOperationsItem {
  action: string; // 必需，具体的操作名称 (如 updateBlock, insertBlock, deleteBlock, setBlockAttrs, foldHeading, addFlashcards, setAttrViewName, updateAttrViewCell 等)。实际可用 action 请参考 kernel/model/transaction.go 中的 performTx 函数内 switch case 定义。
  id?: string;
  parentID?: string;
  previousID?: string;
  nextID?: string;
  data?: any;
  dataType?: string;
  isDetached?: boolean;
  box?: string;
  path?: string;
  name?: string;
  keyID?: string;
  avID?: string;
  blockIDs?: Array<string>;
  deckID?: string;
  rowID?: string;
  srcID?: string;
  targetID?: string;
  after?: boolean;
  srcHeadingID?: string;
  targetNoteBook?: string;
  targetPath?: string;
  previousPath?: string;
  srcListItemID?: string;
  fromPaths?: Array<string>;
  toNotebook?: string;
  toPath?: string;
  fromIDs?: Array<string>;
  toID?: string;
  title?: string;
  markdown?: string;
  tags?: string;
  withMath?: boolean;
  clippingHref?: string;
  listDocTree?: boolean;
  callback?: string;
  typ?: string;
  format?: string;
  removeDest?: boolean;
}

interface TransactionsPerformTransactionsParamsTransactionsItemUndoOperationsItem {
  action: string; // 必需，具体的操作名称 (如 updateBlock, insertBlock, deleteBlock, setBlockAttrs, foldHeading, addFlashcards, setAttrViewName, updateAttrViewCell 等)。实际可用 action 请参考 kernel/model/transaction.go 中的 performTx 函数内 switch case 定义。
  id?: string;
  parentID?: string;
  previousID?: string;
  nextID?: string;
  data?: any;
  dataType?: string;
  isDetached?: boolean;
  box?: string;
  path?: string;
  name?: string;
  keyID?: string;
  avID?: string;
  blockIDs?: Array<string>;
  deckID?: string;
  rowID?: string;
  srcID?: string;
  targetID?: string;
  after?: boolean;
  srcHeadingID?: string;
  targetNoteBook?: string;
  targetPath?: string;
  previousPath?: string;
  srcListItemID?: string;
  fromPaths?: Array<string>;
  toNotebook?: string;
  toPath?: string;
  fromIDs?: Array<string>;
  toID?: string;
  title?: string;
  markdown?: string;
  tags?: string;
  withMath?: boolean;
  clippingHref?: string;
  listDocTree?: boolean;
  callback?: string;
  typ?: string;
  format?: string;
  removeDest?: boolean;
}

interface TransactionsPerformTransactionsParamsTransactionsItem {
  timestamp: number; // 事务时间戳，通常由前端生成或后端使用 reqId 覆盖（毫秒级）。
  doOperations: Array<TransactionsPerformTransactionsParamsTransactionsItemDoOperationsItem>; // 要执行的操作列表，至少包含一个操作。
  undoOperations?: Array<TransactionsPerformTransactionsParamsTransactionsItemUndoOperationsItem>;
}

interface TransactionsPerformTransactionsParams {
  transactions: Array<TransactionsPerformTransactionsParamsTransactionsItem>; // 一个或多个事务对象的数组，至少包含一个事务。
  reqId: number; // 必需，请求的唯一ID (通常是客户端生成的时间戳，毫秒级)。
  app: string; // 必需，发起请求的应用标识 (例如 "SiYuan")。
  session: string; // 必需，当前会话ID (例如前端的 WebSocket clientID)。
}

interface TransactionsPerformTransactionsResponseDataItemDoOperationsItem {
  action: string; // 必需，具体的操作名称。
  id?: string;
  parentID?: string;
  previousID?: string;
  nextID?: string;
  data?: any;
  dataType?: string;
  isDetached?: boolean;
  box?: string;
  path?: string;
  name?: string;
  keyID?: string;
  avID?: string;
  blockIDs?: Array<string>;
  deckID?: string;
  rowID?: string;
  srcID?: string;
  targetID?: string;
  after?: boolean;
  srcHeadingID?: string;
  targetNoteBook?: string;
  targetPath?: string;
  previousPath?: string;
  srcListItemID?: string;
  fromPaths?: Array<string>;
  toNotebook?: string;
  toPath?: string;
  fromIDs?: Array<string>;
  toID?: string;
  title?: string;
  markdown?: string;
  tags?: string;
  withMath?: boolean;
  clippingHref?: string;
  listDocTree?: boolean;
  callback?: string;
  typ?: string;
  format?: string;
  removeDest?: boolean;
  retData?: any;
}

interface TransactionsPerformTransactionsResponseDataItemUndoOperationsItem {
  action: string; // 必需，具体的操作名称。
  id?: string;
  parentID?: string;
  previousID?: string;
  nextID?: string;
  data?: any;
  dataType?: string;
  isDetached?: boolean;
  box?: string;
  path?: string;
  name?: string;
  keyID?: string;
  avID?: string;
  blockIDs?: Array<string>;
  deckID?: string;
  rowID?: string;
  srcID?: string;
  targetID?: string;
  after?: boolean;
  srcHeadingID?: string;
  targetNoteBook?: string;
  targetPath?: string;
  previousPath?: string;
  srcListItemID?: string;
  fromPaths?: Array<string>;
  toNotebook?: string;
  toPath?: string;
  fromIDs?: Array<string>;
  toID?: string;
  title?: string;
  markdown?: string;
  tags?: string;
  withMath?: boolean;
  clippingHref?: string;
  listDocTree?: boolean;
  callback?: string;
  typ?: string;
  format?: string;
  removeDest?: boolean;
  retData?: any;
}

interface TransactionsPerformTransactionsResponseDataItem {
  timestamp: number; // 事务时间戳，与请求中的 reqId 一致（毫秒级）。
  doOperations: Array<TransactionsPerformTransactionsResponseDataItemDoOperationsItem>; // 已执行的操作列表，其中 retData 可能包含操作结果。
  undoOperations?: Array<TransactionsPerformTransactionsResponseDataItemUndoOperationsItem>;
}

interface TransactionsPerformTransactionsResponse {
  code: number; // 错误码，0 表示成功。其他值表示不同类型的错误。
  msg: string; // 错误或成功信息。成功时通常为空字符串。
  data: Array<TransactionsPerformTransactionsResponseDataItem> | null;
}

interface UiReloadAttributeViewParams {
  id: string; // 要重新加载的属性视图的 ID。
}

interface UiReloadAttributeViewResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息，成功时为空字符串。
  data: null; // 成功时总是为 null。
}

interface UiReloadFiletreeResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息，成功时为空字符串。
  data: null; // 成功时总是为 null。
}

interface UiReloadProtyleParams {
  id: string; // 要重新加载的 Protyle 编辑器实例对应的块 ID 或文档 ID。
}

interface UiReloadProtyleResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息，成功时为空字符串。
  data: null; // 成功时总是为 null。
}

interface UiReloadTagResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息，成功时为空字符串。
  data: null; // 成功时总是为 null。
}

interface UiReloadUIResponse {
  code: number; // 错误码，0 表示成功。
  msg: string; // 错误信息，成功时为空字符串。
  data: null; // 成功时总是为 null。
}

export interface AccountApi {
  /**
   * 检查用户输入的激活码是否有效。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AccountCheckActivationcodeParams)
   * @returns Promise<AccountCheckActivationcodeResponse> 
   */
  checkActivationcode(params: AccountCheckActivationcodeParams): Promise<AccountCheckActivationcodeResponse>;

  /**
   * 注销当前用户账号。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<AccountDeactivateUserResponse> 
   */
  deactivateUser(): Promise<AccountDeactivateUserResponse>;

  /**
   * 用户登录，需要提供用户名、密码、验证码和云端区域。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AccountLoginParams)
   * @returns Promise<AccountLoginResponse> 
   */
  login(params: AccountLoginParams): Promise<AccountLoginResponse>;

  /**
   * 为当前用户开启免费试用。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<AccountStartFreeTrialResponse> 
   */
  startFreeTrial(): Promise<AccountStartFreeTrialResponse>;

  /**
   * 使用激活码激活账户。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AccountUseActivationcodeParams)
   * @returns Promise<AccountUseActivationcodeResponse> 
   */
  useActivationcode(params: AccountUseActivationcodeParams): Promise<AccountUseActivationcodeResponse>;

}

export interface AiApi {
  /**
   * 与 ChatGPT 进行简单对话。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (AiChatGPTParams)
   * @returns Promise<AiChatGPTResponse> 
   */
  chatGPT(params: AiChatGPTParams): Promise<AiChatGPTResponse>;

  /**
   * 调用 ChatGPT 对指定的块ID列表执行特定动作。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (AiChatGPTWithActionParams)
   * @returns Promise<AiChatGPTWithActionResponse> 
   */
  chatGPTWithAction(params: AiChatGPTWithActionParams): Promise<AiChatGPTWithActionResponse>;

}

export interface ArchiveApi {
  /**
   * 将指定的 .zip 文件解压到指定路径。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (ArchiveUnzipParams)
   * @returns Promise<ArchiveUnzipResponse> 
   */
  unzip(params: ArchiveUnzipParams): Promise<ArchiveUnzipResponse>;

  /**
   * 将指定路径的文件或目录压缩到指定的 .zip 文件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (ArchiveZipParams)
   * @returns Promise<ArchiveZipResponse> 
   */
  zip(params: ArchiveZipParams): Promise<ArchiveZipResponse>;

}

export interface AssetApi {
  /**
   * 完全重新索引工作空间中所有资源文件的内容，用于搜索。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<AssetFullReindexAssetContentResponse> 
   */
  fullReindexAssetContent(): Promise<AssetFullReindexAssetContentResponse>;

  /**
   * 获取指定文档块所引用的所有资源文件列表。
   * (Requires authentication)
   * @param params Request parameters (AssetGetDocAssetsParams)
   * @returns Promise<AssetGetDocAssetsResponse> 
   */
  getDocAssets(params: AssetGetDocAssetsParams): Promise<AssetGetDocAssetsResponse>;

  /**
   * 获取指定文档块所引用的所有图片类型资源文件列表。
   * (Requires authentication)
   * @param params Request parameters (AssetGetDocImageAssetsParams)
   * @returns Promise<AssetGetDocImageAssetsResponse> 
   */
  getDocImageAssets(params: AssetGetDocImageAssetsParams): Promise<AssetGetDocImageAssetsResponse>;

  /**
   * 获取指定资源文件的标注信息（通常是 XFDF 格式的 PDF 标注）。
   * (Requires authentication)
   * @param params Request parameters (AssetGetFileAnnotationParams)
   * @returns Promise<AssetGetFileAnnotationResponse> 
   */
  getFileAnnotation(params: AssetGetFileAnnotationParams): Promise<AssetGetFileAnnotationResponse>;

  /**
   * 获取指定图片资源文件后台 OCR 识别的文本内容。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetGetImageOCRTextParams)
   * @returns Promise<AssetGetImageOCRTextResponse> 
   */
  getImageOCRText(params: AssetGetImageOCRTextParams): Promise<AssetGetImageOCRTextResponse>;

  /**
   * 获取所有在文档中被引用但实际资源文件已不存在的资源路径列表。
   * (Requires authentication)
   * @returns Promise<AssetGetMissingAssetsResponse> 
   */
  getMissingAssets(): Promise<AssetGetMissingAssetsResponse>;

  /**
   * 获取工作空间中存在但未被任何文档引用的资源文件列表（最多返回512条）。
   * (Requires authentication)
   * @returns Promise<AssetGetUnusedAssetsResponse> 
   */
  getUnusedAssets(): Promise<AssetGetUnusedAssetsResponse>;

  /**
   * 将指定的本地文件复制到当前笔记本的 assets 文件夹中，并在指定文档中插入对这些资源的引用。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetInsertLocalAssetsParams)
   * @returns Promise<AssetInsertLocalAssetsResponse> 
   */
  insertLocalAssets(params: AssetInsertLocalAssetsParams): Promise<AssetInsertLocalAssetsResponse>;

  /**
   * 对指定的图片资源文件执行光学字符识别，并返回识别出的文本及原始 OCR 结果。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetOcrParams)
   * @returns Promise<AssetOcrResponse> 
   */
  ocr(params: AssetOcrParams): Promise<AssetOcrResponse>;

  /**
   * 删除工作空间中指定的单个未使用（未被任何文档引用）的资源文件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetRemoveUnusedAssetParams)
   * @returns Promise<AssetRemoveUnusedAssetResponse> 
   */
  removeUnusedAsset(params: AssetRemoveUnusedAssetParams): Promise<AssetRemoveUnusedAssetResponse>;

  /**
   * 删除工作空间中所有未被任何文档引用的资源文件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<AssetRemoveUnusedAssetsResponse> 
   */
  removeUnusedAssets(): Promise<AssetRemoveUnusedAssetsResponse>;

  /**
   * 重命名指定的资源文件，并自动更新所有文档中对该资源的引用。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetRenameAssetParams)
   * @returns Promise<AssetRenameAssetResponse> 
   */
  renameAsset(params: AssetRenameAssetParams): Promise<AssetRenameAssetResponse>;

  /**
   * 将资源文件在思源笔记中的相对路径（如 'assets/image.png'）转换为其在文件系统中的绝对路径。
   * (Requires authentication)
   * @param params Request parameters (AssetResolveAssetPathParams)
   * @returns Promise<AssetResolveAssetPathResponse> 
   */
  resolveAssetPath(params: AssetResolveAssetPathParams): Promise<AssetResolveAssetPathResponse>;

  /**
   * 为指定的资源文件（通常是 PDF）保存或更新其标注信息（通常是 XFDF 格式）。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetSetFileAnnotationParams)
   * @returns Promise<AssetSetFileAnnotationResponse> 
   */
  setFileAnnotation(params: AssetSetFileAnnotationParams): Promise<AssetSetFileAnnotationResponse>;

  /**
   * 手动为指定的图片资源文件设置或更新其 OCR 文本内容，并刷新到数据库。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetSetImageOCRTextParams)
   * @returns Promise<AssetSetImageOCRTextResponse> 
   */
  setImageOCRText(params: AssetSetImageOCRTextParams): Promise<AssetSetImageOCRTextResponse>;

  /**
   * 获取指定资源文件（assets/ 路径）或本地文件（file:/// 路径）的大小、创建及修改时间等元信息。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (AssetStatAssetParams)
   * @returns Promise<AssetStatAssetResponse> 
   */
  statAsset(params: AssetStatAssetParams): Promise<AssetStatAssetResponse>;

  /**
   * 处理文件上传。通常用于将文件上传到服务器的临时目录或直接作为资源插入。参数通过 FormData 传递，如 assetPath (可选，指定保存路径) 和 id (可选，关联的文档ID)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetUploadParams)
   * @returns Promise<AssetUploadResponse> 
   */
  Upload(params: AssetUploadParams): Promise<AssetUploadResponse>;

  /**
   * 将指定文档（及其子文档中）引用的所有本地资源文件上传到用户配置的云存储服务。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AssetUploadCloudParams)
   * @returns Promise<AssetUploadCloudResponse> 
   */
  uploadCloud(params: AssetUploadCloudParams): Promise<AssetUploadCloudResponse>;

}

export interface AttrApi {
  /**
   * 根据提供的块 ID 列表，批量获取这些块的所有自定义属性。
   * (Requires authentication)
   * @param params Request parameters (AttrBatchGetBlockAttrsParams)
   * @returns Promise<AttrBatchGetBlockAttrsResponse> 
   */
  batchGetBlockAttrs(params: AttrBatchGetBlockAttrsParams): Promise<AttrBatchGetBlockAttrsResponse>;

  /**
   * 根据提供的块 ID 和对应的属性集，批量为这些块设置自定义属性。如果属性值为 null，则表示删除该属性。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AttrBatchSetBlockAttrsParams)
   * @returns Promise<AttrBatchSetBlockAttrsResponse> 
   */
  batchSetBlockAttrs(params: AttrBatchSetBlockAttrsParams): Promise<AttrBatchSetBlockAttrsResponse>;

  /**
   * 获取指定块 ID 的所有自定义属性。
   * (Requires authentication)
   * @param params Request parameters (AttrGetBlockAttrsParams)
   * @returns Promise<AttrGetBlockAttrsResponse> 
   */
  getBlockAttrs(params: AttrGetBlockAttrsParams): Promise<AttrGetBlockAttrsResponse>;

  /**
   * 获取当前工作空间中所有书签使用过的标签列表。
   * (Requires authentication)
   * @returns Promise<AttrGetBookmarkLabelsResponse> 
   */
  getBookmarkLabels(): Promise<AttrGetBookmarkLabelsResponse>;

  /**
   * 重置指定块的若干属性。此操作通常用于删除属性，但需要提供属性的当前期望值进行匹配后才会执行。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AttrResetBlockAttrsParams)
   * @returns Promise<AttrResetBlockAttrsResponse> 
   */
  resetBlockAttrs(params: AttrResetBlockAttrsParams): Promise<AttrResetBlockAttrsResponse>;

  /**
   * 为指定的单个块设置自定义属性。如果属性值为 null，则表示删除该属性。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AttrSetBlockAttrsParams)
   * @returns Promise<AttrSetBlockAttrsResponse> 
   */
  setBlockAttrs(params: AttrSetBlockAttrsParams): Promise<AttrSetBlockAttrsResponse>;

}

export interface AvApi {
  /**
   * 向指定的属性视图中添加一个或多个数据块。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvAddAttributeViewBlocksParams)
   * @returns Promise<AvAddAttributeViewBlocksResponse> 
   */
  addAttributeViewBlocks(params: AvAddAttributeViewBlocksParams): Promise<AvAddAttributeViewBlocksResponse>;

  /**
   * 向指定的属性视图添加一个新的列定义。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvAddAttributeViewKeyParams)
   * @returns Promise<AvAddAttributeViewKeyResponse> 
   */
  addAttributeViewKey(params: AvAddAttributeViewKeyParams): Promise<AvAddAttributeViewKeyResponse>;

  /**
   * 向属性视图追加多个新的独立块，并为这些块设置初始值。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvAppendAttributeViewDetachedBlocksWithValuesParams)
   * @returns Promise<AvAppendAttributeViewDetachedBlocksWithValuesResponse> 
   */
  appendAttributeViewDetachedBlocksWithValues(params: AvAppendAttributeViewDetachedBlocksWithValuesParams): Promise<AvAppendAttributeViewDetachedBlocksWithValuesResponse>;

  /**
   * 复制一个属性视图块（数据库块）。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvDuplicateAttributeViewBlockParams)
   * @returns Promise<AvDuplicateAttributeViewBlockResponse> 
   */
  duplicateAttributeViewBlock(params: AvDuplicateAttributeViewBlockParams): Promise<AvDuplicateAttributeViewBlockResponse>;

  /**
   * 获取指定ID的属性视图的详细信息。
   * (Requires authentication, Unavailable in read-only mode)
   * @param params Request parameters (AvGetAttributeViewParams)
   * @returns Promise<AvGetAttributeViewResponse> 
   */
  getAttributeView(params: AvGetAttributeViewParams): Promise<AvGetAttributeViewResponse>;

  /**
   * 获取指定属性视图（或其关联块）的筛选条件和排序规则。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvGetAttributeViewFilterSortParams)
   * @returns Promise<AvGetAttributeViewFilterSortResponse> 
   */
  getAttributeViewFilterSort(params: AvGetAttributeViewFilterSortParams): Promise<AvGetAttributeViewFilterSortResponse>;

  /**
   * 获取指定属性视图ID的所有列定义 (keys)。
   * (Requires authentication)
   * @param params Request parameters (AvGetAttributeViewKeysParams)
   * @returns Promise<AvGetAttributeViewKeysResponse> 
   */
  getAttributeViewKeys(params: AvGetAttributeViewKeysParams): Promise<AvGetAttributeViewKeysResponse>;

  /**
   * 通过属性视图ID获取其所有列定义 (keys)。(此接口功能上可能与 getAttributeViewKeys 重复，需确认)
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvGetAttributeViewKeysByAvIDParams)
   * @returns Promise<AvGetAttributeViewKeysByAvIDResponse> 
   */
  getAttributeViewKeysByAvID(params: AvGetAttributeViewKeysByAvIDParams): Promise<AvGetAttributeViewKeysByAvIDResponse>;

  /**
   * 获取指定属性视图的主键列的值，支持分页和关键词搜索。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvGetAttributeViewPrimaryKeyValuesParams)
   * @returns Promise<AvGetAttributeViewPrimaryKeyValuesResponse> 
   */
  getAttributeViewPrimaryKeyValues(params: AvGetAttributeViewPrimaryKeyValuesParams): Promise<AvGetAttributeViewPrimaryKeyValuesResponse>;

  /**
   * 获取指定属性视图ID的镜像数据库块ID列表。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvGetMirrorDatabaseBlocksParams)
   * @returns Promise<AvGetMirrorDatabaseBlocksResponse> 
   */
  getMirrorDatabaseBlocks(params: AvGetMirrorDatabaseBlocksParams): Promise<AvGetMirrorDatabaseBlocksResponse>;

  /**
   * 从指定的属性视图中移除一个或多个数据块。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvRemoveAttributeViewBlocksParams)
   * @returns Promise<AvRemoveAttributeViewBlocksResponse> 
   */
  removeAttributeViewBlocks(params: AvRemoveAttributeViewBlocksParams): Promise<AvRemoveAttributeViewBlocksResponse>;

  /**
   * 从指定的属性视图移除一个列定义。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvRemoveAttributeViewKeyParams)
   * @returns Promise<AvRemoveAttributeViewKeyResponse> 
   */
  removeAttributeViewKey(params: AvRemoveAttributeViewKeyParams): Promise<AvRemoveAttributeViewKeyResponse>;

  /**
   * 渲染属性视图，获取其名称、视图类型、视图ID、所有视图、当前视图详情以及是否为镜像等信息。
   * (Requires authentication)
   * @param params Request parameters (AvRenderAttributeViewParams)
   * @returns Promise<AvRenderAttributeViewResponse> 
   */
  renderAttributeView(params: AvRenderAttributeViewParams): Promise<AvRenderAttributeViewResponse>;

  /**
   * 渲染指定历史版本的属性视图。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (AvRenderHistoryAttributeViewParams)
   * @returns Promise<AvRenderHistoryAttributeViewResponse> 
   */
  renderHistoryAttributeView(params: AvRenderHistoryAttributeViewParams): Promise<AvRenderHistoryAttributeViewResponse>;

  /**
   * 渲染指定快照索引的属性视图。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (AvRenderSnapshotAttributeViewParams)
   * @returns Promise<AvRenderSnapshotAttributeViewResponse> 
   */
  renderSnapshotAttributeView(params: AvRenderSnapshotAttributeViewParams): Promise<AvRenderSnapshotAttributeViewResponse>;

  /**
   * 根据关键词搜索属性视图，可排除指定ID。
   * (Requires authentication, Unavailable in read-only mode)
   * @param params Request parameters (AvSearchAttributeViewParams)
   * @returns Promise<AvSearchAttributeViewResponse> 
   */
  searchAttributeView(params: AvSearchAttributeViewParams): Promise<AvSearchAttributeViewResponse>;

  /**
   * 根据关键词搜索指定属性视图的非关联列 (Non-relation Key)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvSearchAttributeViewNonRelationKeyParams)
   * @returns Promise<AvSearchAttributeViewNonRelationKeyResponse> 
   */
  searchAttributeViewNonRelationKey(params: AvSearchAttributeViewNonRelationKeyParams): Promise<AvSearchAttributeViewNonRelationKeyResponse>;

  /**
   * 根据关键词搜索指定属性视图的关联列 (Relation Key)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvSearchAttributeViewRelationKeyParams)
   * @returns Promise<AvSearchAttributeViewRelationKeyResponse> 
   */
  searchAttributeViewRelationKey(params: AvSearchAttributeViewRelationKeyParams): Promise<AvSearchAttributeViewRelationKeyResponse>;

  /**
   * 更新属性视图中指定行（块ID）、指定列（KeyID）的单元格的值。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvSetAttributeViewBlockAttrParams)
   * @returns Promise<AvSetAttributeViewBlockAttrResponse> 
   */
  setAttributeViewBlockAttr(params: AvSetAttributeViewBlockAttrParams): Promise<AvSetAttributeViewBlockAttrResponse>;

  /**
   * 设置指定数据库块（属性视图块）的默认视图ID。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvSetDatabaseBlockViewParams)
   * @returns Promise<AvSetDatabaseBlockViewResponse> 
   */
  setDatabaseBlockView(params: AvSetDatabaseBlockViewParams): Promise<AvSetDatabaseBlockViewResponse>;

  /**
   * 对属性视图的列进行排序。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvSortAttributeViewKeyParams)
   * @returns Promise<AvSortAttributeViewKeyResponse> 
   */
  sortAttributeViewKey(params: AvSortAttributeViewKeyParams): Promise<AvSortAttributeViewKeyResponse>;

  /**
   * 对属性视图中某个特定视图（如图表、看板等）的列进行排序。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (AvSortAttributeViewViewKeyParams)
   * @returns Promise<AvSortAttributeViewViewKeyResponse> 
   */
  sortAttributeViewViewKey(params: AvSortAttributeViewViewKeyParams): Promise<AvSortAttributeViewViewKeyResponse>;

}

export interface BazaarApi {
  /**
   * 根据指定的客户端类型（如 'frontend'）批量更新思源笔记本地缓存的集市包信息。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarBatchUpdatePackageParams)
   * @returns Promise<BazaarBatchUpdatePackageResponse> 
   */
  batchUpdatePackage(params: BazaarBatchUpdatePackageParams): Promise<BazaarBatchUpdatePackageResponse>;

  /**
   * 从集市获取所有可用的图标包列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetBazaarIconParams)
   * @returns Promise<BazaarGetBazaarIconResponse> 
   */
  getBazaarIcon(params: BazaarGetBazaarIconParams): Promise<BazaarGetBazaarIconResponse>;

  /**
   * 获取指定集市包（通过仓库URL、哈希和类型指定）的 README 文件内容 (HTML格式)。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetBazaarPackageREAMEParams)
   * @returns Promise<BazaarGetBazaarPackageREAMEResponse> 
   */
  getBazaarPackageREAME(params: BazaarGetBazaarPackageREAMEParams): Promise<BazaarGetBazaarPackageREAMEResponse>;

  /**
   * 从集市获取所有可用的插件列表，支持按前端类型和关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetBazaarPluginParams)
   * @returns Promise<BazaarGetBazaarPluginResponse> 
   */
  getBazaarPlugin(params: BazaarGetBazaarPluginParams): Promise<BazaarGetBazaarPluginResponse>;

  /**
   * 从集市获取所有可用的模板列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetBazaarTemplateParams)
   * @returns Promise<BazaarGetBazaarTemplateResponse> 
   */
  getBazaarTemplate(params: BazaarGetBazaarTemplateParams): Promise<BazaarGetBazaarTemplateResponse>;

  /**
   * 从集市获取所有可用的主题列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetBazaarThemeParams)
   * @returns Promise<BazaarGetBazaarThemeResponse> 
   */
  getBazaarTheme(params: BazaarGetBazaarThemeParams): Promise<BazaarGetBazaarThemeResponse>;

  /**
   * 从集市获取所有可用的挂件列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetBazaarWidgetParams)
   * @returns Promise<BazaarGetBazaarWidgetResponse> 
   */
  getBazaarWidget(params: BazaarGetBazaarWidgetParams): Promise<BazaarGetBazaarWidgetResponse>;

  /**
   * 获取本地已安装的图标包列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetInstalledIconParams)
   * @returns Promise<BazaarGetInstalledIconResponse> 
   */
  getInstalledIcon(params: BazaarGetInstalledIconParams): Promise<BazaarGetInstalledIconResponse>;

  /**
   * 获取本地已安装的插件列表，支持按前端类型和关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetInstalledPluginParams)
   * @returns Promise<BazaarGetInstalledPluginResponse> 
   */
  getInstalledPlugin(params: BazaarGetInstalledPluginParams): Promise<BazaarGetInstalledPluginResponse>;

  /**
   * 获取本地已安装的模板列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetInstalledTemplateParams)
   * @returns Promise<BazaarGetInstalledTemplateResponse> 
   */
  getInstalledTemplate(params: BazaarGetInstalledTemplateParams): Promise<BazaarGetInstalledTemplateResponse>;

  /**
   * 获取本地已安装的主题列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetInstalledThemeParams)
   * @returns Promise<BazaarGetInstalledThemeResponse> 
   */
  getInstalledTheme(params: BazaarGetInstalledThemeParams): Promise<BazaarGetInstalledThemeResponse>;

  /**
   * 获取本地已安装的挂件列表，支持关键词筛选。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetInstalledWidgetParams)
   * @returns Promise<BazaarGetInstalledWidgetResponse> 
   */
  getInstalledWidget(params: BazaarGetInstalledWidgetParams): Promise<BazaarGetInstalledWidgetResponse>;

  /**
   * 检查并返回所有已安装且存在更新的集市包（插件、挂件、图标、主题、模板）。
   * (Requires authentication)
   * @param params Request parameters (BazaarGetUpdatedPackageParams)
   * @returns Promise<BazaarGetUpdatedPackageResponse> 
   */
  getUpdatedPackage(params: BazaarGetUpdatedPackageParams): Promise<BazaarGetUpdatedPackageResponse>;

  /**
   * 从集市安装指定的图标包。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarInstallBazaarIconParams)
   * @returns Promise<BazaarInstallBazaarIconResponse> 
   */
  installBazaarIcon(params: BazaarInstallBazaarIconParams): Promise<BazaarInstallBazaarIconResponse>;

  /**
   * 从集市安装指定的插件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarInstallBazaarPluginParams)
   * @returns Promise<BazaarInstallBazaarPluginResponse> 
   */
  installBazaarPlugin(params: BazaarInstallBazaarPluginParams): Promise<BazaarInstallBazaarPluginResponse>;

  /**
   * 从集市安装指定的模板。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarInstallBazaarTemplateParams)
   * @returns Promise<BazaarInstallBazaarTemplateResponse> 
   */
  installBazaarTemplate(params: BazaarInstallBazaarTemplateParams): Promise<BazaarInstallBazaarTemplateResponse>;

  /**
   * 从集市安装指定的主题，并可指定主题模式 (mode) 和是否为更新 (update)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarInstallBazaarThemeParams)
   * @returns Promise<BazaarInstallBazaarThemeResponse> 
   */
  installBazaarTheme(params: BazaarInstallBazaarThemeParams): Promise<BazaarInstallBazaarThemeResponse>;

  /**
   * 从集市安装指定的挂件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarInstallBazaarWidgetParams)
   * @returns Promise<BazaarInstallBazaarWidgetResponse> 
   */
  installBazaarWidget(params: BazaarInstallBazaarWidgetParams): Promise<BazaarInstallBazaarWidgetResponse>;

  /**
   * 卸载本地已安装的指定图标包。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarUninstallBazaarIconParams)
   * @returns Promise<BazaarUninstallBazaarIconResponse> 
   */
  uninstallBazaarIcon(params: BazaarUninstallBazaarIconParams): Promise<BazaarUninstallBazaarIconResponse>;

  /**
   * 卸载本地已安装的指定插件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarUninstallBazaarPluginParams)
   * @returns Promise<BazaarUninstallBazaarPluginResponse> 
   */
  uninstallBazaarPlugin(params: BazaarUninstallBazaarPluginParams): Promise<BazaarUninstallBazaarPluginResponse>;

  /**
   * 卸载本地已安装的指定模板。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarUninstallBazaarTemplateParams)
   * @returns Promise<BazaarUninstallBazaarTemplateResponse> 
   */
  uninstallBazaarTemplate(params: BazaarUninstallBazaarTemplateParams): Promise<BazaarUninstallBazaarTemplateResponse>;

  /**
   * 卸载本地已安装的指定主题。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarUninstallBazaarThemeParams)
   * @returns Promise<BazaarUninstallBazaarThemeResponse> 
   */
  uninstallBazaarTheme(params: BazaarUninstallBazaarThemeParams): Promise<BazaarUninstallBazaarThemeResponse>;

  /**
   * 卸载本地已安装的指定挂件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BazaarUninstallBazaarWidgetParams)
   * @returns Promise<BazaarUninstallBazaarWidgetResponse> 
   */
  uninstallBazaarWidget(params: BazaarUninstallBazaarWidgetParams): Promise<BazaarUninstallBazaarWidgetResponse>;

}

export interface BlockApi {
  /**
   * 在指定父块的末尾插入新的子块。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockAppendBlockParams)
   * @returns Promise<BlockAppendBlockResponse> 
   */
  appendBlock(params: BlockAppendBlockParams): Promise<BlockAppendBlockResponse>;

  /**
   * 向指定笔记本的当日日记文档末尾追加新的内容块。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockAppendDailyNoteBlockParams)
   * @returns Promise<BlockAppendDailyNoteBlockResponse> 
   */
  appendDailyNoteBlock(params: BlockAppendDailyNoteBlockParams): Promise<BlockAppendDailyNoteBlockResponse>;

  /**
   * 批量更新多个块的内容。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockBatchUpdateBlockParams)
   * @returns Promise<BlockBatchUpdateBlockResponse> 
   */
  batchUpdateBlock(params: BlockBatchUpdateBlockParams): Promise<BlockBatchUpdateBlockResponse>;

  /**
   * 检查指定的块ID是否存在。
   * (Requires authentication)
   * @param params Request parameters (BlockCheckBlockExistParams)
   * @returns Promise<BlockCheckBlockExistResponse> 
   */
  checkBlockExist(params: BlockCheckBlockExistParams): Promise<BlockCheckBlockExistResponse>;

  /**
   * 检查指定的块ID是否已折叠，并返回其是否为根块。
   * (Requires authentication)
   * @param params Request parameters (BlockCheckBlockFoldParams)
   * @returns Promise<BlockCheckBlockFoldResponse> 
   */
  checkBlockFold(params: BlockCheckBlockFoldParams): Promise<BlockCheckBlockFoldResponse>;

  /**
   * 检查一批块ID的引用状态（例如，是否被其他块引用，是否定义了其他块等）。
   * (Requires authentication)
   * @param params Request parameters (BlockCheckBlockRefParams)
   * @returns Promise<BlockCheckBlockRefResponse> 
   */
  checkBlockRef(params: BlockCheckBlockRefParams): Promise<BlockCheckBlockRefResponse>;

  /**
   * 删除指定的块ID。此操作通过事务完成。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockDeleteBlockParams)
   * @returns Promise<BlockDeleteBlockResponse> 
   */
  deleteBlock(params: BlockDeleteBlockParams): Promise<BlockDeleteBlockResponse>;

  /**
   * 折叠指定的块ID。对于标题块，执行 foldHeading 操作；对于其他类型的块，设置其 fold 属性。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockFoldBlockParams)
   * @returns Promise<BlockFoldBlockResponse> 
   */
  foldBlock(params: BlockFoldBlockParams): Promise<BlockFoldBlockResponse>;

  /**
   * 获取指定块ID到其根块（通常是文档块）的面包屑路径，可以排除特定类型的块。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockBreadcrumbParams)
   * @returns Promise<BlockGetBlockBreadcrumbResponse> 
   */
  getBlockBreadcrumb(params: BlockGetBlockBreadcrumbParams): Promise<BlockGetBlockBreadcrumbResponse>;

  /**
   * 获取指定块ID的DOM表示（HTML字符串）。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockDOMParams)
   * @returns Promise<BlockGetBlockDOMResponse> 
   */
  getBlockDOM(params: BlockGetBlockDOMParams): Promise<BlockGetBlockDOMResponse>;

  /**
   * 根据引用文本（锚文本）搜索并返回其可能指向的块定义ID列表。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockDefIDsByRefTextParams)
   * @returns Promise<BlockGetBlockDefIDsByRefTextResponse> 
   */
  getBlockDefIDsByRefText(params: BlockGetBlockDefIDsByRefTextParams): Promise<BlockGetBlockDefIDsByRefTextResponse>;

  /**
   * 获取指定块ID在其父级块的子块列表中的位置索引（从0开始）。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockIndexParams)
   * @returns Promise<BlockGetBlockIndexResponse> 
   */
  getBlockIndex(params: BlockGetBlockIndexParams): Promise<BlockGetBlockIndexResponse>;

  /**
   * 获取指定块ID的详细信息，包括其所在的笔记本ID(box)、路径(path)、根块ID(rootID)、根块标题(rootTitle)、根块图标(rootIcon)以及其在根块下的直接子块ID(rootChildID)。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockInfoParams)
   * @returns Promise<BlockGetBlockInfoResponse> 
   */
  getBlockInfo(params: BlockGetBlockInfoParams): Promise<BlockGetBlockInfoResponse>;

  /**
   * 获取指定块ID的Kramdown源码表示。可选模式：'md'（Markdown标记符模式，默认）或 'textmark'（文本标记模式，使用span标签）。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockKramdownParams)
   * @returns Promise<BlockGetBlockKramdownResponse> 
   */
  getBlockKramdown(params: BlockGetBlockKramdownParams): Promise<BlockGetBlockKramdownResponse>;

  /**
   * 获取指定块ID的父块ID、上一个同级块ID和下一个同级块ID。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockSiblingIDParams)
   * @returns Promise<BlockGetBlockSiblingIDResponse> 
   */
  getBlockSiblingID(params: BlockGetBlockSiblingIDParams): Promise<BlockGetBlockSiblingIDResponse>;

  /**
   * 批量获取指定块ID列表对应的块树（BlockTree）信息。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlockTreeInfosParams)
   * @returns Promise<BlockGetBlockTreeInfosResponse> 
   */
  getBlockTreeInfos(params: BlockGetBlockTreeInfosParams): Promise<BlockGetBlockTreeInfosResponse>;

  /**
   * 批量获取指定块ID列表各自在其父级块的子块列表中的位置索引。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlocksIndexesParams)
   * @returns Promise<BlockGetBlocksIndexesResponse> 
   */
  getBlocksIndexes(params: BlockGetBlocksIndexesParams): Promise<BlockGetBlocksIndexesResponse>;

  /**
   * 获取指定块ID列表的总字数、字符数和链接数统计信息。
   * (Requires authentication)
   * @param params Request parameters (BlockGetBlocksWordCountParams)
   * @returns Promise<BlockGetBlocksWordCountResponse> 
   */
  getBlocksWordCount(params: BlockGetBlocksWordCountParams): Promise<BlockGetBlocksWordCountResponse>;

  /**
   * 获取指定块ID的所有直接子块的基本信息列表（仅包含ID和类型）。
   * (Requires authentication)
   * @param params Request parameters (BlockGetChildBlocksParams)
   * @returns Promise<BlockGetChildBlocksResponse> 
   */
  getChildBlocks(params: BlockGetChildBlocksParams): Promise<BlockGetChildBlocksResponse>;

  /**
   * 获取给定内容字符串的字数、字符数和链接数统计信息。
   * (Requires authentication)
   * @param params Request parameters (BlockGetContentWordCountParams)
   * @returns Promise<BlockGetContentWordCountResponse> 
   */
  getContentWordCount(params: BlockGetContentWordCountParams): Promise<BlockGetContentWordCountResponse>;

  /**
   * 提取给定DOM字符串中的纯文本内容。
   * (Requires authentication)
   * @param params Request parameters (BlockGetDOMTextParams)
   * @returns Promise<BlockGetDOMTextResponse> 
   */
  getDOMText(params: BlockGetDOMTextParams): Promise<BlockGetDOMTextResponse>;

  /**
   * 获取指定文档块ID的信息，包括其内容（DOM）、标题、图标、面包屑路径和是否为模板。
   * (Requires authentication)
   * @param params Request parameters (BlockGetDocInfoParams)
   * @returns Promise<BlockGetDocInfoResponse> 
   */
  getDocInfo(params: BlockGetDocInfoParams): Promise<BlockGetDocInfoResponse>;

  /**
   * 批量获取多个指定文档块ID的信息。
   * (Requires authentication)
   * @param params Request parameters (BlockGetDocsInfoParams)
   * @returns Promise<BlockGetDocsInfoResponse> 
   */
  getDocsInfo(params: BlockGetDocsInfoParams): Promise<BlockGetDocsInfoResponse>;

  /**
   * 获取指定标题块ID下的所有子孙块的DOM内容。
   * (Requires authentication)
   * @param params Request parameters (BlockGetHeadingChildrenDOMParams)
   * @returns Promise<BlockGetHeadingChildrenDOMResponse> 
   */
  getHeadingChildrenDOM(params: BlockGetHeadingChildrenDOMParams): Promise<BlockGetHeadingChildrenDOMResponse>;

  /**
   * 获取指定标题块ID下的所有子孙块的ID列表。
   * (Requires authentication)
   * @param params Request parameters (BlockGetHeadingChildrenIDsParams)
   * @returns Promise<BlockGetHeadingChildrenIDsResponse> 
   */
  getHeadingChildrenIDs(params: BlockGetHeadingChildrenIDsParams): Promise<BlockGetHeadingChildrenIDsResponse>;

  /**
   * 获取删除指定标题块（及其所有子孙块）所需的事务操作列表。此接口仅返回事务，不实际执行删除。
   * (Requires authentication)
   * @param params Request parameters (BlockGetHeadingDeleteTransactionParams)
   * @returns Promise<BlockGetHeadingDeleteTransactionResponse> 
   */
  getHeadingDeleteTransaction(params: BlockGetHeadingDeleteTransactionParams): Promise<BlockGetHeadingDeleteTransactionResponse>;

  /**
   * 获取调整指定标题块级别所需的事务操作列表。此接口仅返回事务，不实际执行调整。
   * (Requires authentication)
   * @param params Request parameters (BlockGetHeadingLevelTransactionParams)
   * @returns Promise<BlockGetHeadingLevelTransactionResponse> 
   */
  getHeadingLevelTransaction(params: BlockGetHeadingLevelTransactionParams): Promise<BlockGetHeadingLevelTransactionResponse>;

  /**
   * 获取最近更新的块列表，按更新时间倒序排列。
   * (Requires authentication)
   * @returns Promise<BlockGetRecentUpdatedBlocksResponse> 
   */
  getRecentUpdatedBlocks(): Promise<BlockGetRecentUpdatedBlocksResponse>;

  /**
   * 获取指定块ID所引用的所有定义块的ID列表。
   * (Requires authentication)
   * @param params Request parameters (BlockGetRefIDsParams)
   * @returns Promise<BlockGetRefIDsResponse> 
   */
  getRefIDs(params: BlockGetRefIDsParams): Promise<BlockGetRefIDsResponse>;

  /**
   * 根据文件注解块的ID，查找与该注解相关的引用块ID和定义块ID。
   * (Requires authentication)
   * @param params Request parameters (BlockGetRefIDsByFileAnnotationIDParams)
   * @returns Promise<BlockGetRefIDsByFileAnnotationIDResponse> 
   */
  getRefIDsByFileAnnotationID(params: BlockGetRefIDsByFileAnnotationIDParams): Promise<BlockGetRefIDsByFileAnnotationIDResponse>;

  /**
   * 获取指定引用块ID的锚文本内容。
   * (Requires authentication)
   * @param params Request parameters (BlockGetRefTextParams)
   * @returns Promise<BlockGetRefTextResponse> 
   */
  getRefText(params: BlockGetRefTextParams): Promise<BlockGetRefTextResponse>;

  /**
   * 获取指定块ID的尾部（最后）指定数量的直接子块的基本信息。
   * (Requires authentication)
   * @param params Request parameters (BlockGetTailChildBlocksParams)
   * @returns Promise<BlockGetTailChildBlocksResponse> 
   */
  getTailChildBlocks(params: BlockGetTailChildBlocksParams): Promise<BlockGetTailChildBlocksResponse>;

  /**
   * 获取指定块ID（通常是文档块）的树结构统计信息，如各种类型子块的数量等。
   * (Requires authentication)
   * @param params Request parameters (BlockGetTreeStatParams)
   * @returns Promise<BlockGetTreeStatResponse> 
   */
  getTreeStat(params: BlockGetTreeStatParams): Promise<BlockGetTreeStatResponse>;

  /**
   * 向上查找指定块ID的父块链，返回最近的一个已展开（未折叠）的父块ID。
   * (Requires authentication)
   * @param params Request parameters (BlockGetUnfoldedParentIDParams)
   * @returns Promise<BlockGetUnfoldedParentIDResponse> 
   */
  getUnfoldedParentID(params: BlockGetUnfoldedParentIDParams): Promise<BlockGetUnfoldedParentIDResponse>;

  /**
   * 在指定的锚点块（anchorID）之前或之后插入新的内容块。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockInsertBlockParams)
   * @returns Promise<BlockInsertBlockResponse> 
   */
  insertBlock(params: BlockInsertBlockParams): Promise<BlockInsertBlockResponse>;

  /**
   * 在指定父块的开头插入新的子块。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockPrependBlockParams)
   * @returns Promise<BlockPrependBlockResponse> 
   */
  prependBlock(params: BlockPrependBlockParams): Promise<BlockPrependBlockResponse>;

  /**
   * 为指定的块ID设置一个提醒时间。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockSetBlockReminderParams)
   * @returns Promise<BlockSetBlockReminderResponse> 
   */
  setBlockReminder(params: BlockSetBlockReminderParams): Promise<BlockSetBlockReminderResponse>;

  /**
   * 交换指定的引用块和其指向的定义块的角色。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockSwapBlockRefParams)
   * @returns Promise<BlockSwapBlockRefResponse> 
   */
  swapBlockRef(params: BlockSwapBlockRefParams): Promise<BlockSwapBlockRefResponse>;

  /**
   * 将原块（fromID）的所有引用关系（或指定的引用关系 refIDs）转移到目标块（toID）。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockTransferBlockRefParams)
   * @returns Promise<BlockTransferBlockRefResponse> 
   */
  transferBlockRef(params: BlockTransferBlockRefParams): Promise<BlockTransferBlockRefResponse>;

  /**
   * 展开指定的块ID。对于标题块，执行 unfoldHeading 操作；对于其他类型的块，设置其 fold 属性为 false。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockUnfoldBlockParams)
   * @returns Promise<BlockUnfoldBlockResponse> 
   */
  unfoldBlock(params: BlockUnfoldBlockParams): Promise<BlockUnfoldBlockResponse>;

  /**
   * 更新指定块ID的内容。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockUpdateBlockParams)
   * @returns Promise<BlockUpdateBlockResponse> 
   */
  updateBlock(params: BlockUpdateBlockParams): Promise<BlockUpdateBlockResponse>;

  /**
   * 在指定笔记本的当日日记文档开头追加新的内容块。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockPrependDailyNoteBlockParams)
   * @returns Promise<BlockPrependDailyNoteBlockResponse> 
   */
  prependDailyNoteBlock(params: BlockPrependDailyNoteBlockParams): Promise<BlockPrependDailyNoteBlockResponse>;

  /**
   * 将指定的块移动到新的父块下或同级块的特定位置。移动后会触发相关文档编辑器的重载。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockMoveBlockParams)
   * @returns Promise<BlockMoveBlockResponse> 
   */
  moveBlock(params: BlockMoveBlockParams): Promise<BlockMoveBlockResponse>;

  /**
   * 移动大纲中的标题块到新的父级或同级位置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BlockMoveOutlineHeadingParams)
   * @returns Promise<BlockMoveOutlineHeadingResponse> 
   */
  moveOutlineHeading(params: BlockMoveOutlineHeadingParams): Promise<BlockMoveOutlineHeadingResponse>;

}

export interface BookmarkApi {
  /**
   * 构建并返回当前工作空间的所有书签列表。书签是为块设置的特定名称，方便快速访问。
   * (Requires authentication)
   * @returns Promise<BookmarkGetBookmarkResponse> 
   */
  getBookmark(): Promise<BookmarkGetBookmarkResponse>;

  /**
   * 根据书签名称（即块的 IAL 中 bookmark 属性的值）移除一个或多个书签。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BookmarkRemoveBookmarkParams)
   * @returns Promise<BookmarkRemoveBookmarkResponse> 
   */
  removeBookmark(params: BookmarkRemoveBookmarkParams): Promise<BookmarkRemoveBookmarkResponse>;

  /**
   * 将具有特定旧书签名称（块 IAL 中 bookmark 属性的旧值）的所有书签重命名为一个新的书签名称。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (BookmarkRenameBookmarkParams)
   * @returns Promise<BookmarkRenameBookmarkResponse> 
   */
  renameBookmark(params: BookmarkRenameBookmarkParams): Promise<BookmarkRenameBookmarkResponse>;

}

export interface BroadcastApi {
  /**
   * 获取指定名称的广播频道的详细信息，如订阅者数量。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (BroadcastGetChannelInfoParams)
   * @returns Promise<BroadcastGetChannelInfoResponse> 
   */
  getChannelInfo(params: BroadcastGetChannelInfoParams): Promise<BroadcastGetChannelInfoResponse>;

  /**
   * 获取当前所有活跃的广播频道及其订阅者数量的列表。
   * (Requires authentication, Requires admin role)
   * @returns Promise<BroadcastGetChannelsResponse> 
   */
  getChannels(): Promise<BroadcastGetChannelsResponse>;

  /**
   * 向指定的广播频道发送文本消息。也可以用于发送特定命令 (cmd)。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (BroadcastPostMessageParams)
   * @returns Promise<BroadcastPostMessageResponse> 
   */
  postMessage(params: BroadcastPostMessageParams): Promise<BroadcastPostMessageResponse>;

  /**
   * 向指定的广播频道发布消息。可以是文本消息，也可以通过上传文件发布二进制消息。请求体应为 multipart/form-data。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (BroadcastBroadcastPublishParams)
   * @returns Promise<BroadcastBroadcastPublishResponse> 
   */
  broadcastPublish(params: BroadcastBroadcastPublishParams): Promise<BroadcastBroadcastPublishResponse>;

}

export interface ClipboardApi {
  /**
   * 从系统剪贴板中读取文件路径列表。注意：在 Linux 上此功能可能受限或不可用。
   * (Requires authentication, Requires admin role)
   * @returns Promise<ClipboardReadFilePathsResponse> 
   */
  readFilePaths(): Promise<ClipboardReadFilePathsResponse>;

}

export interface CloudApi {
  /**
   * 获取用户的云端存储空间使用情况、流量消耗以及同步和备份状态等信息。
   * (Requires authentication, Requires admin role)
   * @returns Promise<CloudGetCloudSpaceResponse> 
   */
  getCloudSpace(): Promise<CloudGetCloudSpaceResponse>;

}

export interface ConvertApi {
  /**
   * 调用系统安装的 Pandoc 工具进行文档格式转换。需要提供 Pandoc 命令行参数。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (ConvertPandocParams)
   * @returns Promise<ConvertPandocResponse> 
   */
  pandoc(params: ConvertPandocParams): Promise<ConvertPandocResponse>;

}

export interface ExportApi {
  /**
   * 将指定的文档内容导出到链滴社区。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (ExportExport2LiandiParams)
   * @returns Promise<ExportExport2LiandiResponse> 
   */
  export2Liandi(params: ExportExport2LiandiParams): Promise<ExportExport2LiandiResponse>;

  /**
   * 接收上传的文件，将其保存到临时导出目录，并返回处理后的文件名及可访问路径。通常用于'另存为'等场景。文件通过 FormData 的 'file' 字段上传。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportAsFileParams)
   * @returns Promise<ExportExportAsFileResponse> 
   */
  exportAsFile(params: ExportExportAsFileParams): Promise<ExportExportAsFileResponse>;

  /**
   * 将指定的文档导出为 AsciiDoc 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportAsciiDocParams)
   * @returns Promise<ExportExportAsciiDocResponse> 
   */
  exportAsciiDoc(params: ExportExportAsciiDocParams): Promise<ExportExportAsciiDocResponse>;

  /**
   * 将指定的属性视图导出为 CSV 压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportAttributeViewParams)
   * @returns Promise<ExportExportAttributeViewResponse> 
   */
  exportAttributeView(params: ExportExportAttributeViewParams): Promise<ExportExportAttributeViewResponse>;

  /**
   * 导出当前工作空间的全部数据为一个 .zip 压缩文件。
   * (Requires authentication, Requires admin role)
   * @returns Promise<ExportExportDataResponse> 
   */
  exportData(): Promise<ExportExportDataResponse>;

  /**
   * 导出指定文件夹内的所有数据为一个压缩包。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportDataInFolderParams)
   * @returns Promise<ExportExportDataInFolderResponse> 
   */
  exportDataInFolder(params: ExportExportDataInFolderParams): Promise<ExportExportDataInFolderResponse>;

  /**
   * 将指定的文档导出为 DOCX (.docx) 文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportDocxParams)
   * @returns Promise<ExportExportDocxResponse> 
   */
  exportDocx(params: ExportExportDocxParams): Promise<ExportExportDocxResponse>;

  /**
   * 将指定的文档导出为 EPUB 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportEPUBParams)
   * @returns Promise<ExportExportEPUBResponse> 
   */
  exportEPUB(params: ExportExportEPUBParams): Promise<ExportExportEPUBResponse>;

  /**
   * 将指定文档导出为标准的、包含完整思源主题样式和脚本的 HTML 内容，通常用于生成可独立浏览的 HTML 文件或作为导出 PDF 的中间步骤。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportHTMLParams)
   * @returns Promise<ExportExportHTMLResponse> 
   */
  exportHTML(params: ExportExportHTMLParams): Promise<ExportExportHTMLResponse>;

  /**
   * 将指定的单个文档导出为 Markdown 文件，并打包成一个 .zip 压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportMdParams)
   * @returns Promise<ExportExportMdResponse> 
   */
  exportMd(params: ExportExportMdParams): Promise<ExportExportMdResponse>;

  /**
   * 获取指定文档的 Markdown 文本内容，可自定义块引用和嵌入块的处理方式以及是否包含 YAML Front Matter。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportMdContentParams)
   * @returns Promise<ExportExportMdContentResponse> 
   */
  exportMdContent(params: ExportExportMdContentParams): Promise<ExportExportMdContentResponse>;

  /**
   * 获取指定文档渲染后的纯 HTML 内容（不包含完整主题样式和脚本，主要用于内容嵌入）。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportMdHTMLParams)
   * @returns Promise<ExportExportMdHTMLResponse> 
   */
  exportMdHTML(params: ExportExportMdHTMLParams): Promise<ExportExportMdHTMLResponse>;

  /**
   * 将指定的多个文档分别导出为 Markdown 文件，并打包成一个 .zip 压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportMdsParams)
   * @returns Promise<ExportExportMdsResponse> 
   */
  exportMds(params: ExportExportMdsParams): Promise<ExportExportMdsResponse>;

  /**
   * 将指定的文档导出为 MediaWiki 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportMediaWikiParams)
   * @returns Promise<ExportExportMediaWikiResponse> 
   */
  exportMediaWiki(params: ExportExportMediaWikiParams): Promise<ExportExportMediaWikiResponse>;

  /**
   * 将指定的笔记本导出为 Markdown 格式的 .zip 压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportNotebookMdParams)
   * @returns Promise<ExportExportNotebookMdResponse> 
   */
  exportNotebookMd(params: ExportExportNotebookMdParams): Promise<ExportExportNotebookMdResponse>;

  /**
   * 将指定的笔记本导出为思源原生 .sy 格式的压缩包。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportNotebookSYParams)
   * @returns Promise<ExportExportNotebookSYResponse> 
   */
  exportNotebookSY(params: ExportExportNotebookSYParams): Promise<ExportExportNotebookSYResponse>;

  /**
   * 将指定的文档导出为 ODT 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportODTParams)
   * @returns Promise<ExportExportODTResponse> 
   */
  exportODT(params: ExportExportODTParams): Promise<ExportExportODTResponse>;

  /**
   * 将指定的文档导出为 OPML 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportOPMLParams)
   * @returns Promise<ExportExportOPMLResponse> 
   */
  exportOPML(params: ExportExportOPMLParams): Promise<ExportExportOPMLResponse>;

  /**
   * 将指定的文档导出为 Org-mode 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportOrgModeParams)
   * @returns Promise<ExportExportOrgModeResponse> 
   */
  exportOrgMode(params: ExportExportOrgModeParams): Promise<ExportExportOrgModeResponse>;

  /**
   * 获取指定文档用于预览的 HTML 内容，包含块属性、类型等更丰富的上下文信息，并处理了块引链接。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportPreviewHTMLParams)
   * @returns Promise<ExportExportPreviewHTMLResponse> 
   */
  exportPreviewHTML(params: ExportExportPreviewHTMLParams): Promise<ExportExportPreviewHTMLResponse>;

  /**
   * 将指定的文档导出为 RTF 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportRTFParams)
   * @returns Promise<ExportExportRTFResponse> 
   */
  exportRTF(params: ExportExportRTFParams): Promise<ExportExportRTFResponse>;

  /**
   * 将指定的文档导出为 reStructuredText 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportReStructuredTextParams)
   * @returns Promise<ExportExportReStructuredTextResponse> 
   */
  exportReStructuredText(params: ExportExportReStructuredTextParams): Promise<ExportExportReStructuredTextResponse>;

  /**
   * 将指定路径列表的文件或文件夹打包导出为一个 .zip 压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportResourcesParams)
   * @returns Promise<ExportExportResourcesResponse> 
   */
  exportResources(params: ExportExportResourcesParams): Promise<ExportExportResourcesResponse>;

  /**
   * 将指定的单个文档导出为思源原生 .sy 格式的压缩包。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportSYParams)
   * @returns Promise<ExportExportSYResponse> 
   */
  exportSY(params: ExportExportSYParams): Promise<ExportExportSYResponse>;

  /**
   * 将传入的 Markdown 内容保存为临时文件，并根据参数生成预览（HTML/PDF/图片），返回预览的 URL。注意：此接口在 `export.go` 中并未完整实现所有参数的逻辑（如 mode, theme, title, type, css, js 均未实际使用），主要实现了 content 的临时保存和URL返回。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportTempContentParams)
   * @returns Promise<ExportExportTempContentResponse> 
   */
  exportTempContent(params: ExportExportTempContentParams): Promise<ExportExportTempContentResponse>;

  /**
   * 将指定的文档导出为 Textile 格式的压缩文件。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportExportTextileParams)
   * @returns Promise<ExportExportTextileResponse> 
   */
  exportTextile(params: ExportExportTextileParams): Promise<ExportExportTextileResponse>;

  /**
   * 获取指定文档的完整 HTML 预览内容，包含标准主题和脚本，可直接用于浏览器展示。
   * (Requires authentication)
   * @param params Request parameters (ExportExportPreviewParams)
   * @returns Promise<ExportExportPreviewResponse> 
   */
  exportPreview(params: ExportExportPreviewParams): Promise<ExportExportPreviewResponse>;

  /**
   * 对已生成的用于 PDF 导出的 HTML 文件进行后处理，如添加水印等。通常在调用 exportHTML (pdf=true) 之后使用。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (ExportProcessPDFParams)
   * @returns Promise<ExportProcessPDFResponse> 
   */
  processPDF(params: ExportProcessPDFParams): Promise<ExportProcessPDFResponse>;

}

export interface ExtensionApi {
  /**
   * 处理来自浏览器扩展（如剪藏）复制过来的内容。将 HTML DOM 转换为 Markdown，并处理其中包含的图片等资源，将其保存到指定的笔记本或默认的 assets 目录。支持从链滴剪藏时直接获取 Markdown。这是一个 multipart/form-data 请求，除了明确定义的字段外，还可以包含多个文件字段。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (ExtensionExtensionCopyParams)
   * @returns Promise<ExtensionExtensionCopyResponse> 
   */
  extensionCopy(params: ExtensionExtensionCopyParams): Promise<ExtensionExtensionCopyResponse>;

}

export interface FileApi {
  /**
   * 复制工作空间内的单个文件或资源文件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FileCopyFileParams)
   * @returns Promise<FileCopyFileResponse> 
   */
  copyFile(params: FileCopyFileParams): Promise<FileCopyFileResponse>;

  /**
   * 获取指定路径的文件内容。注意：此接口不通过JSON返回文件内容，而是直接在HTTP响应体中返回文件数据流，Content-Type 根据文件类型确定。因此，zodResponseSchema 仅用于描述可能的错误情况下的JSON响应。成功获取文件时，HTTP状态码为200，响应体为文件内容。
   * (Requires authentication)
   * @param params Request parameters (FileGetFileParams)
   * @returns Promise<FileGetFileResponse> 
   */
  getFile(params: FileGetFileParams): Promise<FileGetFileResponse>;

  /**
   * 根据输入的文件路径，生成一个在目标位置唯一的、不冲突的文件名版本。例如，输入 'assets/image.png'，如果已存在，则可能返回 'assets/image_1.png'。
   * (Requires authentication)
   * @param params Request parameters (FileGetUniqueFilenameParams)
   * @returns Promise<FileGetUniqueFilenameResponse> 
   */
  getUniqueFilename(params: FileGetUniqueFilenameParams): Promise<FileGetUniqueFilenameResponse>;

  /**
   * 将多个源文件复制到指定的目标目录 (相对于工作空间)。源文件路径必须是绝对路径。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FileGlobalCopyFilesParams)
   * @returns Promise<FileGlobalCopyFilesResponse> 
   */
  globalCopyFiles(params: FileGlobalCopyFilesParams): Promise<FileGlobalCopyFilesResponse>;

  /**
   * 上传文件或创建目录。这是一个 multipart/form-data 请求。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FilePutFileParams)
   * @returns Promise<FilePutFileResponse> 
   */
  putFile(params: FilePutFileParams): Promise<FilePutFileResponse>;

  /**
   * 读取指定目录下的文件和子目录列表。
   * (Requires authentication)
   * @param params Request parameters (FileReadDirParams)
   * @returns Promise<FileReadDirResponse> 
   */
  readDir(params: FileReadDirParams): Promise<FileReadDirResponse>;

  /**
   * 移除指定路径的文件或目录。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FileRemoveFileParams)
   * @returns Promise<FileRemoveFileResponse> 
   */
  removeFile(params: FileRemoveFileParams): Promise<FileRemoveFileResponse>;

  /**
   * 重命名指定路径的文件或目录。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FileRenameFileParams)
   * @returns Promise<FileRenameFileResponse> 
   */
  renameFile(params: FileRenameFileParams): Promise<FileRenameFileResponse>;

}

export interface FiletreeApi {
  /**
   * 更改指定笔记本下，特定路径列表的文档树排序方式。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeChangeSortParams)
   * @returns Promise<FiletreeChangeSortResponse> 
   */
  changeSort(params: FiletreeChangeSortParams): Promise<FiletreeChangeSortResponse>;

  /**
   * 根据用户配置的日记模板创建今日的日记文档。如果今日的日记已存在，则直接返回该日记的信息。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeCreateDailyNoteParams)
   * @returns Promise<FiletreeCreateDailyNoteResponse> 
   */
  createDailyNote(params: FiletreeCreateDailyNoteParams): Promise<FiletreeCreateDailyNoteResponse>;

  /**
   * 在指定的笔记本和路径下创建一个新的文档，并可以附带初始Markdown内容和排序信息。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeCreateDocParams)
   * @returns Promise<FiletreeCreateDocResponse> 
   */
  createDoc(params: FiletreeCreateDocParams): Promise<FiletreeCreateDocResponse>;

  /**
   * 在指定笔记本、路径下，使用提供的Markdown内容创建一个新文档。可以指定父文档ID、新文档ID、标签等。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeCreateDocWithMdParams)
   * @returns Promise<FiletreeCreateDocWithMdResponse> 
   */
  createDocWithMd(params: FiletreeCreateDocWithMdParams): Promise<FiletreeCreateDocWithMdResponse>;

  /**
   * 将一个源文档的内容转换为一个标题块，并将其插入到目标文档的指定标题块之后或之前。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeDoc2HeadingParams)
   * @returns Promise<FiletreeDoc2HeadingResponse> 
   */
  doc2Heading(params: FiletreeDoc2HeadingParams): Promise<FiletreeDoc2HeadingResponse>;

  /**
   * 复制（克隆）一个指定的文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeDuplicateDocParams)
   * @returns Promise<FiletreeDuplicateDocResponse> 
   */
  duplicateDoc(params: FiletreeDuplicateDocParams): Promise<FiletreeDuplicateDocResponse>;

  /**
   * 获取指定文档（或文档中的一部分内容）的详细信息，包括块内容、结构、属性等。支持多种加载模式和查询参数。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetDocParams)
   * @returns Promise<FiletreeGetDocResponse> 
   */
  getDoc(params: FiletreeGetDocParams): Promise<FiletreeGetDocResponse>;

  /**
   * 根据当前笔记本和全局配置，计算并返回创建新文档时应使用的默认笔记本ID和保存路径 (HPath)。路径支持Go模板。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetDocCreateSavePathParams)
   * @returns Promise<FiletreeGetDocCreateSavePathResponse> 
   */
  getDocCreateSavePath(params: FiletreeGetDocCreateSavePathParams): Promise<FiletreeGetDocCreateSavePathResponse>;

  /**
   * 根据文档或块的ID，获取其在笔记本中的完整层级标题路径 (HPath)，例如 '/父文档标题/子文档标题/当前文档标题'。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetFullHPathByIDParams)
   * @returns Promise<FiletreeGetFullHPathByIDResponse> 
   */
  getFullHPathByID(params: FiletreeGetFullHPathByIDParams): Promise<FiletreeGetFullHPathByIDResponse>;

  /**
   * 根据文档或块的ID，获取其在笔记本中的人类可读路径 (HPath)，即文件路径形式的标题路径，例如 '/父文档标题/子文档标题/当前文档标题.sy' 的 Sy 文件名部分。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetHPathByIDParams)
   * @returns Promise<FiletreeGetHPathByIDResponse> 
   */
  getHPathByID(params: FiletreeGetHPathByIDParams): Promise<FiletreeGetHPathByIDResponse>;

  /**
   * 根据文档在笔记本中的实际存储路径 (相对于笔记本根目录)，获取其人类可读路径 (HPath)。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetHPathByPathParams)
   * @returns Promise<FiletreeGetHPathByPathResponse> 
   */
  getHPathByPath(params: FiletreeGetHPathByPathParams): Promise<FiletreeGetHPathByPathResponse>;

  /**
   * 根据一组文档的实际存储路径 (包含笔记本ID和文档相对路径)，批量获取它们对应的人类可读路径 (HPath)。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetHPathsByPathsParams)
   * @returns Promise<FiletreeGetHPathsByPathsResponse> 
   */
  getHPathsByPaths(params: FiletreeGetHPathsByPathsParams): Promise<FiletreeGetHPathsByPathsResponse>;

  /**
   * 根据文档的人类可读路径 (HPath) 和其所在的笔记本ID，获取所有匹配该路径的文档的ID列表。因为HPath可能不唯一，所以返回的是数组。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetIDsByHPathParams)
   * @returns Promise<FiletreeGetIDsByHPathResponse> 
   */
  getIDsByHPath(params: FiletreeGetIDsByHPathParams): Promise<FiletreeGetIDsByHPathResponse>;

  /**
   * 根据文档或块的ID，获取其在工作空间中的实际存储路径 (相对于笔记本根目录) 和所在的笔记本ID。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetPathByIDParams)
   * @returns Promise<FiletreeGetPathByIDResponse> 
   */
  getPathByID(params: FiletreeGetPathByIDParams): Promise<FiletreeGetPathByIDResponse>;

  /**
   * 根据当前笔记本和全局配置，计算并返回创建新块引文档时应使用的默认笔记本ID和保存路径 (HPath)。路径支持Go模板。
   * (Requires authentication)
   * @param params Request parameters (FiletreeGetRefCreateSavePathParams)
   * @returns Promise<FiletreeGetRefCreateSavePathResponse> 
   */
  getRefCreateSavePath(params: FiletreeGetRefCreateSavePathParams): Promise<FiletreeGetRefCreateSavePathResponse>;

  /**
   * 将源文档中的一个标题块及其后续同级内容，转换为一个新的独立文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeHeading2DocParams)
   * @returns Promise<FiletreeHeading2DocResponse> 
   */
  heading2Doc(params: FiletreeHeading2DocParams): Promise<FiletreeHeading2DocResponse>;

  /**
   * 将源文档中的一个列表项（及其所有子项）转换为一个新的独立文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeLi2DocParams)
   * @returns Promise<FiletreeLi2DocResponse> 
   */
  li2Doc(params: FiletreeLi2DocParams): Promise<FiletreeLi2DocResponse>;

  /**
   * 列出指定笔记本的文档树结构，支持过滤、排序等。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeListDocTreeParams)
   * @returns Promise<FiletreeListDocTreeResponse> 
   */
  listDocTree(params: FiletreeListDocTreeParams): Promise<FiletreeListDocTreeResponse>;

  /**
   * 获取指定笔记本和路径下的文档及子文件夹列表，支持排序、闪卡过滤和数量限制。
   * (Requires authentication)
   * @param params Request parameters (FiletreeListDocsByPathParams)
   * @returns Promise<FiletreeListDocsByPathResponse> 
   */
  listDocsByPath(params: FiletreeListDocsByPathParams): Promise<FiletreeListDocsByPathResponse>;

  /**
   * 将一组源文档（通过其在各自笔记本中的相对路径指定）移动到目标笔记本的指定路径下。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeMoveDocsParams)
   * @returns Promise<FiletreeMoveDocsResponse> 
   */
  moveDocs(params: FiletreeMoveDocsParams): Promise<FiletreeMoveDocsResponse>;

  /**
   * 将一组源文档（通过其ID指定）移动到目标文档（通过其ID指定）的目录下或成为其子文档（取决于目标ID是文件夹还是文件）。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeMoveDocsByIDParams)
   * @returns Promise<FiletreeMoveDocsByIDResponse> 
   */
  moveDocsByID(params: FiletreeMoveDocsByIDParams): Promise<FiletreeMoveDocsByIDResponse>;

  /**
   * 将指定笔记本中的本地闪念速记（通常是未整理的、直接记录在本地的摘录或想法）移动到配置的闪念速记存放位置。这是一个待改进的旧接口，未来可能基于文档树配置实现。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeMoveLocalShorthandsParams)
   * @returns Promise<FiletreeMoveLocalShorthandsResponse> 
   */
  moveLocalShorthands(params: FiletreeMoveLocalShorthandsParams): Promise<FiletreeMoveLocalShorthandsResponse>;

  /**
   * 触发一次全局的文档树刷新和全量索引重建。这是一个耗时操作，请谨慎调用。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<FiletreeRefreshFiletreeResponse> 
   */
  refreshFiletree(): Promise<FiletreeRefreshFiletreeResponse>;

  /**
   * 根据指定的笔记本ID和文档相对路径，移除（删除）该文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeRemoveDocParams)
   * @returns Promise<FiletreeRemoveDocResponse> 
   */
  removeDoc(params: FiletreeRemoveDocParams): Promise<FiletreeRemoveDocResponse>;

  /**
   * 根据指定的文档ID，移除（删除）该文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeRemoveDocByIDParams)
   * @returns Promise<FiletreeRemoveDocByIDResponse> 
   */
  removeDocByID(params: FiletreeRemoveDocByIDParams): Promise<FiletreeRemoveDocByIDResponse>;

  /**
   * 根据一组复合路径（包含笔记本ID和文档相对路径）批量移除（删除）文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeRemoveDocsParams)
   * @returns Promise<FiletreeRemoveDocsResponse> 
   */
  removeDocs(params: FiletreeRemoveDocsParams): Promise<FiletreeRemoveDocsResponse>;

  /**
   * 根据指定的文档路径列表（通常是 .sy 文件路径），从搜索引擎中移除这些文档的索引。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeRemoveIndexesParams)
   * @returns Promise<FiletreeRemoveIndexesResponse> 
   */
  removeIndexes(params: FiletreeRemoveIndexesParams): Promise<FiletreeRemoveIndexesResponse>;

  /**
   * 根据指定的笔记本ID、旧文档相对路径和新标题，重命名该文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeRenameDocParams)
   * @returns Promise<FiletreeRenameDocResponse> 
   */
  renameDoc(params: FiletreeRenameDocParams): Promise<FiletreeRenameDocResponse>;

  /**
   * 根据指定的文档ID和新标题，重命名该文档。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeRenameDocByIDParams)
   * @returns Promise<FiletreeRenameDocByIDResponse> 
   */
  renameDocByID(params: FiletreeRenameDocByIDParams): Promise<FiletreeRenameDocByIDResponse>;

  /**
   * 根据关键词搜索匹配的文档标题和别名。主要用于快速查找文档，不支持全文搜索。
   * (Requires authentication)
   * @param params Request parameters (FiletreeSearchDocsParams)
   * @returns Promise<FiletreeSearchDocsResponse> 
   */
  searchDocs(params: FiletreeSearchDocsParams): Promise<FiletreeSearchDocsResponse>;

  /**
   * 根据指定的文档路径列表（通常是 .sy 文件路径），更新或插入这些文档在搜索引擎中的索引。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FiletreeUpsertIndexesParams)
   * @returns Promise<FiletreeUpsertIndexesResponse> 
   */
  upsertIndexes(params: FiletreeUpsertIndexesParams): Promise<FiletreeUpsertIndexesResponse>;

}

export interface FormatApi {
  /**
   * 为指定块ID的内容（Markdown原文）在中文与英文、数字之间自动添加空格，以优化排版。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FormatAutoSpaceParams)
   * @returns Promise<FormatAutoSpaceResponse> 
   */
  autoSpace(params: FormatAutoSpaceParams): Promise<FormatAutoSpaceResponse>;

  /**
   * 将指定块ID内的所有外部网络资源（如图片、附件等，但不包括仅被引用的网络图片链接）下载并转存为本地资源。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FormatNetAssets2LocalAssetsParams)
   * @returns Promise<FormatNetAssets2LocalAssetsResponse> 
   */
  netAssets2LocalAssets(params: FormatNetAssets2LocalAssetsParams): Promise<FormatNetAssets2LocalAssetsResponse>;

  /**
   * 将指定块ID内的网络图片（Markdown中实际嵌入的图片，非普通链接）转存为本地资源。可以指定单个图片URL进行转存，或留空以转存块内所有网络图片。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (FormatNetImg2LocalAssetsParams)
   * @returns Promise<FormatNetImg2LocalAssetsResponse> 
   */
  netImg2LocalAssets(params: FormatNetImg2LocalAssetsParams): Promise<FormatNetImg2LocalAssetsResponse>;

}

export interface GraphApi {
  /**
   * 根据关键词和配置获取全局关系图的节点和边数据。
   * (Requires authentication)
   * @param params Request parameters (GraphGetGraphParams)
   * @returns Promise<GraphGetGraphResponse> 
   */
  getGraph(params: GraphGetGraphParams): Promise<GraphGetGraphResponse>;

  /**
   * 根据指定的文档 ID、关键词和配置获取局部关系图（如文档关系图、反链关系图等）的节点和边数据。
   * (Requires authentication)
   * @param params Request parameters (GraphGetLocalGraphParams)
   * @returns Promise<GraphGetLocalGraphResponse> 
   */
  getLocalGraph(params: GraphGetLocalGraphParams): Promise<GraphGetLocalGraphResponse>;

  /**
   * 将全局关系图的配置恢复为默认设置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<GraphResetGraphResponse> 
   */
  resetGraph(): Promise<GraphResetGraphResponse>;

  /**
   * 将局部关系图的配置恢复为默认设置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<GraphResetLocalGraphResponse> 
   */
  resetLocalGraph(): Promise<GraphResetLocalGraphResponse>;

}

export interface HistoryApi {
  /**
   * 清空当前工作空间下的所有历史记录。这是一个耗时操作，执行前会有提示。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<HistoryClearWorkspaceHistoryResponse> 
   */
  clearWorkspaceHistory(): Promise<HistoryClearWorkspaceHistoryResponse>;

  /**
   * 获取指定文档历史版本的内容和相关信息。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (HistoryGetDocHistoryContentParams)
   * @returns Promise<HistoryGetDocHistoryContentResponse> 
   */
  getDocHistoryContent(params: HistoryGetDocHistoryContentParams): Promise<HistoryGetDocHistoryContentResponse>;

  /**
   * 根据创建日期、关键词等条件获取历史记录中的具体条目列表。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (HistoryGetHistoryItemsParams)
   * @returns Promise<HistoryGetHistoryItemsResponse> 
   */
  getHistoryItems(params: HistoryGetHistoryItemsParams): Promise<HistoryGetHistoryItemsResponse>;

  /**
   * 获取所有笔记本的历史记录信息。
   * (Requires authentication, Requires admin role)
   * @returns Promise<HistoryGetNotebookHistoryResponse> 
   */
  getNotebookHistory(): Promise<HistoryGetNotebookHistoryResponse>;

  /**
   * 重建整个工作空间的历史记录索引。这是一个后台异步操作。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<HistoryReindexHistoryResponse> 
   */
  reindexHistory(): Promise<HistoryReindexHistoryResponse>;

  /**
   * 将资源文件回滚到指定的历史版本。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (HistoryRollbackAssetsHistoryParams)
   * @returns Promise<HistoryRollbackAssetsHistoryResponse> 
   */
  rollbackAssetsHistory(params: HistoryRollbackAssetsHistoryParams): Promise<HistoryRollbackAssetsHistoryResponse>;

  /**
   * 将单个文档回滚到指定的历史版本。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (HistoryRollbackDocHistoryParams)
   * @returns Promise<HistoryRollbackDocHistoryResponse> 
   */
  rollbackDocHistory(params: HistoryRollbackDocHistoryParams): Promise<HistoryRollbackDocHistoryResponse>;

  /**
   * 将整个笔记本回滚到指定的历史版本。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (HistoryRollbackNotebookHistoryParams)
   * @returns Promise<HistoryRollbackNotebookHistoryResponse> 
   */
  rollbackNotebookHistory(params: HistoryRollbackNotebookHistoryParams): Promise<HistoryRollbackNotebookHistoryResponse>;

  /**
   * 根据关键词、笔记本、类型等分页搜索历史记录。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (HistorySearchHistoryParams)
   * @returns Promise<HistorySearchHistoryResponse> 
   */
  searchHistory(params: HistorySearchHistoryParams): Promise<HistorySearchHistoryResponse>;

}

export interface IconApi {
  /**
   * 根据参数动态生成一个SVG格式的日期或文字图标。此接口直接返回 SVG 图像数据。
   * @param params Request parameters (IconGetDynamicIconParams)
   * @returns Promise<any> 此接口不返回 JSON。成功时直接返回 image/svg+xml 类型的 SVG 图像数据 (HTTP 200)。失败时可能返回其他 HTTP 错误状态码。
   */
  getDynamicIcon(params: IconGetDynamicIconParams): Promise<any>;

}

export interface ImportApi {
  /**
   * 导入完整的数据包备份 (.zip)。此操作会覆盖当前工作空间的数据。请求体为 FormData，必须包含 'file' 字段，值为 .zip 数据包文件。由于是 FormData，具体字段不在 Zod schema 中定义。代码实现详见 kernel/api/import.go:importData。导入过程会将文件暂存并在处理后删除。注意：此操作会覆盖当前工作空间。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<ImportImportDataResponse> 
   */
  importData(): Promise<ImportImportDataResponse>;

  /**
   * 导入 .sy 文件 (思源笔记的标准文档/子文档包) 到指定的笔记本和路径下。请求体为 FormData。必须包含 'file' 字段 (值为 .sy.zip 文件), 'notebook' 字段 (目标笔记本ID), 'toPath' 字段 (目标文档父路径，例如 '/' 表示笔记本根目录)。由于是 FormData，具体字段不在 Zod schema 中定义。代码实现详见 kernel/api/import.go:importSY。导入过程会将文件暂存并在处理后删除。后台会显示进度。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<ImportImportSYResponse> 
   */
  importSY(): Promise<ImportImportSYResponse>;

  /**
   * 从本地文件系统导入标准 Markdown 文件或包含 Markdown 文件的文件夹到指定的笔记本和路径下。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (ImportImportStdMdParams)
   * @returns Promise<ImportImportStdMdResponse> 
   */
  importStdMd(params: ImportImportStdMdParams): Promise<ImportImportStdMdResponse>;

}

export interface InboxApi {
  /**
   * 根据ID获取单个云端速记条目的详细内容。速记内容会从 Markdown 转换为 HTML。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (InboxGetShorthandParams)
   * @returns Promise<InboxGetShorthandResponse> 
   */
  getShorthand(params: InboxGetShorthandParams): Promise<InboxGetShorthandResponse>;

  /**
   * 分页获取云端速记条目列表。速记内容会从 Markdown 转换为 HTML，描述会做简化处理。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (InboxGetShorthandsParams)
   * @returns Promise<InboxGetShorthandsResponse> 
   */
  getShorthands(params: InboxGetShorthandsParams): Promise<InboxGetShorthandsResponse>;

  /**
   * 根据ID列表批量移除云端速记条目。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (InboxRemoveShorthandsParams)
   * @returns Promise<InboxRemoveShorthandsResponse> 
   */
  removeShorthands(params: InboxRemoveShorthandsParams): Promise<InboxRemoveShorthandsResponse>;

}

export interface LuteApi {
  /**
   * 将指定ID的块内容导出为标准 Markdown 格式的字符串。
   * (Requires authentication)
   * @param params Request parameters (LuteCopyStdMarkdownParams)
   * @returns Promise<LuteCopyStdMarkdownResponse> 
   */
  copyStdMarkdown(params: LuteCopyStdMarkdownParams): Promise<LuteCopyStdMarkdownResponse>;

  /**
   * 将输入的 HTML 字符串转换为思源笔记的块级 DOM 结构 (仍为HTML字符串，但经过Lute处理)。会处理本地资源路径、空列表项、单列表格转段落等情况。
   * (Requires authentication)
   * @param params Request parameters (LuteHtml2BlockDOMParams)
   * @returns Promise<LuteHtml2BlockDOMResponse> 
   */
  html2BlockDOM(params: LuteHtml2BlockDOMParams): Promise<LuteHtml2BlockDOMResponse>;

  /**
   * 对传入的块级 DOM 字符串执行 Lute 引擎的 SpinBlockDOM 处理，进行原生渲染相关的优化。
   * (Requires authentication)
   * @param params Request parameters (LuteSpinBlockDOMParams)
   * @returns Promise<LuteSpinBlockDOMResponse> 
   */
  spinBlockDOM(params: LuteSpinBlockDOMParams): Promise<LuteSpinBlockDOMResponse>;

}

export interface MiscApi {
  /**
   * 通过 Server-Sent Events (SSE) 订阅一个或多个指定广播频道的消息。连接建立后，服务器会持续推送所订阅频道的消息。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (MiscBroadcastSubscribeParams)
   * @returns Promise<Record<string, never>> 
   */
  broadcastSubscribe(params: MiscBroadcastSubscribeParams): Promise<Record<string, never>>;

  /**
   * 通过 WebSocket 连接到指定的广播频道，用于双向实时通讯。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (MiscBroadcastParams)
   * @returns Promise<Record<string, never>> 
   */
  broadcast(params: MiscBroadcastParams): Promise<Record<string, never>>;

}

export interface NetworkApi {
  /**
   * 作为代理，将客户端构造的HTTP(S)请求转发到指定的目标URL，并返回目标服务器的响应。支持多种请求体编码方式。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (NetworkForwardProxyParams)
   * @returns Promise<NetworkForwardProxyResponse> 
   */
  forwardProxy(params: NetworkForwardProxyParams): Promise<NetworkForwardProxyResponse>;

}

export interface NotebookApi {
  /**
   * 批量更改笔记本的显示顺序。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookChangeSortNotebookParams)
   * @returns Promise<NotebookChangeSortNotebookResponse> 
   */
  changeSortNotebook(params: NotebookChangeSortNotebookParams): Promise<NotebookChangeSortNotebookResponse>;

  /**
   * 关闭一个指定的笔记本。关闭后，笔记本内容将不再可访问，直到再次打开。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookCloseNotebookParams)
   * @returns Promise<NotebookCloseNotebookResponse> 
   */
  closeNotebook(params: NotebookCloseNotebookParams): Promise<NotebookCloseNotebookResponse>;

  /**
   * 创建一个新的笔记本。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookCreateNotebookParams)
   * @returns Promise<NotebookCreateNotebookResponse> 
   */
  createNotebook(params: NotebookCreateNotebookParams): Promise<NotebookCreateNotebookResponse>;

  /**
   * 获取指定笔记本的配置信息。
   * (Requires authentication)
   * @param params Request parameters (NotebookGetNotebookConfParams)
   * @returns Promise<NotebookGetNotebookConfResponse> 
   */
  getNotebookConf(params: NotebookGetNotebookConfParams): Promise<NotebookGetNotebookConfResponse>;

  /**
   * 获取指定笔记本的详细信息，包括其配置和统计数据。
   * (Requires authentication, Unavailable in read-only mode)
   * @param params Request parameters (NotebookGetNotebookInfoParams)
   * @returns Promise<NotebookGetNotebookInfoResponse> 
   */
  getNotebookInfo(params: NotebookGetNotebookInfoParams): Promise<NotebookGetNotebookInfoResponse>;

  /**
   * 获取当前工作空间中所有笔记本的列表，包含已打开和未打开的笔记本。
   * (Requires authentication)
   * @returns Promise<NotebookLsNotebooksResponse> 
   */
  lsNotebooks(): Promise<NotebookLsNotebooksResponse>;

  /**
   * 打开一个指定的笔记本。如果笔记本已经是打开状态，此操作可能仅刷新其状态。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookOpenNotebookParams)
   * @returns Promise<NotebookOpenNotebookResponse> 
   */
  openNotebook(params: NotebookOpenNotebookParams): Promise<NotebookOpenNotebookResponse>;

  /**
   * 删除一个指定的笔记本。此操作会从工作空间移除笔记本及其所有内容。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookRemoveNotebookParams)
   * @returns Promise<NotebookRemoveNotebookResponse> 
   */
  removeNotebook(params: NotebookRemoveNotebookParams): Promise<NotebookRemoveNotebookResponse>;

  /**
   * 重命名一个指定的笔记本。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookRenameNotebookParams)
   * @returns Promise<NotebookRenameNotebookResponse> 
   */
  renameNotebook(params: NotebookRenameNotebookParams): Promise<NotebookRenameNotebookResponse>;

  /**
   * 更新指定笔记本的配置信息。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookSetNotebookConfParams)
   * @returns Promise<NotebookSetNotebookConfResponse> 
   */
  setNotebookConf(params: NotebookSetNotebookConfParams): Promise<NotebookSetNotebookConfResponse>;

  /**
   * 设置指定笔记本的显示图标。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (NotebookSetNotebookIconParams)
   * @returns Promise<NotebookSetNotebookIconResponse> 
   */
  setNotebookIcon(params: NotebookSetNotebookIconParams): Promise<NotebookSetNotebookIconResponse>;

}

export interface NotificationApi {
  /**
   * 向前端推送一条错误类型的消息通知，通常用于显示操作失败或异常情况。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (NotificationPushErrMsgParams)
   * @returns Promise<NotificationPushErrMsgResponse> 
   */
  pushErrMsg(params: NotificationPushErrMsgParams): Promise<NotificationPushErrMsgResponse>;

  /**
   * 向前端推送一条普通类型的消息通知，通常用于显示操作成功或提示信息。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (NotificationPushMsgParams)
   * @returns Promise<NotificationPushMsgResponse> 
   */
  pushMsg(params: NotificationPushMsgParams): Promise<NotificationPushMsgResponse>;

}

export interface OutlineApi {
  /**
   * 获取指定文档块（通常是文档的根块ID）的层级大纲结构。
   * (Requires authentication)
   * @param params Request parameters (OutlineGetDocOutlineParams)
   * @returns Promise<OutlineGetDocOutlineResponse> 
   */
  getDocOutline(params: OutlineGetDocOutlineParams): Promise<OutlineGetDocOutlineResponse>;

}

export interface PetalApi {
  /**
   * 加载指定前端界面的所有已启用且兼容的插件（Petals）及其代码和配置信息。
   * (Requires authentication)
   * @param params Request parameters (PetalLoadPetalsParams)
   * @returns Promise<PetalLoadPetalsResponse> 
   */
  loadPetals(params: PetalLoadPetalsParams): Promise<PetalLoadPetalsResponse>;

  /**
   * 设置指定前端界面中特定插件（由包名识别）的启用或禁用状态。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (PetalSetPetalEnabledParams)
   * @returns Promise<PetalSetPetalEnabledResponse> 
   */
  setPetalEnabled(params: PetalSetPetalEnabledParams): Promise<PetalSetPetalEnabledResponse>;

}

export interface QueryApi {
  /**
   * 执行 SQL 查询语句，返回查询结果。思源笔记使用 SQLite 作为底层数据库，支持标准的 SQL 查询语法。
   * (Requires authentication)
   * @param params Request parameters (QuerySQLParams)
   * @returns Promise<QuerySQLResponse> 
   */
  SQL(params: QuerySQLParams): Promise<QuerySQLResponse>;

}

export interface RefApi {
  /**
   * 获取指定块ID的反向链接和反向提及列表。此接口为旧版，建议使用 /api/ref/getBacklink2。
   * (Requires authentication)
   * @param params Request parameters (RefGetBacklinkParams)
   * @returns Promise<RefGetBacklinkResponse> 
   */
  getBacklink(params: RefGetBacklinkParams): Promise<RefGetBacklinkResponse>;

  /**
   * 获取指定块ID的反向链接和反向提及列表，支持排序。
   * (Requires authentication)
   * @param params Request parameters (RefGetBacklink2Params)
   * @returns Promise<RefGetBacklink2Response> 
   */
  getBacklink2(params: RefGetBacklink2Params): Promise<RefGetBacklink2Response>;

  /**
   * 获取指定 定义块 在某个特定 文档树 内的反向链接列表。用于在打开一个文档时，显示该文档中有哪些块引用了当前面板的文档。
   * (Requires authentication)
   * @param params Request parameters (RefGetBacklinkDocParams)
   * @returns Promise<RefGetBacklinkDocResponse> 
   */
  getBacklinkDoc(params: RefGetBacklinkDocParams): Promise<RefGetBacklinkDocResponse>;

  /**
   * 获取指定 定义块 在某个特定 文档树 内的反向提及列表 (提及了定义块的名称或别名，但未直接引用的块)。
   * (Requires authentication)
   * @param params Request parameters (RefGetBackmentionDocParams)
   * @returns Promise<RefGetBackmentionDocResponse> 
   */
  getBackmentionDoc(params: RefGetBackmentionDocParams): Promise<RefGetBackmentionDocResponse>;

  /**
   * 手动触发指定块的反向链接和提及关系的刷新计算。通常在数据发生变更后，系统会自动更新，但此接口可用于强制刷新。
   * (Requires authentication)
   * @param params Request parameters (RefRefreshBacklinkParams)
   * @returns Promise<RefRefreshBacklinkResponse> 
   */
  refreshBacklink(params: RefRefreshBacklinkParams): Promise<RefRefreshBacklinkResponse>;

}

export interface RepoApi {
  /**
   * 将当前工作区内容回滚到指定的仓库快照版本。这是一个危险操作，会导致当前未保存的更改丢失，请谨慎操作。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoCheckoutRepoParams)
   * @returns Promise<RepoCheckoutRepoResponse> 
   */
  checkoutRepo(params: RepoCheckoutRepoParams): Promise<RepoCheckoutRepoResponse>;

  /**
   * 为当前工作区创建一个新的快照。可以附带备注信息和标签。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoCreateSnapshotParams)
   * @returns Promise<RepoCreateSnapshotResponse> 
   */
  createSnapshot(params: RepoCreateSnapshotParams): Promise<RepoCreateSnapshotResponse>;

  /**
   * 比较两个指定的本地快照之间的差异，列出新增、修改和删除的文档。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoDiffRepoSnapshotsParams)
   * @returns Promise<RepoDiffRepoSnapshotsResponse> 
   */
  diffRepoSnapshots(params: RepoDiffRepoSnapshotsParams): Promise<RepoDiffRepoSnapshotsResponse>;

  /**
   * 从云端下载指定的快照到本地。如果本地已存在同名快照，可能会被覆盖或操作失败。下载的是标签快照时需要提供标签名。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoDownloadCloudSnapshotParams)
   * @returns Promise<RepoDownloadCloudSnapshotResponse> 
   */
  downloadCloudSnapshot(params: RepoDownloadCloudSnapshotParams): Promise<RepoDownloadCloudSnapshotResponse>;

  /**
   * 分页获取当前用户在云端存储的所有普通快照列表。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoGetCloudRepoSnapshotsParams)
   * @returns Promise<RepoGetCloudRepoSnapshotsResponse> 
   */
  getCloudRepoSnapshots(params: RepoGetCloudRepoSnapshotsParams): Promise<RepoGetCloudRepoSnapshotsResponse>;

  /**
   * 分页获取当前用户在云端存储的所有标签快照列表。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoGetCloudRepoTagSnapshotsParams)
   * @returns Promise<RepoGetCloudRepoTagSnapshotsResponse> 
   */
  getCloudRepoTagSnapshots(params: RepoGetCloudRepoTagSnapshotsParams): Promise<RepoGetCloudRepoTagSnapshotsResponse>;

  /**
   * 获取指定快照中特定文件的原始内容。此接口直接返回文件数据流，不返回标准JSON结构。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoGetRepoFileParams)
   * @returns Promise<any> 此接口不返回标准 JSON。成功时直接返回文件数据流 (HTTP 200)，Content-Type 根据文件类型确定。失败时返回标准 JSON 错误结构。
   */
  getRepoFile(params: RepoGetRepoFileParams): Promise<any>;

  /**
   * 分页获取当前工作区本地存储的所有普通快照列表。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoGetRepoSnapshotsParams)
   * @returns Promise<RepoGetRepoSnapshotsResponse> 
   */
  getRepoSnapshots(params: RepoGetRepoSnapshotsParams): Promise<RepoGetRepoSnapshotsResponse>;

  /**
   * 分页获取当前工作区本地存储的所有标签快照列表。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoGetRepoTagSnapshotsParams)
   * @returns Promise<RepoGetRepoTagSnapshotsResponse> 
   */
  getRepoTagSnapshots(params: RepoGetRepoTagSnapshotsParams): Promise<RepoGetRepoTagSnapshotsResponse>;

  /**
   * 导入仓库加密密钥。这是一个危险操作，错误的密钥可能导致数据无法解密。导入的密钥文件通常是 .sykey 后缀。此操作通过 FormData 接收文件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<RepoImportRepoKeyResponse> 
   */
  importRepoKey(): Promise<RepoImportRepoKeyResponse>;

  /**
   * 为当前工作区初始化一个新的随机加密密钥。此操作通常在首次设置加密或重置密钥时使用。旧密钥将被覆盖。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<RepoInitRepoKeyResponse> 
   */
  initRepoKey(): Promise<RepoInitRepoKeyResponse>;

  /**
   * 通过用户提供的口令生成并初始化仓库加密密钥。旧密钥将被覆盖。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoInitRepoKeyFromPassphraseParams)
   * @returns Promise<RepoInitRepoKeyFromPassphraseResponse> 
   */
  initRepoKeyFromPassphrase(params: RepoInitRepoKeyFromPassphraseParams): Promise<RepoInitRepoKeyFromPassphraseResponse>;

  /**
   * 获取并打开指定快照中特定文档的内容，用于预览历史版本。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoOpenRepoSnapshotDocParams)
   * @returns Promise<RepoOpenRepoSnapshotDocResponse> 
   */
  openRepoSnapshotDoc(params: RepoOpenRepoSnapshotDocParams): Promise<RepoOpenRepoSnapshotDocResponse>;

  /**
   * 彻底删除用户在云端的所有仓库数据，包括所有快照和标签快照。这是一个非常危险且不可逆的操作，执行前通常会有二次确认。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<RepoPurgeCloudRepoResponse> 
   */
  purgeCloudRepo(): Promise<RepoPurgeCloudRepoResponse>;

  /**
   * 彻底删除当前工作区的本地仓库数据，包括所有快照和标签快照。这是一个非常危险且不可逆的操作，执行前通常会有二次确认。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<RepoPurgeRepoResponse> 
   */
  purgeRepo(): Promise<RepoPurgeRepoResponse>;

  /**
   * 从云端移除指定的标签快照。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoRemoveCloudRepoTagSnapshotParams)
   * @returns Promise<RepoRemoveCloudRepoTagSnapshotResponse> 
   */
  removeCloudRepoTagSnapshot(params: RepoRemoveCloudRepoTagSnapshotParams): Promise<RepoRemoveCloudRepoTagSnapshotResponse>;

  /**
   * 从本地仓库移除指定的标签快照。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoRemoveRepoTagSnapshotParams)
   * @returns Promise<RepoRemoveRepoTagSnapshotResponse> 
   */
  removeRepoTagSnapshot(params: RepoRemoveRepoTagSnapshotParams): Promise<RepoRemoveRepoTagSnapshotResponse>;

  /**
   * 重置本地仓库，会清空所有快照和标签，并重新初始化仓库密钥。这是一个危险操作，执行前通常会有二次确认。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<RepoResetRepoResponse> 
   */
  resetRepo(): Promise<RepoResetRepoResponse>;

  /**
   * 设置本地仓库快照索引的保留天数。过期的索引将被自动清理。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoSetRepoIndexRetentionDaysParams)
   * @returns Promise<RepoSetRepoIndexRetentionDaysResponse> 
   */
  setRepoIndexRetentionDays(params: RepoSetRepoIndexRetentionDaysParams): Promise<RepoSetRepoIndexRetentionDaysResponse>;

  /**
   * 设置每日自动创建的快照在本地的保留数量。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RepoSetRetentionIndexesDailyParams)
   * @returns Promise<RepoSetRetentionIndexesDailyResponse> 
   */
  setRetentionIndexesDaily(params: RepoSetRetentionIndexesDailyParams): Promise<RepoSetRetentionIndexesDailyResponse>;

  /**
   * 为指定的本地快照打上标签，使其成为一个标签快照。可以同时提供备注，如果提供会覆盖快照原有的备注。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoTagSnapshotParams)
   * @returns Promise<RepoTagSnapshotResponse> 
   */
  tagSnapshot(params: RepoTagSnapshotParams): Promise<RepoTagSnapshotResponse>;

  /**
   * 将指定的本地快照上传到云端。如果是标签快照，需要提供标签名。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RepoUploadCloudSnapshotParams)
   * @returns Promise<RepoUploadCloudSnapshotResponse> 
   */
  uploadCloudSnapshot(params: RepoUploadCloudSnapshotParams): Promise<RepoUploadCloudSnapshotResponse>;

}

export interface RiffApi {
  /**
   * 将指定的块添加为闪卡到指定的闪卡包中。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffAddRiffCardsParams)
   * @returns Promise<RiffAddRiffCardsResponse> 
   */
  addRiffCards(params: RiffAddRiffCardsParams): Promise<RiffAddRiffCardsResponse>;

  /**
   * 批量设置闪卡的到期时间。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffBatchSetRiffCardsDueTimeParams)
   * @returns Promise<RiffBatchSetRiffCardsDueTimeResponse> 
   */
  batchSetRiffCardsDueTime(params: RiffBatchSetRiffCardsDueTimeParams): Promise<RiffBatchSetRiffCardsDueTimeResponse>;

  /**
   * 创建一个新的闪卡包。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffCreateRiffDeckParams)
   * @returns Promise<RiffCreateRiffDeckResponse> 
   */
  createRiffDeck(params: RiffCreateRiffDeckParams): Promise<RiffCreateRiffDeckResponse>;

  /**
   * 获取指定笔记本下的所有闪卡块 ID，支持分页。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RiffGetNotebookRiffCardsParams)
   * @returns Promise<RiffGetNotebookRiffCardsResponse> 
   */
  getNotebookRiffCards(params: RiffGetNotebookRiffCardsParams): Promise<RiffGetNotebookRiffCardsResponse>;

  /**
   * 获取指定笔记本下所有到期应复习的闪卡。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RiffGetNotebookRiffDueCardsParams)
   * @returns Promise<RiffGetNotebookRiffDueCardsResponse> 
   */
  getNotebookRiffDueCards(params: RiffGetNotebookRiffDueCardsParams): Promise<RiffGetNotebookRiffDueCardsResponse>;

  /**
   * 获取指定闪卡包中的所有闪卡块 ID，支持分页。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RiffGetRiffCardsParams)
   * @returns Promise<RiffGetRiffCardsResponse> 
   */
  getRiffCards(params: RiffGetRiffCardsParams): Promise<RiffGetRiffCardsResponse>;

  /**
   * 根据一组块 ID 批量获取它们对应的闪卡信息。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffGetRiffCardsByBlockIDsParams)
   * @returns Promise<RiffGetRiffCardsByBlockIDsResponse> 
   */
  getRiffCardsByBlockIDs(params: RiffGetRiffCardsByBlockIDsParams): Promise<RiffGetRiffCardsByBlockIDsResponse>;

  /**
   * 获取当前工作空间中所有的闪卡包列表。
   * (Requires authentication, Requires admin role)
   * @returns Promise<RiffGetRiffDecksResponse> 
   */
  getRiffDecks(): Promise<RiffGetRiffDecksResponse>;

  /**
   * 获取指定闪卡包中所有到期应复习的闪卡。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RiffGetRiffDueCardsParams)
   * @returns Promise<RiffGetRiffDueCardsResponse> 
   */
  getRiffDueCards(params: RiffGetRiffDueCardsParams): Promise<RiffGetRiffDueCardsResponse>;

  /**
   * 获取指定文档树（根块）下的所有闪卡块 ID，支持分页。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RiffGetTreeRiffCardsParams)
   * @returns Promise<RiffGetTreeRiffCardsResponse> 
   */
  getTreeRiffCards(params: RiffGetTreeRiffCardsParams): Promise<RiffGetTreeRiffCardsResponse>;

  /**
   * 获取指定文档树（根块）下所有到期应复习的闪卡。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (RiffGetTreeRiffDueCardsParams)
   * @returns Promise<RiffGetTreeRiffDueCardsResponse> 
   */
  getTreeRiffDueCards(params: RiffGetTreeRiffDueCardsParams): Promise<RiffGetTreeRiffDueCardsResponse>;

  /**
   * 从指定的闪卡包中移除指定的闪卡。如果 deckID 为空字符串，则从所有闪卡包中移除。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffRemoveRiffCardsParams)
   * @returns Promise<RiffRemoveRiffCardsResponse> 
   */
  removeRiffCards(params: RiffRemoveRiffCardsParams): Promise<RiffRemoveRiffCardsResponse>;

  /**
   * 移除指定的闪卡包及其包含的所有闪卡。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffRemoveRiffDeckParams)
   * @returns Promise<RiffRemoveRiffDeckResponse> 
   */
  removeRiffDeck(params: RiffRemoveRiffDeckParams): Promise<RiffRemoveRiffDeckResponse>;

  /**
   * 重命名指定的闪卡包。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffRenameRiffDeckParams)
   * @returns Promise<RiffRenameRiffDeckResponse> 
   */
  renameRiffDeck(params: RiffRenameRiffDeckParams): Promise<RiffRenameRiffDeckResponse>;

  /**
   * 重置指定范围内的闪卡的学习进度。可以按笔记本、文档树或闪卡包进行重置，也可以指定具体的块 ID 列表。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffResetRiffCardsParams)
   * @returns Promise<RiffResetRiffCardsResponse> 
   */
  resetRiffCards(params: RiffResetRiffCardsParams): Promise<RiffResetRiffCardsResponse>;

  /**
   * 对指定的闪卡进行一次复习，并根据评分更新其下次到期时间等学习状态。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffReviewRiffCardParams)
   * @returns Promise<RiffReviewRiffCardResponse> 
   */
  reviewRiffCard(params: RiffReviewRiffCardParams): Promise<RiffReviewRiffCardResponse>;

  /**
   * 跳过当前闪卡的复习，通常是将其推迟到当前学习队列的末尾或稍后。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (RiffSkipReviewRiffCardParams)
   * @returns Promise<RiffSkipReviewRiffCardResponse> 
   */
  skipReviewRiffCard(params: RiffSkipReviewRiffCardParams): Promise<RiffSkipReviewRiffCardResponse>;

}

export interface SearchApi {
  /**
   * 在指定的块ID范围、路径、笔记本、类型中查找内容并进行替换。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SearchFindReplaceParams)
   * @returns Promise<SearchFindReplaceResponse> 
   */
  findReplace(params: SearchFindReplaceParams): Promise<SearchFindReplaceResponse>;

  /**
   * 对资源文件内容进行全文搜索（此功能需要付费订阅）。
   * (Requires authentication)
   * @param params Request parameters (SearchFullTextSearchAssetContentParams)
   * @returns Promise<SearchFullTextSearchAssetContentResponse> 
   */
  fullTextSearchAssetContent(params: SearchFullTextSearchAssetContentParams): Promise<SearchFullTextSearchAssetContentResponse>;

  /**
   * 对块内容进行全文搜索，支持多种搜索方式和过滤条件。
   * (Requires authentication)
   * @param params Request parameters (SearchFullTextSearchBlockParams)
   * @returns Promise<SearchFullTextSearchBlockResponse> 
   */
  fullTextSearchBlock(params: SearchFullTextSearchBlockParams): Promise<SearchFullTextSearchBlockResponse>;

  /**
   * 获取资源文件内容中，与指定查询相关的片段。
   * (Requires authentication)
   * @param params Request parameters (SearchGetAssetContentParams)
   * @returns Promise<SearchGetAssetContentResponse> 
   */
  getAssetContent(params: SearchGetAssetContentParams): Promise<SearchGetAssetContentResponse>;

  /**
   * 获取指定嵌入块的渲染内容，支持包含其子块或显示面包屑。
   * (Requires authentication)
   * @param params Request parameters (SearchGetEmbedBlockParams)
   * @returns Promise<SearchGetEmbedBlockResponse> 
   */
  getEmbedBlock(params: SearchGetEmbedBlockParams): Promise<SearchGetEmbedBlockResponse>;

  /**
   * 分页列出在当前工作空间中所有无效的块引用（例如，引用的块已被删除）。
   * (Requires authentication)
   * @param params Request parameters (SearchListInvalidBlockRefsParams)
   * @returns Promise<SearchListInvalidBlockRefsResponse> 
   */
  listInvalidBlockRefs(params: SearchListInvalidBlockRefsParams): Promise<SearchListInvalidBlockRefsResponse>;

  /**
   * 根据路径移除指定的模板文件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SearchRemoveTemplateParams)
   * @returns Promise<SearchRemoveTemplateResponse> 
   */
  removeTemplate(params: SearchRemoveTemplateParams): Promise<SearchRemoveTemplateResponse>;

  /**
   * 根据文件名关键词和可选的文件扩展名搜索资源文件。
   * (Requires authentication)
   * @param params Request parameters (SearchSearchAssetParams)
   * @returns Promise<SearchSearchAssetResponse> 
   */
  searchAsset(params: SearchSearchAssetParams): Promise<SearchSearchAssetResponse>;

  /**
   * 在指定的嵌入块（及其可能的子块）中使用 SQL 语句进行内容搜索。
   * (Requires authentication)
   * @param params Request parameters (SearchSearchEmbedBlockParams)
   * @returns Promise<SearchSearchEmbedBlockResponse> 
   */
  searchEmbedBlock(params: SearchSearchEmbedBlockParams): Promise<SearchSearchEmbedBlockResponse>;

  /**
   * 在输入引用（例如 `((` 或 `[[`）时，根据关键词动态搜索可能的引用块建议。
   * (Requires authentication)
   * @param params Request parameters (SearchSearchRefBlockParams)
   * @returns Promise<SearchSearchRefBlockResponse> 
   */
  searchRefBlock(params: SearchSearchRefBlockParams): Promise<SearchSearchRefBlockResponse>;

  /**
   * 根据关键词搜索已存在的标签。
   * (Requires authentication)
   * @param params Request parameters (SearchSearchTagParams)
   * @returns Promise<SearchSearchTagResponse> 
   */
  searchTag(params: SearchSearchTagParams): Promise<SearchSearchTagResponse>;

  /**
   * 根据关键词搜索模板（通常是模板文件名或内容）。
   * (Requires authentication)
   * @param params Request parameters (SearchSearchTemplateParams)
   * @returns Promise<SearchSearchTemplateResponse> 
   */
  searchTemplate(params: SearchSearchTemplateParams): Promise<SearchSearchTemplateResponse>;

  /**
   * 根据关键词搜索挂件块。
   * (Requires authentication)
   * @param params Request parameters (SearchSearchWidgetParams)
   * @returns Promise<SearchSearchWidgetResponse> 
   */
  searchWidget(params: SearchSearchWidgetParams): Promise<SearchSearchWidgetResponse>;

  /**
   * 更新指定**查询嵌入块（`query_embed` 类型）**的原始查询语句或脚本内容。此接口专门用于处理查询嵌入块，不适用于普通块的自定义属性更新。
   * (Requires authentication)
   * @param params Request parameters (SearchUpdateEmbedBlockParams)
   * @returns Promise<SearchUpdateEmbedBlockResponse> 
   */
  updateEmbedBlock(params: SearchUpdateEmbedBlockParams): Promise<SearchUpdateEmbedBlockResponse>;

}

export interface SettingApi {
  /**
   * 将指定的关键字列表添加到虚拟块引用的全局排除列表中。这些关键字将不会用于生成虚拟引用。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingAddVirtualBlockRefExcludeParams)
   * @returns Promise<SettingAddVirtualBlockRefExcludeResponse> 
   */
  addVirtualBlockRefExclude(params: SettingAddVirtualBlockRefExcludeParams): Promise<SettingAddVirtualBlockRefExcludeResponse>;

  /**
   * 将指定的关键字列表添加到虚拟块引用的全局包含列表中。只有这些关键字才可能用于生成虚拟引用（如果全局虚拟引用开关已打开）。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingAddVirtualBlockRefIncludeParams)
   * @returns Promise<SettingAddVirtualBlockRefIncludeResponse> 
   */
  addVirtualBlockRefInclude(params: SettingAddVirtualBlockRefIncludeParams): Promise<SettingAddVirtualBlockRefIncludeResponse>;

  /**
   * 刷新并获取当前登录的思源云端账户信息。
   * (Requires authentication)
   * @param params Request parameters (SettingGetCloudUserParams)
   * @returns Promise<SettingGetCloudUserResponse> 
   */
  getCloudUser(params: SettingGetCloudUserParams): Promise<SettingGetCloudUserResponse>;

  /**
   * 获取当前的发布服务配置信息，包括端口和具体的发布设置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SettingGetPublishResponse> 
   */
  getPublish(): Promise<SettingGetPublishResponse>;

  /**
   * 使用令牌和两步验证码完成云端用户的登录过程。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingLogin2faCloudUserParams)
   * @returns Promise<SettingLogin2faCloudUserResponse> 
   */
  login2faCloudUser(params: SettingLogin2faCloudUserParams): Promise<SettingLogin2faCloudUserResponse>;

  /**
   * 登出当前已登录的思源云端账户。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SettingLogoutCloudUserResponse> 
   */
  logoutCloudUser(): Promise<SettingLogoutCloudUserResponse>;

  /**
   * 清除并重建虚拟块引用的缓存。当虚拟引用的相关配置（如包含/排除列表、编辑器中的开关）发生变化后，可能需要调用此接口。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SettingRefreshVirtualBlockRefResponse> 
   */
  refreshVirtualBlockRef(): Promise<SettingRefreshVirtualBlockRefResponse>;

  /**
   * 更新AI相关的配置，主要针对OpenAI服务。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetAIParams)
   * @returns Promise<SettingSetAIResponse> 
   */
  setAI(params: SettingSetAIParams): Promise<SettingSetAIResponse>;

  /**
   * 更新用户账户相关的显示配置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetAccountParams)
   * @returns Promise<SettingSetAccountResponse> 
   */
  setAccount(params: SettingSetAccountParams): Promise<SettingSetAccountResponse>;

  /**
   * 更新应用的外观相关配置，如主题、字体、语言等。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetAppearanceParams)
   * @returns Promise<SettingSetAppearanceResponse> 
   */
  setAppearance(params: SettingSetAppearanceParams): Promise<SettingSetAppearanceResponse>;

  /**
   * 更新与集市相关的配置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetBazaarParams)
   * @returns Promise<SettingSetBazaarResponse> 
   */
  setBazaar(params: SettingSetBazaarParams): Promise<SettingSetBazaarResponse>;

  /**
   * 更新编辑器相关的各种配置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetEditorParams)
   * @returns Promise<SettingSetEditorResponse> 
   */
  setEditor(params: SettingSetEditorParams): Promise<SettingSetEditorResponse>;

  /**
   * 单独设置整个编辑器的只读状态。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetEditorReadOnlyParams)
   * @returns Promise<SettingSetEditorReadOnlyResponse> 
   */
  setEditorReadOnly(params: SettingSetEditorReadOnlyParams): Promise<SettingSetEditorReadOnlyResponse>;

  /**
   * 更新编辑器配置中的常用表情列表。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetEmojiParams)
   * @returns Promise<SettingSetEmojiResponse> 
   */
  setEmoji(params: SettingSetEmojiParams): Promise<SettingSetEmojiResponse>;

  /**
   * 更新与导出功能相关的配置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetExportParams)
   * @returns Promise<SettingSetExportResponse> 
   */
  setExport(params: SettingSetExportParams): Promise<SettingSetExportResponse>;

  /**
   * 更新文件树（文档列表）相关的配置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetFiletreeParams)
   * @returns Promise<SettingSetFiletreeResponse> 
   */
  setFiletree(params: SettingSetFiletreeParams): Promise<SettingSetFiletreeResponse>;

  /**
   * 更新与闪卡（FSRS算法）相关的配置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetFlashcardParams)
   * @returns Promise<SettingSetFlashcardResponse> 
   */
  setFlashcard(params: SettingSetFlashcardParams): Promise<SettingSetFlashcardResponse>;

  /**
   * 更新用户自定义的快捷键映射。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetKeymapParams)
   * @returns Promise<SettingSetKeymapResponse> 
   */
  setKeymap(params: SettingSetKeymapParams): Promise<SettingSetKeymapResponse>;

  /**
   * 更新发布服务的配置，并尝试根据新配置初始化（或重启）发布服务。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetPublishParams)
   * @returns Promise<SettingSetPublishResponse> 
   */
  setPublish(params: SettingSetPublishParams): Promise<SettingSetPublishResponse>;

  /**
   * 更新与搜索功能相关的配置，部分配置更改可能触发重建索引。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetSearchParams)
   * @returns Promise<SettingSetSearchResponse> 
   */
  setSearch(params: SettingSetSearchParams): Promise<SettingSetSearchResponse>;

  /**
   * 更新代码片段（Snippets）的启用状态，如是否启用自定义CSS和JS。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SettingSetConfSnippetParams)
   * @returns Promise<SettingSetConfSnippetResponse> 
   */
  setConfSnippet(params: SettingSetConfSnippetParams): Promise<SettingSetConfSnippetResponse>;

}

export interface SnippetApi {
  /**
   * 获取已保存的代码片段列表。可以根据类型（js/css/all）、启用状态（0-禁用, 1-启用, 2-全部）和关键字进行过滤。
   * (Requires authentication)
   * @param params Request parameters (SnippetGetSnippetParams)
   * @returns Promise<SnippetGetSnippetResponse> 
   */
  getSnippet(params: SnippetGetSnippetParams): Promise<SnippetGetSnippetResponse>;

  /**
   * 设置全新的代码片段列表。这是一个全量替换操作，提供的 snippets 数组将完全覆盖当前所有的代码片段。如果只想修改或添加单个片段，需要先获取所有现有片段，在本地修改/添加后，将修改后的完整列表通过此API发送。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SnippetSetSnippetParams)
   * @returns Promise<SnippetSetSnippetResponse> 
   */
  setSnippet(params: SnippetSetSnippetParams): Promise<SnippetSetSnippetResponse>;

  /**
   * 根据ID移除指定的代码片段。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SnippetRemoveSnippetParams)
   * @returns Promise<SnippetRemoveSnippetResponse> 
   */
  removeSnippet(params: SnippetRemoveSnippetParams): Promise<SnippetRemoveSnippetResponse>;

}

export interface SqliteApi {
  /**
   * 将内核中待处理的数据库事务队列立即刷新到磁盘。这通常用于确保在关键操作后数据被持久化。该接口不接收参数。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SqliteFlushTransactionResponse> 
   */
  flushTransaction(): Promise<SqliteFlushTransactionResponse>;

}

export interface StorageApi {
  /**
   * 获取所有用户已保存的搜索标准（过滤条件）列表。
   * (Requires authentication)
   * @returns Promise<StorageGetCriteriaResponse> 
   */
  getCriteria(): Promise<StorageGetCriteriaResponse>;

  /**
   * 获取浏览器 LocalStorage 中的所有键值对。
   * (Requires authentication)
   * @returns Promise<StorageGetLocalStorageResponse> 
   */
  getLocalStorage(): Promise<StorageGetLocalStorageResponse>;

  /**
   * 获取用户最近打开过的文档列表。这些文档按最近打开时间排序。
   * (Requires authentication)
   * @returns Promise<StorageGetRecentDocsResponse> 
   */
  getRecentDocs(): Promise<StorageGetRecentDocsResponse>;

  /**
   * 根据名称移除一个已保存的搜索标准（过滤条件）。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (StorageRemoveCriterionParams)
   * @returns Promise<StorageRemoveCriterionResponse> 
   */
  removeCriterion(params: StorageRemoveCriterionParams): Promise<StorageRemoveCriterionResponse>;

  /**
   * 根据提供的键名列表，批量移除浏览器 LocalStorage 中的项目。同时会广播事件通知其他客户端同步移除。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (StorageRemoveLocalStorageValsParams)
   * @returns Promise<StorageRemoveLocalStorageValsResponse> 
   */
  removeLocalStorageVals(params: StorageRemoveLocalStorageValsParams): Promise<StorageRemoveLocalStorageValsResponse>;

  /**
   * 保存或更新一个搜索标准（过滤条件）。搜索标准可用于后续的文档或内容搜索。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (StorageSetCriterionParams)
   * @returns Promise<StorageSetCriterionResponse> 
   */
  setCriterion(params: StorageSetCriterionParams): Promise<StorageSetCriterionResponse>;

  /**
   * 使用一个完整的对象来覆盖整个浏览器 LocalStorage 的内容。通常用于导入或恢复 LocalStorage 数据。同时会广播事件通知其他客户端同步设置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (StorageSetLocalStorageParams)
   * @returns Promise<StorageSetLocalStorageResponse> 
   */
  setLocalStorage(params: StorageSetLocalStorageParams): Promise<StorageSetLocalStorageResponse>;

  /**
   * 设置浏览器 LocalStorage 中的单个键值对。同时会广播事件通知其他客户端同步设置。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (StorageSetLocalStorageValParams)
   * @returns Promise<StorageSetLocalStorageValResponse> 
   */
  setLocalStorageVal(params: StorageSetLocalStorageValParams): Promise<StorageSetLocalStorageValResponse>;

}

export interface SyncApi {
  /**
   * 在云端存储中创建一个新的同步目录。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncCreateCloudSyncDirParams)
   * @returns Promise<SyncCreateCloudSyncDirResponse> 
   */
  createCloudSyncDir(params: SyncCreateCloudSyncDirParams): Promise<SyncCreateCloudSyncDirResponse>;

  /**
   * 将会话中当前的 S3 同步配置加密并打包成 .zip 文件供导出。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SyncExportSyncProviderS3Response> 
   */
  exportSyncProviderS3(): Promise<SyncExportSyncProviderS3Response>;

  /**
   * 将会话中当前的 WebDAV 同步配置加密并打包成 .zip 文件供导出。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SyncExportSyncProviderWebDAVResponse> 
   */
  exportSyncProviderWebDAV(): Promise<SyncExportSyncProviderWebDAVResponse>;

  /**
   * 检查应用启动时数据同步是否成功完成。此接口仅在管理员角色下，且同步已启用且成功时返回特定提示。
   * (Requires authentication)
   * @returns Promise<SyncGetBootSyncResponse> 
   */
  getBootSync(): Promise<SyncGetBootSyncResponse>;

  /**
   * 获取当前的同步状态、最后同步时间、以及当前在线的内核实例等信息。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SyncGetSyncInfoResponse> 
   */
  getSyncInfo(): Promise<SyncGetSyncInfoResponse>;

  /**
   * 通过上传的 .zip 或 .json 文件导入 S3 同步配置。导入的配置会经过解密和验证。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SyncImportSyncProviderS3Response> 
   */
  importSyncProviderS3(): Promise<SyncImportSyncProviderS3Response>;

  /**
   * 通过上传的 .zip 或 .json 文件导入 WebDAV 同步配置。导入的配置会经过解密和验证。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SyncImportSyncProviderWebDAVResponse> 
   */
  importSyncProviderWebDAV(): Promise<SyncImportSyncProviderWebDAVResponse>;

  /**
   * 列出当前配置的云端存储中可用的同步目录及其大小信息。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SyncListCloudSyncDirResponse> 
   */
  listCloudSyncDir(): Promise<SyncListCloudSyncDirResponse>;

  /**
   * 执行启动时的数据同步流程。此接口会触发 model.BootSyncData()。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SyncPerformBootSyncResponse> 
   */
  performBootSync(): Promise<SyncPerformBootSyncResponse>;

  /**
   * 执行数据同步操作。对于非云端同步模式 (mode != 3)，将触发 model.SyncData(true)。对于云端同步模式 (mode === 3)，需要明确指定同步方向 (upload: true/false)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncPerformSyncParams)
   * @returns Promise<SyncPerformSyncResponse> 
   */
  performSync(params: SyncPerformSyncParams): Promise<SyncPerformSyncResponse>;

  /**
   * 从云端存储中移除指定的同步目录。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncRemoveCloudSyncDirParams)
   * @returns Promise<SyncRemoveCloudSyncDirResponse> 
   */
  removeCloudSyncDir(params: SyncRemoveCloudSyncDirParams): Promise<SyncRemoveCloudSyncDirResponse>;

  /**
   * 设置当前内核实例使用的云端同步目录。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetCloudSyncDirParams)
   * @returns Promise<SyncSetCloudSyncDirResponse> 
   */
  setCloudSyncDir(params: SyncSetCloudSyncDirParams): Promise<SyncSetCloudSyncDirResponse>;

  /**
   * 设置是否启用数据同步功能。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncEnableParams)
   * @returns Promise<SyncSetSyncEnableResponse> 
   */
  setSyncEnable(params: SyncSetSyncEnableParams): Promise<SyncSetSyncEnableResponse>;

  /**
   * 设置在数据同步过程中发生内容冲突时，是否自动生成冲突副本文件。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncGenerateConflictDocParams)
   * @returns Promise<SyncSetSyncGenerateConflictDocResponse> 
   */
  setSyncGenerateConflictDoc(params: SyncSetSyncGenerateConflictDocParams): Promise<SyncSetSyncGenerateConflictDocResponse>;

  /**
   * 设置自动数据同步的时间间隔（单位：分钟）。设置后会重置同步计时器。
   * (Requires authentication)
   * @param params Request parameters (SyncSetSyncIntervalParams)
   * @returns Promise<SyncSetSyncIntervalResponse> 
   */
  setSyncInterval(params: SyncSetSyncIntervalParams): Promise<SyncSetSyncIntervalResponse>;

  /**
   * 设置数据同步的模式。例如：0 表示自动同步，1 表示手动同步，3 表示云端双向同步时需手动触发单向同步。设置后会重置同步计时器。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncModeParams)
   * @returns Promise<SyncSetSyncModeResponse> 
   */
  setSyncMode(params: SyncSetSyncModeParams): Promise<SyncSetSyncModeResponse>;

  /**
   * 设置是否启用同步感知功能。启用后，当检测到远程数据更新时，可能会有相应的提示或行为。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncPerceptionParams)
   * @returns Promise<SyncSetSyncPerceptionResponse> 
   */
  setSyncPerception(params: SyncSetSyncPerceptionParams): Promise<SyncSetSyncPerceptionResponse>;

  /**
   * 设置当前使用的数据同步服务提供商，例如 S3、WebDAV 或本地文件夹。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncProviderParams)
   * @returns Promise<SyncSetSyncProviderResponse> 
   */
  setSyncProvider(params: SyncSetSyncProviderParams): Promise<SyncSetSyncProviderResponse>;

  /**
   * 设置当同步服务提供商为本地文件夹时，所使用的本地文件夹路径。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncProviderLocalParams)
   * @returns Promise<SyncSetSyncProviderLocalResponse> 
   */
  setSyncProviderLocal(params: SyncSetSyncProviderLocalParams): Promise<SyncSetSyncProviderLocalResponse>;

  /**
   * 设置使用 S3作为同步服务提供商时的详细配置信息，如 Access Key, Secret Key, Endpoint, Bucket 等。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncProviderS3Params)
   * @returns Promise<SyncSetSyncProviderS3Response> 
   */
  setSyncProviderS3(params: SyncSetSyncProviderS3Params): Promise<SyncSetSyncProviderS3Response>;

  /**
   * 设置使用 WebDAV 作为同步服务提供商时的详细配置信息，如 Endpoint, 用户名和密码。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SyncSetSyncProviderWebDAVParams)
   * @returns Promise<SyncSetSyncProviderWebDAVResponse> 
   */
  setSyncProviderWebDAV(params: SyncSetSyncProviderWebDAVParams): Promise<SyncSetSyncProviderWebDAVResponse>;

}

export interface SystemApi {
  /**
   * 将思源笔记相关目录添加到 Microsoft Defender 的排除项中，以避免潜在的性能问题或冲突。此操作仅在 Windows 系统上有效。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SystemAddMicrosoftDefenderExclusionResponse> 
   */
  addMicrosoftDefenderExclusion(): Promise<SystemAddMicrosoftDefenderExclusionResponse>;

  /**
   * 获取思源笔记内核的启动进度。此接口也接受 POST 请求。
   * @returns Promise<SystemBootProgressResponse> 
   */
  bootProgress(): Promise<SystemBootProgressResponse>;

  /**
   * 获取思源笔记内核的启动进度。此接口也接受 GET 请求。
   * @returns Promise<SystemBootProgressResponse> 
   */
  bootProgress(): Promise<SystemBootProgressResponse>;

  /**
   * 检查思源笔记是否有新版本。
   * (Requires authentication, Requires admin role)
   * @param params Request parameters (SystemCheckUpdateParams)
   * @returns Promise<SystemCheckUpdateResponse> 
   */
  checkUpdate(params: SystemCheckUpdateParams): Promise<SystemCheckUpdateResponse>;

  /**
   * 检查指定路径是否可以作为思源笔记的工作空间目录。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemCheckWorkspaceDirParams)
   * @returns Promise<SystemCheckWorkspaceDirResponse> 
   */
  checkWorkspaceDir(params: SystemCheckWorkspaceDirParams): Promise<SystemCheckWorkspaceDirResponse>;

  /**
   * 在指定路径创建一个新的思源笔记工作空间。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemCreateWorkspaceDirParams)
   * @returns Promise<SystemCreateWorkspaceDirResponse> 
   */
  createWorkspaceDir(params: SystemCreateWorkspaceDirParams): Promise<SystemCreateWorkspaceDirResponse>;

  /**
   * 获取思源笔记服务器当前的 Unix 时间戳 (毫秒)。
   * @returns Promise<SystemCurrentTimeResponse> 
   */
  currentTime(): Promise<SystemCurrentTimeResponse>;

  /**
   * 关闭并退出思源笔记程序。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SystemExitResponse> 
   */
  exit(): Promise<SystemExitResponse>;

  /**
   * 导出一份包含当前用户所有配置的 JSON 文件。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SystemExportConfResponse> 
   */
  exportConf(): Promise<SystemExportConfResponse>;

  /**
   * 导出包含系统运行日志的压缩文件。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SystemExportLogResponse> 
   */
  exportLog(): Promise<SystemExportLogResponse>;

  /**
   * 获取用于登录验证的图片验证码。
   * @returns Promise<SystemGetCaptchaResponse> 
   */
  GetCaptcha(): Promise<SystemGetCaptchaResponse>;

  /**
   * 获取当前版本的更新日志内容 (Markdown 格式转换为 HTML)。
   * (Requires authentication)
   * @returns Promise<SystemGetChangelogResponse> 
   */
  getChangelog(): Promise<SystemGetChangelogResponse>;

  /**
   * 获取思源笔记的全部配置信息。配置项繁多，具体结构请参考 `siyuan/kernel/conf/conf.go` 中的 `Conf` 结构体。
   * (Requires authentication)
   * @returns Promise<SystemGetConfResponse> 
   */
  getConf(): Promise<SystemGetConfResponse>;

  /**
   * 获取内置及自定义 Emoji 的配置信息，用于 Emoji 选择器等功能。
   * (Requires authentication)
   * @returns Promise<SystemGetEmojiConfResponse> 
   */
  getEmojiConf(): Promise<SystemGetEmojiConfResponse>;

  /**
   * 获取用于移动端同步的工作空间列表。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SystemGetMobileWorkspacesResponse> 
   */
  getMobileWorkspaces(): Promise<SystemGetMobileWorkspacesResponse>;

  /**
   * 获取当前的网络代理等配置信息。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SystemGetNetworkResponse> 
   */
  getNetwork(): Promise<SystemGetNetworkResponse>;

  /**
   * 获取当前操作系统上安装的可用字体列表。
   * (Requires authentication, Requires admin role)
   * @returns Promise<SystemGetSysFontsResponse> 
   */
  getSysFonts(): Promise<SystemGetSysFontsResponse>;

  /**
   * 获取当前打开的工作空间目录路径和思源版本号。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SystemGetWorkspaceInfoResponse> 
   */
  getWorkspaceInfo(): Promise<SystemGetWorkspaceInfoResponse>;

  /**
   * 获取所有已配置或曾经打开过的工作空间列表。
   * (Requires authentication)
   * @returns Promise<SystemGetWorkspacesResponse> 
   */
  getWorkspaces(): Promise<SystemGetWorkspacesResponse>;

  /**
   * 设置不再提示用户添加 Microsoft Defender 排除项。此操作仅在 Windows 系统上有效。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SystemIgnoreAddMicrosoftDefenderExclusionResponse> 
   */
  ignoreAddMicrosoftDefenderExclusion(): Promise<SystemIgnoreAddMicrosoftDefenderExclusionResponse>;

  /**
   * 通过上传 `conf.json` 文件来导入用户配置。导入成功后通常需要重启或刷新UI生效。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemImportConfParams)
   * @returns Promise<SystemImportConfResponse> 
   */
  importConf(params: SystemImportConfParams): Promise<SystemImportConfResponse>;

  /**
   * 使用访问授权码或用户名密码进行登录验证。
   * @param params Request parameters (SystemLoginAuthParams)
   * @returns Promise<SystemLoginAuthResponse> 
   */
  LoginAuth(params: SystemLoginAuthParams): Promise<SystemLoginAuthResponse>;

  /**
   * 清除当前的登录授权状态。
   * @returns Promise<SystemLogoutAuthResponse> 
   */
  LogoutAuth(): Promise<SystemLogoutAuthResponse>;

  /**
   * 命令客户端重新加载思源笔记的用户界面。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<SystemReloadUIResponse> 
   */
  reloadUI(): Promise<SystemReloadUIResponse>;

  /**
   * 从工作空间列表中移除指定的目录（逻辑删除，不删除物理文件）。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemRemoveWorkspaceDirParams)
   * @returns Promise<SystemRemoveWorkspaceDirResponse> 
   */
  removeWorkspaceDir(params: SystemRemoveWorkspaceDirParams): Promise<SystemRemoveWorkspaceDirResponse>;

  /**
   * 从工作空间列表中移除并物理删除指定目录及其所有内容。这是一个危险操作！
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemRemoveWorkspaceDirPhysicallyParams)
   * @returns Promise<SystemRemoveWorkspaceDirPhysicallyResponse> 
   */
  removeWorkspaceDirPhysically(params: SystemRemoveWorkspaceDirPhysicallyParams): Promise<SystemRemoveWorkspaceDirPhysicallyResponse>;

  /**
   * 设置或清空 API 访问令牌 (token)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetAPITokenParams)
   * @returns Promise<SystemSetAPITokenResponse> 
   */
  setAPIToken(params: SystemSetAPITokenParams): Promise<SystemSetAPITokenResponse>;

  /**
   * 设置或清空访问思源笔记的授权码。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetAccessAuthCodeParams)
   * @returns Promise<SystemSetAccessAuthCodeResponse> 
   */
  setAccessAuthCode(params: SystemSetAccessAuthCodeParams): Promise<SystemSetAccessAuthCodeResponse>;

  /**
   * 设置思源笔记的外观模式 (亮色/暗色)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetAppearanceModeParams)
   * @returns Promise<SystemSetAppearanceModeResponse> 
   */
  setAppearanceMode(params: SystemSetAppearanceModeParams): Promise<SystemSetAppearanceModeResponse>;

  /**
   * 设置思源笔记是否开机自启动 (仅对桌面客户端有效)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetAutoLaunchParams)
   * @returns Promise<SystemSetAutoLaunchResponse> 
   */
  setAutoLaunch(params: SystemSetAutoLaunchParams): Promise<SystemSetAutoLaunchResponse>;

  /**
   * 设置是否在检测到新版本后自动下载并安装更新包。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetDownloadInstallPkgParams)
   * @returns Promise<SystemSetDownloadInstallPkgResponse> 
   */
  setDownloadInstallPkg(params: SystemSetDownloadInstallPkgParams): Promise<SystemSetDownloadInstallPkgResponse>;

  /**
   * 设置思源笔记是否在系统锁屏时自动锁定 (仅对桌面客户端有效)。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetFollowSystemLockScreenParams)
   * @returns Promise<SystemSetFollowSystemLockScreenResponse> 
   */
  setFollowSystemLockScreen(params: SystemSetFollowSystemLockScreenParams): Promise<SystemSetFollowSystemLockScreenResponse>;

  /**
   * 启用或禁用 Google Analytics 数据追踪。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetGoogleAnalyticsParams)
   * @returns Promise<SystemSetGoogleAnalyticsResponse> 
   */
  setGoogleAnalytics(params: SystemSetGoogleAnalyticsParams): Promise<SystemSetGoogleAnalyticsResponse>;

  /**
   * 设置网络连接时使用的代理服务器。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetNetworkProxyParams)
   * @returns Promise<SystemSetNetworkProxyResponse> 
   */
  setNetworkProxy(params: SystemSetNetworkProxyParams): Promise<SystemSetNetworkProxyResponse>;

  /**
   * 配置思源笔记的网络服务，如服务端口、是否允许其他设备访问等。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetNetworkServeParams)
   * @returns Promise<SystemSetNetworkServeResponse> 
   */
  setNetworkServe(params: SystemSetNetworkServeParams): Promise<SystemSetNetworkServeResponse>;

  /**
   * 设置用户界面的布局模式，例如左右布局、顶部分栏等。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetUILayoutParams)
   * @returns Promise<SystemSetUILayoutResponse> 
   */
  setUILayout(params: SystemSetUILayoutParams): Promise<SystemSetUILayoutResponse>;

  /**
   * 切换到指定路径的工作空间。成功后通常需要重启或刷新 UI。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (SystemSetWorkspaceDirParams)
   * @returns Promise<SystemSetWorkspaceDirResponse> 
   */
  setWorkspaceDir(params: SystemSetWorkspaceDirParams): Promise<SystemSetWorkspaceDirResponse>;

  /**
   * （内部接口）用于桌面端添加 UI 进程的相关信息，如 PID。通常不由普通用户或第三方应用直接调用。
   * @param params Request parameters (SystemAddUIProcessParams)
   * @returns Promise<SystemAddUIProcessResponse> 
   */
  addUIProcess(params: SystemAddUIProcessParams): Promise<SystemAddUIProcessResponse>;

  /**
   * 获取当前思源笔记内核的版本号。此接口也接受 POST 请求。
   * @returns Promise<SystemVersionResponse> 
   */
  version(): Promise<SystemVersionResponse>;

  /**
   * 获取当前思源笔记内核的版本号。此接口也接受 GET 请求。
   * @returns Promise<SystemVersionResponse> 
   */
  version(): Promise<SystemVersionResponse>;

}

export interface TagApi {
  /**
   * 获取当前工作空间的所有标签列表。可以提供一个可选的排序参数来即时更新并应用全局标签排序设置。
   * (Requires authentication)
   * @param params Request parameters (TagGetTagParams)
   * @returns Promise<TagGetTagResponse> 
   */
  getTag(params: TagGetTagParams): Promise<TagGetTagResponse>;

  /**
   * 根据标签名称移除一个标签。这会从所有关联的块中移除该标签。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (TagRemoveTagParams)
   * @returns Promise<TagRemoveTagResponse> 
   */
  removeTag(params: TagRemoveTagParams): Promise<TagRemoveTagResponse>;

  /**
   * 将一个旧标签名称重命名为一个新标签名称。所有关联块中的标签引用都会被更新。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (TagRenameTagParams)
   * @returns Promise<TagRenameTagResponse> 
   */
  renameTag(params: TagRenameTagParams): Promise<TagRenameTagResponse>;

}

export interface TemplateApi {
  /**
   * 将指定 ID 的文档内容保存为一个模板。可以指定模板名称，以及是否覆盖同名模板。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (TemplateDocSaveAsTemplateParams)
   * @returns Promise<TemplateDocSaveAsTemplateResponse> 
   */
  docSaveAsTemplate(params: TemplateDocSaveAsTemplateParams): Promise<TemplateDocSaveAsTemplateResponse>;

  /**
   * 根据给定的模板文件路径和可选的上下文块ID，渲染模板内容。可以指定是否为预览模式。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (TemplateRenderTemplateParams)
   * @returns Promise<TemplateRenderTemplateResponse> 
   */
  renderTemplate(params: TemplateRenderTemplateParams): Promise<TemplateRenderTemplateResponse>;

  /**
   * 使用 Go 的 Sprig 模板函数库渲染给定的模板字符串。
   * (Requires authentication)
   * @param params Request parameters (TemplateRenderSprigParams)
   * @returns Promise<TemplateRenderSprigResponse> 
   */
  renderSprig(params: TemplateRenderSprigParams): Promise<TemplateRenderSprigResponse>;

}

export interface TransactionsApi {
  /**
   * 执行一个或多个事务操作，每个事务可以包含多个具体的数据修改动作。这是思源笔记中进行数据修改最核心的接口之一。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (TransactionsPerformTransactionsParams)
   * @returns Promise<TransactionsPerformTransactionsResponse> 
   */
  performTransactions(params: TransactionsPerformTransactionsParams): Promise<TransactionsPerformTransactionsResponse>;

}

export interface UiApi {
  /**
   * 重新加载指定的属性视图。通常在属性视图的结构或数据发生变化后调用，以刷新显示。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (UiReloadAttributeViewParams)
   * @returns Promise<UiReloadAttributeViewResponse> 
   */
  reloadAttributeView(params: UiReloadAttributeViewParams): Promise<UiReloadAttributeViewResponse>;

  /**
   * 重新加载文件树。当文档结构发生变化（如创建、删除、移动文档或笔记本）后，调用此接口以刷新文件树显示。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<UiReloadFiletreeResponse> 
   */
  reloadFiletree(): Promise<UiReloadFiletreeResponse>;

  /**
   * 重新加载指定的 Protyle 编辑器实例。通常在编辑器内容或状态在后端被修改后调用，以刷新前端显示。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @param params Request parameters (UiReloadProtyleParams)
   * @returns Promise<UiReloadProtyleResponse> 
   */
  reloadProtyle(params: UiReloadProtyleParams): Promise<UiReloadProtyleResponse>;

  /**
   * 重新加载标签列表。当标签被创建、删除、重命名或引用发生变化后，调用此接口以刷新标签面板的显示。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<UiReloadTagResponse> 
   */
  reloadTag(): Promise<UiReloadTagResponse>;

  /**
   * 触发整个用户界面的重新加载。这是一个比较重的操作，通常在发生可能影响全局UI状态的重大变更后使用，或者作为一种通用的刷新手段。
   * (Requires authentication, Requires admin role, Unavailable in read-only mode)
   * @returns Promise<UiReloadUIResponse> 
   */
  reloadUI(): Promise<UiReloadUIResponse>;

}


export interface SiyuanClientConfig {
  baseUrl?: string;
  apiToken?: string;
  customFetch?: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}

export class SiyuanClient {
  constructor(config?: SiyuanClientConfig);

  account: AccountApi;
  ai: AiApi;
  archive: ArchiveApi;
  asset: AssetApi;
  attr: AttrApi;
  av: AvApi;
  bazaar: BazaarApi;
  block: BlockApi;
  bookmark: BookmarkApi;
  broadcast: BroadcastApi;
  clipboard: ClipboardApi;
  cloud: CloudApi;
  convert: ConvertApi;
  _export: ExportApi;
  extension: ExtensionApi;
  file: FileApi;
  filetree: FiletreeApi;
  format: FormatApi;
  graph: GraphApi;
  history: HistoryApi;
  icon: IconApi;
  import: ImportApi;
  inbox: InboxApi;
  lute: LuteApi;
  misc: MiscApi;
  network: NetworkApi;
  notebook: NotebookApi;
  notification: NotificationApi;
  outline: OutlineApi;
  petal: PetalApi;
  query: QueryApi;
  ref: RefApi;
  repo: RepoApi;
  riff: RiffApi;
  search: SearchApi;
  setting: SettingApi;
  snippet: SnippetApi;
  sqlite: SqliteApi;
  storage: StorageApi;
  sync: SyncApi;
  system: SystemApi;
  tag: TagApi;
  template: TemplateApi;
  transactions: TransactionsApi;
  ui: UiApi;
}
