// Example: Go WebSocket server for hole punching
package main

import (
	"log"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		// Allow all origins. You can add specific checks here if needed.
		return true
	},
}
var clients = make(map[*websocket.Conn]bool)
var mutex = &sync.Mutex{}

func handleConnection(w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("Error while upgrading connection:", err)
		return
	}
	defer conn.Close()

	mutex.Lock()
	clients[conn] = true
	mutex.Unlock()

	for {
		messageType, msg, err := conn.ReadMessage()
		if err != nil {
			mutex.Lock()
			delete(clients, conn)
			mutex.Unlock()
			break
		}

		mutex.Lock()
		for client := range clients {
			if client != conn {
				err := client.WriteMessage(messageType, msg)
				if err != nil {
					log.Println("Error while broadcasting message:", err)
					client.Close()
					delete(clients, client)
				}
			}
		}
		mutex.Unlock()
	}
}

func main() {
	http.HandleFunc("/ws", handleConnection)
	log.Fatal(http.ListenAndServe(":8080", nil))
}
