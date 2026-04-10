import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnimatedPage from '../hooks/AnimatedPage';
import toast from 'react-hot-toast';
import '../Styles/HomePage.css';
import useParticleBackground from '../hooks/UseParticleBackground';
import { useApi } from '../hooks/useApi';
import { 
    ChevronRight, 
    Target, 
    Map, 
    Code, 
    Briefcase, 
    Zap, 
    ShieldCheck, 
    Github, 
    Linkedin, 
    Twitter, 
    Mail, 
    ExternalLink,
    Search,
    BrainCircuit
} from 'lucide-react';

export default function HomePage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("signup");
    
    // --- State Management ---
    const [showVerifyUI, setShowVerifyUI] = useState(false);
    const [signupEmail, setSignupEmail] = useState("");
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [showForgotPassword, setShowForgotPassword] = useState(false);
    const [resetStep, setResetStep] = useState(1);
    const [resetEmail, setResetEmail] = useState("");
    const [resetOtp, setResetOtp] = useState(["", "", "", ""]);
    const [newPassword, setNewPassword] = useState("");
    const [confirmNewPassword, setConfirmNewPassword] = useState("");
    
    const { apiFetch, isLoading, error, setError } = useApi(); 
    const [signupData, setSignupData] = useState({
        full_name: "",
        email: "",
        password: "",
        confirm_password: "",
    });

    const otpRefs = Array.from({ length: 4 }, () => useRef(null));
    const resetOtpRefs = Array.from({ length: 4 }, () => useRef(null));
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);

    // --- Handlers ---
    const handleSignupChange = (e) => {
        const { name, value } = e.target;
        setSignupData(prev => ({ ...prev, [name]: value }));
    };

    const handleOtpChange = (value, index) => {
        const digit = value.slice(-1).replace(/[^0-9]/g, '');
        const newOtp = [...otp];
        newOtp[index] = digit; 
        setOtp(newOtp);
        if (digit && index < 3) otpRefs[index + 1].current?.focus();
    };

    const handleOtpKeyDown = (e, index) => {
        if (e.key === 'Backspace' && index > 0 && !otp[index]) {
            otpRefs[index - 1].current?.focus();
        }
    };

    const handleOtpInput = (value, index, stateOtp, setStateOtp, refs) => {
        const digit = value.slice(-1).replace(/[^0-9]/g, '');
        const newOtp = [...stateOtp];
        newOtp[index] = digit; 
        setStateOtp(newOtp);
        if (digit && index < 3) refs[index + 1].current?.focus();
    };

    const handleOtpBackspace = (e, index, stateOtp, refs) => {
        if (e.key === 'Backspace' && index > 0 && !stateOtp[index]) {
            refs[index - 1].current?.focus();
        }
    };

    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        setError(null); 
        if (signupData.password !== signupData.confirm_password) {
            toast.error("❌ Passwords do not match!");
            return;
        }
        if (signupData.password.length < 6) {
            toast.error("Password must be at least 6 characters long.");
            return;
        }
        const { full_name, email, password } = signupData;

        const data = await apiFetch("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ full_name, email, password }),
        });

        if (data) { 
            toast.success("Signup Successful! Please check your email.");
            setSignupEmail(email);
            setShowVerifyUI(true);
            setOtp(["", "", "", ""]);
            setTimeout(() => otpRefs[0].current?.focus(), 100);
        }
    };

    const handleVerifyAccount = async () => {
        setError(null);
        const enteredOtp = otp.join("");
        if (enteredOtp.length !== 4) {
            toast.error("Please enter the complete 4-digit OTP.");
            return;
        }

        const data = await apiFetch("/api/auth/verify-account", {
            method: "POST",
            body: JSON.stringify({ email: signupEmail, otp: enteredOtp }),
        });

        if (data) {
            toast.success("Account verified! You can now log in.");
            setShowVerifyUI(false);
            setActiveTab("login");
            setSignupData({ full_name: "", email: "", password: "", confirm_password: "" });
        }
    };

    const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const email = e.target.loginEmail.value;
    const password = e.target.loginPassword.value;

    const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password })
    });

    if (data && !data.error) {
        toast.success(`Welcome back, ${data.fullName}!`);

        // --- NEW: Role-Based Redirection Logic ---
        if (data.is_admin === 1 || data.is_admin === true) {
            console.log("Admin detected, redirecting to Control Center...");
            navigate('/AdminDashboard');
        } else {
            console.log("Student detected, redirecting to Dashboard...");
            navigate('/Dashboard');
        }
    } else if (data && data.error) {
        setError(data.error);
    }
};

    const handleSendResetOtp = async (e) => {
        e.preventDefault();
        setError(null);
        if (!resetEmail) { toast.error("Please enter your email."); return; }

        const data = await apiFetch("/api/auth/forgot-password-send-otp", {
            method: "POST",
            body: JSON.stringify({ email: resetEmail }),
        });

        if (data) {
            toast.success("OTP sent to your email.");
            setResetStep(2);
            setResetOtp(["", "", "", ""]);
            setTimeout(() => resetOtpRefs[0].current?.focus(), 100);
        }
    };

    const handleVerifyResetOtp = async () => {
        setError(null);
        const enteredOtp = resetOtp.join("");
        if (enteredOtp.length !== 4) { toast.error("Enter valid OTP."); return; }

        const data = await apiFetch("/api/auth/forgot-password-verify-otp", {
            method: "POST",
            body: JSON.stringify({ email: resetEmail, otp: enteredOtp }),
        });

        if (data) {
            toast.success("OTP Verified. Please create a new password.");
            setResetStep(3);
        }
    };

    const handleResetPassword = async (e) => {
        e.preventDefault();
        setError(null);
        if (newPassword.length < 6) { toast.error("Password must be at least 6 characters."); return; }
        if (newPassword !== confirmNewPassword) { toast.error("Passwords do not match."); return; }

        const data = await apiFetch("/api/auth/reset-password", {
            method: "POST",
            body: JSON.stringify({ 
                email: resetEmail, 
                otp: resetOtp.join(""), 
                new_password: newPassword 
            }),
        });

        if (data) {
            toast.success("Password changed successfully!");
            setShowForgotPassword(false);
            setResetStep(1);
            setActiveTab("login");
            setNewPassword("");
            setConfirmNewPassword("");
        }
    };

    useEffect(() => {
        if (error) {
            toast.error(error);
            setError(null);
        }
    }, [error, setError]); 

    return (
        <AnimatedPage>
            <div className="homepage-wrapper">
                <canvas ref={canvasRef} className="live-background-canvas"></canvas>

                {/* Hero & Auth Section */}
                <section className="hero-section">
                    <div className="homepage-container">
                        <div className="intro-section">
                            <div className="badge">New: AI Mentor Chatbot Live 🤖</div>
                            <h1>
                                Navigate Your Future with <span className="highlight">AI-Powered Guidance</span>
                            </h1>
                            <h3 className="tagline">
                                Your personal AI mentor for skill growth & career success 🚀
                            </h3>
                            <p>
                                Join thousands of students using AI to bridge the gap between academic learning 
                                and industry expectations. Identify your missing skills in seconds.
                            </p>
                            
                            <div className="cta-group">
                                <a href="#how-it-works" className="btn-outline-glow">How it works</a>
                                <div className="user-stats">
                                    <div className="avatars">
                                        <div className="avatar-small"></div>
                                        <div className="avatar-small1"></div>
                                        <div className="avatar-small2"></div>
                                        <div className="avatar-more">+5k</div>
                                    </div>
                                    <span>Joined this month</span>
                                </div>
                            </div>

                            <div className="intro-divider"></div>
                        </div>

                        <div className="auth-card">
                            <div className="tab-buttons">
                                <button
                                    className={activeTab === "signup" ? "active" : ""}
                                    onClick={() => { if (!isLoading) { setActiveTab("signup"); setShowVerifyUI(false); setError(null); } }}
                                    disabled={isLoading}
                                >
                                    Sign Up
                                </button>
                                <button
                                    className={activeTab === "login" ? "active" : ""}
                                    onClick={() => { if (!isLoading) { setActiveTab("login"); setShowVerifyUI(false); setError(null); } }}
                                    disabled={isLoading}
                                >
                                    Login
                                </button>
                            </div>

                            {activeTab === "signup" && !showVerifyUI && (
                                <form className="form" onSubmit={handleSignupSubmit}>
                                    <input type="text" name="full_name" placeholder="Full Name" value={signupData.full_name} onChange={handleSignupChange} required disabled={isLoading} />
                                    <input type="email" name="email" placeholder="Email" value={signupData.email} onChange={handleSignupChange} required disabled={isLoading} />
                                    <input type="password" name="password" placeholder="Password (min. 6 characters)" value={signupData.password} onChange={handleSignupChange} required disabled={isLoading} />
                                    <input type="password" name="confirm_password" placeholder="Re-enter Password" value={signupData.confirm_password} onChange={handleSignupChange} required disabled={isLoading} />
                                    <button className="btn-primary" type="submit" disabled={isLoading}>
                                        {isLoading ? 'Processing...' : 'Create Account'}
                                    </button>
                                </form>
                            )}

                            {activeTab === "login" && !showForgotPassword &&(
                                <form onSubmit={handleLoginSubmit} className="form">
                                    <input type="email" name="loginEmail" placeholder="Email" required disabled={isLoading} />
                                    <input type="password" name="loginPassword" placeholder="Password" required disabled={isLoading} />
                                    <button className="btn-primary" type="submit" disabled={isLoading}>
                                        {isLoading ? 'Authenticating...' : 'Login'}
                                    </button>
                                    <div style={{ textAlign: 'center', marginTop: '15px' }}>
                                        <button 
                                            type="button" 
                                            className="btn-link" 
                                            onClick={() => { setShowForgotPassword(true); setResetStep(1); setError(null); setResetEmail(""); }}
                                            disabled={isLoading}
                                        >
                                            Forgot Password?
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === "signup" && showVerifyUI && (
                                <div className="otp-section">
                                    <h2 className="section-small-title">Verify Email</h2>
                                    <p>Enter the code sent to {signupEmail}</p>
                                    <div className="otp-inputs">
                                        {otp.map((digit, i) => (
                                            <input
                                                key={i}
                                                ref={otpRefs[i]}
                                                type="tel"
                                                maxLength={1}
                                                value={digit}
                                                onChange={(e) => handleOtpChange(e.target.value, i)}
                                                onKeyDown={(e) => handleOtpKeyDown(e, i)}
                                                required
                                                disabled={isLoading}
                                            />
                                        ))}
                                    </div>
                                    <button className="btn-success" type="button" onClick={handleVerifyAccount} disabled={isLoading || otp.join("").length !== 4}>
                                        Verify & Activate
                                    </button>
                                    <button className="btn-secondary" type="button" onClick={() => setShowVerifyUI(false)} disabled={isLoading}>
                                        Back
                                    </button>
                                </div>
                            )}

                            {showForgotPassword && (
                                <div className="otp-section">
                                    <h2 className="section-small-title">Reset Password</h2>
                                    
                                    {resetStep === 1 && (
                                        <form onSubmit={handleSendResetOtp} className="form">
                                            <p>Enter your registered email.</p>
                                            <input type="email" placeholder="Email" value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required disabled={isLoading} />
                                            <button className="btn-primary" type="submit" disabled={isLoading}>
                                                Send OTP
                                            </button>
                                        </form>
                                    )}

                                    {resetStep === 2 && (
                                        <div>
                                            <p>Enter OTP sent to {resetEmail}</p>
                                            <div className="otp-inputs">
                                                {resetOtp.map((digit, i) => (
                                                    <input
                                                        key={i}
                                                        ref={resetOtpRefs[i]}
                                                        type="tel"
                                                        maxLength={1}
                                                        value={digit}
                                                        onChange={(e) => handleOtpInput(e.target.value, i, resetOtp, setResetOtp, resetOtpRefs)}
                                                        onKeyDown={(e) => handleOtpBackspace(e, i, resetOtp, resetOtpRefs)}
                                                        required
                                                        disabled={isLoading}
                                                    />
                                                ))}
                                            </div>
                                            <button className="btn-success" type="button" onClick={handleVerifyResetOtp} disabled={isLoading}>
                                                Verify OTP
                                            </button>
                                        </div>
                                    )}

                                    {resetStep === 3 && (
                                        <form onSubmit={handleResetPassword} className="form">
                                            <p>Create a new password.</p>
                                            <input type="password" placeholder="New Password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required disabled={isLoading} />
                                            <input type="password" placeholder="Confirm Password" value={confirmNewPassword} onChange={(e) => setConfirmNewPassword(e.target.value)} required disabled={isLoading} />
                                            <button className="btn-success" type="submit" disabled={isLoading}>
                                                Reset Password
                                            </button>
                                        </form>
                                    )}

                                    <button className="btn-secondary" type="button" onClick={() => setShowForgotPassword(false)} disabled={isLoading}>
                                        Back to Login
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* Features Section */}
                <section className="features-grid-section">
                    <div className="section-container">
                        <div className="section-header">
                            <span className="subtitle">Core Capabilities</span>
                            <h2>Powerful AI for Your Career</h2>
                        </div>
                        <div className="features-grid">
                            <div className="feature-card">
                                <div className="icon-box purple"><BrainCircuit /></div>
                                <h3>Skill Gap Analysis</h3>
                                <p>Our AI analyzes your resume and profile to identify exactly what skills you're missing for your dream job.</p>
                            </div>
                            <div className="feature-card">
                                <div className="icon-box cyan"><Map /></div>
                                <h3>Personalized Roadmaps</h3>
                                <p>Get a step-by-step learning journey customized to your existing knowledge. No more generic courses.</p>
                            </div>
                            <div className="feature-card">
                                <div className="icon-box pink"><Zap /></div>
                                <h3>Adaptive Quizzes</h3>
                                <p>Validate your learning with AI-generated quizzes that adjust difficulty based on your performance.</p>
                            </div>
                            <div className="feature-card">
                                <div className="icon-box blue"><Search /></div>
                                <h3>Smart Job Search</h3>
                                <p>Find real-time job listings that match your verified skill set and target domain automatically.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* How it Works Section */}
                <section id="how-it-works" className="how-it-works-section">
                    <div className="section-container">
                        <div className="section-header">
                            <span className="subtitle">The Journey</span>
                            <h2>4 Steps to Your Dream Job</h2>
                        </div>
                        <div className="steps-container">
                            <div className="step-item">
                                <div className="step-number">01</div>
                                <h3>Analyze</h3>
                                <p>Upload your resume and select your target role. AI detects your strengths and weaknesses.</p>
                            </div>
                            <div className="step-item">
                                <div className="step-number">02</div>
                                <h3>Learn</h3>
                                <p>Follow your personalized roadmap. Use the AI Chatbot to clear doubts in real-time.</p>
                            </div>
                            <div className="step-item">
                                <div className="step-number">03</div>
                                <h3>Validate</h3>
                                <p>Complete quizzes and practice coding to verify your mastery of each specific skill.</p>
                            </div>
                            <div className="step-item">
                                <div className="step-number">04</div>
                                <h3>Apply</h3>
                                <p>Apply to matched jobs with AI-tailored cover letters and a verified skill profile.</p>
                            </div>
                        </div>
                    </div>
                </section>

                {/* Global Footer */}
                <footer className="main-footer">
                    <div className="footer-container">
                        <div className="footer-top">
                            <div className="footer-brand">
                                <div className="logo">AI CAREER<span>NAV</span></div>
                                <p>Empowering the next generation of tech professionals with intelligent, data-driven career guidance.</p>
                                <div className="social-links">
                                    <a href="#"><Twitter size={20}/></a>
                                    <a href="#"><Linkedin size={20}/></a>
                                    <a href="#"><Github size={20}/></a>
                                </div>
                            </div>
                            <div className="footer-links">
                                <h4>Platform</h4>
                                <ul>
                                    <li><a href="#">Roadmaps</a></li>
                                    <li><a href="#">Skill Analysis</a></li>
                                    <li><a href="#">Practice Hub</a></li>
                                    <li><a href="#">Job Search</a></li>
                                </ul>
                            </div>
                            <div className="footer-links">
                                <h4>Company</h4>
                                <ul>
                                    <li><a href="#">About Us</a></li>
                                    <li><a href="#">Contact</a></li>
                                    <li><a href="#">Privacy Policy</a></li>
                                    <li><a href="#">Terms of Use</a></li>
                                </ul>
                            </div>
                            <div className="footer-newsletter">
                                <h4>Stay Updated</h4>
                                <p>Get the latest career tips and AI updates.</p>
                                <div className="newsletter-form">
                                    <input type="email" placeholder="Your email" />
                                    <button><Mail size={18} /></button>
                                </div>
                            </div>
                        </div>
                        <div className="footer-bottom">
                            <p>&copy; {new Date().getFullYear()} AI Career Path Predictor. Built with ❤️ for Students.</p>
                            <div className="bottom-links">
                                <span>Status: Healthy</span>
                                <span>v1.2.0</span>
                            </div>
                        </div>
                    </div>
                </footer>
            </div>
        </AnimatedPage>
    );
}