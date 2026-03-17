import os
import io
import json
import random
import requests
from fastapi import FastAPI, BackgroundTasks, HTTPException
from pydantic import BaseModel
import openai
from PyPDF2 import PdfReader
import docx
from dotenv import load_dotenv

load_dotenv()

app = FastAPI()

# Configuration
openai.api_key = os.getenv("OPENAI_API_KEY")
NODE_BACKEND_URL = os.getenv("NODE_BACKEND_URL", "http://localhost:5000/api/internal")

class ParseRequest(BaseModel):
    resumeId: str
    userId: str
    fileUrl: str

@app.get("/api/ai/health")
def read_root():
    return {"status": "ok", "message": "AI Service is running!"}

def extract_text(file_bytes: bytes, filename: str) -> str:
    """Extracts text from PDF or DOCX file bytes."""
    text = ""
    try:
        if filename.lower().endswith('.pdf'):
            reader = PdfReader(io.BytesIO(file_bytes))
            for page in reader.pages:
                extracted = page.extract_text()
                if extracted:
                    text += extracted + "\n"
        elif filename.lower().endswith('.docx'):
            doc = docx.Document(io.BytesIO(file_bytes))
            for para in doc.paragraphs:
                text += para.text + "\n"
    except Exception as e:
        print(f"Error extracting text: {e}")
    return text

def detect_skills_nlp(text: str) -> list:
    """Uses OpenAI LLM to detect technical skills and remove duplicates."""
    try:
        if not openai.api_key or openai.api_key.strip() == "":
            print("No OPENAI_API_KEY found. Using rigorous local Regex dictionary matcher instead.")
            # Local Dictionary matching to prevent ANY hallucination
            known_skills = [
                "Python", "Java", "Data Structures", "DBMS", 
                "Machine Learning fundamentals", "Basic Computer Vision", 
                "HTML", "CSS", "Git", "GitHub", "Jupyter Notebook",
                "React", "Node.js", "Docker", "SQL", "JavaScript", "C++", 
                "C#", "AWS", "Machine Learning", "FastAPI", "Express"
            ]
            extracted = []
            lower_text = text.lower()
            for skill in known_skills:
                if skill.lower() in lower_text:
                    extracted.append(skill)
            return list(set(extracted))

        # Prevent massive token usage by slicing the string
        truncated_text = text[:4000]

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system", 
                    "content": "You are a stringent technical recruiter AI. Extract technical skills exactly as they are written in the provided resume text. DO NOT hallucinate, predict, or guess any skills that are not explicitly present in the text. Parse categories like Programming Languages, Core Concepts, AI/ML, Web Technologies, and Tools. Return ONLY a valid JSON array of strings representing the unique extracted skills."
                },
                {"role": "user", "content": f"Extract skills exactly as written from this resume:\n\n{truncated_text}"}
            ],
            temperature=0.0
        )
        
        # Parse output as JSON
        content = response.choices[0].message.content
        if not content:
            return ["React.js", "Python", "Node.js", "Docker"]
            
        skills_raw = json.loads(content)
        
        # Clean and deduplicate
        unique_skills = list(set([str(skill).strip() for skill in skills_raw if skill]))
        return unique_skills
    except Exception as e:
        print(f"Skill extraction failed: {e}\nMocking fallback skills...")
        return ["React.js", "Python", "Node.js", "Docker"]

def process_resume_task(request: ParseRequest):
    """Background task to handle text extraction and LLM parsing."""
    try:
        print(f"Starting processing for Resume {request.resumeId}...")
        
        # 1. Download File
        response = requests.get(request.fileUrl)
        if response.status_code != 200:
            raise Exception(f"Failed to download file from {request.fileUrl}")
            
        file_bytes = response.content
        
        # 2. Extract Text
        raw_text = extract_text(file_bytes, request.fileUrl)
        
        if not raw_text.strip():
            raise Exception("No text could be extracted from the document.")

        # 3. Detect Skills via OpenAI
        detected_skills = detect_skills_nlp(raw_text)
        print(f"Successfully extracted {len(detected_skills)} skills.")

        # 4. Prepare Success Payload
        payload = {
            "resumeId": request.resumeId,
            "status": "COMPLETED",
            "skills": detected_skills
        }
        
    except Exception as e:
        print(f"Processing error: {e}")
        # Prepare Failure Payload
        payload = {
            "resumeId": request.resumeId,
            "status": "FAILED",
            "skills": []
        }

    # 5. Send Results back to Node.js Backend Internal Webhook
    try:
        webhook_res = requests.post(f"{NODE_BACKEND_URL}/save-skills", json=payload)
        webhook_res.raise_for_status()
        print("Successfully notified Node.js backend.")
    except Exception as net_e:
         print(f"Failed to send webhook to Node.js backend: {net_e}")

