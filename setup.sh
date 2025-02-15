#!/bin/bash

echo "Installing root dependencies..."
yarn install

echo "Installing backend dependencies..."
cd backend && yarn install && cd ..

echo "Installing frontend dependencies..."
cd frontend && yarn install && cd ..

echo "Installation complete!"