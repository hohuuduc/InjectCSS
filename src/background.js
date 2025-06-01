async function applyCSSForTab(tabId, tabUrl) { // Thêm async
  if (!tabUrl) return;

  // Sử dụng Promise để làm việc với chrome.storage.local.get một cách tuần tự hơn
  const result = await new Promise(resolve => chrome.storage.local.get(['configurations'], resolve));
  try {
    const configurations = result.configurations || [];

    if (configurations.length > 0) {
      const url = new URL(tabUrl);
      
      // Xóa tất cả CSS đã chèn bởi tiện ích này trước đó
      await chrome.scripting.removeCSS({ target: { tabId: tabId }, css: "*" }).catch(e => console.warn(`Lỗi khi xóa CSS cũ trong background cho tab ${tabId}:`, e));

      for (const config of configurations) { // Sử dụng for...of để await hoạt động đúng
        if (config.enabled !== false && config.hostname && config.css && url.hostname.includes(config.hostname)) {
          try {
            await chrome.scripting.insertCSS({
              target: { tabId: tabId },
              css: config.css
            });
            // console.log(`BG: CSS cho ${config.hostname} đã được chèn vào ${tabUrl}`);
          } catch (err) {
            // console.error(`BG: Không thể chèn CSS cho ${config.hostname} vào ${tabUrl}:`, err.message);
          }
        }
      }
    }
  } catch (e) {
    // console.error("BG: Lỗi xử lý URL hoặc storage:", e, "URL:", tabUrl);
  }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Kiểm tra xem tab đã tải xong và có URL chưa
  if (changeInfo.status === 'complete' && tab.url) {
    applyCSSForTab(tabId, tab.url);
  }
});

// Tùy chọn: Chèn CSS vào các tab đã mở sẵn khi tiện ích khởi động hoặc được cài đặt/cập nhật
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