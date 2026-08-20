# ResumeIQ 🧠📄
> **AI-Powered ATS Simulator, Resume Optimizer, and Career Preparation Suite**

ResumeIQ is a full-stack SaaS career accelerator built to help job seekers bypass Applicant Tracking Systems (ATS) filters. The platform extracts text from uploaded PDF resumes, runs local heuristic layout checks, matches industry-specific keywords, and calls Google Gemini AI to analyze keyword gaps, auto-optimize content in one click, and host interactive mock interviews.

---

## 🚀 Key Features

* **PDF Parsing & Text Extraction**: Intercepts multipart PDF uploads via Multer and parses binary buffers into plain text using `pdf-parse`.
* **Dynamic Role-Aware Scanners**: Swaps keyword matching lists dynamically based on 7 career tracks (Software Engineering, Data Analytics, UI/UX Design, Product Management, Teaching, HR, or Finance/CA).
* **Split-Screen Resume Builder**: A real-time visual editor with accordion input forms on the left and a live A4 preview canvas on the right.
* **One-Click AI Optimizer**: Integrates Google Gemini 1.5 Flash to automatically rewrite professional summaries and work experience to include missing keywords.
* **Mock Interview Simulator**: Generates customized behavioral and technical questions based on the candidate's resume and target role, grading text responses out of 100 with actionable tips.
* **Social Portfolio Auditor**: Audits branding, layout, and links for LinkedIn, GitHub, and portfolios.
* **A4 Print Exporter**: Uses CSS Print Media rules to export clean, single-page A4 PDFs directly from the browser print engine.
* **Secure Document Validation**: Strictly intercepts and rejects empty files or uploaded Job Descriptions using content analysis and keyword density heuristics.

---

## 🏗️ System Architecture

ResumeIQ is built on a **Decoupled Client-Server Architecture** using the **Model-View-Controller (MVC)** design pattern.

```text
               Browser (Frontend SPA)
                         │
            HTTPS REST API Requests
                         │
                         ▼
             Express Backend (Node.js)
                         │
        ┌────────────────┴────────────────┐
        │                                 │
        ▼                                 ▼
 MongoDB Database                 Google Gemini API
(User, Resume, Reports)     (Resume Analysis & AI Grading)
```

1. **Frontend SPA (View)**: Engineered as a Single Page Application using vanilla HTML5, CSS3, and JavaScript, employing hash-based routing (`window.hashchange`) to prevent page-reload lag.
2. **Express Backend (Controller)**: Manages API routing, file buffers, security checks, and orchestrates calls to MongoDB and Gemini.
3. **MongoDB Database (Model)**: Stores user credentials, versioned resumes, reports, and interview sessions using Mongoose ODM schemas.
4. **Google Gemini API (AI Layer)**: Performs semantic document validation, resume optimizations, and mock interview grading.

---

## 💻 Tech Stack

| Technology | Purpose | Location |
| :--- | :--- | :--- |
| **Node.js** | Server Runtime | Backend |
| **Express.js** | REST API Routing & Middleware | Backend |
| **MongoDB** | NoSQL Document Database | Storage |
| **Mongoose** | MongoDB Object Modeling (ODM) | Backend Models |
| **Google Gemini API** | Cognitive AI Services | External API |
| **Vanilla JavaScript** | SPA Router, State Management, DOM Manipulation | Frontend |
| **Multer** | Multipart File Upload Middleware | Backend |
| **pdf-parse** | PDF Buffer Text Extraction | Backend Services |
| **BcryptJS** | Password Encryption & Hashing | Backend Controllers |
| **JWT** | Stateless Token-based Authorization | Backend / Client |

---

## 📂 Project Directory Structure

```text
resume-iq/
│
├── config/             # Database connection setups
│   └── db.js           # Connects Node.js to MongoDB
│
├── models/             # Mongoose database models (Schemas)
│   ├── User.js         # User credential and security schemas
│   ├── Resume.js       # Stores parsed text, builder data, and versions
│   ├── AnalysisReport.js # ATS score ratings and matched/missing keywords
│   └── MockInterview.js# Mock interview questions, answers, and evaluations
│
├── middleware/         # Intermediate request filters
│   ├── authMiddleware.js   # Decodes JWT headers and validates login status
│   ├── uploadMiddleware.js # Handles Multer validation and file storage limits
│   └── errorHandler.js     # Centralized backend error catcher
│
├── controllers/        # Request logic handlers (MVC Business Logic)
│   ├── authController.js   # User registration, login, profile logic
│   └── resumeController.js # PDF parser, versioning, and AI optimizations
│
├── routes/             # URL API routes mapping
│   ├── authRoutes.js   # Maps `/api/auth` endpoints
│   └── resumeRoutes.js # Maps `/api/resumes` endpoints
│
├── services/           # Helper integrations
│   ├── pdfService.js   # Converts binary PDF buffers to strings
│   ├── atsService.js   # Calculates formatting, readability, and structural scores
│   └── geminiService.js# Interacts with Gemini and runs fallback simulation
│
└── public/             # Static frontend files (Vanilla SPA)
    ├── index.html      # SPA HTML structure
    ├── css/styles.css  # CSS Layout and print media rules
    └── js/
        ├── api.js      # Fetch API request wrappers
        └── app.js      # SPA Router, state manager, and DOM listener
```

