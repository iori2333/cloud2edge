package ws

import (
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

func UpgradeConnection(c *gin.Context) (conn *websocket.Conn, err error) {
	upgrader := &websocket.Upgrader{}
	conn, err = upgrader.Upgrade(c.Writer, c.Request, nil)
	return
}
