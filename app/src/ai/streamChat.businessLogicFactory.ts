import { 
    buildRequestHeaders, 
    handleOpenAILikeStreamResponse, 
    updateChatState, 
    processBlockDOMContent 
} from './chatStream.utils';
import { universalStreamRequest } from '../util/fetchStream';
import { getAIConfigFromSiyuan } from "./utils.config";
import type { StreamChatBusinessLogic } from '../components/streamChat.componentLogic';

/**
 * 创建流式聊天业务逻辑依赖
 * @returns 业务逻辑依赖对象
 */
export const createSiyuanStreamChatBusinessLogic = (): StreamChatBusinessLogic => {
    const aiConfig = getAIConfigFromSiyuan();
    return {
        buildRequestHeaders:()=> buildRequestHeaders(aiConfig),
        handleOpenAILikeStreamResponse,
        updateChatState,
        processBlockDOMContent,
        universalStreamRequest,
        getAIConfigFromSiyuan
    };
};