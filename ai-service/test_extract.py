from app.main import detect_skills_nlp

text = """
John Doe
Software Engineer
Experience
- Developed a web app using Python, Django, and React.
- Deployed on AWS.
- Familiar with Git and Docker.
"""
print("Extracted Skills:")
print(detect_skills_nlp(text))
