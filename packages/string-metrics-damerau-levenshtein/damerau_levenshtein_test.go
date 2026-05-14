package damerau_levenshtein

import "testing"

func TestComputeDistance_EmptyStrings(t *testing.T) {
	if got := ComputeDistance("", ""); got != 0 {
		t.Errorf("ComputeDistance('', '') = %d; want 0", got)
	}
}

func TestComputeDistance_EmptyFirst(t *testing.T) {
	if got := ComputeDistance("", "abc"); got != 3 {
		t.Errorf("ComputeDistance('', 'abc') = %d; want 3", got)
	}
}

func TestComputeDistance_EmptySecond(t *testing.T) {
	if got := ComputeDistance("abc", ""); got != 3 {
		t.Errorf("ComputeDistance('abc', '') = %d; want 3", got)
	}
}

func TestComputeDistance_Identical(t *testing.T) {
	if got := ComputeDistance("kitten", "kitten"); got != 0 {
		t.Errorf("ComputeDistance('kitten', 'kitten') = %d; want 0", got)
	}
}

func TestComputeDistance_ClassicExample(t *testing.T) {
	if got := ComputeDistance("kitten", "sitting"); got != 3 {
		t.Errorf("ComputeDistance('kitten', 'sitting') = %d; want 3", got)
	}
}

func TestComputeDistance_Transposition(t *testing.T) {
	if got := ComputeDistance("ca", "ac"); got != 1 {
		t.Errorf("ComputeDistance('ca', 'ac') = %d; want 1 (transposition)", got)
	}
}

func TestComputeDistance_TranspositionLonger(t *testing.T) {
	if got := ComputeDistance("abcdef", "abcfed"); got != 2 {
		t.Errorf("ComputeDistance('abcdef', 'abcfed') = %d; want 2 (two transpositions)", got)
	}
}

func TestComputeDistance_Insertion(t *testing.T) {
	if got := ComputeDistance("cat", "cats"); got != 1 {
		t.Errorf("ComputeDistance('cat', 'cats') = %d; want 1", got)
	}
}

func TestComputeDistance_Deletion(t *testing.T) {
	if got := ComputeDistance("cats", "cat"); got != 1 {
		t.Errorf("ComputeDistance('cats', 'cat') = %d; want 1", got)
	}
}

func TestComputeDistance_Substitution(t *testing.T) {
	if got := ComputeDistance("cat", "cut"); got != 1 {
		t.Errorf("ComputeDistance('cat', 'cut') = %d; want 1", got)
	}
}

func TestComputeDistance_CaseSensitiveDefault(t *testing.T) {
	dl := ComputeDistance("Cat", "cat")
	le := ComputeDistance("cat", "cat")
	if dl == le {
		t.Errorf("ComputeDistance('Cat', 'cat') = %d; case-sensitive should differ from identical match", dl)
	}
}

func TestComputeDistance_CaseInsensitive(t *testing.T) {
	if got := ComputeDistance("Cat", "cat", Options{CaseSensitive: false}); got != 0 {
		t.Errorf("ComputeDistance('Cat', 'cat', case-insensitive) = %d; want 0", got)
	}
}

func TestComputeDistance_Unicode(t *testing.T) {
	if got := ComputeDistance("你好", "你好"); got != 0 {
		t.Errorf("ComputeDistance('你好', '你好') = %d; want 0", got)
	}
}

func TestComputeDistance_UnicodeSubstitution(t *testing.T) {
	if got := ComputeDistance("你好", "你坏"); got != 1 {
		t.Errorf("ComputeDistance('你好', '你坏') = %d; want 1", got)
	}
}

func TestComputeDistance_UnicodeTransposition(t *testing.T) {
	if got := ComputeDistance("AB", "BA"); got != 1 {
		t.Errorf("ComputeDistance('AB', 'BA') = %d; want 1", got)
	}
}

func TestComputeDistanceClassic_MatchesOptimized(t *testing.T) {
	cases := []struct {
		a, b string
	}{
		{"", ""},
		{"a", ""},
		{"", "a"},
		{"a", "a"},
		{"abc", "abc"},
		{"kitten", "sitting"},
		{"ca", "ac"},
		{"abcdef", "abcfed"},
		{"book", "back"},
		{"hello", "world"},
		{"你好世界", "你好世界"},
		{"你好", "世界"},
	}
	for _, tc := range cases {
		gotOptimized := ComputeDistance(tc.a, tc.b)
		gotClassic := ComputeDistanceClassic(tc.a, tc.b)
		if gotOptimized != gotClassic {
			t.Errorf("ComputeDistance(%q, %q) = %d but ComputeDistanceClassic = %d",
				tc.a, tc.b, gotOptimized, gotClassic)
		}
	}
}

func BenchmarkComputeDistance_Short(b *testing.B) {
	for i := 0; i < b.N; i++ {
		ComputeDistance("kitten", "sitting")
	}
}

func BenchmarkComputeDistance_Long(b *testing.B) {
	a := "abcdefghijklmnopqrstuvwxyz"
	bstr := "abcdefghijklmnopqrstuvwxyz"
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		ComputeDistance(a, bstr)
	}
}

func BenchmarkComputeDistanceClassic_Short(b *testing.B) {
	for i := 0; i < b.N; i++ {
		ComputeDistanceClassic("kitten", "sitting")
	}
}
