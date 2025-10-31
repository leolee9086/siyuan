/**
 * 事件发射器基类
 * 提供事件监听和触发的基本功能
 */
export class EventEmitter {
    private eventListeners: Map<string, Array<(...args: any[]) => void>> = new Map();

    /**
     * 添加事件监听器
     * @param eventType 事件类型
     * @param listener 监听器函数
     */
    on(eventType: string, listener: (...args: any[]) => void): void {
        if (!this.eventListeners.has(eventType)) {
            this.eventListeners.set(eventType, []);
        }
        this.eventListeners.get(eventType)!.push(listener);
    }

    /**
     * 添加一次性事件监听器
     * @param eventType 事件类型
     * @param listener 监听器函数
     */
    once(eventType: string, listener: (...args: any[]) => void): void {
        const onceWrapper = (...args: any[]) => {
            this.off(eventType, onceWrapper);
            listener(...args);
        };
        this.on(eventType, onceWrapper);
    }

    /**
     * 移除事件监听器
     * @param eventType 事件类型
     * @param listener 监听器函数
     */
    off(eventType: string, listener: (...args: any[]) => void): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index !== -1) {
                listeners.splice(index, 1);
            }
            if (listeners.length === 0) {
                this.eventListeners.delete(eventType);
            }
        }
    }

    /**
     * 触发事件
     * @param eventType 事件类型
     * @param args 事件参数
     */
    emit(eventType: string, ...args: any[]): void {
        const listeners = this.eventListeners.get(eventType);
        if (listeners) {
            // 创建副本以避免在迭代过程中修改数组
            const listenersCopy = [...listeners];
            listenersCopy.forEach(listener => {
                try {
                    listener(...args);
                } catch (error) {
                    console.error(`Error in event listener for ${eventType}:`, error);
                }
            });
        }
    }

    /**
     * 移除所有事件监听器
     * @param eventType 可选，指定事件类型。如果不提供，则移除所有类型的监听器
     */
    removeAllListeners(eventType?: string): void {
        if (eventType) {
            this.eventListeners.delete(eventType);
        } else {
            this.eventListeners.clear();
        }
    }

    /**
     * 获取指定事件类型的监听器数量
     * @param eventType 事件类型
     * @returns 监听器数量
     */
    listenerCount(eventType: string): number {
        const listeners = this.eventListeners.get(eventType);
        return listeners ? listeners.length : 0;
    }

    /**
     * 获取所有事件类型
     * @returns 事件类型数组
     */
    eventNames(): string[] {
        return Array.from(this.eventListeners.keys());
    }
}