# AWS Lambda Python 3.12 with audio analysis libraries
FROM public.ecr.aws/lambda/python:3.12

# Install FFmpeg - AWS Lambda images use microdnf
RUN microdnf install -y wget tar xz && \
    # Download static FFmpeg build (verified working)
    cd /tmp && \
    wget -q https://johnvansickle.com/ffmpeg/releases/ffmpeg-release-amd64-static.tar.xz && \
    tar xf ffmpeg-release-amd64-static.tar.xz && \
    cd ffmpeg-*-amd64-static && \
    cp ffmpeg /usr/local/bin/ && \
    cp ffprobe /usr/local/bin/ && \
    chmod +x /usr/local/bin/ffmpeg /usr/local/bin/ffprobe && \
    cd / && \
    rm -rf /tmp/ffmpeg* && \
    microdnf clean all

# Verify FFmpeg installation
RUN ffmpeg -version

# Set working directory
WORKDIR ${LAMBDA_TASK_ROOT}

# Install system dependencies for aubio
RUN microdnf install -y gcc python3-devel

# Install Python audio analysis libraries (aubio instead of librosa - no numba!)
RUN pip install --no-cache-dir \
    aubio==0.4.9 \
    numpy==1.26.4 \
    boto3==1.34.44 \
    pydub==0.25.1

# Copy Python handler
COPY handler.py ${LAMBDA_TASK_ROOT}/

# Set environment variables
ENV FFMPEG_PATH=/usr/local/bin/ffmpeg
ENV PATH=/usr/local/bin:$PATH
ENV PYTHONUNBUFFERED=1
ENV NUMBA_CACHE_DIR=/tmp
ENV NUMBA_DISABLE_JIT=1

# Set the CMD to Python handler
CMD [ "handler.lambda_handler" ]
