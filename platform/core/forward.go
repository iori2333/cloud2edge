package core

import (
	"fmt"
	"log"
)

type Forwarder struct{}

func (f *Forwarder) handle(platform *Platform, msg *Message) error {
	if msg.To == "" {
		return fmt.Errorf("Message has no destination")
	}

	dist, ok := platform.clients[msg.To]
	if !ok {
		log.Printf("Received dead letter to %s", msg.To)
		return nil
	}

	return dist.Write(msg)
}
