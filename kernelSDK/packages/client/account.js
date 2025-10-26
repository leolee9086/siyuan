// Generated API client for group account
export class AccountApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').AccountCheckActivationcodeParams} AccountCheckActivationcodeParams
 * @typedef {import('./index.d.ts').AccountCheckActivationcodeResponse} AccountCheckActivationcodeResponse
 * 检查用户输入的激活码是否有效。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AccountCheckActivationcodeParams} params - Request parameters.
 * @returns {Promise<AccountCheckActivationcodeResponse>}
 */
  checkActivationcode(params) {
    return this.fetcher('POST', '/api/account/checkActivationcode', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AccountDeactivateUserResponse} AccountDeactivateUserResponse
 * 注销当前用户账号。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<AccountDeactivateUserResponse>}
 */
  deactivateUser() {
    return this.fetcher('POST', '/api/account/deactivate', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').AccountLoginParams} AccountLoginParams
 * @typedef {import('./index.d.ts').AccountLoginResponse} AccountLoginResponse
 * 用户登录，需要提供用户名、密码、验证码和云端区域。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AccountLoginParams} params - Request parameters.
 * @returns {Promise<AccountLoginResponse>}
 */
  login(params) {
    return this.fetcher('POST', '/api/account/login', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AccountStartFreeTrialResponse} AccountStartFreeTrialResponse
 * 为当前用户开启免费试用。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @returns {Promise<AccountStartFreeTrialResponse>}
 */
  startFreeTrial() {
    return this.fetcher('POST', '/api/account/startFreeTrial', {}, true);
  }

  /**
 * @typedef {import('./index.d.ts').AccountUseActivationcodeParams} AccountUseActivationcodeParams
 * @typedef {import('./index.d.ts').AccountUseActivationcodeResponse} AccountUseActivationcodeResponse
 * 使用激活码激活账户。
 * (Requires authentication, Requires admin role, Unavailable in read-only mode)
 * @param {AccountUseActivationcodeParams} params - Request parameters.
 * @returns {Promise<AccountUseActivationcodeResponse>}
 */
  useActivationcode(params) {
    return this.fetcher('POST', '/api/account/useActivationcode', params, true);
  }

}
