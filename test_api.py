import requests

# The URL where your FastAPI server is running
API_URL = "http://localhost:8000/verify"

# Replace these with actual paths to test images later
DRIVER_IMAGE_PATH = "test_driver.jpg"
DATABASE_IMAGE_PATH = "test_database.jpg"

def test_verification():
    try:
        # Open both images in binary read mode
        with open(DRIVER_IMAGE_PATH, "rb") as driver_file, open(DATABASE_IMAGE_PATH, "rb") as db_file:
            
            # Create a dictionary for the multipart form data
            files = {
                "driver_image": (DRIVER_IMAGE_PATH, driver_file, "image/jpeg"),
                "database_image": (DATABASE_IMAGE_PATH, db_file, "image/jpeg")
            }
            
            print(f"Sending request to {API_URL}...")
            response = requests.post(API_URL, files=files)
            
            # Print the resulting JSON from the server
            print("Response Status Code:", response.status_code)
            print("Response JSON:", response.json())
            
    except FileNotFoundError as e:
        print(f"Error: {e}")
        print("Please make sure you create two test images named 'test_driver.jpg' and 'test_database.jpg' in the same folder.")
    except exceptions.ConnectionError:
        print("Error: Could not connect to the server. Make sure you started it with 'uvicorn main:app --port 8000'!")

if __name__ == "__main__":
    test_verification()
