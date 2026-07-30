// SiYuan - Refactor your thinking
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

package api

import (
	"testing"

	"github.com/88250/gulu"
)

func TestParseBlockRefStringArrayEmptyHandling(t *testing.T) {
	arg := map[string]any{"ids": []any{}}

	requiredResult := gulu.Ret.NewResult()
	if _, ok := parseBlockRefStringArray(arg, "ids", requiredResult, true); ok || requiredResult.Code != -1 {
		t.Fatalf("expected an empty required array to be rejected, got code %d", requiredResult.Code)
	}

	optionalResult := gulu.Ret.NewResult()
	values, ok := parseBlockRefStringArray(arg, "ids", optionalResult, false)
	if !ok || optionalResult.Code != 0 || len(values) != 0 {
		t.Fatalf("expected an empty optional array to be accepted, got code %d and values %v", optionalResult.Code, values)
	}
}
