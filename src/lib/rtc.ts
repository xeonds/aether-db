// webrtc-lib.ts
const STUN_SERVERS = [{ urls: 'stun:stun.l.google.com:19302' }];

export class Rtc {
    private socket: WebSocket;
    private peers: Map<string, RTCPeerConnection> = new Map();
    private dataChannels: Map<string, RTCDataChannel> = new Map();
    private localId: string;
    private handleDataChannel: (arg0: any, arg1: string) => void;

    constructor(wsUrl: string, localId: string, handleDataChannel: (arg0: any, arg1: string) => void) {
        this.localId = localId;
        this.socket = new WebSocket(wsUrl);
        this.socket.onmessage = this.handleMessage.bind(this);
        this.socket.onopen = () => this.socket.send(JSON.stringify({ type: 'register', id: this.localId }));
        this.socket.onclose = () => console.log('WebSocket connection closed');
        this.socket.onerror = (error) => console.error('WebSocket error:', error);
        this.handleDataChannel = handleDataChannel;
    }

    private async handleMessage(event: MessageEvent) {
        const message = JSON.parse(event.data as string);
        switch (message.type) {
            case 'register':
                await this.createPeerConnection(message.id);
                break;

            case 'peer-disconnected':
                this.removePeerConnection(message.id);
                break;

            case 'offer':
                await this.handleOffer(message.id, message.sdp);
                break;

            case 'answer':
                await this.handleAnswer(message.id, message.sdp);
                break;

            case 'candidate':
                await this.handleCandidate(message.id, message.candidate);
                break;
        }
    }

    private async createPeerConnection(peerId: string) {
        if (peerId == this.localId) return;
        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        pc.onicecandidate = event => {
            if (event.candidate) {
                this.socket.send(JSON.stringify({
                    type: 'candidate',
                    id: peerId,
                    candidate: event.candidate
                }));
            }
        };
        pc.ontrack = event => console.log(`Received track from ${peerId}: ${event}`);
        pc.ondatachannel = event => {
            const dataChannel = event.channel;
            this.dataChannels.set(peerId, dataChannel);
            dataChannel.onmessage = (event: MessageEvent) => {
                const message = JSON.parse(event.data);
                this.handleDataChannel(message, peerId);
            };

            dataChannel.onopen = () => console.log(`Data channel opened with ${peerId}`);
            dataChannel.onclose = () => console.log(`Data channel closed with ${peerId}`);
        };
        this.peers.set(peerId, pc);

        // Create and send offer
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        this.socket.send(JSON.stringify({
            type: 'offer',
            id: peerId,
            sdp: offer.sdp
        }));
    }

    private removePeerConnection(peerId: string) {
        const pc = this.peers.get(peerId);
        if (pc) {
            pc.close();
            this.peers.delete(peerId);
        }
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel) {
            dataChannel.close();
            this.dataChannels.delete(peerId);
        }
    }

    private async handleOffer(peerId: string, sdp: string) {
        const pc = new RTCPeerConnection({ iceServers: STUN_SERVERS });
        this.peers.set(peerId, pc);

        await pc.setRemoteDescription(new RTCSessionDescription({ type: 'offer', sdp }));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        this.socket.send(JSON.stringify({
            type: 'answer',
            id: peerId,
            sdp: answer.sdp
        }));
    }

    private async handleAnswer(peerId: string, sdp: string) {
        const pc = this.peers.get(peerId);
        if (pc) {
            await pc.setRemoteDescription(new RTCSessionDescription({ type: 'answer', sdp }));
        }
    }

    private async handleCandidate(peerId: string, candidate: RTCIceCandidateInit) {
        const pc = this.peers.get(peerId);
        if (pc) {
            await pc.addIceCandidate(new RTCIceCandidate(candidate));
        }
    }

    public getPeers(): Map<string, RTCPeerConnection> {
        return this.peers;
    }

    public sendToPeer(peerId: string, message: any) {
        const dataChannel = this.dataChannels.get(peerId);
        if (dataChannel) {
            return new Promise((resolve, reject) => {
                try {
                    dataChannel.send(JSON.stringify(message));
                    dataChannel.onmessage = (event: MessageEvent) => {
                        resolve(JSON.parse(event.data as string));
                    };
                } catch (error) {
                    reject(error);
                }
            });
        } else {
            return Promise.reject(new Error(`Data channel not found: src: ${this.localId} - target: ${peerId}`));
        }
    }
}
