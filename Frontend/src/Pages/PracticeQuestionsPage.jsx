import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Play, Terminal, AlertCircle, Loader2, ArrowLeft, Send, Sparkles, X  } from 'lucide-react';
import toast from 'react-hot-toast';
import { Radar } from 'react-chartjs-2';
import {
  Chart as ChartJS, RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend,
} from 'chart.js';

// --- Code Editor Imports ---
import Editor from 'react-simple-code-editor';
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/components/prism-java';
import 'prismjs/components/prism-c';
import 'prismjs/components/prism-cpp';
// --- Removed SQL/Markup/CSS ---
import 'prismjs/themes/prism-tomorrow.css';

import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/PracticeQuestionsPage.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';

// Register Chart.js components
ChartJS.register(RadialLinearScale, PointElement, LineElement, Filler, Tooltip, Legend);

// --- AiAnalysisDisplay Component ---
const AiAnalysisDisplay = ({ analysis, onExplainClick }) => {
  
  // --- *** FIX 2: More robust check for scores object *** ---
  // This prevents the page from crashing if AI fails to return scores
  if (!analysis || typeof analysis.scores !== 'object' || analysis.scores === null) {
      // Show the feedback, just not the chart
      return (
          <div className="ai-analysis-section">
              <h3>AI Code Analysis: <span className={`analysis-status-badge status-issue`}>{analysis?.overall_status || 'Analysis Incomplete'}</span></h3>
              <div className="analysis-chart-container">
                  <p style={{ color: '#a0a0b0', textAlign: 'center', paddingTop: '4rem' }}>
                      AI could not generate scores, but provided summary feedback.
                  </p>
              </div>
              <div className="analysis-block summary">
                  <div className="summary-header">
                      <h4>Summary:</h4>
                      <button className="explain-btn" onClick={onExplainClick} title="Let AI explain this feedback">
                          <Sparkles size={14} /> Explain This?
                      </button>
                  </div>
                  <p>{analysis?.summary_feedback || 'AI analysis failed to generate a response.'}</p>
              </div>
          </div>
      );
  }
  
  // --- If check passes, proceed as normal ---
  let statusClass = 'status-unknown';
  const lowerStatus = analysis.overall_status?.toLowerCase() || '';
  if (lowerStatus.includes('correct')) { statusClass = 'status-correct'; }
  else if (lowerStatus.includes('incorrect') || lowerStatus.includes('error')) { statusClass = 'status-incorrect'; }
  else if (lowerStatus.includes('issue')) { statusClass = 'status-issue'; }
  
  // Ensure scores are numbers before passing to chart
  const chartData = {
      labels: ['Correctness', 'Efficiency', 'Readability', 'Robustness'],
      datasets: [{
          label: 'Score (out of 10)', 
          data: [
              Number(analysis.scores.correctness) || 0, 
              Number(analysis.scores.efficiency) || 0,
              Number(analysis.scores.readability) || 0, 
              Number(analysis.scores.robustness) || 0,
          ],
          backgroundColor: 'rgba(199, 125, 255, 0.2)', 
          borderColor: 'rgba(199, 125, 255, 1)',
          borderWidth: 2,
      }],
    };
    
  const chartOptions = {
      scales: { r: {
          angleLines: { color: 'rgba(255, 255, 255, 0.2)' }, 
          grid: { color: 'rgba(255, 255, 255, 0.2)' },
          pointLabels: { color: '#e0e0e0', font: { size: 13, family: "'Inter', sans-serif" } },
          ticks: { 
              color: '#a0a0b0', 
              backdropColor: 'rgba(11, 2, 29, 0.8)', 
              stepSize: 2, 
              font: { size: 10, family: "'Inter', sans-serif" }, 
              suggestedMin: 0, 
              suggestedMax: 10, 
          },
          min: 0, 
          max: 10,
      }},
      plugins: { 
          legend: { display: false }, 
          tooltip: {
              backgroundColor: '#0B021D', 
              borderColor: '#9D4EDD', 
              borderWidth: 1,
              titleFont: { size: 14, family: "'Inter', sans-serif" }, 
              bodyFont: { size: 12, family: "'Inter', sans-serif" },
              boxPadding: 4,
          }
      },
      maintainAspectRatio: false,
    };
    
  return (  
      <div className="ai-analysis-section">
          <h3>AI Code Analysis: <span className={`analysis-status-badge ${statusClass}`}>{analysis.overall_status || 'N/A'}</span></h3>
          <div className="analysis-chart-container"> <Radar data={chartData} options={chartOptions} /> </div>
          <div className="analysis-block summary">
              <div className="summary-header">
                  <h4>Summary:</h4>
                  <button className="explain-btn" onClick={onExplainClick} title="Let AI explain this feedback">
                      <Sparkles size={14} /> Explain This?
                  </button>
              </div>
              <p>{analysis.summary_feedback || 'N/A'}</p>
          </div>
      </div>  
  );
};

