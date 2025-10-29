import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { BrainCircuit, Clock, X } from 'lucide-react'; // Icon for page title
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement,
  LineElement, Filler, Tooltip, Legend,
} from 'chart.js';
ChartJS.register(
  RadialLinearScale, PointElement, LineElement,
  Filler, Tooltip, Legend
);

// --- Editor Imports (Needed for modal) ---
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
import 'prismjs/themes/prism-tomorrow.css'; // Match theme

// --- Component Imports ---
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/PracticePage.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import toast from 'react-hot-toast';

// --- Re-usable AiAnalysisDisplay component ---
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

// --- Re-usable Language Helpers ---
// (These are used by the History Modal)
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

// --- History Detail Modal Component ---
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
                    {/* Left Side: Question */}
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

                    {/* Right Side: Code & Analysis */}
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

// --- *** NEW: Helper to filter skills *** ---
// Only allow skills that map to a "runnable" language
const PRACTICEABLE_LANGUAGES = ['python', 'java', 'javascript', 'c++', 'cpp', 'c', 'react', 'node', 'js'];
function isPracticeable(skill) {
    if (!skill) return false;
    const lowerSkill = skill.toLowerCase().trim();
    // Check if skill name contains any practiceable keywords
    return PRACTICEABLE_LANGUAGES.some(lang => lowerSkill.includes(lang));
}
// -----------------------------------------

