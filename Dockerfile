# Use an official Python runtime as a parent image
FROM python:3.11-slim

# Set the working directory in the container
WORKDIR /app

# Copy the dependencies file to the working directory
COPY requirements.txt .

# Install any needed packages specified in requirements.txt
# --no-cache-dir: Disables the cache, which is useful for keeping image sizes down.
# --trusted-host pypi.python.org: Helps with potential network issues in some container environments.
RUN pip install --no-cache-dir --trusted-host pypi.python.org -r requirements.txt

# Copy the rest of the application's code to the working directory
COPY app.py .

# Make port 8501 available to the world outside this container
EXPOSE 8501

# Define environment variable
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s \
  CMD curl -f http://localhost:8501/_stcore/health

# Run app.py when the container launches
CMD ["streamlit", "run", "app.py", "--server.port=8501", "--server.address=0.0.0.0"]
