package main

import (
	"fmt"
	"os"

	d5a "github.com/siyuan-note/siyuan/packages/d5a-viewer/native"
)

func main() {
	if err := d5a.Run(os.Args[1:]); err != nil {
		fmt.Fprintf(os.Stderr, "错误: %v\n", err)
		os.Exit(1)
	}
}
