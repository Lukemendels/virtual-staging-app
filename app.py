import streamlit as st
# import io # Might need later if processing image bytes directly
# from PIL import Image # Might need later to work with images

st.set_page_config(layout="wide")

st.title("Virtual Staging Assistant")

st.write("Welcome! Upload your real estate photos for virtual staging.")
st.write("---") # Separator

# --- File Uploader ---
# Use the main area (not sidebar) for the uploader
uploaded_files = st.file_uploader(
    "Choose image files",
    type=["png", "jpg", "jpeg"], # Allowed file types
    accept_multiple_files=True  # Allow uploading multiple files at once
)

# --- Display Uploaded Files (Optional but helpful) ---
if uploaded_files:
    st.write("---") # Separator
    st.subheader("Uploaded Files:")
    for uploaded_file in uploaded_files:
        # To display file details:
        st.write(f"- {uploaded_file.name} ({uploaded_file.size} bytes)")

        # To display the image itself (optional for now):
        # try:
        #     # Read image bytes and display
        #     image = Image.open(uploaded_file)
        #     st.image(image, caption=uploaded_file.name, width=300) # Adjust width as needed
        # except Exception as e:
        #     st.error(f"Could not display image {uploaded_file.name}: {e}")

else:
    st.info("Please upload one or more image files.")


# --- Sidebar (can stay as is for now) ---
st.sidebar.header("Controls")
st.sidebar.write("Staging options will go here.")