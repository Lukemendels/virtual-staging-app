import streamlit as st
# import io
# from PIL import Image
from google.cloud import storage # Import the GCS library
import os # To potentially construct paths later

# --- Page Configuration (MUST BE THE FIRST STREAMLIT COMMAND) ---
st.set_page_config(layout="wide")

# --- GCS Configuration ---
GCS_BUCKET_NAME = "virtual-staging-app-uploads-lukem-123"

# --- Initialize GCS Client ---
# The client uses Application Default Credentials (ADC)
try:
    storage_client = storage.Client()
    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    # Quick check to see if bucket exists and is accessible (optional)
    bucket.reload()
    # Display connection status AFTER page config
    st.sidebar.success(f"Connected to GCS Bucket: {GCS_BUCKET_NAME}")

except Exception as e:
    # Display errors AFTER page config
    st.error(f"Could not initialize Google Cloud Storage client or access bucket '{GCS_BUCKET_NAME}'.")
    st.error(f"Details: {e}")
    st.error("Ensure you have run 'gcloud auth application-default login' OR that the app has correct permissions if running on GCP.")
    st.stop() # Stop the app if GCS isn't configured or accessible

# --- Streamlit App Layout ---
st.title("Virtual Staging Assistant")
st.write("Welcome! Upload your real estate photos for virtual staging.")
st.write("---")

uploaded_files = st.file_uploader(
    "Choose image files",
    type=["png", "jpg", "jpeg"],
    accept_multiple_files=True
)

if uploaded_files:
    st.write("---")
    st.subheader("Upload Progress:")
    for uploaded_file in uploaded_files:
        blob_name = uploaded_file.name
        blob = bucket.blob(blob_name)

        try:
            uploaded_file.seek(0)
            st.write(f"⏳ Uploading '{uploaded_file.name}'...")
            blob.upload_from_file(uploaded_file)
            st.success(f"✅ Successfully uploaded '{uploaded_file.name}' to GCS bucket '{GCS_BUCKET_NAME}'.")
            st.caption(f"   GCS Path: gs://{GCS_BUCKET_NAME}/{blob_name}")

        except Exception as e:
            st.error(f"❌ Failed to upload '{uploaded_file.name}': {e}")

else:
    st.info("Please upload one or more image files.")

# --- Sidebar ---
st.sidebar.header("Controls")
st.sidebar.write("Staging options will go here.")