// SiYuan - From thought to insight, with agents
// Copyright (c) 2020-present, b3log.org
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU Affero General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU Affero General Public License for more details.
//
// You should have received a copy of the GNU Affero General Public License
// along with this program.  If not, see <https://www.gnu.org/licenses/>.

package sql

import (
	"database/sql"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"runtime/debug"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/siyuan-note/eventbus"
	"github.com/siyuan-note/logging"
	"github.com/siyuan-note/siyuan/kernel/task"
	"github.com/siyuan-note/siyuan/kernel/util"
)

var (
	historyOperationQueue []*historyDBQueueOperation
	historyDBQueueLock    = sync.Mutex{}
	historyTxLock         = sync.Mutex{}
)

type historyDBQueueOperation struct {
	inQueueTime time.Time
	action      string // index/deleteOutdated

	histories []*History // index
	before    int64      // deleteOutdated
}

func FlushHistoryTxJob() {
	task.AppendTask(task.HistoryDatabaseIndexCommit, FlushHistoryQueue)
}

func FlushHistoryQueue() {
	ops := getHistoryOperations()
	total := len(ops)
	if 1 > total {
		return
	}

	historyTxLock.Lock()
	defer historyTxLock.Unlock()
	start := time.Now()

	groupOpsTotal := map[string]int{}
	for _, op := range ops {
		groupOpsTotal[op.action]++
	}

	context := map[string]any{eventbus.CtxPushMsg: eventbus.CtxPushMsgToStatusBar}
	type opStat struct {
		count int
		total time.Duration
		max   time.Duration
	}
	opStats := map[string]*opStat{}

	groupOpsCurrent := map[string]int{}
	for i, op := range ops {
		if util.IsExiting.Load() {
			return
		}

		opStart := time.Now()

		tx, err := beginHistoryTx()
		if err != nil {
			return
		}

		groupOpsCurrent[op.action]++
		context["current"] = groupOpsCurrent[op.action]
		context["total"] = groupOpsTotal[op.action]

		if err = execHistoryOp(op, tx, context); err != nil {
			tx.Rollback()
			logging.LogErrorf("queue operation failed: %s", err)

			if 0 < len(op.histories) {
				dir := op.histories[0].Path[:strings.Index(op.histories[0].Path, "/")]
				dirPath := filepath.Join(util.HistoryDir, dir)
				if removeErr := os.RemoveAll(dirPath); nil != removeErr {
					logging.LogErrorf("remove corrupted history dir [%s] failed: %s", dirPath, removeErr)
				}
			}

			eventbus.Publish(util.EvtSQLHistoryRebuild)
			return
		}

		if err = commitHistoryTx(tx); err != nil {
			logging.LogErrorf("commit tx failed: %s", err)
			return
		}

		opElapsed := time.Since(opStart)
		st := opStats[op.action]
		if st == nil {
			st = &opStat{}
			opStats[op.action] = st
		}
		st.count++
		st.total += opElapsed
		if opElapsed > st.max {
			st.max = opElapsed
		}
		if opElapsed > 1*time.Second {
			logging.LogWarnf("slow history db op [%s] index [%d/%d] took [%dms]", op.action, i+1, total, opElapsed.Milliseconds())
		}

		if 16 < i && 0 == i%128 {
			debug.FreeOSMemory()
		}
	}

	if 128 < total {
		debug.FreeOSMemory()
	}

	elapsed := time.Since(start).Milliseconds()
	if 7000 < elapsed {
		var detail strings.Builder
		detail.WriteString(fmt.Sprintf("database history op tx [%dms], ops [%d]", elapsed, total))
		var actions []string
		for action := range opStats {
			actions = append(actions, action)
		}
		sort.Strings(actions)
		for _, action := range actions {
			st := opStats[action]
			detail.WriteString(fmt.Sprintf(" %s=%d(avg=%dms,max=%dms)", action, st.count, st.total.Milliseconds()/int64(st.count), st.max.Milliseconds()))
		}
		logging.LogInfo(detail.String())
	}
}

func execHistoryOp(op *historyDBQueueOperation, tx *sql.Tx, context map[string]any) (err error) {
	switch op.action {
	case "index":
		err = insertHistories(tx, op.histories, context)
	case "deleteOutdated":
		err = deleteOutdatedHistories(tx, op.before)
	default:
		msg := fmt.Sprintf("unknown history operation [%s]", op.action)
		logging.LogErrorf("%s", msg)
		err = errors.New(msg)
	}
	return
}

func DeleteOutdatedHistories(before int64) {
	historyDBQueueLock.Lock()
	defer historyDBQueueLock.Unlock()

	newOp := &historyDBQueueOperation{inQueueTime: time.Now(), action: "deleteOutdated", before: before}
	historyOperationQueue = append(historyOperationQueue, newOp)
}

func IndexHistoriesQueue(histories []*History) {
	if 1 > len(histories) {
		return
	}

	historyDBQueueLock.Lock()
	defer historyDBQueueLock.Unlock()

	newOp := &historyDBQueueOperation{inQueueTime: time.Now(), action: "index", histories: histories}
	historyOperationQueue = append(historyOperationQueue, newOp)
}

func getHistoryOperations() (ops []*historyDBQueueOperation) {
	historyDBQueueLock.Lock()
	defer historyDBQueueLock.Unlock()

	ops = historyOperationQueue
	historyOperationQueue = nil
	return
}
