# --- Imports ---
import streamlit as st
# --- Vertex AI Imports ---
import vertexai
# Use the specific model class found in Vertex AI Studio
from vertexai.preview.vision_models import ImageGenerationModel, Image # Or vertexai.vision_models if not preview
# --- Other Imports ---
import base64
import os
import time
import io

# --- Page Configuration ---
st.set_page_config(layout="wide")

# --- GCP Configuration ---
GCP_PROJECT_ID = "virtual-staging-service"
GCP_REGION = "us-central1"
# ----- ***** USING WORKING GENERATION MODEL ID ***** -----
MODEL_ID = "imagen-3.0-generate-002" # Confirmed working in Studio
# ----- ********************************************* -----
# ENDPOINT_NAME is no longer needed when using ImageGenerationModel class directly

# --- Initialize Vertex AI Client & Load Model ---
# Relies on Application Default Credentials (ADC)
generation_model = None
try:
    vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)
    # Load the specific model using the dedicated class
    generation_model = ImageGenerationModel.from_pretrained(MODEL_ID)

    st.sidebar.success(f"Vertex AI Initialized (Region: {GCP_REGION}).")
    st.sidebar.success(f"Model '{MODEL_ID}' loaded successfully.")

except Exception as e:
    st.error(f"Fatal Error: Could not initialize Vertex AI or load model '{MODEL_ID}'.")
    st.error(f"Details: {e}")
    st.error(f"Ensure project/region/model ID are correct, APIs enabled, and auth setup (ADC).")
    st.stop()
# --- End Initialize Clients ---


# --- Imagen Backend Function (Refactored for SDK Class & GENERATION) ---
# --- Imports ---
import streamlit as st
import vertexai
import google.generativeai as genai
from PIL import Image
import io
import os

# --- Page Configuration ---
st.set_page_config(layout="wide")

# --- GCP Configuration & Model ---
GCP_PROJECT_ID = "virtual-staging-service"
GCP_REGION = "us-central1"
MODEL_ID = "gemini-2.5-flash-image-preview"

# --- Initialize Vertex AI Client & Load Model ---
# NOTE: This now relies on google-genai library and specific env vars
# The user must set:
# export GOOGLE_CLOUD_PROJECT="YOUR_PROJECT_ID"
# export GOOGLE_CLOUD_LOCATION="YOUR_PROJECT_LOCATION"
# export GOOGLE_GENAI_USE_VERTEXAI=True
gemini_model = None
try:
    vertexai.init(project=GCP_PROJECT_ID, location=GCP_REGION)
    gemini_model = genai.GenerativeModel(model_name=MODEL_ID)
    st.sidebar.success(f"Vertex AI Initialized for project '{GCP_PROJECT_ID}'.")
    st.sidebar.success(f"Model '{MODEL_ID}' loaded successfully.")
    st.sidebar.info("Ensure environment variables for the 'google-genai' library are set.")

except Exception as e:
    st.error(f"Fatal Error: Could not initialize Vertex AI or load model '{MODEL_ID}'.")
    st.error(f"Details: {e}")
    st.error("Ensure you have run 'gcloud auth application-default login' and set the required environment variables.")
    st.stop()

# --- Gemini Backend Function (for EDITING) ---
def trigger_gemini_editing_sdk(prompt: str, image_bytes: bytes) -> tuple[str, bytes | None]:
    """
    Calls the Gemini model for image editing.
    Returns a status message and potentially the resulting image bytes.
    """
    st.write(f"ℹ️ Calling Vertex AI Model '{MODEL_ID}' for editing.")
    st.write(f"   Using Prompt: '{prompt}'")

    if gemini_model is None:
        return "❌ Error: Gemini model not loaded.", None

    try:
        # 1. Prepare the image for the model
        image_part = Image.open(io.BytesIO(image_bytes))

        # 2. Make the API call
        st.write("⏳ Calling model.generate_content()...")
        # Pass both the image and the prompt to the model
        response = gemini_model.generate_content([image_part, prompt])
        st.write("✅ API Call complete.")

        # 3. Process the response
        if response.parts:
            # Find the first image part in the response
            first_image_part = next((part for part in response.parts if part.mime_type.startswith("image/")), None)
            if first_image_part:
                edited_image_bytes = first_image_part.inline_data.data
                st.write(f"   Got {len(edited_image_bytes)} bytes for the edited image.")
                return f"✅ Image Editing complete using {MODEL_ID}!", edited_image_bytes
            else:
                st.warning("API call successful but no image returned in the response.")
                st.write("Full response text:", response.text)
                return f"⚠️ No images returned by API ({MODEL_ID}).", None
        else:
            st.warning("API call successful but no parts returned in the response.")
            st.write("Full response text:", response.text)
            return f"⚠️ No content returned by API ({MODEL_ID}).", None

    except Exception as e:
        error_message = f"❌ Error during AI Editing call to '{MODEL_ID}': {e}"
        st.exception(e)
        return error_message, None

