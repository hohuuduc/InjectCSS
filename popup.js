document.addEventListener('DOMContentLoaded', () => {
  const configurationsListDiv = document.getElementById('configurationsList');
  const showAddFormButton = document.getElementById('showAddFormButton');
  const configFormDiv = document.getElementById('configForm');
  const formTitle = document.getElementById('formTitle');
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
          <h3>${config.hostname}</h3>
          <p>CSS: ${config.css.substring(0, 50)}${config.css.length > 50 ? '...' : ''}</p>
          <div class="actions">
            <button class="edit" data-id="${config.id}">Sửa</button>
            <button class="delete" data-id="${config.id}">Xóa</button>
          </div>
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
    if (isEdit && config) {
      formTitle.textContent = 'Sửa cấu hình Host';
      configIdInput.value = config.id;
      hostnameInput.value = config.hostname;
      customCSSInput.value = config.css;
    } else {
      formTitle.textContent = 'Thêm Host mới';
      configIdInput.value = '';
      hostnameInput.value = '';
      customCSSInput.value = '';
    }
  }

  function hideForm() {
    configFormDiv.style.display = 'none';
    showAddFormButton.style.display = 'block';
    configIdInput.value = '';
    hostnameInput.value = '';
    customCSSInput.value = '';
  }

  showAddFormButton.addEventListener('click', () => {
    showForm();
  });

  cancelButton.addEventListener('click', () => {
    hideForm();
  });

  saveConfigButton.addEventListener('click', () => {
    const id = configIdInput.value;
    const hostname = hostnameInput.value.trim();
    const css = customCSSInput.value;

    if (!hostname) {
      displayStatus('Hostname không được để trống.', true);
      return;
    }

    if (id) { // Chế độ sửa
      const index = configurations.findIndex(c => c.id === id);
      if (index !== -1) {
        configurations[index] = { ...configurations[index], hostname, css };
      }
    } else { // Chế độ thêm mới
      // Kiểm tra hostname đã tồn tại chưa (tùy chọn, có thể cho phép trùng nếu muốn)
      // if (configurations.some(c => c.hostname === hostname)) {
      //   displayStatus('Hostname này đã tồn tại.', true);
      //   return;
      // }
      configurations.push({ id: generateId(), hostname, css });
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

  function applyToActiveTabIfMatched() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url && tabs[0].id) {
        const activeTabId = tabs[0].id;
        try {
          const currentTabUrl = new URL(tabs[0].url);
          configurations.forEach(config => {
            if (currentTabUrl.hostname.includes(config.hostname) && config.css) {
              chrome.scripting.removeCSS({ target: { tabId: activeTabId }, css: "*" }, () => { // Xóa CSS cũ trước (nếu có)
                chrome.scripting.insertCSS({
                  target: { tabId: activeTabId },
                  css: config.css
                }).catch(e => console.error("Lỗi chèn CSS ngay lập tức:", e));
              });
            }
          });
        } catch (e) {
          console.error("Lỗi xử lý URL tab hiện tại:", e);
        }
      }
    });
  }

  // Tải cấu hình khi popup mở
  loadConfigurations();
});