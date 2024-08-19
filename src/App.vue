<template>
  <div>
    <h1>Distributed Database Demo</h1>
    <pre>Client ID: {{ client_id }}</pre>
    <button @click="exec(`INSERT INTO test VALUES(1, '2', 'test_value');`, peers)">Insert Data</button>
    <button @click="exec('UPDATE test SET id=id+1;', peers)">Update Data</button>
    <button @click="getPeers()">Refresh Peers</button>
    <div v-if="output.length > 0">
      <div style="display:flex;flex-flow: row;">
        <div>
          <strong>Peers</strong>
          <template v-if="peers.size > 0">
            <div v-for="(item, index) in peers">{{ `${item}-${index}` }}</div>
          </template>
          <p v-else>无节点</p>
        </div>
        <div>
          <strong>Data</strong>
          <div v-for="(item, index) in output" :key="index">{{ item }}</div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { ref, onMounted } from 'vue';
import { Rtc } from './lib/rtc';
import { DB } from './lib/db';

const rtc = ref<Rtc>();
const db = ref<DB>();
const output = ref<string[]>([]);
const client_id = ref('');

const peers = ref<Map<string, RTCPeerConnection>>(new Map())
const getPeers = async() => peers.value = rtc.value!.getPeers()

const exec = async (sql: string, peers: Map<string, RTCPeerConnection>) => {
  Promise
    .all(Array.from(peers).filter(item => item[0] != client_id.value).map(item => rtc.value!.sendToPeer(item[0], { type: 'sql', sql })))
    .then(async results => {
      if (results.length >= peers.size / 2) {
        db.value?.exec(sql)
        const res = await db.value?.exec('SELECT * FROM test;');
        output.value = res!;
      } else {
        console.log('Operation failed: majority not reached');
      }
    });
};

onMounted(async () => {
  db.value = await DB.openDB();
  client_id.value = Math.random().toString();
  rtc.value = new Rtc('wss://improved-engine-9w5wxjvq7v4cp7g9-8080.app.github.dev/ws', client_id.value, (msg, peerId) => {
    if (peerId == client_id.value) return;
    if (msg.type == 'sql') db.value?.exec(msg.sql);
  });
  await exec('CREATE TABLE test(id INT, name STRING, value STRING);', rtc.value!.getPeers())
});
</script>
