import { createServer } from 'node:http';
import { app, initializeApp } from './app.js';
import { env } from './config/env.js';
import { attachChatWebSocket } from './services/chatWebSocket.js';

async function startServer() {
  await initializeApp();

  const server = createServer(app);
  attachChatWebSocket(server);
  server.listen(env.port, env.host, () => {
    console.log(
      `[Connectly] Express API server running at http://${env.host}:${env.port} (${env.nodeEnv})`
    );
  });
}

startServer().catch((err) => {
  console.error('[Connectly] Failed to start server:', err.message || err);
  process.exit(1);
});
