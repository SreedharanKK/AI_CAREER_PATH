import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/LearningRecommendations.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';

export default function LearningRecommendations() {
    const navigate = useNavigate();
    const [userData, setUserData] = useState(null);
    const [recommendations, setRecommendations] = useState([]);
    const canvasRef = useRef(null); // ADDED: Ref for the canvas element
    const { apiFetch, isLoading, error } = useApi();
    useParticleBackground(canvasRef);

    // This data-fetching logic is unchanged
    const fetchRecommendations = async () => {
        const data = await apiFetch('/api/user/learning-recommendations');
        if (data) {
            setUserData({ degree: data.degree, stream: data.stream });
            setRecommendations(data.recommendations);
        }
    };
    
    const handleRefreshRecommendations = async () => {
        const data = await apiFetch('/api/user/learning-recommendations/generate', {
            method: 'POST'
        });
        if (data) {
            setUserData({ degree: data.degree, stream: data.stream });
            setRecommendations(data.recommendations);
        }
    };

    useEffect(() => {
        fetchRecommendations();
    }, []);

    return (
        <AnimatedPage>
            <div className="recs-page-container">
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>
            <div className="recs-content-wrapper">
                <div className="recs-header">
                    <h1 className="recs-title">AI Learning Recommendations</h1>
                    <p className="recs-subtitle">Personalized suggestions based on your academic profile and future industry trends.</p>
                    {userData && (
                        <div className="user-profile-info">
                            <strong>Your Profile:</strong> {userData.degree} - {userData.stream}
                        </div>
                    )}
                </div>
                
                <div className="recs-actions">
                    <button className="refresh-btn" onClick={handleRefreshRecommendations} disabled={isLoading}>
                        {isLoading ? 'AI is Refreshing...' : 'Get New AI Recommendations'}
                    </button>
                    <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')}>
                        Return to Dashboard
                    </button>
                </div>

                {isLoading && (
                    <div className="feedback-container">
                        <div className="spinner"></div>
                        <p>Analyzing your profile and generating recommendations...</p>
                    </div>
                )}
                
                {error && (
                    <div className="feedback-container">
                        <p className="error-message">{error}</p>
                        
                    </div>
                )}

                {!isLoading && !error && (
                    <div className="recommendations-grid">
                        {recommendations.map((rec, index) => (
                            <div key={index} className="rec-card">
                                <h3 className="rec-topic">{rec.topic}</h3>
                                <div className="rec-section">
                                    <h4>Key Skills to Learn</h4>
                                    <div className="rec-skills-container">
                                        {rec.skills_to_learn?.map((skill, i) => (
                                            <span key={i} className="rec-skill-tag">{skill}</span>
                                        ))}
                                    </div>
                                </div>
                                <div className="rec-section">
                                    <h4>Current Scope (2025)</h4>
                                    <p>{rec.current_scope}</p>
                                </div>
                                <div className="rec-section">
                                    <h4>Future Scope (3-5 Years)</h4>
                                    <p>{rec.future_scope}</p>
                                </div>
                                <div className="rec-section">
                                    <h4>How to Get Started</h4>
                                    <p>{rec.getting_started}</p>
                                </div>
                                <div className="rec-section">
                                    <h4>Estimated Time to Learn</h4>
                                    <p>{rec.estimated_time}</p>
                                </div>
                                <div className="rec-section">
                                    <h4>Beginner Project Idea</h4>
                                    <p>{rec.project_idea}</p>
                                </div>
                                <div className="rec-section interview-section">
                                    <h4>Sample Interview Question</h4>
                                    <p>"{rec.interview_question}"</p>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
        </AnimatedPage>
    );
}

