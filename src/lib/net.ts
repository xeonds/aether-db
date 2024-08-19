import { sendToPeer } from "./rtc";

export const raft = (peers: RTCPeerConnection[], data: any, callback: Function) => {
    Promise.all(peers.map(peer => sendToPeer(peer, { type: 'data', data }))).then(results => {
        if (results.length > peers.length / 2) {
            callback(data)
        } else {
            console.log('Action failed: majority not reached');
        }
    });
}
