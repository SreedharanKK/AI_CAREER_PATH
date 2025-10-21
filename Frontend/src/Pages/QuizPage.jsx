import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/QuizPage.css';
import { useApi } from '../hooks/useApi';

export default function QuizPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { step, roadmapId, stageIndex, stepIndex } = location.state || {};
    const [quizTitle, setQuizTitle] = useState('');
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [submissionResult, setSubmissionResult] = useState(null); 
    const { apiFetch, isLoading, error, setError } = useApi();
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);

    useEffect(() => {
        if (!step || roadmapId === undefined || stageIndex === undefined || stepIndex === undefined) {
            setError("Quiz details are missing. Please return to the roadmap.");
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

            if (data) {
                setQuizTitle(data.quiz_title);
                setQuizQuestions(data.questions);
            }
        };

        fetchQuiz();
    }, [step, roadmapId, stageIndex, stepIndex, setError]);

    const handleAnswerChange = (questionText, answer) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionText]: answer
        }));
    };

    const handleSubmitQuiz = async () => {
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
        }
    };

    return (
        <AnimatedPage>
            <>
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>

            <div className="quiz-container">
                {error && (
                    <div className="feedback-card">
                        <p className="error-message">{error}</p>
                        <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                    </div>
                )}

                {isLoading && !quizQuestions && !error && (
                     <div className="feedback-card">
                         <div className="spinner"></div>
                         <p>Generating your AI-powered quiz...</p>
                     </div>
                )}
                
                {!isLoading && !error && !submissionResult && quizQuestions && (
                     <>
                         <div className="quiz-header">
                            <h1 className="quiz-title">{quizTitle}</h1>
                            <p className="quiz-description">Test your knowledge on "{step.title}"</p>
                         </div>

                         <div className="quiz-questions-list">
                             {quizQuestions.map((q, qIndex) => (
                                 <div key={qIndex} className="quiz-question-card">
                                     <p className="question-text">{qIndex + 1}. {q.question_text}</p>
                                     {q.type === 'multiple-choice' && (
                                         <div className="options-grid">
                                             {q.options.map((option, oIndex) => (
                                                 <label key={oIndex} className="option-label">
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
                                 </div>
                             ))}
                         </div>

                         <button 
                             className="quiz-submit-btn" 
                             onClick={handleSubmitQuiz} 
                             disabled={isLoading || Object.keys(userAnswers).length !== quizQuestions.length}
                         >
                             {isLoading ? 'Submitting...' : 'Submit Quiz'}
                         </button>
                     </>
                )}

                {submissionResult && (
                    <div className="quiz-results-card">
                        <h2 className={`results-title ${submissionResult.passed ? 'passed' : 'failed'}`}>
                            {submissionResult.passed ? '🎉 Quiz Passed!' : '😔 Quiz Failed'}
                        </h2>
                        <p className="results-score">Your Score: {submissionResult.score.toFixed(0)}%</p>
                        
                        <div className="detailed-feedback">
                            {submissionResult.detailed_results.map((res, index) => (
                                <div key={index} className={`feedback-item ${res.is_correct ? 'correct' : 'incorrect'}`}>
                                    <p className="feedback-question">{index + 1}. {res.question}</p>
                                    <p className="feedback-user-answer">Your Answer: {res.user_answer || "No answer"}</p>
                                    {!res.is_correct && <p className="feedback-correct-answer">Correct: {res.correct_answer}</p>}
                                </div>
                            ))}
                        </div>
                        <button className="quiz-btn" onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                    </div>
                )}
            </div>
        </>
        </AnimatedPage>
    );
}
