import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import '../Styles/SkillGapAnalysis.css'; // The CSS is now imported from this file

export default function SkillGapAnalysis() {
    const navigate = useNavigate();
    const [skills, setSkills] = useState([]);
    const [editedSkills, setEditedSkills] = useState("");
    const [domain, setDomain] = useState("");
    const [analysisResult, setAnalysisResult] = useState(null);
    const [isLoading, setIsLoading] = useState(true); // Start loading immediately
    const [error, setError] = useState(null);

    // --- Fetch user's combined skills on initial mount ---
    useEffect(() => {
        const fetchSkills = async () => {
            try {
                const res = await fetch(`http://localhost:5000/api/user/skill-gap/skills`, {
                    credentials: 'include',
                });
                if (!res.ok) throw new Error("Could not fetch skills.");
                const data = await res.json();
                if (data.skills) {
                    setSkills(data.skills);
                    setEditedSkills(data.skills.join(", "));
                }
            } catch (err) {
                console.error("Error fetching skills:", err);
                setError("Failed to fetch your skills list.");
            }
        };
        fetchSkills();
    }, []);

    // --- Memoized function to fetch the latest analysis for a specific domain ---
    const fetchLatestAnalysis = useCallback(async (selectedDomain) => {
        if (!selectedDomain) {
            setAnalysisResult(null); // Clear results if no domain is selected
            setIsLoading(false);
            return;
        };
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch(`http://localhost:5000/api/user/skill-gap/latest?domain=${selectedDomain}`, {
                credentials: 'include',
            });
            if (!res.ok) throw new Error("Could not fetch latest analysis.");
            const data = await res.json();
            if (data.analysis) {
                setAnalysisResult(data.analysis);
            } else {
                setAnalysisResult(null); // Explicitly clear if no analysis found for this domain
            }
        } catch (err) {
            console.error("Error fetching latest analysis:", err);
            // Don't set a hard error, as user can generate a new one.
        } finally {
            setIsLoading(false);
        }
    }, []);

    // --- On initial mount, fetch the last-used domain ---
    useEffect(() => {
        const fetchInitialDomain = async () => {
            setIsLoading(true); // Ensure loading is true at the start
            try {
                const res = await fetch(`http://localhost:5000/api/user/skill-gap/last-domain`, {
                    credentials: 'include',
                });
                if (res.ok) {
                    const data = await res.json();
                    if (data.last_domain) {
                        setDomain(data.last_domain); // This will trigger the next effect to load the analysis
                    } else {
                        setIsLoading(false); // No history, stop loading
                    }
                } else {
                    setIsLoading(false);
                }
            } catch (err) {
                console.error("Error fetching last domain:", err);
                setIsLoading(false);
            }
        };
        fetchInitialDomain();
    }, []);

    // --- This effect runs whenever the 'domain' state changes ---
    useEffect(() => {
        fetchLatestAnalysis(domain);
    }, [domain, fetchLatestAnalysis]);


    // --- Function to generate a NEW analysis ---
    const handleAnalyze = async () => {
        setIsLoading(true);
        setError(null);
        try {
            const res = await fetch("http://localhost:5000/api/user/skill-gap/analyze", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({
                    skills: editedSkills.split(",").map(s => s.trim()),
                    domain
                })
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            setAnalysisResult(data);
        } catch (err) {
            console.error("Error analyzing skills:", err);
            setError("Analysis failed. Could not connect to the server.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="skill-gap-container">
            <div className="skill-gap-header">
                <h2>Skill Gap Analysis</h2>
                <button className="return-btn" onClick={() => navigate('/dashboard')}>Return to Dashboard</button>
            </div>
            
            {error && <div className="error-message">{error}</div>}

            <label>Your Combined Skills (from Profile & Resume):</label>
            <textarea
                value={editedSkills}
                onChange={(e) => setEditedSkills(e.target.value)}
                className="skills-textarea"
                placeholder={isLoading ? "Loading your skills..." : "Your skills will appear here"}
            />

            <label>Select Your Interested Domain:</label>
            <select value={domain} onChange={(e) => setDomain(e.target.value)} className="domain-select">
                <option value="">-- Select Your Career Path --</option>
                <optgroup label="Web & App Development">
                    <option value="Frontend Developer">Frontend Developer</option>
                    <option value="Backend Developer">Backend Developer</option>
                    <option value="Full Stack Developer">Full Stack Developer</option>
                    <option value="Android Developer">Android Developer</option>
                    <option value="iOS Developer">iOS Developer</option>
                </optgroup>
                <optgroup label="AI, Data Science & ML">
                    <option value="AI and Machine Learning Engineer">AI and Machine Learning Engineer</option>
                    <option value="Data Scientist">Data Scientist</option>
                    <option value="Data Analyst">Data Analyst</option>
                    <option value="Data Engineer">Data Engineer</option>
                </optgroup>
                <optgroup label="Cloud & DevOps">
                    <option value="DevOps Engineer">DevOps Engineer</option>
                    <option value="Cloud Platform Engineer (AWS, Azure, or GCP)">Cloud Platform Engineer</option>
                </optgroup>
                <optgroup label="Cyber Security">
                    <option value="Cyber Security Analyst">Cyber Security Analyst</option>
                    <option value="Penetration Tester (Ethical Hacking)">Penetration Tester</option>
                </optgroup>
                <optgroup label="Specialized Engineering">
                    <option value="Blockchain Developer">Blockchain Developer</option>
                    <option value="Game Developer">Game Developer</option>
                    <option value="Software Quality Assurance (QA) Engineer">QA Engineer</option>
                </optgroup>
            </select>

            <button className="analyze-btn" onClick={handleAnalyze} disabled={isLoading || !domain}>
                {isLoading ? 'Analyzing...' : 'Analyze with AI'}
            </button>

            {isLoading && <div className="loading-spinner"></div>}

            {analysisResult && (
                <div className="analysis-result">
                    <h3>Analysis Results for {analysisResult.interested_domain || domain}</h3>
                    <div className="result-section">
                        <h4>Missing Skills:</h4>
                        <div className="missing-skills-container">
                            {analysisResult.missing_skills?.length > 0 ? (
                                analysisResult.missing_skills.map((skill, i) => (
                                    <span key={i} className="skill-tag">{skill}</span>
                                ))
                            ) : (
                                <p>None! You're on the right track for this domain.</p>
                            )}
                        </div>
                    </div>
                    <div className="result-section">
                        <h4>AI Recommendations:</h4>
                        <ul>
                            {analysisResult.recommendations?.map((rec, i) => (
                                <li key={i}>{rec}</li>
                            ))}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
}

