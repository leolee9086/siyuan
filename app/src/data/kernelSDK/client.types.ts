/**
 * kernelSDK 客户端相关类型定义
 *
 * 由于合并所有 API 定义会导致类型过于复杂，无法使用 as const 保留字面量类型，
 * 因此这里使用类型联合来构建完整的客户端类型。
 */

import type {
    ApiMethods,
    SyncApiMethods,
    // 导入所有 API 定义类型
    AccountApiDefs,
    AiApiDefs,
    ArchiveApiDefs,
    AttrApiDefs,
    AvApiDefs,
    AssetApiDefs,
    BazaarApiDefs,
    BookmarkApiDefs,
    BroadcastApiDefs,
    ClipboardApiDefs,
    CloudApiDefs,
    ConvertApiDefs,
    EmbeddingApiDefs,
    ExportApiDefs,
    ExtensionApiDefs,
    FileApiDefs,
    FiletreeApiDefs,
    FormatApiDefs,
    GraphApiDefs,
    HistoryApiDefs,
    IconApiDefs,
    ImportApiDefs,
    InboxApiDefs,
    LuteApiDefs,
    MiscApiDefs,
    NetworkApiDefs,
    NotebookApiDefs,
    NotificationApiDefs,
    OutlineApiDefs,
    PetalApiDefs,
    QueryApiDefs,
    RefApiDefs,
    RepoApiDefs,
    RiffApiDefs,
    SearchApiDefs,
    SettingApiDefs,
    SnippetApiDefs,
    SqliteApiDefs,
    StorageApiDefs,
    SyncApiDefs,
    SystemApiDefs,
    TagApiDefs,
    TemplateApiDefs,
    TransactionsApiDefs,
    UiApiDefs,
    VectorApiDefs,
    // block 子模块类型
    BlockInsertApiDefs,
    BlockUpdateApiDefs,
    BlockDeleteAndMoveApiDefs,
    BlockQueryApiDefs,
    BlockRefApiDefs,
    BlockHeadingApiDefs,
    BlockMiscApiDefs,
} from "@leolee9086/siyuan-kernel-sdk";

/**
 * 所有 API 定义的联合类型
 *
 * 使用类型联合而非运行时数组推断，避免 TypeScript 类型过于复杂的问题
 */
export type AllApiDefsType = readonly [
    ...AccountApiDefs,
    ...AiApiDefs,
    ...ArchiveApiDefs,
    ...AttrApiDefs,
    ...AvApiDefs,
    ...AssetApiDefs,
    ...BazaarApiDefs,
    ...BookmarkApiDefs,
    ...BroadcastApiDefs,
    ...ClipboardApiDefs,
    ...CloudApiDefs,
    ...ConvertApiDefs,
    ...EmbeddingApiDefs,
    ...ExportApiDefs,
    ...ExtensionApiDefs,
    ...FileApiDefs,
    ...FiletreeApiDefs,
    ...FormatApiDefs,
    ...GraphApiDefs,
    ...HistoryApiDefs,
    ...IconApiDefs,
    ...ImportApiDefs,
    ...InboxApiDefs,
    ...LuteApiDefs,
    ...MiscApiDefs,
    ...NetworkApiDefs,
    ...NotebookApiDefs,
    ...NotificationApiDefs,
    ...OutlineApiDefs,
    ...PetalApiDefs,
    ...QueryApiDefs,
    ...RefApiDefs,
    ...RepoApiDefs,
    ...RiffApiDefs,
    ...SearchApiDefs,
    ...SettingApiDefs,
    ...SnippetApiDefs,
    ...SqliteApiDefs,
    ...StorageApiDefs,
    ...SyncApiDefs,
    ...SystemApiDefs,
    ...TagApiDefs,
    ...TemplateApiDefs,
    ...TransactionsApiDefs,
    ...UiApiDefs,
    ...VectorApiDefs,
    // block 子模块
    ...BlockInsertApiDefs,
    ...BlockUpdateApiDefs,
    ...BlockDeleteAndMoveApiDefs,
    ...BlockQueryApiDefs,
    ...BlockRefApiDefs,
    ...BlockHeadingApiDefs,
    ...BlockMiscApiDefs,
];

/**
 * kernelSDK 客户端实例类型
 *
 * 这个类型包含了所有可用的 API 方法，
 * 可以用于类型标注和 IDE 智能提示。
 *
 * 所有方法都是必选的（非可选），调用时无需进行 undefined 检查。
 *
 * 包含 $sync 属性用于同步调用 API 方法。
 */
export type KernelClientType = ApiMethods<AllApiDefsType> & {
    /** 同步方法访问器 - 通过 .$sync.方法名 进行同步调用 */
    $sync: SyncApiMethods<AllApiDefsType>;
};
