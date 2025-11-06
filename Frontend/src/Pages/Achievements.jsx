import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import useParticleBackground from '../hooks/UseParticleBackground';
import '../Styles/Achievements.css';
import { useApi } from '../hooks/useApi';
import toast from 'react-hot-toast';
import { Share2, X } from 'lucide-react'; // --- Import icons ---

// --- Copied from PracticePage.jsx for Modal ---
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js';
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
import 'prismjs/components/prism-markup';
import 'prismjs/components/prism-css';
import 'prismjs/themes/prism-tomorrow.css'; 

// Register Chart.js
ChartJS.register(
  RadialLinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend
);

// --- Helper Component: AiAnalysisDisplay ---
const AiAnalysisDisplay = ({ analysis }) => {
     if (!analysis || !analysis.scores) return null;
     let statusClass = 'status-unknown';
     const lowerStatus = analysis.overall_status?.toLowerCase() || '';
     if (lowerStatus.includes('correct')) { statusClass = 'status-correct'; }
     else if (lowerStatus.includes('incorrect') || lowerStatus.includes('error')) { statusClass = 'status-incorrect'; }
     else if (lowerStatus.includes('issue')) { statusClass = 'status-issue'; }
     const chartData = {
         labels: ['Correctness', 'Efficiency', 'Readability', 'Robustness'],
         datasets: [{
             label: 'Score (out of 10)', data: [
                 analysis.scores.correctness || 0, analysis.scores.efficiency || 0,
                 analysis.scores.readability || 0, analysis.scores.robustness || 0,
             ],
             backgroundColor: 'rgba(199, 125, 255, 0.2)', borderColor: 'rgba(199, 125, 255, 1)',
             borderWidth: 2,
         }],
     };
     const chartOptions = {
         scales: { r: {
             angleLines: { color: 'rgba(255, 255, 255, 0.2)' }, grid: { color: 'rgba(255, 255, 255, 0.2)' },
             pointLabels: { color: '#e0e0e0', font: { size: 13 } },
             ticks: { color: '#a0a0b0', backdropColor: 'rgba(11, 2, 29, 0.8)', stepSize: 2, suggestedMin: 0, suggestedMax: 10, },
             min: 0, max: 10,
         }},
         plugins: { legend: { display: false } },
         maintainAspectRatio: false,
     };
     return (
         <div className="ai-analysis-section">
             <h3>AI Code Analysis: <span className={`analysis-status-badge ${statusClass}`}>{analysis.overall_status || 'N/A'}</span></h3>
             <div className="analysis-chart-container"> <Radar data={chartData} options={chartOptions} /> </div>
             <div className="analysis-block summary">
                 <h4>Summary:</h4> <p>{analysis.summary_feedback || 'N/A'}</p>
             </div>
         </div>
     );
};

// --- Helper Function: getLanguageFromSkill ---
function getLanguageFromSkill(skillName) {
    if (!skillName) return 'python';
    const lowerSkill = skillName.toLowerCase().trim();
    if (lowerSkill === 'html') return 'html';
    if (lowerSkill === 'css') return 'css';
    if (lowerSkill === 'java') return 'java';
    if (lowerSkill === 'python' || lowerSkill === 'py') return 'python';
    if (lowerSkill === 'c++' || lowerSkill === 'cpp') return 'cpp';
    if (lowerSkill === 'c') return 'c';
    if (lowerSkill === 'js' || lowerSkill.includes('javascript') || lowerSkill.includes('react') || lowerSkill.includes('node')) {
        return 'javascript';
    }
    return 'python';
}

// --- Helper Function: getPrismLanguage ---
function getPrismLanguage(lang) {
    switch(lang) {
        case 'html': return languages.markup;
        case 'css': return languages.css;
        case 'javascript': return languages.javascript;
        case 'python': return languages.python;
        case 'java': return languages.java;
        case 'cpp': return languages.cpp;
        case 'c': return languages.c;
        default: return languages.clike;
    }
}

