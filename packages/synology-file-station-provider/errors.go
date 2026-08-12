package synologyfilestation

import (
	"context"
	"errors"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

var (
	ErrInvalidEndpoint = errors.New("synology file station endpoint is invalid")
	ErrClosed          = errors.New("synology file station session is closed")
	ErrUnsupported     = errors.New("synology file station operation is not supported")
)

func unavailable(err error) error {
	if err == nil {
		return externalprovider.ErrUnavailable
	}
	return errors.Join(externalprovider.ErrUnavailable, err)
}

func mapAPIError(err error) error {
	if err == nil {
		return nil
	}
	if errors.Is(err, context.Canceled) || errors.Is(err, context.DeadlineExceeded) ||
		errors.Is(err, externalprovider.ErrInvalidRequest) ||
		errors.Is(err, externalprovider.ErrCapability) ||
		errors.Is(err, externalprovider.ErrNotFound) ||
		errors.Is(err, externalprovider.ErrPermission) ||
		errors.Is(err, externalprovider.ErrConflict) ||
		errors.Is(err, externalprovider.ErrResponse) ||
		errors.Is(err, externalprovider.ErrUnavailable) {
		return err
	}
	var apiErr *APIError
	if errors.As(err, &apiErr) {
		switch apiErr.Code {
		case 105, 403, 404, 405, 406, 407, 411:
			return externalprovider.ErrPermission
		case 106, 107, 119, 402, 409, 410, 417, 421, 500, 100, 401:
			return unavailable(err)
		case 408, 599:
			return externalprovider.ErrNotFound
		case 400, 101, 418, 419, 420:
			return externalprovider.ErrInvalidRequest
		case 414, 1003, 1805:
			return externalprovider.ErrConflict
		}
	}
	return unavailable(err)
}
