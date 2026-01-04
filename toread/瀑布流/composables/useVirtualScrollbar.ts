import { ref, watch, onMounted, onUnmounted, type Ref } from 'vue';

const MIN_THUMB_HEIGHT = 20; // 滚动条滑块的最小高度 (px)

interface UseVirtualScrollbarOptions {
  scrollContainer: Ref<HTMLElement | null>;
  totalHeight: Ref<number>;
}

export function useVirtualScrollbar({ scrollContainer, totalHeight }: UseVirtualScrollbarOptions) {
  const thumbRef = ref<HTMLElement | null>(null);
  const trackRef = ref<HTMLElement | null>(null);
  let animationFrameId: number | null = null;

  const updateThumb = () => {
    if (!scrollContainer.value || !thumbRef.value || !trackRef.value) return;

    const {
      scrollTop,
      scrollHeight,
      clientHeight,
    } = scrollContainer.value;

    // 如果内容不需要滚动，则隐藏滚动条但不要return
    if (scrollHeight <= clientHeight) {
      thumbRef.value.style.display = 'none';
      trackRef.value.style.display = 'none';
      return;
    } else {
      thumbRef.value.style.display = 'block';
      trackRef.value.style.display = 'block';
    }

    // 计算滚动条高度，使用滚动容器物理高度而不是逻辑高度
    // 这样无论totalHeight多大，滚动条高度都基于实际可滚动内容
    const scrollRatio = clientHeight / scrollHeight;
    const thumbHeight = Math.max(scrollRatio * clientHeight, MIN_THUMB_HEIGHT);
    
    // 计算滚动条位置，使用物理滚动位置和物理内容高度
    const maxScrollDistance = scrollHeight - clientHeight;
    const scrollProgress = maxScrollDistance > 0 ? scrollTop / maxScrollDistance : 0;
    const trackHeight = clientHeight;
    const maxThumbTravel = trackHeight - thumbHeight;
    const thumbTop = scrollProgress * maxThumbTravel;

    thumbRef.value.style.height = `${thumbHeight}px`;
    thumbRef.value.style.transform = `translateY(${thumbTop}px)`;
  };
  
  const handleScroll = () => {
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    animationFrameId = requestAnimationFrame(updateThumb);
  };
  
  onMounted(() => {
    // 在组件挂载后立即更新滚动条状态
    if (scrollContainer.value) {
      scrollContainer.value.addEventListener('scroll', handleScroll, { passive: true });
      // 确保初始化时调用一次updateThumb
      requestAnimationFrame(updateThumb);
    }
    if (trackRef.value) {
        trackRef.value.addEventListener('mousedown', handleTrackMouseDown);
    }
  });

  onUnmounted(() => {
    if (scrollContainer.value) {
      scrollContainer.value.removeEventListener('scroll', handleScroll);
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
    }
    document.removeEventListener('mousemove', handleThumbMouseMove);
    document.removeEventListener('mouseup', handleThumbMouseUp);
    if (trackRef.value) {
      trackRef.value.removeEventListener('mousedown', handleTrackMouseDown);
    }
  });

  watch([totalHeight, () => scrollContainer.value?.clientHeight], () => {
    updateThumb();
  });

  // --- 拖拽与点击逻辑 ---
  const isDragging = ref(false);
  let startY = 0;
  let startScrollTop = 0;

  const handleTrackMouseDown = (e: MouseEvent) => {
    if (!(e.target instanceof HTMLElement)) return;

    if (e.target === thumbRef.value || e.target.parentElement === trackRef.value) {
        e.preventDefault();
        e.stopPropagation();

        isDragging.value = true;
        startY = e.clientY;
        startScrollTop = scrollContainer.value?.scrollTop ?? 0;

        document.addEventListener('mousemove', handleThumbMouseMove);
        document.addEventListener('mouseup', handleThumbMouseUp);
    } else if (e.target === trackRef.value) {
        const { clientY, currentTarget } = e;
        if (!scrollContainer.value || !currentTarget) return;

        const trackRect = (currentTarget as HTMLElement).getBoundingClientRect();
        const clickRatio = (clientY - trackRect.top) / trackRect.height;
        
        // 使用scrollHeight而不是totalHeight来计算滚动位置
        const scrollHeight = scrollContainer.value.scrollHeight;
        const clientHeight = scrollContainer.value.clientHeight;
        scrollContainer.value.scrollTop = clickRatio * (scrollHeight - clientHeight);
    }
  };

  const handleThumbMouseMove = (e: MouseEvent) => {
    if (!isDragging.value || !scrollContainer.value) return;

    e.preventDefault();
    e.stopPropagation();

    const deltaY = e.clientY - startY;
    const trackHeight = scrollContainer.value.clientHeight;
    
    // 使用实际的scrollHeight来计算移动距离
    const scrollHeight = scrollContainer.value.scrollHeight;
    const clientHeight = scrollContainer.value.clientHeight;
    const maxScrollTop = scrollHeight - clientHeight;
    
    // 计算滑块移动比例
    const thumbHeight = Math.max((clientHeight / scrollHeight) * clientHeight, MIN_THUMB_HEIGHT);
    const trackAvailable = clientHeight - thumbHeight;
    const scrollRatio = maxScrollTop / trackAvailable;
    
    // 计算实际滚动位置
    const newScrollTop = startScrollTop + deltaY * scrollRatio;
    
    scrollContainer.value.scrollTop = Math.max(0, Math.min(newScrollTop, maxScrollTop));
  };

  const handleThumbMouseUp = (e: MouseEvent) => {
    if (!isDragging.value) return;

    e.preventDefault();
    e.stopPropagation();

    isDragging.value = false;
    document.removeEventListener('mousemove', handleThumbMouseMove);
    document.removeEventListener('mouseup', handleThumbMouseUp);
  };

  return {
    thumbRef,
    trackRef,
  };
} 