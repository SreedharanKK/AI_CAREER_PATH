-- MySQL dump 10.13  Distrib 8.0.41, for Win64 (x86_64)
--
-- Host: localhost    Database: project_ai
-- ------------------------------------------------------
-- Server version	8.0.41

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `extract_skills`
--

DROP TABLE IF EXISTS `extract_skills`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `extract_skills` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `skills` json DEFAULT NULL,
  `extracted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `extract_skills_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=10 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `extract_skills`
--

LOCK TABLES `extract_skills` WRITE;
/*!40000 ALTER TABLE `extract_skills` DISABLE KEYS */;
INSERT INTO `extract_skills` VALUES (9,1,'[\"Java\", \"Python\", \"MYSQL\", \"HTML\", \"CSS\", \"MongoDB\"]','2025-10-12 09:04:07');
/*!40000 ALTER TABLE `extract_skills` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `job_recommendations`
--

DROP TABLE IF EXISTS `job_recommendations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `job_recommendations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `domain` varchar(255) NOT NULL,
  `recommendations` json DEFAULT NULL,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `job_recommendations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `job_recommendations`
--

LOCK TABLES `job_recommendations` WRITE;
/*!40000 ALTER TABLE `job_recommendations` DISABLE KEYS */;
/*!40000 ALTER TABLE `job_recommendations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `learning_recommendations`
--

DROP TABLE IF EXISTS `learning_recommendations`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `learning_recommendations` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `degree` varchar(255) DEFAULT NULL,
  `stream` varchar(255) DEFAULT NULL,
  `recommendations` json DEFAULT NULL,
  `generated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`),
  CONSTRAINT `learning_recommendations_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `learning_recommendations`
--

LOCK TABLES `learning_recommendations` WRITE;
/*!40000 ALTER TABLE `learning_recommendations` DISABLE KEYS */;
INSERT INTO `learning_recommendations` VALUES (1,1,'BE','CSE','[{\"topic\": \"Artificial Intelligence & Machine Learning Engineering\", \"future_scope\": \"Will become a specialized-yet-core competency. Focus will shift from model building to MLOps (deploying, monitoring, and maintaining ML models in production) and specialized areas like Generative AI, Reinforcement Learning, and Edge AI.\", \"project_idea\": \"Build and deploy a web application that takes an image of a handwritten digit and predicts the number using a trained model (like MNIST). Deploy it using a simple framework like Flask or FastAPI.\", \"current_scope\": \"Extremely high demand across product-based companies (Google, Microsoft), startups, and large Indian IT services firms (TCS, Infosys) for roles like ML Engineer and Data Scientist. A strong foundation in CSE is a huge advantage.\", \"estimated_time\": \"3-4 months\", \"getting_started\": \"Complete Andrew Ng\'s \'Machine Learning Specialization\' on Coursera. Simultaneously, practice on Kaggle\'s beginner competitions like the Titanic dataset to apply theoretical knowledge.\", \"skills_to_learn\": [\"Python (NumPy, Pandas, Scikit-learn)\", \"TensorFlow/PyTorch\", \"SQL\", \"Statistics & Probability\", \"MLOps basics (e.g., MLflow)\"], \"interview_question\": \"Explain the concepts of bias and variance in machine learning. What is the bias-variance tradeoff and how do you manage it?\"}, {\"topic\": \"Full-Stack Web Development (MERN Stack)\", \"future_scope\": \"The stack will evolve (e.g., with frameworks like Next.js for server-side rendering or GraphQL over REST), but the core principles of building scalable client-server applications will remain. Expertise in state management and performance optimization will be a key differentiator.\", \"project_idea\": \"Develop a clone of a popular application like a simple blog, an e-commerce product listing page, or a movie review site. Implement user authentication, CRUD operations, and deploy it on a service like Vercel or Heroku.\", \"current_scope\": \"The most common and consistently high-demand role in the Indian IT market, from startups to large MNCs. Companies need developers who can build end-to-end features. A strong portfolio with live projects is key to landing interviews.\", \"estimated_time\": \"2-3 months\", \"getting_started\": \"Build a simple To-Do List application. Start with the frontend using React, then build a Node.js/Express.js backend API to handle the data, and finally connect it to a MongoDB database.\", \"skills_to_learn\": [\"MongoDB\", \"Express.js\", \"React.js\", \"Node.js\", \"RESTful APIs\", \"Git\", \"HTML/CSS/JavaScript (ES6+)\"], \"interview_question\": \"What is the event loop in Node.js? How does it handle asynchronous operations without multi-threading?\"}, {\"topic\": \"Cloud-Native DevOps\", \"future_scope\": \"Will become a standard skill expected of all senior developers. The future is in GitOps, serverless computing, and platform engineering, where DevOps principles are used to build internal developer platforms.\", \"project_idea\": \"Take a web application you\'ve already built (e.g., a simple Node.js app), containerize it with Docker, and write a GitHub Actions workflow that automatically builds the Docker image and pushes it to Docker Hub on every commit.\", \"current_scope\": \"Massive skill gap in the Indian market. Every company moving to the cloud needs DevOps engineers to automate infrastructure and improve deployment frequency. Often offers higher starting salaries than pure development roles.\", \"estimated_time\": \"4-6 weeks\", \"getting_started\": \"Get a free-tier account on AWS. Learn to launch a simple EC2 instance (a virtual server) and deploy a basic web server (like Nginx) on it manually. Then, learn to do the same thing using Docker.\", \"skills_to_learn\": [\"Docker\", \"Kubernetes\", \"CI/CD (GitHub Actions/Jenkins)\", \"AWS/Azure/GCP (core services like EC2, S3, IAM)\", \"Terraform/IaC\"], \"interview_question\": \"Explain the difference between a Docker container and a virtual machine. When would you use one over the other?\"}, {\"topic\": \"Cybersecurity & Application Security\", \"future_scope\": \"The focus will move from reactive penetration testing to proactive \'DevSecOps\' - integrating security into the entire software development lifecycle. Expertise in cloud security (securing AWS/Azure environments) and AI in security will be highly valuable.\", \"project_idea\": \"Write a Python script that scans a list of subdomains for a given domain and checks for common misconfigurations, like open ports or expired SSL certificates. Document your findings in a professional report format.\", \"current_scope\": \"Rapidly growing field in India due to increased digitization and data privacy regulations. Banks, fintech companies, e-commerce giants, and consulting firms are actively hiring for roles like Security Analyst, Penetration Tester, and Application Security Engineer.\", \"estimated_time\": \"3-4 months\", \"getting_started\": \"Start by learning the OWASP Top 10 vulnerabilities. Set up a vulnerable web application like \'OWASP Juice Shop\' locally and practice identifying and exploiting common flaws like SQL Injection and XSS.\", \"skills_to_learn\": [\"OWASP Top 10\", \"Linux Fundamentals\", \"Networking Concepts (TCP/IP, DNS)\", \"Python for scripting\", \"Burp Suite / OWASP ZAP\", \"Secure Coding Practices\"], \"interview_question\": \"Describe a Cross-Site Scripting (XSS) attack. What are the different types (Stored, Reflected, DOM-based), and how can you prevent them in code?\"}]','2025-10-11 15:32:40');
/*!40000 ALTER TABLE `learning_recommendations` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `quiz_history`
--

DROP TABLE IF EXISTS `quiz_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `quiz_history` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `progress_id` int NOT NULL,
  `quiz_title` varchar(255) NOT NULL,
  `score` decimal(5,2) NOT NULL,
  `passed` tinyint(1) NOT NULL,
  `attempted_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `quiz_data` json DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  KEY `progress_id` (`progress_id`),
  CONSTRAINT `quiz_history_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`) ON DELETE CASCADE,
  CONSTRAINT `quiz_history_ibfk_2` FOREIGN KEY (`progress_id`) REFERENCES `user_roadmap_progress` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `quiz_history`
--

LOCK TABLES `quiz_history` WRITE;
/*!40000 ALTER TABLE `quiz_history` DISABLE KEYS */;
INSERT INTO `quiz_history` VALUES (1,1,1,'Quiz: How the Internet Works',94.74,1,'2025-10-11 10:05:41','[{\"question\": \"In the client-server model, which entity is typically responsible for initiating a request for a web page?\", \"is_correct\": true, \"user_answer\": \"The Client (e.g., a web browser)\", \"correct_answer\": \"The Client (e.g., a web browser)\"}, {\"question\": \"What is the primary function of the Domain Name System (DNS)?\", \"is_correct\": true, \"user_answer\": \"To translate human-readable domain names into IP addresses.\", \"correct_answer\": \"To translate human-readable domain names into IP addresses.\"}, {\"question\": \"What does DNS stand for?\", \"is_correct\": true, \"user_answer\": \"domain name system\", \"correct_answer\": \"Domain Name System\"}, {\"question\": \"What is the primary difference between HTTP and HTTPS?\", \"is_correct\": true, \"user_answer\": \"HTTPS uses an encryption layer for secure communication.\", \"correct_answer\": \"HTTPS uses an encryption layer for secure communication.\"}, {\"question\": \"What does HTTP stand for?\", \"is_correct\": false, \"user_answer\": \"hyper text transfer protocol\", \"correct_answer\": \"Hypertext Transfer Protocol\"}, {\"question\": \"Which HTTP method is designed to request data from a specified resource without altering it?\", \"is_correct\": true, \"user_answer\": \"GET\", \"correct_answer\": \"GET\"}, {\"question\": \"What common HTTP status code indicates that a request was successful?\", \"is_correct\": true, \"user_answer\": \"200\", \"correct_answer\": \"200 (or 200 OK)\"}, {\"question\": \"In the URL `https://www.example.com/products`, what does `/products` represent?\", \"is_correct\": true, \"user_answer\": \"The path to the resource\", \"correct_answer\": \"The path to the resource\"}, {\"question\": \"What unique numerical label is assigned to each device connected to a computer network that uses the Internet Protocol for communication?\", \"is_correct\": true, \"user_answer\": \"ip address\", \"correct_answer\": \"IP Address (Internet Protocol Address)\"}, {\"question\": \"What is the name of the process that establishes a reliable connection between a client and server before data is transferred using TCP?\", \"is_correct\": true, \"user_answer\": \"TCP Three-Way Handshake\", \"correct_answer\": \"TCP Three-Way Handshake\"}, {\"question\": \"What is the common term for a computer that stores website files and makes them available to clients on the internet?\", \"is_correct\": true, \"user_answer\": \"web server\", \"correct_answer\": \"Web Server (or Server)\"}, {\"question\": \"Which technology is responsible for the \'S\' (Secure) in HTTPS, providing encryption, authentication, and integrity?\", \"is_correct\": true, \"user_answer\": \"TLS (or its predecessor, SSL)\", \"correct_answer\": \"TLS (or its predecessor, SSL)\"}, {\"question\": \"What common HTTP status code is returned when a requested resource could not be found on the server?\", \"is_correct\": true, \"user_answer\": \"404\", \"correct_answer\": \"404 (or 404 Not Found)\"}, {\"question\": \"After a browser receives HTML, CSS, and JavaScript files from a server, what is the final major step it performs to display the webpage?\", \"is_correct\": true, \"user_answer\": \"Rendering the page\", \"correct_answer\": \"Rendering the page\"}, {\"question\": \"By default, on which port number does a web server listen for unencrypted HTTP requests?\", \"is_correct\": true, \"user_answer\": \"80\", \"correct_answer\": \"80\"}, {\"question\": \"By default, on which port number does a web server listen for encrypted HTTPS requests?\", \"is_correct\": true, \"user_answer\": \"443\", \"correct_answer\": \"443\"}, {\"question\": \"What is a small unit of data routed between an origin and a destination on the Internet called?\", \"is_correct\": true, \"user_answer\": \"packet\", \"correct_answer\": \"Packet\"}, {\"question\": \"Which part of an HTTP message contains metadata about the request, such as the browser type (User-Agent) or the content type being sent?\", \"is_correct\": true, \"user_answer\": \"The Headers\", \"correct_answer\": \"The Headers\"}, {\"question\": \"Given the URL `https://api.example.com/search?q=networking`, represent its main components (protocol, hostname, path, and query) in a JSON object format.\", \"is_correct\": true, \"user_answer\": \"{\\n  \\\"protocol\\\": \\\"https\\\",\\n  \\\"hostname\\\": \\\"api.example.com\\\",\\n  \\\"path\\\": \\\"/search\\\",\\n  \\\"query\\\": \\\"q=networking\\\"\\n}\\n\", \"correct_answer\": \"{\\n  \\\"protocol\\\": \\\"https\\\",\\n  \\\"hostname\\\": \\\"api.example.com\\\",\\n  \\\"path\\\": \\\"/search\\\",\\n  \\\"query\\\": \\\"q=networking\\\"\\n}\"}]'),(2,1,2,'Quiz for Learn HTML Basics',89.47,1,'2025-10-12 07:06:11','[{\"question\": \"What does HTML stand for?\", \"is_correct\": true, \"user_answer\": \"HyperText Markup Language\", \"correct_answer\": \"HyperText Markup Language\"}, {\"question\": \"What is the primary function of HTML?\", \"is_correct\": true, \"user_answer\": \"To define the structure and content of a web page.\", \"correct_answer\": \"To define the structure and content of a web page.\"}, {\"question\": \"What is the standard file extension for an HTML file?\", \"is_correct\": true, \"user_answer\": \".html\", \"correct_answer\": \".html\"}, {\"question\": \"Write the basic boilerplate structure for an HTML5 document, including the doctype, html, head, title, and body tags.\", \"is_correct\": false, \"user_answer\": \"<!DOCTYPE html>\\n<html lang=\\\"en\\\">\\n<head>\\n  <meta charset=\\\"UTF-8\\\">\\n  <meta name=\\\"viewport\\\" content=\\\"width=device-width, initial-scale=1.0\\\">\\n  <title>Document Title</title>\\n</head>\\n<body>\\n  <h1>Hello, World!</h1>\\n  <p>This is a basic HTML5 document structure.</p>\\n</body>\\n</html>\\n\", \"correct_answer\": \"<!DOCTYPE html>\\n<html>\\n<head>\\n  <title>Page Title</title>\\n</head>\\n<body>\\n\\n</body>\\n</html>\"}, {\"question\": \"Which HTML element contains all the visible content of a web page?\", \"is_correct\": true, \"user_answer\": \"<body>\", \"correct_answer\": \"<body>\"}, {\"question\": \"Write the HTML code to create a top-level heading with the text \'Welcome to My Website\'.\", \"is_correct\": true, \"user_answer\": \"<h1>Welcome to My Website</h1>\\n\", \"correct_answer\": \"<h1>Welcome to My Website</h1>\"}, {\"question\": \"What is an element that does not have a closing tag (e.g., `<br>`, `<img>`) often called?\", \"is_correct\": false, \"user_answer\": \"void element\", \"correct_answer\": \"An empty element (or self-closing tag)\"}, {\"question\": \"Which tag is used to create a hyperlink?\", \"is_correct\": true, \"user_answer\": \"<a>\", \"correct_answer\": \"<a>\"}, {\"question\": \"Write the HTML for a hyperlink that displays the text \'Visit Mozilla\' and links to \'https://www.mozilla.org/\'.\", \"is_correct\": true, \"user_answer\": \"<a href=\\\"https://www.mozilla.org/\\\">Visit Mozilla</a>\\n\", \"correct_answer\": \"<a href=\\\"https://www.mozilla.org/\\\">Visit Mozilla</a>\"}, {\"question\": \"What is the purpose of the \'alt\' attribute in an `<img>` tag?\", \"is_correct\": true, \"user_answer\": \"It provides alternative text for screen readers and if the image fails to load.\", \"correct_answer\": \"It provides alternative text for screen readers and if the image fails to load.\"}, {\"question\": \"Write the HTML to display an image located at the path \'images/logo.png\'. The alternative text should be \'Company Logo\'.\", \"is_correct\": true, \"user_answer\": \"<img src=\\\"images/logo.png\\\" alt=\\\"Company Logo\\\">\\n\", \"correct_answer\": \"<img src=\\\"images/logo.png\\\" alt=\\\"Company Logo\\\">\"}, {\"question\": \"Which tag is used to create an unordered (bulleted) list?\", \"is_correct\": true, \"user_answer\": \"<ul>\", \"correct_answer\": \"<ul>\"}, {\"question\": \"Write the HTML for an unordered list with three items: \'Coffee\', \'Tea\', and \'Milk\'.\", \"is_correct\": true, \"user_answer\": \"<ul>\\n  <li>Coffee</li>\\n  <li>Tea</li>\\n  <li>Milk</li>\\n</ul>\\n\", \"correct_answer\": \"<ul>\\n  <li>Coffee</li>\\n  <li>Tea</li>\\n  <li>Milk</li>\\n</ul>\"}, {\"question\": \"Which tag is used for the items inside both ordered and unordered lists?\", \"is_correct\": true, \"user_answer\": \"<li>\", \"correct_answer\": \"<li>\"}, {\"question\": \"What is the correct syntax for an HTML comment?\", \"is_correct\": true, \"user_answer\": \"<!-- This is a comment -->\", \"correct_answer\": \"<!-- This is a comment -->\"}, {\"question\": \"Which element defines the title of the document, which is displayed in the browser\'s title bar or tab?\", \"is_correct\": true, \"user_answer\": \"<title>\", \"correct_answer\": \"<title>\"}, {\"question\": \"Write the HTML for an ordered (numbered) list of three steps: \'Wake up\', \'Brush teeth\', \'Eat breakfast\'.\", \"is_correct\": true, \"user_answer\": \"<ol>\\n  <li>Wake up</li>\\n  <li>Brush teeth</li>\\n  <li>Eat breakfast</li>\\n</ol>\\n\", \"correct_answer\": \"<ol>\\n  <li>Wake up</li>\\n  <li>Brush teeth</li>\\n  <li>Eat breakfast</li>\\n</ol>\"}, {\"question\": \"In an anchor tag `<a>`, what does the `href` attribute specify?\", \"is_correct\": true, \"user_answer\": \"url of the page\", \"correct_answer\": \"The URL of the page the link goes to (the hyperlink reference)\"}, {\"question\": \"Which tag represents a paragraph of text?\", \"is_correct\": true, \"user_answer\": \"<p>\", \"correct_answer\": \"<p>\"}]');
/*!40000 ALTER TABLE `quiz_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `roadmaps`
--

DROP TABLE IF EXISTS `roadmaps`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `roadmaps` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `domain` varchar(255) NOT NULL,
  `roadmap` json DEFAULT (json_array()),
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `roadmaps_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `roadmaps`
--

LOCK TABLES `roadmaps` WRITE;
/*!40000 ALTER TABLE `roadmaps` DISABLE KEYS */;
INSERT INTO `roadmaps` VALUES (2,1,'Frontend Developer','{\"roadmap\": [{\"steps\": [{\"title\": \"How the Internet Works\", \"study_link\": \"https://developer.mozilla.org/en-US/docs/Learn/Common_questions/How_does_the_Internet_work\", \"description\": \"Understand the fundamental client-server model, HTTP/HTTPS, and what happens when you type a URL into a browser.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Learn HTML Basics\", \"study_link\": \"https://www.youtube.com/watch?v=kUMe1FH4CHE\", \"description\": \"HTML (HyperText Markup Language) is the skeleton of every web page, defining its structure and content.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"Semantic HTML\", \"study_link\": \"https://developer.mozilla.org/en-US/docs/Web/HTML/Semantic_HTML\", \"description\": \"Learn to use HTML elements according to their meaning, which improves accessibility and SEO.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Learn CSS Basics\", \"study_link\": \"https://www.youtube.com/watch?v=1Rs2ND1ryYc\", \"description\": \"CSS (Cascading Style Sheets) is used to style the HTML, controlling colors, fonts, layout, and more.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"The CSS Box Model\", \"study_link\": \"https://developer.mozilla.org/en-US/docs/Learn/CSS/Building_blocks/The_box_model\", \"description\": \"Understand the core CSS concept of how every element is a rectangular box with margin, border, padding, and content.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Project: Build a Personal Portfolio Page\", \"study_link\": \"https://www.freecodecamp.org/learn/responsive-web-design/responsive-web-design-projects/build-a-personal-portfolio-webpage\", \"description\": \"Apply your new HTML and CSS skills by building a multi-section portfolio page to showcase your work.\", \"resource_type\": \"Project Idea\"}, {\"title\": \"Learn JavaScript Basics\", \"study_link\": \"https://www.youtube.com/watch?v=PkZNo7MFNFg\", \"description\": \"JavaScript makes web pages interactive, handling everything from user input to dynamic content updates.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"DOM Manipulation\", \"study_link\": \"https://www.freecodecamp.org/learn/javascript-algorithms-and-data-structures/basic-javascript/\", \"description\": \"Learn how to use JavaScript to interact with and change the structure, style, and content of a web page.\", \"resource_type\": \"Interactive Course\"}, {\"title\": \"Version Control with Git & GitHub\", \"study_link\": \"https://www.youtube.com/watch?v=RGOj5yH7evk\", \"description\": \"Git is an essential tool for tracking changes in your code, and GitHub is where you\'ll host your projects and collaborate.\", \"resource_type\": \"Video Tutorial\"}], \"stage_title\": \"Stage 1: The Absolute Foundations\"}, {\"steps\": [{\"title\": \"CSS Flexbox\", \"study_link\": \"https://css-tricks.com/snippets/css/a-guide-to-flexbox/\", \"description\": \"Master this one-dimensional layout model for creating complex, flexible, and responsive page layouts.\", \"resource_type\": \"Documentation\"}, {\"title\": \"CSS Grid\", \"study_link\": \"https://css-tricks.com/snippets/css/complete-guide-grid/\", \"description\": \"Learn the two-dimensional layout system, perfect for grid-based UIs like galleries and full-page layouts.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Responsive Design & Media Queries\", \"study_link\": \"https://www.youtube.com/watch?v=VQutGk9ur6g\", \"description\": \"Ensure your websites look great on all devices, from mobile phones to desktops, using media queries.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"CSS Variables\", \"study_link\": \"https://developer.mozilla.org/en-US/docs/Web/CSS/Using_CSS_custom_properties\", \"description\": \"Make your CSS more maintainable and powerful by using variables for colors, fonts, and sizes.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Sass/SCSS\", \"study_link\": \"https://www.youtube.com/watch?v=Zz6eOVaL23I\", \"description\": \"Learn a CSS pre-processor to add features like variables, nesting, and mixins to your CSS workflow.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"Introduction to Tailwind CSS\", \"study_link\": \"https://www.youtube.com/watch?v=dFgzHOX84xQ\", \"description\": \"Explore the popular utility-first CSS framework for rapidly building modern user interfaces.\", \"resource_type\": \"Video Tutorial\"}], \"stage_title\": \"Stage 2: Mastering CSS & Design\"}, {\"steps\": [{\"title\": \"Modern JavaScript (ES6+)\", \"study_link\": \"https://www.javascripttutorial.net/es6/\", \"description\": \"Learn modern syntax and features like let/const, arrow functions, destructuring, and template literals.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Asynchronous JavaScript (Promises)\", \"study_link\": \"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Using_promises\", \"description\": \"Understand how to handle operations that take time, like fetching data, without blocking the main thread.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Async/Await\", \"study_link\": \"https://www.youtube.com/watch?v=V_Kr9OSfDeU\", \"description\": \"Master the modern syntax for writing cleaner, more readable asynchronous code on top of Promises.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"Working with APIs (Fetch API)\", \"study_link\": \"https://www.youtube.com/watch?v=cuEtnrL9-H0\", \"description\": \"Learn how to request data from servers and APIs to make your web applications dynamic and data-driven.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"JavaScript Modules (import/export)\", \"study_link\": \"https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules\", \"description\": \"Organize your code into reusable and maintainable files using the native module system.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Project: Build a Weather App\", \"study_link\": \"https://www.freecodecamp.org/news/how-to-build-a-weather-app-in-javascript/\", \"description\": \"Solidify your asynchronous JS skills by building an application that fetches and displays data from a third-party API.\", \"resource_type\": \"Project Idea\"}], \"stage_title\": \"Stage 3: Deep Dive into JavaScript\"}, {\"steps\": [{\"title\": \"Learn React.js\", \"study_link\": \"https://react.dev/learn\", \"description\": \"Master the most popular frontend library for building component-based, interactive user interfaces.\", \"resource_type\": \"Interactive Course\"}, {\"title\": \"React Hooks (useState, useEffect)\", \"study_link\": \"https://react.dev/reference/react/useState\", \"description\": \"Understand the core React Hooks for managing component state and side effects.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Client-Side Routing with React Router\", \"study_link\": \"https://reactrouter.com/en/main/start/tutorial\", \"description\": \"Learn to create multi-page applications within a single-page app architecture using this standard library.\", \"resource_type\": \"Documentation\"}, {\"title\": \"State Management with Zustand\", \"study_link\": \"https://www.youtube.com/watch?v=pnh-jCvC_sA\", \"description\": \"Learn a simple, modern state management solution to handle complex application state without the boilerplate of Redux.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"Data Fetching with TanStack Query (React Query)\", \"study_link\": \"https://www.youtube.com/watch?v=r8Dg0cMYa_o\", \"description\": \"Manage server-state in your app with this powerful library that handles caching, background updates, and more.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"Project: Build a Movie Database App\", \"study_link\": \"https://www.freecodecamp.org/news/how-to-build-a-movie-search-app-using-react-hooks/\", \"description\": \"Combine React, routing, and API calls to build a feature-rich application where users can search for and view movie details.\", \"resource_type\": \"Project Idea\"}], \"stage_title\": \"Stage 4: Choosing a Modern Framework\"}, {\"steps\": [{\"title\": \"Package Managers (npm & yarn)\", \"study_link\": \"https://docs.npmjs.com/about-npm\", \"description\": \"Learn to manage project dependencies and run scripts using the standard package managers for the JavaScript ecosystem.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Build Tools (Vite)\", \"study_link\": \"https://vitejs.dev/guide/\", \"description\": \"Understand modern frontend build tooling for lightning-fast development servers and optimized production builds.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Linting & Formatting (ESLint & Prettier)\", \"study_link\": \"https://www.youtube.com/watch?v=SydnKbGcAwA\", \"description\": \"Automate code quality checks and enforce a consistent code style across your projects.\", \"resource_type\": \"Video Tutorial\"}, {\"title\": \"Testing with Jest & React Testing Library\", \"study_link\": \"https://testing-library.com/docs/react-testing-library/intro/\", \"description\": \"Learn to write unit and integration tests for your components to ensure your application is robust and bug-free.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Web Accessibility (WCAG)\", \"study_link\": \"https://www.w3.org/WAI/fundamentals/accessibility-intro/\", \"description\": \"Learn the principles of building websites that are usable by everyone, including people with disabilities.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Mastering Browser DevTools\", \"study_link\": \"https://developer.chrome.com/docs/devtools/\", \"description\": \"Become proficient with your browser\'s developer tools for debugging, performance analysis, and network inspection.\", \"resource_type\": \"Documentation\"}], \"stage_title\": \"Stage 5: Tooling & Professional Practices\"}, {\"steps\": [{\"title\": \"TypeScript\", \"study_link\": \"https://www.typescriptlang.org/docs/handbook/typescript-for-javascript-programmers.html\", \"description\": \"Add static types to JavaScript to catch errors early, improve code quality, and enhance developer experience.\", \"resource_type\": \"Book\"}, {\"title\": \"Web Performance & Core Web Vitals\", \"study_link\": \"https://web.dev/vitals/\", \"description\": \"Learn how to measure and optimize your website\'s performance based on user-centric metrics like LCP, FID, and CLS.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Progressive Web Apps (PWAs)\", \"study_link\": \"https://web.dev/progressive-web-apps/\", \"description\": \"Learn how to build web apps that can be \'installed\' on a user\'s device and offer an app-like experience with offline capabilities.\", \"resource_type\": \"Documentation\"}, {\"title\": \"GraphQL (Client-Side with Apollo)\", \"study_link\": \"https://www.apollographql.com/docs/react/\", \"description\": \"Explore a modern alternative to REST APIs that allows clients to request exactly the data they need.\", \"resource_type\": \"Documentation\"}, {\"title\": \"Learn a Meta-Framework (Next.js)\", \"study_link\": \"https://nextjs.org/learn\", \"description\": \"Build production-grade, full-stack React applications with features like server-side rendering and static site generation.\", \"resource_type\": \"Interactive Course\"}], \"stage_title\": \"Stage 6: Advanced Topics & Specializations\"}]}','2025-10-10 17:15:41');
/*!40000 ALTER TABLE `roadmaps` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `skill_gap_analysis`
--

DROP TABLE IF EXISTS `skill_gap_analysis`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `skill_gap_analysis` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `current_skills` text,
  `interested_domain` varchar(255) DEFAULT NULL,
  `missing_skills` text,
  `recommended_courses` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `skill_gap_analysis_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=6 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `skill_gap_analysis`
--

LOCK TABLES `skill_gap_analysis` WRITE;
/*!40000 ALTER TABLE `skill_gap_analysis` DISABLE KEYS */;
INSERT INTO `skill_gap_analysis` VALUES (3,1,'[\"MYSQL\", \"HTML\", \"MongoDB\", \"CSS\", \"Python\", \"Java\"]','AI/ML','[\"Data Manipulation and Analysis (Pandas, NumPy)\", \"Machine Learning Fundamentals and Scikit-learn\", \"Deep Learning Frameworks (PyTorch or TensorFlow)\", \"Data Visualization (Matplotlib, Seaborn)\", \"Model Deployment and MLOps Basics (FastAPI/Flask, Docker)\", \"Foundational Math and Statistics for ML (Linear Algebra, Probability)\"]','[\"Complete the \'Data Scientist with Python\' career track on DataCamp, which heavily focuses on Pandas and NumPy for data manipulation and analysis.\", \"Work through the official Scikit-learn user guide and tutorials. Build a project predicting house prices (regression) and another classifying handwritten digits using the MNIST dataset (classification).\", \"Choose one deep learning framework to start. For a practical approach, complete the \'DeepLearning.AI TensorFlow Developer Professional Certificate\' on Coursera or the \'Deep Learning with PyTorch\' nanodegree on Udacity.\", \"Learn to perform Exploratory Data Analysis (EDA) on a real-world dataset from Kaggle. Use Matplotlib and Seaborn to create visualizations that uncover patterns and insights in the data.\", \"Train a simple Scikit-learn model and then build a REST API for it using FastAPI. Finally, containerize the entire application using Docker to understand the basics of model deployment.\", \"Reinforce your mathematical foundations by taking the \'Mathematics for Machine Learning\' specialization on Coursera or by reviewing Linear Algebra and Statistics courses on Khan Academy.\"]','2025-10-09 07:52:22'),(4,1,'[\"HTML\", \"Java\", \"MYSQL\", \"Python\", \"CSS\", \"MongoDB\"]','Web Development','[\"JavaScript\", \"React\", \"Node.js & Express\", \"Git\", \"Docker\"]','[\"Build an interactive quiz or a simple calculator using vanilla JavaScript to master DOM manipulation.\", \"Create a To-Do List application to learn React\'s core concepts like components, state, and props.\", \"Develop a basic REST API for a blog using Node.js and Express to handle data for a front-end application.\", \"Manage all your new learning projects by creating a GitHub repository and practicing the add, commit, and push workflow.\", \"Containerize a simple \'Hello World\' application (using Python or Node.js) with a Dockerfile to learn the basics of deployment.\"]','2025-10-10 16:01:46'),(5,1,'[\"HTML\", \"Java\", \"MYSQL\", \"Python\", \"CSS\", \"MongoDB\"]','Frontend Developer','[\"JavaScript\", \"React\", \"Git\", \"TypeScript\", \"Responsive Design\", \"REST APIs\"]','[\"Build an interactive calculator or a simple browser game using vanilla JavaScript to master DOM manipulation.\", \"Create a personal portfolio website or a recipe finder application using React to learn about components and state management.\", \"Start tracking all your personal coding projects with Git and push them to a public GitHub repository.\", \"Convert a small JavaScript project to TypeScript to understand the benefits of static typing for preventing errors.\", \"Recreate a simple product landing page and ensure it looks great on mobile, tablet, and desktop screens using CSS Flexbox and Grid.\", \"Develop a simple weather application that fetches and displays data from a free public API to practice asynchronous requests.\"]','2025-10-10 16:14:52');
/*!40000 ALTER TABLE `skill_gap_analysis` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_details`
--

DROP TABLE IF EXISTS `user_details`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_details` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `dob` date DEFAULT NULL,
  `place` varchar(100) DEFAULT NULL,
  `degree` varchar(100) DEFAULT NULL,
  `stream` varchar(100) DEFAULT NULL,
  `skills` text,
  `domain` varchar(100) DEFAULT NULL,
  `college` varchar(150) DEFAULT NULL,
  `year` varchar(10) DEFAULT NULL,
  `resume_path` varchar(255) DEFAULT NULL,
  `extracted_path` varchar(255) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `user_id` (`user_id`),
  CONSTRAINT `user_details_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_details`
--

LOCK TABLES `user_details` WRITE;
/*!40000 ALTER TABLE `user_details` DISABLE KEYS */;
INSERT INTO `user_details` VALUES (1,1,'2004-11-22','Namakkal','BE','CSE','[\"HTML\",\"CSS\",\"JAVA\"]','[\"FULLSTACK\"]','MAHENDRA ENGINEERING COLLEGE','final','uploads/resumes/1_SreedharanKK-Mahendra_Engineering_College.pdf','uploads/extracted/1_SreedharanKK-Mahendra_Engineering_College_extracted.txt'),(2,4,'2006-07-18','KARUR','BE','CYBER','[\"HTML\",\"CSS\",\"JAVA\",\"PYTHON\",\"JS\"]','[\"DATA ANALYST\"]','MAHENDRA ENGINEERING COLLEGE','3',NULL,NULL);
/*!40000 ALTER TABLE `user_details` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `user_roadmap_progress`
--

DROP TABLE IF EXISTS `user_roadmap_progress`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `user_roadmap_progress` (
  `id` int NOT NULL AUTO_INCREMENT,
  `user_id` int NOT NULL,
  `roadmap_id` int NOT NULL,
  `stage_index` int NOT NULL,
  `step_index` int NOT NULL,
  `is_unlocked` tinyint(1) DEFAULT '0',
  `is_completed` tinyint(1) DEFAULT '0',
  `test_score` int DEFAULT NULL,
  `completed_at` timestamp NULL DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `user_id` (`user_id`,`roadmap_id`,`stage_index`,`step_index`),
  KEY `roadmap_id` (`roadmap_id`),
  CONSTRAINT `user_roadmap_progress_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `users_auth` (`id`) ON DELETE CASCADE,
  CONSTRAINT `user_roadmap_progress_ibfk_2` FOREIGN KEY (`roadmap_id`) REFERENCES `roadmaps` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `user_roadmap_progress`
--

LOCK TABLES `user_roadmap_progress` WRITE;
/*!40000 ALTER TABLE `user_roadmap_progress` DISABLE KEYS */;
INSERT INTO `user_roadmap_progress` VALUES (1,1,2,0,0,1,1,95,'2025-10-11 10:05:41'),(2,1,2,0,1,1,1,89,'2025-10-12 07:06:11'),(3,1,2,0,2,1,0,NULL,NULL);
/*!40000 ALTER TABLE `user_roadmap_progress` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `users_auth`
--

DROP TABLE IF EXISTS `users_auth`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `users_auth` (
  `id` int NOT NULL AUTO_INCREMENT,
  `full_name` varchar(100) NOT NULL,
  `email` varchar(100) NOT NULL,
  `password` varchar(255) NOT NULL,
  `otp` varchar(6) DEFAULT NULL,
  `otp_expiry` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`)
) ENGINE=InnoDB AUTO_INCREMENT=5 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `users_auth`
--

LOCK TABLES `users_auth` WRITE;
/*!40000 ALTER TABLE `users_auth` DISABLE KEYS */;
INSERT INTO `users_auth` VALUES (1,'Sreedharan K K','sreedharan20043255@gmail.com','scrypt:32768:8:1$sedXIyjX7vxkILlh$2cad88b5af92a77e3e92c8b54fb7d3bf479f26aefac952ca51eeaa1edc1590d87ea96bc473a62652e9d67a6f0daee8db9ac850dfa71bbf28c447c4d5fb01442c',NULL,NULL),(2,'Vetrivel K','vetrivel8742@gmail.com','scrypt:32768:8:1$9ciqP1XcJpgUfosL$d2edc005904bc170df48bd1f167618d13229c2e78c5ef392b04b099c24527b28ce3bfedc8d7ed606c1e3b350f5914f0e55c2e1036eba3d0846f0ad182b7179af',NULL,NULL),(3,'Selvasarathi B','selvasarathi1234@gmail.com','scrypt:32768:8:1$HHKN6qxdSvx4gEei$23b90f1015b77b8ea341e92916ee09f1ec10bf0ddbada9605d1cb7dc9db7d70c4a970b7bf845d91fcf65c5c398a1918b37ae68eae9c110382d05b42c938968f0',NULL,NULL),(4,'Gopal K','shanmathipriya1998@gmail.com','scrypt:32768:8:1$i8Wn5grCW0AShbZl$a2131fc2608c350388bb05f3bfb0bb7087d1d7c6b215ce8170c9c09e4d198a9c0edec34e34460d043cd503b104d1478fdd98a0f51fa2d47f33454d557819df84',NULL,NULL);
/*!40000 ALTER TABLE `users_auth` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Dumping routines for database 'project_ai'
--
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2025-10-12 18:48:56
