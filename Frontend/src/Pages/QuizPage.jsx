import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/QuizPage.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import toast from 'react-hot-toast';
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use';
import { AlertTriangle, Maximize } from 'lucide-react'; // Import icons

// --- Helper function for confetti (Unchanged) ---
const drawCustomShape = (context) => {
    const baseSize = 8;
    const shapeType = Math.floor(Math.random() * 6);
    context.beginPath();
    switch (shapeType) {
        case 0:
            const rectWidth = baseSize + Math.random() * baseSize * 2;
            const rectHeight = baseSize / 2 + Math.random() * baseSize;
            context.rect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
            context.fill(); break;
        case 1:
            const circleRadius = baseSize / 2 + Math.random() * baseSize / 2;
            context.arc(0, 0, circleRadius, 0, 2 * Math.PI);
            context.fill(); break;
        default:
            context.rect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
            context.fill(); break;
    }
};

export default function QuizPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { step, roadmapId, stageIndex, stepIndex } = location.state || {};

    const [quizTitle, setQuizTitle] = useState('');
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [submissionResult, setSubmissionResult] = useState(null);
    const [showConfetti, setShowConfetti] = useState(false);
    
    // --- NEW: Anti-Cheat State ---
    const [isQuizStarted, setIsQuizStarted] = useState(false); // Controls visibility of questions
    const [violationCount, setViolationCount] = useState(0);
    const [isTerminated, setIsTerminated] = useState(false);
    
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);
    const { width, height } = useWindowSize();

    // --- 1. Fetch Quiz Data ---
    useEffect(() => {
        let isMounted = true;
        setError(null);
        setSubmissionResult(null);
        setQuizQuestions(null);
        setShowConfetti(false);

        if (!step || roadmapId === undefined || stageIndex === undefined || stepIndex === undefined) {
            setError("Quiz details are missing. Please return to the roadmap.");
            setQuizQuestions([]);
            return;
        }

        const fetchQuiz = async () => {
            const data = await apiFetch("/api/user/generate-quiz", {
                method: "POST",
                body: JSON.stringify({
                    course_title: step.title,
                    course_description: step.description
                })
            });

            if (!isMounted) return;

            if (data && data.questions && data.questions.length > 0) {
                setQuizTitle(data.quiz_title || `Quiz for ${step.title}`);
                setQuizQuestions(data.questions);
            } else if (!error) {
                setError("Failed to load quiz questions.");
                setQuizQuestions([]);
            }
        };

        fetchQuiz();
        return () => { isMounted = false; };
    }, [step, roadmapId, stageIndex, stepIndex, apiFetch, setError]);

    // --- 2. Handle Answers ---
    const handleAnswerChange = (questionText, answer) => {
        setUserAnswers(prev => ({ ...prev, [questionText]: answer }));
    };

    // --- 3. Submit Quiz (Wrapped in useCallback to use in Event Listeners) ---
    const handleSubmitQuiz = useCallback(async (forced = false) => {
       if (!quizQuestions || quizQuestions.length === 0) return;

       // If forced (violation), we might submit incomplete answers, which is fine (counts as 0 score)
       const answersArray = Object.keys(userAnswers).map(qText => ({
           question_text: qText,
           answer: userAnswers[qText]
       }));

       // Add remaining unanswered questions as empty to ensure backend processes score correctly
       quizQuestions.forEach(q => {
           if (!userAnswers[q.question_text]) {
               answersArray.push({ question_text: q.question_text, answer: "" });
           }
       });

       const payload = {
           user_answers: answersArray,
           quiz_data: { quiz_title: quizTitle, questions: quizQuestions },
           roadmap_id: roadmapId,
           stage_index: stageIndex,
           step_index: stepIndex
       };

       const data = await apiFetch("/api/user/submit-quiz", {
           method: "POST",
           body: JSON.stringify(payload)
       });

       if (data) {
           setSubmissionResult(data);
           setQuizQuestions(null);
           setIsQuizStarted(false); // Stop monitoring
           document.exitFullscreen().catch(e => console.log(e)); // Exit full screen

           if (forced) {
               setIsTerminated(true); // Show termination message
           } else if (data.passed) {
               if (data.is_roadmap_complete) {
                   setShowConfetti(true);
                   toast.success("Roadmap Completed! 🎉", { duration: 5000 });
               } else {
                   setShowConfetti(true);
               }
           }
       }
    }, [quizQuestions, userAnswers, quizTitle, roadmapId, stageIndex, stepIndex, apiFetch]);

    // --- 4. NEW: Start Quiz & Enter Full Screen ---
    const handleStartQuiz = () => {
        const elem = document.documentElement;
        if (elem.requestFullscreen) {
            elem.requestFullscreen().then(() => {
                setIsQuizStarted(true);
                toast("Quiz Started! Do not switch tabs or exit full screen.", { icon: '⚠️' });
            }).catch(err => {
                toast.error("Full screen is required to take the quiz.");
            });
        }
    };

    // --- 5. NEW: Monitor Violations ---
    useEffect(() => {
        if (!isQuizStarted || submissionResult) return;

        const handleVisibilityChange = () => {
            if (document.hidden) {
                recordViolation("Tab switching detected!");
            }
        };

        const handleFullScreenChange = () => {
            if (!document.fullscreenElement) {
                recordViolation("Full screen exited!");
            }
        };

        const recordViolation = (msg) => {
            setViolationCount(prev => {
                const newCount = prev + 1;
                if (newCount >= 3) {
                    toast.error("Max violations reached. Submitting quiz...");
                    handleSubmitQuiz(true); // Forced submit
                    return newCount;
                }
                toast.error(`Warning ${newCount}/3: ${msg}`);
                return newCount;
            });
        };

        document.addEventListener("visibilitychange", handleVisibilityChange);
        document.addEventListener("fullscreenchange", handleFullScreenChange);
        // Standard Webkit/Moz listeners for older browsers support
        document.addEventListener("webkitfullscreenchange", handleFullScreenChange);

        return () => {
            document.removeEventListener("visibilitychange", handleVisibilityChange);
            document.removeEventListener("fullscreenchange", handleFullScreenChange);
            document.removeEventListener("webkitfullscreenchange", handleFullScreenChange);
        };
    }, [isQuizStarted, submissionResult, handleSubmitQuiz]);


    // Determine if all questions have been answered (for manual submit button)
    const allQuestionsAnswered = quizQuestions && Array.isArray(quizQuestions) && quizQuestions.length > 0 &&
       quizQuestions.every(q => userAnswers.hasOwnProperty(q.question_text) && userAnswers[q.question_text]?.trim() !== '');


    return (
        <AnimatedPage>
            <>
                {showConfetti && (
                    <Confetti width={width} height={height} recycle={false} numberOfPieces={1500} onConfettiComplete={() => setShowConfetti(false)} drawShape={drawCustomShape} />
                )}
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>

                <div className="quiz-container">
                    
                    {/* Error Display */}
                    {error && !submissionResult && (
                        <div className="feedback-card">
                            <p className="error-message">{error}</p>
                            <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                        </div>
                    )}

                    {/* Loading Display */}
                    {isApiLoading && !error && !submissionResult && quizQuestions === null && (
                        <div className="feedback-card">
                            <div className="spinner"></div>
                            <p>Loading your quiz...</p>
                        </div>
                    )}

                    {/* --- NEW: Warning / Start Overlay --- */}
                    {!isApiLoading && !error && !submissionResult && !isQuizStarted && quizQuestions && quizQuestions.length > 0 && (
                        <div className="quiz-start-overlay">
                            <div className="warning-icon-container">
                                <AlertTriangle size={60} color="#ffca3a" />
                            </div>
                            <h2>Important!</h2>
                            <p className="warning-text">
                                This quiz requires <strong>Full Screen</strong> mode.
                            </p>
                            <ul className="rules-list">
                                <li>Do not switch tabs.</li>
                                <li>Do not exit full screen.</li>
                                <li><strong>3 Violations</strong> will result in immediate termination and cooldown.</li>
                            </ul>
                            <button className="quiz-submit-btn start-btn" onClick={handleStartQuiz}>
                                <Maximize size={20} /> Enter Full Screen & Start
                            </button>
                        </div>
                    )}

                    {/* --- Quiz Questions (Only visible if Started) --- */}
                    {isQuizStarted && !submissionResult && Array.isArray(quizQuestions) && (
                        <>
                            <div className="quiz-header">
                                <div className="violation-badge" title="Warnings">
                                    ⚠️ {violationCount}/3
                                </div>
                                <h1 className="quiz-title">{quizTitle}</h1>
                                {step?.title && <p className="quiz-description">Test on "{step.title}"</p>}
                            </div>

                            <div className="quiz-questions-list">
                                {quizQuestions.map((q, qIndex) => (
                                    <div key={qIndex} className="quiz-question-card">
                                        <p className="question-text">{qIndex + 1}. {q?.question_text}</p>
                                        {q?.type === 'multiple-choice' && Array.isArray(q.options) && (
                                            <div className="options-grid">
                                                {q.options.map((option, oIndex) => (
                                                    <label key={oIndex} className={`option-label ${userAnswers[q.question_text] === option ? 'selected' : ''}`}>
                                                        <input type="radio" name={`question-${qIndex}`} value={option} checked={userAnswers[q.question_text] === option} onChange={() => handleAnswerChange(q.question_text, option)} />
                                                        <span>{option}</span>
                                                    </label>
                                                ))}
                                            </div>
                                        )}
                                        {q?.type === 'short-answer' && (
                                            <textarea className="short-answer-input" placeholder="Type your answer here..." value={userAnswers[q.question_text] || ''} onChange={(e) => handleAnswerChange(q.question_text, e.target.value)} />
                                        )}
                                        {q?.type === 'coding' && (
                                            <textarea className="coding-answer-input" placeholder="Write your code here..." value={userAnswers[q.question_text] || ''} onChange={(e) => handleAnswerChange(q.question_text, e.target.value)} />
                                        )}
                                    </div>
                                ))}
                            </div>

                            <button className="quiz-submit-btn" onClick={() => handleSubmitQuiz(false)} disabled={isApiLoading || !allQuestionsAnswered} title={!allQuestionsAnswered ? "Please answer all questions" : "Submit"}>
                                {isApiLoading ? 'Submitting...' : 'Submit Quiz'}
                            </button>
                        </>
                    )}

                    {/* --- Submission Results / Termination Screen --- */}
                    {submissionResult && ( 
                        <div className="quiz-results-card">
                            {isTerminated && (
                                <div className="termination-alert">
                                    <h3>🚫 Quiz Terminated</h3>
                                    <p>You exceeded the maximum number of violations (tab switching or exiting full screen).</p>
                                </div>
                            )}

                            <h2 className={`results-title ${submissionResult.passed ? 'passed' : 'failed'}`}>
                                {submissionResult.passed ? '🎉 Quiz Passed!' : '😔 Quiz Failed'}
                            </h2>

                            {!submissionResult.passed && !isTerminated && (
                                <div className="consolation-animation">
                                    <span>Don't give up! Review your answers and try again.</span>
                                </div>
                            )}

                            <p className="results-score">Your Score: {submissionResult.score !== undefined ? submissionResult.score.toFixed(0) : 'N/A'}%</p>
                            
                            {Array.isArray(submissionResult.detailed_results) && (
                                <div className="detailed-feedback">
                                    {submissionResult.detailed_results.map((res, index) => (
                                        <div key={index} className={`feedback-item ${res.is_correct ? 'correct' : 'incorrect'}`}>
                                            <p className="feedback-question">{index + 1}. {res?.question}</p>
                                            <p className="feedback-user-answer">Your Answer: {res?.user_answer || "No answer provided"}</p>
                                            {!res.is_correct && <p className="feedback-correct-answer">Correct Answer: {res?.correct_answer}</p>}
                                        </div>
                                    ))}
                                </div>
                            )}
                            <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                        </div>
                    )}
                </div>
            </>
        </AnimatedPage>
    );
}