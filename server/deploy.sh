#!/bin/bash
# Deploy script — updates only the public files, never touches the database or server/
# Usage: ./deploy.sh user@your-server-ip

SERVER=${1:-"user@your-server-ip"}
PUBLIC_DIR="/var/www/scorm-quizzer/public"

echo "Deploying to $SERVER..."
rsync -avz --delete \
  ../scorm-builder.html \
  ../assets/ \
  $SERVER:$PUBLIC_DIR/

echo "Fixing file permissions..."
ssh $SERVER "sudo chmod -R 644 $PUBLIC_DIR/assets/ && sudo find $PUBLIC_DIR/assets/ -type d -exec chmod 755 {} \;"

echo "Done. Database and server unchanged."
