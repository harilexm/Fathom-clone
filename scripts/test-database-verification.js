const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');

async function runComprehensiveVerification() {
  const envPath = path.resolve(process.cwd(), '.env.local');
  const content = fs.readFileSync(envPath, 'utf8');
  let url = '';
  let secretKey = '';
  let publishableKey = '';

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) url = trimmed.split('=')[1].trim();
    if (trimmed.startsWith('SUPABASE_SECRET_KEY=')) secretKey = trimmed.split('=')[1].trim();
    if (trimmed.startsWith('NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=')) publishableKey = trimmed.split('=')[1].trim();
  }

  const adminClient = createClient(url, secretKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const checkResults = [];

  function record(category, testName, passed, details = '') {
    checkResults.push({ category, testName, passed, details });
    const mark = passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${mark} [${category}] ${testName}${details ? ` -> ${details}` : ''}`);
  }

  console.log('\n========================================');
  console.log('1. VERIFYING TABLE PRESENCE & SCHEMAS');
  console.log('========================================');
  const tables = [
    'meetings',
    'recordings',
    'transcript_segments',
    'summary_versions',
    'action_items',
    'highlights',
    'share_links'
  ];

  for (const table of tables) {
    const { error } = await adminClient.from(table).select('count', { count: 'exact', head: true });
    record('Tables', `Table public.${table} exists`, !error, error ? error.message : 'OK');
  }

  console.log('\n========================================');
  console.log('2. CREATING TEST USERS (USER A & USER B)');
  console.log('========================================');
  const timestamp = Date.now();
  const emailA = `test-user-a-${timestamp}@example.com`;
  const emailB = `test-user-b-${timestamp}@example.com`;
  const password = 'VerificationPassword123!@#';

  const { data: userAData, error: errA } = await adminClient.auth.admin.createUser({
    email: emailA,
    password: password,
    email_confirm: true
  });
  if (errA) throw new Error('Failed to create User A: ' + errA.message);

  const { data: userBData, error: errB } = await adminClient.auth.admin.createUser({
    email: emailB,
    password: password,
    email_confirm: true
  });
  if (errB) throw new Error('Failed to create User B: ' + errB.message);

  const userAId = userAData.user.id;
  const userBId = userBData.user.id;
  console.log(`User A created (${userAId.slice(0, 8)}...), User B created (${userBId.slice(0, 8)}...)`);

  const clientA = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error: signErrA } = await clientA.auth.signInWithPassword({ email: emailA, password });
  if (signErrA) throw new Error('User A signIn failed: ' + signErrA.message);

  const clientB = createClient(url, publishableKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
  const { error: signErrB } = await clientB.auth.signInWithPassword({ email: emailB, password });
  if (signErrB) throw new Error('User B signIn failed: ' + signErrB.message);

  try {
    console.log('\n========================================');
    console.log('3. CRUD OPERATIONS BY OWNER (USER A)');
    console.log('========================================');

    // 3a. Meetings Insert
    const { data: meetingA, error: createMeetingErr } = await clientA
      .from('meetings')
      .insert({
        title: 'Q4 Product Roadmap Sync',
        source: 'upload',
        status: 'ready',
        duration: 2520,
        participants: ['Alice', 'Bob', 'Charlie']
      })
      .select()
      .single();

    record('CRUD: Meetings', 'User A creates meeting', !createMeetingErr && !!meetingA, createMeetingErr?.message);
    if (!meetingA) throw new Error('Cannot proceed without meeting');
    const meetingId = meetingA.id;

    // Check meeting owner default
    record('RLS & Schema', 'User A meeting owner correctly defaults to auth.uid()', meetingA.user_id === userAId);

    // 3b. Recordings Insert
    const r2Key = `recordings/test-${timestamp}.mp4`;
    const { data: recordingA, error: recErr } = await clientA
      .from('recordings')
      .insert({
        meeting_id: meetingId,
        r2_object_key: r2Key,
        mime_type: 'video/mp4',
        size: 154200000,
        duration: 2520,
        status: 'ready'
      })
      .select()
      .single();
    record('CRUD: Recordings', 'User A creates recording', !recErr && !!recordingA, recErr?.message);
    const recordingId = recordingA?.id;

    // 3c. Transcript Segments Insert
    const turns = [
      { meeting_id: meetingId, recording_id: recordingId, speaker: 'Alice', text: 'Welcome everyone to the roadmap sync.', start_time: 0.0, end_time: 3.5, sequence: 0 },
      { meeting_id: meetingId, recording_id: recordingId, speaker: 'Bob', text: 'Excited to review the new features.', start_time: 4.0, end_time: 7.2, sequence: 1 }
    ];
    const { data: transA, error: transErr } = await clientA
      .from('transcript_segments')
      .insert(turns)
      .select();
    record('CRUD: Transcripts', 'User A inserts transcript turns', !transErr && transA?.length === 2, transErr?.message);

    // 3d. Summary Versions Insert
    const summaries = [
      { meeting_id: meetingId, version: 'standard', summary: 'The team aligned on Q4 deliverables.', overview: ['Ship v1 by end of month', 'Focus on latency'] },
      { meeting_id: meetingId, version: 'concise', summary: 'Q4 roadmap reviewed; team aligned.', overview: ['Ship v1'] }
    ];
    const { data: sumA, error: sumErr } = await clientA
      .from('summary_versions')
      .insert(summaries)
      .select();
    record('CRUD: Summaries', 'User A inserts summary versions (standard & concise)', !sumErr && sumA?.length === 2, sumErr?.message);

    // 3e. Action Items Insert
    const actions = [
      { meeting_id: meetingId, task: 'Finalize API specs for dashboard', owner: 'Alice', due_date: '2026-10-01', completed: false },
      { meeting_id: meetingId, task: 'Deploy staging environment', owner: 'Bob', due_date: '2026-09-30', completed: true }
    ];
    const { data: actA, error: actErr } = await clientA
      .from('action_items')
      .insert(actions)
      .select();
    record('CRUD: Actions', 'User A inserts action items', !actErr && actA?.length === 2, actErr?.message);

    // 3f. Highlights Insert
    const highlights = [
      { meeting_id: meetingId, title: 'Roadmap Milestone Announcement', start_timestamp: 120.0, end_timestamp: 180.0, kind: 'Milestone' },
      { meeting_id: meetingId, title: 'Architecture Decisions', start_timestamp: 300.0, end_timestamp: 420.0, kind: 'Technical' }
    ];
    const { data: hiA, error: hiErr } = await clientA
      .from('highlights')
      .insert(highlights)
      .select();
    record('CRUD: Highlights', 'User A inserts highlights', !hiErr && hiA?.length === 2, hiErr?.message);

    // 3g. Share Links Insert
    const { data: shareA, error: shareErr } = await clientA
      .from('share_links')
      .insert({ meeting_id: meetingId, status: 'active' })
      .select()
      .single();
    record('CRUD: Share Links', 'User A creates share link', !shareErr && !!shareA?.token, shareErr?.message);
    const shareToken = shareA?.token;

    // 3h. Public RPC check while active
    const { data: sharedData, error: sharedErr } = await clientB.rpc('get_shared_meeting', { p_token: shareToken });
    record('RPC: Share Link', 'Recipient can resolve active share token via get_shared_meeting', !sharedErr && sharedData?.meeting?.id === meetingId, sharedErr?.message);

    // 3i. Updates by User A
    const { data: updateMeetingA, error: updateMErr } = await clientA
      .from('meetings')
      .update({ title: 'Q4 Product Roadmap Sync (Approved)' })
      .eq('id', meetingId)
      .select()
      .single();
    record('CRUD: Update', 'User A updates meeting title', !updateMErr && updateMeetingA?.title.includes('Approved'), updateMErr?.message);

    const { data: updateActA, error: updateActErr } = await clientA
      .from('action_items')
      .update({ completed: true })
      .eq('meeting_id', meetingId)
      .eq('owner', 'Alice')
      .select()
      .single();
    record('CRUD: Update', 'User A updates action item status', !updateActErr && updateActA?.completed === true, updateActErr?.message);

    const { data: updateShareA, error: updateShareErr } = await clientA
      .from('share_links')
      .update({ status: 'revoked', state: 'revoked', is_active: false })
      .eq('id', shareA.id)
      .select()
      .single();
    record('CRUD: Update', 'User A revokes share link (is_active becomes false)', !updateShareErr && updateShareA?.is_active === false && updateShareA?.status === 'revoked', updateShareErr?.message);

    const { data: revokedSharedData } = await clientB.rpc('get_shared_meeting', { p_token: shareToken });
    record('RPC: Share Link', 'Revoked share token returns null from get_shared_meeting', revokedSharedData === null);

    console.log('\n========================================');
    console.log('4. RLS & CROSS-USER ISOLATION (USER B VS A)');
    console.log('========================================');

    // 4a. User B cannot read User A's meeting
    const { data: readMeetingB } = await clientB.from('meetings').select('*').eq('id', meetingId);
    record('RLS: Isolation', 'User B cannot SELECT User A meeting', readMeetingB?.length === 0, `Returned ${readMeetingB?.length} rows`);

    // 4b. User B cannot update User A's meeting
    const { data: updateMeetingB } = await clientB.from('meetings').update({ title: 'Malicious Hijack' }).eq('id', meetingId).select();
    record('RLS: Isolation', 'User B cannot UPDATE User A meeting', updateMeetingB?.length === 0);

    // 4c. User B cannot delete User A's meeting
    const { data: deleteMeetingB } = await clientB.from('meetings').delete().eq('id', meetingId).select();
    record('RLS: Isolation', 'User B cannot DELETE User A meeting', deleteMeetingB?.length === 0);

    // 4d. User B cannot inject recording into User A's meeting
    const { data: injectRecB, error: injectRecErr } = await clientB
      .from('recordings')
      .insert({ meeting_id: meetingId, r2_object_key: `malicious-${timestamp}.mp4` })
      .select();
    record('RLS: Child Security', 'User B cannot INSERT recording into User A meeting', !!injectRecErr && (!injectRecB || injectRecB.length === 0), injectRecErr ? 'Blocked by RLS' : 'FAILED');

    // 4e. User B cannot inject transcript turn into User A's meeting
    const { data: injectTransB, error: injectTransErr } = await clientB
      .from('transcript_segments')
      .insert({ meeting_id: meetingId, speaker: 'Attacker', text: 'Injected turn', sequence: 99 })
      .select();
    record('RLS: Child Security', 'User B cannot INSERT transcript turn into User A meeting', !!injectTransErr && (!injectTransB || injectTransB.length === 0), injectTransErr ? 'Blocked by RLS' : 'FAILED');

    // 4f. User B cannot inject action item into User A's meeting
    const { data: injectActB, error: injectActErr } = await clientB
      .from('action_items')
      .insert({ meeting_id: meetingId, task: 'Unauthorized task' })
      .select();
    record('RLS: Child Security', 'User B cannot INSERT action item into User A meeting', !!injectActErr && (!injectActB || injectActB.length === 0), injectActErr ? 'Blocked by RLS' : 'FAILED');

    // 4g. User B cannot read any child records of User A's meeting
    const { data: bRecs } = await clientB.from('recordings').select('*').eq('meeting_id', meetingId);
    const { data: bTrans } = await clientB.from('transcript_segments').select('*').eq('meeting_id', meetingId);
    const { data: bSums } = await clientB.from('summary_versions').select('*').eq('meeting_id', meetingId);
    const { data: bActs } = await clientB.from('action_items').select('*').eq('meeting_id', meetingId);
    const { data: bHis } = await clientB.from('highlights').select('*').eq('meeting_id', meetingId);
    const { data: bShares } = await clientB.from('share_links').select('*').eq('meeting_id', meetingId);

    const allChildReadZero = [bRecs, bTrans, bSums, bActs, bHis, bShares].every(arr => arr && arr.length === 0);
    record('RLS: Child Isolation', 'User B cannot SELECT any child records belonging to User A', allChildReadZero);

    console.log('\n========================================');
    console.log('5. UNIQUE CONSTRAINTS & DATA INTEGRITY');
    console.log('========================================');

    // 5a. Unique R2 object key
    const { error: dupR2Err } = await clientA
      .from('recordings')
      .insert({ meeting_id: meetingId, r2_object_key: r2Key, mime_type: 'video/mp4' });
    record('Constraints', 'Duplicate r2_object_key is rejected', !!dupR2Err, dupR2Err ? dupR2Err.message : 'FAILED');

    // 5b. Unique summary version per meeting
    const { error: dupSumErr } = await clientA
      .from('summary_versions')
      .insert({ meeting_id: meetingId, version: 'standard', summary: 'Duplicate version' });
    record('Constraints', 'Duplicate (meeting_id, version) is rejected', !!dupSumErr, dupSumErr ? dupSumErr.message : 'FAILED');

    console.log('\n========================================');
    console.log('6. CASCADE DELETION VERIFICATION');
    console.log('========================================');

    // Delete meeting as User A
    const { error: delMErr } = await clientA.from('meetings').delete().eq('id', meetingId);
    record('Cascade: Delete', 'User A deletes own meeting', !delMErr, delMErr?.message);

    // Verify all child tables have 0 rows remaining for that meetingId
    const { data: afterRecs } = await adminClient.from('recordings').select('*').eq('meeting_id', meetingId);
    const { data: afterTrans } = await adminClient.from('transcript_segments').select('*').eq('meeting_id', meetingId);
    const { data: afterSums } = await adminClient.from('summary_versions').select('*').eq('meeting_id', meetingId);
    const { data: afterActs } = await adminClient.from('action_items').select('*').eq('meeting_id', meetingId);
    const { data: afterHis } = await adminClient.from('highlights').select('*').eq('meeting_id', meetingId);
    const { data: afterShares } = await adminClient.from('share_links').select('*').eq('meeting_id', meetingId);

    const zeroOrphans = [afterRecs, afterTrans, afterSums, afterActs, afterHis, afterShares].every(arr => arr && arr.length === 0);
    record('Cascade: Orphan Check', 'Parent meeting deletion cascaded to all 6 child tables with 0 orphan records', zeroOrphans);

  } finally {
    console.log('\n========================================');
    console.log('7. CLEANUP');
    console.log('========================================');
    await adminClient.auth.admin.deleteUser(userAId);
    await adminClient.auth.admin.deleteUser(userBId);
    console.log('Cleaned up test users User A and User B.');
  }

  const passedCount = checkResults.filter(r => r.passed).length;
  const failedCount = checkResults.filter(r => !r.passed).length;

  console.log('\n========================================');
  console.log(`VERIFICATION SUMMARY: ${passedCount}/${checkResults.length} CHECKS PASSED`);
  console.log('========================================');

  if (failedCount > 0) {
    console.log('\nFAILURES:');
    checkResults.filter(r => !r.passed).forEach(f => {
      console.log(`- [${f.category}] ${f.testName}: ${f.details}`);
    });
  }

  return { passedCount, total: checkResults.length, checks: checkResults };
}

runComprehensiveVerification().catch(err => {
  console.error('Test run failed:', err);
  process.exit(1);
});
