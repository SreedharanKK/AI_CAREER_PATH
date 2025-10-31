import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/QuizPage.css'; // Assuming you have QuizPage.css styles
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground'; // Ensure correct capitalization if needed
import toast from 'react-hot-toast'; // Import toast

export default function QuizPage() {
    const location = useLocation();
    const navigate = useNavigate();

    console.log("QuizPage location.state:", location.state);
    const { step, roadmapId, stageIndex, stepIndex } = location.state || {};

    const [quizTitle, setQuizTitle] = useState('');
    const [quizQuestions, setQuizQuestions] = useState(null); // null = loading
    const [userAnswers, setUserAnswers] = useState({});
    const [submissionResult, setSubmissionResult] = useState(null);
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);

    useEffect(() => {
        let isMounted = true;
        setError(null);
        setSubmissionResult(null);
        setQuizQuestions(null); // Set to null to indicate loading

        if (!step || roadmapId === undefined || stageIndex === undefined || stepIndex === undefined) {
            console.error("Quiz details missing in location state:", { step, roadmapId, stageIndex, stepIndex });
            setError("Quiz details are missing. Please return to the roadmap and try again.");
            setQuizQuestions([]); // Set to empty array to stop loading
            return;
        }

        console.log("Fetching quiz for:", { title: step.title, roadmapId, stageIndex, stepIndex });

        const fetchQuiz = async () => {
            const data = await apiFetch("/api/user/generate-quiz", {
                method: "POST",
                body: JSON.stringify({
                    course_title: step.title,
                    course_description: step.description
                })
            });

            if (!isMounted) return; // Component unmounted

            console.log("API response for /generate-quiz:", data);

            // The 'error' state will be set by the useApi hook if the API call fails (e.g., 429, 500)
            if (data && data.questions && data.questions.length > 0) {
                setQuizTitle(data.quiz_title || `Quiz for ${step.title}`);
                setQuizQuestions(data.questions);
            } else if (!error) { // Only set this if useApi hook hasn't already set an error
                console.error("API returned null or invalid quiz data, but no explicit error.", data);
                setError("Failed to load quiz questions. The format might be incorrect or the quiz is empty.");
                setQuizQuestions([]); // Set to empty array to stop loading
            } else {
                 // Error state is already set by useApi hook
                 console.log("useApi hook set an error:", error);
                 setQuizQuestions([]); // Set to empty array on error
            }
        };

        fetchQuiz();
        
        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, roadmapId, stageIndex, stepIndex, apiFetch, setError]); // Dependencies


    const handleAnswerChange = (questionText, answer) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionText]: answer
        }));
    };

    const handleSubmitQuiz = async () => {
       if (!quizQuestions || quizQuestions.length === 0) {
           setError("Cannot submit: Quiz questions are not loaded.");
           return;
       }

        const answersArray = Object.keys(userAnswers).map(qText => ({
            question_text: qText,
            answer: userAnswers[qText]
        }));

        const payload = {
            user_answers: answersArray,
            quiz_data: {
                quiz_title: quizTitle,
                questions: quizQuestions,
            },
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
            setQuizQuestions(null); // Clear questions to show results
        }
        // Error handling on submit is managed by useApi hook -> toast
    };

   // Determine if all questions have been answered
   const allQuestionsAnswered = quizQuestions && Array.isArray(quizQuestions) && quizQuestions.length > 0 &&
       quizQuestions.every(q =>
           q && q.question_text && // Add safety check for q
           userAnswers.hasOwnProperty(q.question_text) &&
           userAnswers[q.question_text]?.trim() !== ''
       );


    return (
        <AnimatedPage>
            <>
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>

            <div className="quiz-container">
                
                {/* === Loading Display === */}
                {/* Show loading ONLY if isApiLoading, AND no error, AND no submission result, AND questions are not loaded */}
                {isApiLoading && !error && !submissionResult && quizQuestions === null && (
                     <div className="feedback-card">
                         <div className="spinner"></div>
                         <p>{submissionResult ? 'Submitting your answers...' : 'Loading your quiz...'}</p>
                     </div>
                )}

                {/* === Error Display === */}
                {/* Show error if it exists AND we are not showing results */}
                {error && !submissionResult && (
                    <div className="feedback-card">
                        <p className="error-message">{error}</p>
                        {/* Add specific message for rate limit */}
                        {error.includes("busy") && <p>Please wait a moment and try again.</p>}
                        <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                    </div>
                )}

                {/* === Quiz Display === */}
                {/* Show quiz form ONLY if NOT loading, NO error, NO submission result, AND questions ARE loaded */}
                {!isApiLoading && !error && !submissionResult && Array.isArray(quizQuestions) && quizQuestions.length > 0 && (
                    <>
                        <div className="quiz-header">
                            <h1 className="quiz-title">{quizTitle || `Quiz for ${step?.title || 'Current Step'}`}</h1>
                            {step?.title && <p className="quiz-description">Test your knowledge on "{step.title}"</p>}
                        </div>

                        <div className="quiz-questions-list">
                            {quizQuestions.map((q, qIndex) => (
                                <div key={qIndex} className="quiz-question-card">
                                    <p className="question-text">{qIndex + 1}. {q?.question_text}</p>
                                    {q?.type === 'multiple-choice' && Array.isArray(q.options) && (
                                        <div className="options-grid">
                                            {q.options.map((option, oIndex) => (
                                                <label key={oIndex} className={`option-label ${userAnswers[q.question_text] === option ? 'selected' : ''}`}>
                                                    <input
                                                        type="radio"
                                                        name={`question-${qIndex}`}
                                                        value={option}
                                                        checked={userAnswers[q.question_text] === option}
                                                        onChange={() => handleAnswerChange(q.question_text, option)}
                                                    />
                                                    <span>{option}</span>
                                                </label>
                                            ))}
                                        </div>
                                    )}
                                    {q?.type === 'short-answer' && (
                                        <textarea
                                            className="short-answer-input"
                                            placeholder="Type your answer here..."
                                            value={userAnswers[q.question_text] || ''}
                                            onChange={(e) => handleAnswerChange(q.question_text, e.target.value)}
                                        />
                                    )}
                                    {q?.type === 'coding' && (
                                        <textarea
                                            className="coding-answer-input"
                                            placeholder="Write your code here..."
                                            value={userAnswers[q.question_text] || ''}
                                            onChange={(e) => handleAnswerChange(q.question_text, e.target.value)}
                                        />
                                    )}
                                </div>
                            ))}
                        </div>

                        <button
                            className="quiz-submit-btn"
                            onClick={handleSubmitQuiz}
                            disabled={isApiLoading || !allQuestionsAnswered}
                            title={!allQuestionsAnswered ? "Please answer all questions before submitting" : "Submit your answers"}
                        >
                            {isApiLoading ? 'Submitting...' : 'Submit Quiz'}
                        </button>
                    </>
                )}

                {/* === Handle Empty Quiz Case === */}
                {!isApiLoading && !error && !submissionResult && Array.isArray(quizQuestions) && quizQuestions.length === 0 && (
                     <div className="feedback-card">
                         <p>No quiz questions were generated for this topic.</p>
                         <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                     </div>
                )}

                {/* === Submission Results Display === */}
                {submissionResult && (
                    <div className="quiz-results-card">
                        <h2 className={`results-title ${submissionResult.passed ? 'passed' : 'failed'}`}>
                            {submissionResult.passed ? '🎉 Quiz Passed!' : '😔 Quiz Failed'}
                        </h2>
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