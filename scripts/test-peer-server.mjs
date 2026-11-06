import { PeerServer } from 'peer';
const server = PeerServer({ host: '127.0.0.1', port: 9001, path: '/wizardry', allow_discovery: false });
server.on('error', error => { console.error(error); process.exitCode = 1; });
console.log('PeerServer di test: http://127.0.0.1:9001/wizardry');
