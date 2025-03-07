# Docker Build Monitor 🚀🐳

Welcome to **Docker Build Monitor** – a real-time, developer-friendly tool that I built to help monitor Docker builds and deployments. If containerization isn't working as expected, I know it can sometimes feel like a *skill issue* (I've been there 😅). So grab a ☕, and let me guide you through this fun and challenging project!

---

## Project Overview 😎

I created Docker Build Monitor as a personal challenge to dive into Server-Sent Events (SSE) and build something truly useful for my Docker projects. Honestly, while Portainer can do the job, its pricing for the webhook feature was just too steep for my taste. So, I rolled up my sleeves and built this tool myself.

And when I dug deeper, I finally understood why Portainer charges a premium – there's a lot of classic, messy stuff going on behind the scenes, and sometimes it feels like I'm deciphering ancient hieroglyphics just to handle files from the host! Arrgghhh 💥, right? But that's what makes this journey so exciting and rewarding.

The project consists of:

- **Frontend**: A React-based UI for monitoring builds and managing projects 🎨
- **Core API**: A Node.js-powered backend that provides RESTful endpoints and uses Server-Sent Events (SSE) for sending logs ⚡

---

## Quick Start ⚙️

To get started, follow these steps:

1. **Clone the repository**: Start by cloning the project repository 🧩
2. **Run the setup script**:
   ```bash
   ./setup.sh
   ```
   *(It's straightforward – just run the script! 🚀)*

---

## Project Structure 📁

The project structure is organized as follows:
```
docker-build-monitor/
├── frontend/           # React application – simple UI
├── core/               # Node.js API server – the core component 🧠
└── setup.sh            # Setup script for host installation
```

---

## Key Features ⭐

- **Real-time Monitoring**: I implemented live tracking of build and deployment statuses using Server-Sent Events.
- **Docker Project Auto-Detection**: Automation to reduce manual efforts 🤖
- **Webhook Integration**: Seamless integration with your CI/CD pipelines 🔗
- **Comprehensive Build Logs**: Detailed history to track every success and learning opportunity 📝

---

## Why SQLite? 🤔

You might be wondering why I chose SQLite for this project. For a simple, lightweight tool like Docker Build Monitor, using a full-blown database system (like PostgreSQL or MySQL) would be overkill. SQLite is incredibly lightweight, requires minimal configuration, and perfectly fits the modest needs of this project. Sometimes, keeping it simple is the best way to go!

---

## Docker Network Integration 🔧

_**Note:** Containerization is a work in progress. I’ve encountered some challenges with container-to-host communication, so this might be a *skill issue* I’m still working on 😅._

Due to virtualization, it can be complex to get real-time events on the host—even when using docker.sock.

Currently, the app runs directly on your host machine. Here’s how you can integrate it with an existing Docker network (e.g., with Traefik):

1. **Create a virtual ethernet link** between your host and Docker:
   ```bash
   sudo ip link add veth_host type veth peer name veth_docker
   sudo ip link set veth_docker master [your virtual network containing Traefik]
   sudo ip link set veth_docker up
   sudo ip addr add [ip_address inside this virtualized network/24] dev veth_host
   sudo ip link set veth_host up
   ```
   *(It’s like giving your host a friendly high-five 🖐️)*

2. **Verify the connection**:
   ```bash
   docker exec -it <container-name> ping [your IP address configured above]
   ```
   *(Make sure your connection is solid! 😜)*

3. **Configure Traefik labels for internet forwarding**:
   ```yaml
   - "traefik.http.routers.myapp.rule=Host(`example.com`)"
   - "traefik.http.routers.myapp.entrypoints=websecure"
   - "traefik.http.routers.myapp.tls.certresolver=yourcerteresolver"
   - "traefik.http.services.myapp.loadbalancer.server.url=http://[your-IP]:[app-port-chosen-in-setup]"
   ```
   **Note**: This configuration grants the app access to your host and Docker network. Please use it with caution in production environments, as it essentially allows the app to operate outside the virtual network. For better security, it's recommended to use this setup on a LAN or deploy via VPN/SSH, especially when using the webhook feature.

---

## Development 🛠️

For detailed documentation, please refer to:
- [Frontend Documentation](./frontend/README.md)
- [API Documentation](./core/README.md)

---

## Contributing 🙌

I welcome contributions from fellow developers! If you’d like to help improve containerization or fix any issues, please:
- Send a pull request
- Reach out via email at **lfuaz.dev@gmail.com**

---

## License 📄

**MIT** – Because I believe in sharing and collaboration!

Thank you for checking out Docker Build Monitor. Happy coding, and may your builds always succeed! 😄🐳
