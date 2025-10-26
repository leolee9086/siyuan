// Generated API client for group system
export class SystemApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').SystemAddMicrosoftDefenderExclusionResponse} SystemAddMicrosoftDefenderExclusionResponse
 * 将思源笔记相关目录添加到 Microsoft Defender 的排除项中，以避免潜在的性能问题或冲突。此操作仅在 Windows 系统上有效。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SystemAddMicrosoftDefenderExclusionResponse>}
 */
  addMicrosoftDefenderExclusion() {
    return this.fetcher('POST', '/api/system/addMicrosoftDefenderExclusion', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemBootProgressResponse} SystemBootProgressResponse
 * 获取思源笔记内核的启动进度。此接口也接受 POST 请求。
 * @returns {Promise<SystemBootProgressResponse>}
 */
  bootProgress() {
    return this.fetcher('GET', '/api/system/bootProgress', undefined, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemBootProgressResponse} SystemBootProgressResponse
 * 获取思源笔记内核的启动进度。此接口也接受 GET 请求。
 * @returns {Promise<SystemBootProgressResponse>}
 */
  bootProgress() {
    return this.fetcher('POST', '/api/system/bootProgress', {}, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemCheckUpdateParams} SystemCheckUpdateParams
 * @typedef {import('./index.d.ts').SystemCheckUpdateResponse} SystemCheckUpdateResponse
 * 检查思源笔记是否有新版本。
 * (Requires authentication, Requires admin role)
 * @param {SystemCheckUpdateParams} params - Request parameters.
 * @returns {Promise<SystemCheckUpdateResponse>}
 */
  checkUpdate(params) {
    return this.fetcher('POST', '/api/system/checkUpdate', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemCheckWorkspaceDirParams} SystemCheckWorkspaceDirParams
 * @typedef {import('./index.d.ts').SystemCheckWorkspaceDirResponse} SystemCheckWorkspaceDirResponse
 * 检查指定路径是否可以作为思源笔记的工作空间目录。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemCheckWorkspaceDirParams} params - Request parameters.
 * @returns {Promise<SystemCheckWorkspaceDirResponse>}
 */
  checkWorkspaceDir(params) {
    return this.fetcher('POST', '/api/system/checkWorkspaceDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemCreateWorkspaceDirParams} SystemCreateWorkspaceDirParams
 * @typedef {import('./index.d.ts').SystemCreateWorkspaceDirResponse} SystemCreateWorkspaceDirResponse
 * 在指定路径创建一个新的思源笔记工作空间。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemCreateWorkspaceDirParams} params - Request parameters.
 * @returns {Promise<SystemCreateWorkspaceDirResponse>}
 */
  createWorkspaceDir(params) {
    return this.fetcher('POST', '/api/system/createWorkspaceDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemCurrentTimeResponse} SystemCurrentTimeResponse
 * 获取思源笔记服务器当前的 Unix 时间戳 (毫秒)。
 * @returns {Promise<SystemCurrentTimeResponse>}
 */
  currentTime() {
    return this.fetcher('POST', '/api/system/currentTime', {}, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemExitResponse} SystemExitResponse
 * 关闭并退出思源笔记程序。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SystemExitResponse>}
 */
  exit() {
    return this.fetcher('POST', '/api/system/exit', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemExportConfResponse} SystemExportConfResponse
 * 导出一份包含当前用户所有配置的 JSON 文件。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SystemExportConfResponse>}
 */
  exportConf() {
    return this.fetcher('POST', '/api/system/exportConf', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemExportLogResponse} SystemExportLogResponse
 * 导出包含系统运行日志的压缩文件。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SystemExportLogResponse>}
 */
  exportLog() {
    return this.fetcher('POST', '/api/system/exportLog', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetCaptchaResponse} SystemGetCaptchaResponse
 * 获取用于登录验证的图片验证码。
 * @returns {Promise<SystemGetCaptchaResponse>}
 */
  GetCaptcha() {
    return this.fetcher('GET', '/api/system/getCaptcha', undefined, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetChangelogResponse} SystemGetChangelogResponse
 * 获取当前版本的更新日志内容 (Markdown 格式转换为 HTML)。
 * (Requires authentication)
 * @returns {Promise<SystemGetChangelogResponse>}
 */
  getChangelog() {
    return this.fetcher('POST', '/api/system/getChangelog', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetConfResponse} SystemGetConfResponse
 * 获取思源笔记的全部配置信息。配置项繁多，具体结构请参考 `siyuan/kernel/conf/conf.go` 中的 `Conf` 结构体。
 * (Requires authentication)
 * @returns {Promise<SystemGetConfResponse>}
 */
  getConf() {
    return this.fetcher('POST', '/api/system/getConf', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetEmojiConfResponse} SystemGetEmojiConfResponse
 * 获取内置及自定义 Emoji 的配置信息，用于 Emoji 选择器等功能。
 * (Requires authentication)
 * @returns {Promise<SystemGetEmojiConfResponse>}
 */
  getEmojiConf() {
    return this.fetcher('POST', '/api/system/getEmojiConf', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetMobileWorkspacesResponse} SystemGetMobileWorkspacesResponse
 * 获取用于移动端同步的工作空间列表。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SystemGetMobileWorkspacesResponse>}
 */
  getMobileWorkspaces() {
    return this.fetcher('POST', '/api/system/getMobileWorkspaces', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetNetworkResponse} SystemGetNetworkResponse
 * 获取当前的网络代理等配置信息。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SystemGetNetworkResponse>}
 */
  getNetwork() {
    return this.fetcher('POST', '/api/system/getNetwork', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetSysFontsResponse} SystemGetSysFontsResponse
 * 获取当前操作系统上安装的可用字体列表。
 * (Requires authentication, Requires admin role)
 * @returns {Promise<SystemGetSysFontsResponse>}
 */
  getSysFonts() {
    return this.fetcher('POST', '/api/system/getSysFonts', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetWorkspaceInfoResponse} SystemGetWorkspaceInfoResponse
 * 获取当前打开的工作空间目录路径和思源版本号。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SystemGetWorkspaceInfoResponse>}
 */
  getWorkspaceInfo() {
    return this.fetcher('POST', '/api/system/getWorkspaceInfo', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemGetWorkspacesResponse} SystemGetWorkspacesResponse
 * 获取所有已配置或曾经打开过的工作空间列表。
 * (Requires authentication)
 * @returns {Promise<SystemGetWorkspacesResponse>}
 */
  getWorkspaces() {
    return this.fetcher('POST', '/api/system/getWorkspaces', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemIgnoreAddMicrosoftDefenderExclusionResponse} SystemIgnoreAddMicrosoftDefenderExclusionResponse
 * 设置不再提示用户添加 Microsoft Defender 排除项。此操作仅在 Windows 系统上有效。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SystemIgnoreAddMicrosoftDefenderExclusionResponse>}
 */
  ignoreAddMicrosoftDefenderExclusion() {
    return this.fetcher('POST', '/api/system/ignoreAddMicrosoftDefenderExclusion', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemImportConfParams} SystemImportConfParams
 * @typedef {import('./index.d.ts').SystemImportConfResponse} SystemImportConfResponse
 * 通过上传 `conf.json` 文件来导入用户配置。导入成功后通常需要重启或刷新UI生效。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemImportConfParams} params - Request parameters.
 * @returns {Promise<SystemImportConfResponse>}
 */
  importConf(params) {
    return this.fetcher('POST', '/api/system/importConf', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemLoginAuthParams} SystemLoginAuthParams
 * @typedef {import('./index.d.ts').SystemLoginAuthResponse} SystemLoginAuthResponse
 * 使用访问授权码或用户名密码进行登录验证。
 * @param {SystemLoginAuthParams} params - Request parameters.
 * @returns {Promise<SystemLoginAuthResponse>}
 */
  LoginAuth(params) {
    return this.fetcher('POST', '/api/system/loginAuth', params, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemLogoutAuthResponse} SystemLogoutAuthResponse
 * 清除当前的登录授权状态。
 * @returns {Promise<SystemLogoutAuthResponse>}
 */
  LogoutAuth() {
    return this.fetcher('POST', '/api/system/logoutAuth', {}, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemReloadUIResponse} SystemReloadUIResponse
 * 命令客户端重新加载思源笔记的用户界面。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<SystemReloadUIResponse>}
 */
  reloadUI() {
    return this.fetcher('POST', '/api/system/reloadUI', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemRemoveWorkspaceDirParams} SystemRemoveWorkspaceDirParams
 * @typedef {import('./index.d.ts').SystemRemoveWorkspaceDirResponse} SystemRemoveWorkspaceDirResponse
 * 从工作空间列表中移除指定的目录（逻辑删除，不删除物理文件）。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemRemoveWorkspaceDirParams} params - Request parameters.
 * @returns {Promise<SystemRemoveWorkspaceDirResponse>}
 */
  removeWorkspaceDir(params) {
    return this.fetcher('POST', '/api/system/removeWorkspaceDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemRemoveWorkspaceDirPhysicallyParams} SystemRemoveWorkspaceDirPhysicallyParams
 * @typedef {import('./index.d.ts').SystemRemoveWorkspaceDirPhysicallyResponse} SystemRemoveWorkspaceDirPhysicallyResponse
 * 从工作空间列表中移除并物理删除指定目录及其所有内容。这是一个危险操作！
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemRemoveWorkspaceDirPhysicallyParams} params - Request parameters.
 * @returns {Promise<SystemRemoveWorkspaceDirPhysicallyResponse>}
 */
  removeWorkspaceDirPhysically(params) {
    return this.fetcher('POST', '/api/system/removeWorkspaceDirPhysically', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetAPITokenParams} SystemSetAPITokenParams
 * @typedef {import('./index.d.ts').SystemSetAPITokenResponse} SystemSetAPITokenResponse
 * 设置或清空 API 访问令牌 (token)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetAPITokenParams} params - Request parameters.
 * @returns {Promise<SystemSetAPITokenResponse>}
 */
  setAPIToken(params) {
    return this.fetcher('POST', '/api/system/setAPIToken', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetAccessAuthCodeParams} SystemSetAccessAuthCodeParams
 * @typedef {import('./index.d.ts').SystemSetAccessAuthCodeResponse} SystemSetAccessAuthCodeResponse
 * 设置或清空访问思源笔记的授权码。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetAccessAuthCodeParams} params - Request parameters.
 * @returns {Promise<SystemSetAccessAuthCodeResponse>}
 */
  setAccessAuthCode(params) {
    return this.fetcher('POST', '/api/system/setAccessAuthCode', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetAppearanceModeParams} SystemSetAppearanceModeParams
 * @typedef {import('./index.d.ts').SystemSetAppearanceModeResponse} SystemSetAppearanceModeResponse
 * 设置思源笔记的外观模式 (亮色/暗色)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetAppearanceModeParams} params - Request parameters.
 * @returns {Promise<SystemSetAppearanceModeResponse>}
 */
  setAppearanceMode(params) {
    return this.fetcher('POST', '/api/system/setAppearanceMode', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetAutoLaunchParams} SystemSetAutoLaunchParams
 * @typedef {import('./index.d.ts').SystemSetAutoLaunchResponse} SystemSetAutoLaunchResponse
 * 设置思源笔记是否开机自启动 (仅对桌面客户端有效)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetAutoLaunchParams} params - Request parameters.
 * @returns {Promise<SystemSetAutoLaunchResponse>}
 */
  setAutoLaunch(params) {
    return this.fetcher('POST', '/api/system/setAutoLaunch', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetDownloadInstallPkgParams} SystemSetDownloadInstallPkgParams
 * @typedef {import('./index.d.ts').SystemSetDownloadInstallPkgResponse} SystemSetDownloadInstallPkgResponse
 * 设置是否在检测到新版本后自动下载并安装更新包。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetDownloadInstallPkgParams} params - Request parameters.
 * @returns {Promise<SystemSetDownloadInstallPkgResponse>}
 */
  setDownloadInstallPkg(params) {
    return this.fetcher('POST', '/api/system/setDownloadInstallPkg', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetFollowSystemLockScreenParams} SystemSetFollowSystemLockScreenParams
 * @typedef {import('./index.d.ts').SystemSetFollowSystemLockScreenResponse} SystemSetFollowSystemLockScreenResponse
 * 设置思源笔记是否在系统锁屏时自动锁定 (仅对桌面客户端有效)。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetFollowSystemLockScreenParams} params - Request parameters.
 * @returns {Promise<SystemSetFollowSystemLockScreenResponse>}
 */
  setFollowSystemLockScreen(params) {
    return this.fetcher('POST', '/api/system/setFollowSystemLockScreen', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetGoogleAnalyticsParams} SystemSetGoogleAnalyticsParams
 * @typedef {import('./index.d.ts').SystemSetGoogleAnalyticsResponse} SystemSetGoogleAnalyticsResponse
 * 启用或禁用 Google Analytics 数据追踪。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetGoogleAnalyticsParams} params - Request parameters.
 * @returns {Promise<SystemSetGoogleAnalyticsResponse>}
 */
  setGoogleAnalytics(params) {
    return this.fetcher('POST', '/api/system/setGoogleAnalytics', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetNetworkProxyParams} SystemSetNetworkProxyParams
 * @typedef {import('./index.d.ts').SystemSetNetworkProxyResponse} SystemSetNetworkProxyResponse
 * 设置网络连接时使用的代理服务器。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetNetworkProxyParams} params - Request parameters.
 * @returns {Promise<SystemSetNetworkProxyResponse>}
 */
  setNetworkProxy(params) {
    return this.fetcher('POST', '/api/system/setNetworkProxy', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetNetworkServeParams} SystemSetNetworkServeParams
 * @typedef {import('./index.d.ts').SystemSetNetworkServeResponse} SystemSetNetworkServeResponse
 * 配置思源笔记的网络服务，如服务端口、是否允许其他设备访问等。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetNetworkServeParams} params - Request parameters.
 * @returns {Promise<SystemSetNetworkServeResponse>}
 */
  setNetworkServe(params) {
    return this.fetcher('POST', '/api/system/setNetworkServe', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetUILayoutParams} SystemSetUILayoutParams
 * @typedef {import('./index.d.ts').SystemSetUILayoutResponse} SystemSetUILayoutResponse
 * 设置用户界面的布局模式，例如左右布局、顶部分栏等。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetUILayoutParams} params - Request parameters.
 * @returns {Promise<SystemSetUILayoutResponse>}
 */
  setUILayout(params) {
    return this.fetcher('POST', '/api/system/setUILayout', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemSetWorkspaceDirParams} SystemSetWorkspaceDirParams
 * @typedef {import('./index.d.ts').SystemSetWorkspaceDirResponse} SystemSetWorkspaceDirResponse
 * 切换到指定路径的工作空间。成功后通常需要重启或刷新 UI。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {SystemSetWorkspaceDirParams} params - Request parameters.
 * @returns {Promise<SystemSetWorkspaceDirResponse>}
 */
  setWorkspaceDir(params) {
    return this.fetcher('POST', '/api/system/setWorkspaceDir', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').SystemAddUIProcessParams} SystemAddUIProcessParams
 * @typedef {import('./index.d.ts').SystemAddUIProcessResponse} SystemAddUIProcessResponse
 * （内部接口）用于桌面端添加 UI 进程的相关信息，如 PID。通常不由普通用户或第三方应用直接调用。
 * @param {SystemAddUIProcessParams} params - Request parameters.
 * @returns {Promise<SystemAddUIProcessResponse>}
 */
  addUIProcess(params) {
    return this.fetcher('POST', '/api/system/uiproc', params, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemVersionResponse} SystemVersionResponse
 * 获取当前思源笔记内核的版本号。此接口也接受 POST 请求。
 * @returns {Promise<SystemVersionResponse>}
 */
  version() {
    return this.fetcher('GET', '/api/system/version', undefined, false);
  }

  /**
 * @typedef {import('./index.d.ts').SystemVersionResponse} SystemVersionResponse
 * 获取当前思源笔记内核的版本号。此接口也接受 GET 请求。
 * @returns {Promise<SystemVersionResponse>}
 */
  version() {
    return this.fetcher('POST', '/api/system/version', {}, false);
  }

}
