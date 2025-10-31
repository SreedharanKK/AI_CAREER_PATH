const nodemailer = require("nodemailer");

// Read input from stdin (Flask will pass JSON)
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", async () => {
    try {
        const data = JSON.parse(input);
        const { email, otp, fullName } = data; // Destructure potential fullName

        if (!email) {
            console.error("Email missing");
            process.exit(1);
        }

        // --- Determine Email Type ---
        let subject = "";
        let textContent = "";
        let htmlContent = ""; // Optional: for richer formatting

        if (otp) {
            // --- OTP Email ---
            subject = "Your AI Career Guider OTP Code";
            textContent = `Your OTP code is ${otp}, valid for 5 minutes.`;
            htmlContent = `
                <p>Hello,</p>
                <p>Your One-Time Password (OTP) for AI Career Guider is: <strong>${otp}</strong></p>
                <p>This code is valid for 5 minutes.</p>
                <p>If you did not request this code, please ignore this email.</p>
                <br/>
                <p>Best regards,<br/>The AI Career Guider Team</p>
            `;
        } else if (fullName) {
            // --- Welcome Email ---
            subject = "Welcome to AI Career Guider!";
            textContent = `Hi ${fullName},\n\nWelcome aboard!\n\nAI Career Guider is your personal AI mentor designed to help you:\n* Analyze your skills against desired career paths.\n* Generate personalized learning roadmaps.\n* Track your progress with AI-powered quizzes.\n* Get recommendations for your next learning steps.\n\nLog in now to start exploring your potential!\n\nBest regards,\nThe AI Career Guider Team`;
            htmlContent = `
                <p>Hi ${fullName},</p>
                <p>Welcome aboard!</p>
                <p><strong>AI Career Guider</strong> is your personal AI mentor designed to help you:</p>
                <ul>
                    <li>Analyze your skills against desired career paths.</li>
                    <li>Generate personalized learning roadmaps with resources.</li>
                    <li>Track your progress with AI-powered quizzes.</li>
                    <li>Get recommendations for your next learning steps.</li>
                </ul>
                <p>Log in now to start exploring your potential!</p>
                <br/>
                <p>Best regards,<br/>The AI Career Guider Team</p>
            `;
        } else {
            console.error("Required data (OTP or Full Name) missing for email type.");
            process.exit(1);
        }

        // --- Create Transporter (No change needed) ---
        let transporter = nodemailer.createTransport({
            service: "gmail",
            auth: {
                 user: "kksreedharan63@gmail.com", // Your Gmail
                 pass: "uqex zpbr xqzr xqlw",    // Your Gmail App Password
            },
            // Optional: Add TLS options for robustness if needed
            tls: {
                rejectUnauthorized: false
            }
        });

        // --- Send Mail ---
        let info = await transporter.sendMail({
            from: '"AI Career Guider" <kksreedharan63@gmail.com>', // Use your actual email here too
            to: email,
            subject: subject,
            text: textContent, // Plain text version
            html: htmlContent, // HTML version
        });

        console.log("✅ Email sent:", info.messageId, "Type:", otp ? "OTP" : "Welcome");
        process.exit(0);

    } catch (err) {
        // Log the specific error for better debugging
        console.error("❌ Mailer error:", err.message);
        if(err.code) console.error("Error Code:", err.code);
        if(err.command) console.error("Command:", err.command);
        process.exit(1);
    }
});
