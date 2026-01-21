const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/database').default;

const router = express.Router();

// Configure multer for profile pictures
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = 'uploads/profiles/';
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

const upload = multer({ 
    storage,
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        const allowedTypes = /jpeg|jpg|png|gif/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);
        
        if (extname && mimetype) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed'));
        }
    }
});

// Get user profile
router.get('/profile', authenticate, async (req, res) => {
    try {
        const result = await db.query(
            'SELECT id, username, email, bio, profile_pic_url FROM users WHERE id = $1',
            [req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        const user = result.rows[0];
        const response = {
            id: user.id,
            username: user.username,
            email: user.email,
            bio: user.bio || 'No bio yet',
            profile_pic: user.profile_pic_url || ''
        };

        res.json(response);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Update user bio
router.patch('/update-bio', authenticate, async (req, res) => {
    try {
        const { bio } = req.body;

        if (!bio) {
            return res.status(400).json({ error: 'Bio field is missing' });
        }

        const result = await db.query(
            'UPDATE users SET bio = $1 WHERE id = $2 RETURNING id',
            [bio, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ message: 'Bio updated successfully!' });
    } catch (error) {
        console.error('Update bio error:', error);
        res.status(500).json({ error: 'Failed to update bio' });
    }
});

// Upload profile picture
router.post('/upload-pic', authenticate, upload.single('profile_pic'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        const filePath = `uploads/profiles/${req.file.filename}`;

        // Update database
        const result = await db.query(
            'UPDATE users SET profile_pic_url = $1 WHERE id = $2 RETURNING id',
            [filePath, req.user.userId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ 
            message: 'Profile picture uploaded successfully!',
            url: filePath
        });
    } catch (error) {
        console.error('Upload profile pic error:', error);
        
        // Delete uploaded file if there was an error
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }
        
        res.status(500).json({ 
            error: error.message || 'Failed to upload profile picture' 
        });
    }
});

module.exports = router;