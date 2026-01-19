const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/';
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const ext = path.extname(file.originalname);
        cb(null, `${uuidv4()}${ext}`);
    }
});

const upload = multer({ storage });

// Search songs
router.get('/search', async (req, res) => {
    try {
        const { q } = req.query;
        
        if (!q || q.trim() === '') {
            return res.status(400).json({ error: 'Search query is empty' });
        }

        const searchQuery = `%${q.toLowerCase()}%`;
        
        const result = await db.query(
            `SELECT m.id, m.title, m.file_url, m.genre, m.artist_id, m.views,
                    a.stage_name as artist_name
             FROM media m
             LEFT JOIN artists a ON m.artist_id = a.id
             WHERE LOWER(m.title) LIKE $1 
                OR LOWER(m.genre) LIKE $1 
                OR LOWER(a.stage_name) LIKE $1`,
            [searchQuery]
        );

        const songs = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            file_url: row.file_url,
            genre: row.genre,
            artist_id: row.artist_id,
            artist_name: row.artist_name,
            views: row.views
        }));

        res.json(songs);
    } catch (error) {
        console.error('Search error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get all songs
router.get('/all', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT m.id, m.title, m.file_url, m.genre, m.artist_id, m.views,
                    a.stage_name as artist_name
             FROM media m
             LEFT JOIN artists a ON m.artist_id = a.id
             ORDER BY m.created_at DESC`
        );

        const songs = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            file_url: row.file_url,
            genre: row.genre,
            artist_id: row.artist_id,
            artist_name: row.artist_name,
            views: row.views
        }));

        res.json(songs);
    } catch (error) {
        console.error('Get all songs error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Increment play count
router.post('/play/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'UPDATE media SET views = views + 1 WHERE id = $1 RETURNING id',
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Song not found' });
        }

        res.json({ message: 'View count updated' });
    } catch (error) {
        console.error('Play error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get trending songs
router.get('/trending', async (req, res) => {
    try {
        const result = await db.query(
            `SELECT m.id, m.title, m.file_url, m.genre, m.views,
                    a.stage_name as artist_name
             FROM media m
             LEFT JOIN artists a ON m.artist_id = a.id
             ORDER BY m.views DESC
             LIMIT 10`
        );

        const songs = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            file_url: row.file_url,
            genre: row.genre,
            artist_name: row.artist_name,
            views: row.views
        }));

        res.json(songs);
    } catch (error) {
        console.error('Trending error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get song details with ad info
router.get('/details/:id', async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            `SELECT m.id, m.title, m.file_url, m.views,
                    ad.id as ad_id, ad.title as ad_title, 
                    ad.ad_image_url as ad_image, ad.target_url
             FROM media m
             LEFT JOIN ads ad ON m.ad_id = ad.id
             WHERE m.id = $1`,
            [id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Song not found' });
        }

        const row = result.rows[0];
        const response = {
            id: row.id,
            title: row.title,
            file_url: row.file_url,
            views: row.views,
            ad_info: row.ad_id ? {
                ad_id: row.ad_id,
                ad_title: row.ad_title,
                ad_image: row.ad_image,
                target_url: row.target_url
            } : null
        };

        res.json(response);
    } catch (error) {
        console.error('Details error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Upload song (protected)
// Upload song (protected)
router.post('/upload', authenticate, (req, res) => {
    // 1. Multer ko manually handle karein taaki busboy error catch ho sake
    upload.single('file')(req, res, async (err) => {
        if (err) {
            console.error('Multer/Busboy Error:', err);
            return res.status(400).json({ error: 'File upload error. Check your Postman headers!' });
        }

        try {
            const { title, genre } = req.body;
            const file = req.file;

            // Basic validation
            if (!file || !title) {
                return res.status(400).json({ error: 'Missing required fields (file and title)' });
            }

            // 2. Sirf Artist Check karein (User check ki alag se zarurat nahi kyunki authenticate middleware hai)
            const artistResult = await db.query(
                'SELECT id FROM artists WHERE user_id = $1',
                [req.user.userId]
            );

            if (artistResult.rows.length === 0) {
                return res.status(403).json({ error: 'Only registered artists can upload songs' });
            }

            const artistId = artistResult.rows[0].id;

            // 3. Database Query (Hum id ko DB par chhod rahe hain - gen_random_uuid)
            const newMedia = await db.query(
                `INSERT INTO media (artist_id, title, genre, file_url, views) 
                 VALUES ($1, $2, $3, $4, 0) 
                 RETURNING id`, // Returning id taaki humein pata chale kya generate hua
                [artistId, title, genre || 'Unknown', `/uploads/${file.filename}`]
            );

            res.status(201).json({ 
                message: 'Uploaded!',
                song_id: newMedia.rows[0].id
            });

        } catch (error) {
            console.error('Upload error:', error);
            res.status(500).json({ error: 'Server database error' });
        }
    });
});

// Delete song (protected)
router.delete('/delete/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Check if user owns this song
        const songResult = await db.query(
            `SELECT m.file_url, a.user_id 
             FROM media m
             JOIN artists a ON m.artist_id = a.id
             WHERE m.id = $1`,
            [id]
        );

        if (songResult.rows.length === 0) {
            return res.status(404).json({ error: 'Song not found' });
        }

        const song = songResult.rows[0];

        if (song.user_id !== req.user.userId) {
            return res.status(403).json({ error: 'Unauthorized' });
        }

        // Delete file
        if (fs.existsSync(song.file_url)) {
            fs.unlinkSync(song.file_url);
        }

        // Delete from database
        await db.query('DELETE FROM media WHERE id = $1', [id]);

        res.json({ message: 'Deleted' });
    } catch (error) {
        console.error('Delete error:', error);
        res.status(500).json({ error: 'Action Failed' });
    }
});

module.exports = router;