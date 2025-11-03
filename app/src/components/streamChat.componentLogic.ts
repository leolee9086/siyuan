// 重新导出所有拆分后的模块，保持向后兼容
export { handleAIRequest } from './streamChat.business';
export { useStreamChatUI, getI18nText } from './streamChat.ui';
export type {
    StreamChatBusinessLogic,
    StreamChatUIContext,
    StreamHandlers,
    MessageHistory,
    AIRequestParams,
    StreamChatUIReturn
} from './streamChat.types';