// --- NEW: Explanation Modal Component ---
const ExplainModal = ({ isOpen, onClose, explanation, isLoading }) => {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay-practice" onClick={onClose}>
            <div className="modal-content-practice explain-modal" onClick={(e) => e.stopPropagation()}>
                <button className="modal-close-btn-history" onClick={onClose} aria-label="Close modal"><X size={24} /></button>
                <h2>AI Tutor Explanation</h2>
                {isLoading ? (
                    <div className="explanation-loading">
                        <Loader2 size={28} className="spinner-icon animate-spin" />
                        <p>AI Tutor is thinking...</p>
                    </div>
                ) : (
                    <div className="explanation-content">
                        <p>{explanation || "No explanation available."}</p>
                    </div>
                )}
                <button className="practice-q-btn secondary close-explain-modal" onClick={onClose}>
                    Got it, thanks!
                </button>
            </div>
        </div>
    );
};

// --- UPDATED: Helper function to determine language ---
function getLanguageFromSkill(skillName) {
    if (!skillName) return 'python';
    const lowerSkill = skillName.toLowerCase().trim();
    
    // Check for exact matches or common aliases first
    if (lowerSkill === 'java') return 'java';
    if (lowerSkill === 'python' || lowerSkill === 'py') return 'python';
    if (lowerSkill === 'c++' || lowerSkill === 'cpp') return 'cpp';
    if (lowerSkill === 'c') return 'c';
    if (lowerSkill === 'js' || lowerSkill.includes('javascript') || lowerSkill.includes('react') || lowerSkill.includes('node')) {
        return 'javascript';
    }
    
    // Default fallback
    console.warn(`Could not map skill "${skillName}" to a language, defaulting to 'python'.`);
    return 'python';
}

// --- UPDATED: Helper to map language to prismjs ---
function getPrismLanguage(lang) {
    switch(lang) {
        case 'javascript': return languages.javascript;
        case 'python': return languages.python;
        case 'java': return languages.java;
        case 'cpp': return languages.cpp;
        case 'c': return languages.c;
        default: return languages.clike;
    }
}
// --------------------------------------------------------


