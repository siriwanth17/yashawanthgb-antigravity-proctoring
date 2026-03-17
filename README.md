# 🚀 AI Skill Verification & Proctoring System

## 📌 Overview

This project is a **full-stack AI-based online exam proctoring and skill verification system**.
It monitors candidates in real-time using **webcam, microphone, and browser activity** to detect suspicious behavior during online tests.

---

## 🎯 Key Features

### 🔐 User System

* User Registration & Login (JWT Authentication)
* Secure session handling

### 📄 Resume & Profile

* Resume upload (PDF/DOC)
* Skill extraction using AI/NLP
* Coding profile links (GitHub, LeetCode)

### 🤖 AI Proctoring

* Face detection (0 face / multiple faces)
* Mobile phone detection
* Talking detection (audio monitoring)
* Looking away detection (head pose)
* Real-time behavior monitoring

### ⚠️ Cheating Detection

* Tab switching detection
* Multiple person detection
* No person detection
* Suspicious activity alerts

### 📊 Reporting System

* Violation logging
* Screenshot capture
* Cheating score generation
* Final exam report

---

## 🛠️ Tech Stack

### Frontend

* React.js
* Tailwind CSS
* WebRTC (Camera access)

### Backend

* Node.js
* Express.js

### AI / ML

* TensorFlow.js
* BlazeFace (Face detection)
* COCO-SSD (Object detection)

### Database

* MongoDB (or local DB)

### Other Tools

* ngrok (for public access)
* Git & GitHub

---

## 🧠 How It Works

1. User logs in and starts exam
2. Webcam & microphone are activated
3. AI models continuously monitor:

   * Face presence
   * Objects (phone)
   * Audio (talking)
4. Browser activity is tracked (tab switching)
5. Any violation is logged and sent to backend
6. Final cheating report is generated

---

## 🔁 System Flow

User → Frontend (React) → AI Monitoring → Backend (Node.js) → Database → Report

---

## ⚙️ Installation & Setup

### 1. Clone Repository

```bash
git clone https://github.com/your-username/antigravity-proctoring.git
cd antigravity-proctoring
```

### 2. Install Dependencies

#### Frontend

```bash
cd frontend
npm install
npm run dev
```

#### Backend

```bash
cd backend
npm install
node server.js
```

---

## 🌐 Run with ngrok (for external access)

```bash
ngrok http 3000
```

Use generated URL in frontend API calls.

---

## 🔐 Environment Variables

Create `.env` file:

```
VITE_API_URL=https://your-ngrok-url
JWT_SECRET=your_secret_key
```

---

## ⚠️ Known Limitations

* Detection accuracy depends on lighting and camera quality
* ngrok URL changes on restart
* Browser-based AI has performance limits

---

## 🚀 Future Improvements

* Eye tracking detection
* Screen recording
* Advanced cheating score using ML
* Deployment on cloud (AWS / GCP)

---

## 👨‍💻 Author

**Sirivanth**
Engineering Student

---

## ⭐ If you like this project

Give it a ⭐ on GitHub!
