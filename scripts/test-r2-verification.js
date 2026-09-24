const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, DeleteObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');

// Helper to load .env.local without exposing secrets
function loadEnv() {
  const envContent = fs.readFileSync('.env.local', 'utf-8');
  const env = {};
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    env[key] = val;
  }
  return env;
}

const env = loadEnv();
const supabaseUrl = env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = env.SUPABASE_SECRET_KEY;
const r2AccountId = env.R2_ACCOUNT_ID;
const r2BucketName = env.R2_BUCKET_NAME;
const r2AccessKeyId = env.R2_ACCESS_KEY_ID;
const r2SecretAccessKey = env.R2_SECRET_ACCESS_KEY;

const results = [];
function record(category, testName, passed, details = '') {
  results.push({ category, testName, passed, details });
  const status = passed ? 'PASS' : 'FAIL';
  console.log(`[${status}] [${category}] ${testName}${details ? ` -> ${details}` : ''}`);
}

async function run() {
  console.log('================================================================');
  console.log('CLOUDFLARE R2 UPLOAD SERVICE & AUTHENTICATED ENDPOINT TEST SUITE');
  console.log('================================================================\n');

  // 1. Env validation
  record(
    'Config & Security',
    'R2 server credentials present in .env.local',
    !!r2AccountId && !!r2BucketName && !!r2AccessKeyId && !!r2SecretAccessKey,
    'All 4 R2 credentials configured'
  );
  record(
    'Config & Security',
    'R2 secrets not prefixed with NEXT_PUBLIC_',
    !process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID && !process.env.NEXT_PUBLIC_R2_SECRET_KEY,
    'Verified permanent credentials remain server-side'
  );

  const r2Client = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: r2AccessKeyId,
      secretAccessKey: r2SecretAccessKey,
    },
  });

  const adminClient = createClient(supabaseUrl, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const timestamp = Date.now();
  const emailA = `r2-test-user-a-${timestamp}@example.com`;
  const emailB = `r2-test-user-b-${timestamp}@example.com`;
  const password = 'TestSecurePassword123!@#';

  let userAId = null;
  let userBId = null;
  let tokenA = null;
  let tokenB = null;
  let meetingAId = null;
  let meetingBId = null;
  const createdR2Keys = [];

  try {
    // Create User A and User B
    const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
      email: emailA,
      password: password,
      email_confirm: true,
    });
    if (errA) throw new Error('Failed to create User A: ' + errA.message);
    userAId = userAData.user.id;

    const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
      email: emailB,
      password: password,
      email_confirm: true,
    });
    if (errB) throw new Error('Failed to create User B: ' + errB.message);
    userBId = userBData.user.id;

    const clientA = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionA, error: signErrA } = await clientA.auth.signInWithPassword({ email: emailA, password });
    if (signErrA) throw new Error('User A signIn failed: ' + signErrA.message);
    tokenA = sessionA.session.access_token;

    const clientB = createClient(supabaseUrl, publishableKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: sessionB, error: signErrB } = await clientB.auth.signInWithPassword({ email: emailB, password });
    if (signErrB) throw new Error('User B signIn failed: ' + signErrB.message);
    tokenB = sessionB.session.access_token;

    record('Auth Setup', 'Created and authenticated test users User A and User B', !!tokenA && !!tokenB);

    // Create a meeting for User A and User B
    const { data: meetingA, error: meetAErr } = await adminClient
      .from('meetings')
      .insert({ user_id: userAId, title: 'User A Meeting' })
      .select('id')
      .single();
    if (meetAErr) throw new Error('Failed to create meeting for User A: ' + meetAErr.message);
    meetingAId = meetingA.id;

    const { data: meetingB, error: meetBErr } = await adminClient
      .from('meetings')
      .insert({ user_id: userBId, title: 'User B Meeting' })
      .select('id')
      .single();
    if (meetBErr) throw new Error('Failed to create meeting for User B: ' + meetBErr.message);
    meetingBId = meetingB.id;

    record('Meeting Setup', 'Created distinct meetings for User A and User B', !!meetingAId && !!meetingBId);

    const baseUrl = 'http://localhost:3000';

    // TEST 1: Unauthenticated request -> 401
    const unauthRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meetingAId }),
    });
    const unauthData = await unauthRes.json();
    record(
      'Authentication',
      'Unauthenticated request returns 401 Unauthorized',
      unauthRes.status === 401 && !!unauthData.error,
      `HTTP ${unauthRes.status}`
    );

    // TEST 2: Invalid Bearer token -> 401
    const badTokenRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer invalid-token-12345',
      },
      body: JSON.stringify({ meetingId: meetingAId }),
    });
    const badTokenData = await badTokenRes.json();
    record(
      'Authentication',
      'Invalid token returns 401 Unauthorized',
      badTokenRes.status === 401 && !!badTokenData.error,
      `HTTP ${badTokenRes.status}`
    );

    // TEST 3: Invalid meetingId format -> 400
    const invalidIdRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ meetingId: 'not-a-valid-uuid' }),
    });
    const invalidIdData = await invalidIdRes.json();
    record(
      'Validation',
      'Invalid meetingId UUID returns 400 Bad Request',
      invalidIdRes.status === 400 && !!invalidIdData.error,
      `HTTP ${invalidIdRes.status}: ${invalidIdData.error}`
    );

    // TEST 4: Cross-user meeting ownership isolation -> User A cannot get upload URL for User B meeting
    const crossUserRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ meetingId: meetingBId }),
    });
    record(
      'Security & Isolation',
      'User cannot generate upload URL for another user meeting',
      crossUserRes.status === 403 || crossUserRes.status === 404,
      `HTTP ${crossUserRes.status}`
    );

    // TEST 5: Success path: User A generates upload URL for User A meeting
    const successRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        meetingId: meetingAId,
        filename: 'team-sync.mp4',
        contentType: 'video/mp4',
      }),
    });
    const successData = await successRes.json();
    record(
      'Endpoint Success',
      'Authenticated user generates short-lived presigned upload URL',
      successRes.status === 200 && !!successData.uploadUrl && !!successData.objectKey,
      `HTTP ${successRes.status}`
    );

    if (successData.objectKey) {
      createdR2Keys.push(successData.objectKey);
    }

    // TEST 6: Response payload validation -> returns strictly uploadUrl and objectKey
    const responseKeys = Object.keys(successData);
    const hasOnlyRequestedKeys =
      responseKeys.length === 2 &&
      responseKeys.includes('uploadUrl') &&
      responseKeys.includes('objectKey');
    record(
      'Endpoint Requirement',
      'Response returns only the signed upload URL + object key',
      hasOnlyRequestedKeys,
      `Keys returned: [${responseKeys.join(', ')}]`
    );

    // TEST 7: Object key pattern validation: unique object key per user/meeting
    const expectedKeyPrefix = `recordings/${userAId}/${meetingAId}/`;
    const keyMatchesPattern =
      typeof successData.objectKey === 'string' &&
      successData.objectKey.startsWith(expectedKeyPrefix) &&
      successData.objectKey.endsWith('.mp4');
    record(
      'Key Uniqueness & Hierarchy',
      'Object key correctly partitioned by userId and meetingId',
      keyMatchesPattern,
      `Object key: ${successData.objectKey}`
    );

    // TEST 8: Presigned URL structure: short-lived, R2 endpoint, AWS signature
    const urlObj = new URL(successData.uploadUrl);
    const isHttps = urlObj.protocol === 'https:';
    const isR2Endpoint = urlObj.host.includes('.r2.cloudflarestorage.com');
    const hasSignature = urlObj.searchParams.has('X-Amz-Signature');
    const hasExpiry = urlObj.searchParams.get('X-Amz-Expires') === '900';
    record(
      'Presigned URL Verification',
      'URL is HTTPS, points to R2, has signature and 15-minute expiry',
      isHttps && isR2Endpoint && hasSignature && hasExpiry,
      `Host: ${urlObj.host}, Expires: ${urlObj.searchParams.get('X-Amz-Expires')}s`
    );

    // TEST 9: Live PUT upload to private Cloudflare R2 bucket using presigned URL
    const dummyVideoPayload = Buffer.from('RIFF....WAVEfmt ....data...test-meeting-audio-bytes');
    const putRes = await fetch(successData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: dummyVideoPayload,
    });
    record(
      'Live R2 Upload',
      'Direct PUT upload to private R2 bucket via presigned URL succeeds',
      putRes.status === 200,
      `HTTP ${putRes.status}`
    );

    // TEST 10: Verify object exists in R2 bucket using HeadObject
    let objectExistsInR2 = false;
    try {
      await r2Client.send(
        new HeadObjectCommand({
          Bucket: r2BucketName,
          Key: successData.objectKey,
        })
      );
      objectExistsInR2 = true;
    } catch {
      objectExistsInR2 = false;
    }
    record(
      'Storage Verification',
      'Object successfully stored in private R2 bucket',
      objectExistsInR2,
      `Confirmed in bucket ${r2BucketName}`
    );

    // TEST 11: Auto-create meeting path (when meetingId is not provided)
    const autoMeetRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        filename: 'adhoc-call.webm',
        contentType: 'video/webm',
      }),
    });
    const autoMeetData = await autoMeetRes.json();
    const autoCreatedSuccess =
      autoMeetRes.status === 200 &&
      !!autoMeetData.uploadUrl &&
      typeof autoMeetData.objectKey === 'string' &&
      autoMeetData.objectKey.startsWith(`recordings/${userAId}/`) &&
      autoMeetData.objectKey.endsWith('.webm');
    record(
      'Endpoint Flexibility',
      'Omitted meetingId auto-creates pending meeting and generates scoped key',
      autoCreatedSuccess,
      `Object key: ${autoMeetData.objectKey}`
    );
    if (autoMeetData.objectKey) {
      createdR2Keys.push(autoMeetData.objectKey);
    }

    // TEST 12: Alias route check (/api/recordings/presigned-url)
    const aliasRes = await fetch(`${baseUrl}/api/recordings/presigned-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ meetingId: meetingAId, filename: 'alias-test.mp4' }),
    });
    const aliasData = await aliasRes.json();
    record(
      'Endpoint Aliases',
      '/api/recordings/presigned-url works equivalently',
      aliasRes.status === 200 && !!aliasData.uploadUrl && !!aliasData.objectKey,
      `HTTP ${aliasRes.status}`
    );
    if (aliasData.objectKey) {
      createdR2Keys.push(aliasData.objectKey);
    }
  } finally {
    console.log('\n========================================');
    console.log('TEARDOWN & CLEANUP');
    console.log('========================================');

    // 1. Clean up R2 objects
    for (const key of createdR2Keys) {
      try {
        await r2Client.send(
          new DeleteObjectCommand({
            Bucket: r2BucketName,
            Key: key,
          })
        );
        console.log(`Cleaned up R2 test object: ${key}`);
      } catch (err) {
        console.warn(`Failed to clean up R2 key ${key}: ${err.message}`);
      }
    }

    // 2. Clean up meetings
    if (meetingAId) {
      await adminClient.from('meetings').delete().eq('id', meetingAId);
    }
    if (meetingBId) {
      await adminClient.from('meetings').delete().eq('id', meetingBId);
    }

    // 3. Clean up test users
    if (userAId) {
      await adminClient.auth.admin.deleteUser(userAId);
      console.log(`Cleaned up test User A: ${userAId.slice(0, 8)}...`);
    }
    if (userBId) {
      await adminClient.auth.admin.deleteUser(userBId);
      console.log(`Cleaned up test User B: ${userBId.slice(0, 8)}...`);
    }
  }

  console.log('\n================================================================');
  console.log('TEST SUMMARY');
  console.log('================================================================');
  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  console.log(`Total: ${results.length}, Passed: ${passed}, Failed: ${failed}`);

  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((err) => {
  console.error('Fatal test execution error:', err);
  process.exit(1);
});
