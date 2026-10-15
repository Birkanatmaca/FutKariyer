package application

import (
	"bytes"
	"encoding/binary"
	"image"
	"image/jpeg"
	"image/png"

	auth "futcareer/backend/internal/auth/application"
	"futcareer/backend/internal/social/domain"
)

const MaxImageBytes = 4 * 1024 * 1024
const MaxVideoBytes = 30 * 1024 * 1024

func validateMedia(data []byte) (*domain.Attachment, error) {
	invalid := auth.ValidationError{"media": "JPEG/PNG görsel (4 MiB) veya MP4 video (30 MiB) seç."}
	if len(data) == 0 || len(data) > MaxVideoBytes {
		return nil, invalid
	}
	cfg, format, err := image.DecodeConfig(bytes.NewReader(data))
	if err == nil && (format == "jpeg" || format == "png") {
		if len(data) > MaxImageBytes || cfg.Width < 1 || cfg.Height < 1 || cfg.Width > 8192 || cfg.Height > 8192 || int64(cfg.Width)*int64(cfg.Height) > 16000000 {
			return nil, invalid
		}
		decoded, _, err := image.Decode(bytes.NewReader(data))
		if err != nil {
			return nil, invalid
		}
		var clean bytes.Buffer
		mime := "image/png"
		if format == "jpeg" {
			mime = "image/jpeg"
			err = jpeg.Encode(&clean, decoded, &jpeg.Options{Quality: 85})
		} else {
			err = png.Encode(&clean, decoded)
		}
		if err != nil || clean.Len() > MaxImageBytes {
			return nil, invalid
		}
		return &domain.Attachment{Media: domain.Media{Kind: "image", MIME: mime, Size: clean.Len(), Width: cfg.Width, Height: cfg.Height}, Data: clean.Bytes()}, nil
	}
	if validMP4(data) {
		return &domain.Attachment{Media: domain.Media{Kind: "video", MIME: "video/mp4", Size: len(data)}, Data: data}, nil
	}
	return nil, invalid
}

// Validate bounded ISO BMFF containers, not just a filename or ftyp signature.
// Codec decoding remains the device player's responsibility.
type mp4Box struct {
	kind string
	data []byte
}

func boxes(data []byte, budget *int) ([]mp4Box, bool) {
	var out []mp4Box
	for len(data) > 0 {
		*budget--
		if *budget < 0 || len(data) < 8 {
			return nil, false
		}
		size, header := uint64(binary.BigEndian.Uint32(data)), uint64(8)
		if size == 1 {
			if len(data) < 16 {
				return nil, false
			}
			size, header = binary.BigEndian.Uint64(data[8:]), 16
		} else if size == 0 {
			size = uint64(len(data))
		}
		if size < header || size > uint64(len(data)) {
			return nil, false
		}
		out = append(out, mp4Box{kind: string(data[4:8]), data: data[header:size]})
		data = data[size:]
	}
	return out, true
}
func validMP4(data []byte) bool {
	budget := 4096
	top, ok := boxes(data, &budget)
	if !ok || len(top) == 0 || top[0].kind != "ftyp" {
		return false
	}
	ftyp := top[0].data
	if len(ftyp) < 8 || len(ftyp)%4 != 0 {
		return false
	}
	compatible := false
	for i := 0; i < len(ftyp); i += 4 {
		if i == 4 {
			continue
		}
		switch string(ftyp[i : i+4]) {
		case "isom", "iso2", "iso3", "iso4", "iso5", "iso6", "mp41", "mp42", "avc1", "M4V ", "MSNV":
			compatible = true
		}
	}
	if !compatible {
		return false
	}
	video, payload := false, false
	for _, box := range top {
		if box.kind == "mdat" && len(box.data) > 0 {
			payload = true
		}
		if box.kind != "moov" {
			continue
		}
		children, ok := boxes(box.data, &budget)
		if !ok {
			return false
		}
		for _, child := range children {
			if child.kind == "trak" {
				isVideo, valid := videoTrack(child.data, &budget)
				if !valid {
					return false
				}
				video = video || isVideo
			}
		}
	}
	return video && payload
}
func videoTrack(data []byte, budget *int) (bool, bool) {
	track, ok := boxes(data, budget)
	if !ok {
		return false, false
	}
	for _, box := range track {
		if box.kind != "mdia" {
			continue
		}
		mdia, ok := boxes(box.data, budget)
		if !ok {
			return false, false
		}
		handler, samples := false, false
		for _, child := range mdia {
			if child.kind == "hdlr" && len(child.data) >= 12 && string(child.data[8:12]) == "vide" {
				handler = true
			}
			if child.kind != "minf" {
				continue
			}
			minf, ok := boxes(child.data, budget)
			if !ok {
				return false, false
			}
			for _, entry := range minf {
				if entry.kind == "dinf" && !selfContained(entry.data, budget) {
					return false, false
				}
				if entry.kind != "stbl" {
					continue
				}
				table, ok := boxes(entry.data, budget)
				if !ok {
					return false, false
				}
				for _, stsd := range table {
					if stsd.kind != "stsd" || len(stsd.data) < 8 {
						continue
					}
					descriptions, ok := boxes(stsd.data[8:], budget)
					if !ok || uint32(len(descriptions)) != binary.BigEndian.Uint32(stsd.data[4:8]) {
						return false, false
					}
					for _, sample := range descriptions {
						switch sample.kind {
						case "avc1", "avc3", "hvc1", "hev1", "vp09", "av01", "mp4v":
							if len(sample.data) >= 78 {
								samples = true
							}
						}
					}
				}
			}
		}
		if handler && samples {
			return true, true
		}
	}
	return false, true
}
func selfContained(data []byte, budget *int) bool {
	children, ok := boxes(data, budget)
	if !ok {
		return false
	}
	for _, child := range children {
		if child.kind != "dref" {
			continue
		}
		if len(child.data) < 8 {
			return false
		}
		entries, ok := boxes(child.data[8:], budget)
		if !ok || uint32(len(entries)) != binary.BigEndian.Uint32(child.data[4:8]) {
			return false
		}
		for _, entry := range entries {
			if entry.kind != "url " || len(entry.data) != 4 || binary.BigEndian.Uint32(entry.data)&1 == 0 {
				return false
			}
		}
	}
	return true
}
