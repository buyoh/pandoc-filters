document.addEventListener('DOMContentLoaded', () => {
  // DOM elements
  const inputTextElem = document.getElementById('inputText');
  const outputTextElem = document.getElementById('outputText');
  const convertBtnElem = document.getElementById('convertBtn');
  const clearBtnElem = document.getElementById('clearBtn');
  const copyBtnElem = document.getElementById('copyBtn');
  const statusElem = document.getElementById('status');
  const convertTextElem = document.getElementById('convertText');
  const loadingSpinnerElem = document.getElementById('loadingSpinner');

  // API endpoint
  const API_BASE = '/api/v1';

  // Utility functions
  function updateStatus(message, type = 'default') {
    statusElem.textContent = message;
    statusElem.className = `status ${type}`;
  }

  function setLoading(isLoading) {
    convertBtnElem.disabled = isLoading;
    if (isLoading) {
      convertTextElem.style.display = 'none';
      loadingSpinnerElem.style.display = 'inline';
      updateStatus('Converting...', 'loading');
    } else {
      convertTextElem.style.display = 'inline';
      loadingSpinnerElem.style.display = 'none';
    }
  }

  function showError(message) {
    updateStatus(`Error: ${message}`, 'error');
    console.error('Conversion error:', message);
  }

  function showSuccess(message) {
    updateStatus(message, 'success');
  }

  // Main conversion function
  async function convertText() {
    const input = inputTextElem.value.trim();

    if (!input) {
      showError('Please enter some text to convert');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(`${API_BASE}/sync/convert`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          input: input,
          from_format: 'markdown',
          to_format: 'redmine-textile',
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || `HTTP ${response.status}`);
      }

      if (result.success) {
        outputTextElem.value = result.data.output;
        showSuccess('Conversion completed successfully!');

        // Auto-focus on output for easy copying
        outputTextElem.focus();
        outputTextElem.select();
      } else {
        throw new Error(result.error || 'Conversion failed');
      }
    } catch (error) {
      showError(error.message);
      outputTextElem.value = '';
    } finally {
      setLoading(false);
    }
  }

  // Clear function
  function clearText() {
    inputTextElem.value = '';
    outputTextElem.value = '';
    updateStatus('Ready');
    inputTextElem.focus();
  }

  // Copy result function
  async function copyResult() {
    const output = outputTextElem.value.trim();

    if (!output) {
      showError('No text to copy');
      return;
    }

    try {
      await navigator.clipboard.writeText(output);
      showSuccess('Result copied to clipboard!');
    } catch (error) {
      // Fallback for older browsers
      outputTextElem.select();
      document.execCommand('copy');
      showSuccess('Result copied to clipboard!');
    }
  }

  // Keyboard shortcuts
  document.addEventListener('keydown', function (event) {
    // Ctrl+Enter or Cmd+Enter to convert
    if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
      event.preventDefault();
      if (!convertBtnElem.disabled) {
        convertText();
      }
    }

    // Ctrl+K or Cmd+K to clear
    if ((event.ctrlKey || event.metaKey) && event.key === 'k') {
      event.preventDefault();
      clearText();
    }

    // Ctrl+Shift+C or Cmd+Shift+C to copy
    if (
      (event.ctrlKey || event.metaKey) &&
      event.shiftKey &&
      event.key === 'C'
    ) {
      event.preventDefault();
      copyResult();
    }
  });

  // Auto-resize textareas
  function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.max(textarea.scrollHeight, 400) + 'px';
  }

  // Health check on load
  async function checkApiHealth() {
    try {
      const response = await fetch('/health');
      if (response.ok) {
        updateStatus('Ready - API server connected');
      } else {
        updateStatus('API server not responding', 'error');
      }
    } catch (error) {
      updateStatus('Cannot connect to API server', 'error');
    }
  }

  // Initialize
  function initialize() {
    // Event listeners for buttons
    convertBtnElem.addEventListener('click', convertText);
    clearBtnElem.addEventListener('click', clearText);
    copyBtnElem.addEventListener('click', copyResult);

    // Event listeners for textareas
    inputTextElem.addEventListener('input', () => autoResize(inputTextElem));
    outputTextElem.addEventListener('input', () => autoResize(outputTextElem));

    updateStatus('Ready');
    inputTextElem.focus();

    // Add tooltip information
    convertBtnElem.title = 'Convert (Ctrl+Enter)';
    clearBtnElem.title = 'Clear all text (Ctrl+K)';
    copyBtnElem.title = 'Copy result (Ctrl+Shift+C)';

    // Check API health when page loads
    window.addEventListener('load', checkApiHealth);
  }

  initialize();
});
