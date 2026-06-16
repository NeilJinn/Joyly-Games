#!/bin/bash
cd "$(dirname "$0")"
exec python3 tools/voice_library_generator.py
