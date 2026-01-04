import { ref, onMounted, onUnmounted, Ref } from 'vue';
import { throttle } from '../utils/throttle';

export interface UseScrollObserverOptions {
    scrollContainer: Ref<HTMLElement | null>;
    onScroll?: (scrollTop: number, scrollDirection: 'up' | 'down' | 'none') => void;
    onScrollSettled?: (scrollTop: number) => void;
    throttleTime?: number;
    scrollSettleTime?: number;
}

/**
 * 创建滚动处理函数
 */
function createHandleScroll(
    scrollContainer: Ref<HTMLElement | null>,
    scrollTop: Ref<number>,
    isScrolling: Ref<boolean>,
    isScrollIgnored: Ref<boolean>,
    scrollDirection: Ref<'up' | 'down' | 'none'>,
    onScroll?: (scrollTop: number, scrollDirection: 'up' | 'down' | 'none') => void,
    onScrollSettled?: (scrollTop: number) => void,
    throttleTime: number = 50,
    scrollSettleTime: number = 150
) {
    let scrollTimeout: ReturnType<typeof setTimeout> | null = null;
    let lastScrollTop = 0;
    
    const handleScroll = throttle(() => {
        if (!scrollContainer.value || isScrollIgnored.value) return;

        const currentScrollTop = scrollContainer.value.scrollTop;
        
        if (currentScrollTop > lastScrollTop) {
            scrollDirection.value = 'down';
        } else if (currentScrollTop < lastScrollTop) {
            scrollDirection.value = 'up';
        }
        
        scrollTop.value = currentScrollTop;
        lastScrollTop = currentScrollTop;
        
        if (onScroll) {
            onScroll(currentScrollTop, scrollDirection.value);
        }

        isScrolling.value = true;
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        
        scrollTimeout = setTimeout(() => {
            isScrolling.value = false;
            scrollDirection.value = 'none';
            
            if (onScrollSettled) {
                onScrollSettled(scrollTop.value);
            }
        }, scrollSettleTime);
    }, throttleTime);
    
    return { handleScroll, scrollTimeout };
}

/**
 * 创建忽略滚动事件的函数
 */
function createIgnoreScrollEventsFor(isScrollIgnored: Ref<boolean>) {
    let ignoreTimeout: ReturnType<typeof setTimeout> | null = null;
    
    const ignoreScrollEventsFor = (duration: number) => {
        isScrollIgnored.value = true;
        if (ignoreTimeout) {
            clearTimeout(ignoreTimeout);
        }
        ignoreTimeout = setTimeout(() => {
            isScrollIgnored.value = false;
        }, duration);
    };
    
    return { ignoreScrollEventsFor, ignoreTimeout };
}

/**
 * 观察滚动容器的状态，提供滚动位置、滚动方向和滚动状态
 * @param options - 配置选项
 * @returns 滚动状态相关的响应式对象
 */
export function useScrollObserver({ 
    scrollContainer, 
    onScroll, 
    onScrollSettled,
    throttleTime = 50,
    scrollSettleTime = 150
}: UseScrollObserverOptions) {
    const scrollTop = ref(0);
    const isScrolling = ref(false);
    const isScrollIgnored = ref(false);
    const scrollDirection = ref<'up' | 'down' | 'none'>('none');

    const { handleScroll, scrollTimeout } = createHandleScroll(
        scrollContainer,
        scrollTop,
        isScrolling,
        isScrollIgnored,
        scrollDirection,
        onScroll,
        onScrollSettled,
        throttleTime,
        scrollSettleTime
    );

    const { ignoreScrollEventsFor, ignoreTimeout } = createIgnoreScrollEventsFor(isScrollIgnored);

    onMounted(() => {
        if (scrollContainer.value) {
            scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true });
        }
    });

    onUnmounted(() => {
        if (scrollContainer.value) {
            scrollContainer.value.removeEventListener('scroll', handleScroll);
        }
        if (scrollTimeout) {
            clearTimeout(scrollTimeout);
        }
        if (ignoreTimeout) {
            clearTimeout(ignoreTimeout);
        }
    });

    return {
        scrollTop,
        isScrolling,
        scrollDirection,
        ignoreScrollEventsFor,
    };
} 