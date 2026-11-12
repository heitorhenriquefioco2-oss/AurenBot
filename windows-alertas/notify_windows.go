//go:build windows

package main

import (
	"fmt"
	"runtime"
	"sync"
	"syscall"
	"unsafe"
)

var user32 = syscall.NewLazyDLL("user32.dll")
var shell32 = syscall.NewLazyDLL("shell32.dll")
var shellNotify = shell32.NewProc("Shell_NotifyIconW")
var messageBox = user32.NewProc("MessageBoxW")

type iconData struct {
	Size        uint32
	Window      uintptr
	ID          uint32
	Flags       uint32
	Callback    uint32
	Icon        uintptr
	Tip         [128]uint16
	State       uint32
	StateMask   uint32
	Info        [256]uint16
	Timeout     uint32
	Title       [64]uint16
	InfoFlags   uint32
	GUID        [16]byte
	BalloonIcon uintptr
}
type winMessage struct {
	Window  uintptr
	Message uint32
	WParam  uintptr
	LParam  uintptr
	Time    uint32
	X       int32
	Y       int32
	Private uint32
}

func utf16(s string) *uint16 { p, _ := syscall.UTF16PtrFromString(s); return p }
func putUTF16(target []uint16, text string) {
	data, _ := syscall.UTF16FromString(text)
	copy(target[:len(target)-1], data)
}

func platformNotifier() (func(event, bool), func(), error) {
	ready := make(chan uintptr, 1)
	go func() {
		runtime.LockOSThread()
		defer runtime.UnlockOSThread()
		hwnd, _, _ := user32.NewProc("CreateWindowExW").Call(0, uintptr(unsafe.Pointer(utf16("STATIC"))), uintptr(unsafe.Pointer(utf16("AurenBot Alertas"))), 0, 0, 0, 0, 0, 0, 0, 0, 0)
		ready <- hwnd
		if hwnd == 0 {
			return
		}
		var msg winMessage
		get := user32.NewProc("GetMessageW")
		for {
			result, _, _ := get.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
			if int32(result) <= 0 {
				break
			}
			user32.NewProc("TranslateMessage").Call(uintptr(unsafe.Pointer(&msg)))
			user32.NewProc("DispatchMessageW").Call(uintptr(unsafe.Pointer(&msg)))
		}
	}()
	hwnd := <-ready
	if hwnd == 0 {
		return nil, nil, fmt.Errorf("Não consegui criar o receptor de notificações do Windows.")
	}
	icon, _, _ := user32.NewProc("LoadIconW").Call(0, 32515)
	data := iconData{Window: hwnd, ID: 1, Flags: 2 | 4, Icon: icon}
	data.Size = uint32(unsafe.Sizeof(data))
	putUTF16(data.Tip[:], "AurenBot Alertas")
	result, _, _ := shellNotify.Call(0, uintptr(unsafe.Pointer(&data)))
	if result == 0 {
		return nil, nil, fmt.Errorf("Não consegui registrar o ícone de notificações no Windows.")
	}
	var mu sync.Mutex
	notify := func(e event, sound bool) {
		mu.Lock()
		defer mu.Unlock()
		message := "Uma verificação apareceu no Auren. Abra o jogo pelo VNC e conclua manualmente."
		if e.Kind == "sombra" {
			message = "O desafio de sombra apareceu no Auren. Abra o jogo pelo VNC para responder."
		}
		if e.Kind == "teste" {
			message = "Tudo pronto! Este PC pode receber os avisos da extensão AurenBot."
		}
		info := iconData{Window: hwnd, ID: 1, Flags: 16, Timeout: 15000, InfoFlags: 2 | 16}
		info.Size = uint32(unsafe.Sizeof(info))
		putUTF16(info.Title[:], "AurenBot — precisa de você")
		putUTF16(info.Info[:], message)
		ok, _, _ := shellNotify.Call(1, uintptr(unsafe.Pointer(&info)))
		if sound {
			user32.NewProc("MessageBeep").Call(0x30)
		}
		if ok == 0 {
			go messageBox.Call(0, uintptr(unsafe.Pointer(utf16(message))), uintptr(unsafe.Pointer(utf16("AurenBot Alertas"))), 0x40030)
		}
	}
	cleanup := func() {
		shellNotify.Call(2, uintptr(unsafe.Pointer(&data)))
		user32.NewProc("PostMessageW").Call(hwnd, 0x10, 0, 0)
	}
	return notify, cleanup, nil
}
func platformError(message string) {
	messageBox.Call(0, uintptr(unsafe.Pointer(utf16(message))), uintptr(unsafe.Pointer(utf16("AurenBot Alertas"))), 0x10)
}
