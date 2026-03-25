const dbInput = document.getElementById('database-input');
const dbPreview = document.getElementById('db-preview');
const uploadLabel = document.querySelector('.upload-label');

const video = document.getElementById('camera-feed');
const canvas = document.getElementById('camera-canvas');
const selfiePreview = document.getElementById('selfie-preview');
const retakeBtn = document.getElementById('retake-btn');

const livenessMsg = document.getElementById('liveness-msg');
const progressBar = document.getElementById('progress-bar');

const verifyBtn = document.getElementById('verify-btn');
const resultOverlay = document.getElementById('result-overlay');
const resultTitle = document.getElementById('result-title');
const resultDesc = document.getElementById('result-desc');
const loader = document.getElementById('loader');
const closeBtn = document.getElementById('close-result');

let databaseFile = null;
let driverBlob = null;
let stream = null;

let isLivenessVerified = false;
let eyesClosed = false;
let startTime = 0;
let animationFrameId = null;
const TIMEOUT_SEC = 8;
const EAR_THRESHOLD = 0.20;

// MediaPipe FaceMesh Setup
const faceMesh = new FaceMesh({
    locateFile: (file) => {
        return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    }
});
faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5
});

function getEAR(landmarks) {
    const dist = (p1, p2) => Math.hypot(landmarks[p1].x - landmarks[p2].x, landmarks[p1].y - landmarks[p2].y);
    const leftV1 = dist(159, 145);
    const leftV2 = dist(158, 153);
    const leftH = dist(33, 133);
    const leftEAR = (leftV1 + leftV2) / (2.0 * leftH);

    const rightV1 = dist(386, 374);
    const rightV2 = dist(385, 373);
    const rightH = dist(362, 263);
    const rightEAR = (rightV1 + rightV2) / (2.0 * rightH);

    return (leftEAR + rightEAR) / 2.0;
}

faceMesh.onResults((results) => {
    if (isLivenessVerified || !startTime) return;

    if (results.multiFaceLandmarks && results.multiFaceLandmarks.length > 0) {
        const landmarks = results.multiFaceLandmarks[0];
        const ear = getEAR(landmarks);

        if (ear < EAR_THRESHOLD) {
            eyesClosed = true;
        } else if (eyesClosed) {
            // Blink complete -> Auto-capture this frame!
            eyesClosed = false;
            successCapture();
        }
    }
});

async function processVideo(timestamp) {
    if (!startTime) startTime = timestamp;
    const elapsed = timestamp - startTime;

    // Update progress bar
    if (!isLivenessVerified) {
        const progressPercentage = Math.min((elapsed / (TIMEOUT_SEC * 1000)) * 100, 100);
        progressBar.style.width = `${progressPercentage}%`;

        if (elapsed > TIMEOUT_SEC * 1000) {
            // Timeout reached
            failCapture();
            return;
        }
    }

    if (!video.hidden && !isLivenessVerified && video.videoWidth) {
        await faceMesh.send({ image: video });
    }

    if (!isLivenessVerified) {
        animationFrameId = requestAnimationFrame(processVideo);
    }
}

// Success Capture logic
function successCapture() {
    isLivenessVerified = true;

    livenessMsg.textContent = "Verified! Auto-captured selfie.";
    livenessMsg.className = "success";
    progressBar.className = "progress-bar success";
    progressBar.style.width = "100%";

    // Process Frame
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);

    const dataUrl = canvas.toDataURL('image/jpeg', 0.95);
    selfiePreview.src = dataUrl;

    video.hidden = true;
    selfiePreview.hidden = false;
    retakeBtn.hidden = false;

    fetch(dataUrl)
        .then(res => res.blob())
        .then(blob => {
            driverBlob = blob;
            checkEnableVerify();
        });
}

// Failure logic
function failCapture() {
    isLivenessVerified = true; // Stop loop intentionally

    livenessMsg.textContent = "Please try in better lighting";
    livenessMsg.className = "failed";
    progressBar.className = "progress-bar failed";

    // Stop recording, don't capture.
    video.hidden = true;
    selfiePreview.hidden = true;
    retakeBtn.hidden = false;
    driverBlob = null;
    checkEnableVerify();
}

// Reset and Start Camera
async function startCamera() {
    try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } });
        video.srcObject = stream;
        video.onloadeddata = () => {
            video.play();
            startLivenessCheck();
        };
    } catch (err) {
        console.error("Camera access error:", err);
        alert("Cannot access the camera. Please ensure you have given permission.");
    }
}

function startLivenessCheck() {
    isLivenessVerified = false;
    eyesClosed = false;
    startTime = 0;

    video.hidden = false;
    selfiePreview.hidden = true;
    retakeBtn.hidden = true;
    driverBlob = null;
    checkEnableVerify();

    livenessMsg.textContent = "Look at camera and blink once";
    livenessMsg.className = "";
    progressBar.className = "progress-bar";
    progressBar.style.width = "0%";

    if (animationFrameId) cancelAnimationFrame(animationFrameId);
    animationFrameId = requestAnimationFrame(processVideo);
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

// Retake Selfie
retakeBtn.addEventListener('click', () => {
    startLivenessCheck();
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
                if (errBody.detail) errDetail = typeof errBody.detail === 'string' ? errBody.detail : JSON.stringify(errBody.detail);
            } catch (e) { }
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
