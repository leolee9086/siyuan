package vectordb

import (
	"path/filepath"
)

var syncParentDirectory = func(path string) error {
	return syncDirectory(filepath.Dir(path))
}
