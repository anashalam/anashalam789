const express = require('express');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

// Follow artist
router.post('/follow/:artistId', authenticate, async (req, res) => {
    try {
        const { artistId } = req.params;

        // Check if already following
        const existingFollow = await db.query(
            'SELECT id FROM followers WHERE user_id = $1 AND artist_id = $2',
            [req.user.userId, artistId]
        );

        if (existingFollow.rows.length > 0) {
            return res.status(409).json({ error: 'You are already following this artist' });
        }

        const followId = uuidv4();

        await db.query(
            'INSERT INTO followers (id, user_id, artist_id) VALUES ($1, $2, $3)',
            [followId, req.user.userId, artistId]
        );

        res.json({ message: 'You are now following this artist' });
    } catch (error) {
        console.error('Follow error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Unfollow artist
router.delete('/unfollow/:artistId', authenticate, async (req, res) => {
    try {
        const { artistId } = req.params;

        await db.query(
            'DELETE FROM followers WHERE user_id = $1 AND artist_id = $2',
            [req.user.userId, artistId]
        );

        res.json({ message: 'Unfollowed' });
    } catch (error) {
        console.error('Unfollow error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get following list
router.get('/my-following', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT a.id, a.stage_name, a.profile_image_url
             FROM followers f
             JOIN artists a ON f.artist_id = a.id
             WHERE f.user_id = $1`,
            [req.user.userId]
        );

        const following = result.rows.map(row => ({
            id: row.id,
            name: row.stage_name,
            profile_image: row.profile_image_url
        }));

        res.json(following);
    } catch (error) {
        console.error('Get following error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Like a song
router.post('/like/:songId', authenticate, async (req, res) => {
    try {
        const { songId } = req.params;

        // Check if already liked
        const existingLike = await db.query(
            'SELECT id FROM likes WHERE user_id = $1 AND song_id = $2',
            [req.user.userId, songId]
        );

        if (existingLike.rows.length > 0) {
            return res.status(409).json({ error: 'Already liked' });
        }

        const likeId = uuidv4();

        await db.query(
            'INSERT INTO likes (id, user_id, song_id) VALUES ($1, $2, $3)',
            [likeId, req.user.userId, songId]
        );

        res.json({ message: 'Song Liked!' });
    } catch (error) {
        console.error('Like error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get liked songs
router.get('/my-likes', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            `SELECT m.id, m.title, m.file_url, m.genre,
                    a.stage_name as artist_name
             FROM likes l
             JOIN media m ON l.song_id = m.id
             JOIN artists a ON m.artist_id = a.id
             WHERE l.user_id = $1`,
            [req.user.userId]
        );

        const likedSongs = result.rows.map(row => ({
            id: row.id,
            title: row.title,
            file_url: row.file_url,
            genre: row.genre,
            artist_name: row.artist_name
        }));

        res.json(likedSongs);
    } catch (error) {
        console.error('Get likes error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;