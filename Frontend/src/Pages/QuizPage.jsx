import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/QuizPage.css'; // Assuming you have QuizPage.css styles
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground'; // Ensure correct capitalization if needed

export default function QuizPage() {
    const location = useLocation();
    const navigate = useNavigate();

    // 1. Log the state received from navigation right away
    console.log("QuizPage location.state:", location.state);

    // Safely destructure with defaults, although || {} handles it mostly
    const { step, roadmapId, stageIndex, stepIndex } = location.state || {};

    const [quizTitle, setQuizTitle] = useState('');
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [submissionResult, setSubmissionResult] = useState(null);
    // Renamed isLoading to isApiLoading to avoid potential naming conflicts if you add more loading states later
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);

    useEffect(() => {
        // Clear previous errors/results when component mounts or dependencies change
        setError(null);
        setSubmissionResult(null);
        setQuizQuestions(null); // Reset quiz questions

        // 2. Check if necessary state exists *before* fetching
        if (!step || roadmapId === undefined || stageIndex === undefined || stepIndex === undefined) {
            console.error("Quiz details missing in location state:", { step, roadmapId, stageIndex, stepIndex });
            setError("Quiz details are missing. Please return to the roadmap and try again.");
            return; // Stop execution if critical data is missing
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

            console.log("API response for /generate-quiz:", data); // 3. Log the API response

            // 4. Handle cases where API might succeed but not return expected data
            if (data && data.questions && data.questions.length > 0) {
                setQuizTitle(data.quiz_title || `Quiz for ${step.title}`); // Fallback title
                setQuizQuestions(data.questions);
            } else if (!error) { // Only set this error if apiFetch didn't already set one
                 console.error("API returned null or invalid quiz data, but no explicit error.", data);
                 setError("Failed to load quiz questions. The format might be incorrect or the quiz is empty.");
                 setQuizQuestions([]); // Set to empty array to stop loading state but show error
            }
            // If apiFetch resulted in an error, the 'error' state is already set by the hook
        };

        fetchQuiz();
        // Added apiFetch and setError to dependency array as they are used
    }, [step, roadmapId, stageIndex, stepIndex, apiFetch, setError]); // Dependencies

    const handleAnswerChange = (questionText, answer) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionText]: answer
        }));
    };

    const handleSubmitQuiz = async () => {
        // Ensure quizQuestions exists before proceeding
         if (!quizQuestions) {
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
            setQuizQuestions(null); // Clear questions after submission to show results
        }
        // Error handling is managed by useApi hook
    };

     // Determine if all questions have been answered for multiple-choice/short-answer
     const allQuestionsAnswered = quizQuestions && quizQuestions.length > 0 &&
         quizQuestions.every(q => userAnswers.hasOwnProperty(q.question_text) && userAnswers[q.question_text]?.trim() !== '');


    return (
        <AnimatedPage>
            <> {/* Fragment needed as AnimatedPage expects a single child */}
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>

            <div className="quiz-container">
                {/* === Error Display === */}
                {/* Always show error if it exists, regardless of loading state */}
                {error && (
                    <div className="feedback-card">
                        <p className="error-message">{error}</p>
                        {/* Provide button to go back */}
                        <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                    </div>
                )}

                {/* === Loading Display === */}
                {/* Show loading ONLY if loading AND no error AND no submission result yet */}
                {isApiLoading && !error && !submissionResult && (
                     <div className="feedback-card">
                         <div className="spinner"></div>
                         {/* More specific text based on action */}
                         <p>{quizQuestions ? 'Submitting your answers...' : 'Generating your AI-powered quiz...'}</p>
                     </div>
                 )}


                {/* === Quiz Display === */}
                {/* Show quiz form ONLY if NOT loading, NO error, NO submission result, AND questions ARE loaded */}
                {!isApiLoading && !error && !submissionResult && quizQuestions && quizQuestions.length > 0 && (
                     <>
                         <div className="quiz-header">
                             {/* Use quizTitle state or generate one */}
                             <h1 className="quiz-title">{quizTitle || `Quiz for ${step?.title || 'Current Step'}`}</h1>
                             {step?.title && <p className="quiz-description">Test your knowledge on "{step.title}"</p>}
                         </div>

                         <div className="quiz-questions-list">
                             {quizQuestions.map((q, qIndex) => (
                                 <div key={qIndex} className="quiz-question-card">
                                     <p className="question-text">{qIndex + 1}. {q.question_text}</p>
                                     {q.type === 'multiple-choice' && q.options && ( // Check if options exist
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
                                     {q.type === 'short-answer' && (
                                         <textarea
                                             className="short-answer-input"
                                             placeholder="Type your answer here..."
                                             value={userAnswers[q.question_text] || ''}
                                             onChange={(e) => handleAnswerChange(q.question_text, e.target.value)}
                                         />
                                     )}
                                     {q.type === 'coding' && (
                                         <textarea
                                             className="coding-answer-input"
                                             placeholder="Write your code here..."
                                             value={userAnswers[q.question_text] || ''}
                                             onChange={(e) => handleAnswerChange(q.question_text, e.target.value)}
                                         />
                                     )}
                                     {/* Handle potential unknown question types gracefully */}
                                     {!['multiple-choice', 'short-answer', 'coding'].includes(q.type) && (
                                         <p style={{ color: 'orange' }}>Unsupported question type: {q.type}</p>
                                     )}
                                 </div>
                             ))}
                         </div>

                         <button
                             className="quiz-submit-btn"
                             onClick={handleSubmitQuiz}
                             // Disable if loading, or if not all questions answered
                             disabled={isApiLoading || !allQuestionsAnswered}
                             title={!allQuestionsAnswered ? "Please answer all questions before submitting" : "Submit your answers"}
                         >
                             {isApiLoading ? 'Submitting...' : 'Submit Quiz'}
                         </button>
                     </>
                 )}

                 {/* === Handle Empty Quiz Case === */}
                 {/* Show this if NOT loading, NO error, NO results, BUT quizQuestions is an empty array */}
                  {!isApiLoading && !error && !submissionResult && quizQuestions && quizQuestions.length === 0 && (
                       <div className="feedback-card">
                           <p>No quiz questions were generated for this topic.</p>
                           <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                       </div>
                  )}

                {/* === Submission Results Display === */}
                {/* Show results ONLY if NOT loading, NO error, AND submissionResult IS set */}
                {!isApiLoading && !error && submissionResult && (
                    <div className="quiz-results-card">
                        <h2 className={`results-title ${submissionResult.passed ? 'passed' : 'failed'}`}>
                            {submissionResult.passed ? '🎉 Quiz Passed!' : '😔 Quiz Failed'}
                        </h2>
                        {/* Ensure score exists before trying to format */}
                        <p className="results-score">Your Score: {submissionResult.score !== undefined ? submissionResult.score.toFixed(0) : 'N/A'}%</p>

                        {/* Ensure detailed_results exists */}
                        {submissionResult.detailed_results && (
                             <div className="detailed-feedback">
                                 {submissionResult.detailed_results.map((res, index) => (
                                     <div key={index} className={`feedback-item ${res.is_correct ? 'correct' : 'incorrect'}`}>
                                         <p className="feedback-question">{index + 1}. {res.question}</p>
                                         <p className="feedback-user-answer">Your Answer: {res.user_answer || "No answer provided"}</p>
                                         {!res.is_correct && <p className="feedback-correct-answer">Correct Answer: {res.correct_answer}</p>}
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
