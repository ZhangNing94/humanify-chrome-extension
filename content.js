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

// Log installation
console.log('Humanify content script loaded');