// --- Main Practice Page Component ---
export default function PracticePage() {
    const navigate = useNavigate();
    const [skills, setSkills] = useState([]);
    const [selectedSkill, setSelectedSkill] = useState(null);
    // --- *** FIX: Standardize state name *** ---
    const [isDifficultyModalOpen, setIsDifficultyModalOpen] = useState(false);
    
    // --- History State ---
    const [history, setHistory] = useState([]);
    const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
    const [selectedAttempt, setSelectedAttempt] = useState(null);
    const [isFetchingHistory, setIsFetchingHistory] = useState(true);
    // -----------------------

    const [isFetchingSkills, setIsFetchingSkills] = useState(true);
    const canvasRef = useRef(null);
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    useParticleBackground(canvasRef);

    // Fetch user's skills AND practice history on mount
    useEffect(() => {
        let isMounted = true;
        const fetchAllData = async () => {
            setIsFetchingSkills(true);
            setIsFetchingHistory(true);
            setError(null);
            
            const results = await Promise.allSettled([
                 apiFetch('/api/user/skill-gap/skills'),
                 apiFetch('/api/user/practice/history')
            ]);

            if (!isMounted) return;

            // Process Skills Result (Index 0)
            if (results[0].status === 'fulfilled' && results[0].value?.skills && Array.isArray(results[0].value.skills)) {
                // --- Filter skills ---
                const allSkills = results[0].value.skills;
                const practiceableSkills = allSkills.filter(isPracticeable);
                setSkills(practiceableSkills);
                console.log("Filtered skills:", practiceableSkills);
                // ---------------------
            } else {
                 console.warn("Could not load skills:", results[0].reason || "No skills found");
                 toast.error("Could not load your skills.");
                 setSkills([]);
            }
            setIsFetchingSkills(false);

            // Process History Result (Index 1)
            if (results[1].status === 'fulfilled' && results[1].value?.history && Array.isArray(results[1].value.history)) {
                setHistory(results[1].value.history);
            } else {
                 console.warn("Could not load practice history:", results[1].reason);
                 // Don't toast for history, it's less critical than skills
                 // toast.error("Could not load practice history.");
                 setHistory([]);
            }
            setIsFetchingHistory(false);
        };
        fetchAllData();
        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch, setError]);

    // Handle clicking on a skill button
    const handleSkillClick = (skill) => {
        setSelectedSkill(skill);
        setIsDifficultyModalOpen(true); // <<< FIX
    };

    // Handle selecting a difficulty and navigating
    const handleDifficultySelect = (difficulty) => {
        if (!selectedSkill) return;
        setIsDifficultyModalOpen(false); // <<< FIX
        navigate('/PracticeQuestionsPage', { state: { skill: selectedSkill, difficulty: difficulty } });
    };

    // --- *** FIX: Rename function to match modal call *** ---
    const closeDifficultyModal = () => {
        setIsDifficultyModalOpen(false);
        setSelectedSkill(null);
    };

    // --- History Modal Handlers ---
    const handleHistoryItemClick = (attempt) => {
        setSelectedAttempt(attempt);
        setIsHistoryModalOpen(true);
    };
    const closeHistoryModal = () => {
        setIsHistoryModalOpen(false);
        setSelectedAttempt(null);
    };

     // Display API errors via toast
     useEffect(() => {
         if (error) {
             console.error("API Error:", error);
             toast.error(`Error: ${error}`);
             const timer = setTimeout(() => setError(null), 3000);
             return () => clearTimeout(timer);
         }
     }, [error, setError]);

    // Use a combined loading state for disabling buttons
    const isLoading = isApiLoading || isFetchingSkills || isFetchingHistory;

    return (
        <AnimatedPage>
            <div className="practice-page-container">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="practice-content-wrapper">
                    <div className="practice-header">
                        <BrainCircuit size={40} className="header-icon" />
                        <h1>Practice Hub</h1>
                        <p>Select a programming language from your profile to practice.</p>
                    </div>

                    {/* --- Loading Skills State --- */}
                    {isFetchingSkills && (
                        <div className="loading-container-practice">
                            <div className="spinner"></div>
                            <p>Loading your skills...</p>
                        </div>
                    )}

                    {/* --- Error Loading Skills (More specific check) --- */}
                    {!isFetchingSkills && error && skills.length === 0 && (
                         <div className="error-container-practice">
                            <p className="error-message">{`Failed to load skills: ${error}`}</p>
                            <button className="practice-btn secondary" onClick={() => navigate('/dashboard')}>
                                Back to Dashboard
                            </button>
                         </div>
                    )}

                    {/* --- Skills Display --- */}
                    {!isFetchingSkills && skills.length > 0 && (
                        <div className="skills-grid">
                            {skills.map((skill, index) => (
                                <button
                                    key={index}
                                    className="skill-button"
                                    onClick={() => handleSkillClick(skill)}
                                    // --- *** FIX: Check both modal states *** ---
                                    disabled={isDifficultyModalOpen || isHistoryModalOpen || isApiLoading}
                                >
                                    {skill}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* --- No Skills Message --- */}
                    {!isFetchingSkills && !error && skills.length === 0 && (
                         <div className="no-skills-message-practice">
                            <p>No practiceable skills (like Python, Java, JavaScript) found in your profile.</p>
                            <p>Please update your profile or upload a resume.</p>
                            <button className="practice-btn secondary" onClick={() => navigate('/UpdateDetails')}>
                                 Update Profile
                            </button>
                         </div>
                    )}

                    {/* --- Practice History Section --- */}
                    <div className="history-list-container">
                        <h2 className="history-title"><Clock size={20} /> Your Recent Attempts</h2>
                        {isFetchingHistory && (
                             <div className="loading-container-practice mini">
                                <span className="spinner-sm"></span> Loading history...
                             </div>
                        )}
                        {!isFetchingHistory && history.length === 0 && !error && (
                            <p className="no-history-message">You haven't submitted any practice problems yet.</p>
                        )}
                        {!isFetchingHistory && history.length > 0 && (
                            <div className="history-items-list">
                                {history.map((attempt) => (
                                    <button
                                        key={attempt.id}
                                        className="history-item"
                                        onClick={() => handleHistoryItemClick(attempt)}
                                        // --- *** FIX: Check both modal states *** ---
                                        disabled={isDifficultyModalOpen || isHistoryModalOpen || isApiLoading}
                                    >
                                        <span className={`status-dot ${attempt.overall_status?.toLowerCase().includes('correct') ? 'correct' : 'incorrect'}`}></span>
                                        <span className="history-item-skill">{attempt.skill} ({attempt.difficulty})</span>
                                        <span className="history-item-status">{attempt.overall_status || 'N/A'}</span>
                                        <span className="history-item-date">{attempt.attempted_at}</span>
                                    </button>
                                ))}
                            </div>
                        )}
                         {!isFetchingHistory && history.length === 0 && error && (
                             <p className="no-history-message error-text">Could not load history.</p>
                         )}
                    </div>

                    {/* Back to Dashboard Button */}
                     <div className="practice-actions">
                         <button
                             className="practice-btn secondary"
                             onClick={() => navigate('/dashboard')}
                             // --- *** FIX: Check both modal states *** ---
                             disabled={isApiLoading || isDifficultyModalOpen || isHistoryModalOpen}
                         >
                             Back to Dashboard
                         </button>
                     </div>
                </div>

                {/* --- Difficulty Selection Modal --- */}
                {/* --- *** FIX: Check correct state variable *** --- */}
                {isDifficultyModalOpen && selectedSkill && (
                    <div className="modal-overlay-practice" onClick={closeDifficultyModal}>
                        <div className="modal-content-practice" onClick={(e) => e.stopPropagation()} >
                            <h2>Select Difficulty for:</h2>
                            <p className="selected-skill-name">{selectedSkill}</p>
                            <div className="difficulty-buttons">
                                <button className="difficulty-btn easy" onClick={() => handleDifficultySelect('Easy')}> Easy </button>
                                <button className="difficulty-btn medium" onClick={() => handleDifficultySelect('Medium')}> Medium </button>
                                <button className="difficulty-btn hard" onClick={() => handleDifficultySelect('Hard')}> Hard </button>
                            </div>
                            {/* --- *** FIX: Call correct close function *** --- */}
                            <button className="modal-close-btn" onClick={closeDifficultyModal}>
                                 Cancel
                            </button>
                        </div>
                    </div>
                )}

                {/* --- History Detail Modal --- */}
                {isHistoryModalOpen && (
                     <HistoryDetailModal
                         attempt={selectedAttempt}
                         onClose={closeHistoryModal}
                     />
                )}
            </div>
        </AnimatedPage>
    );
}