package web

import (
	"fmt"
	"io/fs"
	"path"
	"testing"
)

func TestEmbeddedFilesContainOnlyReleaseAssets(t *testing.T) {
	t.Parallel()
	assets, err := Files()
	if err != nil {
		t.Fatal(err)
	}
	// Inspect what the binary actually embeds, after Vite creates dist.
	err = fs.WalkDir(assets, ".", func(name string, entry fs.DirEntry, err error) error {
		if err != nil {
			return err
		}
		if entry.IsDir() {
			return nil
		}
		switch path.Ext(name) {
		case ".cjs", ".map", ".ts", ".tsx":
			return fmt.Errorf("got embedded source or debug file %q, want only release assets", name)
		}
		return nil
	})
	if err != nil {
		t.Fatal(err)
	}
}