---

## ⚙️ Installation & Local Setup

### 1. Prerequisites
Ensure you have **Node.js (>=18.0.0)** and **MongoDB** installed on your system.

### 2. Clone the Repository & Install Dependencies
```bash
git clone https://github.com/your-username/resume-iq.git
cd resume-iq
npm install
```

### 3. Configure Environment Variables
Create a `.env` file in the root folder and add the following keys:
```env
PORT=3001
MONGODB_URI=mongodb://127.0.0.1:27017/resume-iq
JWT_SECRET=your_super_secret_jwt_key_here
GEMINI_API_KEY=your_google_gemini_api_key_here
```
*Note: If `GEMINI_API_KEY` is omitted, the application will automatically switch to **Simulation Mode**, running all ATS grading and matches locally using regex career-track dictionaries.*

### 4. Start the Application
```bash
# Run in development mode (using nodemon)
npm run dev

# Run in production mode
npm start
```
Open **`http://localhost:3001`** in your browser.

---

## 🔌 API Endpoints Map

### Authentication Endpoints (`/api/auth`)
* `POST /api/auth/register` - Creates a new user profile and returns a JWT token.
* `POST /api/auth/login` - Authenticates credentials and returns a JWT token.
* `GET /api/auth/me` - Fetches authenticated profile details (requires JWT header).

### Resume Endpoints (`/api/resumes`)
* `POST /api/resumes/upload` - Uploads PDF resume, extracts text, runs ATS analysis, and stores report.
* `GET /api/resumes/` - Fetches all root (V1) resumes uploaded by the logged-in user.
* `GET /api/resumes/:id` - Fetches the parsed details of a specific resume version.
* `POST /api/resumes/:id/version` - Saves an updated resume version from the builder canvas.
* `POST /api/resumes/:id/optimize` - Calls Gemini to optimize summaries to match missing keywords.

### Mock Interview Endpoints (`/api/interviews`)
* `POST /api/interviews/session` - Generates 5 mock interview questions based on the resume.
* `POST /api/interviews/:id/answer` - Submits a text answer for AI evaluation and scoring.

---

## 🛠️ Security & Content Validation

* **Password Hashing**: Employs **BcryptJS** to run secure one-way encryption on user passwords with a salt factor of 10.
* **Stateless Authorization**: Secures routes using **JWT** tokens attached in authorization headers (`Bearer <token>`).
* **Regex Injection Protection**: Escapes user search inputs (such as matching skills like `C++`) using a custom escape utility to prevent compiler crashes.
* **Document Upload Filter**: Checks PDF sizes, counts keyword density (blocking Job Descriptions), and rejects empty documents.
* **Secure File Cleanup**: Instantly unlinks and deletes physical PDF files from `/uploads` once the parser extracts text to protect candidate privacy.

---

## 🐛 Troubleshooting Stories (Development Challenges)

### 1. RegExp Compilation Crashes on Skill Scanning
* **Challenge**: The local fallback engine scans the resume text for technical skills using regex patterns. If a candidate targeted a role like "C++ Developer," compiling the regex pattern (`new RegExp('\\bC++\\b')`) threw a syntax crash because `+` is a special quantifier in regular expressions.
* **Solution**: I added an `escapeRegex` utility function that escapes regex-specific characters (turning `C++` into `C\+\+`) to compile the search pattern safely.

### 2. Hoisting & UI Boot Crashes
* **Challenge**: In JavaScript, variables declared with `const` are not hoisted. In my initial code, calling a rendering helper before declaring it with `const` crashed the script on boot, which also blocked the dropdowns and tab navigation from working.
* **Solution**: I changed the `const` function expressions to standard `function` declarations, which are hoisted by the browser engine on startup.

### 3. Blank PDF Export Previews
* **Challenge**: Hiding the dashboard controls during print was hiding the main parent wrapper (`#app-wrapper`). Since the resume canvas is inside this wrapper, the print preview rendered as a blank white page.
* **Solution**: I removed `#app-wrapper` from the hidden print styles list in `styles.css`. This kept the main container visible, while still hiding the sidebars, forms, and headers.
