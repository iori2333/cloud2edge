package core

import (
	"encoding/json"
	"fmt"
)

type Message struct {
	To      string `json:"to"`
	Topic   string `json:"topic"`
	ReplyTo string `json:"replyTo,omitempty"`
	Status  int    `json:"status,omitempty"`
	Payload any    `json:"payload"`
}

func NewMessageFromJson(data []byte) (*Message, error) {
	msg := &Message{}
	err := json.Unmarshal(data, msg)
	return msg, err
}

func NewMessage(to, topic, corrID string, payload any) *Message {
	return &Message{
		To:      to,
		Topic:   topic,
		ReplyTo: corrID,
		Payload: payload,
	}
}

func (msg *Message) Json() ([]byte, error) {
	return json.Marshal(msg)
}

func (msg *Message) String() string {
	tpl := "Message{To: %s, Topic: %s, CorrID: %s, Payload: %v}"
	return fmt.Sprintf(tpl, msg.To, msg.Topic, msg.ReplyTo, msg.Payload)
}
