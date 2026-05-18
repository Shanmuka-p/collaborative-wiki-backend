import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DATABASE_NAME || 'wiki_db';

let client;
let db;

export async function connectDB() {
    if (db) return db; // Return existing connection if available

    client = new MongoClient(uri);
    await client.connect();
    db = client.db(dbName);

    return db;
}

export function getDB() {
    if (!db) {
        throw new Error('Database not initialized. Call connectDB first.');
    }
    return db;
}