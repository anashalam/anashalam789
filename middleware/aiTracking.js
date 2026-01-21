const db = require('../config/database').default;
const { v4: uuidv4 } = require('uuid');

const trackUserAction = async (req, res, next) => {
    try {
        const { song_id, action } = req.query;
        const userId = req.user?.userId;

        if (userId && song_id) {
            // Track in database
            await db.query(
                `INSERT INTO user_history (user_id, song_id, action_type) 
                 VALUES ($1, $2, $3)`,
                [userId, song_id, action || 'PLAY']
            );
        }
        
        next();
    } catch (error) {
        console.error('Tracking error:', error);
        // Don't fail the request if tracking fails
        next();
    }
};

module.exports = trackUserAction;