import KernelApiClient from './kernelApiClient.js';

async function testGetVersion() {
  // Assuming default baseUrl 'http://127.0.0.1:6806' is okay for local Siyuan Kernel
  const client = new KernelApiClient();
  console.log('client', client);
  try {
    console.log('Attempting to fetch Siyuan Kernel version...');
    const versionInfo = await client.version();
    console.log('Raw response from version():', JSON.stringify(versionInfo, null, 2));
    
    if (typeof versionInfo === 'string') {
      console.log('\n✅ Successfully fetched Siyuan Kernel version:', versionInfo);
    } else if (versionInfo && typeof versionInfo.version === 'string') {
      console.log('\n✅ Successfully fetched Siyuan Kernel version (from version property):', versionInfo.version);
    } else if (versionInfo && versionInfo.data && typeof versionInfo.data.version === 'string') {
      console.log('\n✅ Successfully fetched Siyuan Kernel version (from data.version property):', versionInfo.data.version);
    } else {
      console.warn('\n⚠️ Could not extract version string directly. Full response logged above.');
    }
  } catch (error) {
    console.error('\n❌ Error fetching Siyuan Kernel version:');
    if (error.status) {
      console.error(`  Status: ${error.status}`);
    }
    console.error(`  Message: ${error.message}`);
    if (error.data) {
      console.error('  Error Data:', JSON.stringify(error.data, null, 2));
    }
    // For network or other unexpected errors, log the cause if available
    if (error.cause) {
        console.error('  Cause:', error.cause);
    }
  }
}

await testGetVersion(); 