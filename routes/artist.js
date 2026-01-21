const express = require('express');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database').default;

const router = express.Router();

// Get artist profile (public)
router.get('/profile/:id', async (req, res) => {
    try {
        const { id } = req.params;

        // Get artist info
        const artistResult = await db.query(
            `SELECT a.id, a.stage_name, a.bio, a.is_verified, 
                    u.username, u.profile_pic_url
             FROM artists a
             JOIN users u ON a.user_id = u.id
             WHERE a.id = $1`,
            [id]
        );

        if (artistResult.rows.length === 0) {
            return res.status(404).json({ error: 'Artist profile not found' });
        }

        const artist = artistResult.rows[0];

        // Get follower count
        const followerResult = await db.query(
            'SELECT COUNT(*) FROM followers WHERE artist_id = $1',
            [id]
        );

        // Get artist's songs
        const songsResult = await db.query(
            'SELECT id, title, file_url FROM media WHERE artist_id = $1',
            [id]
        );

        const songs = songsResult.rows.map(song => ({
            id: song.id,
            title: song.title,
            file_url: song.file_url
        }));

        const response = {
            stage_name: artist.stage_name,
            bio: artist.bio,
            is_verified: artist.is_verified,
            follower_count: parseInt(followerResult.rows[0].count),
            songs: songs,
            profile_pic: artist.profile_pic_url
        };

        res.json(response);
    } catch (error) {
        console.error('Artist profile error:', error);
        res.status(500).json({ error: 'Server Error' });
    }
});

// Register as artist (protected)
router.post('/register', authenticate, async (req, res) => {
    try {
        const { stage_name } = req.body;

        if (!stage_name) {
            return res.status(400).json({ error: 'Stage name is required' });
        }

        // Check if already an artist
        const existingArtist = await db.query(
            'SELECT id FROM artists WHERE user_id = $1',
            [req.user.userId]
        );

        if (existingArtist.rows.length > 0) {
            return res.status(400).json({ error: 'Already an artist' });
        }

        const artistId = uuidv4();

        // Create artist record
        await db.query(
            'INSERT INTO artists (id, user_id, stage_name) VALUES ($1, $2, $3)',
            [artistId, req.user.userId, stage_name]
        );

        // Update user role
        await db.query(
            'UPDATE users SET role = $1 WHERE id = $2',
            ['artist', req.user.userId]
        );

        res.status(201).json({
            message: 'Artist registered!',
            artist_id: artistId
        });
    } catch (error) {
        console.error('Artist registration error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;