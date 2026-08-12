//go:build !windows

package windowssmbmount

import externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"

func newOSFileSystem(string) FileSystem {
	return nil
}

func externalInvalidPath() error {
	return externalprovider.ErrInvalidRequest
}
