# Docker Build Monitor

A developer-focused tool for real-time monitoring of Docker builds and deployments across multiple projects.

## Project Overview

Docker Build Monitor consists of:

- **Frontend**: React-based UI for monitoring builds and managing projects
- **Core API**: Backend service providing RESTful endpoints and SSE for real-time updates

## Quick Start

1. Clone the repository
2. Start services:
   ```bash
   docker-compose up -d
   ```
3. Access the UI at http://localhost:5173

## Project Structure

```
docker-build-monitor/
├── frontend/           # React application
├── core/               # Node.js API server
└── compose.yml  # Service orchestration
```

## Key Features

- Real-time build and deployment monitoring via Server-Sent Events
- Docker project auto-detection
- Webhook integration for CI/CD pipelines
- Comprehensive build history and logs

## Development

For detailed documentation:
- [Frontend Documentation](./frontend/README.md)
- [API Documentation](./core/README.md)

## License

MIT
