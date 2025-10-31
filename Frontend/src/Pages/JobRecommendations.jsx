// JobRecommendations.jsx
import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import AnimatedPage from '../hooks/AnimatedPage';
import '../Styles/JobRecommendations.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import toast from 'react-hot-toast';
import { Bot, Search, MapPin, History} from 'lucide-react';

export default function JobRecommendations() {
    const navigate = useNavigate();
    const [editableSkills, setEditableSkills] = useState("");
    const [completedCourses, setCompletedCourses] = useState({});
    const [jobResults, setJobResults] = useState(null);
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);

    // --- State ---
    // --- *** MODIFIED: State for MULTIPLE base queries (comma-separated string) *** ---
    const [aiGeneratedBaseQueries, setAiGeneratedBaseQueries] = useState(''); // Stores AI comma-separated suggestions
    const [userBaseQueries, setUserBaseQueries] = useState(''); // User editable comma-separated string
    // --------------------------------------------------------------------------
    const [locationsString, setLocationsString] = useState('India'); // Default location
    const [showQueryInput, setShowQueryInput] = useState(false);
    const [isGeneratingQuery, setIsGeneratingQuery] = useState(false);
    const [isSearchingJobs, setIsSearchingJobs] = useState(false);
    const [latestRecommendation, setLatestRecommendation] = useState(null); // null: loading, object: data, false: no history
    const [isFetchingHistory, setIsFetchingHistory] = useState(true);

    // Fetch initial profile data
    useEffect(() => {
        const fetchProfileForJobs = async () => {
            setError(null);
            const data = await apiFetch('/api/user/get-profile-for-jobs');
            if (data) {
                if (data.skills && Array.isArray(data.skills)) {
                    setEditableSkills(data.skills.join(', '));
                }
                setCompletedCourses(data.completed_courses_by_domain || {});
            }
            setAiGeneratedBaseQueries('');
            setUserBaseQueries('');
            setShowQueryInput(false);
            // setLocationsString('India'); // Keep location default on profile load
        };
        const fetchLatestHistory = async () => {
             setIsFetchingHistory(true);
             try {
                 const data = await apiFetch('/api/user/job-history/latest');
                 if (data && data.latest_recommendation) {
                     setLatestRecommendation(data.latest_recommendation);
                 } else {
                     setLatestRecommendation(false); // No history found or invalid data
                 }
             } catch (e) {
                 // The useApi hook will set the 'error' state.
                 // We just need to ensure we stop loading and set a default.
                 console.error("Failed to fetch latest job history:", e);
                 setLatestRecommendation(false); // Set to "no history" state on error
             } finally {
                 // --- THIS IS THE FIX ---
                 // This block runs *no matter what* (success, fail, or error)
                 setIsFetchingHistory(false);
                 // -----------------------
             }
        };
        setError(null);
        fetchProfileForJobs();
        fetchLatestHistory();
    }, [apiFetch, setError]);

    // Show errors via toast
    useEffect(() => {
        if (error) {
            toast.error(`Error: ${error}`);
            setIsGeneratingQuery(false);
            setIsSearchingJobs(false);
        }
    }, [error]);

    // --- MODIFIED Handler: Generate AI BASE Queries Suggestion ---
    const handleGenerateQuery = async () => {
        setIsGeneratingQuery(true);
        setError(null);
        setAiGeneratedBaseQueries('');
        setUserBaseQueries('');
        setShowQueryInput(false);
        setJobResults(null);

        const payload = {
            skills: editableSkills.split(',').map(s => s.trim()).filter(s => s),
            completed_courses: completedCourses,
        };

        // Calls endpoint that returns {"base_queries": "Query1, Query2"}
        const data = await apiFetch('/api/user/generate-job-query', {
            method: 'POST',
            body: JSON.stringify(payload),
        });

        setIsGeneratingQuery(false);
        if (data && data.base_queries) { // Expect 'base_queries' (plural)
            toast.success("AI base query suggestions generated!");
            setAiGeneratedBaseQueries(data.base_queries); // Store original AI queries string
            setUserBaseQueries(data.base_queries);      // Set user editable queries string
            setShowQueryInput(true);
        } else if (!error) {
            setError("AI failed to generate base query suggestions.");
        }
    };


    // --- MODIFIED Handler: Execute Multi-Query, Multi-Location Search ---
    const handleSearchJobs = async () => {
        // --- *** Check userBaseQueries (plural string) *** ---
        if (!userBaseQueries || userBaseQueries.split(',').every(q => !q.trim())) {
            toast.error("Please generate or enter at least one base search query (skill + role).");
            return;
        }
        if (!locationsString || locationsString.split(',').every(l => !l.trim())) {
            toast.error("Please enter at least one location (e.g., India, Chennai, Remote).");
            return;
        }

        // Prepare locations list (no change here)
        const locationsArray = locationsString
            .split(',')
            .map(loc => loc.trim())
            .filter(loc => loc);

        if (locationsArray.length === 0) {
            toast.error("Please enter valid locations, separated by commas.");
            return;
        }

        setIsSearchingJobs(true);
        setError(null);
        setJobResults(null);

        // --- *** Send base_queries (string) and locations (array) *** ---
        const data = await apiFetch('/api/user/search-jobs', {
            method: 'POST',
            body: JSON.stringify({
                base_queries: userBaseQueries, // Send the comma-separated string
                locations: locationsArray
            }),
        });

        setIsSearchingJobs(false);
        if (data && data.jobs) {
            setJobResults(data.jobs);
            if (data.jobs.length === 0) {
                toast.success(`Search complete. No jobs found matching your criteria in the specified locations.`);
            } else {
                 toast.success(`Found ${data.jobs.length} unique job(s)!`);
            }
            const historyData = await apiFetch('/api/user/job-history/latest');
             if (historyData && historyData.latest_recommendation) {
                 setLatestRecommendation(historyData.latest_recommendation);
             }
        } else if (!error) {
            console.error("Job search returned no data or invalid format.");
            if (setError) setError("No job results found or API returned invalid format.");
            setJobResults([]);
        }
    };

    // Combined Loading State
    const isLoading = isApiLoading || isGeneratingQuery || isSearchingJobs;

    return (
        <AnimatedPage>
            <>
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                <div className="jobs-page-container">
                    {/* Header */}
                    <div className="jobs-header">
                        <h1 className="jobs-title">AI-Powered Job Search</h1>
                        <p className="jobs-subtitle">Get AI query suggestions, add locations, and find jobs across multiple roles and cities!</p>
                    </div>

                    <div className="view-history-container">
                        {isFetchingHistory && (
                             <button className="view-history-btn" disabled>
                                 <span className="spinner-sm"></span> Loading History...
                             </button>
                        )}
                        {!isFetchingHistory && latestRecommendation && (
                             <button className="view-history-btn" onClick={() => navigate('/JobHistory')}>
                                 <History size={18} />
                                 <div className="history-btn-text">
                                     <strong>View Full History</strong>
                                     <span>Last search: "{latestRecommendation.base_queries}" ({Array.isArray(latestRecommendation.locations) ? latestRecommendation.locations.join(', ') : 'N/A'})</span>
                                 </div>
                             </button>
                        )}
                         {!isFetchingHistory && !latestRecommendation && (
                             <button className="view-history-btn" disabled>
                                 <History size={18} />
                                 <div className="history-btn-text">
                                     <strong>View Full History</strong>
                                     <span>No previous searches found.</span>
                                 </div>
                             </button>
                        )}
                    </div>

                    {/* Form */}
                    <div className="job-search-form">
                        {/* Skills Input */}
                        <div className="form-section">
                            <label htmlFor="skills-textarea-jobs-id">Your Skills (comma-separated):</label>
                            <textarea id="skills-textarea-jobs-id" className="skills-textarea-jobs" value={editableSkills} onChange={(e) => setEditableSkills(e.target.value)} placeholder="e.g., Python, React, SQL..." disabled={isLoading}/>
                        </div>

                        {/* Completed Courses */}
                        <div className="form-section">
                            <label>Your Completed Roadmaps:</label>
                            <div className="completed-courses-list">
                                {/* ... (rendering logic) ... */}
                                {isApiLoading && !editableSkills ? <p>Loading your profile...</p> :
                                    Object.keys(completedCourses).length > 0 ? (
                                        Object.entries(completedCourses).map(([domain, courses]) => (
                                            <div key={domain} className="domain-group">
                                                <h4 className="domain-title">{domain}</h4>
                                                <div className="course-tags-container">
                                                    {courses.map((course, i) => <span key={i} className="course-tag">{course}</span>)}
                                                </div>
                                            </div>
                                        ))
                                    ) : (
                                        <p>No completed courses found.</p>
                                    )
                                }
                            </div>
                        </div>

                        {/* Query Generation Button */}
                        <div className="form-section">
                           <button className="generate-query-btn" onClick={handleGenerateQuery} disabled={isLoading || !editableSkills} >
                               {isGeneratingQuery ? (<><span className="spinner-sm"></span> Generating...</>) : (<><Bot size={18} /> Get AI Base Queries</>)}
                           </button>
                        </div>

                       {/* --- *** MODIFIED: Show Base Queries (string) AND Location Input *** --- */}
                       {showQueryInput && (
                           <div className="query-inputs-grid">
                               {/* Base Queries Input */}
                               <div className="form-section">
                                   {/* --- *** Updated Label *** --- */}
                                   <label htmlFor="user-base-queries-input">
                                       Base Queries (comma-separated, edit if needed):
                                   </label>
                                   <input
                                       type="text"
                                       id="user-base-queries-input"
                                       className="query-input-jobs"
                                       value={userBaseQueries} // Use userBaseQueries state
                                       onChange={(e) => setUserBaseQueries(e.target.value)} // Update userBaseQueries state
                                       placeholder="e.g., Python developer, Data analyst"
                                       disabled={isLoading}
                                   />
                                   {aiGeneratedBaseQueries && aiGeneratedBaseQueries !== userBaseQueries && (
                                       <p className="ai-original-query">
                                           AI Suggestion: <code>{aiGeneratedBaseQueries}</code>
                                       </p>
                                   )}
                               </div>

                               {/* Location Input (no change needed here) */}
                               <div className="form-section">
                                   <label htmlFor="locations-input">
                                       <MapPin size={16} style={{ marginRight: '6px', verticalAlign: 'middle' }}/>
                                       Locations (comma-separated):
                                   </label>
                                   <input
                                       type="text"
                                       id="locations-input"
                                       className="query-input-jobs location-input"
                                       value={locationsString}
                                       onChange={(e) => setLocationsString(e.target.value)}
                                       placeholder="e.g., Chennai, Bangalore, Remote"
                                       disabled={isLoading}
                                   />
                               </div>
                           </div>
                       )}
                       {/* --- *** END MODIFIED SECTION *** --- */}

                        {/* Action Buttons */}
                        <div className="form-actions job-search-actions">
                           <button
                               className="search-jobs-btn"
                               onClick={handleSearchJobs}
                               // --- *** Updated Disable Logic *** ---
                               disabled={isLoading || (showQueryInput && (!userBaseQueries || !locationsString || userBaseQueries.split(',').every(q => !q.trim()) || locationsString.split(',').every(l => !l.trim())))}
                               title={(!userBaseQueries || !locationsString) && showQueryInput ? "Enter base queries and location(s)" : "Search for jobs"}
                           >
                               {isSearchingJobs ? (<><span className="spinner-sm"></span> Searching...</>) : (<><Search size={18} /> Search Jobs</>)}
                           </button>
                            <button className="return-dashboard-btn" onClick={() => navigate('/dashboard')} disabled={isLoading}>
                                Return to Dashboard
                            </button>
                        </div>
                    </div> {/* End Form */}

                    {/* Results Container */}
                    <div className="results-container">
                        {(isGeneratingQuery || isSearchingJobs) && !error && (
                            <div className="feedback-container">
                                <div className="spinner"></div>
                                <p>{isGeneratingQuery ? 'AI is generating base queries...' : 'Searching jobs across queries & locations...'}</p>
                            </div>
                        )}

                        {!isSearchingJobs && jobResults && (
                            <>
                                {jobResults.length === 0 ? (
                                    <div className="feedback-container">
                                        <p>No jobs matching your criteria were found this time. Try different locations or refine the base queries.</p>
                                    </div>
                                ) : (
                                    <div className="jobs-grid">
                                        {/* ... Job Card Rendering ... */}
                                        {jobResults.map((job, index) => (
                                            <a key={`${job.job_id || index}-${job.company_name}`} href={job.job_url} target="_blank" rel="noopener noreferrer" className="job-card-link">
                                                <div className="job-card">
                                                    <div className="job-card-header">
                                                        <h3 className="job-title">{job.job_title}</h3>
                                                        <p className="company-name">{job.company_name}</p>
                                                    </div>
                                                    <div className="job-details">
                                                        <p><span className="detail-icon">📍</span> {job.location}</p>
                                                        <p><span className="detail-icon">💰</span> {job.estimated_salary_lpa}</p>
                                                    </div>
                                                    <div className="job-skills">
                                                         <h4>Source:</h4>
                                                         <p className="recommendation-reason">{job.source}</p>
                                                    </div>
                                                    <div className="view-job-btn"> View Job Posting ↗ </div>
                                                </div>
                                            </a>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div> {/* End results-container */}
                </div> {/* End jobs-page-container */}
            </>
        </AnimatedPage>
    );
}