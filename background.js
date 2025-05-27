function applyCSSForTab(tabId, tabUrl) {
  if (!tabUrl) return;

  chrome.storage.local.get(['configurations'], (result) => {
    const configurations = result.configurations || [];

    if (configurations.length > 0) {
      try {
        const url = new URL(tabUrl);
        // Xóa tất cả CSS đã chèn bởi tiện ích này trước đó để tránh trùng lặp hoặc xung đột
        // Lưu ý: Điều này có thể hơi mạnh tay nếu người dùng muốn nhiều rule áp dụng.
        // Một cách tiếp cận khác là quản lý CSS đã chèn cụ thể hơn.
        // Tuy nhiên, để đơn giản, chúng ta sẽ xóa và chèn lại.
        // chrome.scripting.removeCSS({ target: { tabId: tabId }, css: "*" }); // Cân nhắc nếu cần thiết

        configurations.forEach(config => {
          if (config.hostname && config.css && url.hostname.includes(config.hostname)) {
            chrome.scripting.insertCSS({
              target: { tabId: tabId },
              css: config.css
            }).then(() => {
              // console.log(`CSS cho ${config.hostname} đã được chèn vào ${tabUrl}`);
            }).catch(err => {
              // console.error(`Không thể chèn CSS cho ${config.hostname} vào ${tabUrl}:`, err.message);
            });
          }
        });
      } catch (e) {
        // console.error("Lỗi xử lý URL trong background script:", e, "URL:", tabUrl);
      }
    }
  });
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