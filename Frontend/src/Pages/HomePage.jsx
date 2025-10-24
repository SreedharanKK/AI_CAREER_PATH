import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
// Corrected import paths assuming standard structure
import AnimatedPage from '../hooks/AnimatedPage';
import toast from 'react-hot-toast';
import '../Styles/HomePage.css';
import useParticleBackground from '../hooks/UseParticleBackground'; // Corrected capitalization
import { useApi } from '../hooks/useApi';

export default function HomePage() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState("signup");
    const [otpSent, setOtpSent] = useState(false);
    const [otp, setOtp] = useState(["", "", "", ""]);
    const [loginEmail, setLoginEmail] = useState("");
    // Use apiFetch, isLoading, error from the hook for ALL API calls
    const { apiFetch, isLoading, error, setError } = useApi(); // Added setError
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
        // Only allow digits
        const digit = value.slice(-1).replace(/[^0-9]/g, '');
        const newOtp = [...otp];
        newOtp[index] = digit; // Use the cleaned digit
        setOtp(newOtp);

        // Move focus only if a digit was entered
        if (digit && index < otpRefs.length - 1) {
            otpRefs[index + 1].current?.focus();
        }
    };

     const handleOtpKeyDown = (e, index) => {
         // Move focus backward on backspace if current input is empty
         if (e.key === 'Backspace' && index > 0 && !otp[index]) {
             otpRefs[index - 1].current?.focus();
         }
     };


    const handleSignupSubmit = async (e) => {
        e.preventDefault();
        setError(null); // Clear previous errors
        if (signupData.password !== signupData.confirm_password) {
            toast.error("❌ Passwords do not match!");
            return;
        }
        // Basic password strength check (example: min 6 chars)
        if (signupData.password.length < 6) {
             toast.error("Password must be at least 6 characters long.");
             return;
        }
        const { full_name, email, password } = signupData;

        // Use apiFetch
        const data = await apiFetch("/api/auth/signup", {
            method: "POST",
            body: JSON.stringify({ full_name, email, password }),
        });

        if (data) { // apiFetch returns data on success, null on error
            toast.success("Signup Successful! Please login.");
            setSignupData({ full_name: "", email: "", password: "", confirm_password: "" }); // Clear form
            setActiveTab("login"); // Switch to login tab
        }
        // Error toast is handled automatically by useApi hook (in useEffect below)
    };

    // --- CORRECTED: Use apiFetch for Login ---
    const handleLoginSubmit = async (e) => {
        e.preventDefault();
        setError(null); // Clear previous errors
        const email = e.target.elements[0].value; // More robust way to get form values
        const password = e.target.elements[1].value;
        setLoginEmail(email); // Store email for OTP verification step

        // *** Use apiFetch for the login request ***
        const data = await apiFetch("/api/auth/login", {
            method: "POST",
            body: JSON.stringify({ email, password }),
        });

        if (data) { // apiFetch returns data on success
            toast.success("OTP sent to your email!");
            setOtpSent(true); // Show OTP input section
            // Focus first OTP input after short delay
            setTimeout(() => otpRefs[0].current?.focus(), 100);
        }
        // Error is handled by useApi hook (in useEffect below)
    };

    // --- CORRECTED: Use apiFetch for OTP Verify ---
    const handleOtpVerify = async () => {
        setError(null); // Clear previous errors
        const enteredOtp = otp.join("");
        if (enteredOtp.length !== 4) {
            toast.error("Please enter the complete 4-digit OTP.");
            return;
        }

        // *** Use apiFetch for OTP verification ***
        const data = await apiFetch("/api/auth/verify-otp", {
            method: "POST",
            body: JSON.stringify({ email: loginEmail, otp: enteredOtp }),
        });

        if (data) { // apiFetch returns data on success
            toast.success("OTP Verified! Redirecting to Dashboard...");
            navigate("/Dashboard"); // Navigate on success
        }
        // Error is handled by useApi hook (in useEffect below)
    };

    // Display backend error from useApi hook if present
     useEffect(() => {
         if (error) {
             toast.error(error);
             // Clear the error *after* showing the toast
             // to prevent the toast from re-appearing on re-renders
              if (setError) { // Ensure setError function exists
                 // Use a timeout to ensure the toast has time to show
                 // before the error state potentially triggers another effect cycle
                 // Although, simply clearing might be enough depending on useApi's internal logic
                 // setTimeout(() => setError(null), 50);
                 // Let's try clearing immediately first, as useApi might handle resets
                 // setError(null); // Commenting out immediate clear, rely on hook behavior first
              }
         }
     }, [error, setError]); // Added setError dependency

    return (
        <AnimatedPage>
            <> {/* Fragment needed */}
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
                        {/* Updated job feature description */}
                        <li>📌 AI-powered job search assistance</li>
                        <li>📌 Secure OTP verification for account safety</li>
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
                            // Disable while loading to prevent switching tabs mid-request
                            onClick={() => { if (!isLoading) { setActiveTab("signup"); setOtpSent(false); setOtp(["","","",""]); setLoginEmail(""); setError(null); } }}
                            disabled={isLoading}
                        >
                            Sign Up
                        </button>
                        <button
                            className={activeTab === "login" ? "active" : ""}
                            onClick={() => { if (!isLoading) { setActiveTab("login"); setOtpSent(false); setOtp(["","","",""]); setLoginEmail(""); setError(null); } }}
                            disabled={isLoading}
                        >
                            Login
                        </button>
                    </div>

                    {activeTab === "signup" && (
                        <form className="form" onSubmit={handleSignupSubmit}>
                            <input type="text" name="full_name" placeholder="Full Name" value={signupData.full_name} onChange={handleSignupChange} required disabled={isLoading} />
                            <input type="email" name="email" placeholder="Email" value={signupData.email} onChange={handleSignupChange} required disabled={isLoading} />
                            <input type="password" name="password" placeholder="Password (min. 6 characters)" value={signupData.password} onChange={handleSignupChange} required disabled={isLoading} />
                            <input type="password" name="confirm_password" placeholder="Re-enter Password" value={signupData.confirm_password} onChange={handleSignupChange} required disabled={isLoading} />
                            {/* Disable button and change text while loading */}
                            <button className="btn-primary" type="submit" disabled={isLoading}>
                                {isLoading ? 'Signing Up...' : 'Sign Up'}
                            </button>
                        </form>
                    )}

                    {activeTab === "login" && !otpSent && (
                        <form onSubmit={handleLoginSubmit} className="form">
                            {/* Make sure inputs have names for easier access if needed, though e.target.elements works */}
                            <input type="email" name="loginEmail" placeholder="Email" required disabled={isLoading} />
                            <input type="password" name="loginPassword" placeholder="Password" required disabled={isLoading} />
                            {/* --- CORRECTED: Use isLoading state --- */}
                            <button className="btn-primary" type="submit" disabled={isLoading}>
                                {isLoading ? 'Sending OTP...' : 'Send OTP'}
                            </button>
                        </form>
                    )}

                    {activeTab === "login" && otpSent && (
                        <div className="otp-section">
                            <p>Enter the 4-digit OTP sent to {loginEmail}</p>
                            <div className="otp-inputs">
                                {otp.map((digit, i) => (
                                    <input
                                        key={i}
                                        ref={otpRefs[i]}
                                        type="tel" // Use tel for numeric keyboard on mobile
                                        inputMode="numeric" // Hint for numeric keyboard
                                        maxLength={1}
                                        value={digit}
                                        onChange={(e) => handleOtpChange(e.target.value, i)}
                                        onKeyDown={(e) => handleOtpKeyDown(e, i)} // Handle backspace
                                        required
                                        disabled={isLoading} // Disable input while verifying
                                    />
                                ))}
                            </div>
                            {/* --- CORRECTED: Use isLoading state --- */}
                            <button className="btn-success" type="button" onClick={handleOtpVerify} disabled={isLoading || otp.join("").length !== 4}>
                                {isLoading ? 'Verifying...' : 'Verify OTP'}
                            </button>
                             <button
                                 className="btn-secondary" // Ensure this class exists in your CSS
                                 type="button"
                                 onClick={() => { if (!isLoading) { setOtpSent(false); setOtp(["","","",""]); setError(null); /* Keep loginEmail */ } }}
                                 disabled={isLoading}
                             >
                                 Back to Login
                             </button>
                        </div>
                    )}
                </div>
            </div>
            </>
        </AnimatedPage>
    );
}

