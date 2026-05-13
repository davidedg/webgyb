# ![WebGYB Logo](public/favicon.svg) WebGYB

A web interface for viewing GMail backups created by [Got-Your-Back (GYB)](https://github.com/GAM-team/got-your-back)

[![Build](https://img.shields.io/github/actions/workflow/status/davidedg/webgyb/docker-publish.yml?logo=github&style=for-the-badge)](https://github.com/davidedg/webgyb/actions/workflows/docker-publish.yml) [![dockerhub](https://img.shields.io/docker/pulls/davidedg/webgyb?logo=docker&style=for-the-badge)](https://hub.docker.com/r/davidedg/webgyb)


<div align="center">
  <img src="interface-preview.gif" alt="WebGYB Interface Preview" width="800"/>
</div>

---

## Features

- **Multi-Account Support**
  - Switch between multiple GMail accounts seamlessly
- **Labels Management**
  - Support for GMail labels
  - Label counts and organization
- **Safe Rendering**
  - Secure email content rendering (enabled by default)
  - Protection against malicious content
  - Sanitized HTML display
- **Email Management**
  - View original email source
  - Download emails in EML format
- **Multi-platform support (amd64,arm64,armv7)**
- **Under Development**
  - Attachment handling
  - Improved UX and responsiveness
  - Search Feature

## Docker Quick Start

```bash
docker pull davidedg/webgyb
docker run -d -p 3000:3000 -v "/path/to/gyb/accounts:/app/accounts" davidedg/webgyb
```

Where `/path/to/gyb/accounts` is the path to a directory structure like this:

```
  accounts/
  └── {account1}/
      ├── msg-db.sqlite
      └── {email_folders}/
  └── {account2}/
      ├── msg-db.sqlite
      └── {email_folders}/
  ...
  ```
The application will be available at `http://localhost:3000`

## Docker Compose Quick Start

```yaml
services:
  webgyb:
    image: davidedg/webgyb
    container_name: webgyb
    init: true
    user: "1000:1000"
    ipc: private
    security_opt:
      - no-new-privileges=true
    cap_drop:
      - ALL
    ports:
      - "3000:3000"
    volumes:
      - /path/to/gyb/accounts:/app/accounts:ro
      - /path/to/a/standalone/account1:/app/accounts/account1:ro
      - /path/to/a/standalone/account2:/app/accounts/account2:ro
    environment:
      - PUID=1000
      - PGID=1000
      - NODE_ENV=production
      - HOST=0.0.0.0
      - PORT=3000
      - GYB_ACCOUNTS_DIR=/app/accounts
      #- BASE_PATH=/webgyb   # uncomment for subfolder reverse proxy (see Reverse Proxy section)
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:3000/"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
```

The application will be available at `http://localhost:3000`


## Reverse Proxy

WebGYB can be deployed behind a reverse proxy in two configurations.

### Subdomain (`webgyb.domain.com`)

No extra configuration needed — just proxy all traffic to the container.

**Nginx:**
```nginx
server {
    listen 80;
    server_name webgyb.domain.com;
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

**Nginx Proxy Manager:** create a Proxy Host pointing to `localhost:3000`. No custom configuration required.

---

### Subfolder (`domain.com/webgyb`)

Two requirements:
1. Set the `BASE_PATH` environment variable in the container to the desired prefix (e.g. `/webgyb`).
2. Configure the proxy to **strip the prefix** before forwarding to the container (nginx `proxy_pass` with a trailing slash does this automatically).

**Docker Compose with BASE_PATH:**
```yaml
services:
  webgyb:
    image: davidedg/webgyb
    environment:
      - BASE_PATH=/webgyb   # must match the proxy location path
      # ... other env vars
```

**Nginx:**
```nginx
# The trailing slash in proxy_pass strips the /webgyb prefix.
location /webgyb/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

**Nginx Proxy Manager** — in the Proxy Host, open the *Advanced* tab and add:
```nginx
location /webgyb/ {
    proxy_pass http://localhost:3000/;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

> **How it works:** at runtime the app injects a `<base href="/webgyb/">` tag into every HTML response and rewrites Astro's internal asset paths to be relative, so the browser resolves all requests — JS bundles, API calls, links — through the correct subfolder. No image rebuild is required to change the prefix.

---

## Development

1. Clone the repository:
   ```bash
   git clone https://github.com/davidedg/webgyb.git
   cd webgyb
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the application in development mode:
   ```bash
   npm run dev
   ```

The application will be available at `http://localhost:4321`

## Building for Production

Create a production build:

```bash
npm run build
```

The built files will be in the `dist` directory.

## Building Docker Images

-  [Dockerfile](Dockerfile)
-  [docker-build.sh](docker-build.sh)


## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the Project
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`)
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the Branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Support

If you find WebGYB useful, please consider supporting it:

[![Sponsor](https://img.shields.io/static/v1?label=Sponsor&message=%E2%9D%A4&logo=GitHub&color=ff69b4)](https://github.com/sponsors/davidedg) <a href="https://www.buymeacoffee.com/davidedg" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/v2/default-violet.png" alt="Buy Me A Coffee" style="height: 20px !important;width: 72px !important;"></a>

---

<div align="center">
Made with ❤️ by <a href="https://github.com/davidedg">davidedg</a>
</div>
