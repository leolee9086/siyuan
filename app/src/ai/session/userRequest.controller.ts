import { 
    UserRequestEventType, 
    UserRequestState,
} from './session.types';
import { EventEmitter } from '../eventEmitter';

/**
 * 用户请求控制器实现类
 * 基于事件发射器模式，管理用户请求的状态和操作
 */
export class UserMessageController extends EventEmitter  {
    private state: UserRequestState;
    private abortFunction: (() => void) | null = null;

    constructor(initialState?: Partial<UserRequestState>) {
        super();
        this.state = {
            requestContentStr: '',
            isProcessing: false,
            isCompleted: false,
            isCancelled: false,
            isPaused: false,
            requestTimestamp: Date.now(),
            completionTimestamp: null,
            targetBlockId: null,
            requestType: 'text-generation',
            requestParams: {},
            savedRequests: [],
            ...initialState
        };
    }

    // 状态查询方法实现
    getState(): UserRequestState {
        return { ...this.state };
    }

    getRequestContent(): string {
        return this.state.requestContentStr;
    }

    isProcessing(): boolean {
        return this.state.isProcessing;
    }

    isCompleted(): boolean {
        return this.state.isCompleted;
    }

    isCancelled(): boolean {
        return this.state.isCancelled;
    }

    isPaused(): boolean {
        return this.state.isPaused;
    }

    getRequestType(): string {
        return this.state.requestType;
    }

    getRequestParams(): Record<string, any> {
        return { ...this.state.requestParams };
    }

    getTargetBlockId(): string | null {
        return this.state.targetBlockId;
    }

    getSavedRequests(): UserRequestState['savedRequests'] {
        return [...this.state.savedRequests];
    }

    // 请求操作方法实现
    updateRequestContent(content: string): void {
        const oldContent = this.state.requestContentStr;
        this.state.requestContentStr = content;
        this.state.requestTimestamp = Date.now();
        
        this.emit(UserRequestEventType.CONTENT_CHANGED, {
            oldContent,
            newContent: content,
            timestamp: this.state.requestTimestamp
        });
    }

    startProcessing(): void {
        this.state.isProcessing = true;
        this.state.isCompleted = false;
        this.state.isCancelled = false;
        this.state.isPaused = false;
        
        this.emit(UserRequestEventType.PROCESSING_STARTED, {
            content: this.state.requestContentStr,
            type: this.state.requestType,
            params: this.state.requestParams,
            timestamp: Date.now()
        });
    }

    completeProcessing(result?: any): void {
        const startTime = this.state.requestTimestamp;
        this.state.isProcessing = false;
        this.state.isCompleted = true;
        this.state.completionTimestamp = Date.now();
        
        const duration = this.state.completionTimestamp - startTime;
        
        this.emit(UserRequestEventType.PROCESSING_COMPLETED, {
            content: this.state.requestContentStr,
            result,
            duration,
            timestamp: this.state.completionTimestamp
        });
        
        this.saveCurrentRequest();
    }

    cancelProcessing(reason?: string): void {
        if (this.state.isProcessing) {
            this.state.isProcessing = false;
            this.state.isCancelled = true;
            
            if (this.abortFunction) {
                this.abortFunction();
            }
            
            this.emit(UserRequestEventType.PROCESSING_CANCELLED, {
                content: this.state.requestContentStr,
                reason,
                timestamp: Date.now()
            });
        }
    }

    pauseProcessing(): void {
        if (this.state.isProcessing && !this.state.isPaused) {
            this.state.isPaused = true;
            
            if (this.abortFunction) {
                this.abortFunction();
            }
            
            this.emit(UserRequestEventType.PROCESSING_PAUSED, {
                content: this.state.requestContentStr,
                timestamp: Date.now()
            });
        }
    }

    resumeProcessing(): void {
        if (this.state.isPaused) {
            this.state.isPaused = false;
            this.state.isProcessing = true;
            
            this.emit(UserRequestEventType.PROCESSING_RESUMED, {
                content: this.state.requestContentStr,
                timestamp: Date.now()
            });
        }
    }

    // 请求参数管理实现
    setRequestType(type: UserRequestState['requestType']): void {
        const oldType = this.state.requestType;
        this.state.requestType = type;
        
        this.emit(UserRequestEventType.TYPE_CHANGED, {
            oldType,
            newType: type,
            timestamp: Date.now()
        });
    }

    setRequestParams(params: Record<string, any>): void {
        const oldParams = this.state.requestParams;
        this.state.requestParams = { ...params };
        
        this.emit(UserRequestEventType.PARAMS_CHANGED, {
            oldParams,
            newParams: this.state.requestParams,
            timestamp: Date.now()
        });
    }

    setTargetBlockId(blockId: string | null): void {
        const oldBlockId = this.state.targetBlockId;
        this.state.targetBlockId = blockId;
        
        this.emit(UserRequestEventType.TARGET_BLOCK_CHANGED, {
            oldBlockId,
            newBlockId: blockId,
            timestamp: Date.now()
        });
    }

    // 请求历史管理实现
    saveCurrentRequest(): void {
        if (this.state.requestContentStr.trim()) {
            const request = {
                content: this.state.requestContentStr,
                timestamp: this.state.requestTimestamp,
                type: this.state.requestType,
                params: this.state.requestParams
            };
            
            this.state.savedRequests.push(request);
            
            this.emit(UserRequestEventType.HISTORY_ADDED, {
                request,
                totalHistoryCount: this.state.savedRequests.length
            });
        }
    }

    clearSavedRequests(): void {
        this.state.savedRequests = [];
        
        this.emit(UserRequestEventType.HISTORY_CLEARED, {
            timestamp: Date.now()
        });
    }

    // 重置状态实现
    reset(): void {
        this.state.requestContentStr = '';
        this.state.isProcessing = false;
        this.state.isCompleted = false;
        this.state.isCancelled = false;
        this.state.isPaused = false;
        this.state.requestTimestamp = Date.now();
        this.state.completionTimestamp = null;
        this.state.targetBlockId = null;
        this.state.requestType = 'text-generation';
        this.state.requestParams = {};
        this.abortFunction = null;
        
        this.emit(UserRequestEventType.REQUEST_RESET, {
            timestamp: Date.now()
        });
    }

    // 中止控制实现
    setAbortFunction(abortFn: (() => void) | null): void {
        this.abortFunction = abortFn;
    }
}