# ======================================================================
# --- START: Streamlit UI (Connected to Gemini Editing Backend) ---
# ======================================================================

st.title(f"AI Photo Editor (using {MODEL_ID})")
st.write("Upload an interior photo, provide an editing instruction, and let the AI do the rest!")

# --- Session State Initialization ---
if 'uploaded_file_data' not in st.session_state: st.session_state.uploaded_file_data = None
if 'edit_instruction' not in st.session_state: st.session_state.edit_instruction = "Make this room more modern."
if 'edited_image_data' not in st.session_state: st.session_state.edited_image_data = None
if 'editing_status_message' not in st.session_state: st.session_state.editing_status_message = ""

# --- 1. File Uploader ---
uploaded_file = st.file_uploader(
    "Upload an interior photo to edit:",
    type=["jpg", "jpeg", "png", "webp"]
)

if uploaded_file is not None:
    new_image_bytes = uploaded_file.getvalue()
    if st.session_state.uploaded_file_data != new_image_bytes:
        st.session_state.uploaded_file_data = new_image_bytes
        st.session_state.edited_image_data = None
        st.session_state.editing_status_message = ""

# --- 2. Get Editing Instruction ---
st.subheader("2. Editing Instruction")
edit_prompt = st.text_input(
    "Describe the change you want to make:",
    st.session_state.edit_instruction
)
st.session_state.edit_instruction = edit_prompt


# --- Main Request Handling Function ---
def process_editing_request(prompt, image_bytes):
    """Calls the Gemini SDK editing function."""
    st.session_state.editing_status_message = "Processing..."
    st.session_state.edited_image_data = None

    st.info(f"Using Prompt: '{prompt}'")
    result_msg, result_bytes = trigger_gemini_editing_sdk(prompt=prompt, image_bytes=image_bytes)

    st.session_state.editing_status_message = result_msg
    st.session_state.edited_image_data = result_bytes
    st.rerun()

# --- 3. Action Button ---
st.divider()
st.subheader("3. Edit Image")
button_disabled = not (st.session_state.uploaded_file_data and st.session_state.edit_instruction)

if st.button(f"✨ Edit Image Now! (Using {MODEL_ID})", type="primary", disabled=button_disabled):
    with st.spinner("AI is editing the image... Please wait."):
        process_editing_request(
            st.session_state.edit_instruction,
            st.session_state.uploaded_file_data
        )

if button_disabled:
    st.warning("Please upload an image and provide an editing instruction.")

# --- 4. Display Status and Results ---
st.divider()
st.subheader("4. Status & Results")

# Display Status Message
status_message = st.session_state.editing_status_message
if status_message:
    if status_message.startswith("✅"): st.success(status_message)
    elif status_message.startswith("❌") or status_message.startswith("⚠️"): st.warning(status_message)
    else: st.info(status_message)

# Display Images Side-by-Side
col1, col2 = st.columns(2)
with col1:
    st.markdown("#### Before")
    if st.session_state.uploaded_file_data is not None:
        st.image(st.session_state.uploaded_file_data, use_container_width=True)
    else:
        st.info("Upload an image in section 1 to get started.")

with col2:
    st.markdown("#### After (Edited)")
    if st.session_state.edited_image_data is not None:
        st.image(st.session_state.edited_image_data, use_container_width=True)

        # --- Download Button ---
        st.download_button(
             label="⬇️ Download Edited Photo",
             data=st.session_state.edited_image_data,
             file_name="edited_image.png",
             mime="image/png"
         )
    else:
        if not status_message or not status_message.startswith("Processing..."):
             st.info("Edited image will appear here.")

# ======================================================================
# --- END: Streamlit UI ---
# ======================================================================



# ======================================================================
# --- START: Simple Streamlit UI (Connected to SDK Imagen Generation Backend) ---
# ======================================================================

st.title(f"AI Photo Stager (Test using {MODEL_ID})") # Show current model
st.write("Upload an interior photo (for context), select a style/room to **generate** an image.")

# --- Session State Initialization ---
if 'uploaded_file_data' not in st.session_state: st.session_state.uploaded_file_data = None
if 'uploaded_filename' not in st.session_state: st.session_state.uploaded_filename = None
if 'style_selection' not in st.session_state: st.session_state.style_selection = None
if 'room_type_selection' not in st.session_state: st.session_state.room_type_selection = None
if 'generated_image_data' not in st.session_state: st.session_state.generated_image_data = None
if 'staging_status_message' not in st.session_state: st.session_state.staging_status_message = ""

# --- 1. File Uploader (Context Only) ---
uploaded_file = st.file_uploader(
    "Upload an interior photo (Optional Context):",
    type=["jpg", "jpeg", "png", "webp"],
    help="This image will be shown as 'Before' but WON'T be edited by the generation model."
)

