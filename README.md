# Collaborative Wiki Backend

A production-ready collaborative wiki engine backend using Node.js, Express, and MongoDB.

## Tech Stack

- **Node.js** (v20+)
- **Express**
- **MongoDB**

## Project Structure

```text
├── Dockerfile                  # Docker image configuration for the API
├── docker-compose.yml          # Docker Compose configuration for API and MongoDB
├── package.json                # Project dependencies and scripts
├── .env.example                # Example environment variables
├── src/                        # Source code
│   ├── db.js                   # Database connection setup
│   ├── index.js                # Express app entry point
│   ├── routes.js               # API endpoints definition
│   └── seed.js                 # Database seeding script (if applicable)
└── scripts/
    └── migrate_author_schema.js # Database migration script
```

## Setup Instructions

### Prerequisites

- [Docker](https://www.docker.com/get-started) and [Docker Compose](https://docs.docker.com/compose/install/) (Recommended)
- [Node.js](https://nodejs.org/) (v20+ recommended) and [MongoDB](https://www.mongodb.com/try/download/community) (If running locally without Docker)

### Option 1: Running with Docker (Recommended)

This is the easiest way to get the project up and running as it automatically provisions the MongoDB database and the API container.

1.  **Clone the repository.**
2.  **Copy the environment file:**
    ```bash
    cp .env.example .env
    ```
    The default values in `.env.example` are already configured to work with the Docker setup out of the box (`MONGO_URI=mongodb://mongo:27017`).
3.  **Start the services:**
    ```bash
    docker-compose up -d --build
    ```
    This command will build the API image and start both the `api` and `mongo` containers in the background.
4.  **Verify it's running:**
    The API will be accessible at `http://localhost:3000` (or whichever port you specified in `.env`).

To stop the services, run:
```bash
docker-compose down
```

### Option 2: Running Locally (Without Docker)

1.  **Clone the repository.**
    ```bash
    git clone https://github.com/Shanmuka-p/collaborative-wiki-backend.git
    cd collaborative-wiki-backend.git
    ```
2.  **Install dependencies:**
    ```bash
    npm install
    ```
3.  **Setup MongoDB:** Ensure you have a local MongoDB instance running on your machine.
4.  **Configure environment variables:**
    ```bash
    cp .env.example .env
    ```
    Update the `MONGO_URI` in your `.env` file to point to your local MongoDB instance (e.g., `mongodb://localhost:27017`).
5.  **Start the server:**
    ```bash
    npm start
    ```
    The server will start, typically on `http://localhost:3000`.

## Scripts

-   `npm start`: Runs the production server (`node src/index.js`).
-   `npm run dev`: Runs the development server (currently mapped to `node src/index.js`).

### Database Seeding and Migrations

There are additional scripts provided in the project:
-   `src/seed.js`: Used to seed the database with initial data. Run with `node src/seed.js`.
-   `scripts/migrate_author_schema.js`: Used to perform schema migrations. Run with `node scripts/migrate_author_schema.js`.

*(Note: Adjust the execution of these scripts based on your specific environment, e.g., running them inside the docker container if using Docker: `docker-compose exec api node scripts/migrate_author_schema.js`)*
