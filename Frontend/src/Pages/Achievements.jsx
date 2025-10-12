import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../Styles/Achievements.css'; // The CSS is now imported from this file

export default function Achievements() {
    const navigate = useNavigate();
    const [achievements, setAchievements] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedQuiz, setSelectedQuiz] = useState(null); // For the quiz details modal

    useEffect(() => {
        const fetchAchievements = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch('http://localhost:5000/api/user/achievements', {
                    credentials: 'include',
                });
                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
                }
                const data = await res.json();
                setAchievements(data);
            } catch (err) {
                console.error("Error fetching achievements:", err);
                setError(err.message || "Could not fetch your achievements.");
            } finally {
                setIsLoading(false);
            }
        };
        fetchAchievements();
    }, []);

    const QuizDetailModal = ({ quiz, onClose }) => {
        if (!quiz) return null;
        return (
            <div className="modal-overlay" onClick={onClose}>
                <div className="modal-content quiz-modal" onClick={e => e.stopPropagation()}>
                    <h2>Quiz Review</h2>
                    <div className="detailed-feedback">
                        {quiz.map((res, index) => (
                            <div key={index} className={`feedback-item ${res.is_correct ? 'correct' : 'incorrect'}`}>
                                <p className="feedback-question">{index + 1}. {res.question}</p>
                                <p className="feedback-user-answer">Your Answer: {res.user_answer || "No answer"}</p>
                                {!res.is_correct && <p className="feedback-correct-answer">Correct: {res.correct_answer}</p>}
                            </div>
                        ))}
                    </div>
                    <button className="modal-btn-close" onClick={onClose}>Close</button>
                </div>
            </div>
        );
    };

    return (
        <div className="achievements-page">
            <div className="achievements-header">
                <h1 className="achievements-title">Your Achievements</h1>
                <p className="achievements-subtitle">A summary of your completed roadmap courses and skill analyses.</p>
            </div>

            {isLoading && (
                <div className="feedback-container">
                    <div className="spinner"></div>
                    <p>Loading your achievements...</p>
                </div>
            )}
            
            {error && (
                <div className="feedback-container">
                    <p className="error-message">{error}</p>
                    <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
                </div>
            )}

            {!isLoading && !error && achievements && (
                <>
                    <div className="achievements-grid">
                        <div className="achievement-card">
                            <h3>🎓 Completed Roadmap Courses</h3>
                            {achievements.completed_courses.length > 0 ? (
                                achievements.completed_courses.map((course, index) => (
                                    <div key={index} className="achievement-item">
                                        <p className="course-domain">{course.domain}</p>
                                        <p className="course-title">
                                            {course.course_title} - <span className="score-link" onClick={() => setSelectedQuiz(course.quiz_details)}>Score: {course.score}%</span>
                                        </p>
                                    </div>
                                ))
                            ) : (
                                <p className="no-achievements">You haven't completed any courses yet. Keep learning!</p>
                            )}
                        </div>

                        <div className="achievement-card">
                            <h3>📊 Skill Analysis History</h3>
                            {achievements.skill_analyses.length > 0 ? (
                                achievements.skill_analyses.map((analysis, index) => (
                                    <div key={index} className="analysis-item">
                                        <p>
                                            <span className="analysis-domain">{analysis.domain}</span>
                                            <span className="analysis-date">{analysis.date}</span>
                                        </p>
                                        <div className="analysis-skills-list">
                                            <strong>Missing Skills:</strong> 
                                            {analysis.missing_skills.length > 0 ? analysis.missing_skills.map((skill, i) => (
                                                <span key={i} className="skill-tag-sm">{skill}</span>
                                            )) : " None"}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <p className="no-achievements">No skill gap analyses have been run yet.</p>
                            )}
                        </div>
                    </div>
                     <div style={{ textAlign: 'center', marginTop: '2rem' }}>
                        <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')}>
                            Return to Dashboard
                        </button>
                    </div>
                </>
            )}
            
            <QuizDetailModal quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />
        </div>
    );
}

