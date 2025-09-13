# --- Imports ---
import streamlit as st
from google import genai
from google.genai.types import GenerateContentConfig, Modality
from PIL import Image
import io
import os

# --- Page Configuration ---
st.set_page_config(layout="wide")

# --- GCP Configuration ---
GCP_PROJECT_ID = "virtual-staging-service"
GCP_REGION = "us-central1"
# Note: As per the documentation, gemini-2.5-flash-image-preview is the correct model for image editing.
MODEL_ID = "gemini-2.5-flash-image-preview"

# --- Initialize GenAI Client for Vertex AI ---
client = None
try:
    # This uses Application Default Credentials (ADC)
    # Ensure you have authenticated via `gcloud auth application-default login`
    # and the principal has the "Vertex AI User" role.
    st.write("Attempting to initialize GenAI Client for Vertex AI...")
    client = genai.Client(vertexai=True, project=GCP_PROJECT_ID, location=GCP_REGION)
    st.sidebar.success(f"GenAI Client Initialized (Region: {GCP_REGION}).")
    st.sidebar.info(f"Using Model: '{MODEL_ID}'")

except Exception as e:
    st.error("Fatal Error: Could not initialize GenAI Client for Vertex AI.")
    st.error(f"Details: {e}")
    st.error("Ensure you have run 'gcloud auth application-default login' and have the 'Vertex AI User' role.")
    st.stop()
# --- End Initialize Client ---

# --- Gemini Backend Function ---
def edit_image_with_gemini(prompt: str, image_bytes: bytes) -> tuple[str, bytes | None]:
    """
    Calls the Gemini model to edit an image based on a prompt.
    Returns a status message and potentially the resulting image bytes.
    """
    st.write(f"ℹ️ Calling Gemini Model '{MODEL_ID}' via GenAI SDK.")
    st.write(f"   Using Prompt: '{prompt}'")

    if client is None:
        return "❌ Error: GenAI Client not loaded.", None

    try:
        # Create a PIL Image object from the bytes
        pil_image = Image.open(io.BytesIO(image_bytes))

        # 1. Make the API call using the client
        st.write(f"⏳ Calling {MODEL_ID} with the image and prompt...")
        response = client.models.generate_content(
            model=MODEL_ID,
            contents=[pil_image, prompt],
            config=GenerateContentConfig(response_modalities=[Modality.TEXT, Modality.IMAGE]),
        )
        st.write("✅ SDK Call complete.")

        # 2. Process the response to find the image
        edited_image_bytes = None
        for part in response.candidates[0].content.parts:
            if part.inline_data:
                edited_image_bytes = part.inline_data.data
                break # Found the image, no need to look further

        if edited_image_bytes:
            st.write(f"   Got {len(edited_image_bytes)} bytes for the edited image.")
            return f"✅ Image Editing complete using {MODEL_ID}!", edited_image_bytes
        else:
            st.warning("API call successful but no image was returned in the response.")
            st.write("Raw Response Object:", response)
            return f"⚠️ No image returned by API ({MODEL_ID}).", None

    except Exception as e:
        error_message = f"❌ Error during AI Generation call to '{MODEL_ID}': {e}"
        st.exception(e)
        return error_message, None
# --- End Gemini Backend Function ---

# ======================================================================
# --- START: Simple Streamlit UI (Connected to Imagen Editing Backend) ---
# ======================================================================

st.title(f"AI Image Editor (using {MODEL_ID})")
st.write("Upload an interior photo and provide a prompt to **edit** the image using Gemini.")

# --- Session State Initialization ---
if 'uploaded_file_data' not in st.session_state: st.session_state.uploaded_file_data = None
if 'uploaded_filename' not in st.session_state: st.session_state.uploaded_filename = None
if 'edit_prompt' not in st.session_state: st.session_state.edit_prompt = ""
if 'edited_image_data' not in st.session_state: st.session_state.edited_image_data = None
if 'editing_status_message' not in st.session_state: st.session_state.editing_status_message = ""

# --- 1. File Uploader ---
uploaded_file = st.file_uploader(
    "Upload an interior photo to edit:",
    type=["jpg", "jpeg", "png", "webp"],
    help="This image will be edited by the Gemini model."
)

if uploaded_file is not None:
    new_image_bytes = uploaded_file.getvalue()
    if st.session_state.uploaded_file_data != new_image_bytes:
        st.session_state.uploaded_file_data = new_image_bytes
        st.session_state.uploaded_filename = uploaded_file.name
        st.session_state.edited_image_data = None
        st.session_state.editing_status_message = ""
        print(f"New file uploaded: {uploaded_file.name}, stored in session state.")

# --- 2. Edit Prompt ---
st.subheader("Enter an editing prompt:")
st.session_state.edit_prompt = st.text_input("e.g., 'Make the walls blue', 'Add a modern sofa'", st.session_state.edit_prompt)

# --- Main Request Handling Function ---
def process_edit_request(prompt, image_bytes):
    """Calls the Gemini editing function."""
    st.session_state.editing_status_message = "Processing..."
    st.session_state.edited_image_data = None

    st.info(f"Using Prompt: '{prompt}'")
    st.write(f"Triggering {MODEL_ID} SDK function...")
    result_msg, result_bytes = edit_image_with_gemini(prompt=prompt, image_bytes=image_bytes)

    st.session_state.editing_status_message = result_msg
    st.session_state.edited_image_data = result_bytes
    st.rerun()

# --- 3. Action Button ---
st.divider()
st.subheader("3. Edit Image")
button_disabled = not (st.session_state.uploaded_file_data and st.session_state.edit_prompt)

if st.button(f"✨ Edit Image Now! (Using {MODEL_ID})", type="primary", disabled=button_disabled):
    if not button_disabled:
        with st.spinner("AI is editing the image... Please wait."):
            process_edit_request(
                st.session_state.edit_prompt,
                st.session_state.uploaded_file_data
            )

if button_disabled:
    st.warning("Please upload an image and provide an edit prompt.")

# --- 4. Display Status and Results ---
st.divider()
st.subheader("4. Status & Results")

status_message = st.session_state.editing_status_message
if status_message:
    if status_message.startswith("✅"): st.success(status_message)
    elif status_message.startswith("❌") or status_message.startswith("⚠️"): st.warning(status_message)
    else: st.info(status_message)

col1, col2 = st.columns(2)
with col1:
    st.markdown("#### Original Image")
    if st.session_state.uploaded_file_data is not None:
        st.image(st.session_state.uploaded_file_data, use_container_width=True)
    else:
        st.info("Upload an image in section 1.")

with col2:
    st.markdown("#### Edited Image")
    if st.session_state.edited_image_data is not None:
        st.image(st.session_state.edited_image_data, use_container_width=True)
        download_filename = f"edited_{st.session_state.uploaded_filename}"
        st.download_button(
             label="⬇️ Download Edited Photo",
             data=st.session_state.edited_image_data,
             file_name=download_filename,
             mime="image/png"
         )
    else:
        st.info("The edited image will appear here.")

# ======================================================================
# --- END: Simple Streamlit UI (Connected to Imagen Editing Backend) ---
# ======================================================================