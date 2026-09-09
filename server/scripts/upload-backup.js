// Pushes the latest local DB dump to the same R2 bucket that already stores
// post media, under a backups/ prefix — so the backup survives even if this
// Mac is off or dies, without needing a new cloud account.
require('dotenv').config({ path: require('path').join(__dirname, '..', '.env') });
const { S3Client, PutObjectCommand } = require('@aws-sdk/client-s3');
const fs = require('fs');
const path = require('path');

const filePath = process.argv[2];
if (!filePath) {
  console.error('upload-backup: no file path given');
  process.exit(1);
}

const client = new S3Client({
  region: 'auto',
  endpoint: process.env.STORAGE_ENDPOINT,
  credentials: {
    accessKeyId: process.env.STORAGE_ACCESS_KEY_ID ?? '',
    secretAccessKey: process.env.STORAGE_SECRET_ACCESS_KEY ?? '',
  },
});

const bucket = process.env.STORAGE_BUCKET ?? 'spindare-assets';
const key = `backups/${path.basename(filePath)}`;

client
  .send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      Body: fs.readFileSync(filePath),
      ContentType: 'application/gzip',
    }),
  )
  .then(() => console.log(`upload-backup: uploaded to r2://${bucket}/${key}`))
  .catch((err) => {
    console.error('upload-backup: failed —', err.message);
    process.exit(1);
  });
