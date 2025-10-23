const nodemailer = require("nodemailer");

// Read input from stdin (Flask will pass JSON)
let input = "";
process.stdin.on("data", chunk => input += chunk);
process.stdin.on("end", async () => {
  try {
    const { email, otp } = JSON.parse(input);

    if (!email || !otp) {
      console.error("Email or OTP missing");
      process.exit(1);
    }

    // Create transporter using Gmail (App Password required)
    let transporter = nodemailer.createTransport({
      service: "gmail",
      auth: {
        user: "kksreedharan63@gmail.com",   // 🔹 replace with your Gmail
        pass: "uqex zpbr xqzr xqlw",     // 🔹 replace with Gmail App Password
      },
    });

    // Send mail
    let info = await transporter.sendMail({
      from: '"AI Career Predictor" <yourgmail@gmail.com>',
      to: email,
      subject: "Your OTP Code",
      text: `Your OTP code is ${otp} ,valid for 5 minutes`,
    });

    console.log("✅ OTP sent:", info.messageId);
    process.exit(0);

  } catch (err) {
    console.error("❌ Mailer error:", err);
    process.exit(1);
  }
});