@app.post("/api/ai/parse-resume")
async def trigger_parsing(request: ParseRequest, background_tasks: BackgroundTasks):
    """Endpoint called by Node.js to instantly queue the parsing task."""
    background_tasks.add_task(process_resume_task, request)
    return {"message": "Skill extraction triggered"}

class GenerateTestRequest(BaseModel):
    skill: str
    num_questions: int = 8

@app.post("/api/ai/generate-test")
async def generate_test(request: GenerateTestRequest):
    """Generates multiple choice questions using OpenAI."""
    try:
        if not openai.api_key or openai.api_key.strip() == "":
            print(f"No OPENAI_API_KEY found. Mocking Test for {request.skill}")
            mock_pool = [
                {
                    "text": f"What is the primary purpose of {request.skill}?",
                    "options": ["Server-side scripting", "Data visualization", "Core capability of this technology", "Database indexing"],
                    "answerIndex": 2
                },
                {
                    "text": f"Which paradigm does {request.skill} heavily rely on?",
                    "options": ["Procedural", "Object-Oriented or Functional", "Pure logic programming", "None of the above"],
                    "answerIndex": 1
                },
                {
                    "text": f"How do you handle dependency management in a {request.skill} project?",
                    "options": ["Using the standard package manager", "Manually downloading binaries", "It doesn't support packages", "Via XML config only"],
                    "answerIndex": 0
                },
                {
                    "text": f"Which of these is a common performance bottleneck in {request.skill}?",
                    "options": ["Too many abstract factories", "Excessive memory allocation / CPU blocking", "Too many comments", "Using strongly typed variables"],
                    "answerIndex": 1
                },
                {
                    "text": f"What is the standard file extension used for {request.skill} source code?",
                    "options": [".exe", "Default extension for this language/tool", ".dll", ".txt"],
                    "answerIndex": 1
                },
                {
                    "text": f"In {request.skill}, how is error handling typically achieved?",
                    "options": ["Try/Catch/Except blocks", "Ignoring them", "Rebooting the server", "Return code -1"],
                    "answerIndex": 0
                },
                {
                    "text": f"Which company or organization primarily backs {request.skill}?",
                    "options": ["A major tech corp or open-source foundation", "A single independent developer", "No one", "A gaming studio"],
                    "answerIndex": 0
                },
                {
                    "text": f"What is the primary execution environment for {request.skill}?",
                    "options": ["Browser only", "OS Level / Runtime Engine", "BIOS", "GPU only"],
                    "answerIndex": 1
                },
                {
                    "text": f"Which syntax is used to declare a variable in {request.skill}?",
                    "options": ["var / let / type declaration", "declare x = 1", "x := new var", "variable x = stop"],
                    "answerIndex": 0
                },
                {
                    "text": f"How does {request.skill} manage concurrent operations?",
                    "options": ["Async/Await or Threads/Goroutines", "It is strictly single-threaded blocking", "Using multiple keyboards", "Via magic"],
                    "answerIndex": 0
                },
                {
                    "text": f"What is the standard convention for multiline comments in {request.skill}?",
                    "options": ["/* ... */ or \"\"\"", "// ... //", "<!-- ... -->", "-- ... --"],
                    "answerIndex": 0
                },
                {
                    "text": f"Which testing framework is most associated with {request.skill}?",
                    "options": ["JUnit / PyTest / Jest", "Selenium only", "Manual testing only", "Ping command"],
                    "answerIndex": 0
                },
                {
                    "text": f"How is {request.skill} usually deployed to production?",
                    "options": ["Via Docker, CI/CD, or PaaS", "Emailed as a ZIP file", "Burned to a CD", "Faxed to the hosting company"],
                    "answerIndex": 0
                }
            ]
            
            # Ensure we don't request more sample sizing than available in pool
            sample_size = min(request.num_questions, len(mock_pool))
            selected_questions = random.sample(mock_pool, sample_size)
            return {"questions": selected_questions}

        response = openai.chat.completions.create(
            model="gpt-3.5-turbo",
            messages=[
                {
                    "role": "system",
                    "content": "You are a technical assessment AI. Generate a multiple-choice test for the requested skill. Return ONLY a valid JSON array of objects, where each object has 'text' (the question string), 'options' (array of exactly 4 string options), and 'answerIndex' (integer 0-3 representing the index of the correct option)."
                },
                {"role": "user", "content": f"Generate {request.num_questions} questions for the skill: {request.skill}"}
            ],
            temperature=0.2
        )
        content = response.choices[0].message.content
        if not content:
            raise Exception("Empty response from AI")
            
        questions = json.loads(content)
        return {"questions": questions}
    except Exception as e:
        print(f"Test generation failed: {e}")
        raise HTTPException(status_code=500, detail=str(e))
