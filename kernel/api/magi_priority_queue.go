package api

import (
	"sync"
)

// TaskRing 表示任务的优先级环层级。
// 数值越小优先级越高，对应 CPU 保护环的语义：
// Ring 0 - 外部消息（guardian 等），最高优先级
// Ring 1 - 心跳等系统任务
// Ring 2+ - 后续可扩展的后台任务
type TaskRing int

const (
	Ring0ExternalMessage TaskRing = 0 // 外部消息，最高优先级
	Ring1Heartbeat       TaskRing = 1 // 心跳等后台系统任务
)

const ringCount = 4 // 预留 4 级

// DispatcherRingQueue 是一个按优先级环分级的 FIFO 队列。
// 灵感来自 OS 保护环模型：高 ring 的任务先于低 ring 处理。
type DispatcherRingQueue struct {
	rings [ringCount]chan *DispatcherTask
	mu    sync.Mutex
	// pending[ring] 记录了该 ring 是否有等待中的任务，供 Pop 无锁预检
	pending [ringCount]int32
}

// NewDispatcherRingQueue 创建指定缓冲区大小的优先队列。
func NewDispatcherRingQueue(bufSize int) *DispatcherRingQueue {
	if bufSize <= 0 {
		bufSize = 100
	}
	q := &DispatcherRingQueue{}
	for i := 0; i < ringCount; i++ {
		q.rings[i] = make(chan *DispatcherTask, bufSize)
	}
	return q
}

// Push 按优先级环插入任务。
func (q *DispatcherRingQueue) Push(ring TaskRing, task *DispatcherTask) bool {
	if ring < 0 || int(ring) >= ringCount {
		return false
	}
	select {
	case q.rings[ring] <- task:
		return true
	default:
		return false
	}
}

// PopBlocking 阻塞直到有任务到达，返回最高优先级的任务。
func (q *DispatcherRingQueue) PopBlocking() *DispatcherTask {
	for {
		// 从高 ring 到低 ring 轮询
		for i := 0; i < ringCount; i++ {
			select {
			case task := <-q.rings[i]:
				return task
			default:
			}
		}
		// 所有 ring 都空，阻塞等待任意 ring
		select {
		case task := <-q.rings[0]:
			return task
		case task := <-q.rings[1]:
			return task
		case task := <-q.rings[2]:
			return task
		case task := <-q.rings[3]:
			return task
		}
	}
}

// PopNonBlocking 非阻塞尝试获取最高优先级任务。
func (q *DispatcherRingQueue) PopNonBlocking() (*DispatcherTask, bool) {
	for i := 0; i < ringCount; i++ {
		select {
		case task := <-q.rings[i]:
			return task, true
		default:
		}
	}
	return nil, false
}

// Peek 非阻塞查看最高 ring 是否有任务（不消费）。
func (q *DispatcherRingQueue) Peek() int {
	for i := 0; i < ringCount; i++ {
		if len(q.rings[i]) > 0 {
			return i
		}
	}
	return -1
}

// Len 返回所有 ring 的任务总数。
func (q *DispatcherRingQueue) Len() int {
	n := 0
	for i := 0; i < ringCount; i++ {
		n += len(q.rings[i])
	}
	return n
}

// RingLen 返回指定 ring 的任务数。
func (q *DispatcherRingQueue) RingLen(ring TaskRing) int {
	if ring < 0 || int(ring) >= ringCount {
		return 0
	}
	return len(q.rings[ring])
}
