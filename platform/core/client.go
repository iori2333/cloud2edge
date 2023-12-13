package core

import (
	"actors/utils"
	"errors"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

type Client struct {
	name     string
	conn     *websocket.Conn
	sendLock sync.Mutex
	recv     chan *Message
	closed   chan struct{}
	pending  map[string]*utils.Future[Message]
	onErr    ClientErrorHandler
}

type ClientErrorHandler func(*Client, error)

func defaultOnErr(c *Client, err error) {
	logger := log.Default()
	logger.Println("Client error:", err)
}

func NewClient(name string, conn *websocket.Conn, errorHandler ClientErrorHandler) *Client {
	if errorHandler == nil {
		errorHandler = defaultOnErr
	}

	c := &Client{
		name:     name,
		conn:     conn,
		recv:     make(chan *Message, 10),
		sendLock: sync.Mutex{},
		closed:   make(chan struct{}),
		pending:  make(map[string]*utils.Future[Message]),
		onErr:    errorHandler,
	}

	go c.runRecv()

	return c
}

func (c *Client) Name() string {
	return c.name
}

func (c *Client) Close() {
	println("Closing client", c.name)
	close(c.closed)
	err := c.conn.Close()
	if err != nil {
		c.onErr(c, err)
	}
}

func (c *Client) Read() (*Message, error) {
	t, msg, err := c.conn.ReadMessage()
	if err != nil {
		c.Close()
		return nil, err
	}

	if t != websocket.TextMessage {
		return nil, errors.New("Message type is not TextMessage")
	}

	return NewMessageFromJson(msg)
}

func (c *Client) Write(msg *Message) error {
	rawMsg, err := msg.Json()
	if err != nil {
		return err
	}

	defer c.sendLock.Unlock()
	c.sendLock.Lock()

	return c.conn.WriteMessage(websocket.TextMessage, rawMsg)
}

func (c *Client) runRecv() {
	for {
		select {
		case <-c.closed:
			log.Printf("Client %s closed recv\n", c.name)
			return
		default:
			msg, err := c.Read()
			if err != nil {
				c.onErr(c, err)
				continue
			}

			c.recv <- msg
		}
	}
}
