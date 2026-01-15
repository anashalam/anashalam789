const express = require('express');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database');

const router = express.Router();

// Create playlist
router.post('/create', authenticate, async (req, res) => {
    try {
        const { name } = req.body;
        const playlistId = uuidv4();

        await db.query(
            'INSERT INTO playlists (id, user_id, name) VALUES ($1, $2, $3)',
            [playlistId, req.user.userId, name || 'My Playlist']
        );

        res.status(201).json({
            message: 'Playlist created!',
            id: playlistId
        });
    } catch (error) {
        console.error('Create playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Add song to playlist
router.post('/add-song', authenticate, async (req, res) => {
    try {
        const { playlist_id, song_id } = req.body;

        if (!playlist_id || !song_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        // Check if playlist belongs to user
        const playlistResult = await db.query(
            'SELECT id FROM playlists WHERE id = $1 AND user_id = $2',
            [playlist_id, req.user.userId]
        );

        if (playlistResult.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found or unauthorized' });
        }

        // Check if song exists
        const songResult = await db.query(
            'SELECT id FROM media WHERE id = $1',
            [song_id]
        );

        if (songResult.rows.length === 0) {
            return res.status(404).json({ error: 'Song not found' });
        }

        // Check if already in playlist
        const existingResult = await db.query(
            'SELECT id FROM playlist_songs WHERE playlist_id = $1 AND song_id = $2',
            [playlist_id, song_id]
        );

        if (existingResult.rows.length > 0) {
            return res.status(409).json({ error: 'Song already in playlist' });
        }

        await db.query(
            'INSERT INTO playlist_songs (playlist_id, song_id) VALUES ($1, $2)',
            [playlist_id, song_id]
        );

        res.json({ message: 'Song added to playlist!' });
    } catch (error) {
        console.error('Add song to playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get playlist details
router.get('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        // Get playlist info
        const playlistResult = await db.query(
            'SELECT id, name FROM playlists WHERE id = $1 AND user_id = $2',
            [id, req.user.userId]
        );

        if (playlistResult.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        const playlist = playlistResult.rows[0];

        // Get songs in playlist
        const songsResult = await db.query(
            `SELECT m.id, m.title, m.file_url, m.genre, m.artist_id,
                    a.stage_name as artist_name
             FROM playlist_songs ps
             JOIN media m ON ps.song_id = m.id
             JOIN artists a ON m.artist_id = a.id
             WHERE ps.playlist_id = $1`,
            [id]
        );

        const songs = songsResult.rows.map(row => ({
            id: row.id,
            title: row.title,
            file_url: row.file_url,
            genre: row.genre,
            artist_id: row.artist_id,
            artist_name: row.artist_name
        }));

        const response = {
            playlist_name: playlist.name,
            songs: songs
        };

        res.json(response);
    } catch (error) {
        console.error('Get playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Remove song from playlist
router.delete('/remove-song', authenticate, async (req, res) => {
    try {
        const { playlist_id, song_id } = req.body;

        if (!playlist_id || !song_id) {
            return res.status(400).json({ error: 'Missing required fields' });
        }

        const result = await db.query(
            `DELETE FROM playlist_songs 
             WHERE playlist_id = $1 AND song_id = $2
             RETURNING id`,
            [playlist_id, song_id]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Song link not found' });
        }

        res.json({ message: 'Song removed from playlist!' });
    } catch (error) {
        console.error('Remove song error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Delete playlist
router.delete('/:id', authenticate, async (req, res) => {
    try {
        const { id } = req.params;

        const result = await db.query(
            'DELETE FROM playlists WHERE id = $1 AND user_id = $2 RETURNING id',
            [id, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Playlist not found' });
        }

        res.json({ message: 'Playlist deleted successfully!' });
    } catch (error) {
        console.error('Delete playlist error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;