// Humanify - Content Script
// Minimal content script for future inline UI features

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    // Method 1: window.getSelection() — covers most cases
    let text = window.getSelection().toString().trim();

    // Method 2: fallback for input/textarea active element selection
    if (!text && document.activeElement) {
      const el = document.activeElement;
      if (
        (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') &&
        typeof el.selectionStart === 'number'
      ) {
        text = el.value.substring(el.selectionStart, el.selectionEnd).trim();
      }
    }

    // Method 3: contentEditable active element
    if (!text && document.activeElement?.isContentEditable) {
      text = window.getSelection().toString().trim();
    }

    sendResponse({ text });
    return true;
  }
});

  if (request.action === 'replaceText') {
    const { originalText, newText } = request;
    let replaced = false;

    // Try to find and replace text in contentEditable elements
    const walk = (node) => {
      if (node.nodeType === Node.TEXT_NODE) {
        if (node.textContent.includes(originalText)) {
          node.textContent = node.textContent.replace(originalText, newText);
          replaced = true;
        }
      } else if (node.nodeType === Node.ELEMENT_NODE && !['SCRIPT', 'STYLE'].includes(node.tagName)) {
        for (const child of node.childNodes) walk(child);
      }
    };
    walk(document.body);

    // Also try textarea and input values
    document.querySelectorAll('textarea, input[type="text"]').forEach(el => {
      if (el.value && el.value.includes(originalText)) {
        el.value = el.value.replace(originalText, newText);
        replaced = true;
      }
    });

    sendResponse({ success: replaced });
    return true;
  }
});

// Log installation
console.log('Humanify content script loaded');
