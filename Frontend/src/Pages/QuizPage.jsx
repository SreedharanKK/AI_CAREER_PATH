import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import '../Styles/QuizPage.css'; // The CSS is now imported from this file

export default function QuizPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { step, roadmapId, stageIndex, stepIndex } = location.state || {};

    const [quizTitle, setQuizTitle] = useState('');
    const [quizQuestions, setQuizQuestions] = useState(null);
    const [userAnswers, setUserAnswers] = useState({});
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [submissionResult, setSubmissionResult] = useState(null);

    useEffect(() => {
        if (!step || roadmapId === undefined || stageIndex === undefined || stepIndex === undefined) {
            setError("Quiz details are missing. Please return to the roadmap.");
            setIsLoading(false);
            return;
        }

        const fetchQuiz = async () => {
            setIsLoading(true);
            setError(null);
            try {
                const res = await fetch("http://localhost:5000/api/user/generate-quiz", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    credentials: 'include',
                    body: JSON.stringify({
                        course_title: step.title,
                        course_description: step.description
                    })
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
                }

                const data = await res.json();
                setQuizTitle(data.quiz_title);
                setQuizQuestions(data.questions);

            } catch (err) {
                console.error("Error generating quiz:", err);
                setError(err.message || "Failed to generate the quiz. Please try again.");
            } finally {
                setIsLoading(false);
            }
        };

        fetchQuiz();
    }, [step, roadmapId, stageIndex, stepIndex]);

    const handleAnswerChange = (questionText, answer) => {
        setUserAnswers(prev => ({
            ...prev,
            [questionText]: answer
        }));
    };

    const handleSubmitQuiz = async () => {
        setIsLoading(true);
        setError(null);
        try {
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

            const res = await fetch("http://localhost:5000/api/user/submit-quiz", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `HTTP error! status: ${res.status}`);
            }

            const data = await res.json();
            setSubmissionResult(data);

        } catch (err) {
            console.error("Error submitting quiz:", err);
            setError(err.message || "Failed to submit quiz. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="quiz-container">
            {error && (
                <div className="error-page">
                    <p className="error-message">{error}</p>
                    <button className="quiz-btn" style={{marginTop: '1rem'}} onClick={() => navigate('/Roadmap')}>Return to Roadmap</button>
                </div>
            )}

            {isLoading && !quizQuestions && (
                 <div className="loading-page">
                    <div className="spinner"></div>
                    <p>Generating your quiz...</p>
                </div>
            )}
            
            {!isLoading && !error && !submissionResult && quizQuestions && (
                 <>
                    <h1 className="quiz-title">{quizTitle}</h1>
                    <p className="quiz-description">Test your knowledge on "{step.title}"</p>

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
                                                {option}
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
    );
}