// --- PracticeQuestionsPage Component ---
export default function PracticeQuestionsPage() {
    const location = useLocation();
    const navigate = useNavigate();
    const { skill, difficulty } = location.state || {};

    const [question, setQuestion] = useState(null);
    const [sourceCode, setSourceCode] = useState('');
    
    const language = getLanguageFromSkill(skill);
    const prismLanguage = getPrismLanguage(language);
    
    // --- REMOVED setupScript state ---
    
    const [output, setOutput] = useState(null);
    const [analysis, setAnalysis] = useState(null);
    const [isExecuting, setIsExecuting] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isExplainModalOpen, setIsExplainModalOpen] = useState(false);
    const [explanationText, setExplanationText] = useState("");
    const [isExplaining, setIsExplaining] = useState(false);

    const canvasRef = useRef(null);
    const { apiFetch, isLoading: isFetchingQuestion, error: fetchError, setError } = useApi();
    useParticleBackground(canvasRef);

    // Fetch the question
    useEffect(() => {
        let isMounted = true;
        setError(null);
        setQuestion(null);
        setOutput(null); 
        setAnalysis(null); 
        setSourceCode('');
        // --- REMOVED setSetupScript('') ---

        if (!skill || !difficulty) {
            console.error("Missing skill or difficulty in location state");
            setError("Skill or difficulty not selected. Please go back.");
            setQuestion({ error: true });
            return;
        }

        const fetchQuestion = async () => {
             console.log(`Fetching question for Skill: ${skill}, Difficulty: ${difficulty}`);
             const data = await apiFetch('/api/user/practice/question', { 
                 method: 'POST', 
                 body: JSON.stringify({ skill, difficulty }) 
             });

             if (!isMounted) return;

             if (data && data.title && data.description) {
                 console.log("Question received:", data);
                 setQuestion(data);
                 // --- REMOVED logic for data.setup_script ---
             } else {
                 console.error("Received null/invalid data or fetch error");
                 setQuestion({ error: true });
             }
        };

        fetchQuestion();
        return () => { isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [skill, difficulty, apiFetch, setError]);

    // Handle Judge0 "Run Code"
    const handleRunCode = async () => {
         setError(null); setOutput(null); setAnalysis(null); setIsExecuting(true);
         
         // --- *** FIX: Send sourceCode directly *** ---
         console.log(`Running code - Language: ${language}, Stdin: (empty)`);
         const data = await apiFetch('/api/user/practice/run', { 
             method: 'POST', 
             body: JSON.stringify({ 
                 language: language, 
                 source_code: sourceCode, // Send sourceCode only
                 stdin: '' 
             }) 
         });
         // -----------------------------------------
         
         setIsExecuting(false);
         if (data) { 
             setOutput(data); 
             if (data.status && data.status.toLowerCase().includes('error')) {
                 toast.error(data.status);
             }
         }
    };

    // Handle AI "Submit Code"
    const handleSubmitCode = async () => {
         if (!question || question.error) { toast.error("Question data is not loaded."); return; }
         setError(null); setOutput(null); setAnalysis(null); setIsSubmitting(true);
         console.log(`Submitting code for AI analysis - Lang: ${language}`);
         
         // --- *** FIX: Send sourceCode directly *** ---
         const data = await apiFetch('/api/user/practice/submit', { 
             method: 'POST', 
             body: JSON.stringify({ 
                 language: language, 
                 source_code: sourceCode, // Send sourceCode only
                 question: question,
                 difficulty: difficulty, 
                 skill: skill 
             }) 
         });
         // ----------------------------------------
         
         setIsSubmitting(false);
         if (data) { 
             setAnalysis(data); 
             toast.success("AI analysis complete!"); 
         }
    };

    const handleExplainClick = async () => {
        if (!analysis || !analysis.summary_feedback || !sourceCode) {
            toast.error("Could not find feedback to explain.");
            return;
        }
        
        console.log("Requesting explanation for:", analysis.summary_feedback);
        setIsExplaining(true);
        setExplanationText("");
        setIsExplainModalOpen(true);
        setError(null);

        const data = await apiFetch('/api/user/practice/explain', {
            method: 'POST',
            body: JSON.stringify({
                user_code: sourceCode,
                summary_feedback: analysis.summary_feedback
            })
        });

        setIsExplaining(false);
        if (data && data.explanation) {
            setExplanationText(data.explanation);
        } else {
            // Error is handled by useApi hook and shown as toast
            setExplanationText(fetchError || "Could not get an explanation at this time.");
        }
    };

    // Show API errors via toast
    useEffect(() => {
        if (fetchError) {
            console.error("API Error (Toast):", fetchError);
            toast.error(`Error: ${fetchError}`);
            const timer = setTimeout(() => setError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [fetchError, setError]);

    // --- Render Logic ---

    // 1. Initial Loading State
    if (isFetchingQuestion && question === null && !fetchError) {
        return ( 
            <div className="practice-questions-page">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="loading-container-practice">
                    <div className="spinner"></div>
                    <p>Generating AI practice question for {skill} ({difficulty})...</p>
                </div>
            </div> 
        );
    }

    // 2. Critical Error State (Question fetch failed)
    if (question?.error === true) {
        return ( 
            <div className="practice-questions-page">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="error-container-practice questions-error">
                    <AlertCircle size={40} className="error-icon" />
                    <h2>Error Loading Question</h2>
                    <p className="error-message">{fetchError || "Failed to load question data."}</p>
                    <button className="practice-q-btn secondary" onClick={() => navigate('/PracticePage')}>
                        <ArrowLeft size={16} /> Back to Practice Hub
                    </button>
                </div>
            </div> 
        );
    }

    // 3. Fallback
     if (!question) {
         return ( 
            <div className="practice-questions-page">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="loading-container-practice"> <p>Loading...</p> </div>
            </div> 
         );
     }

    // 4. Main Page Render
    return (
        <AnimatedPage>
            <div className="practice-questions-page">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="practice-q-header">
                     <button className="back-button" onClick={() => navigate('/PracticePage')} title="Back to Practice Hub" disabled={isExecuting || isSubmitting}>
                         <ArrowLeft size={20} />
                     </button>
                    <h1>Practice: {skill || 'Skill'} <span className={`difficulty-tag ${difficulty?.toLowerCase() || 'unknown'}`}>{difficulty || 'Level'}</span></h1>
                    {question.title && <h2>{question.title}</h2>}
                </div>

                <div className="practice-q-layout">
                    {/* Left side: Question or Analysis */}
                    <div className="question-description-panel">
                        {analysis ? (
                            <AiAnalysisDisplay analysis={analysis} 
                                onExplainClick={handleExplainClick} />
                        ) : (
                            <>
                                <h3>Problem Description</h3>
                                <div className="description-text-container">
                                     <p className="description-text">{question.description}</p>
                                </div>
                                {question.examples && question.examples.length > 0 && (
                                    <div className="examples-section">
                                        <h4>Examples:</h4>
                                        {question.examples.map((ex, index) => (
                                            <div key={index} className="example-block">
                                                <pre><strong>Input:</strong> {ex.input ?? 'N/A'}</pre>
                                                <pre><strong>Output:</strong> {ex.output ?? 'N/A'}</pre>
                                            </div>
                                        ))}
                                    </div>
                                )}
                                {question.constraints && (
                                     <div className="constraints-section">
                                         <h4>Constraints:</h4>
                                         <p>{question.constraints}</p>
                                     </div>
                                )}
                            </>
                        )}
                    </div>

                    {/* Right side: Code Editor & Output */}
                    <div className="code-execution-panel">
                        <div className="language-display">
                            Language: <strong>{language}</strong>
                        </div>

                        {/* --- *** REMOVED Setup Script Box *** --- */}

                        {/* User Code Editor */}
                        <div className="code-editor-wrapper">
                            <Editor
                                value={sourceCode}
                                onValueChange={code => setSourceCode(code)}
                                highlight={code => highlight(code, prismLanguage, language)}
                                padding={15}
                                style={{
                                    fontFamily: '"Fira Code", "Courier New", Courier, monospace',
                                    fontSize: 15,
                                    backgroundColor: '#0c031f',
                                    minHeight: '250px',
                                    border: '1px solid rgba(255, 255, 255, 0.2)',
                                    borderRadius: '8px',
                                }}
                                textareaClassName="code-editor-textarea-hidden"
                                preClassName="code-editor-pre"
                                disabled={isExecuting || isSubmitting}
                            />
                        </div>

                        <div className="code-action-buttons">
                             <button className="run-code-btn" onClick={handleRunCode} disabled={isExecuting || isSubmitting || isFetchingQuestion}>
                                 {isExecuting ? (<><Loader2 size={18} className="spinner-icon animate-spin" /> Running...</>) : (<><Play size={18} /> Run Code</>)}
                             </button>
                             <button className="submit-code-btn" onClick={handleSubmitCode} disabled={isExecuting || isSubmitting || isFetchingQuestion}>
                                  {isSubmitting ? (<><Loader2 size={18} className="spinner-icon animate-spin" /> Submitting...</>) : (<><Send size={18} /> Submit for Analysis</>)}
                             </button>
                        </div>

                        {/* Output Display */}
                        {output && !analysis && (
                            <div className={`output-section status-${output.status?.toLowerCase().replace(/[\s()]+/g, '-')}`}>
                                <h3>Run Output:</h3>
                                <p className="status-line">
                                    <strong>Status:</strong> <span className={`status-badge`}>{output.status || 'N/A'}</span>
                                    {(output.time !== null && output.time !== undefined) && <span> | <strong>Time:</strong> {Number(output.time).toFixed(3)}s</span>}
                                    {(output.memory !== null && output.memory !== undefined) && <span> | <strong>Memory:</strong> {output.memory} KB</span>}
                                </p>
                                {output.compile_output && (<div className="output-block compile-output"><h4>Compile Output:</h4><pre>{output.compile_output}</pre></div>)}
                                {output.stderr && (<div className="output-block stderr-output"><h4>Error Output (stderr):</h4><pre>{output.stderr}</pre></div>)}
                                {(output.stdout !== null && output.stdout !== undefined) && (
                                    <div className="output-block stdout-output">
                                        <h4>Standard Output (stdout):</h4>
                                        {/* --- *** REMOVED HTML Preview Logic *** --- */}
                                        <pre>{output.stdout === '' ? '(No output)' : output.stdout}</pre>
                                    </div>
                                )}
                                {output.message && (<div className="output-block message-output"><h4>Message:</h4><pre>{output.message}</pre></div>)}
                            </div>
                        )}

                        {/* Placeholder */}
                         {!isExecuting && !isSubmitting && !output && !analysis && (
                             <div className="output-placeholder">
                                 Use "Run Code" to test, or "Submit" for AI analysis.
                             </div>
                         )}
                    </div>
                </div>
                <ExplainModal
                    isOpen={isExplainModalOpen}
                    onClose={() => setIsExplainModalOpen(false)}
                    explanation={explanationText}
                    isLoading={isExplaining}
                />
            </div>
        </AnimatedPage>
    );
}