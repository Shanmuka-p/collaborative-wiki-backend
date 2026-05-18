import { MongoClient } from 'mongodb';
import dotenv from 'dotenv';

dotenv.config();

// Connect to the DB using the same variables as our main app
const uri = process.env.MONGO_URI || 'mongodb://localhost:27017';
const dbName = process.env.DATABASE_NAME || 'wiki_db';

async function runMigration() {
    const client = new MongoClient(uri);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('documents');

        // Query for ANY document where the author field is still a string type
        const query = { "metadata.author": { $type: "string" } };
        const totalDocsToMigrate = await collection.countDocuments(query);

        console.log(`Starting migration. Found ${totalDocsToMigrate} documents with old schema.`);

        if (totalDocsToMigrate === 0) {
            console.log('Database is fully up to date. Exiting.');
            return;
        }

        // Process in batches of 1,000 to prevent memory crashes
        const batchSize = 1000;
        const cursor = collection.find(query).batchSize(batchSize);

        let bulkOps = [];
        let processedCount = 0;

        for await (const doc of cursor) {
            // Create an update command for this specific document
            bulkOps.push({
                updateOne: {
                    filter: { _id: doc._id },
                    update: {
                        $set: {
                            "metadata.author": {
                                id: null,
                                name: doc.metadata.author,
                                email: null
                            }
                        }
                    }
                }
            });

            // Once our array hits the batch size, fire the bulk update!
            if (bulkOps.length === batchSize) {
                await collection.bulkWrite(bulkOps);
                processedCount += bulkOps.length;
                console.log(`Migrated ${processedCount} / ${totalDocsToMigrate} documents...`);
                bulkOps = []; // Reset the array for the next batch
            }
        }

        // Process any remaining documents that didn't neatly divide into 1,000
        if (bulkOps.length > 0) {
            await collection.bulkWrite(bulkOps);
            processedCount += bulkOps.length;
            console.log(`Migrated ${processedCount} / ${totalDocsToMigrate} documents...`);
        }

        console.log('Background migration completed successfully!');
    } catch (error) {
        console.error('Migration failed:', error);
    } finally {
        await client.close();
        process.exit(0); // Exit the script process
    }
}

runMigration();