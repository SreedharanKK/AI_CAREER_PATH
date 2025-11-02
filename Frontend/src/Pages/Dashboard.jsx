import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserCircle, faSignOutAlt, faTrophy, faRoute,
  faBullseye, faLightbulb, faBriefcase, faEdit, faFilePdf,
  faDumbbell, faNewspaper
} from '@fortawesome/free-solid-svg-icons';
import '../Styles/Dashboard.css';
import { useApi } from '../hooks/useApi';
import useParticleBackground from '../hooks/UseParticleBackground';
import WhatsNextCard from '../components/WhatsNextCard';
import toast from 'react-hot-toast';

export default function Dashboard() {
    // --- State ---
    const [userName, setUserName] = useState(null);
    const [userDetails, setUserDetails] = useState(null);
    const [showProfile, setShowProfile] = useState(false);
    const [isLogoutModalOpen, setIsLogoutModalOpen] = useState(false);
    const [latestAnalysis, setLatestAnalysis] = useState(null);
    const [latestRoadmap, setLatestRoadmap] = useState(null);
    const [achievementsSummary, setAchievementsSummary] = useState(null);
    const [latestRecs, setLatestRecs] = useState(null);
    const [newsFeed, setNewsFeed] = useState(null);
    const [initialLoading, setInitialLoading] = useState(true);
    const [latestJobSearch, setLatestJobSearch] = useState(null);
    const [whatsNext, setWhatsNext] = useState(null);

    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();

    useParticleBackground(canvasRef);
    console.log("Dashboard: Hook useParticleBackground initialized.");

    // --- Fetch Initial Dashboard Data ---
    useEffect(() => {
        let isMounted = true;
        console.log("Dashboard: Fetch useEffect triggered.");
        // Clear errors and reset state *before* fetching
        setError(null);
        setInitialLoading(true);
        setUserName(null); // Reset essential data too
        setLatestAnalysis(null);
        setLatestRoadmap(null);
        setAchievementsSummary(null);
        setLatestRecs(null);
        setNewsFeed(null);
        setLatestJobSearch(null);

        const fetchAllData = async () => {
          console.log("Dashboard: Starting data fetch...");
          const results = await Promise.allSettled([
            apiFetch('/api/user/profile'), // Essential
            apiFetch('/api/user/skill-gap/latest'),
            apiFetch('/api/user/roadmap/latest'),
            apiFetch('/api/user/learning-recommendations/latest'),
            apiFetch('/api/user/achievements/summary'),
            apiFetch('/api/user/news-feed'),
            apiFetch('/api/user/job-search/latest')
          ]);
          console.log("Dashboard: Fetch results received:", results);

          if (!isMounted) { console.log("Dashboard: Component unmounted during fetch."); return; }

          // Process Essential Profile Data
          if (results[0].status === 'fulfilled' && results[0].value?.fullName) {
              console.log("Dashboard: Profile fetch SUCCESS.");
              setUserName(results[0].value.fullName);
              // Don't clear error here, let toast effect handle it based on !initialLoading && userName
          } else {
              console.error("Dashboard: Profile fetch FAILED.", results[0].reason);
              setError(results[0].reason?.message || "Failed to load user profile. Please log in again.");
              setUserName(null); // Ensure null on critical failure
              setInitialLoading(false); // Stop loading, error state will take over
              setNewsFeed([]); // Prevent news hanging in loading
              return; // Stop processing other data
          }

          // Process Optional Data (Safely check value exists before setting)
          if (results[1].status === 'fulfilled' && results[1].value?.analysis) setLatestAnalysis(results[1].value.analysis);
          else console.warn("Analysis fetch:", results[1].status === 'rejected' ? results[1].reason : "No/invalid data");

          if (results[2].status === 'fulfilled' && results[2].value?.roadmap) setLatestRoadmap(results[2].value.roadmap);
           else console.warn("Roadmap fetch:", results[2].status === 'rejected' ? results[2].reason : "No/invalid data");

          if (results[3].status === 'fulfilled' && results[3].value?.recommendations_summary) setLatestRecs(results[3].value.recommendations_summary);
           else console.warn("Recs fetch:", results[3].status === 'rejected' ? results[3].reason : "No/invalid data");

          if (results[4].status === 'fulfilled' && results[4].value?.summary) setAchievementsSummary(results[4].value.summary);
           else console.warn("Achievements fetch:", results[4].status === 'rejected' ? results[4].reason : "No/invalid data");

          // Process News Feed
          if (results[5].status === 'fulfilled' && Array.isArray(results[5].value?.news_feed)) {
              setNewsFeed(results[5].value.news_feed);
          } else {
               console.warn("News feed fetch:", results[5].status === 'rejected' ? results[5].reason : "Invalid data");
               setNewsFeed([]); // Set empty array on failure/invalid data
          }
          if (results[6].status === 'fulfilled' && results[6].value?.latest_search) {
              setLatestJobSearch(results[6].value.latest_search);
          } else {
               console.warn("Job search history fetch failed");
               setLatestJobSearch(null); // Keep as null (or set to 'false' if you prefer)
          }

          console.log("Dashboard: Initial data processing complete.");
          setInitialLoading(false); // Mark initial load as complete
        };

        fetchAllData();

        return () => { console.log("Dashboard: Cleanup function ran."); isMounted = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [apiFetch]); // Removed setError dependency

    // Display non-critical errors via toast
    useEffect(() => {
        if (error && !initialLoading && userName) {
            console.log("Dashboard: Displaying non-critical error via toast:", error);
            toast.error(`Dashboard Error: ${error}`);
             const timer = setTimeout(() => setError(null), 3000); // Clear after 3 seconds
             return () => clearTimeout(timer);
        }
    }, [error, initialLoading, userName, setError]);

    useEffect(() => {
        const fetchWhatsNext = async () => {
            const data = await apiFetch('/api/user/whats-next');
            if (data) {
                setWhatsNext(data);
            }
        };
        
        // Only fetch this *after* you've confirmed the user is logged in
        if (userName) {
            fetchWhatsNext();
        }
    }, [apiFetch, userName]); // Run when userName is available


    // --- Handlers ---
    const handleViewProfile = async () => {
        setError(null);
        // Show loading specifically for profile details
        setUserDetails(null); // Clear previous details
        setShowProfile(true); // Show the profile section (will show loading initially)
        const data = await apiFetch('/api/user/details');
        if (data) {
          let formattedDob = data.dob;
          // Robust Date Formatting
          if (data.dob && typeof data.dob === 'string') {
               try {
                   // Try ISO format first (YYYY-MM-DD...)
                   const dateObj = new Date(data.dob);
                   if (!isNaN(dateObj.getTime())) {
                       // Check if it's a valid date object
                       formattedDob = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                   } else {
                       // Keep original if parsing failed
                       console.warn("Could not parse DOB as ISO:", data.dob);
                       formattedDob = data.dob;
                   }
               } catch (e) {
                   console.error("DOB formatting error:", e);
                   formattedDob = data.dob; // Keep original on error
               }
           } else {
                formattedDob = 'N/A'; // Handle cases where dob might be null/undefined
           }
          setUserDetails({ ...data, dob: formattedDob });
        } else {
             // Error handled by useApi -> toast, but set userDetails to indicate failure
             setUserDetails('error'); // Use a specific state to indicate loading failed
        }
    };
    const handleLogoutClick = () => setIsLogoutModalOpen(true);
    const confirmLogout = async () => {
        setIsLogoutModalOpen(false);
        setError(null);
        await apiFetch('/api/auth/logout', { method: 'POST' });
        navigate('/');
    };
    const getYearText = (yearValue) => {
        switch (String(yearValue)) { case '1': return '1st Year'; case '2': return '2nd Year'; case '3': return '3rd Year'; case 'final': return 'Final Year'; default: return yearValue || 'N/A'; }
    };

    // --- RENDER LOGIC ---
    console.log("Dashboard: Rendering component...", { initialLoading, error, userName, showProfile, newsFeed });

    // 1. Initial Loading State
    if (initialLoading && !error) {
        console.log("Dashboard: Rendering Initial Loading State.");
         return (
             <div className="dashboard-page-wrapper">
                 <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                 <div className="loading-container">
                     <div className="spinner"></div> <h2>Loading Dashboard...</h2>
                 </div>
             </div>
         );
    }

    // 2. Critical Error State (Profile Fetch Failed)
    if (error && !userName) {
        console.log("Dashboard: Rendering Critical Error State.");
         return (
             <div className="dashboard-page-wrapper">
                 <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                 <div className="error-container">
                     <h2>Error Loading Dashboard</h2> <p className="error-message-detail">{error}</p>
                     <button onClick={() => navigate('/')} className="error-action-btn">Go back to Login</button>
                 </div>
             </div>
         );
    }

    // 3. Main Dashboard Render (Profile loaded)
    console.log("Dashboard: Rendering Main Content.");
    // Make sure userName has loaded before rendering main content fully
    if (!userName) {
         console.warn("Dashboard: userName is still null/undefined during main render attempt. Rendering minimal loading.");
         // Fallback to loading state if userName somehow isn't set yet (shouldn't happen with above logic)
         return ( <div className="dashboard-page-wrapper"> <canvas ref={canvasRef} className="live-background-canvas"></canvas> <div className="loading-container"><p>Initializing...</p></div> </div> );
    }

    return (
        <div className="dashboard-page-wrapper">
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>
            <div className="dashboard-layout">
                {/* --- Sidebar --- */}
                <aside className="dashboard-sidebar">
                    <div className="user-info">
                        <FontAwesomeIcon icon={faUserCircle} className="user-icon" />
                        {/* Render userName directly now that we know it's loaded */}
                        <span className="user-name">{userName}</span>
                    </div>
                    {/* Disable buttons based on the general isApiLoading from the hook */}
                    <button className="sidebar-btn" onClick={handleViewProfile} disabled={isApiLoading}> <FontAwesomeIcon icon={faEdit} className="sidebar-btn-icon" /> View Profile </button>
                    <button className="sidebar-btn" onClick={() => navigate('/PracticePage')} disabled={isApiLoading}> <FontAwesomeIcon icon={faDumbbell} className="sidebar-btn-icon" /> Practice Hub </button>
                    <button className="sidebar-btn logout-btn" onClick={handleLogoutClick} disabled={isApiLoading}> <FontAwesomeIcon icon={faSignOutAlt} className="sidebar-btn-icon" /> Logout </button>
                </aside>

                {/* --- Main Content --- */}
                <main className="dashboard-main-content">
                    <WhatsNextCard 
                    data={whatsNext} 
                    isLoading={isApiLoading && !whatsNext} 
                    userName={userName}
                />
                    {!showProfile ? (
                        <div className="card-grid dashboard-grid">
                            {/* Achievement Card */}
                            <div className="dashboard-card clickable card-achievements" onClick={() => navigate('/Achievements')}>
                                <div className="card-header"><FontAwesomeIcon icon={faTrophy} className="card-icon trophy-icon" /><h3>Achievements</h3></div>
                                <p className="card-description">View completed milestones.</p>
                                {/* --- Safer Rendering --- */}
                                {achievementsSummary ? (
                                    <div className="analysis-preview">
                                        <h4><span className="preview-icon">🌟</span> Summary</h4>
                                        <p><span className="preview-icon">🎓</span> Completed: {achievementsSummary.completed_courses ?? 0}</p>
                                        <p><span className="preview-icon">📊</span> Analyses: {achievementsSummary.skill_analyses_count ?? 0}</p>
                                    </div>
                                ) : ( <p className="analysis-preview-none">{initialLoading ? 'Loading...' : 'No achievements.'}</p> )}
                            </div>
                            {/* Roadmap Card */}
                            <div className="dashboard-card clickable card-roadmap" onClick={() => navigate('/Roadmap')}>
                                <div className="card-header"><FontAwesomeIcon icon={faRoute} className="card-icon route-icon" /><h3>Roadmap</h3></div>
                                <p className="card-description">Personalized learning journey.</p>
                                {/* --- Safer Rendering --- */}
                                {latestRoadmap ? (
                                    <div className="analysis-preview">
                                        <h4><span className="preview-icon">📍</span>Latest:</h4>
                                        <p><strong><span className="preview-icon">🎯</span>Domain:</strong> {latestRoadmap.domain || 'N/A'}</p>
                                        {latestRoadmap.first_stage && <p><strong><span className="preview-icon">🚀</span>Starts With:</strong> "{latestRoadmap.first_stage}"</p> }
                                    </div>
                                ) : ( <p className="analysis-preview-none">{initialLoading ? 'Loading...' : 'No roadmap.'}</p> )}
                            </div>
                             {/* Skill Gap Card */}
                             <div className="dashboard-card clickable card-skill-gap" onClick={() => navigate('/SkillGapAnalysis')}>
                                 <div className="card-header"><FontAwesomeIcon icon={faBullseye} className="card-icon bullseye-icon" /><h3>Skill Gap</h3></div>
                                 <p className="card-description">Identify areas for improvement.</p>
                                 {/* --- Safer Rendering --- */}
                                 {latestAnalysis ? (
                                    <div className="analysis-preview">
                                        <h4><span className="preview-icon">📈</span>Latest:</h4>
                                        <p><strong><span className="preview-icon">🎯</span>Domain:</strong> {latestAnalysis.interested_domain || 'N/A'}</p>
                                        {Array.isArray(latestAnalysis.missing_skills) && latestAnalysis.missing_skills.length > 0 &&
                                            <p><strong><span className="preview-icon">🧠</span>To Learn:</strong> {latestAnalysis.missing_skills.join(', ')}</p> }
                                        {/* Handle case where missing_skills might be empty array */}
                                        {Array.isArray(latestAnalysis.missing_skills) && latestAnalysis.missing_skills.length === 0 &&
                                            <p>No missing skills identified!</p> }
                                    </div>
                                 ) : ( <p className="analysis-preview-none">{initialLoading ? 'Loading...' : 'No analysis.'}</p> )}
                             </div>
                             {/* Learning Recs Card */}
                             <div className="dashboard-card clickable card-learning-recs" onClick={() => navigate('/LearningRecommendations')}>
                                 <div className="card-header"><FontAwesomeIcon icon={faLightbulb} className="card-icon lightbulb-icon" /><h3>Recommendations</h3></div>
                                 <p className="card-description">AI advice on what to learn.</p>
                                 {/* --- Safer Rendering --- */}
                                 {latestRecs ? (
                                    <div className="analysis-preview">
                                        <h4><span className="preview-icon">📚</span>Topics:</h4>
                                        {Array.isArray(latestRecs.topics) && latestRecs.topics.length > 0 ? (
                                            <p>{latestRecs.topics.join(', ')}</p>
                                        ) : (<p>No specific topics found.</p>)}
                                    </div>
                                 ) : ( <p className="analysis-preview-none">{initialLoading ? 'Loading...' : 'No recommendations.'}</p> )}
                             </div>
                             {/* Job Recs Card */}
                             <div className="dashboard-card clickable card-job-recs" onClick={() => navigate('/JobRecommendations')}>
                                 <div className="card-header"><FontAwesomeIcon icon={faBriefcase} className="card-icon briefcase-icon" /><h3>Job Search</h3></div>
                                 <p className="card-description">Find relevant job opportunities.</p>
                                 {/* Show latest search summary */}
                                 {latestJobSearch ? (
                                    <div className="analysis-preview">
                                        <h4><span className="preview-icon">🔍</span>Latest Search:</h4>
                                        <p><strong><span className="preview-icon">⌨️</span>Queries:</strong> "{latestJobSearch.base_queries}"</p>
                                        {Array.isArray(latestJobSearch.locations) && latestJobSearch.locations.length > 0 &&
                                            <p><strong><span className="preview-icon">📍</span>Locations:</strong> {latestJobSearch.locations.join(', ')}</p> }
                                        <p><strong><span className="preview-icon">📊</span>Found:</strong> {latestJobSearch.job_count} jobs</p>
                                    </div>
                                 ) : (
                                    <p className="analysis-preview-none">{initialLoading || isApiLoading ? 'Loading...' : 'No recent searches.'}</p>
                                 )}
                            </div>
                             {/* News Feed Card */}
                            <div className="dashboard-card card-news-feed">
                                 <div className="card-header"> <FontAwesomeIcon icon={faNewspaper} className="card-icon newspaper-icon"/> <h3>Tech Feed</h3> </div>
                                 <p className="card-description">Recent news & articles.</p>
                                 {/* Check newsFeed state (null, [], or [...]) */}
                                 {newsFeed === null ? ( // Explicit check for initial loading state
                                    <div className="news-feed-loading"> <span className="spinner-sm"></span> Loading feed... </div>
                                 ) : Array.isArray(newsFeed) && newsFeed.length > 0 ? (
                                    <div className="news-feed-items">
                                        {newsFeed.map((item, index) => (
                                            <div key={index} className="news-item">
                                                <a href={item?.link || '#'} target="_blank" rel="noopener noreferrer" className="news-title">{item?.title || 'Untitled'}</a>
                                                <p className="news-summary">{item?.summary || '...'}</p>
                                            </div>
                                        ))}
                                    </div>
                                 ) : ( // Covers empty array or other non-array states after loading
                                     <p className="analysis-preview-none news-feed-none">Could not load feed or none found.</p>
                                 )}
                            </div>
                        </div>
                    ) : (
                        // Profile Details View
                         // Check userDetails state: null (loading), 'error', or data object
                         userDetails === null ? (
                             <div className="loading-container"><p>Loading profile details...</p></div>
                         ) : userDetails === 'error' ? (
                             <div className="error-container profile-error"> {/* Add specific class if needed */}
                                 <p className="error-message-detail">Could not load profile details.</p>
                                 <button className="update-btn secondary-action-btn" onClick={() => setShowProfile(false)}> Back to Dashboard </button>
                             </div>
                         ) : (
                            <div className="profile-details">
                                <h2>Your Profile</h2>
                                {/* Use optional chaining and nullish coalescing for safety */}
                                <p><strong>Full Name:</strong> {userDetails?.fullName ?? 'N/A'}</p>
                                <p><strong>Email:</strong> {userDetails?.email ?? 'N/A'}</p>
                                <p><strong>Date of Birth:</strong> {userDetails?.dob ?? 'N/A'}</p>
                                <p><strong>Place:</strong> {userDetails?.place ?? 'N/A'}</p>
                                <p><strong>Degree:</strong> {userDetails?.degree ?? 'N/A'}</p>
                                <p><strong>Stream:</strong> {userDetails?.stream ?? 'N/A'}</p>
                                <p><strong>Skills:</strong> {(Array.isArray(userDetails?.skills) && userDetails.skills.length > 0) ? userDetails.skills.join(", ") : 'No skills listed'}</p>
                                <p><strong>Domain:</strong> {(Array.isArray(userDetails?.domain) && userDetails.domain.length > 0) ? userDetails.domain.join(", ") : 'No domain listed'}</p>
                                <p><strong>College:</strong> {userDetails?.college ?? 'N/A'}</p>
                                <p><strong>Year:</strong> {getYearText(userDetails?.year)}</p>
                                {userDetails?.resume && (
                                    <a href={`http://localhost:5000/${userDetails.resume.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="resume-btn">
                                        <FontAwesomeIcon icon={faFilePdf} /> View Resume
                                    </a>
                                )}
                                <button className="update-btn" onClick={() => navigate('/UpdateDetails')}> Update Details </button>
                                <button className="update-btn secondary-action-btn" onClick={() => setShowProfile(false)}> Return to Dashboard </button>
                            </div>
                         )
                    )}
                </main>
            </div>

            {/* Logout Modal */}
            {isLogoutModalOpen && (
                <div className="modal-overlay" onClick={() => setIsLogoutModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Confirm Logout</h2>
                        <p>Are you sure you want to logout?</p>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={() => setIsLogoutModalOpen(false)} disabled={isApiLoading}> No, Cancel </button>
                            <button className="modal-btn modal-btn-confirm" onClick={confirmLogout} disabled={isApiLoading}> {isApiLoading ? 'Logging out...' : 'Yes, Logout'} </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}