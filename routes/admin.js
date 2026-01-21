const express = require('express');
const { authenticate, isAdmin } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database').default;

const router = express.Router();

// Admin dashboard stats
router.get('/dashboard', authenticate, isAdmin, async (req, res) => {
    try {
        const [
            usersResult,
            artistsResult,
            songsResult,
            viewsResult
        ] = await Promise.all([
            db.query('SELECT COUNT(*) FROM users'),
            db.query('SELECT COUNT(*) FROM artists'),
            db.query('SELECT COUNT(*) FROM media'),
            db.query('SELECT COALESCE(SUM(views), 0) as total_views FROM media')
        ]);

        const stats = {
            status: 'OK',
            total_users: parseInt(usersResult.rows[0].count),
            total_artists: parseInt(artistsResult.rows[0].count),
            total_songs: parseInt(songsResult.rows[0].count),
            total_views: parseInt(viewsResult.rows[0].total_views)
        };

        res.json(stats);
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Verify artist
router.post('/verify-artist/:id', authenticate, isAdmin, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'UPDATE artists SET is_verified = true WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Artist not found' });
        }

        res.json({ message: 'Artist Verified by Admin' });
    } catch (error) {
        console.error('Verify artist error:', error);
        res.status(400).json({ error: error.message });
    }
});

// Health check
router.get('/health', (req, res) => {
    res.json({
        database: 'Connected',
        server: 'Running'
    });
});

// Ads management routes
router.post('/ads/create', authenticate, isAdmin, async (req, res) => {
    try {
        const { title, image_url, target_url, type } = req.body;
        const adId = uuidv4();

        await db.query(
            `INSERT INTO ads (id, title, ad_image_url, target_url, ad_type) 
             VALUES ($1, $2, $3, $4, $5)`,
            [adId, title || 'Untitled Ad', image_url || '', target_url || '', type || 'BANNER']
        );

        res.status(201).json({
            message: 'Ad Created',
            ad_id: adId
        });
    } catch (error) {
        console.error('Create ad error:', error);
        res.status(500).json({ error: 'Error creating ad' });
    }
});

// Assign ad to song
router.post('/ads/assign', authenticate, isAdmin, async (req, res) => {
    try {
        const { song_id, ad_id } = req.body;

        const result = await db.query(
            'UPDATE media SET ad_id = $1 WHERE id = $2 RETURNING id',
            [ad_id, song_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Song ID not found in database' });
        }

        res.json({ message: 'Success' });
    } catch (error) {
        console.error('Assign ad error:', error);
        res.status(400).json({ error: error.message });
    }
});

module.exports = router;