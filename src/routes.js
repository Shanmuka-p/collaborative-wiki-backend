import express from 'express';
import { getDB } from './db.js';

const router = express.Router();

// Utility to generate a URL-friendly slug
const generateSlug = (title) => {
    return title.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '-' + Date.now();
};

// ---------------------------------------------------------
// POST /api/documents - Create a new document
// ---------------------------------------------------------
router.post('/documents', async (req, res) => {
    try {
        const db = getDB();
        const { title, content, tags, authorName, authorEmail } = req.body;

        if (!title || !content || !authorName) {
            return res.status(400).json({ error: "Missing required fields" });
        }

        // Construct the new document matching our exact schema requirements
        const doc = {
            slug: generateSlug(title),
            title,
            content,
            version: 1, // Start at version 1
            tags: tags || [],
            metadata: {
                author: { id: `user-${Date.now()}`, name: authorName, email: authorEmail },
                createdAt: new Date(),
                updatedAt: new Date(),
                wordCount: content.split(/\s+/).length
            },
            revision_history: [{
                version: 1,
                updatedAt: new Date(),
                authorName,
                contentDiff: "Initial Creation"
            }]
        };

        await db.collection('documents').insertOne(doc);

        // Return 201 Created with the full document
        res.status(201).json(doc);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

// ---------------------------------------------------------
// GET /api/documents/:slug - Retrieve a document
// ---------------------------------------------------------
router.get('/documents/:slug', async (req, res) => {
    try {
        const db = getDB();
        const doc = await db.collection('documents').findOne({ slug: req.params.slug });

        // 404 Not Found if the slug doesn't exist in the DB
        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // 200 OK
        res.status(200).json(doc);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});
// ---------------------------------------------------------
// PUT /api/documents/:slug - Update with Optimistic Concurrency Control
// ---------------------------------------------------------
router.put('/documents/:slug', async (req, res) => {
    try {
        const db = getDB();
        const { slug } = req.params;
        const { title, content, version } = req.body;

        if (!version) {
            return res.status(400).json({ error: 'Version number is required for updates' });
        }

        const expectedVersion = parseInt(version, 10);

        // Attempt the atomic update using OCC
        const updatedDoc = await db.collection('documents').findOneAndUpdate(
            { slug: slug, version: expectedVersion },
            {
                $set: {
                    title: title,
                    content: content,
                    'metadata.updatedAt': new Date(),
                    'metadata.wordCount': content ? content.split(/\s+/).length : 0
                },
                $inc: { version: 1 }, // Increment version by 1
                $push: {
                    revision_history: {
                        $each: [{
                            version: expectedVersion + 1,
                            updatedAt: new Date(),
                            authorName: "API User",
                            contentDiff: "Content modified via PUT request"
                        }],
                        $slice: -20 // Cap the array to the last 20 revisions
                    }
                }
            },
            { returnDocument: 'after' } // Return the newly updated document
        );

        // If findOneAndUpdate found the exact slug + version, it succeeds!
        if (updatedDoc) {
            return res.status(200).json(updatedDoc);
        }

        // If it returned null, the update failed. Let's find out why.
        const existingDoc = await db.collection('documents').findOne({ slug });

        if (!existingDoc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // If the document exists but didn't update, the version was wrong! (Conflict)
        return res.status(409).json({
            error: 'Version Conflict. The document has been modified by another user.',
            latestDocument: existingDoc
        });

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------
// GET /api/search - Full-Text Search with Tag Filtering
// ---------------------------------------------------------
router.get('/search', async (req, res) => {
    try {
        const db = getDB();
        const { q, tags } = req.query;

        if (!q) {
            return res.status(400).json({ error: 'Search query "q" is required' });
        }

        // Leverage the text index we created in the seed file
        const query = { $text: { $search: q } };

        // If tags are provided, add them to the query constraint
        if (tags) {
            const tagsArray = tags.split(',').map(tag => tag.trim());
            query.tags = { $all: tagsArray }; // Document must contain ALL specified tags
        }

        const results = await db.collection('documents')
            .find(query, { projection: { score: { $meta: "textScore" } } })
            .sort({ score: { $meta: "textScore" } }) // Sort by highest relevance match
            .toArray();

        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------
// GET /api/analytics/most-edited - Top 10 most revised documents
// ---------------------------------------------------------
router.get('/analytics/most-edited', async (req, res) => {
    try {
        const db = getDB();
        const pipeline = [
            {
                $project: {
                    title: 1,
                    slug: 1,
                    // Calculate the length of the revision array dynamically
                    editCount: { $size: { $ifNull: ["$revision_history", []] } }
                }
            },
            { $sort: { editCount: -1 } }, // Descending order
            { $limit: 10 }
        ];

        const results = await db.collection('documents').aggregate(pipeline).toArray();
        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ---------------------------------------------------------
// GET /api/analytics/tag-cooccurrence - Tag relationships
// ---------------------------------------------------------
router.get('/analytics/tag-cooccurrence', async (req, res) => {
    try {
        const db = getDB();
        const pipeline = [
            { $match: { "tags.1": { $exists: true } } }, // Only look at docs with at least 2 tags
            { $unwind: "$tags" },
            {
                // Self-join to create pairs
                $lookup: {
                    from: 'documents',
                    localField: '_id',
                    foreignField: '_id',
                    as: 'self'
                }
            },
            { $unwind: "$self" },
            { $unwind: "$self.tags" },
            // Drop duplicate pairs (e.g., A-B and B-A) and self-pairs (A-A)
            { $match: { $expr: { $lt: ["$tags", "$self.tags"] } } },
            {
                $group: {
                    _id: { tags: ["$tags", "$self.tags"] },
                    count: { $sum: 1 }
                }
            },
            { $sort: { count: -1 } },
            {
                $project: {
                    _id: 0,
                    tags: "$_id.tags",
                    count: 1
                }
            }
        ];

        const results = await db.collection('documents').aggregate(pipeline).toArray();
        res.status(200).json(results);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Internal server error' });
    }
});
// ---------------------------------------------------------
// GET /api/documents/:slug - Retrieve a document
// ---------------------------------------------------------
router.get('/documents/:slug', async (req, res) => {
    try {
        const db = getDB();
        const doc = await db.collection('documents').findOne({ slug: req.params.slug });

        if (!doc) {
            return res.status(404).json({ error: 'Document not found' });
        }

        // --- NEW: Phase 5 Lazy Schema Migration ---
        // If the author is still just a string, transform it into the new object format
        // in memory before sending it to the client. This hides the DB inconsistency!
        if (typeof doc.metadata.author === 'string') {
            doc.metadata.author = {
                id: null,
                name: doc.metadata.author,
                email: null
            };
        }
        // ------------------------------------------

        res.status(200).json(doc);
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: "Internal server error" });
    }
});

export default router;