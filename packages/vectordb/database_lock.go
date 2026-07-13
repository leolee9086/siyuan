package vectordb

import (
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"sync"
)

const databaseLockFileName = ".vectordb.lock"

type databaseLock struct {
	file *os.File
	once sync.Once
	err  error
}

func acquireDatabaseLock(path string) (*databaseLock, error) {
	file, err := os.OpenFile(filepath.Join(path, databaseLockFileName), os.O_CREATE|os.O_RDWR, 0644)
	if err != nil {
		return nil, err
	}
	locked, err := tryLockDatabaseFile(file)
	if err != nil {
		_ = file.Close()
		return nil, err
	}
	if !locked {
		_ = file.Close()
		return nil, fmt.Errorf("%w: %s", ErrDatabaseLocked, path)
	}
	return &databaseLock{file: file}, nil
}

func (lock *databaseLock) release() error {
	if lock == nil {
		return nil
	}
	lock.once.Do(func() {
		unlockErr := unlockDatabaseFile(lock.file)
		closeErr := lock.file.Close()
		lock.err = errors.Join(unlockErr, closeErr)
	})
	return lock.err
}

func (db *Database) ensureDatabaseLock() error {
	db.lockMu.Lock()
	defer db.lockMu.Unlock()
	if db.closed {
		return ErrDatabaseClosed
	}
	if db.lock != nil {
		return nil
	}
	lock, err := acquireDatabaseLock(db.Path)
	if err != nil {
		return err
	}
	db.lock = lock
	return nil
}

func (db *Database) releaseDatabaseLock() error {
	db.lockMu.Lock()
	defer db.lockMu.Unlock()
	if db.closed {
		return nil
	}
	db.closed = true
	if db.lock == nil {
		return nil
	}
	err := db.lock.release()
	db.lock = nil
	return err
}

func (db *Database) closeAfterOpenFailure() {
	db.mu.RLock()
	collections := make([]VectorCollection, 0, len(db.Collections))
	for _, collection := range db.Collections {
		collections = append(collections, collection)
	}
	datasets := make([]*Dataset, 0, len(db.Datasets))
	for _, dataset := range db.Datasets {
		datasets = append(datasets, dataset)
	}
	db.mu.RUnlock()
	for _, dataset := range datasets {
		_ = dataset.Close()
	}
	for _, collection := range collections {
		_ = collection.Close()
	}
	_ = db.releaseDatabaseLock()
}
