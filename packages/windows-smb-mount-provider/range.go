package windowssmbmount

import (
	"io"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func applyRange(reader io.ReadCloser, size int64, value *externalprovider.ByteRange) (io.ReadCloser, int64, error) {
	if value == nil {
		return reader, size, nil
	}
	if value.Start < 0 || value.Start >= size {
		return reader, 0, externalprovider.ErrInvalidRequest
	}
	if _, err := io.Copy(io.Discard, io.LimitReader(reader, value.Start)); err != nil {
		return reader, 0, err
	}
	length := size - value.Start
	if value.End > 0 {
		if value.End < value.Start || value.End >= size {
			return reader, 0, externalprovider.ErrInvalidRequest
		}
		length = value.End - value.Start + 1
	}
	return &limitedReadCloser{Reader: io.LimitReader(reader, length), closer: reader}, length, nil
}

type limitedReadCloser struct {
	io.Reader
	closer io.Closer
}

func (r *limitedReadCloser) Close() error {
	return r.closer.Close()
}
