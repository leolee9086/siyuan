package s3provider

import (
	"errors"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

var (
	ErrInvalidEndpoint = errors.New("s3 endpoint is invalid")
	ErrClosed          = errors.New("s3 session is closed")
	ErrUnsupported     = errors.New("s3 operation is not supported")
)

func unavailable(err error) error {
	if err == nil {
		return externalprovider.ErrUnavailable
	}
	return errors.Join(externalprovider.ErrUnavailable, err)
}

func notFound(err error) error {
	if err == nil {
		return externalprovider.ErrNotFound
	}
	return errors.Join(externalprovider.ErrNotFound, err)
}

func conflict(err error) error {
	if err == nil {
		return externalprovider.ErrConflict
	}
	return errors.Join(externalprovider.ErrConflict, err)
}
