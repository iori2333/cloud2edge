package core

import (
	"actors/ws"
	"fmt"
	"log"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

type MessageHandler interface {
	handle(platform *Platform, msg *Message) error
}

type Platform struct {
	gateway  *gin.Engine
	clients  map[string]*Client
	handlers []MessageHandler
}

func NewPlatform() *Platform {
	gateway := gin.Default()
	plat := &Platform{
		gateway:  gateway,
		clients:  make(map[string]*Client),
		handlers: make([]MessageHandler, 0),
	}

	gateway.GET("/ws/:ns/:name", func(c *gin.Context) {
		// get namespace and name from url path parameters
		ns, ok := c.Params.Get("ns")
		if !ok {
			log.Println("Namespace not found")
			return
		}

		name, ok := c.Params.Get("name")
		if !ok {
			log.Println("Name not found")
			return
		}

		actorRef := fmt.Sprintf("%s:%s", ns, name)

		conn, err := ws.UpgradeConnection(c)
		if err != nil {
			log.Printf("UpgradeConnection error: %v", err)
			return
		}
		plat.AddClient(actorRef, conn)
	})

	plat.AddHandler(&Forwarder{})

	return plat
}

func (p *Platform) AddClient(name string, conn *websocket.Conn) {
	client := NewClient(name, conn, nil)
	p.clients[name] = client
	log.Printf("Client %s connected", name)
	go func() {
		for {
			select {
			case <-client.closed:
				p.RemoveClient(name)
				return
			case msg := <-client.recv:
				if msg == nil {
					continue
				}
				if err := p.HandleMessage(msg); err != nil {
					log.Printf("Error handling message: %v", err)
				}
			}
		}
	}()
}

func (p *Platform) RemoveClient(name string) {
	_, ok := p.clients[name]
	if !ok {
		return
	}
	delete(p.clients, name)
	log.Printf("Client %s disconnected", name)
}

func (p *Platform) GetClient(name string) *Client {
	return p.clients[name]
}

func (p *Platform) AddHandler(handler MessageHandler) {
	p.handlers = append(p.handlers, handler)
}

func (p *Platform) HandleMessage(msg *Message) error {
	for _, handler := range p.handlers {
		err := handler.handle(p, msg)
		if err != nil {
			return err
		}
	}
	return nil
}

func (p *Platform) Run(port uint16) {
	p.gateway.Run(":" + strconv.Itoa(int(port)))
}
