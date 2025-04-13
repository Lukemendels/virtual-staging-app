import streamlit as st
from google.cloud import storage
import vertexai
# Using Endpoint class for predict method as per REST docs
from vertexai.endpoint import Endpoint
# Need base64 for image encoding/decoding
import base64
import os
import time

# --- Page Configuration ---
st.set_page_config(layout="wide")

# --- GCP Configuration ---
GCS_BUCKET_NAME = "virtual-staging-app-uploads-lukem-123"
GCP_PROJECT_ID = "virtual-staging-service"
GCP_REGION = "us-east4" # Ensure this matches the endpoint region

# --- Initialize Clients ---
# NOTE: The capability model endpoint might only be available in specific regions (like us-central1).
# We may need to adjust GCP_REGION if us-east4 doesn't work for the endpoint.
ENDPOINT_ID = "imagen-3.0-capability-001" # Model ID from docs
ENDPOINT_NAME = f"projects/{GCP_PROJECT_ID}/locations/{GCP_REGION}/publishers/google/models/{ENDPOINT_ID}"

try:
    vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)
    st.sidebar.success("Vertex AI Initialized.")

    storage_client = storage.Client(project=GCP_PROJECT_ID)
    bucket = storage_client.bucket(GCS_BUCKET_NAME)
    bucket.reload()
    st.sidebar.success(f"Connected to GCS Bucket: {GCS_BUCKET_NAME}")

    # Get the Vertex AI Endpoint
    endpoint = Endpoint(endpoint_name=ENDPOINT_NAME)
    st.sidebar.success(f"Connected to Endpoint: {ENDPOINT_ID}")

except Exception as e:
    st.error(f"Could not initialize Google Cloud clients or endpoint.")
    st.error(f"Details: {e}")
    st.error(f"Ensure project/region are correct, APIs enabled, auth setup, and model endpoint exists in region '{GCP_REGION}'.")
    st.stop()


# --- Function to Call Imagen API using Endpoint.predict ---
def trigger_imagen_staging(image_gcs_uri: str, prompt: str) -> tuple[str, bytes | None]:
    """
    Calls the Imagen 3 capability model using Endpoint.predict,
    attempting the 'Instruct Customization' approach.
    Returns a status message and potentially the resulting image bytes.
    """
    st.write(f"ℹ️ Calling Vertex AI Imagen Capability Model for '{image_gcs_uri}'")
    st.write(f"   Using Instruct Prompt: '{prompt}' (Ensure it references '[1]')")

    try:
        # 1. Read the base image from GCS
        blob_name = image_gcs_uri.replace(f"gs://{GCS_BUCKET_NAME}/", "")
        blob = bucket.blob(blob_name)
        image_bytes = blob.download_as_bytes()

        # 2. Encode image bytes as base64
        encoded_image_string = base64.b64encode(image_bytes).decode("utf-8")

        # 3. Construct the API request payload (instances and parameters)
        # Mimicking the JSON body for "Instruct customization" / REFERENCE_TYPE_RAW
        instances = [
            {
                "prompt": prompt, # User prompt, should reference [1]
                "referenceImages": [
                    {
                        "referenceType": "REFERENCE_TYPE_RAW",
                        "referenceId": 1, # Corresponds to [1] in prompt
                        "referenceImage": {
                            "bytesBase64Encoded": encoded_image_string
                        }
                    }
                ]
            }
        ]
        parameters = {
            "sampleCount": 1 # Generate one image
            # Add other parameters if needed (e.g., quality settings)
        }

        # 4. Make the API call using endpoint.predict
        st.write("⏳ Calling predict endpoint...")
        response = endpoint.predict(instances=instances, parameters=parameters)
        st.write("✅ API Call prediction received.")

        # 5. Process the response
        if response.predictions and len(response.predictions) > 0:
            # Get first prediction
            prediction = response.predictions[0]
            if isinstance(prediction, dict) and "bytesBase64Encoded" in prediction:
                # Decode the base64 string back to bytes
                generated_image_bytes = base64.b64decode(prediction["bytesBase64Encoded"])

                # --- Save result back to GCS (optional but good practice) ---
                timestamp = int(time.time())
                output_filename = f"staged/{os.path.splitext(blob_name)[0]}_{timestamp}_instruct.png"
                output_gcs_uri = f"gs://{GCS_BUCKET_NAME}/{output_filename}"
                try:
                    output_blob = bucket.blob(output_filename)
                    output_blob.upload_from_string(generated_image_bytes, content_type='image/png')
                    save_msg = f"Output saved to: {output_gcs_uri}"
                except Exception as save_e:
                    save_msg = f"⚠️ Could not save output to GCS: {save_e}"
                # --- End save result ---

                return f"✅ Staging complete! {save_msg}", generated_image_bytes
            else:
                st.warning("API prediction received, but 'bytesBase64Encoded' not found.")
                st.json(prediction) # Show raw prediction content
                return "⚠️ Prediction received, but couldn't extract image.", None
        else:
            st.warning("API call successful but no predictions returned.")
            st.json(response) # Show raw response
            return "⚠️ No predictions returned by API.", None

    except Exception as e:
        error_message = f"❌ Error calling predict endpoint: {e}"
        st.error(error_message)
        return error_message, None