# --- Store Uploaded File Bytes & Name ---
if uploaded_file is not None:
    new_image_bytes = uploaded_file.getvalue()
    if st.session_state.uploaded_file_data != new_image_bytes:
        st.session_state.uploaded_file_data = new_image_bytes
        st.session_state.uploaded_filename = uploaded_file.name
        st.session_state.generated_image_data = None
        st.session_state.staging_status_message = ""
        print(f"New file uploaded: {uploaded_file.name}, stored in session state (CONTEXT ONLY).")

# --- 2. Select Generation Options ---
st.subheader("Select Generation Options:")
styles = ["Modern", "Farmhouse", "Mid-Century Modern", "Industrial", "Bohemian", "Scandinavian", "Coastal"]
room_types = ["Living Room", "Main Bedroom", "Guest Bedroom", "Dining Room", "Kitchen", "Office", "Entryway", "Basement"]

try: style_index = styles.index(st.session_state.style_selection)
except (ValueError, TypeError): style_index = 0
try: room_index = room_types.index(st.session_state.room_type_selection)
except (ValueError, TypeError): room_index = 0

selected_style = st.selectbox("Style:", styles, index=style_index)
selected_room_type = st.selectbox("Room Type:", room_types, index=room_index)

st.session_state.style_selection = selected_style
st.session_state.room_type_selection = selected_room_type

# --- Helper Function to Generate Imagen Prompt (for GENERATION) ---
def generate_imagen_generation_prompt(style, room_type):
    """Generates a prompt for Imagen generation."""
    prompt = f"Generate a photorealistic image of a {style} {room_type}. Ensure the room looks professionally designed and well-lit."
    print(f"Generated Imagen Prompt: {prompt}")
    return prompt

# --- Main Request Handling Function (Calls SDK Generation function) ---
def process_generation_request(style, room_type):
    """Generates prompt and calls the Imagen SDK generation function."""
    st.session_state.staging_status_message = "Processing..."
    st.session_state.generated_image_data = None

    # 1. Generate Prompt
    prompt = generate_imagen_generation_prompt(style, room_type)
    st.info(f"Using Prompt: '{prompt}'")

    # 2. Call Imagen Generation Function (using SDK)
    st.write(f"Triggering {MODEL_ID} SDK function...")
    result_msg, result_bytes = trigger_imagen_generation_sdk(prompt=prompt) # Use the SDK function

    # 3. Update State with Results
    st.session_state.staging_status_message = result_msg
    st.session_state.generated_image_data = result_bytes
    st.rerun()

# --- 3. Action Button ---
st.divider()
st.subheader("3. Generate Image")
button_disabled = not (st.session_state.style_selection and st.session_state.room_type_selection)

if st.button(f"✨ Generate Image Now! (Using {MODEL_ID})", type="primary", disabled=button_disabled):
    if not button_disabled:
        st.session_state.staging_status_message = "Processing..."
        st.session_state.generated_image_data = None
        with st.spinner("AI is generating the image... Please wait."):
            process_generation_request(
                st.session_state.style_selection,
                st.session_state.room_type_selection
            )

if button_disabled:
    st.warning("Please select a Style and Room Type.")

# --- 4. Display Status and Results ---
st.divider()
st.subheader("4. Status & Results")

# Display Status Message
status_message = st.session_state.staging_status_message
if status_message:
    if status_message.startswith("✅"): st.success(status_message)
    elif status_message.startswith("❌") or status_message.startswith("⚠️"): st.warning(status_message)
    else: st.info(status_message)

# Display Images Side-by-Side
col1, col2 = st.columns(2)
with col1:
    st.markdown("#### Uploaded Context Image (Before - Not Edited)")
    if st.session_state.uploaded_file_data is not None:
        st.image(st.session_state.uploaded_file_data, use_container_width=True)
    else:
        st.info("You can upload an image for context using section 1.")

with col2:
    st.markdown("#### Generated Image (After)")
    if st.session_state.generated_image_data is not None:
        st.image(st.session_state.generated_image_data, use_container_width=True)

        # --- Download Button ---
        if st.session_state.style_selection and st.session_state.room_type_selection:
             clean_style = str(st.session_state.style_selection).replace(" ", "_").lower()
             clean_room = str(st.session_state.room_type_selection).replace(" ", "_").lower()
             download_filename = f"generated_{clean_style}_{clean_room}.png"
        else:
             download_filename = "generated_image.png"

        st.download_button(
             label="⬇️ Download Generated Photo",
             data=st.session_state.generated_image_data,
             file_name=download_filename,
             mime="image/png"
         )
    else:
        if not status_message or not status_message.startswith("Processing..."):
             st.info("Generated image will appear here after processing.")

# ======================================================================
# --- END: Simple Streamlit UI (Connected to SDK Imagen Generation Backend) ---
# ======================================================================