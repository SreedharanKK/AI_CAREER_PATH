import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from 'react-router-dom';
import '../Styles/SkillGapAnalysis.css';
import { useApi } from '../hooks/useApi'; // ✅ Import hook

export default function SkillGapAnalysis() {
    const navigate = useNavigate();
    const [editedSkills, setEditedSkills] = useState("");
    const [domain, setDomain] = useState("");
    const [analysisResult, setAnalysisResult] = useState(null);
    
    // ✅ Use the hook
    const { apiFetch, isLoading, error, setError } = useApi();

    useEffect(() => {
        const fetchInitialData = async () => {
            // Fetch skills and last domain in parallel
            const [skillsData, domainData] = await Promise.all([
                apiFetch(`/api/user/skill-gap/skills`),
                apiFetch(`/api/user/skill-gap/last-domain`)
            ]);

            if (skillsData?.skills) {
                setEditedSkills(skillsData.skills.join(", "));
            }
            if (domainData?.last_domain) {
                setDomain(domainData.last_domain);
            }
        };
        fetchInitialData();
    }, []); // Run only on mount

    const fetchLatestAnalysis = useCallback(async (selectedDomain) => {
        if (!selectedDomain) {
            setAnalysisResult(null);
            return;
        }
        const data = await apiFetch(`/api/user/skill-gap/latest?domain=${selectedDomain}`);
        setAnalysisResult(data?.analysis || null);
    }, [apiFetch]);

    useEffect(() => {
        if (domain) {
            fetchLatestAnalysis(domain);
        }
    }, [domain, fetchLatestAnalysis]);

    const handleAnalyze = async () => {
        if (!domain) {
            setError("Please select a domain to analyze.");
            return;
        }
        const skillsArray = editedSkills.split(",").map(s => s.trim()).filter(s => s);
        const data = await apiFetch("/api/user/skill-gap/analyze", {
            method: "POST",
            body: JSON.stringify({ skills: skillsArray, domain })
        });

        if (data) {
            setAnalysisResult(data);
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

