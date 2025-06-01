document.addEventListener('DOMContentLoaded', () => {
  const configurationsListDiv = document.getElementById('configurationsList');
  const showAddFormButton = document.getElementById('showAddFormButton');
  const configFormDiv = document.getElementById('configForm');
  const configIdInput = document.getElementById('configId');
  const hostnameInput = document.getElementById('hostname');
  const customCSSInput = document.getElementById('customCSS');
  const saveConfigButton = document.getElementById('saveConfigButton');
  const cancelButton = document.getElementById('cancelButton');
  const statusElement = document.getElementById('status');

  let configurations = [];

  function generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substring(2);
  }

  function displayStatus(message, isError = false) {
    statusElement.textContent = message;
    statusElement.style.color = isError ? 'red' : 'green';
    setTimeout(() => { statusElement.textContent = ''; }, 3000);
  }

  function renderConfigurations() {
    configurationsListDiv.innerHTML = ''; // Xóa danh sách cũ
    if (configurations.length === 0) {
      configurationsListDiv.innerHTML = '<p>Chưa có cấu hình nào. Nhấn "Thêm Host mới" để bắt đầu.</p>';
    } else {
      configurations.forEach(config => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('config-item');
        itemDiv.innerHTML = `
          <div class="config-item-header">
            <label class="switch enable-toggle" title="Bật/Tắt script này">
              <input type="checkbox" data-id="${config.id}" ${config.enabled !== false ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <h3>${config.hostname}</h3>
            <div class="actions">
              <button class="edit" data-id="${config.id}">Sửa</button>
              <button class="delete" data-id="${config.id}">Xóa</button>
            </div>
          </div>
          <p class="css-preview">CSS: ${config.css.substring(0, 40)}${config.css.length > 40 ? '...' : ''}</p>
        `;
        configurationsListDiv.appendChild(itemDiv);
      });
    }

    // Gắn event listeners cho các nút sửa/xóa
    document.querySelectorAll('.edit').forEach(button => {
      button.addEventListener('click', handleEdit);
    });
    document.querySelectorAll('.delete').forEach(button => {
      button.addEventListener('click', handleDelete);
    });
    document.querySelectorAll('.enable-toggle input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', handleToggleEnable); // Gắn vào input bên trong label
    });
  }

  function loadConfigurations() {
    chrome.storage.local.get(['configurations'], (result) => {
      configurations = result.configurations || [];
      renderConfigurations();
    });
  }

  function saveConfigurations() {
    chrome.storage.local.set({ configurations }, () => {
      displayStatus('Đã lưu tất cả cấu hình!');
      loadConfigurations(); // Tải lại để cập nhật UI và áp dụng ngay nếu cần
      applyToActiveTabIfMatched();
    });
  }

  function showForm(isEdit = false, config = null) {
    configFormDiv.style.display = 'block';
    showAddFormButton.style.display = 'none';
    const currentFormTitle = document.getElementById('formTitle') || { textContent: '' }; // Để tránh lỗi nếu formTitle không tồn tại

    if (isEdit && config) {
      currentFormTitle.textContent = 'Sửa cấu hình Host';
      configIdInput.value = config.id || ''; // Hiển thị ID hiện tại, có thể rỗng nếu ID gốc không hợp lệ
      hostnameInput.value = config.hostname;
      customCSSInput.value = config.css;
      // Lưu trữ ID gốc của mục đang được sửa, dùng để xác định ngữ cảnh "sửa" khi lưu
      // ngay cả khi config.id hiện tại là falsy.
      configFormDiv.dataset.editingOriginalId = config.id;
    } else {
      currentFormTitle.textContent = 'Thêm Host mới';
      configIdInput.value = '';
      hostnameInput.value = '';
      customCSSInput.value = '';
      delete configFormDiv.dataset.editingOriginalId; // Xóa cờ ngữ cảnh sửa
    }
  }

  function hideForm() {
    configFormDiv.style.display = 'none';
    showAddFormButton.style.display = 'block';
    configIdInput.value = '';
    hostnameInput.value = '';
    customCSSInput.value = '';
    delete configFormDiv.dataset.editingOriginalId; // Đảm bảo xóa cờ khi hủy form
  }

  showAddFormButton.addEventListener('click', () => {
    showForm();
  });

  cancelButton.addEventListener('click', () => {
    hideForm();
  });

  saveConfigButton.addEventListener('click', () => {
    const hostname = hostnameInput.value.trim();
    const css = customCSSInput.value;

    // Lấy ID gốc đã lưu khi form sửa được mở
    const originalIdForEdit = configFormDiv.dataset.editingOriginalId;
    // Xác định xem chúng ta có đang trong ngữ cảnh sửa hay không
    const isInEditContext = typeof originalIdForEdit !== 'undefined';

    if (!hostname) {
      displayStatus('Hostname không được để trống.', true);
      return;
    }

    if (isInEditContext) {
      // Đang trong ngữ cảnh sửa, cố gắng tìm mục bằng ID gốc của nó
      const index = configurations.findIndex(c => c.id === originalIdForEdit);

      if (index !== -1) {
        // Tìm thấy mục gốc. Cập nhật nó.
        // Đảm bảo mục được cập nhật có ID hợp lệ; tạo ID mới nếu ID gốc không hợp lệ.
        const currentItem = configurations[index];
        const newItemId = currentItem.id || generateId(); // Sử dụng ID hiện tại nếu hợp lệ, nếu không thì tạo mới

        if (!currentItem.id) {
          displayStatus('Đã sửa mục và tạo ID mới do ID cũ không hợp lệ.', false);
        }

        configurations[index] = {
          ...currentItem, // Giữ lại các thuộc tính khác nếu có
          id: newItemId,
          hostname: hostname,
          css: css
        };
      } else {
        // Không tìm thấy mục gốc (dựa trên originalIdForEdit).
        // Đây là trường hợp bất thường. Có thể mục đã bị xóa.
        // Fallback: thêm như một mục mới để không làm mất dữ liệu người dùng nhập.
        displayStatus('Lỗi: Không tìm thấy mục gốc để sửa. Đã thêm như một mục mới.', true);
        configurations.push({ id: generateId(), hostname, css, enabled: true });
      }
    } else { // Chế độ thêm mới
      // Không ở trong ngữ cảnh sửa, tiến hành thêm mục mới.
      // Mặc định khi thêm mới là enabled
      configurations.push({ id: generateId(), hostname, css, enabled: true });
    }
    saveConfigurations();
    hideForm();
  });

  function handleEdit(event) {
    const id = event.target.dataset.id;
    const configToEdit = configurations.find(c => c.id === id);
    if (configToEdit) {
      showForm(true, configToEdit);
    }
  }

  function handleDelete(event) {
    const id = event.target.dataset.id;
    if (confirm('Bạn có chắc chắn muốn xóa cấu hình này?')) {
      configurations = configurations.filter(c => c.id !== id);
      saveConfigurations();
    }
  }

  function handleToggleEnable(event) {
    const id = event.target.dataset.id;
    const isEnabled = event.target.checked;
    const configIndex = configurations.findIndex(c => c.id === id);
    if (configIndex !== -1) {
      configurations[configIndex].enabled = isEnabled;
      saveConfigurations(); // Lưu thay đổi và áp dụng lại
    }
  }

  function applyToActiveTabIfMatched() {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => { // Thêm async ở đây
      if (tabs[0] && tabs[0].url && tabs[0].id) {
        const activeTabId = tabs[0].id;
        try {
          const currentTabUrl = new URL(tabs[0].url);
          for (const config of configurations) { // Sử dụng for...of để await hoạt động đúng trong vòng lặp
            if (currentTabUrl.hostname.includes(config.hostname) && config.css) {
              if (config.enabled !== false) {
                await chrome.scripting.insertCSS({
                  target: { tabId: activeTabId },
                  css: config.css
                });
              }
              else {
                await chrome.scripting.removeCSS({ target: { tabId: activeTabId }, css: config.css }).catch(e => console.warn("Lỗi khi xóa CSS cũ:", e));
              }
            }
          }
        } catch (e) {
          console.error("Lỗi xử lý URL tab hiện tại:", e);
        }
      }
    });
  }

  // Tải cấu hình khi popup mở
  loadConfigurations();
});