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
  const getCurrentHostButton = document.getElementById('getCurrentHostButton');

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
    configurationsListDiv.innerHTML = ''; // Clear the old list
    if (configurations.length === 0) {
      configurationsListDiv.innerHTML = '<p>No configurations yet. Click "Add New" to get started.</p>';
    } else {
      configurations.forEach(config => {
        const itemDiv = document.createElement('div');
        itemDiv.classList.add('config-item');
        itemDiv.innerHTML = `
          <div class="config-item-header">
            <label class="switch enable-toggle" title="Enable/Disable this script">
              <input type="checkbox" data-id="${config.id}" ${config.enabled !== false ? 'checked' : ''}>
              <span class="slider"></span>
            </label>
            <h3>${config.hostname}</h3>
            <div class="actions">
              <button class="edit" data-id="${config.id}">Edit</button>
              <button class="delete" data-id="${config.id}">Delete</button>
            </div>
          </div>
          <p class="css-preview">CSS: ${config.css.substring(0, 40)}${config.css.length > 40 ? '...' : ''}</p>
        `;
        configurationsListDiv.appendChild(itemDiv);
      });
    }

    // Attach event listeners to edit/delete buttons
    document.querySelectorAll('.edit').forEach(button => {
      button.addEventListener('click', handleEdit);
    });
    document.querySelectorAll('.delete').forEach(button => {
      button.addEventListener('click', handleDelete);
    });
    document.querySelectorAll('.enable-toggle input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', handleToggleEnable); // Attach to the input inside the label
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
      displayStatus('All configurations saved!');
      loadConfigurations(); // Reload to update UI and apply immediately if needed
      applyToActiveTabIfMatched();
    });
  }

  function showForm(isEdit = false, config = null) {
    configFormDiv.style.display = 'block';
    showAddFormButton.style.display = 'none';
    const currentFormTitle = document.getElementById('formTitle') || { textContent: '' }; // To avoid errors if formTitle doesn't exist

    if (isEdit && config) {
      currentFormTitle.textContent = 'Edit Host Configuration';
      configIdInput.value = config.id || ''; // Display current ID, can be empty if the original ID is invalid
      hostnameInput.value = config.hostname;
      customCSSInput.value = config.css;
      // Store the original ID of the item being edited, used to determine the "edit" context on save
      // even if the current config.id is falsy.
      configFormDiv.dataset.editingOriginalId = config.id;
    } else {
      currentFormTitle.textContent = 'Add New Host';
      configIdInput.value = '';
      hostnameInput.value = '';
      customCSSInput.value = '';
      delete configFormDiv.dataset.editingOriginalId; // Clear the edit context flag
    }
  }

  function hideForm() {
    configFormDiv.style.display = 'none';
    showAddFormButton.style.display = 'block';
    configIdInput.value = '';
    hostnameInput.value = '';
    customCSSInput.value = '';
    delete configFormDiv.dataset.editingOriginalId; // Ensure the flag is cleared when the form is cancelled
  }

  showAddFormButton.addEventListener('click', () => {
    showForm();
  });

  cancelButton.addEventListener('click', () => {
    hideForm();
  });

  getCurrentHostButton.addEventListener('click', () => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs[0] && tabs[0].url) {
        try {
          const url = new URL(tabs[0].url);
          if (url.hostname) {
            hostnameInput.value = url.hostname;
          } else {
            displayStatus('Cannot get hostname from the current tab (e.g., new tab page).', true);
          }
        } catch (e) {
          displayStatus('Invalid URL in current tab.', true);
        }
      } else {
        displayStatus('No active tab found or tab has no URL.', true);
      }
    });
  });
  saveConfigButton.addEventListener('click', () => {
    const hostname = hostnameInput.value.trim();
    const css = customCSSInput.value;

    // Get the original ID saved when the edit form was opened
    const originalIdForEdit = configFormDiv.dataset.editingOriginalId;
    // Determine if we are in an edit context
    const isInEditContext = typeof originalIdForEdit !== 'undefined';

    if (!hostname) {
      displayStatus('Hostname cannot be empty.', true);
      return;
    }

    if (isInEditContext) {
      // In edit context, try to find the item by its original ID
      const index = configurations.findIndex(c => c.id === originalIdForEdit);

      if (index !== -1) {
        // Original item found. Update it.
        // Ensure the updated item has a valid ID; create a new ID if the original ID is invalid.
        const currentItem = configurations[index];
        const newItemId = currentItem.id || generateId(); // Use the current ID if valid, otherwise create a new one

        if (!currentItem.id) {
          displayStatus('Item updated and new ID created due to invalid old ID.', false);
        }

        configurations[index] = {
          ...currentItem, // Keep other properties if any
          id: newItemId,
          hostname: hostname,
          css: css
        };
      } else {
        // Original item not found (based on originalIdForEdit).
        // This is an unusual case. The item might have been deleted.
        // Fallback: add as a new item to avoid losing user input.
        displayStatus('Error: Original item not found for editing. Added as a new item.', true);
        configurations.push({ id: generateId(), hostname, css, enabled: true });
      }
    } else { // Chế độ thêm mới
      // Not in edit context, proceed to add a new item.
      // Default when adding a new item is enabled
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
    if (confirm('Are you sure you want to delete this configuration?')) {
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
      saveConfigurations(); // Save changes and reapply
    }
  }

  function applyToActiveTabIfMatched() {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => { // Add async here
      if (tabs[0] && tabs[0].url && tabs[0].id) {
        const activeTabId = tabs[0].id;
        try {
          const currentTabUrl = new URL(tabs[0].url); // Use for...of for await to work correctly in the loop
          for (const config of configurations) { 
            if (currentTabUrl.hostname.includes(config.hostname) && config.css) {
              if (config.enabled !== false) {
                await chrome.scripting.insertCSS({
                  target: { tabId: activeTabId },
                  css: config.css
                });
              }
              else {
                await chrome.scripting.removeCSS({ target: { tabId: activeTabId }, css: config.css }).catch(e => console.warn("Error removing old CSS:", e));
              }
            }
          }
        } catch (e) {
          console.error("Error processing current tab URL:", e);
        }
      }
    });
  }

  // Load configurations when the popup opens
  loadConfigurations();
});