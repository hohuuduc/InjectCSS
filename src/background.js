async function applyCSSForTab(tabId, tabUrl) { // Add async
  if (!tabUrl) return;

  // Use Promise to work with chrome.storage.local.get more sequentially
  const result = await new Promise(resolve => chrome.storage.local.get(['configurations'], resolve));
  try {
    const configurations = result.configurations || [];

    if (configurations.length > 0) {
      const url = new URL(tabUrl);
      
      // Remove all CSS previously injected by this extension
      await chrome.scripting.removeCSS({ target: { tabId: tabId }, css: "*" }).catch(e => console.warn(`Error removing old CSS in background for tab ${tabId}:`, e));

      for (const config of configurations) { // Use for...of for await to work correctly
        if (config.enabled !== false && config.hostname && config.css && url.hostname.includes(config.hostname)) {
          try {
            await chrome.scripting.insertCSS({
              target: { tabId: tabId },
              css: config.css
            });
            // console.log(`BG: CSS for ${config.hostname} was injected into ${tabUrl}`);
          } catch (err) {
            // console.error(`BG: Could not inject CSS for ${config.hostname} into ${tabUrl}:`, err.message);
          }
        }
      }
    }
  } catch (e) {
    // console.error("BG: Error processing URL or storage:", e, "URL:", tabUrl);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Check if the tab has finished loading and has a URL
  if (changeInfo.status === 'complete' && tab.url) {
    applyCSSForTab(tabId, tab.url);
  }
});

// Optional: Inject CSS into already open tabs when the extension starts or is installed/updated
function injectOnExistingTabs() {
  chrome.storage.local.get(['configurations'], (result) => {
    const configurations = result.configurations || [];
    if (configurations.length > 0) {
      chrome.tabs.query({}, (tabs) => {
        for (let tab of tabs) {
          if (tab.url && tab.id) {
            applyCSSForTab(tab.id, tab.url);
          }
        }
      });
    }
  });
}

 chrome.runtime.onStartup.addListener(injectOnExistingTabs);
 chrome.runtime.onInstalled.addListener(injectOnExistingTabs);