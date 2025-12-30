# GEMINI.md: Project Context

This document provides a comprehensive overview of the `automation-finvu-aa-service` project to be used as instructional context for future interactions.

## Project Overview

This is a Node.js microservice built with TypeScript and the Express.js framework. Its primary purpose is to act as a reusable service for interacting with the Finvu Account Aggregator system.

The service exposes a simple REST API to handle two main operations:
1.  **Generate Consent Handler:** Creates a new consent request.
2.  **Verify Consent Handler:** Verifies the status of a consent request.

The architecture is designed to be stateless, with no caching of authentication tokens. A fresh token is fetched from the Finvu login API for every incoming request, simplifying the logic by removing the need to manage token expiry. All configuration is managed through environment variables.

### Key Technologies

*   **Backend:** Node.js, Express.js
*   **Language:** TypeScript
*   **HTTP Client:** Axios
*   **Containerization:** Docker, Docker Compose
*   **Dependencies:** `@ondc/automation-logger` for logging, `cors` for cross-origin requests, `dotenv` for environment variable management.
*   **Development Dependencies:** `nodemon` for live reloading, `ts-node` for running TypeScript directly, `eslint` for linting.

## Building and Running

The project includes scripts for development, production, and containerized environments.

### 1. Environment Setup

First, copy the example environment file and fill in the required credentials for the Finvu service.

```bash
cp .env.example .env
```

### 2. Running the Service

**Development Mode (with live reload):**
This command uses `nodemon` and `ts-node` to automatically restart the server on file changes.

```bash
npm run dev
```

**Production Mode:**
This requires building the TypeScript source into JavaScript first.

```bash
# 1. Compile TypeScript to JavaScript (output to ./dist)
npm run build

# 2. Start the compiled application
npm start
```

**Docker:**
The `docker-compose.yml` file defines the service for containerized deployment.

```bash
# Build and start the container in detached mode
docker-compose up -d
```

The service will be available on the port specified in the `.env` file (defaults to `3002`).

### 3. Testing the Service

A health check endpoint is available to verify the service is running.

```bash
curl http://localhost:3002/finvu-aa/health
```

## Development Conventions

*   **TypeScript:** The project uses a strict TypeScript configuration (`"strict": true` in `tsconfig.json`), enforcing strong type checking.
*   **Module Aliases:** Path aliases are configured for cleaner imports. The `~/*` alias maps to the `src/*` directory.
*   **Linting:** The project uses ESLint for code quality and consistency. Linting can be run with the following commands:
    ```bash
    # Check for linting errors
    npm run lint

    # Automatically fix linting errors
    npm run lint:fix
    ```
*   **Code Structure:** The code is organized by feature into `controllers`, `routes`, `services`, `types`, and `utils` directories, promoting a clean and scalable architecture.
*   **Entry Point:** The application entry point is `src/index.ts`, which initializes the Express server defined in `src/server.ts`.