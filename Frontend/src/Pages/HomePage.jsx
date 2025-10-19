import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import AnimatedPage from "../hooks/AnimatedPage";
import toast from 'react-hot-toast';
import "../Styles/HomePage.css";
import useParticleBackground from "../hooks/UseParticleBackground";

export default function HomePage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState("signup");
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState(["", "", "", ""]);
  const [loginEmail, setLoginEmail] = useState("");

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
    const newOtp = [...otp];
    newOtp[index] = value.slice(-1);
    setOtp(newOtp);

    if (value && index < otpRefs.length - 1) {
      otpRefs[index + 1].current?.focus();
    }
  };

  const handleSignupSubmit = async (e) => {
    e.preventDefault();
    if (signupData.password !== signupData.confirm_password) {
      toast.error("❌ Passwords do not match!");
      return;
    }
    const { full_name, email, password } = signupData;
    try {
      const res = await fetch("http://localhost:5000/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ full_name, email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("Signup Successful!");
        setSignupData({ full_name: "", email: "", password: "", confirm_password: "" });
        setActiveTab("login");
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("⚠️ Server not responding");
    }
  };

  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    const email = e.target[0].value;
    const password = e.target[1].value;
    setLoginEmail(email);
    try {
      const res = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("OTP sent to your email!");
        setOtpSent(true);
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("⚠️ Server not responding");
    }
  };

  const handleOtpVerify = async () => {
    const enteredOtp = otp.join("");
    try {
      const res = await fetch("http://localhost:5000/api/auth/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ email: loginEmail, otp: enteredOtp }),
      });
      const data = await res.json();
      if (res.ok) {
        toast.success("OTP Verified! Redirecting to Dashboard...");
        navigate("/Dashboard");
      } else {
        toast.error(data.error);
      }
    } catch (err) {
      toast.error("⚠️ Server not responding");
    }
  };

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
            <li>📌 Smart job recommendations using LinkedIn</li>
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
              onClick={() => { setActiveTab("signup"); setOtpSent(false); }}
            >
              Sign Up
            </button>
            <button
              className={activeTab === "login" ? "active" : ""}
              onClick={() => { setActiveTab("login"); setOtpSent(false); }}
            >
              Login
            </button>
          </div>

          {activeTab === "signup" && (
            <form className="form" onSubmit={handleSignupSubmit}>
              <input type="text" name="full_name" placeholder="Full Name" value={signupData.full_name} onChange={handleSignupChange} required />
              <input type="email" name="email" placeholder="Email" value={signupData.email} onChange={handleSignupChange} required />
              <input type="password" name="password" placeholder="Password" value={signupData.password} onChange={handleSignupChange} required />
              <input type="password" name="confirm_password" placeholder="Re-enter Password" value={signupData.confirm_password} onChange={handleSignupChange} required />
              <button className="btn-primary" type="submit">Sign Up</button>
            </form>
          )}

          {activeTab === "login" && !otpSent && (
            <form onSubmit={handleLoginSubmit} className="form">
              <input type="email" placeholder="Email" required />
              <input type="password" placeholder="Password" required />
              <button className="btn-primary">Send OTP</button>
            </form>
          )}

          {activeTab === "login" && otpSent && (
            <div className="otp-section">
              <p>Enter the OTP sent to your email</p>
              <div className="otp-inputs">
                {otp.map((digit, i) => (
                  <input key={i} ref={otpRefs[i]} type="text" maxLength={1} value={digit} onChange={(e) => handleOtpChange(e.target.value, i)} />
                ))}
              </div>
              <button className="btn-success" type="button" onClick={handleOtpVerify}>
                Verify OTP
              </button>
            </div>
          )}
        </div>
      </div>
    </>
    </AnimatedPage>
  );
}