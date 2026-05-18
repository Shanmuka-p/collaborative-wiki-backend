import express from 'express';
import { connectDB } from './db.js';
import { seedDatabase } from './seed.js'; // NEW: Import seeder
import apiRoutes from './routes.js';      // NEW: Import router

const app = express();
const port = process.env.PORT || 3000;

app.use(express.json());

async function startServer() {
  try {
    console.log('Connecting to MongoDB...');
    await connectDB();
    console.log('Connected successfully to MongoDB.');

    // NEW: Trigger the seed process before starting the server
    await seedDatabase();

    // NEW: Mount our API routes under the /api prefix
    app.use('/api', apiRoutes);

    app.listen(port, () => {
      console.log(`Server is running on port ${port}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();