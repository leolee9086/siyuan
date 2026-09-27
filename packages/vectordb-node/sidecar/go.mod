module s-forge.local/vectordb-sidecar

go 1.25.4

require s-forge.local/vectordb v0.0.0

require (
	github.com/vmihailenco/msgpack/v5 v5.4.1 // indirect
	github.com/vmihailenco/tagparser/v2 v2.0.0 // indirect
	golang.org/x/sys v0.45.0 // indirect
)

replace s-forge.local/vectordb => ../../vectordb
