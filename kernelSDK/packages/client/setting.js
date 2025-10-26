// Generated API client for group setting
export class SettingApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').SettingAddVirtualBlockRefExcludeParams} SettingAddVirtualBlockRefExcludeParams
 * @typedef {import('./index.d.ts').SettingAddVirtualBlockRefExcludeResponse} SettingAddVirtualBlockRefExcludeResponse
 * 将指定的关键字列表添加到虚拟块引用的全局排除列表中。这些关键字将不会用于生成虚拟引用。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingAddVirtualBlockRefExcludeParams} params - Request parameters.
 * @returns {Promise<SettingAddVirtualBlockRefExcludeResponse>}
 */
  addVirtualBlockRefExclude(params) {
    return this.fetcher('POST', '/api/setting/addVirtualBlockRefExclude', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingAddVirtualBlockRefIncludeParams} SettingAddVirtualBlockRefIncludeParams
 * @typedef {import('./index.d.ts').SettingAddVirtualBlockRefIncludeResponse} SettingAddVirtualBlockRefIncludeResponse
 * 将指定的关键字列表添加到虚拟块引用的全局包含列表中。只有这些关键字才可能用于生成虚拟引用（如果全局虚拟引用开关已打开）。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingAddVirtualBlockRefIncludeParams} params - Request parameters.
 * @returns {Promise<SettingAddVirtualBlockRefIncludeResponse>}
 */
  addVirtualBlockRefInclude(params) {
    return this.fetcher('POST', '/api/setting/addVirtualBlockRefInclude', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingGetCloudUserParams} SettingGetCloudUserParams
 * @typedef {import('./index.d.ts').SettingGetCloudUserResponse} SettingGetCloudUserResponse
 * 刷新并获取当前登录的思源云端账户信息。
 * (Requires authentication)
 * @param {SettingGetCloudUserParams} params - Request parameters.
 * @returns {Promise<SettingGetCloudUserResponse>}
 */
  getCloudUser(params) {
    return this.fetcher('POST', '/api/setting/getCloudUser', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingGetPublishResponse} SettingGetPublishResponse
 * 获取当前的发布服务配置信息，包括端口和具体的发布设置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SettingGetPublishResponse>}
 */
  getPublish() {
    return this.fetcher('POST', '/api/setting/getPublish', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingLogin2faCloudUserParams} SettingLogin2faCloudUserParams
 * @typedef {import('./index.d.ts').SettingLogin2faCloudUserResponse} SettingLogin2faCloudUserResponse
 * 使用令牌和两步验证码完成云端用户的登录过程。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingLogin2faCloudUserParams} params - Request parameters.
 * @returns {Promise<SettingLogin2faCloudUserResponse>}
 */
  login2faCloudUser(params) {
    return this.fetcher('POST', '/api/setting/login2faCloudUser', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingLogoutCloudUserResponse} SettingLogoutCloudUserResponse
 * 登出当前已登录的思源云端账户。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SettingLogoutCloudUserResponse>}
 */
  logoutCloudUser() {
    return this.fetcher('POST', '/api/setting/logoutCloudUser', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingRefreshVirtualBlockRefResponse} SettingRefreshVirtualBlockRefResponse
 * 清除并重建虚拟块引用的缓存。当虚拟引用的相关配置（如包含/排除列表、编辑器中的开关）发生变化后，可能需要调用此接口。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SettingRefreshVirtualBlockRefResponse>}
 */
  refreshVirtualBlockRef() {
    return this.fetcher('POST', '/api/setting/refreshVirtualBlockRef', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetAIParams} SettingSetAIParams
 * @typedef {import('./index.d.ts').SettingSetAIResponse} SettingSetAIResponse
 * @typedef {import('./index.d.ts').SettingSetAIParamsOpenAI} SettingSetAIParamsOpenAI
 * 更新AI相关的配置，主要针对OpenAI服务。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetAIParams} params - Request parameters.
 * @returns {Promise<SettingSetAIResponse>}
 */
  setAI(params) {
    return this.fetcher('POST', '/api/setting/setAI', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetAccountParams} SettingSetAccountParams
 * @typedef {import('./index.d.ts').SettingSetAccountResponse} SettingSetAccountResponse
 * 更新用户账户相关的显示配置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetAccountParams} params - Request parameters.
 * @returns {Promise<SettingSetAccountResponse>}
 */
  setAccount(params) {
    return this.fetcher('POST', '/api/setting/setAccount', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetAppearanceParams} SettingSetAppearanceParams
 * @typedef {import('./index.d.ts').SettingSetAppearanceResponse} SettingSetAppearanceResponse
 * 更新应用的外观相关配置，如主题、字体、语言等。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetAppearanceParams} params - Request parameters.
 * @returns {Promise<SettingSetAppearanceResponse>}
 */
  setAppearance(params) {
    return this.fetcher('POST', '/api/setting/setAppearance', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetBazaarParams} SettingSetBazaarParams
 * @typedef {import('./index.d.ts').SettingSetBazaarResponse} SettingSetBazaarResponse
 * 更新与集市相关的配置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetBazaarParams} params - Request parameters.
 * @returns {Promise<SettingSetBazaarResponse>}
 */
  setBazaar(params) {
    return this.fetcher('POST', '/api/setting/setBazaar', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetEditorParams} SettingSetEditorParams
 * @typedef {import('./index.d.ts').SettingSetEditorResponse} SettingSetEditorResponse
 * 更新编辑器相关的各种配置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetEditorParams} params - Request parameters.
 * @returns {Promise<SettingSetEditorResponse>}
 */
  setEditor(params) {
    return this.fetcher('POST', '/api/setting/setEditor', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetEditorReadOnlyParams} SettingSetEditorReadOnlyParams
 * @typedef {import('./index.d.ts').SettingSetEditorReadOnlyResponse} SettingSetEditorReadOnlyResponse
 * 单独设置整个编辑器的只读状态。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetEditorReadOnlyParams} params - Request parameters.
 * @returns {Promise<SettingSetEditorReadOnlyResponse>}
 */
  setEditorReadOnly(params) {
    return this.fetcher('POST', '/api/setting/setEditorReadOnly', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetEmojiParams} SettingSetEmojiParams
 * @typedef {import('./index.d.ts').SettingSetEmojiResponse} SettingSetEmojiResponse
 * 更新编辑器配置中的常用表情列表。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetEmojiParams} params - Request parameters.
 * @returns {Promise<SettingSetEmojiResponse>}
 */
  setEmoji(params) {
    return this.fetcher('POST', '/api/setting/setEmoji', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetExportParams} SettingSetExportParams
 * @typedef {import('./index.d.ts').SettingSetExportResponse} SettingSetExportResponse
 * 更新与导出功能相关的配置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetExportParams} params - Request parameters.
 * @returns {Promise<SettingSetExportResponse>}
 */
  setExport(params) {
    return this.fetcher('POST', '/api/setting/setExport', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetFiletreeParams} SettingSetFiletreeParams
 * @typedef {import('./index.d.ts').SettingSetFiletreeResponse} SettingSetFiletreeResponse
 * 更新文件树（文档列表）相关的配置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetFiletreeParams} params - Request parameters.
 * @returns {Promise<SettingSetFiletreeResponse>}
 */
  setFiletree(params) {
    return this.fetcher('POST', '/api/setting/setFiletree', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetFlashcardParams} SettingSetFlashcardParams
 * @typedef {import('./index.d.ts').SettingSetFlashcardResponse} SettingSetFlashcardResponse
 * 更新与闪卡（FSRS算法）相关的配置。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetFlashcardParams} params - Request parameters.
 * @returns {Promise<SettingSetFlashcardResponse>}
 */
  setFlashcard(params) {
    return this.fetcher('POST', '/api/setting/setFlashcard', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetKeymapParams} SettingSetKeymapParams
 * @typedef {import('./index.d.ts').SettingSetKeymapResponse} SettingSetKeymapResponse
 * @typedef {import('./index.d.ts').SettingSetKeymapParamsData} SettingSetKeymapParamsData
 * 更新用户自定义的快捷键映射。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetKeymapParams} params - Request parameters.
 * @returns {Promise<SettingSetKeymapResponse>}
 */
  setKeymap(params) {
    return this.fetcher('POST', '/api/setting/setKeymap', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetPublishParams} SettingSetPublishParams
 * @typedef {import('./index.d.ts').SettingSetPublishResponse} SettingSetPublishResponse
 * @typedef {import('./index.d.ts').SettingSetPublishParamsAuth} SettingSetPublishParamsAuth
 * 更新发布服务的配置，并尝试根据新配置初始化（或重启）发布服务。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetPublishParams} params - Request parameters.
 * @returns {Promise<SettingSetPublishResponse>}
 */
  setPublish(params) {
    return this.fetcher('POST', '/api/setting/setPublish', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetSearchParams} SettingSetSearchParams
 * @typedef {import('./index.d.ts').SettingSetSearchResponse} SettingSetSearchResponse
 * 更新与搜索功能相关的配置，部分配置更改可能触发重建索引。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetSearchParams} params - Request parameters.
 * @returns {Promise<SettingSetSearchResponse>}
 */
  setSearch(params) {
    return this.fetcher('POST', '/api/setting/setSearch', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SettingSetConfSnippetParams} SettingSetConfSnippetParams
 * @typedef {import('./index.d.ts').SettingSetConfSnippetResponse} SettingSetConfSnippetResponse
 * 更新代码片段（Snippets）的启用状态，如是否启用自定义CSS和JS。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SettingSetConfSnippetParams} params - Request parameters.
 * @returns {Promise<SettingSetConfSnippetResponse>}
 */
  setConfSnippet(params) {
    return this.fetcher('POST', '/api/setting/setSnippet', params, true);
  }

}
