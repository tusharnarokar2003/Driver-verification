from huggingface_hub import snapshot_download

def download_model():
    print("Downloading AuraFace-v1 model...")
    snapshot_download(
        repo_id="fal/AuraFace-v1",
        local_dir="models/auraface"
    )
    print("Download complete.")

if __name__ == "__main__":
    download_model()
