import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/QuizPage.css'; // Assuming you have QuizPage.css styles
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground'; // Ensure correct capitalization if needed
import toast from 'react-hot-toast'; // Import toast

// --- NEW IMPORTS ---
import Confetti from 'react-confetti';
import { useWindowSize } from 'react-use'; // Gets screen dimensions
// ---------------------

// --- *** UPDATED: Helper function for custom confetti shapes *** ---
// This function is called for each confetti piece
const drawCustomShape = (context) => {
    const baseSize = 8; // Base size for most shapes
    const shapeType = Math.floor(Math.random() * 6); // 0-5 for different shapes

    context.beginPath(); // Always start a new path

    switch (shapeType) {
        case 0: // Rectangle/Strip
            const rectWidth = baseSize + Math.random() * baseSize * 2;
            const rectHeight = baseSize / 2 + Math.random() * baseSize;
            context.rect(-rectWidth / 2, -rectHeight / 2, rectWidth, rectHeight);
            context.fill();
            break;

        case 1: // Circle/Dot
            const circleRadius = baseSize / 2 + Math.random() * baseSize / 2;
            context.arc(0, 0, circleRadius, 0, 2 * Math.PI);
            context.fill();
            break;

        case 2: // Star
            const starOuterRadius = baseSize * (1 + Math.random() * 0.5);
            const starInnerRadius = starOuterRadius / 2.5;
            const spikes = 5;
            let rotation = (Math.PI / 2) * 3;
            const step = Math.PI / spikes;

            context.moveTo(0, -starOuterRadius);
            for (let i = 0; i < spikes; i++) {
                context.lineTo(Math.cos(rotation) * starOuterRadius, Math.sin(rotation) * starOuterRadius);
                rotation += step;
                context.lineTo(Math.cos(rotation) * starInnerRadius, Math.sin(rotation) * starInnerRadius);
                rotation += step;
            }
            context.closePath();
            context.fill();
            break;

        case 3: // Triangle
            const triSize = baseSize * (1 + Math.random() * 0.5);
            context.moveTo(0, -triSize / 2);
            context.lineTo(triSize / 2, triSize / 2);
            context.lineTo(-triSize / 2, triSize / 2);
            context.closePath();
            context.fill();
            break;

        case 4: // Curled Ribbon/Strip (simplistic representation)
            const ribbonLength = baseSize * 2 + Math.random() * baseSize * 3;
            const ribbonWidth = baseSize / 3;
            const curveFactor = Math.random() * 0.5 + 0.5;

            context.moveTo(-ribbonLength / 2, -ribbonWidth / 2);
            context.bezierCurveTo(
                -ribbonLength / 4, -ribbonWidth * curveFactor,
                ribbonLength / 4, ribbonWidth * curveFactor,
                ribbonLength / 2, ribbonWidth / 2
            );
            context.lineTo(ribbonLength / 2, ribbonWidth / 2 + ribbonWidth); // Thicken the strip
            context.bezierCurveTo(
                ribbonLength / 4, ribbonWidth * curveFactor + ribbonWidth,
                -ribbonLength / 4, -ribbonWidth * curveFactor + ribbonWidth,
                -ribbonLength / 2, -ribbonWidth / 2 + ribbonWidth
            );
            context.closePath();
            context.fill();
            break;

        case 5: // Swirl/Spiral (simplistic)
            const spiralRadius = baseSize * (0.8 + Math.random() * 0.7);
            const turns = 1.5 + Math.random();
            const startAngle = 0;
            const endAngle = Math.PI * 2 * turns;
            const centerX = 0;
            const centerY = 0;

            // --- *** FIX 1: Define its own line width *** ---
            const swirlLineWidth = baseSize / 4;
            context.lineWidth = swirlLineWidth;
            
            // --- *** FIX 2: Copy the fill style to the stroke style *** ---
            context.strokeStyle = context.fillStyle;

            context.moveTo(centerX, centerY);
            for (let i = 0; i <= 100; i++) {
                const angle = startAngle + (endAngle - startAngle) * (i / 100);
                const r = spiralRadius * (i / 100);
                const x = centerX + Math.cos(angle) * r;
                const y = centerY + Math.sin(angle) * r;
                context.lineTo(x, y);
            }
            
            context.stroke(); // Use stroke for lines
            context.closePath(); // Close the path
            break;

        default:
            // Fallback to a basic rectangle if somehow shapeType is out of range
            context.rect(-baseSize / 2, -baseSize / 2, baseSize, baseSize);
            context.fill();
            break;
    }
};
// ------------------------------------------------------------------


