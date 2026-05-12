// Humanify - Content Script
// Minimal content script for future inline UI features

// Listen for messages from popup or background
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'getSelectedText') {
    const selection = window.getSelection().toString().trim();
    sendResponse({ text: selection });
    return true;
  }
});

// Log installation
console.log('Humanify content script loaded');
