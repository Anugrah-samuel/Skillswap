#!/bin/bash
# Render build script - ensures clean build

echo "Cleaning previous builds..."
rm -rf dist node_modules package-lock.json

echo "Installing dependencies..."
npm install

echo "Building client with Vite..."
npx vite build

echo "Build complete - server will run with tsx!"
