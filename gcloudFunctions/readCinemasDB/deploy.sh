#!/bin/bash

gcloud functions deploy queryCinemas \
  --runtime nodejs18 \
  --trigger-http \
  --set-env-vars GOOGLE_APPLICATION_CREDENTIALS=./cinebot-7f35b-firebase-adminsdk-y21xb-fca4d93734.json \
  --allow-unauthenticated

# Make the script executable: chmod +x deploy.sh
# You can then deploy the function by running: ./deploy.sh
