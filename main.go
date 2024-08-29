package main

import (
	"log"
	"net"
	"net/http"
	"sync"

	"github.com/gorilla/websocket"
	"gortc.io/stun"
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

func startStunServer() {
	// Listen on UDP port 3478, the default STUN port
	conn, err := net.ListenPacket("udp", ":3478")
	if err != nil {
		log.Fatal("Failed to start STUN server:", err)
	}
	defer conn.Close()
	log.Println("STUN server started on port 3478")

	for {
		buf := make([]byte, 1500)
		_, addr, err := conn.ReadFrom(buf)
		if err != nil {
			log.Println("Error reading from connection:", err)
			continue
		}

		message := new(stun.Message)
		err = message.Decode()
		if err != nil {
			log.Println("Failed to decode STUN message:", err)
			continue
		}

		// Handle binding requests
		if message.Type.Class == stun.ClassRequest && message.Type.Method == stun.MethodBinding {
			response := stun.New()
			response.Type = stun.NewType(stun.MethodBinding, stun.ClassSuccessResponse)
			response.TransactionID = message.TransactionID

			// Add the XOR-MAPPED-ADDRESS attribute
			xorAddr := &stun.XORMappedAddress{
				IP:   addr.(*net.UDPAddr).IP,
				Port: addr.(*net.UDPAddr).Port,
			}
			xorAddr.AddTo(response)

			// Encode and send the response
			response.Encode()
			_, err = conn.WriteTo(response.Raw, addr)
			if err != nil {
				log.Println("Failed to send STUN response:", err)
			}
		}
	}
}

func main() {
	// Start WebSocket server
	http.HandleFunc("/ws", handleConnection)
	go func() {
		log.Fatal(http.ListenAndServe(":8080", nil))
	}()

	// Start STUN server
	startStunServer()
}
