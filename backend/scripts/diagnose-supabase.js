import { supabaseAdmin, STORAGE_BUCKETS } from '../src/config/supabase.js';
import { prisma } from '../src/config/database.js';

async function diagnose() {
  console.log('Starting MITCON Credentia Diagnostics...\n');

  // 1. Check Database connection
  console.log('1. Checking Prisma PostgreSQL connection...');
  try {
    const userCount = await prisma.user.count();
    const documentCount = await prisma.document.count();
    const checkoutCount = await prisma.checkout.count();
    const returnCount = await prisma.return.count();
    const notificationCount = await prisma.notification.count();

    console.log(`Database connection successful!`);
    console.log(`  - Total Users: ${userCount}`);
    console.log(`  - Total Documents: ${documentCount}`);
    console.log(`  - Total Checkouts: ${checkoutCount}`);
    console.log(`  - Total Returns: ${returnCount}`);
    console.log(`  - Total Notifications: ${notificationCount}`);
  } catch (err) {
    console.error('Database connection failed:', err.message);
  }

  // 2. Check Supabase connection
  console.log('\n📡 2. Checking Supabase credentials and listing buckets...');
  try {
    const { data: buckets, error } = await supabaseAdmin.storage.listBuckets();
    if (error) throw error;

    console.log('Supabase connection successful!');
    console.log('Existing Buckets:', buckets.map(b => `${b.name} (${b.public ? 'public' : 'private'})`));

    // 3. Verify and Create required buckets if missing
    console.log('\n3. Verifying required storage buckets...');
    const requiredBuckets = Object.values(STORAGE_BUCKETS);
    const existingBucketNames = buckets.map(b => b.name);

    for (const bucketName of requiredBuckets) {
      if (existingBucketNames.includes(bucketName)) {
        console.log(`Bucket "${bucketName}" exists.`);
      } else {
        console.log(`Bucket "${bucketName}" is missing! Attempting to create it...`);
        const { error: createError } = await supabaseAdmin.storage.createBucket(bucketName, {
          public: false,
          fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
        });
        if (createError) {
          console.error(`Failed to create bucket "${bucketName}":`, createError.message);
        } else {
          console.log(`Successfully created bucket "${bucketName}"!`);
        }
      }
    }
  } catch (err) {
    console.error('Supabase storage connection failed:', err.message);
    console.log('\n💡 Tip: Make sure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set correctly in your environment variables.');
  }

  console.log('\nDiagnostics complete.');
}

diagnose()
  .catch(err => {
    console.error('Fatal error during diagnostics:', err);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
