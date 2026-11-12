//go:build !windows

package main

import "log"

func platformNotifier() (func(event, bool), func(), error) {
	return func(e event, sound bool) { log.Printf("Aviso recebido: %s (som configurado: %v)", e.Kind, sound) }, func() {}, nil
}
func platformError(message string) { log.Print(message) }
