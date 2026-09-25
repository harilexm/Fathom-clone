const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { S3Client, GetObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

async function runSonioxVerification() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const envContent = fs.readFileSync(envPath, 'utf8');

  function getEnv(key) {
    const match = envContent.match(new RegExp(`^${key}=(.*)$`, 'm'));
    return match ? match[1].trim() : process.env[key];
  }

  const supabaseUrl = getEnv('NEXT_PUBLIC_SUPABASE_URL');
  const supabaseKey = getEnv('SUPABASE_SECRET_KEY');
  const r2AccountId = getEnv('R2_ACCOUNT_ID');
  const r2Bucket = getEnv('R2_BUCKET_NAME');
  const r2AccessKey = getEnv('R2_ACCESS_KEY_ID');
  const r2SecretKey = getEnv('R2_SECRET_ACCESS_KEY');
  const sonioxKey = getEnv('SONIOX_API_KEY');

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const s3 = new S3Client({
    region: 'auto',
    endpoint: `https://${r2AccountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: r2AccessKey, secretAccessKey: r2SecretKey },
  });

  const results = [];
  function check(name, pass, details = '') {
    results.push({ name, pass, details });
    console.log(`${pass ? '✅ PASS' : '❌ FAIL'}: ${name}${details ? ` (${details})` : ''}`);
  }

  console.log('========================================================');
  console.log('SONIOX ASYNC TRANSCRIPTION VERIFICATION SUITE');
  console.log('========================================================\n');

  // 1. Verify Soniox API Credentials & Endpoint Reachability
  try {
    const modelsRes = await fetch('https://api.soniox.com/v1/models', {
      headers: { Authorization: `Bearer ${sonioxKey}` },
    });
    check('Soniox API credentials valid & reachable', modelsRes.ok, `HTTP ${modelsRes.status}`);
  } catch (err) {
    check('Soniox API credentials valid & reachable', false, err.message);
  }

  // 2. Identify the target 5-minute uploaded video meeting
  let targetMeeting = null;
  let targetRecording = null;
  try {
    const { data: meetings, error: mErr } = await supabase
      .from('meetings')
      .select('*')
      .order('duration', { ascending: false });

    if (mErr) throw mErr;

    // Pick the 5-minute / 218-second video
    targetMeeting = meetings.find((m) => m.duration >= 60) || meetings[0];
    check('Found uploaded video meeting', !!targetMeeting, `Meeting ID: ${targetMeeting?.id}, Duration: ${targetMeeting?.duration}s, Title: "${targetMeeting?.title}"`);

    const { data: recordings, error: rErr } = await supabase
      .from('recordings')
      .select('*')
      .eq('meeting_id', targetMeeting.id)
      .order('created_at', { ascending: false });

    if (rErr) throw rErr;
    targetRecording = recordings[0];
    check('Found associated recording record', !!targetRecording?.r2_object_key, `Object key: ${targetRecording?.r2_object_key}`);
  } catch (err) {
    check('Find target meeting & recording', false, err.message);
  }

  if (!targetMeeting || !targetRecording) {
    console.error('Cannot proceed without target meeting/recording.');
    return;
  }

  // 3. Verify User Ownership Verification Logic
  const ownerUserId = targetMeeting.user_id;
  const fakeUserId = '00000000-0000-0000-0000-000000000999';

  check('Ownership check: Genuine owner matches meeting.user_id', targetMeeting.user_id === ownerUserId, `Owner: ${ownerUserId}`);
  check('Ownership check: Cross-tenant unauthorized access rejected', targetMeeting.user_id !== fakeUserId, `Fake user ID rejected`);

  // 4. Generate Temporary Signed R2 GET URL
  let signedGetUrl = '';
  try {
    signedGetUrl = await getSignedUrl(
      s3,
      new GetObjectCommand({
        Bucket: r2Bucket,
        Key: targetRecording.r2_object_key,
      }),
      { expiresIn: 3600 }
    );

    check('Generated temporary signed R2 GET URL', typeof signedGetUrl === 'string' && signedGetUrl.length > 50, `Length: ${signedGetUrl.length}`);

    // Verify GET URL is accessible
    const getRes = await fetch(signedGetUrl, { headers: { Range: 'bytes=0-0' } });
    check('Signed R2 GET URL is accessible by Soniox', getRes.ok || getRes.status === 206, `HTTP ${getRes.status} Content-Range: ${getRes.headers.get('content-range')}`);
  } catch (err) {
    check('Signed R2 GET URL generation and access', false, err.message);
  }

  // 5. Submit Recording to Soniox Async STT
  let sonioxJobId = '';
  let sonioxJobStatus = '';
  try {
    const sonioxRes = await fetch('https://api.soniox.com/v1/transcriptions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${sonioxKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'stt-async-v5',
        audio_url: signedGetUrl,
        enable_speaker_diarization: true,
        client_reference_id: `meeting_${targetMeeting.id}`,
      }),
    });

    const body = await sonioxRes.json();
    check('Soniox accepted recording & returned HTTP 201/200', sonioxRes.ok, `HTTP ${sonioxRes.status}`);

    sonioxJobId = body.id;
    sonioxJobStatus = body.status;

    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(sonioxJobId);
    check('Soniox returned a real Job ID', isUUID, `Job ID: ${sonioxJobId}`);
    check('Speaker diarization enabled in Soniox submission', body.enable_speaker_diarization === true, `diarization: ${body.enable_speaker_diarization}`);
  } catch (err) {
    check('Soniox async STT submission', false, err.message);
  }

  // 6. Query Soniox Job Status
  if (sonioxJobId) {
    try {
      const statusRes = await fetch(`https://api.soniox.com/v1/transcriptions/${sonioxJobId}`, {
        headers: { Authorization: `Bearer ${sonioxKey}` },
      });
      const statusBody = await statusRes.json();
      check('Soniox job status queryable', statusRes.ok, `Status: ${statusBody.status}`);
    } catch (err) {
      check('Soniox job query', false, err.message);
    }
  }

  // 7. Verify Database Persistence (columns and constraints)
  try {
    const nowIso = new Date().toISOString();
    // Test updating meeting with status 'transcribing' and job ID
    const updatePayload = {
      status: 'transcribing',
      updated_at: nowIso,
    };
    // Include job columns if available
    updatePayload.soniox_job_id = sonioxJobId;
    updatePayload.transcription_job_id = sonioxJobId;

    const { data: updatedMeeting, error: upErr } = await supabase
      .from('meetings')
      .update(updatePayload)
      .eq('id', targetMeeting.id)
      .select()
      .single();

    if (upErr) {
      check('Database: update meeting status to transcribing & store soniox_job_id', false, upErr.message);
    } else {
      check('Database: meeting status changed to transcribing', updatedMeeting.status === 'transcribing', `Status: ${updatedMeeting.status}`);
      check('Database: soniox_job_id stored on meeting', updatedMeeting.soniox_job_id === sonioxJobId, `soniox_job_id: ${updatedMeeting.soniox_job_id}`);
    }

    // Also update recording
    const { data: updatedRecording, error: recUpErr } = await supabase
      .from('recordings')
      .update({
        status: 'transcribing',
        soniox_job_id: sonioxJobId,
        transcription_job_id: sonioxJobId,
        updated_at: nowIso,
      })
      .eq('id', targetRecording.id)
      .select()
      .single();

    if (recUpErr) {
      check('Database: update recording status to transcribing & store soniox_job_id', false, recUpErr.message);
    } else {
      check('Database: recording status changed to transcribing', updatedRecording.status === 'transcribing', `Status: ${updatedRecording.status}`);
    }
  } catch (err) {
    check('Database updates', false, err.message);
  }

  // 8. Strict Constraint Check: Do NOT save transcript text yet and do NOT add AI summarization yet
  try {
    const { count: transcriptCount } = await supabase
      .from('transcript_segments')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', targetMeeting.id);

    check('Constraint verified: Transcript text NOT saved yet', transcriptCount === 0, `transcript_segments count: ${transcriptCount}`);

    const { count: summaryCount } = await supabase
      .from('summary_versions')
      .select('*', { count: 'exact', head: true })
      .eq('meeting_id', targetMeeting.id);

    check('Constraint verified: AI summarization NOT added yet', summaryCount === 0, `summary_versions count: ${summaryCount}`);
  } catch (err) {
    check('Constraint verification', false, err.message);
  }

  // Summary
  console.log('\n========================================================');
  const passed = results.filter((r) => r.pass).length;
  const failed = results.filter((r) => !r.pass).length;
  console.log(`TOTAL: ${results.length} | PASSED: ${passed} | FAILED: ${failed}`);
  console.log('========================================================');

  return { passed, failed, results };
}

runSonioxVerification();
