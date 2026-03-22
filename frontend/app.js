const dbInput = document.getElementById('database-input');
const dbPreview = document.getElementById('db-preview');
const uploadLabel = document.querySelector('.upload-label');

const video = document.getElementById('camera-feed');
const canvas = document.getElementById('camera-canvas');
const selfiePreview = document.getElementById('selfie-preview');
const captureBtn = document.getElementById('capture-btn');
const retakeBtn = document.getElementById('retake-btn');

const verifyBtn = document.getElementById('verify-btn');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const loader = document.getElementById('loader');
const closeBtn = document.getElementById('close-result');

let databaseFile = null;
let driverBlob = null;
let stream = null;

// Initialize Camera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } });
        video.srcObject = stream;
    } catch (err) {
        console.error("Camera access error:", err);
        alert("Cannot access the camera. Please ensure you have given permission. Note: Web cameras require HTTPS or localhost.");
    }
}

// Database Image Upload
dbInput.addEventListener('change', (e) => {
    if (e.target.files && e.target.files[0]) {
        databaseFile = e.target.files[0];
        const reader = new FileReader();
        reader.onload = (event) => {
            dbPreview.src = event.target.result;
            dbPreview.hidden = false;
            uploadLabel.hidden = true;
            checkEnableVerify();
        };
        reader.readAsDataURL(databaseFile);
    }
});

// Capture Selfie
captureBtn.addEventListener('click', () => {
    if(!video.videoWidth) return;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    
    // Stop video and show snapshot
    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    selfiePreview.src = dataUrl;
    
    // Hide video, show img
    video.hidden = true;
    selfiePreview.hidden = false;
    
    // Toggle buttons
    captureBtn.hidden = true;
    retakeBtn.hidden = false;
    
    // Convert base64 to blob for uploading
    fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
            driverBlob = blob;
            checkEnableVerify();
        });
});

// Retake Selfie
retakeBtn.addEventListener('click', () => {
    video.hidden = false;
    selfiePreview.hidden = true;
    captureBtn.hidden = false;
    retakeBtn.hidden = true;
    driverBlob = null;
    checkEnableVerify();
});

function checkEnableVerify() {
    if (databaseFile && driverBlob) {
        verifyBtn.disabled = false;
    } else {
        verifyBtn.disabled = true;
    }
}

// Verify Face
verifyBtn.addEventListener('click', async () => {
    // Show Loading
    resultOverlay.classList.remove('hidden');
    resultTitle.textContent = "Verifying...";
    resultTitle.className = "";
    resultDesc.textContent = "Comparing your selfie with the database image...";
    loader.classList.remove('hidden');
    closeBtn.classList.add('hidden');

    const formData = new FormData();
    formData.append('database_image', databaseFile);
    formData.append('driver_image', driverBlob, 'driver.jpg');

    try {
        const response = await fetch('http://localhost:8000/verify', {
            method: 'POST',
            body: formData
        });
        
        if (!response.ok) {
            let errDetail = 'Verification failed';
            try {
                const errBody = await response.json();
                if(errBody.detail) errDetail = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
            } catch(e){}
            throw new Error(errDetail);
        }

        const data = await response.json();
        
        loader.classList.add('hidden');
        closeBtn.classList.remove('hidden');

        if (data.verified) {
            resultTitle.textContent = "Verified Successfully!";
            resultTitle.className = "success-text";
            resultDesc.textContent = `Match successful. Similarity Score: ${(data.similarity_score * 100).toFixed(1)}%`;
        } else {
            resultTitle.textContent = "Verification Failed";
            resultTitle.className = "danger-text";
            resultDesc.textContent = `Match unsuccessful. Similarity: ${(data.similarity_score * 100).toFixed(1)}% (Min required: ${(data.threshold * 100).toFixed(1)}%)`;
        }

    } catch (err) {
        loader.classList.add('hidden');
        closeBtn.classList.remove('hidden');
        resultTitle.textContent = "Error";
        resultTitle.className = "danger-text";
        resultDesc.textContent = err.message || "An error occurred while communicating with the server.";
    }
});

// Close Result
closeBtn.addEventListener('click', () => {
    resultOverlay.classList.add('hidden');
});

// Init
window.addEventListener('load', () => {
    startCamera();
});
