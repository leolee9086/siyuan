// Generated API client for group ai
export class AiApi {
    constructor(fetcher) {
        this.fetcher = fetcher;
    }

  /**
 * @typedef {import('./index.d.ts').AiChatGPTParams} AiChatGPTParams
 * @typedef {import('./index.d.ts').AiChatGPTResponse} AiChatGPTResponse
 * 与 ChatGPT 进行简单对话。
 * (Requires authentication, Requires admin role)
 * @param {AiChatGPTParams} params - Request parameters.
 * @returns {Promise<AiChatGPTResponse>}
 */
  chatGPT(params) {
    return this.fetcher('POST', '/api/ai/chatGPT', params, true);
  }

  /**
 * @typedef {import('./index.d.ts').AiChatGPTWithActionParams} AiChatGPTWithActionParams
 * @typedef {import('./index.d.ts').AiChatGPTWithActionResponse} AiChatGPTWithActionResponse
 * 调用 ChatGPT 对指定的块ID列表执行特定动作。
 * (Requires authentication, Requires admin role)
 * @param {AiChatGPTWithActionParams} params - Request parameters.
 * @returns {Promise<AiChatGPTWithActionResponse>}
 */
  chatGPTWithAction(params) {
    return this.fetcher('POST', '/api/ai/chatGPTWithAction', params, true);
  }

}
