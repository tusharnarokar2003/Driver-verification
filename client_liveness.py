import cv2
import mediapipe as mp
import numpy as np
import time
import requests
import io

API_URL = "http://localhost:8000/verify"
DATABASE_IMAGE_PATH = "test_database.jpg"

# ✅ Initialize ONCE globally — not inside the function
mp_face_mesh = mp.solutions.face_mesh
FACE_MESH = mp_face_mesh.FaceMesh(
    max_num_faces=1,
    refine_landmarks=False,   # ✅ False = faster, we don't need iris
    min_detection_confidence=0.5,
    min_tracking_confidence=0.5,
    static_image_mode=False   # ✅ False = tracking mode, much faster
)

LEFT_EYE  = [362, 385, 387, 263, 373, 380]
RIGHT_EYE = [33,  160, 158, 133, 153, 144]

def compute_ear(landmarks, eye_indices, w, h):
    pts = [(landmarks[i].x * w, landmarks[i].y * h) for i in eye_indices]
    A = np.linalg.norm(np.array(pts[1]) - np.array(pts[5]))
    B = np.linalg.norm(np.array(pts[2]) - np.array(pts[4]))
    C = np.linalg.norm(np.array(pts[0]) - np.array(pts[3]))
    return (A + B) / (2.0 * C)

def driver_liveness_and_capture(timeout_sec=8):
    cap = cv2.VideoCapture(0)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, 480)   # ✅ Low res = fast processing
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 360)
    cap.set(cv2.CAP_PROP_FPS, 30)

    eyes_closed = False
    captured_frame = None
    frame_skip = 0
    start = time.time()
    
    print("Starting Liveness Check... Please look at the camera and BLINK!")

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        # ✅ Timeout check
        if time.time() - start > timeout_sec:
            print("Liveness timeout reached. Please try in better lighting.")
            break

        # ✅ Skip every other frame — halves CPU load
        frame_skip += 1
        if frame_skip % 2 != 0:
            continue

        h, w = frame.shape[:2]

        # ✅ Resize to small before MediaPipe (even faster)
        small = cv2.resize(frame, (240, 180))
        rgb = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
        results = FACE_MESH.process(rgb)

        if results.multi_face_landmarks:
            lm = results.multi_face_landmarks[0].landmark
            sw, sh = 240, 180

            left_ear  = compute_ear(lm, LEFT_EYE,  sw, sh)
            right_ear = compute_ear(lm, RIGHT_EYE, sw, sh)
            avg_ear   = (left_ear + right_ear) / 2.0

            if avg_ear < 0.20:
                eyes_closed = True
            elif eyes_closed:
                # ✅ Blink done — capture FULL res frame
                captured_frame = frame.copy()
                print("Blink Detected! Auto-capturing image...")
                break

        cv2.putText(frame, "Blink once to verify", (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX, 0.7, (0, 255, 0), 2)
        cv2.imshow("Driver Liveness", frame)
        if cv2.waitKey(1) & 0xFF == ord('q'):
            break

    cap.release()
    cv2.destroyAllWindows()
    return captured_frame

def main():
    print("Step 1: Driver Selfie (Liveness Check)")
    driver_frame = driver_liveness_and_capture()
    if driver_frame is None:
        print("Driver capture failed or timed out.")
        return

    # Convert the captured frame to a byte format (JPEG) so we can send it via requests
    _, buffer = cv2.imencode('.jpg', driver_frame)
    driver_bytes = buffer.tobytes()

    print("\nStep 2: Authenticating with API...")
    try:
        # Open database reference image
        with open(DATABASE_IMAGE_PATH, "rb") as db_file:
            files = {
                "driver_image": ("driver.jpg", driver_bytes, "image/jpeg"),
                "database_image": (DATABASE_IMAGE_PATH, db_file, "image/jpeg")
            }
            
            response = requests.post(API_URL, files=files)
            
            print("\nResponse Status:", response.status_code)
            resp_json = response.json()
            print("Server Result:", resp_json)
            
            if resp_json.get("verified"):
                print("✅ Face verified successfully!")
            else:
                print("❌ Verification failed.")
                
    except FileNotFoundError:
        print(f"Error: Make sure {DATABASE_IMAGE_PATH} exists in this folder to act as the reference image.")
    except Exception as e:
        print("Error sending request:", str(e))

if __name__ == "__main__":
    main()