export default function QuizPage() {
    const location = useLocation();
    const navigate = useNavigate();

    console.log("QuizPage location.state:", location.state);
    const { step, roadmapId, stageIndex, stepIndex } = location.state || {};

    const [quizTitle, setQuizTitle] = useState('');
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [submissionResult, setSubmissionResult] = useState(null);
    
    // --- NEW STATE for Confetti ---
    const [showConfetti, setShowConfetti] = useState(false);
    // ------------------------------
    
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);
    
    // --- NEW: Get window size for confetti ---
    const { width, height } = useWindowSize();
    // -----------------------------------------

    useEffect(() => {
        let isMounted = true;
        setError(null);
        setSubmissionResult(null);
        setQuizQuestions(null);
        setShowConfetti(false); // Reset confetti on new quiz load

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

            if (!isMounted) return;

            console.log("API response for /generate-quiz:", data);

            if (data && data.questions && data.questions.length > 0) {
                setQuizTitle(data.quiz_title || `Quiz for ${step.title}`);
                setQuizQuestions(data.questions);
            } else if (!error) {
                console.error("API returned null or invalid quiz data, but no explicit error.", data);
                setError("Failed to load quiz questions. The format might be incorrect or the quiz is empty.");
                setQuizQuestions([]);
            } else {
                 console.log("useApi hook set an error:", error);
                 setQuizQuestions([]);
            }
        };

        fetchQuiz();
        
        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [step, roadmapId, stageIndex, stepIndex]); // Removed apiFetch and setError to stabilize


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
            setQuizQuestions(null); // Clear questions after submission to show results
            
            // --- *** NEW: Trigger effects on result *** ---
            if (data.passed && data.is_roadmap_complete) {
               // Show confetti and a special "Congrats" toast!
               setShowConfetti(true);
               toast.success("Congratulations! You've completed the entire roadmap!", {
                   duration: 5000,
                   icon: '🎉',
               });
           } else if (data.passed) {
               // This is the original confetti logic for a normal pass
               setShowConfetti(true);
           }
            // ---------------------------------------------
        }
    };

   // Determine if all questions have been answered
   const allQuestionsAnswered = quizQuestions && Array.isArray(quizQuestions) && quizQuestions.length > 0 &&
       quizQuestions.every(q =>
           q && q.question_text &&
           userAnswers.hasOwnProperty(q.question_text) &&
           userAnswers[q.question_text]?.trim() !== ''
       );


    return (
        <AnimatedPage>
            <>
                {/* --- *** UPDATED: Confetti Component *** --- */}
                {/* It sits at the top level, overlays everything */}
                {showConfetti && (
                    <Confetti
                        width={width}
                        height={height}
                        recycle={false} // Run once
                        numberOfPieces={1500} // Increased pieces for a fuller look
                        onConfettiComplete={() => setShowConfetti(false)} // Clean up
                        drawShape={drawCustomShape} // <-- Use our custom shapes
                        confettiSource={{
                            x: 0,
                            y: 0, // FIXED: Start from the very top (y: 0)
                            w: width,
                            h: 0 // Emitter is a line
                        }}
                        initialVelocityY={20} // Increased initial velocity
                        gravity={0.3} // Adjusted gravity
                    />
                )}
                {/* -------------------------------------- */}
            
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>

                <div className="quiz-container">
                    
                    {/* === Error Display === */}
                    {error && !submissionResult && (
                        <div className="feedback-card">
                            <p className="error-message">{error}</p>
                            {error.includes("busy") && <p>Please wait a moment and try again.</p>}
                            <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                        </div>
                    )}

                    {/* === Loading Display === */}
                    {isApiLoading && !error && !submissionResult && quizQuestions === null && (
                         <div className="feedback-card">
                             <div className="spinner"></div>
                             <p>{quizQuestions ? 'Submitting your answers...' : 'Loading your quiz...'}</p>
                         </div>
                    )}

                    {/* === Quiz Display === */}
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
                    {submissionResult && ( // No need to check !error here, results override errors
                        <div className="quiz-results-card">
                            <h2 className={`results-title ${submissionResult.passed ? 'passed' : 'failed'}`}>
                                {submissionResult.passed ? '🎉 Quiz Passed!' : '😔 Quiz Failed'}
                            </h2>

                            {/* --- *** NEW: Consolation Animation *** --- */}
                            {!submissionResult.passed && (
                                <div className="consolation-animation">
                                    <span>Don't give up! Review your answers and try again.</span>
                                </div>
                            )}
                            {/* -------------------------------------- */}

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