const axios = require('axios');

class AIClient {
    constructor() {
        this.aiBaseUrl = process.env.AI_SERVER_URL || 'http://127.0.0.1:5000';
        this.client = axios.create({
            baseURL: this.aiBaseUrl,
            timeout: 10000
        });
    }

    async fetchRecommendations(userId) {
        try {
            const response = await this.client.get('/recommend', {
                params: { user_id: userId }
            });
            return response.data;
        } catch (error) {
            console.error('AI Client Error:', error.message);
            return []; // Return empty array on error
        }
    }

    async trackUserAction(userId, songId, action = 'PLAY') {
        try {
            // This would typically send data to AI service for tracking
            // For now, we'll just log it
            console.log(`AI Tracking: User ${userId} ${action} song ${songId}`);
            return true;
        } catch (error) {
            console.error('AI Tracking Error:', error);
            return false;
        }
    }
}

module.exports = new AIClient();