const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

// Import routes
const authRoutes = require('./routes/auth');
const mediaRoutes = require('./routes/media');
const artistRoutes = require('./routes/artist');
const socialRoutes = require('./routes/social');
const playlistRoutes = require('./routes/playlist');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

// Import middleware
const { authenticate } = require('./middleware/auth');
const trackUserAction = require('./middleware/aiTracking');
const aiClient = require('./utils/aiClient');

const app = express();
const PORT = process.env.PORT || 8800;

// Ensure upload directories exist
const uploadDirs = ['uploads', 'uploads/profiles'];
uploadDirs.forEach(dir => {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
});

// Middleware
app.use(helmet());
app.use(cors({
    origin: ['http://localhost', 'http://127.0.0.1', 'http://localhost:5500', 'http://127.0.0.1:5500', 'http://localhost:3000'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));
app.use(morgan('combined'));
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// Basic route
app.get('/', (req, res) => {
    res.send('🎵 Music App Backend is Running!');
});

// Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/media', mediaRoutes); // Line 57
app.use('/api/v1/artists', artistRoutes);
app.use('/api/v1/social', authenticate, socialRoutes);
app.use('/api/v1/playlists', authenticate, playlistRoutes);
app.use('/api/v1/user', authenticate, userRoutes);
app.use('/api/v1/admin', authenticate, adminRoutes);

// AI Recommendations route
app.get('/api/recommendations/:userId', async (req, res) => {
    try {
        const { userId } = req.params;
        const recommendations = await aiClient.fetchRecommendations(userId);
        res.json(recommendations);
    } catch (error) {
        console.error('Recommendations error:', error);
        res.status(500).json({ error: 'Failed to fetch recommendations' });
    }
});

// AI Tracking route
app.post('/api/v1/ai/track', authenticate, async (req, res) => {
    try {
        const { song_id, action } = req.query;
        
        if (!song_id) {
            return res.status(400).json({ error: 'Missing parameters' });
        }

        // Track in database
        await db.query(
            `INSERT INTO user_history (user_id, song_id, action_type) 
             VALUES ($1, $2, $3)`,
            [req.user.userId, song_id, action || 'PLAY']
        );

        // Also send to AI service if needed
        await aiClient.trackUserAction(req.user.userId, song_id, action);

        res.json({ message: 'Tracked' });
    } catch (error) {
        console.error('Tracking error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Health check
app.get('/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    
    if (err.name === 'MulterError') {
        return res.status(400).json({ error: 'File upload error: ' + err.message });
    }
    
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📁 Upload directory: ${path.join(__dirname, 'uploads')}`);
    console.log(`🔗 Health check: http://localhost:${PORT}/health`);
});

module.exports = app;