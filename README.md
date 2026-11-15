# Connectly — Backend API

The Express API for Connectly. It provides authentication, profiles, posts, comments, follows, friend requests, real-time chat, and image uploads. The frontend lives in a separate repository.

## Features

- REST API for authentication, users, profiles, posts, threaded comment replies, likes, follows, and friend requests
- Persistent one-to-one messages for accepted friends, delivered in real time over WebSockets
- Persistent per-recipient read state, total/per-conversation unread counts, and mark-read support
- Paginated lists of users who liked each post
- MongoDB persistence through the official MongoDB Node.js driver
- JWT sessions in HttpOnly cookies
- Image uploads forwarded to ImgBB
- Origin checks and credentialed CORS for the frontend
- Health endpoint at `/api/health`

## Requirements

- Node.js 20 or later
- MongoDB (local or MongoDB Atlas)
- ImgBB API key for image uploads

## Run locally

Install dependencies:

```bash
npm install
```

Create a local environment file from the example:

```bash
cp .env.example .env
```

On Windows PowerShell, use `Copy-Item .env.example .env`. Fill in the required values, then start the API:

```bash
npm run dev
```

The API listens on `http://localhost:5000`. Check `http://localhost:5000/api/health` to confirm it is running and see the database connection mode.

## Environment variables

| Variable | Required | Description |
| --- | --- | --- |
| `PORT` | No | HTTP port. Defaults to `5000`; production hosts commonly provide this automatically. |
| `MONGODB_URI` | Yes | MongoDB connection string. Use a reachable MongoDB Atlas URI or local MongoDB URL. |
| `MONGODB_DB_NAME` | No | Database name. Defaults to `connectly`. |
| `JWT_SECRET` | Yes | Long, random private secret used to sign session tokens. |
| `CLIENT_URL` | Yes | Exact frontend origin, such as `http://localhost:3000` or `https://connectly.example.com`. Multiple comma-separated origins are supported. |
| `CROSS_SITE_COOKIES` | No | Set to `true` when the frontend and API are on different sites. Requires HTTPS. Defaults to `false`. |
| `IMGBB_API_KEY` | No | Private ImgBB API key required for image uploads. Other API routes can run without it. |

Never commit `.env` or put private values in the frontend's `NEXT_PUBLIC_*` variables. Configure production values in your hosting provider's environment settings.

## Tests

Run the backend API, chat, Vercel-routing, and validator tests:

```bash
npm test
```

## Deploy

### Vercel

This repository includes Vercel function handlers under `api/` for the `/api` endpoints. Set the Vercel project root to this backend directory and configure these environment variables in the Vercel project settings:

- `MONGODB_URI`: a reachable MongoDB Atlas connection string; `127.0.0.1` and `localhost` refer to the Vercel function itself and will not work.
- `MONGODB_DB_NAME`: `connectly` (or your chosen database name).
- `JWT_SECRET`: a long, random private value.
- `CLIENT_URL`: the exact production frontend origin(s), comma-separated.
- `CROSS_SITE_COOKIES`: set to `true` when the frontend and API are on different sites.
- `IMGBB_API_KEY`: required only if image uploads are enabled.

Allow the Vercel deployment to reach the MongoDB Atlas cluster, then redeploy after changing environment variables. `/api/health` returns the database mode when the database is reachable and a JSON `503` response when server configuration or MongoDB is unavailable.

The `/api/ws` WebSocket function is kept outside the REST rewrite. It uses short-lived tickets and the direct backend socket URL returned by `/api/chats/socket-ticket`, plus MongoDB change streams to deliver messages between Vercel instances.

### Chat endpoints

| Method | Endpoint | Description |
| --- | --- | --- |
| `GET` | `/api/friends` | List accepted friends with per-conversation unread counts |
| `GET` | `/api/chats/unread-count` | Return total and per-conversation unread counts |
| `POST` | `/api/chats/:conversationId/read` | Mark incoming messages in an accepted conversation as read |
| `GET` | `/api/chats/:conversationId` | Get conversation details |
| `GET` | `/api/chats/:conversationId/messages` | Get paginated message history |
| `POST` | `/api/chats/socket-ticket` | Issue a short-lived ticket for WebSocket authentication |
| `WS` | `/api/ws` | Subscribe to accepted conversations and receive real-time messages |

New messages record their recipient. Older messages without a recipient are attributed to the other participant based on the conversation and remain unread until marked read. Read endpoints only update messages sent by the other participant in an accepted conversation.

The `messages` collection is indexed by conversation/time, idempotent sender/client-message ID, and recipient/read-state/conversation for history and unread-count queries.

### Other Node.js hosts

For a host that supports a persistent Express server, set the service root to the backend repository root, install dependencies with `npm install`, and use `npm start` as the start command. Configure the environment variables in the host dashboard and use a production MongoDB connection string.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with Node's watch mode |
| `npm start` | Start the API for production |
| `npm test` | Run backend API, chat, Vercel-routing, and validation tests |

## Tech stack

Node.js · Express · MongoDB Native Driver · JWT · WebSockets · bcryptjs · Busboy · ImgBB
