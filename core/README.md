# Docker Build Monitor API Documentation

This API provides endpoints for monitoring and managing Docker projects, deployments, and builds.

## API Endpoints

### Projects

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/projects` | GET | List all projects from the database |
| `/projects` | POST | Create a new project |
| `/projects/:id` | GET | Get details of a specific project |
| `/projects/:id` | PUT | Update a project |
| `/projects/:id` | DELETE | Delete a project |
| `/projects/detect` | GET | Detect Docker projects on the host |
| `/projects/import` | POST | Import detected projects into the database |
| `/projects/:id/logs` | GET | Get deployment logs for a specific project |
| `/projects/:id/webhooks` | GET | Get webhooks for a specific project |

### Build & Deploy

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/build/:id` | POST | Trigger a build for a project |
| `/deploy/:id` | POST | Deploy a project |
| `/logs/:id` | GET | Get specific deployment log by ID |

### Webhooks

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/webhook/create/:id` | POST | Create a webhook for a project |
| `/webhooks` | GET | List all webhooks |
| `/webhook/:id` | DELETE | Delete a webhook |
| `/webhook/:token` | POST | Endpoint that triggers deployment via webhook |

### Event Streaming

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/logs/stream` | GET | SSE endpoint for real-time logs (supports project filtering with ?project=name) |

### Utilities

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/health` | GET | Health check endpoint |

## Environment Variables

- `PORT` - Server port (default: 8048)
- `DB_HOST` - MySQL host (default: mysql)
- `DB_USER` - MySQL user (default: root)
- `DB_PASSWORD` - MySQL password (default: password)
- `DB_NAME` - MySQL database (default: docker_monitor)

## SSE Events

The server emits the following Server-Sent Events:

- `build_log` - Real-time build logs
- `build_error` - Build error notifications
- `build_completed` - Build completion notification
- `deploy_log` - Real-time deployment logs
- `deploy_error` - Deployment error notifications
- `deploy_completed` - Deployment completion notification
- `ping` - Keep-alive event (every 15 seconds)
- `connection` - Initial connection established