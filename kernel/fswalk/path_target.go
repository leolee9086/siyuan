package fswalk

// ResolvePathTarget resolves an absolute filesystem path to its canonical
// target using the platform-specific implementation. Callers that need a
// root boundary may use the result for comparison, while all directory and
// file operations should continue through Walker's root-relative methods.
func ResolvePathTarget(path string) (string, error) {
	return resolvePathTarget(path)
}
