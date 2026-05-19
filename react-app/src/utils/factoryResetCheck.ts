/**
 * Factory Reset Check Utility
 * Checks for factory reset marker and clears localStorage if needed
 * This must run BEFORE any store initialization to prevent loading old data
 */

let factoryResetChecked = false;
let factoryResetPerformed = false;

export async function checkFactoryReset(): Promise<boolean> {
  if (factoryResetChecked) {
    return factoryResetPerformed;
  }

  try {
    const response = await fetch('/api/factory-reset-check', {
      cache: 'no-store',
      headers: {
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache'
      }
    });
    
    if (!response.ok) {
      factoryResetChecked = true;
      return false;
    }

    const data = await response.json();
    
    if (data.factoryReset) {
      console.log('🔄 Factory reset detected - clearing all localStorage...');
      
      // Clear ALL localStorage before any components load
      localStorage.clear();
      
      console.log('✅ localStorage cleared - factory reset complete');
      factoryResetPerformed = true;
    }
  } catch (error) {
    console.error('Error checking factory reset:', error);
    // If we can't check, don't clear localStorage (fail safe)
  } finally {
    factoryResetChecked = true;
  }

  return factoryResetPerformed;
}

// Synchronous check - try to check immediately if possible
// This is a best-effort attempt to clear localStorage before store initialization
export function checkFactoryResetSync(): void {
  // We can't do async operations synchronously, but we can at least
  // try to clear localStorage if we detect a marker file was recently created
  // This is a fallback - the async check will handle it properly
  try {
    // Check if there's a recent factory reset marker timestamp in sessionStorage
    const lastResetCheck = sessionStorage.getItem('lastFactoryResetCheck');
    const now = Date.now();
    
    // If we haven't checked in this session, or it's been more than 5 minutes since last check
    if (!lastResetCheck || (now - parseInt(lastResetCheck)) > 5 * 60 * 1000) {
      // Trigger async check
      checkFactoryReset().then(performed => {
        if (performed) {
          sessionStorage.setItem('lastFactoryResetCheck', now.toString());
          // Reload the page to ensure clean state
          window.location.reload();
        }
      });
      sessionStorage.setItem('lastFactoryResetCheck', now.toString());
    }
  } catch (error) {
    console.error('Error in sync factory reset check:', error);
  }
}
