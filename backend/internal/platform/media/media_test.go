package media

import (
	"bytes"
	"errors"
	"image"
	"image/color"
	"image/png"
	"testing"
)

func pngBytes(t *testing.T, w, h int) []byte {
	t.Helper()
	img := image.NewRGBA(image.Rect(0, 0, w, h))
	img.Set(0, 0, color.RGBA{R: 200, A: 255})
	var buf bytes.Buffer
	if err := png.Encode(&buf, img); err != nil {
		t.Fatal(err)
	}
	return buf.Bytes()
}

func TestValidateReencodesImages(t *testing.T) {
	file, err := Validate(pngBytes(t, 3, 2))
	if err != nil {
		t.Fatal(err)
	}
	if file.Kind != "image" || file.MIME != "image/png" || file.Width != 3 || file.Height != 2 || file.Size != len(file.Data) {
		t.Fatalf("unexpected file %+v", file)
	}
}

func TestValidateRejectsUnknownAndEmptyData(t *testing.T) {
	for _, data := range [][]byte{nil, []byte("not media"), append([]byte{0, 0, 0, 8}, []byte("ftypxxxx")...)} {
		if _, err := Validate(data); !errors.Is(err, ErrInvalid) {
			t.Fatalf("%q accepted: %v", data, err)
		}
	}
}
