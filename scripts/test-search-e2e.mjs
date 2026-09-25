import { createClient } from '@supabase/supabase-js';

const MEETING_ID = '9032c083-de71-459c-b1e6-0e8a6701ed45';
const BASE_URL = 'http://localhost:3000';

async function runSearchTests() {
  console.log('=== STARTING GLOBAL SEARCH E2E VERIFICATION ===\n');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SECRET_KEY,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );

  // 1. Verify unauthenticated request returns 401
  console.log('Step 1: Testing unauthorized request protection...');
  const unauthRes = await fetch(`${BASE_URL}/api/search?q=Zoom`);
  console.log(`Unauthenticated status: ${unauthRes.status}`);
  if (unauthRes.status !== 401) {
    throw new Error(`Expected 401 for unauthenticated search, got ${unauthRes.status}`);
  }
  console.log('✓ Unauthorized request correctly rejected with 401\n');

  // 2. Authenticate the meeting owner
  console.log('Step 2: Authenticating meeting owner...');
  const { data: linkData, error: linkErr } = await supabase.auth.admin.generateLink({
    type: 'magiclink',
    email: 'umer.abdullah9891@gmail.com',
  });
  if (linkErr) throw new Error('generateLink failed: ' + linkErr.message);

  const verifyRes = await supabase.auth.verifyOtp({
    token_hash: linkData.properties.hashed_token,
    type: 'magiclink',
  });
  if (verifyRes.error) throw new Error('verifyOtp failed: ' + verifyRes.error.message);

  const session = verifyRes.data.session;
  const ownerId = session.user.id;
  const accessToken = session.access_token;
  console.log(`✓ Owner authenticated (${ownerId})\n`);

  const authHeaders = {
    Authorization: `Bearer ${accessToken}`,
  };

  // Helper search runner
  async function search(q) {
    const res = await fetch(`${BASE_URL}/api/search?q=${encodeURIComponent(q)}`, {
      headers: authHeaders,
    });
    if (!res.ok) {
      const err = await res.text();
      throw new Error(`Search failed for "${q}": status ${res.status} - ${err}`);
    }
    return res.json();
  }

  // 3. Test Meeting Title search
  console.log('Step 3: Testing Title search (q="Zoom")...');
  const titleData = await search('Zoom');
  console.log(`Found ${titleData.totalCount} results for "Zoom"`);
  const titleMatch = titleData.results.find((r) => r.matchType === 'title' && r.meetingId === MEETING_ID);
  if (!titleMatch) {
    console.error('Results for "Zoom":', JSON.stringify(titleData, null, 2));
    throw new Error('Title match for "Zoom" not found in search results');
  }
  console.log('Title match found:');
  console.log(`  Title: ${titleMatch.meetingTitle}`);
  console.log(`  Snippet: ${titleMatch.snippet}`);
  console.log(`  Target URL: ${titleMatch.targetUrl}`);
  if (titleMatch.targetUrl !== `/meeting/${MEETING_ID}`) {
    throw new Error(`Expected targetUrl to be /meeting/${MEETING_ID}, got ${titleMatch.targetUrl}`);
  }
  console.log('✓ Title search verified\n');

  // 4. Test Participants search
  console.log('Step 4: Testing Participant search (q="Danny")...');
  const partData = await search('Danny');
  console.log(`Found ${partData.totalCount} results for "Danny"`);
  const partMatch = partData.results.find((r) => r.matchType === 'participant' && r.meetingId === MEETING_ID);
  if (!partMatch) {
    console.error('Results for "Danny":', JSON.stringify(partData, null, 2));
    throw new Error('Participant match for "Danny" not found in search results');
  }
  console.log('Participant match found:');
  console.log(`  Speaker: ${partMatch.speaker}`);
  console.log(`  Snippet: ${partMatch.snippet}`);
  console.log(`  Target URL: ${partMatch.targetUrl}`);
  if (partMatch.speaker !== 'Danny') {
    throw new Error(`Expected speaker to be Danny, got ${partMatch.speaker}`);
  }
  console.log('✓ Participant search verified\n');

  // 5. Test Transcript search with snippet and timestamp
  console.log('Step 5: Testing Transcript search (q="script")...');
  const trData = await search('script');
  console.log(`Found ${trData.totalCount} results for "script"`);
  const trMatches = trData.results.filter((r) => r.matchType === 'transcript' && r.meetingId === MEETING_ID);
  if (trMatches.length === 0) {
    console.error('Results for "script":', JSON.stringify(trData, null, 2));
    throw new Error('Transcript match for "script" not found');
  }
  const sampleTr = trMatches[0];
  console.log('Transcript match found:');
  console.log(`  Speaker: ${sampleTr.speaker}`);
  console.log(`  Timestamp: ${sampleTr.timestamp} (${sampleTr.timestampSec}s)`);
  console.log(`  Snippet: "${sampleTr.snippet}"`);
  console.log(`  Target URL: ${sampleTr.targetUrl}`);

  if (!sampleTr.timestamp) {
    throw new Error('Transcript match missing formatted timestamp string');
  }
  if (typeof sampleTr.timestampSec !== 'number') {
    throw new Error('Transcript match missing numeric timestampSec');
  }
  if (!sampleTr.snippet || !sampleTr.snippet.toLowerCase().includes('script')) {
    throw new Error('Transcript snippet does not include matched keyword');
  }
  if (!sampleTr.targetUrl.includes(`/meeting/${MEETING_ID}?t=`) || !sampleTr.targetUrl.includes('&tab=transcript')) {
    throw new Error(`Invalid context jump targetUrl: ${sampleTr.targetUrl}`);
  }
  console.log('✓ Transcript search with relevant snippet, timestamp and context-jump targetUrl verified\n');

  // 6. Test Action Items search
  console.log('Step 6: Testing Action Item search (q="unmuting")...');
  const actData = await search('unmuting');
  console.log(`Found ${actData.totalCount} results for "unmuting"`);
  const actMatches = actData.results.filter((r) => r.matchType === 'action_item' && r.meetingId === MEETING_ID);
  if (actMatches.length === 0) {
    console.error('Results for "unmuting":', JSON.stringify(actData, null, 2));
    throw new Error('Action item match for "unmuting" not found');
  }
  const sampleAct = actMatches[0];
  console.log('Action item match found:');
  console.log(`  Owner info: ${sampleAct.speaker || 'Unassigned'}`);
  console.log(`  Snippet: "${sampleAct.snippet}"`);
  console.log(`  Target URL: ${sampleAct.targetUrl}`);
  if (!sampleAct.targetUrl.includes(`/meeting/${MEETING_ID}?tab=actions`)) {
    throw new Error(`Expected action item targetUrl to include ?tab=actions, got ${sampleAct.targetUrl}`);
  }
  console.log('✓ Action items search verified\n');

  // 7. Test Summary search
  console.log('Step 7: Testing Summary search (q="difficulties")...');
  const sumData = await search('difficulties');
  console.log(`Found ${sumData.totalCount} results for "difficulties"`);
  const sumMatches = sumData.results.filter((r) => r.matchType === 'summary' && r.meetingId === MEETING_ID);
  if (sumMatches.length === 0) {
    console.error('Results for "difficulties":', JSON.stringify(sumData, null, 2));
    throw new Error('Summary match for "difficulties" not found');
  }
  const sampleSum = sumMatches[0];
  console.log('Summary match found:');
  console.log(`  Snippet: "${sampleSum.snippet}"`);
  console.log(`  Target URL: ${sampleSum.targetUrl}`);
  if (!sampleSum.targetUrl.includes(`/meeting/${MEETING_ID}?tab=summary`)) {
    throw new Error(`Expected summary targetUrl to include ?tab=summary, got ${sampleSum.targetUrl}`);
  }
  console.log('✓ Summary search verified\n');

  // 8. Test User Scoping / Isolation
  console.log('Step 8: Testing User Scoping / Cross-Account Isolation...');
  // Create an ephemeral second user
  const otherEmail = `test-user-${Date.now()}@example.com`;
  const { data: newUser, error: createErr } = await supabase.auth.admin.createUser({
    email: otherEmail,
    email_confirm: true,
  });
  if (createErr) throw new Error('Failed to create second test user: ' + createErr.message);

  try {
    const { data: otherLink } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: otherEmail,
    });
    const otherVerify = await supabase.auth.verifyOtp({
      token_hash: otherLink.properties.hashed_token,
      type: 'magiclink',
    });
    const otherToken = otherVerify.data.session.access_token;

    const otherRes = await fetch(`${BASE_URL}/api/search?q=Zoom`, {
      headers: { Authorization: `Bearer ${otherToken}` },
    });
    const otherData = await otherRes.json();
    console.log(`Second user searching "Zoom" returned ${otherData.totalCount} results`);
    if (otherData.totalCount !== 0) {
      throw new Error(`Data leakage! User B received ${otherData.totalCount} results from User A's meetings.`);
    }
    console.log('✓ User scoping strictly verified: zero results leaked to unauthorized users\n');
  } finally {
    await supabase.auth.admin.deleteUser(newUser.user.id);
    console.log('✓ Cleaned up ephemeral test user');
  }

  console.log('\n========================================');
  console.log('ALL GLOBAL SEARCH TESTS PASSED SUCCESSFULLY!');
  console.log('========================================');
}

runSearchTests().catch((err) => {
  console.error('\n❌ TEST RUN FAILED:', err);
  process.exit(1);
});
