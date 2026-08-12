package windowssmbmount

import (
	"context"
	"errors"
	"io/fs"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func mapSystemError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, externalprovider.ErrInvalidRequest) || errors.Is(err, externalprovider.ErrPermission) ||
		errors.Is(err, externalprovider.ErrNotFound) || errors.Is(err, externalprovider.ErrConflict) ||
		errors.Is(err, fs.ErrInvalid) {
		return err
	}
	if errors.Is(err, fs.ErrNotExist) {
		return externalprovider.ErrNotFound
	}
	if errors.Is(err, fs.ErrPermission) {
		return externalprovider.ErrPermission
	}
	return errors.Join(externalprovider.ErrUnavailable, err)
}
