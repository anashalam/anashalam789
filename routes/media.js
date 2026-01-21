const express = require('express');
const multer = require('multer'); 
const path = require('path');
const fs = require('fs');
const { v4: uuidv4 } = require('uuid');
const { authenticate } = require('../middleware/auth');
const db = require('../config/database').default;

const router = express.Router();

// AB YE LINE CHALEGI
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
})

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

const songUpload = upload.fields([
    { name: 'file', maxCount: 1 },
    { name: 'thumble', maxCount: 1 }
]);
router.post('/upload', authenticate, (req, res) => {
    songUpload(req, res, async (err) => {
        if (err) {
            console.error('Multer Error:', err);
            return res.status(400).json({ error: 'Upload error. Use "file" and "thumble" fields.' });
        }
        try {
            const { title, genre } = req.body;
            const audioFile = req.files['file'] ? req.files['file'][0] : null;
            const thumbFile = req.files['thumble'] ? req.files['thumble'][0] : null;

            if (!audioFile || !title) {
                return res.status(400).json({ error: 'Missing required fields' });
            }

            const artistResult = await db.query('SELECT id FROM artists WHERE user_id = $1', [req.user.userId]);
            if (artistResult.rows.length === 0) return res.status(403).json({ error: 'Not an artist' });

            const newMedia = await db.query(
                `INSERT INTO media (artist_id, title, genre, file_url, thumbnail_url, views) 
                 VALUES ($1, $2, $3, $4, $5, 0) RETURNING id`,
                [artistResult.rows[0].id, title, genre || 'Unknown', `/uploads/${audioFile.filename}`, thumbFile ? `/uploads/${thumbFile.filename}` : null]
            );
            res.status(201).json({ message: 'Uploaded!', song_id: newMedia.rows[0].id });
        } catch (error) {
            res.status(500).json({ error: 'DB Error' });
        }
    });
});

// Delete song (protected)
// ... (Purana storage aur upload logic sahi hai)

// DELETE ROUTE FIXED
router.delete('/delete/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;
        const songResult = await db.query(
            `SELECT m.file_url, m.thumbnail_url, a.user_id FROM media m 
             JOIN artists a ON m.artist_id = a.id WHERE m.id = $1`, [id]
        );
        if (songResult.rows.length === 0) return res.status(404).json({ error: 'Not found' });

        const song = songResult.rows[0];
        if (song.user_id !== req.user.userId) return res.status(403).json({ error: 'Unauthorized' });

        const deleteFile = (relPath) => {
            if (relPath) {
                const fullPath = path.join(__dirname, '..', relPath); // Path fixing
                if (fs.existsSync(fullPath)) fs.unlinkSync(fullPath);
            }
        };
        deleteFile(song.file_url);
        deleteFile(song.thumbnail_url);

        await db.query('DELETE FROM media WHERE id = $1', [id]);
        res.json({ message: 'Deleted' });
    } catch (error) { res.status(500).json({ error: 'Failed' }); }
});

// media.js ke bilkul end mein ye hona chahiye:
module.exports = router;
