package thumbnail

import (
	"bytes"
	"fmt"
	"image"
	"image/png"
	"runtime"
	"syscall"
	"unsafe"

	"github.com/go-ole/go-ole"
)

// WindowsProvider uses IShellItemImageFactory to generate thumbnails
type WindowsProvider struct {
}

func NewWindowsProvider() *WindowsProvider {
	if runtime.GOOS != "windows" {
		return nil
	}
	return &WindowsProvider{}
}

func (p *WindowsProvider) Name() string {
	return "TopWindows"
}

func (p *WindowsProvider) Priority() int {
	return 10 // High priority
}

func (p *WindowsProvider) CanHandle(filePath string) bool {
	return true
}

func (p *WindowsProvider) Generate(filePath string, width, height int) (data []byte, err error) {
	// Lock OS thread for COM
	runtime.LockOSThread()
	defer runtime.UnlockOSThread()

	// Initialize COM
	if err = ole.CoInitializeEx(0, ole.COINIT_APARTMENTTHREADED); err != nil {
		// ignore
	}
	defer ole.CoUninitialize()

	// 只接受 IShellItemImageFactory 返回的真实缩略图。
	// 失败时必须让后续 Provider 或请求方看到明确错误，不能把文件图标伪装成缩略图。
	data, err = p.getThumbnailViaShellItem(filePath, width, height)
	if err == nil && len(data) > 0 {
		return data, nil
	}
	if err == nil {
		err = ErrProviderFailed
	}
	return nil, fmt.Errorf("failed to generate thumbnail for %s: %w", filePath, err)
}

// getThumbnailViaShellItem 使用 IShellItemImageFactory 获取缩略图
func (p *WindowsProvider) getThumbnailViaShellItem(filePath string, width, height int) ([]byte, error) {
	// Create ShellItem
	item, err := createResultFromParsingName(filePath)
	if err != nil {
		return nil, err
	}
	defer item.Release()

	// Get IID_IShellItemImageFactory
	guid := ole.NewGUID("bcc18b79-ba16-442f-80c4-8a59c30c463b")
	unknown, err := item.QueryInterface(guid)
	if err != nil {
		return nil, fmt.Errorf("QueryInterface(IShellItemImageFactory) failed: %w", err)
	}
	defer unknown.Release()

	imageFactory := (*IShellItemImageFactory)(unsafe.Pointer(unknown))

	// 使用 SIIGBF_BIGGERSIZEOK (0x01) - 参考 JS 版本
	hBitmap, err := imageFactory.GetImage(SIZE{int32(width), int32(height)}, SIIGBF_BIGGERSIZEOK)
	if err != nil {
		return nil, err
	}
	defer DeleteObject(hBitmap)

	return hBitmapToPNG(hBitmap)
}

// --- Win32 API Definitions ---

var (
	modShell32 = syscall.NewLazyDLL("shell32.dll")
	modGdi32   = syscall.NewLazyDLL("gdi32.dll")
	modUser32  = syscall.NewLazyDLL("user32.dll")

	procSHCreateItemFromParsingName = modShell32.NewProc("SHCreateItemFromParsingName")
	procDeleteObject                = modGdi32.NewProc("DeleteObject")
	procGetDC                       = modUser32.NewProc("GetDC")
	procReleaseDC                   = modUser32.NewProc("ReleaseDC")
	procGetDIBits                   = modGdi32.NewProc("GetDIBits")
	procGetObject                   = modGdi32.NewProc("GetObjectW")
)

// SIIGBF flags
const (
	SIIGBF_RESIZETOFIT   = 0x00
	SIIGBF_BIGGERSIZEOK  = 0x01
	SIIGBF_MEMORYONLY    = 0x02
	SIIGBF_ICONONLY      = 0x04
	SIIGBF_THUMBNAILONLY = 0x08
	SIIGBF_INCACHEONLY   = 0x10
)

type SIZE struct {
	cx, cy int32
}

// IShellItem
type IShellItem struct {
	ole.IUnknown
}

type IShellItemImageFactory struct {
	ole.IUnknown
}

type IShellItemImageFactoryVtbl struct {
	ole.IUnknownVtbl
	GetImage uintptr
}

func (v *IShellItemImageFactory) VTable() *IShellItemImageFactoryVtbl {
	return (*IShellItemImageFactoryVtbl)(unsafe.Pointer(v.RawVTable))
}

func (v *IShellItemImageFactory) GetImage(size SIZE, flags int32) (HBITMAP, error) {
	var hBitmap HBITMAP
	hr, _, _ := syscall.Syscall6(
		v.VTable().GetImage,
		4,
		uintptr(unsafe.Pointer(v)),
		uintptr(size.cx)|(uintptr(size.cy)<<32),
		uintptr(flags),
		uintptr(unsafe.Pointer(&hBitmap)),
		0, 0,
	)
	if hr != 0 {
		return 0, ole.NewError(hr)
	}
	return hBitmap, nil
}