// --- Helper Component: HistoryDetailModal ---
const HistoryDetailModal = ({ attempt, onClose }) => {
    if (!attempt) return null;

    const { skill, difficulty, question_data, user_code, ai_analysis, attempted_at } = attempt;
    const language = getLanguageFromSkill(skill);
    const prismLanguage = getPrismLanguage(language);

    return (
        <div className="modal-overlay-practice" onClick={onClose}>
            <div className="modal-content-practice modal-content-history" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn-history" onClick={onClose} aria-label="Close modal"><X size={24} /></button>
                <h2>Practice Review: {skill} ({difficulty})</h2>
                <p className="history-timestamp">{attempted_at}</p>
                
                <div className="history-modal-grid">
                    <div className="history-modal-section">
                        <h3>Problem Description</h3>
                        <div className="history-question-content">
                            <h4>{question_data?.title || 'N/A'}</h4>
                            <p>{question_data?.description || 'N/A'}</p>
                            {question_data?.examples && Array.isArray(question_data.examples) && (
                                <div className="examples-section">
                                    <strong>Examples:</strong>
                                    {question_data.examples.map((ex, i) => (
                                        <pre key={i}><strong>Input:</strong> {ex.input}\n<strong>Output:</strong> {ex.output}</pre>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="history-modal-section">
                        <h3>Your Submission</h3>
                        <div className="history-code-wrapper">
                            <Editor
                                value={user_code || ''}
                                onValueChange={() => {}} // Read-only
                                highlight={code => highlight(code, prismLanguage, language)}
                                padding={15}
                                style={{
                                    fontFamily: '"Fira Code", "Courier New", monospace',
                                    fontSize: 14,
                                    backgroundColor: '#0c031f',
                                    minHeight: '150px',
                                    maxHeight: '200px',
                                    overflowY: 'auto',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '8px',
                                }}
                                readOnly={true}
                                preClassName="code-editor-pre"
                            />
                        </div>
                        {ai_analysis ? ( <AiAnalysisDisplay analysis={ai_analysis} /> ) : ( <p>No AI analysis was saved for this attempt.</p> )}
                    </div>
                </div>
            </div>
        </div>
    );
};
// --- End of Copied Components ---


export default function Achievements() {
    const navigate = useNavigate();
    const [achievements, setAchievements] = useState(null);
    const [selectedQuiz, setSelectedQuiz] = useState(null);
    const [selectedPractice, setSelectedPractice] = useState(null); // --- NEW ---
    const canvasRef = useRef(null);

    const { apiFetch, isLoading, error } = useApi();
    useParticleBackground(canvasRef);

    useEffect(() => {
        const fetchAchievementsData = async () => {
            const data = await apiFetch('/api/user/achievements');
            if (data) {
                setAchievements(data);
            }
        };
        fetchAchievementsData();
    }, [apiFetch]);

    // --- NEW: Share Button Handler ---
    const handleShare = (courseTitle, score) => {
        const textToCopy = `I just passed the "${courseTitle}" quiz with a ${score}% on my AI Career Guider roadmap! 🚀 #AI #CareerDevelopment`;
        try {
            const ta = document.createElement('textarea');
            ta.value = textToCopy;
            ta.style.position = 'absolute';
            ta.style.left = '-9999px';
            document.body.appendChild(ta);
            ta.select();
            document.execCommand('copy');
            document.body.removeChild(ta);
            toast.success("Copied to clipboard!");
        } catch (err) {
            toast.error("Failed to copy.");
        }
    };

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
        <AnimatedPage>
            <div className="achievements-page">
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>
            <div className="achievements-content">
                <div className="achievements-header">
                    <h1 className="achievements-title">Your Achievements</h1>
                    <p className="achievements-subtitle">A summary of your completed roadmap courses and skill analyses.</p>
                     <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')}>
                         Return to Dashboard
                     </button>
                </div>

                {isLoading && !achievements && ( // --- MODIFIED: Show loading only if no data ---
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
                        {/* --- NEW: Stats Panel --- */}
                        <div className="stats-panel">
                            <div className="stat-card">
                                <span className="stat-value">{achievements.completed_courses.length}</span>
                                <span className="stat-label">Courses Completed</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{achievements.skill_analyses.length}</span>
                                <span className="stat-label">Analyses Run</span>
                            </div>
                            <div className="stat-card">
                                <span className="stat-value">{achievements.practice_skill_count}</span> 
                                <span className="stat-label">Skills Practiced</span>
                            </div>
                        </div>

                        <div className="achievements-grid">
                            <div className="achievement-card">
                                <h3>🎓 Completed Roadmap Courses</h3>
                                {achievements.completed_courses.length > 0 ? (
                                    achievements.completed_courses.map((course, index) => (
                                        <div key={index} className="achievement-item">
                                            <p className="course-domain">{course.domain}</p>
                                            <p className="course-title">
                                                {course.course_title} - <span className="score-link" onClick={() => setSelectedQuiz(course.quiz_details)}>Score: {course.score}%</span>
                                                {/* --- NEW: Share Button --- */}
                                                <button 
                                                    className="share-btn" 
                                                    title="Share this achievement"
                                                    onClick={() => handleShare(course.course_title, course.score)}
                                                >
                                                    <Share2 size={16} />
                                                </button>
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
                            
                            {/* --- NEW: Practice History Card --- */}
                            <div className="achievement-card">
                                <h3>🧠 Practice History</h3>
                                {achievements.practice_history.length > 0 ? (
                                    achievements.practice_history.map((attempt) => (
                                        <div key={attempt.id} className="analysis-item practice-item">
                                            <p>
                                                <span className="analysis-domain">{attempt.skill} ({attempt.difficulty})</span>
                                                <span className="analysis-date">{attempt.date}</span>
                                            </p>
                                            <div className="analysis-skills-list">
                                                <strong>Status:</strong> 
                                                <span className={`status-dot ${attempt.status?.toLowerCase().includes('correct') ? 'correct' : 'incorrect'}`}></span>
                                                {attempt.status || 'N/A'}
                                                <span className="score-link" onClick={() => setSelectedPractice(attempt.details)}>
                                                    View Details
                                                </span>
                                            </div>
                                        </div>
                                    ))
                                ) : (
                                    <p className="no-achievements">No practice problems submitted yet.</p>
                                )}
                            </div>

                        </div>
                    </>
                )}
            </div>
            <QuizDetailModal quiz={selectedQuiz} onClose={() => setSelectedQuiz(null)} />
            
            {/* --- NEW: Render Practice Modal --- */}
            <HistoryDetailModal attempt={selectedPractice} onClose={() => setSelectedPractice(null)} />
            </div>
        </AnimatedPage>
    );
}