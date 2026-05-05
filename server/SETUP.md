# Server Setup (one-time)

## 1. On your Ubuntu server

```bash
# Install Node.js (v20+)
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt-get install -y nodejs

# Create directory structure
sudo mkdir -p /var/www/scorm-quizzer/public
sudo mkdir -p /var/www/scorm-quizzer/server

# Upload server files (from your local machine)
scp server.js package.json user@your-server:/var/www/scorm-quizzer/server/

# Install dependencies
cd /var/www/scorm-quizzer/server
npm install

# Upload public files (from your local machine)
scp ../scorm-builder.html user@your-server:/var/www/scorm-quizzer/public/
scp -r ../assets user@your-server:/var/www/scorm-quizzer/public/
```

## 2. Set up nginx

```bash
# Copy the nginx config
sudo cp /var/www/scorm-quizzer/server/nginx.conf /etc/nginx/sites-available/scorm-quizzer

# Edit it to set your domain/IP
sudo nano /etc/nginx/sites-available/scorm-quizzer

# Enable it
sudo ln -s /etc/nginx/sites-available/scorm-quizzer /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 3. Run the API server with PM2 (keeps it alive after reboot)

```bash
sudo npm install -g pm2
cd /var/www/scorm-quizzer/server
pm2 start server.js --name scorm-api
pm2 save
pm2 startup  # follow the printed command to enable auto-start
```

## Deploying updates (from your local machine)

### HTML + assets only (most common)
Just run the deploy script — the database is never touched:
```bash
cd server
./deploy.sh user@your-server-ip
```

### When server.js changes (new API endpoints, bug fixes)
Copy the updated server file and restart the Node process:
```bash
scp server/server.js tpraag@quizzer.nvidia.com:/var/www/scorm-quizzer/server/
ssh tpraag@quizzer.nvidia.com "pm2 restart scorm-api"
```

## After uploading assets — fix permissions

Every time you SCP new files to the server, uploaded files may not be readable by nginx.
Run these two commands on the server after any asset upload:

```bash
sudo chmod -R 644 /var/www/scorm-quizzer/public/assets/
sudo find /var/www/scorm-quizzer/public/assets/ -type d -exec chmod 755 {} \;
```

The first makes all files world-readable. The second makes directories traversable (required for nginx to serve files inside them).

To make future uploads automatically get the right permissions, add this to `~/.bashrc` on the server (one-time):
```bash
echo 'umask 022' >> ~/.bashrc
```

## File layout on server

```
/var/www/scorm-quizzer/
├── public/              ← updated by deploy script
│   ├── scorm-builder.html
│   └── assets/
└── server/              ← never touched by deploys
    ├── server.js
    ├── package.json
    ├── node_modules/
    └── db.sqlite        ← your database, persists forever
```
