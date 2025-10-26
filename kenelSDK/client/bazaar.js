// Generated API client for group bazaar
export class BazaarApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').BazaarBatchUpdatePackageParams} BazaarBatchUpdatePackageParams
 * @typedef {import('./index.d.ts').BazaarBatchUpdatePackageResponse} BazaarBatchUpdatePackageResponse
 * 根据指定的客户端类型（如 'frontend'）批量更新思源笔记本地缓存的集市包信息。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarBatchUpdatePackageParams} params - Request parameters.
 * @returns {Promise<BazaarBatchUpdatePackageResponse>}
 */
  batchUpdatePackage(params) {
    return this.fetcher('POST', '/api/bazaar/batchUpdatePackage', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetBazaarIconParams} BazaarGetBazaarIconParams
 * @typedef {import('./index.d.ts').BazaarGetBazaarIconResponse} BazaarGetBazaarIconResponse
 * 从集市获取所有可用的图标包列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetBazaarIconParams} params - Request parameters.
 * @returns {Promise<BazaarGetBazaarIconResponse>}
 */
  getBazaarIcon(params) {
    return this.fetcher('POST', '/api/bazaar/getBazaarIcon', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetBazaarPackageREAMEParams} BazaarGetBazaarPackageREAMEParams
 * @typedef {import('./index.d.ts').BazaarGetBazaarPackageREAMEResponse} BazaarGetBazaarPackageREAMEResponse
 * 获取指定集市包（通过仓库URL、哈希和类型指定）的 README 文件内容 (HTML格式)。
 * (Requires authentication)
 * @param {BazaarGetBazaarPackageREAMEParams} params - Request parameters.
 * @returns {Promise<BazaarGetBazaarPackageREAMEResponse>}
 */
  getBazaarPackageREAME(params) {
    return this.fetcher('POST', '/api/bazaar/getBazaarPackageREAME', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetBazaarPluginParams} BazaarGetBazaarPluginParams
 * @typedef {import('./index.d.ts').BazaarGetBazaarPluginResponse} BazaarGetBazaarPluginResponse
 * 从集市获取所有可用的插件列表，支持按前端类型和关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetBazaarPluginParams} params - Request parameters.
 * @returns {Promise<BazaarGetBazaarPluginResponse>}
 */
  getBazaarPlugin(params) {
    return this.fetcher('POST', '/api/bazaar/getBazaarPlugin', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetBazaarTemplateParams} BazaarGetBazaarTemplateParams
 * @typedef {import('./index.d.ts').BazaarGetBazaarTemplateResponse} BazaarGetBazaarTemplateResponse
 * 从集市获取所有可用的模板列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetBazaarTemplateParams} params - Request parameters.
 * @returns {Promise<BazaarGetBazaarTemplateResponse>}
 */
  getBazaarTemplate(params) {
    return this.fetcher('POST', '/api/bazaar/getBazaarTemplate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetBazaarThemeParams} BazaarGetBazaarThemeParams
 * @typedef {import('./index.d.ts').BazaarGetBazaarThemeResponse} BazaarGetBazaarThemeResponse
 * 从集市获取所有可用的主题列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetBazaarThemeParams} params - Request parameters.
 * @returns {Promise<BazaarGetBazaarThemeResponse>}
 */
  getBazaarTheme(params) {
    return this.fetcher('POST', '/api/bazaar/getBazaarTheme', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetBazaarWidgetParams} BazaarGetBazaarWidgetParams
 * @typedef {import('./index.d.ts').BazaarGetBazaarWidgetResponse} BazaarGetBazaarWidgetResponse
 * 从集市获取所有可用的挂件列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetBazaarWidgetParams} params - Request parameters.
 * @returns {Promise<BazaarGetBazaarWidgetResponse>}
 */
  getBazaarWidget(params) {
    return this.fetcher('POST', '/api/bazaar/getBazaarWidget', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetInstalledIconParams} BazaarGetInstalledIconParams
 * @typedef {import('./index.d.ts').BazaarGetInstalledIconResponse} BazaarGetInstalledIconResponse
 * 获取本地已安装的图标包列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetInstalledIconParams} params - Request parameters.
 * @returns {Promise<BazaarGetInstalledIconResponse>}
 */
  getInstalledIcon(params) {
    return this.fetcher('POST', '/api/bazaar/getInstalledIcon', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetInstalledPluginParams} BazaarGetInstalledPluginParams
 * @typedef {import('./index.d.ts').BazaarGetInstalledPluginResponse} BazaarGetInstalledPluginResponse
 * 获取本地已安装的插件列表，支持按前端类型和关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetInstalledPluginParams} params - Request parameters.
 * @returns {Promise<BazaarGetInstalledPluginResponse>}
 */
  getInstalledPlugin(params) {
    return this.fetcher('POST', '/api/bazaar/getInstalledPlugin', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetInstalledTemplateParams} BazaarGetInstalledTemplateParams
 * @typedef {import('./index.d.ts').BazaarGetInstalledTemplateResponse} BazaarGetInstalledTemplateResponse
 * 获取本地已安装的模板列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetInstalledTemplateParams} params - Request parameters.
 * @returns {Promise<BazaarGetInstalledTemplateResponse>}
 */
  getInstalledTemplate(params) {
    return this.fetcher('POST', '/api/bazaar/getInstalledTemplate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetInstalledThemeParams} BazaarGetInstalledThemeParams
 * @typedef {import('./index.d.ts').BazaarGetInstalledThemeResponse} BazaarGetInstalledThemeResponse
 * 获取本地已安装的主题列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetInstalledThemeParams} params - Request parameters.
 * @returns {Promise<BazaarGetInstalledThemeResponse>}
 */
  getInstalledTheme(params) {
    return this.fetcher('POST', '/api/bazaar/getInstalledTheme', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetInstalledWidgetParams} BazaarGetInstalledWidgetParams
 * @typedef {import('./index.d.ts').BazaarGetInstalledWidgetResponse} BazaarGetInstalledWidgetResponse
 * 获取本地已安装的挂件列表，支持关键词筛选。
 * (Requires authentication)
 * @param {BazaarGetInstalledWidgetParams} params - Request parameters.
 * @returns {Promise<BazaarGetInstalledWidgetResponse>}
 */
  getInstalledWidget(params) {
    return this.fetcher('POST', '/api/bazaar/getInstalledWidget', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarGetUpdatedPackageParams} BazaarGetUpdatedPackageParams
 * @typedef {import('./index.d.ts').BazaarGetUpdatedPackageResponse} BazaarGetUpdatedPackageResponse
 * 检查并返回所有已安装且存在更新的集市包（插件、挂件、图标、主题、模板）。
 * (Requires authentication)
 * @param {BazaarGetUpdatedPackageParams} params - Request parameters.
 * @returns {Promise<BazaarGetUpdatedPackageResponse>}
 */
  getUpdatedPackage(params) {
    return this.fetcher('POST', '/api/bazaar/getUpdatedPackage', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarInstallBazaarIconParams} BazaarInstallBazaarIconParams
 * @typedef {import('./index.d.ts').BazaarInstallBazaarIconResponse} BazaarInstallBazaarIconResponse
 * 从集市安装指定的图标包。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarInstallBazaarIconParams} params - Request parameters.
 * @returns {Promise<BazaarInstallBazaarIconResponse>}
 */
  installBazaarIcon(params) {
    return this.fetcher('POST', '/api/bazaar/installBazaarIcon', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarInstallBazaarPluginParams} BazaarInstallBazaarPluginParams
 * @typedef {import('./index.d.ts').BazaarInstallBazaarPluginResponse} BazaarInstallBazaarPluginResponse
 * 从集市安装指定的插件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarInstallBazaarPluginParams} params - Request parameters.
 * @returns {Promise<BazaarInstallBazaarPluginResponse>}
 */
  installBazaarPlugin(params) {
    return this.fetcher('POST', '/api/bazaar/installBazaarPlugin', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarInstallBazaarTemplateParams} BazaarInstallBazaarTemplateParams
 * @typedef {import('./index.d.ts').BazaarInstallBazaarTemplateResponse} BazaarInstallBazaarTemplateResponse
 * 从集市安装指定的模板。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarInstallBazaarTemplateParams} params - Request parameters.
 * @returns {Promise<BazaarInstallBazaarTemplateResponse>}
 */
  installBazaarTemplate(params) {
    return this.fetcher('POST', '/api/bazaar/installBazaarTemplate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarInstallBazaarThemeParams} BazaarInstallBazaarThemeParams
 * @typedef {import('./index.d.ts').BazaarInstallBazaarThemeResponse} BazaarInstallBazaarThemeResponse
 * 从集市安装指定的主题，并可指定主题模式 (mode) 和是否为更新 (update)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarInstallBazaarThemeParams} params - Request parameters.
 * @returns {Promise<BazaarInstallBazaarThemeResponse>}
 */
  installBazaarTheme(params) {
    return this.fetcher('POST', '/api/bazaar/installBazaarTheme', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarInstallBazaarWidgetParams} BazaarInstallBazaarWidgetParams
 * @typedef {import('./index.d.ts').BazaarInstallBazaarWidgetResponse} BazaarInstallBazaarWidgetResponse
 * 从集市安装指定的挂件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarInstallBazaarWidgetParams} params - Request parameters.
 * @returns {Promise<BazaarInstallBazaarWidgetResponse>}
 */
  installBazaarWidget(params) {
    return this.fetcher('POST', '/api/bazaar/installBazaarWidget', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarIconParams} BazaarUninstallBazaarIconParams
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarIconResponse} BazaarUninstallBazaarIconResponse
 * 卸载本地已安装的指定图标包。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarUninstallBazaarIconParams} params - Request parameters.
 * @returns {Promise<BazaarUninstallBazaarIconResponse>}
 */
  uninstallBazaarIcon(params) {
    return this.fetcher('POST', '/api/bazaar/uninstallBazaarIcon', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarPluginParams} BazaarUninstallBazaarPluginParams
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarPluginResponse} BazaarUninstallBazaarPluginResponse
 * 卸载本地已安装的指定插件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarUninstallBazaarPluginParams} params - Request parameters.
 * @returns {Promise<BazaarUninstallBazaarPluginResponse>}
 */
  uninstallBazaarPlugin(params) {
    return this.fetcher('POST', '/api/bazaar/uninstallBazaarPlugin', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarTemplateParams} BazaarUninstallBazaarTemplateParams
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarTemplateResponse} BazaarUninstallBazaarTemplateResponse
 * 卸载本地已安装的指定模板。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarUninstallBazaarTemplateParams} params - Request parameters.
 * @returns {Promise<BazaarUninstallBazaarTemplateResponse>}
 */
  uninstallBazaarTemplate(params) {
    return this.fetcher('POST', '/api/bazaar/uninstallBazaarTemplate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarThemeParams} BazaarUninstallBazaarThemeParams
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarThemeResponse} BazaarUninstallBazaarThemeResponse
 * 卸载本地已安装的指定主题。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarUninstallBazaarThemeParams} params - Request parameters.
 * @returns {Promise<BazaarUninstallBazaarThemeResponse>}
 */
  uninstallBazaarTheme(params) {
    return this.fetcher('POST', '/api/bazaar/uninstallBazaarTheme', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarWidgetParams} BazaarUninstallBazaarWidgetParams
 * @typedef {import('./index.d.ts').BazaarUninstallBazaarWidgetResponse} BazaarUninstallBazaarWidgetResponse
 * 卸载本地已安装的指定挂件。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {BazaarUninstallBazaarWidgetParams} params - Request parameters.
 * @returns {Promise<BazaarUninstallBazaarWidgetResponse>}
 */
  uninstallBazaarWidget(params) {
    return this.fetcher('POST', '/api/bazaar/uninstallBazaarWidget', params, true);
  }

}
