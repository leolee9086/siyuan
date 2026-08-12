package webdavprovider

import (
	"errors"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

var (
	ErrInvalidEndpoint = errors.New("webdav endpoint is invalid")
	ErrClosed          = errors.New("webdav session is closed")
	ErrUnsupported     = errors.New("webdav operation is not supported")
)

func invalidEndpoint(err error) error {
	if err == nil {
		return ErrInvalidEndpoint
	}
	return errors.Join(ErrInvalidEndpoint, err)
}

func unavailable(err error) error {
	if err == nil {
		return externalprovider.ErrUnavailable
	}
	return errors.Join(externalprovider.ErrUnavailable, err)
}

func responseError(err error) error {
	if err == nil {
		return externalprovider.ErrResponse
	}
	return errors.Join(externalprovider.ErrResponse, err)
}
