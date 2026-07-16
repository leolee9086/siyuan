# Engine Compare

Run a selected engine set against the s-code adapter and the shared Go adapter.
The proxy URL is always supplied by the caller; no proxy discovery is performed.

```powershell
go run ./cmd/enginecompare `
  -scode-root D:\dev\s-code `
  -engines github,9gag,pinterest,sourcehut `
  -query "test search" `
  -proxy http://127.0.0.1:7890 `
  -num-results 3 `
  -timeout 30s
```

Pass engine credentials explicitly as JSON when needed:

```powershell
go run ./cmd/enginecompare `
  -scode-root D:\dev\s-code `
  -engines theguardian `
  -proxy http://127.0.0.1:7890 `
  -keys-json '{"theguardian":"<key>"}'
```

Each row reports `success`, `zero_results`, `error`, `requires_credentials`, or
`not_selected` independently for both implementations. `-fail-on-difference`
returns exit status 1 when any selected engine has different statuses.
