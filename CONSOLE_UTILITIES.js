/**
 * BillEase Data Clearing Utilities
 * 
 * How to use:
 * 1. Open BillEase in your browser
 * 2. Press F12 to open Developer Tools
 * 3. Go to Console tab
 * 4. Copy and paste the functions below
 * 5. Run the function you need (see examples at bottom)
 */

// ============================================
// 🗑️ CLEAR LOCAL DATA ONLY
// ============================================
function clearLocalData() {
  console.log('🗑️ Clearing local data...');
  localStorage.removeItem('appData');
  localStorage.removeItem('billease.invoiceDraft');
  console.log('✅ Local data cleared!');
  console.log('Reloading in 2 seconds...');
  setTimeout(() => {
    location.reload();
  }, 2000);
}

// ============================================
// 📱 VIEW CURRENT APP STATE
// ============================================
function viewAppData() {
  const data = localStorage.getItem('appData');
  if (!data) {
    console.log('❌ No app data found in localStorage');
    return;
  }
  
  try {
    const parsed = JSON.parse(data);
    console.log('📊 Current App Data Structure:');
    console.table({
      'Customers': parsed.customers?.length || 0,
      'Invoices': parsed.invoices?.length || 0,
      'Products': parsed.products?.length || 0,
      'Payments': parsed.payments?.length || 0,
      'Delivery Notes': parsed.deliveryNotes?.length || 0,
      'Expenses': parsed.expenses?.length || 0,
      'Audit Logs': parsed.auditLogs?.length || 0,
      'Logo Size': parsed.businessProfile?.logo ? 
        `${(parsed.businessProfile.logo.length / 1024).toFixed(1)} KB` : 'None'
    });
    console.log('📋 Full data:', parsed);
  } catch (e) {
    console.error('❌ Error parsing app data:', e);
  }
}

// ============================================
// 🔍 CHECK FIREBASE STATUS
// ============================================
function checkFirebaseStatus() {
  console.log('🔍 Checking Firebase configuration...');
  
  const isEnabled = import.meta.env.VITE_FIREBASE_ENABLED === 'true';
  const hasApiKey = !!import.meta.env.VITE_FIREBASE_API_KEY;
  const hasProjectId = !!import.meta.env.VITE_FIREBASE_PROJECT_ID;
  
  console.table({
    'Firebase Enabled': isEnabled ? '✅ Yes' : '❌ No',
    'API Key Present': hasApiKey ? '✅ Yes' : '❌ No',
    'Project ID Present': hasProjectId ? '✅ Yes' : '❌ No',
    'Status': (isEnabled && hasApiKey && hasProjectId) ? 
      '✅ Ready for cloud sync' : '⚠️ Firebase not fully configured'
  });
}

// ============================================
// 📊 SHOW DATA STATISTICS
// ============================================
function showStats() {
  viewAppData();
  
  const draft = localStorage.getItem('billease.invoiceDraft');
  if (draft) {
    console.log('📝 Invoice Draft:', JSON.parse(draft));
  }
}

// ============================================
// 🔄 MANUALLY TRIGGER SYNC (TEST ONLY)
// ============================================
function testSync() {
  console.log('🔄 Testing sync mechanism...');
  console.log('💡 Tip: Make a small change in the app (edit a field)');
  console.log('🔔 Watch Firebase Console for updatedAt timestamp change');
  console.log('⏱️ Sync runs every 2 seconds (debounced)');
}

// ============================================
// 📝 EXPORT DATA AS JSON
// ============================================
function exportDataAsJson() {
  const data = localStorage.getItem('appData');
  if (!data) {
    console.log('❌ No data to export');
    return;
  }
  
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `billease-backup-${new Date().toISOString()}.json`;
  a.click();
  URL.revokeObjectURL(url);
  console.log('✅ Data exported as JSON file');
}

// ============================================
// 📥 IMPORT DATA FROM JSON
// ============================================
function importDataFromJson() {
  console.log('📥 To import data:');
  console.log('1. Use the file input below');
  console.log('2. Select a previously exported JSON file');
  console.log('3. Data will be restored to localStorage');
  
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = JSON.parse(event.target.result);
        localStorage.setItem('appData', JSON.stringify(data));
        console.log('✅ Data imported successfully!');
        console.log('Reloading in 2 seconds...');
        setTimeout(() => location.reload(), 2000);
      } catch (err) {
        console.error('❌ Error importing data:', err);
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

// ============================================
// 🎯 QUICK HELP
// ============================================
function help() {
  console.clear();
  console.log(`
╔════════════════════════════════════════════════════════════════╗
║          🧹 BillEase Data Management Console Helpers           ║
╚════════════════════════════════════════════════════════════════╝

🗑️  CLEAR DATA:
  • clearLocalData() ...................... Delete all local data & reload

📊 VIEW DATA:
  • viewAppData() ......................... Show current data summary
  • showStats() ........................... Show all statistics
  • checkFirebaseStatus() ................. Check Firebase configuration

💾 BACKUP & RESTORE:
  • exportDataAsJson() .................... Download data as JSON file
  • importDataFromJson() .................. Upload JSON file to restore

🔧 TESTING:
  • testSync() ............................ Test Firebase sync

❓ HELP:
  • help() ............................... Show this menu again

════════════════════════════════════════════════════════════════

📌 EXAMPLES:

  1️⃣  See current data:
      showStats()

  2️⃣  Backup everything:
      exportDataAsJson()

  3️⃣  Clear and start fresh:
      clearLocalData()

  4️⃣  Restore from backup:
      importDataFromJson()

════════════════════════════════════════════════════════════════
  `);
}

// Show help on first run
console.log('✅ BillEase utilities loaded! Type help() for menu');
