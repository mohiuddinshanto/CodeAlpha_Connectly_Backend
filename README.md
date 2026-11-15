# Connectly — Backend API

The Express REST API for Connectly. It provides authentication, profiles, posts, comments, follows, and image uploads. The frontend lives in a separate repository.

## Features

- REST API for authentication, users, profiles, posts, comments, likes, and follows
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
| `IMGBB_API_KEY` | Yes | Private ImgBB API key used for image uploads. |

Never commit `.env` or put private values in the frontend's `NEXT_PUBLIC_*` variables. Configure production values in your hosting provider's environment settings.

## Tests

Run the backend validator tests:

```bash
npm test
```

## Deploy

Deploy this directory as a Node.js service on a host that supports a persistent Express server. Set the service root to the backend repository root, install dependencies with `npm install`, and use `npm start` as the start command. Set the environment variables in the host dashboard and use a production MongoDB connection string.

The current entry point starts the server with `app.listen()`, so it is intended for a long-running Node.js host. It is not directly deploy-ready as a Vercel Function; that requires adapting the server entry point to Vercel's serverless function model. Once deployed, set `CLIENT_URL` to the frontend's exact HTTPS origin and `CROSS_SITE_COOKIES=true` when the sites are cross-site.

## Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Start the API with Node's watch mode |
| `npm start` | Start the API for production |
| `npm test` | Run backend validator tests |

## Tech stack

Node.js · Express · MongoDB Native Driver · JWT · bcryptjs · Busboy · ImgBB
