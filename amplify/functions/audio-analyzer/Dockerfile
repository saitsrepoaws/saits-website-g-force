# AWS Lambda Node.js 20 with FFmpeg
FROM public.ecr.aws/lambda/nodejs:20

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

# Copy package files
COPY package*.json ./

# Install Node.js dependencies
RUN npm ci --omit=dev

# Copy function code
COPY *.ts ./
COPY *.js ./

# Set FFmpeg path for runtime
ENV FFMPEG_PATH=/usr/local/bin/ffmpeg
ENV PATH=/usr/local/bin:$PATH

# Set the CMD to your handler
CMD [ "handler.handler" ]
