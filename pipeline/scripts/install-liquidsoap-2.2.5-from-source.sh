#!/bin/bash
################################################################################
# INSTALL LIQUIDSOAP 2.2.5 FROM SOURCE - EXPERT COMPILATION
################################################################################

set -e
set -u
set -o pipefail

echo "🚀 COMPILING LIQUIDSOAP 2.2.5 FROM SOURCE"
echo "========================================="
echo ""

# Install OPAM (OCaml Package Manager)
echo "📦 Installing OPAM..."
sudo apt install -y opam m4 pkg-config libpcre3-dev

# Initialize OPAM
echo "🔧 Initializing OPAM..."
opam init -y --disable-sandboxing
eval $(opam env)

# Create a switch for Liquidsoap
echo "🔄 Creating OCaml switch..."
opam switch create 4.14.0 -y
eval $(opam env)

# Install system dependencies
echo "📚 Installing system dependencies..."
sudo apt install -y \
  build-essential \
  libssl-dev \
  libsamplerate0-dev \
  libtaglib-ocaml-dev \
  libmad0-dev \
  libflac-dev \
  libogg-dev \
  libvorbis-dev \
  libmp3lame-dev \
  libopus-dev \
  libfaad-dev \
  libspeex-dev \
  libtheora-dev \
  libx264-dev \
  libavutil-dev \
  libavcodec-dev \
  libavformat-dev \
  libswresample-dev \
  libswscale-dev \
  libavfilter-dev \
  libasound2-dev \
  libpulse-dev \
  libjack-dev \
  liblo-dev \
  libportaudio2 \
  libsdl2-dev \
  libgstreamer1.0-dev \
  libgstreamer-plugins-base1.0-dev \
  ffmpeg \
  sox \
  libsox-dev \
  libsox-fmt-all

# Install OCaml dependencies via OPAM
echo "🔧 Installing OCaml dependencies..."
opam install -y \
  dune \
  ocamlfind \
  menhir \
  sedlex \
  ppx_string \
  pcre \
  cry \
  mm \
  xmlplaylist \
  lastfm \
  ogg \
  vorbis \
  opus \
  flac \
  lame \
  mad \
  faad \
  taglib \
  camomile \
  magic-mime \
  samplerate \
  gavl \
  ffmpeg-av \
  ffmpeg-avutil \
  ffmpeg-avcodec \
  ffmpeg-avfilter \
  ffmpeg-avdevice \
  ffmpeg-swscale \
  ffmpeg-swresample \
  pulseaudio \
  alsa \
  ao \
  portaudio \
  ssl \
  sha \
  uri

# Download Liquidsoap 2.2.5
echo "⬇️ Downloading Liquidsoap 2.2.5..."
cd /tmp
wget https://github.com/savonet/liquidsoap/releases/download/v2.2.5/liquidsoap-2.2.5.tar.bz2
tar -xjf liquidsoap-2.2.5.tar.bz2
cd liquidsoap-2.2.5

# Configure
echo "🔧 Configuring..."
./configure --prefix=/usr/local --with-user=ubuntu --with-group=ubuntu

# Compile (this will take 10-15 minutes!)
echo "🏗️ Compiling (this will take 10-15 minutes)..."
make

# Install
echo "📥 Installing..."
sudo make install

# Verify
echo ""
echo "✅ Installation complete!"
echo ""
liquidsoap --version

echo ""
echo "🎉 Liquidsoap 2.2.5 compiled and installed successfully!"
