import streamlit as st
from google.cloud import storage
import vertexai # Import Vertex AI library
# from vertexai.vision_models import Image, ImageGenerationModel # Example import, might change based on specific Imagen 3 model/task
import os

# --- Page Configuration (MUST BE THE FIRST STREAMLIT COMMAND) ---
st.set_page_config(layout="wide")

# --- GCP Configuration ---
GCS_BUCKET_NAME = "virtual-staging-app-uploads-lukem-123"
GCP_PROJECT_ID = "virtual-staging-service" # Replace if different
GCP_REGION = "us-east4" # Replace if different

# --- Initialize Clients ---
try:
    # Initialize Vertex AI
    vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)
    st.sidebar.success("Vertex AI Initialized.")

    # Initialize GCS Client
    storage_client = storage.Client(project=GCP_PROJECT_ID) # Explicitly pass project
    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    bucket.reload() # Check if bucket exists and is accessible
    st.sidebar.success(f"Connected to GCS Bucket: {GCS_BUCKET_NAME}")

except Exception as e:
    st.error(f"Could not initialize Google Cloud clients.")
    st.error(f"Details: {e}")
    st.error("Ensure project/region are correct, APIs are enabled, and auth is set up ('gcloud auth application-default login').")
    st.stop()

# --- Placeholder Function for Imagen Call ---
def trigger_imagen_staging(image_gcs_uri: str, prompt: str) -> str:
    """
    Placeholder function to simulate calling the Imagen API.
    Replace this with the actual Vertex AI SDK call later.
    """
    st.write(f"ℹ️ Attempting to stage '{image_gcs_uri}' with prompt: '{prompt}'")

    try:
        # --- TODO: Implement Actual Imagen API Call Here ---
        # 1. Load the appropriate Imagen model
        #    Example (may need adjustment for Imagen 3 editing model ID):
        #    model = ImageGenerationModel.from_pretrained("imagegeneration@006") # Find correct model ID for Imagen 3 edit/inpainting

        # 2. Prepare parameters for the API call
        #    (e.g., input image URI, prompt, number of images, quality settings...)
        #    parameters = { ... }

        # 3. Make the API call
        #    response = model.generate_images(prompt=prompt, ...) # Adjust based on actual model/method

        # 4. Process the response (extract output image URI, handle errors)
        #    output_uri = response[0]._image_bytes # Example - likely different for URI output
        #    st.image(response[0]._image_bytes) # Display image directly if bytes returned

        # For now, return a placeholder success message with inputs
        result_message = f"✅ [Placeholder] Staging task submitted for {os.path.basename(image_gcs_uri)}. Output will appear elsewhere."
        # --- End of TODO section ---

        return result_message

    except Exception as e:
        error_message = f"❌ [Placeholder] Error calling Imagen API: {e}"
        st.error(error_message)
        return error_message


# --- Streamlit App Layout ---
st.title("Virtual Staging Assistant")
st.write("Welcome! Upload your real estate photos for virtual staging.")
st.write("---")

# --- Prompt Input ---
staging_prompt = st.text_area("Enter Staging Prompt:", height=100, placeholder="e.g., Add a modern grey sofa, a wooden coffee table, and a large plant in the corner.")
st.write("---")

# --- File Uploader ---
uploaded_files = st.file_uploader(
    "Choose image files",
    type=["png", "jpg", "jpeg"],
    accept_multiple_files=True
)

# --- Process Uploaded Files ---
if uploaded_files:
    st.subheader("Uploaded Files & Staging Control:")
    # Use columns for better layout per file
    col1, col2 = st.columns([3, 1]) # Ratio for file info vs button

    with col1:
        st.write("**File**")
    with col2:
        st.write("**Action**")

    for uploaded_file in uploaded_files:
        blob_name = uploaded_file.name
        gcs_uri = f"gs://{GCS_BUCKET_NAME}/{blob_name}"
        upload_status = st.empty() # Placeholder for upload status message
        staging_status = st.empty() # Placeholder for staging status message

        # Display file info and staging button in columns
        with st.container(): # Group elements for each file
            c1, c2 = st.columns([3, 1])
            with c1:
                upload_status.info(f"'{blob_name}' ready.") # Initial status

            with c2:
                # Unique key for button using filename
                if st.button(f"Stage '{blob_name}'", key=f"stage_{blob_name}"):
                    if not staging_prompt:
                        staging_status.warning("Please enter a staging prompt above.")
                    else:
                        # 1. Upload to GCS first
                        blob = bucket.blob(blob_name)
                        try:
                            uploaded_file.seek(0)
                            upload_status.write(f"⏳ Uploading '{blob_name}' to GCS...")
                            blob.upload_from_file(uploaded_file)
                            upload_status.success(f"✅ Uploaded: {gcs_uri}")

                            # 2. Trigger Imagen Staging (Placeholder)
                            staging_status.write(f"⏳ Triggering AI Staging for '{blob_name}'...")
                            result = trigger_imagen_staging(image_gcs_uri=gcs_uri, prompt=staging_prompt)
                            staging_status.info(result) # Display result from placeholder function

                        except Exception as e:
                            upload_status.error(f"❌ GCS Upload Failed: {e}")

else:
    st.info("Please upload one or more image files to begin.")

# --- Sidebar ---
st.sidebar.header("Controls")
st.sidebar.write("Staging options will go here.")