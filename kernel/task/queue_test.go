package task

import (
	"reflect"
	"testing"
	"time"

	"github.com/siyuan-note/siyuan/kernel/util"
)

func TestReindexCompletionTaskRunsAfterQueuedStages(t *testing.T) {
	queueLock.Lock()
	previousQueue := taskQueue
	taskQueue = nil
	queueLock.Unlock()
	currentTaskLock.Lock()
	previousCurrent := currentTask
	currentTask = nil
	currentTaskLock.Unlock()
	defer func() {
		queueLock.Lock()
		taskQueue = previousQueue
		queueLock.Unlock()
		currentTaskLock.Lock()
		currentTask = previousCurrent
		currentTaskLock.Unlock()
	}()

	wasExiting := util.IsExiting.Load()
	util.IsExiting.Store(false)
	defer util.IsExiting.Store(wasExiting)

	var events []string
	AppendTask(DatabaseIndexFull, func() {
		events = append(events, "full")
	})
	AppendTask(DatabaseIndexRef, func() {
		events = append(events, "refs")
	})
	AppendTask(DatabaseIndexFullEnd, func() {
		events = append(events, "end")
	})
	time.Sleep(time.Millisecond)

	for i := 0; i < 3; i++ {
		ExecTaskJob()
	}

	if expected := []string{"full", "refs", "end"}; !reflect.DeepEqual(events, expected) {
		t.Fatalf("unexpected task order: got %v, want %v", events, expected)
	}
}
