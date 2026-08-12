package windowssmbmount

import (
	"encoding/base64"
	"strconv"

	externalprovider "github.com/siyuan-note/siyuan/packages/external-provider-contract"
)

func encodeCursor(offset int) string {
	return base64.RawURLEncoding.EncodeToString([]byte(strconv.Itoa(offset)))
}

func decodeCursor(cursor string) (int, error) {
	if cursor == "" {
		return 0, nil
	}
	decoded, err := base64.RawURLEncoding.DecodeString(cursor)
	if err != nil {
		return 0, externalprovider.ErrInvalidRequest
	}
	offset, err := strconv.Atoi(string(decoded))
	if err != nil || offset < 0 || offset > MaxListEntries {
		return 0, externalprovider.ErrInvalidRequest
	}
	return offset, nil
}
