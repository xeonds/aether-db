<template>
  <div>
    <h1>Distributed Database Demo</h1>
    <button @click="insertData">Insert Data</button>
    <button @click="queryData">Query Data</button>
    <button @click="deleteData">Delete Data</button>
    <button @click="updateData">Update Data</button>
    <div v-if="output.length > 0">
      <strong>Data:</strong>
      <div v-for="(item, index) in output" :key="index">{{ item }}</div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';

const socket = new WebSocket('wss://improved-engine-9w5wxjvq7v4cp7g9-8080.app.github.dev/ws');

const output = ref<string[]>([]);
const localData = ref<any[]>([]);
const peers = ref<RTCPeerConnection[]>([]);
let peerConnection: RTCPeerConnection | null = null;

const handleDatabaseOperation = (data: any) => {
  if (data.type === 'data') {
    localData.value.push(data.data);
  } else if (data.type === 'delete') {
    localData.value = localData.value.filter(item => !item.match(data.query));
  } else if (data.type === 'update') {
    localData.value = localData.value.map(item => item.match(data.query) ? data.data : item);
  }
  updateOutput();
};

const updateOutput = () => {
  output.value = localData.value;
};

const configuration: RTCConfiguration = { iceServers: [{ urls: 'stun:stun.l.google.com:19302' }] };
const createPeerConnection = () => {
  peerConnection = new RTCPeerConnection(configuration);
  peerConnection.onicecandidate = (event: RTCPeerConnectionIceEvent) => {
    if (event.candidate) {
      socket.send(JSON.stringify({ type: 'candidate', candidate: event.candidate }));
    }
  };

  peerConnection.ondatachannel = (event: RTCDataChannelEvent) => {
    const receiveChannel = event.channel;
    receiveChannel.onmessage = (event: MessageEvent) => {
      handleDatabaseOperation(JSON.parse(event.data as string));
    };
  };

  const dataChannel = peerConnection.createDataChannel('database');
  dataChannel.onopen = () => console.log('Data channel open');
  dataChannel.onmessage = (event: MessageEvent) => {
    handleDatabaseOperation(JSON.parse(event.data as string));
  };
};

const handleOffer = async (offer: RTCSessionDescriptionInit) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));
    const answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);
    socket.send(JSON.stringify({ type: 'answer', answer: answer }));
  }
};

const handleAnswer = async (answer: RTCSessionDescriptionInit) => {
  if (peerConnection) {
    await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
  }
};

socket.onopen = () => console.log('Connected to the server');
socket.onerror = (error: Event) => console.error('WebSocket error:', error);
socket.onclose = () => console.log('Connection closed');

socket.onmessage = (event: MessageEvent) => {
  const message = JSON.parse(event.data as string);
  if (message.type === 'candidate') {
    if (peerConnection) {
      peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
    }
  } else if (message.type === 'offer') {
    handleOffer(message.offer);
  } else if (message.type === 'answer') {
    handleAnswer(message.answer);
  } else if (message.type === 'data') {
    handleDatabaseOperation(message.data);
  }
};

const sendToPeer = (peer: RTCPeerConnection, message: any) => {
  return new Promise((resolve, reject) => {
    const dataChannel = peer.createDataChannel('database');
    dataChannel.send(JSON.stringify(message));
    dataChannel.onmessage = (event: MessageEvent) => {
      resolve(JSON.parse(event.data as string));
    };
  });
};

const syncDatabase = () => {
  // Placeholder for synchronization logic
};

const select = (query: string) => {
  syncDatabase();
  return localData.value.filter(item => item.match(query));
};

const insert = (data: any) => {
  const promises = peers.value.map(peer => sendToPeer(peer, { type: 'data', data }));
  Promise.all(promises).then(results => {
    if (results.length > peers.value.length / 2) {
      localData.value.push(data);
      updateOutput();
    } else {
      console.log('Insert failed: majority not reached');
    }
  });
};

const deleteOperation = (query: string) => {
  const promises = peers.value.map(peer => sendToPeer(peer, { type: 'delete', query }));
  Promise.all(promises).then(results => {
    if (results.length > peers.value.length / 2) {
      localData.value = localData.value.filter(item => !item.match(query));
      updateOutput();
    } else {
      console.log('Delete failed: majority not reached');
    }
  });
};

const updateOperation = (query: string, data: any) => {
  const promises = peers.value.map(peer => sendToPeer(peer, { type: 'update', query, data }));
  Promise.all(promises).then(results => {
    if (results.length > peers.value.length / 2) {
      localData.value = localData.value.map(item => item.match(query) ? data : item);
      updateOutput();
    } else {
      console.log('Update failed: majority not reached');
    }
  });
};

const insertData = () => {
  const data = `Data ${new Date().toISOString()}`;
  insert(data);
};

const queryData = () => {
  // For example query to select all data
  console.log(select(''));
};

const deleteData = () => {
  const query = 'some query'; // Define your query logic
  deleteOperation(query);
};

const updateData = () => {
  const query = 'some query'; // Define your query logic
  const data = `Updated Data ${new Date().toISOString()}`;
  updateOperation(query, data);
};

onMounted(() => {
  createPeerConnection();
});
</script>
