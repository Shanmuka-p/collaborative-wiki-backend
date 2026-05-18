import { getDB } from './db.js';

export async function seedDatabase() {
  const db = getDB();
  const collection = db.collection('documents');

  // Check if data already exists to prevent duplicate seeding
  const count = await collection.countDocuments();
  if (count > 0) {
    console.log('Database already contains data. Skipping seed.');
    return;
  }

  console.log('Initializing database seeding...');

  // Create Indexes (Unique slug, Text index for search)
  await collection.createIndex({ slug: 1 }, { unique: true });
  await collection.createIndex({ title: "text", content: "text" });

  const mockDocuments = [];

  for (let i = 1; i <= 1000; i++) {
    // Make 10% of documents use the old schema for migration testing
    const isOldSchema = i % 10 === 0; 
    
    const doc = {
      slug: `test-document-${i}`,
      title: `The Great Guide to Node and Mongo Part ${i}`,
      content: `This is the auto-generated content for wiki page ${i}. It contains some keywords like mongodb and api-design.`,
      version: 1,
      tags: ['guide', 'mongodb', i % 2 === 0 ? 'backend' : 'frontend'],
      metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        wordCount: 22
      },
      revision_history: [
        {
          version: 1,
          updatedAt: new Date(),
          authorId: `user-${i}`,
          contentDiff: "Initial record creation."
        }
      ]
    };

    // Inject the schema differences
    if (isOldSchema) {
      doc.metadata.author = `Legacy Author ${i}`;
    } else {
      doc.metadata.author = {
        id: `user-${i}`,
        name: `Current Author ${i}`,
        email: `author${i}@example.com`
      };
    }

    mockDocuments.push(doc);
  }

  await collection.insertMany(mockDocuments);
  console.log('Successfully seeded 1,000 documents!');
}