# --- Streamlit App Layout ---
st.title("Virtual Staging Assistant")
st.write("Welcome! Upload your real estate photos for virtual staging.")
st.write("---")

# --- Prompt Input ---
prompt_instructions = """
Enter Staging Prompt below.
For 'Instruct' mode with the capability model, try referencing the image ID `[1]`.
Example: `Add a comfortable blue armchair in the empty corner of image [1]`
"""
staging_prompt = st.text_area("Enter Staging Prompt:", height=100, placeholder=prompt_instructions)
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
    col1_title, col2_title = st.columns([3, 1])
    with col1_title:
        st.write("**File & Status**")
    with col2_title:
        st.write("**Action**")

    for uploaded_file in uploaded_files:
        blob_name = uploaded_file.name
        gcs_uri = f"gs://{GCS_BUCKET_NAME}/{blob_name}"
        # Initialize session state if needed
        if f"upload_status_{blob_name}" not in st.session_state:
            st.session_state[f"upload_status_{blob_name}"] = f"'{blob_name}' ready."
        if f"staging_status_{blob_name}" not in st.session_state:
            st.session_state[f"staging_status_{blob_name}"] = ""
        if f"result_image_{blob_name}" not in st.session_state:
            st.session_state[f"result_image_{blob_name}"] = None # To store image bytes

        # Display file info and staging button in columns
        with st.container():
            c1, c2 = st.columns([3, 1])
            with c1:
                st.info(st.session_state[f"upload_status_{blob_name}"])
                status_text = st.session_state[f"staging_status_{blob_name}"]
                if status_text:
                    if status_text.startswith("✅"): st.success(status_text)
                    elif status_text.startswith("❌") or status_text.startswith("⚠️"): st.warning(status_text)
                    else: st.info(status_text)
                # Display the resulting image if available
                if st.session_state[f"result_image_{blob_name}"]:
                    st.image(st.session_state[f"result_image_{blob_name}"], width=512, caption="Staged Result")
                    # Add Download button
                    st.download_button(
                        label=f"Download {os.path.splitext(blob_name)[0]}_staged.png",
                        data=st.session_state[f"result_image_{blob_name}"],
                        file_name=f"{os.path.splitext(blob_name)[0]}_staged.png",
                        mime="image/png",
                        key=f"download_{blob_name}"
                    )


            with c2:
                if st.button(f"Stage '{blob_name}'", key=f"stage_{blob_name}"):
                    if not staging_prompt:
                         st.session_state[f"staging_status_{blob_name}"] = "⚠️ Please enter a staging prompt above."
                         st.session_state[f"result_image_{blob_name}"] = None # Clear previous image
                         st.rerun()
                    elif "[1]" not in staging_prompt:
                         st.session_state[f"staging_status_{blob_name}"] = "⚠️ Prompt must include '[1]' to reference the image for Instruct mode."
                         st.session_state[f"result_image_{blob_name}"] = None # Clear previous image
                         st.rerun()
                    else:
                        st.session_state[f"result_image_{blob_name}"] = None # Clear previous image before starting
                        blob = bucket.blob(blob_name)
                        try:
                            uploaded_file.seek(0)
                            st.session_state[f"upload_status_{blob_name}"] = f"⏳ Uploading '{blob_name}' to GCS..."
                            st.rerun()

                            blob.upload_from_file(uploaded_file)
                            st.session_state[f"upload_status_{blob_name}"] = f"✅ Uploaded: {gcs_uri}"
                            st.session_state[f"staging_status_{blob_name}"] = f"⏳ Triggering AI Staging (Instruct mode)..."
                            st.rerun()

                            result_msg, result_bytes = trigger_imagen_staging(image_gcs_uri=gcs_uri, prompt=staging_prompt)
                            st.session_state[f"staging_status_{blob_name}"] = result_msg
                            st.session_state[f"result_image_{blob_name}"] = result_bytes # Store image bytes
                            st.rerun()

                        except Exception as e:
                             st.session_state[f"upload_status_{blob_name}"] = f"❌ GCS Upload Failed: {e}"
                             st.rerun()
else:
    st.info("Please upload one or more image files to begin.")

# --- Sidebar ---
st.sidebar.header("Controls")
st.sidebar.write("Staging options will go here.")