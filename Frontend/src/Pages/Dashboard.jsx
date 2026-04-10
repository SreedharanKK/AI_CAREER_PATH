import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faUserCircle, faSignOutAlt, faTrophy, faRoute,
  faBullseye, faLightbulb, faBriefcase, faEdit, faFilePdf,
  faDumbbell, faNewspaper, faHammer, faChartLine, faChartPie, faTasks, faAward
} from '@fortawesome/free-solid-svg-icons';
import { 
  PieChart, Pie, Cell, ResponsiveContainer, Tooltip, 
  BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  AreaChart, Area, Legend 
} from 'recharts';
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
    
    // --- New Stats State ---
    const [statsData, setStatsData] = useState({
        skillRatio: [],
        weeklyActivity: [],
        roadmapProgress: []
    });

    const navigate = useNavigate();
    const canvasRef = useRef(null);
    const { apiFetch, isLoading: isApiLoading, error, setError } = useApi();

    useParticleBackground(canvasRef);

    // --- Fetch Initial Dashboard Data ---
    useEffect(() => {
        let isMounted = true;
        setError(null);
        setInitialLoading(true);

        const fetchAllData = async () => {
          const results = await Promise.allSettled([
            apiFetch('/api/user/profile'), 
            apiFetch('/api/user/skill-gap/latest'),
            apiFetch('/api/user/roadmap/latest'),
            apiFetch('/api/user/learning-recommendations/latest'),
            apiFetch('/api/user/achievements/summary'),
            apiFetch('/api/user/news-feed'),
            apiFetch('/api/user/job-search/latest'),
            apiFetch('/api/user/stats') // New endpoint for charts
          ]);

          if (!isMounted) return;

          if (results[0].status === 'fulfilled' && results[0].value?.fullName) {
              setUserName(results[0].value.fullName);
          } else {
              setError(results[0].reason?.message || "Failed to load user profile.");
              setInitialLoading(false);
              return;
          }

          // Process Optional Data
          if (results[1].status === 'fulfilled' && results[1].value?.analysis) setLatestAnalysis(results[1].value.analysis);
          if (results[2].status === 'fulfilled' && results[2].value?.roadmap) setLatestRoadmap(results[2].value.roadmap);
          if (results[3].status === 'fulfilled' && results[3].value?.recommendations_summary) setLatestRecs(results[3].value.recommendations_summary);
          if (results[4].status === 'fulfilled' && results[4].value?.summary) setAchievementsSummary(results[4].value.summary);
          if (results[5].status === 'fulfilled' && Array.isArray(results[5].value?.news_feed)) setNewsFeed(results[5].value.news_feed);
          else setNewsFeed([]);
          if (results[6].status === 'fulfilled' && results[6].value?.latest_search) setLatestJobSearch(results[6].value.latest_search);
          
          // Process Chart Stats (Fallback to mock if endpoint doesn't exist yet)
          if (results[7].status === 'fulfilled' && results[7].value) {
              setStatsData(results[7].value);
          } else {
              // Mock Data for UI presentation if backend is not yet updated
              setStatsData({
                  skillRatio: [
                      { name: 'Acquired', value: 65, color: '#4CC9F0' },
                      { name: 'Missing', value: 35, color: '#F72585' }
                  ],
                  weeklyActivity: [
                      { day: 'Mon', score: 45 }, { day: 'Tue', score: 52 },
                      { day: 'Wed', score: 38 }, { day: 'Thu', score: 65 },
                      { day: 'Fri', score: 48 }, { day: 'Sat', score: 85 },
                      { day: 'Sun', score: 70 }
                  ],
                  roadmapProgress: [
                      { stage: 'Basics', progress: 100 },
                      { stage: 'Intermediate', progress: 45 },
                      { stage: 'Advanced', progress: 10 },
                      { stage: 'Expert', progress: 0 }
                  ]
              });
          }

          setInitialLoading(false);
        };

        fetchAllData();
        return () => { isMounted = false; };
    }, [apiFetch, setError]);

    useEffect(() => {
        if (error && !initialLoading && userName) {
            toast.error(`Dashboard Error: ${error}`);
            const timer = setTimeout(() => setError(null), 3000);
            return () => clearTimeout(timer);
        }
    }, [error, initialLoading, userName, setError]);

    useEffect(() => {
        const fetchWhatsNext = async () => {
            const data = await apiFetch('/api/user/whats-next');
            if (data) setWhatsNext(data);
        };
        if (userName) fetchWhatsNext();
    }, [apiFetch, userName]);

    // --- Handlers ---
    const handleViewProfile = async () => {
        setError(null);
        setUserDetails(null);
        setShowProfile(true);
        const data = await apiFetch('/api/user/details');
        if (data) {
          let formattedDob = data.dob;
          if (data.dob && typeof data.dob === 'string') {
               try {
                   const dateObj = new Date(data.dob);
                   if (!isNaN(dateObj.getTime())) {
                       formattedDob = dateObj.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
                   }
               } catch (e) { formattedDob = data.dob; }
           }
          setUserDetails({ ...data, dob: formattedDob });
        } else {
             setUserDetails('error');
        }
    };

    const handleLogoutClick = () => setIsLogoutModalOpen(true);
    const confirmLogout = async () => {
        setIsLogoutModalOpen(false);
        await apiFetch('/api/auth/logout', { method: 'POST' });
        navigate('/');
    };

    const getYearText = (yearValue) => {
        switch (String(yearValue)) { case '1': return '1st Year'; case '2': return '2nd Year'; case '3': return '3rd Year'; case 'final': return 'Final Year'; default: return yearValue || 'N/A'; }
    };

    if (initialLoading && !error) {
         return (
             <div className="dashboard-page-wrapper">
                 <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                 <div className="loading-container">
                     <div className="spinner"></div> <h2>Syncing Data...</h2>
                 </div>
             </div>
         );
    }

    if (error && !userName) {
         return (
             <div className="dashboard-page-wrapper">
                 <canvas ref={canvasRef} className="live-background-canvas"></canvas>
                 <div className="error-container">
                     <h2>Session Expired</h2> <p className="error-message-detail">{error}</p>
                     <button onClick={() => navigate('/')} className="error-action-btn">Re-login</button>
                 </div>
             </div>
         );
    }

    return (
        <div className="dashboard-page-wrapper">
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>
            <div className="dashboard-layout">
                {/* --- Sidebar --- */}
                <aside className="dashboard-sidebar">
                    <div className="user-info">
                        <FontAwesomeIcon icon={faUserCircle} className="user-icon" />
                        <span className="user-name">{userName}</span>
                    </div>
                    <button className="sidebar-btn" onClick={handleViewProfile} disabled={isApiLoading}> <FontAwesomeIcon icon={faEdit} className="sidebar-btn-icon" /> Profile </button>
                    <button className="sidebar-btn" onClick={() => navigate('/PracticePage')} disabled={isApiLoading}> <FontAwesomeIcon icon={faDumbbell} className="sidebar-btn-icon" /> Practice Hub </button>
                    <button className="sidebar-btn" onClick={() => navigate('/ProjectIdeas')} disabled={isApiLoading}><FontAwesomeIcon icon={faHammer} className="sidebar-btn-icon" /> Build Projects</button>
                    <button className="sidebar-btn" onClick={() => navigate('/Certificates')} disabled={isApiLoading}><FontAwesomeIcon icon={faAward} className="sidebar-btn-icon cert-icon-sidebar" /> My Certificates </button>
                    <button className="sidebar-btn logout-btn" onClick={handleLogoutClick} disabled={isApiLoading}> <FontAwesomeIcon icon={faSignOutAlt} className="sidebar-btn-icon" /> Logout </button>
                </aside>

                {/* --- Main Content --- */}
                <main className="dashboard-main-content">
                    <WhatsNextCard 
                        data={whatsNext} 
                        isLoading={isApiLoading && !whatsNext} 
                        userName={userName}
                    />

                    {!showProfile && (
                        <>
                            {/* --- NEW: Analytics Section --- */}
                            <section className="analytics-section">
                                <div className="analytics-grid">
                                    {/* Chart 1: Skill Distribution */}
                                    <div className="analytics-card">
                                        <div className="chart-header">
                                            <FontAwesomeIcon icon={faChartPie} className="chart-icon purple" />
                                            <h4>Skill Mastery</h4>
                                        </div>
                                        <div className="chart-container">
                                            <ResponsiveContainer width="100%" height={200}>
                                                <PieChart>
                                                    <Pie
                                                        data={statsData.skillRatio}
                                                        innerRadius={60}
                                                        outerRadius={80}
                                                        paddingAngle={5}
                                                        dataKey="value"
                                                    >
                                                        {statsData.skillRatio.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                                        ))}
                                                    </Pie>
                                                    <Tooltip 
                                                        contentStyle={{ backgroundColor: '#1c0a3a', border: '1px solid #4a3470', borderRadius: '8px' }}
                                                        itemStyle={{ color: '#fff' }}
                                                    />
                                                    <Legend verticalAlign="bottom" height={36}/>
                                                </PieChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Chart 2: Roadmap Progress */}
                                    <div className="analytics-card">
                                        <div className="chart-header">
                                            <FontAwesomeIcon icon={faTasks} className="chart-icon cyan" />
                                            <h4>Roadmap Milestones</h4>
                                        </div>
                                        <div className="chart-container">
                                            <ResponsiveContainer width="100%" height={200}>
                                                <BarChart data={statsData.roadmapProgress}>
                                                    <XAxis dataKey="stage" stroke="#A0A0B0" fontSize={12} tickLine={false} axisLine={false} />
                                                    <YAxis hide />
                                                    <Tooltip cursor={{fill: 'rgba(255,255,255,0.05)'}} contentStyle={{ backgroundColor: '#1c0a3a', border: '1px solid #4a3470' }} />
                                                    <Bar dataKey="progress" radius={[4, 4, 0, 0]}>
                                                        {statsData.roadmapProgress.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={entry.progress > 50 ? '#4CC9F0' : '#7B2CBF'} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>

                                    {/* Chart 3: Weekly Activity */}
                                    <div className="analytics-card">
                                        <div className="chart-header">
                                            <FontAwesomeIcon icon={faChartLine} className="chart-icon pink" />
                                            <h4>Learning Velocity</h4>
                                        </div>
                                        <div className="chart-container">
                                            <ResponsiveContainer width="100%" height={200}>
                                                <AreaChart data={statsData.weeklyActivity}>
                                                    <defs>
                                                        <linearGradient id="colorScore" x1="0" y1="0" x2="0" y2="1">
                                                            <stop offset="5%" stopColor="#F72585" stopOpacity={0.3}/>
                                                            <stop offset="95%" stopColor="#F72585" stopOpacity={0}/>
                                                        </linearGradient>
                                                    </defs>
                                                    <XAxis dataKey="day" stroke="#A0A0B0" fontSize={12} tickLine={false} axisLine={false} />
                                                    <Tooltip contentStyle={{ backgroundColor: '#1c0a3a', border: '1px solid #4a3470' }} />
                                                    <Area type="monotone" dataKey="score" stroke="#F72585" fillOpacity={1} fill="url(#colorScore)" strokeWidth={3} />
                                                </AreaChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </div>
                                </div>
                            </section>

                            <div className="card-grid dashboard-grid">
                                {/* Standard Achievement Card */}
                                <div className="dashboard-card clickable card-achievements" onClick={() => navigate('/Achievements')}>
                                    <div className="card-header"><FontAwesomeIcon icon={faTrophy} className="card-icon trophy-icon" />
                                    <h3>Achievements</h3></div>
                                    <p className="card-description">View completed milestones.</p>
                                    {achievementsSummary ? (
                                        <div className="analysis-preview">
                                            <p><span className="preview-icon">🎓</span> Completed: {achievementsSummary.completed_courses ?? 0}</p>
                                            <p><span className="preview-icon">📊</span> Analyses: {achievementsSummary.skill_analyses_count ?? 0}</p>
                                        </div>
                                    ) : ( <p className="analysis-preview-none">No achievements yet.</p> )}
                                </div>

                                {/* Roadmap Card */}
                                <div className="dashboard-card clickable card-roadmap" onClick={() => navigate('/Roadmap')}>
                                    <div className="card-header"><FontAwesomeIcon icon={faRoute} className="card-icon route-icon" /><h3>Roadmap</h3></div>
                                    <p className="card-description">Personalized learning journey.</p>
                                    {latestRoadmap ? (
                                        <div className="analysis-preview">
                                            <p><strong><span className="preview-icon">🎯</span>Domain:</strong> {latestRoadmap.domain || 'N/A'}</p>
                                            {latestRoadmap.first_stage && <p><strong><span className="preview-icon">🚀</span>Starts With:</strong> "{latestRoadmap.first_stage}"</p> }
                                        </div>
                                    ) : ( <p className="analysis-preview-none">No roadmap found.</p> )}
                                </div>

                                {/* Skill Gap Card */}
                                <div className="dashboard-card clickable card-skill-gap" onClick={() => navigate('/SkillGapAnalysis')}>
                                    <div className="card-header"><FontAwesomeIcon icon={faBullseye} className="card-icon bullseye-icon" /><h3>Skill Gap</h3></div>
                                    <p className="card-description">Identify areas for improvement.</p>
                                    {latestAnalysis ? (
                                        <div className="analysis-preview">
                                            <p><strong><span className="preview-icon">🎯</span>Domain:</strong> {latestAnalysis.interested_domain || 'N/A'}</p>
                                            {Array.isArray(latestAnalysis.missing_skills) && latestAnalysis.missing_skills.length > 0 &&
                                                <p><strong><span className="preview-icon">🧠</span>To Learn:</strong> {latestAnalysis.missing_skills.slice(0, 3).join(', ')}...</p> }
                                        </div>
                                    ) : ( <p className="analysis-preview-none">No analysis yet.</p> )}
                                </div>
                                
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
                                    <p className="card-description">Find relevant opportunities.</p>
                                    {latestJobSearch ? (
                                        <div className="analysis-preview">
                                            <p><strong><span className="preview-icon">⌨️</span>Query:</strong> "{latestJobSearch.base_queries}"</p>
                                            <p><strong><span className="preview-icon">📊</span>Found:</strong> {latestJobSearch.job_count} jobs</p>
                                        </div>
                                    ) : (
                                        <p className="analysis-preview-none">No recent searches.</p>
                                    )}
                                </div>

                                {/* News Feed Card */}
                                <div className="dashboard-card card-news-feed">
                                     <div className="card-header"> <FontAwesomeIcon icon={faNewspaper} className="card-icon newspaper-icon"/> <h3>Tech Feed</h3> </div>
                                     {newsFeed === null ? (
                                        <div className="news-feed-loading"> <span className="spinner-sm"></span> Loading feed... </div>
                                     ) : Array.isArray(newsFeed) && newsFeed.length > 0 ? (
                                        <div className="news-feed-items">
                                            {newsFeed.slice(0, 3).map((item, index) => (
                                                <div key={index} className="news-item">
                                                    <a href={item?.link || '#'} target="_blank" rel="noopener noreferrer" className="news-title">{item?.title}</a>
                                                    <p className="news-summary">{item?.summary?.slice(0, 60)}...</p>
                                                </div>
                                            ))}
                                        </div>
                                     ) : (
                                         <p className="analysis-preview-none">No news found.</p>
                                     )}
                                </div>
                            </div>
                        </>
                    )}

                    {showProfile && (
                        <div className="profile-details">
                            <h2>User Profile</h2>
                            {userDetails === null ? (
                                <div className="loading-container"><p>Loading details...</p></div>
                            ) : userDetails === 'error' ? (
                                <div className="error-container profile-error">
                                    <p>Could not load profile details.</p>
                                    <button className="update-btn secondary-action-btn" onClick={() => setShowProfile(false)}> Back </button>
                                </div>
                            ) : (
                                <>
                                    <p><strong>Full Name:</strong> {userDetails?.fullName}</p>
                                    <p><strong>Email:</strong> {userDetails?.email}</p>
                                    <p><strong>Degree:</strong> {userDetails?.degree}</p>
                                    <p><strong>Year:</strong> {getYearText(userDetails?.year)}</p>
                                    <p><strong>Skills:</strong> {userDetails?.skills?.join(", ")}</p>
                                    {userDetails?.resume && (
                                        <a href={`http://localhost:5000/${userDetails.resume.replace(/\\/g, '/')}`} target="_blank" rel="noopener noreferrer" className="resume-btn">
                                            <FontAwesomeIcon icon={faFilePdf} /> View Resume
                                        </a>
                                    )}
                                    <button className="update-btn" onClick={() => navigate('/UpdateDetails')}> Edit Profile </button>
                                    <button className="update-btn secondary-action-btn" onClick={() => setShowProfile(false)}> Back to Dashboard </button>
                                </>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Logout Modal */}
            {isLogoutModalOpen && (
                <div className="modal-overlay" onClick={() => setIsLogoutModalOpen(false)}>
                    <div className="modal-content" onClick={(e) => e.stopPropagation()}>
                        <h2>Confirm Logout</h2>
                        <p>Are you sure you want to exit?</p>
                        <div className="modal-actions">
                            <button className="modal-btn modal-btn-cancel" onClick={() => setIsLogoutModalOpen(false)}> Cancel </button>
                            <button className="modal-btn modal-btn-confirm" onClick={confirmLogout}> Logout </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}