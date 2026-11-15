import { createServer } from 'node:http';
import { app } from '../app.js';
import { attachChatWebSocket } from '../services/chatWebSocket.js';

const server = createServer(app);
attachChatWebSocket(server);

export default server;
