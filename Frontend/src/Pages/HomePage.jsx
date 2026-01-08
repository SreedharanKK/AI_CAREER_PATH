import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnimatedPage from '../hooks/AnimatedPage';
import toast from 'react-hot-toast';
import '../Styles/HomePage.css';
import useParticleBackground from '../hooks/UseParticleBackground';
import { useApi } from '../hooks/useApi';

export default function HomePage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("signup");
    
    // --- State Management ---
    const [showVerifyUI, setShowVerifyUI] = useState(false); // Controls the new "Verify" screen
    const [signupEmail, setSignupEmail] = useState(""); // Stores the email used for signup to show on verify screen
    const [otp, setOtp] = useState(["", "", "", ""]);
    
    const { apiFetch, isLoading, error, setError } = useApi(); 
    const [signupData, setSignupData] = useState({
        full_name: "",
        email: "",
        password: "",
        confirm_password: "",
    });

    const otpRefs = Array.from({ length: 4 }, () => useRef(null));
    const canvasRef = useRef(null);
    useParticleBackground(canvasRef);


    const handleSignupChange = (e) => {
        const { name, value } = e.target;
        setSignupData(prev => ({ ...prev, [name]: value }));
    };

    const handleOtpChange = (value, index) => {
        const digit = value.slice(-1).replace(/[^0-9]/g, '');
        const newOtp = [...otp];
        newOtp[index] = digit; 
        setOtp(newOtp);

        if (digit && index < otpRefs.length - 1) {
            otpRefs[index + 1].current?.focus();
        }
    };

     const handleOtpKeyDown = (e, index) => {
        if (e.key === 'Backspace' && index > 0 && !otp[index]) {
            otpRefs[index - 1].current?.focus();
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

        // Call the modified /signup route
        const data = await apiFetch("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ full_name, email, password }),
        });

        if (data) { 
            toast.success("Signup Successful! Please check your email for a verification code.");
            setSignupEmail(email); // Save the email for the verify screen
            setShowVerifyUI(true); // --- NEW: Show the verify screen
            setOtp(["", "", "", ""]); // Clear OTP fields
            setTimeout(() => otpRefs[0].current?.focus(), 100);
        }
        // Error toast is handled by useApi
    };

    // --- NEW: Handler for the "Verify Account" button ---
    const handleVerifyAccount = async () => {
        setError(null);
        const enteredOtp = otp.join("");
        if (enteredOtp.length !== 4) {
            toast.error("Please enter the complete 4-digit OTP.");
            return;
        }

        // Call the new /verify-account route
        const data = await apiFetch("/api/auth/verify-account", {
            method: "POST",
            body: JSON.stringify({ email: signupEmail, otp: enteredOtp }),
        });

        if (data) {
            toast.success("Account verified! You can now log in.");
            setShowVerifyUI(false); // Hide verify screen
            setActiveTab("login"); // Switch to login tab
            setSignupData({ full_name: "", email: "", password: "", confirm_password: "" }); // Clear signup form
        }
        // Error toast is handled by useApi
    };

    // --- MODIFIED: Login handler is now much simpler ---
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError(null); 
        const email = e.target.loginEmail.value;
        const password = e.target.loginPassword.value;;
        // --- setLoginEmail(email) line removed ---

        // Call the modified /login route
        const data = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });

        if (data) { 
            // SUCCESS! No OTP needed.
            toast.success("Login Successful! Redirecting...");
            navigate("/Dashboard"); // Navigate immediately
        }
        // Error is handled by useApi
    };

    // Display backend error from useApi hook
     useEffect(() => {
         if (error) {
             toast.error(error);
             setError(null);
         }
     }, [error, setError]); 

    // --- REMOVED: The top-level `if (showVerifyUI)` block ---

    // Default Render: Login / Signup Tabs
    return (
        <AnimatedPage>
            <> 
            <canvas ref={canvasRef} className="live-background-canvas"></canvas>

            <div className="homepage-container">
                <div className="intro-section">
                    <h1>
                        Navigate Your Future with <span className="highlight">AI-Powered Career Guidance</span>
                    </h1>
                    <h3 className="tagline">
                        Your personal AI mentor for skill growth & career success 🚀
                    </h3>
                    <p>
                        Our platform helps students and professionals identify skill gaps,
                        generate customized roadmaps, and stay job-ready with AI-powered
                        analysis.
                    </p>
                    <ul className="features-list">
                        <li>📌 Personalized learning roadmap based on your domain</li>
                        <li>📌 AI-generated quizzes to track your skill progress</li>
                        <li>📌 Resume analysis for final-year students</li>
                        <li>📌 AI-powered job search assistance</li>
                        <li>📌 Secure account verification</li>
                    </ul>
                    <p className="why-choose">
                        Unlike generic learning platforms, our AI understands your
                        strengths and weaknesses, providing a step-by-step journey toward
                        your dream job. Learn smarter, not harder!
                    </p>
                    <div className="intro-divider"></div>
                </div>

                <div className="auth-card">
                    <div className="tab-buttons">
                        <button
                            className={activeTab === "signup" ? "active" : ""}
                            // --- FIX: Reset showVerifyUI on tab click ---
                            onClick={() => { if (!isLoading) { setActiveTab("signup"); setShowVerifyUI(false); setError(null); } }}
                            disabled={isLoading}
                        >
                            Sign Up
                        </button>
                        <button
                            className={activeTab === "login" ? "active" : ""}
                            // --- FIX: Reset showVerifyUI on tab click ---
                            onClick={() => { if (!isLoading) { setActiveTab("login"); setShowVerifyUI(false); setError(null); } }}
                            disabled={isLoading}
                        >
                            Login
                        </button>
                    </div>

                    {/* --- RENDER LOGIC 1: Show Signup Form --- */}
                    {activeTab === "signup" && !showVerifyUI && (
                        <form className="form" onSubmit={handleSignupSubmit}>
                            <input type="text" name="full_name" placeholder="Full Name" value={signupData.full_name} onChange={handleSignupChange} required disabled={isLoading} />
                            <input type="email" name="email" placeholder="Email" value={signupData.email} onChange={handleSignupChange} required disabled={isLoading} />
                            <input type="password" name="password" placeholder="Password (min. 6 characters)" value={signupData.password} onChange={handleSignupChange} required disabled={isLoading} />
                            <input type="password" name="confirm_password" placeholder="Re-enter Password" value={signupData.confirm_password} onChange={handleSignupChange} required disabled={isLoading} />
                            <button className="btn-primary" type="submit" disabled={isLoading}>
                                {isLoading ? 'Sending OTP...' : 'Sign Up'}
                            </button>
                        </form>
                    )}

                    {/* --- RENDER LOGIC 2: Show Login Form --- */}
                    {activeTab === "login" && (
                        <form onSubmit={handleLoginSubmit} className="form">
                            <input type="email" name="loginEmail" placeholder="Email" required disabled={isLoading} />
                            <input type="password" name="loginPassword" placeholder="Password" required disabled={isLoading} />
                            <button className="btn-primary" type="submit" disabled={isLoading}>
                                {isLoading ? 'Logging In...' : 'Login'}
                            </button>
                        </form>
                    )}

                    {/* --- RENDER LOGIC 3: Show OTP Verify Form --- */}
                    {activeTab === "signup" && showVerifyUI && (
                        <div className="otp-section" style={{ display: 'block' }}>
                            <h2 style={{ color: 'white', marginBottom: '1rem' }}>Verify Your Account</h2>
                            <p>Enter the 4-digit OTP sent to {signupEmail}</p>
                            <div className="otp-inputs">
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={otpRefs[i]}
                                        type="tel"
                                        inputMode="numeric"
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
                                {isLoading ? 'Verifying...' : 'Verify Account'}
                            </button>
                            <button
                                className="btn-secondary"
                                type="button"
                                onClick={() => { if (!isLoading) { setShowVerifyUI(false); setError(null); } }}
                                disabled={isLoading}
                            >
                                Back to Sign Up
                            </button>
                        </div>
                    )}

                </div>
            </div>
            </>
        </AnimatedPage>
    );
}