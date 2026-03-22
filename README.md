# Face Verification Microservice

This module exposes a REST API via FastAPI used to compare a driver's face against a database image. It is designed to work in tandem with the primary SpringBoot application.

## Prerequisites
- Python 3.10 or 3.11 is strongly recommended (InsightFace struggles to build on Python 3.12+ without Visual Studio C++ Build Tools).
- If you fall into compilation errors while running `pip install`, you will need to install **Desktop development with C++** using the Visual Studio Installer.

## Setup Instructions

1. **Activate Virtual Environment**
   \`\`\`bash
   python -m venv venv
   # Windows:
   .\venv\Scripts\activate
   # Linux/Mac:
   source venv/bin/activate
   \`\`\`

2. **Install Dependencies**
   \`\`\`bash
   pip install -r requirements.txt
   \`\`\`

3. **Download Model** (Execute once before running the server)
   \`\`\`bash
   python download_model.py
   \`\`\`

4. **Start the API Server**
   \`\`\`bash
   uvicorn main:app --host 0.0.0.0 --port 8000
   \`\`\`

## Using the API from SpringBoot

The API runs on `http://localhost:8000/verify` and expects a `multipart/form-data` POST request.
It requires two image files:
- `driver_image`: The image captured from the driver.
- `database_image`: The image retrieved from the database.

**Sample Request Structure:**
\`\`\`http
POST /verify HTTP/1.1
Host: localhost:8000
Content-Type: multipart/form-data; boundary=------------------------abcdef
--------------------------abcdef
Content-Disposition: form-data; name="driver_image"; filename="driver.jpg"
Content-Type: image/jpeg

[raw image bytes]
--------------------------abcdef
Content-Disposition: form-data; name="database_image"; filename="database.jpg"
Content-Type: image/jpeg

[raw image bytes]
--------------------------abcdef--
\`\`\`

**Sample JSON Response:**
\`\`\`json
{
  "verified": true,
  "similarity_score": 0.824,
  "threshold": 0.6
}
\`\`\`