type HBITMAP uintptr

func DeleteObject(h HBITMAP) bool {
	ret, _, _ := procDeleteObject.Call(uintptr(h))
	return ret != 0
}

func createResultFromParsingName(path string) (*IShellItem, error) {
	var item *IShellItem
	guid := ole.NewGUID("43826d1e-e718-42ee-bc55-a1e261c37bfe")

	pathPtr, _ := syscall.UTF16PtrFromString(path)

	var retPtr *ole.IUnknown
	hr, _, _ := procSHCreateItemFromParsingName.Call(
		uintptr(unsafe.Pointer(pathPtr)),
		0,
		uintptr(unsafe.Pointer(guid)),
		uintptr(unsafe.Pointer(&retPtr)),
	)
	if hr != 0 {
		return nil, ole.NewError(hr)
	}
	item = (*IShellItem)(unsafe.Pointer(retPtr))
	return item, nil
}

// hBitmapToPNG 将 HBITMAP 转换为 PNG
func hBitmapToPNG(hBitmap HBITMAP) ([]byte, error) {
	img, err := HBitmapToImage(hBitmap)
	if err != nil {
		return nil, err
	}

	buf := new(bytes.Buffer)
	if err = png.Encode(buf, img); err != nil {
		return nil, err
	}
	return buf.Bytes(), nil
}

// HBitmapToImage 将 HBITMAP 转换为 image.Image
func HBitmapToImage(hBitmap HBITMAP) (image.Image, error) {
	dc, _, _ := procGetDC.Call(0)
	defer procReleaseDC.Call(0, dc)

	var info BITMAP
	procGetObject.Call(uintptr(hBitmap), uintptr(unsafe.Sizeof(info)), uintptr(unsafe.Pointer(&info)))

	width := int(info.BmWidth)
	height := int(info.BmHeight)

	if width <= 0 || height <= 0 {
		return nil, fmt.Errorf("invalid bitmap dimensions: %dx%d", width, height)
	}

	bmi := BITMAPINFOHEADER{
		BiSize:        uint32(unsafe.Sizeof(BITMAPINFOHEADER{})),
		BiWidth:       int32(width),
		BiHeight:      int32(-height), // Top-down
		BiPlanes:      1,
		BiBitCount:    32,
		BiCompression: 0, // BI_RGB
	}

	bufSize := width * height * 4
	pixels := make([]byte, bufSize)

	ret, _, _ := procGetDIBits.Call(
		dc,
		uintptr(hBitmap),
		0,
		uintptr(height),
		uintptr(unsafe.Pointer(&pixels[0])),
		uintptr(unsafe.Pointer(&bmi)),
		0, // DIB_RGB_COLORS
	)

	if ret == 0 {
		return nil, fmt.Errorf("GetDIBits failed")
	}

	// Convert BGRA to RGBA，保留原始透明度
	// Windows 图标的透明部分 alpha=0, RGB 可能也是 0
	// 我们需要检测是否整个图像都是 alpha=0（说明是不支持透明的格式）
	hasValidAlpha := false
	for i := 3; i < len(pixels); i += 4 {
		if pixels[i] != 0 {
			hasValidAlpha = true
			break
		}
	}

	for i := 0; i < len(pixels); i += 4 {
		b := pixels[i]
		g := pixels[i+1]
		r := pixels[i+2]
		a := pixels[i+3]
		pixels[i] = r
		pixels[i+1] = g
		pixels[i+2] = b
		// 如果整个图像都没有 alpha（如 JPEG 转换），则设为不透明
		// 否则保留原始 alpha 值
		if !hasValidAlpha {
			pixels[i+3] = 255
		} else {
			pixels[i+3] = a
		}
	}

	img := &image.RGBA{
		Pix:    pixels,
		Stride: width * 4,
		Rect:   image.Rect(0, 0, width, height),
	}
	return img, nil
}

// Win32 Structs
type BITMAP struct {
	BmType       int32
	BmWidth      int32
	BmHeight     int32
	BmWidthBytes int32
	BmPlanes     uint16
	BmBitsPixel  uint16
	BmBits       uintptr
}

type BITMAPINFOHEADER struct {
	BiSize          uint32
	BiWidth         int32
	BiHeight        int32
	BiPlanes        uint16
	BiBitCount      uint16
	BiCompression   uint32
	BiSizeImage     uint32
	BiXPelsPerMeter int32
	BiYPelsPerMeter int32
	BiClrUsed       uint32
	BiClrImportant  uint32
}
