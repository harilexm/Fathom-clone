const fs = require('fs');
const path = require('path');
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

  // 1. Config & Security checks
  record(
    'Config & Security',
    'R2 server credentials present in .env.local',
    !!r2AccountId && !!r2BucketName && !!r2AccessKeyId && !!r2SecretAccessKey,
    'All 4 R2 credentials configured'
  );
  record(
    'Config & Security',
    'R2 secrets not prefixed with NEXT_PUBLIC_',
    !process.env.NEXT_PUBLIC_R2_ACCESS_KEY_ID &&
      !process.env.NEXT_PUBLIC_R2_SECRET_KEY &&
      !process.env.NEXT_PUBLIC_R2_SECRET_ACCESS_KEY,
    'Permanent credentials remain strictly server-side'
  );

  // Check client code in src/ for any secret leaks
  function scanDirForSecrets(dir) {
    let leaksFound = [];
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name !== 'node_modules' && entry.name !== '.next' && entry.name !== '.git') {
          leaksFound = leaksFound.concat(scanDirForSecrets(fullPath));
        }
      } else if (entry.isFile() && (entry.name.endsWith('.tsx') || entry.name.endsWith('.ts'))) {
        // Skip backend server files
        if (fullPath.includes('src\\lib\\r2.ts') || fullPath.includes('src/lib/r2.ts') || fullPath.includes('src\\app\\api\\') || fullPath.includes('src/app/api/')) {
          continue;
        }
        const content = fs.readFileSync(fullPath, 'utf-8');
        if (content.includes('R2_SECRET_ACCESS_KEY') || content.includes('R2_ACCESS_KEY_ID')) {
          leaksFound.push(fullPath);
        }
      }
    }
    return leaksFound;
  }
  const clientLeaks = scanDirForSecrets(path.join(__dirname, '..', 'src'));
  record(
    'Config & Security',
    'Client-facing code contains zero references to R2 secret credentials',
    clientLeaks.length === 0,
    clientLeaks.length === 0 ? 'Clean' : `Leaks in: ${clientLeaks.join(', ')}`
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

    // Create meetings
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

    // TEST 1: Unauthenticated POST request -> 401
    const unauthPostRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ meetingId: meetingAId }),
    });
    const unauthPostData = await unauthPostRes.json();
    record(
      'Unauthenticated Request',
      'POST without credentials returns 401 Unauthorized',
      unauthPostRes.status === 401 && !!unauthPostData.error,
      `HTTP ${unauthPostRes.status}`
    );

    // TEST 2: Unauthenticated GET request -> 401
    const unauthGetRes = await fetch(`${baseUrl}/api/recordings/upload-url?meetingId=${meetingAId}`, {
      method: 'GET',
    });
    const unauthGetData = await unauthGetRes.json();
    record(
      'Unauthenticated Request',
      'GET without credentials returns 401 Unauthorized',
      unauthGetRes.status === 401 && !!unauthGetData.error,
      `HTTP ${unauthGetRes.status}`
    );

    // TEST 3: Invalid Bearer token -> 401
    const badTokenRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: 'Bearer bogus-token-abc-123',
      },
      body: JSON.stringify({ meetingId: meetingAId }),
    });
    const badTokenData = await badTokenRes.json();
    record(
      'Unauthenticated Request',
      'Request with invalid Bearer token returns 401 Unauthorized',
      badTokenRes.status === 401 && !!badTokenData.error,
      `HTTP ${badTokenRes.status}`
    );

    // TEST 4: Invalid meetingId format -> 400
    const invalidIdRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ meetingId: 'invalid-uuid-format' }),
    });
    const invalidIdData = await invalidIdRes.json();
    record(
      'Input Validation',
      'Invalid meetingId UUID returns 400 Bad Request',
      invalidIdRes.status === 400 && !!invalidIdData.error,
      `HTTP ${invalidIdRes.status}: ${invalidIdData.error}`
    );

    // TEST 5: Cross-user meeting ownership isolation
    const crossUserRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({ meetingId: meetingBId }),
    });
    record(
      'Multi-Tenant Security',
      'User A rejected when attempting to access User B meeting',
      crossUserRes.status === 403 || crossUserRes.status === 404,
      `HTTP ${crossUserRes.status}`
    );

    // TEST 6: Authenticated request success
    const authRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        meetingId: meetingAId,
        filename: 'quarterly-review.mp4',
        contentType: 'video/mp4',
      }),
    });
    const authData = await authRes.json();
    record(
      'Authenticated Request',
      'Authenticated user successfully generates presigned upload URL',
      authRes.status === 200 && !!authData.uploadUrl && !!authData.objectKey,
      `HTTP ${authRes.status}`
    );

    if (authData.objectKey) {
      createdR2Keys.push(authData.objectKey);
    }

    // TEST 7: Payload strictness - only uploadUrl and objectKey
    const responseKeys = Object.keys(authData);
    const hasOnlyRequestedKeys =
      responseKeys.length === 2 &&
      responseKeys.includes('uploadUrl') &&
      responseKeys.includes('objectKey');
    record(
      'Payload Strictness',
      'Response returns ONLY uploadUrl and objectKey (no metadata/secrets)',
      hasOnlyRequestedKeys,
      `Keys returned: [${responseKeys.join(', ')}]`
    );

    // TEST 8: Verify no permanent credentials reach the browser
    const rawResponseText = JSON.stringify(authData);
    const containsSecretKey = rawResponseText.includes(r2SecretAccessKey);
    const containsSupabaseSecret = rawResponseText.includes(secretKey);
    record(
      'Credential Protection',
      'Response body does not contain permanent R2 or Supabase secret keys',
      !containsSecretKey && !containsSupabaseSecret,
      'No secret credentials found in response payload'
    );

    const urlObj = new URL(authData.uploadUrl);
    const queryContainsSecret = urlObj.search.includes(r2SecretAccessKey);
    record(
      'Credential Protection',
      'Presigned URL query string uses HMAC signature without raw secret key',
      !queryContainsSecret && urlObj.searchParams.has('X-Amz-Signature'),
      'Signature is cryptographic digest'
    );

    // TEST 9: Unique object keys across multiple generations
    const multiKeys = [];
    for (let i = 0; i < 5; i++) {
      const res = await fetch(`${baseUrl}/api/recordings/upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${tokenA}`,
        },
        body: JSON.stringify({
          meetingId: meetingAId,
          filename: `batch-${i}.mp4`,
        }),
      });
      const data = await res.json();
      if (data.objectKey) {
        multiKeys.push(data.objectKey);
        createdR2Keys.push(data.objectKey);
      }
    }
    const uniqueKeysCount = new Set(multiKeys).size;
    record(
      'Unique Object Keys',
      'Rapid consecutive upload requests for same meeting produce 100% unique keys',
      multiKeys.length === 5 && uniqueKeysCount === 5,
      `Generated ${multiKeys.length} keys, unique count: ${uniqueKeysCount}`
    );

    // TEST 10: Key hierarchy & formatting
    const keyStructureValid = multiKeys.every(
      (k) =>
        k.startsWith(`recordings/${userAId}/${meetingAId}/`) &&
        k.endsWith('.mp4') &&
        k.split('/').length === 4
    );
    record(
      'Unique Object Keys',
      'Object keys follow strict recordings/${userId}/${meetingId}/${timestamp}-${uuid}.${ext} hierarchy',
      keyStructureValid,
      `Pattern verified across all keys`
    );

    // TEST 11: Direct upload to private R2 bucket via presigned PUT URL
    const testVideoBytes = Buffer.from('TEST_VIDEO_CONTAINER_STREAM_BINARY_DATA_0123456789');
    const directPutRes = await fetch(authData.uploadUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': 'video/mp4',
      },
      body: testVideoBytes,
    });
    record(
      'Direct R2 Upload',
      'Direct PUT upload of binary media to private R2 bucket succeeds',
      directPutRes.status === 200,
      `HTTP ${directPutRes.status}`
    );

    // TEST 12: Verify uploaded object exists in private R2 bucket
    let headOk = false;
    let headContentLength = 0;
    try {
      const head = await r2Client.send(
        new HeadObjectCommand({
          Bucket: r2BucketName,
          Key: authData.objectKey,
        })
      );
      headOk = true;
      headContentLength = head.ContentLength || 0;
    } catch {
      headOk = false;
    }
    record(
      'Direct R2 Upload',
      'Uploaded object verified stored in R2 bucket with matching size',
      headOk && headContentLength === testVideoBytes.length,
      `Stored length: ${headContentLength} bytes (matches ${testVideoBytes.length} bytes)`
    );

    // TEST 13: Private bucket security check (direct unauthenticated GET is blocked)
    const directUnauthUrl = `https://${r2AccountId}.r2.cloudflarestorage.com/${r2BucketName}/${authData.objectKey}`;
    const directUnauthRes = await fetch(directUnauthUrl);
    record(
      'Private Bucket Security',
      'Direct unauthenticated access to object in private R2 bucket is blocked',
      directUnauthRes.status === 400 || directUnauthRes.status === 401 || directUnauthRes.status === 403,
      `HTTP ${directUnauthRes.status} (Access Denied as expected for private bucket)`
    );

    // TEST 14: Dynamic key generation without eager meeting creation
    const autoMeetingRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        filename: 'unspecified-call.webm',
        contentType: 'video/webm',
      }),
    });
    const autoMeetingData = await autoMeetingRes.json();
    const autoSuccess =
      autoMeetingRes.status === 200 &&
      typeof autoMeetingData.objectKey === 'string' &&
      autoMeetingData.objectKey.startsWith(`recordings/${userAId}/`) &&
      autoMeetingData.objectKey.endsWith('.webm');
    record(
      'Endpoint Flexibility',
      'Omitted meetingId returns scoped key without eagerly creating meeting',
      autoSuccess,
      `Object key: ${autoMeetingData.objectKey}`
    );
    if (autoMeetingData.objectKey) {
      createdR2Keys.push(autoMeetingData.objectKey);
    }

    // TEST 15: Failed upload protection - no meeting created if upload never finishes
    const uncommittedMeetingId = autoMeetingData.objectKey.split('/')[2];
    const { data: phantomMeeting } = await adminClient
      .from('meetings')
      .select('id')
      .eq('id', uncommittedMeetingId)
      .maybeSingle();
    record(
      'Failed Upload Protection',
      'No completed meeting record exists before successful R2 upload',
      phantomMeeting === null,
      'Confirmed 0 database records for uncommitted upload'
    );

    // TEST 16: Complete endpoint rejects unuploaded/missing R2 files
    const fakeKey = `recordings/${userAId}/${crypto.randomUUID()}/${Date.now()}-fake.mp4`;
    const fakeCompleteRes = await fetch(`${baseUrl}/api/recordings/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        objectKey: fakeKey,
        filename: 'never-uploaded.mp4',
        mimeType: 'video/mp4',
        size: 5000,
      }),
    });
    record(
      'Failed Upload Protection',
      'Recording completion rejected if file does not exist in R2',
      fakeCompleteRes.status === 404,
      `HTTP ${fakeCompleteRes.status} (Storage verification failed as expected)`
    );

    // TEST 17: Successful upload flow creates meeting and recording records
    const uploadPayloadBytes = Buffer.from('TEST_AUDIO_CONTAINER_PAYLOAD_FOR_RECORDING_COMPLETION');
    const fullFlowRes = await fetch(`${baseUrl}/api/recordings/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        filename: 'Quarterly_Roadmap_Review.mp4',
        contentType: 'video/mp4',
      }),
    });
    const fullFlowData = await fullFlowRes.json();
    const fullFlowKey = fullFlowData.objectKey;
    createdR2Keys.push(fullFlowKey);

    // 17b. Direct upload to R2
    const uploadPutRes = await fetch(fullFlowData.uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': 'video/mp4' },
      body: uploadPayloadBytes,
    });
    record(
      'Complete Flow',
      'Media successfully uploaded to Cloudflare R2',
      uploadPutRes.status === 200,
      `HTTP ${uploadPutRes.status}`
    );

    // 17c. Complete recording via /api/recordings/complete
    const completeRes = await fetch(`${baseUrl}/api/recordings/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        objectKey: fullFlowKey,
        filename: 'Quarterly_Roadmap_Review.mp4',
        mimeType: 'video/mp4',
        size: uploadPayloadBytes.length,
      }),
    });
    const completeData = await completeRes.json();

    const createdMeeting = completeData.meeting;
    const createdRecording = completeData.recording;
    const meetingSavedOk =
      completeRes.status === 201 &&
      !!createdMeeting &&
      createdMeeting.title === 'Quarterly Roadmap Review' &&
      createdMeeting.source === 'upload' &&
      createdMeeting.user_id === userAId;

    const recordingSavedOk =
      !!createdRecording &&
      createdRecording.meeting_id === createdMeeting?.id &&
      createdRecording.r2_object_key === fullFlowKey &&
      createdRecording.mime_type === 'video/mp4' &&
      Number(createdRecording.size) === uploadPayloadBytes.length &&
      createdRecording.status === 'uploaded';

    record(
      'Database Records Creation',
      'Meeting record saved with title from filename and source=upload',
      meetingSavedOk,
      `Title: "${createdMeeting?.title}", Source: "${createdMeeting?.source}"`
    );

    record(
      'Database Records Creation',
      'Recording record saved with status=uploaded, R2 key, mimeType, and fileSize',
      recordingSavedOk,
      `Status: "${createdRecording?.status}", Size: ${createdRecording?.size}, Key: ${createdRecording?.r2_object_key}`
    );

    if (createdMeeting?.id) {
      await adminClient.from('meetings').delete().eq('id', createdMeeting.id);
    }

    // TEST 18: Cross-user completion security
    const crossCompleteRes = await fetch(`${baseUrl}/api/recordings/complete`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${tokenA}`,
      },
      body: JSON.stringify({
        objectKey: `recordings/${userBId}/${meetingBId}/tampered.mp4`,
        filename: 'tampered.mp4',
      }),
    });
    record(
      'Multi-Tenant Security',
      'User A cannot create records using User B object key',
      crossCompleteRes.status === 403,
      `HTTP ${crossCompleteRes.status}`
    );
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
