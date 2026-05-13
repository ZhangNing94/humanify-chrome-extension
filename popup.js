// Humanify Popup — Main UI logic
// Handles text analysis, rewriting, and settings

// --- DOM References ---
const textPreview = document.getElementById('textPreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const rewriteBtn = document.getElementById('rewriteBtn');
const rewriteSection = document.getElementById('rewriteSection');
const resultSection = document.getElementById('resultSection');
const resultBox = document.getElementById('resultBox');
const resultTone = document.getElementById('resultTone');
const copyBtn = document.getElementById('copyBtn');
const rerewriteBtn = document.getElementById('rerewriteBtn');
const aiScore = document.getElementById('aiScore');
const errorMsg = document.getElementById('errorMsg');
const usageBadge = document.getElementById('usageBadge');
const apiKeyInput = document.getElementById('apiKeyInput');
const saveKeyBtn = document.getElementById('saveKeyBtn');
const settingsToggle = document.getElementById('settingsToggle');
const settingsPanel = document.getElementById('settingsPanel');
const resetUsageBtn = document.getElementById('resetUsageBtn');
const analyzeLoader = document.getElementById('analyzeLoader');
const rewriteLoader = document.getElementById('rewriteLoader');
const toneBtns = document.querySelectorAll('.tone-btn');

// --- State ---
let selectedText = '';
let selectedTone = 'casual';
let detectionResult = null;
let rewrittenText = '';
let usage = { used: 0, limit: 5, canUse: true };
let apiKey = '';

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadApiKey();
  await loadUsage();
  await getSelectedText();
  setupEventListeners();
});

async function loadApiKey() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getApiKey' });
    if (response.success && response.data) {
      apiKey = response.data;
      apiKeyInput.value = apiKey;
    }
  } catch (e) {
    // Extension context may not be ready
  }
}

async function loadUsage() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getUsage' });
    if (response.success) {
      usage = response.data;
      updateUsageBadge();
    }
  } catch (e) {
    // Extension context may not be ready
  }
}

async function getSelectedText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) return;

    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      function: () => window.getSelection().toString().trim()
    });

    if (results?.[0]?.result) {
      selectedText = results[0].result;
      textPreview.textContent = selectedText;
      textPreview.classList.remove('placeholder-style');
      analyzeBtn.disabled = false;
      analyzeBtn.style.opacity = '1';
    } else {
      textPreview.textContent = '';
      textPreview.innerHTML = '<span class="placeholder">Select text on page, then click "Analyze"</span>';
      analyzeBtn.disabled = true;
      analyzeBtn.style.opacity = '0.5';
    }
  } catch (e) {
    textPreview.innerHTML = '<span class="placeholder">Select text on page, then click "Analyze"</span>';
    analyzeBtn.disabled = true;
    analyzeBtn.style.opacity = '0.5';
  }
}

// --- Event Listeners ---
function setupEventListeners() {
  analyzeBtn.addEventListener('click', handleAnalyze);
  rewriteBtn.addEventListener('click', handleRewrite);
  rerewriteBtn.addEventListener('click', handleRewrite);
  copyBtn.addEventListener('click', handleCopy);
  saveKeyBtn.addEventListener('click', handleSaveKey);
  settingsToggle.addEventListener('click', toggleSettings);
  resetUsageBtn.addEventListener('click', handleResetUsage);

  toneBtns.forEach(btn => {
    btn.addEventListener('click', () => selectTone(btn.dataset.tone));
  });
}

function selectTone(tone) {
  selectedTone = tone;
  toneBtns.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.tone === tone);
  });
}

function toggleSettings() {
  settingsPanel.classList.toggle('hidden');
}

// --- Analyze ---
async function handleAnalyze() {
  if (!selectedText) return;

  setLoading(analyzeBtn, analyzeLoader, true);
  errorMsg.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'detect',
      text: selectedText
    });

    if (response.success) {
      detectionResult = response.data;
      showScore(detectionResult.score);
      // Show rewrite section
      rewriteSection.classList.remove('hidden');
    } else {
      showError(response.error || 'Analysis failed');
    }
  } catch (e) {
    showError('Failed to analyze. Please try again.');
  }

  setLoading(analyzeBtn, analyzeLoader, false);
}

function showScore(score) {
  let level, label;
  if (score >= 70) {
    level = 'high';
    label = 'Likely AI';
  } else if (score >= 40) {
    level = 'medium';
    label = 'Possibly AI';
  } else {
    level = 'low';
    label = 'Likely Human';
  }

  aiScore.className = `ai-score ${level}`;
  aiScore.textContent = `${score}% — ${label}`;
}

// --- Rewrite ---
async function handleRewrite() {
  if (!selectedText) return;

  setLoading(rewriteBtn, rewriteLoader, true);
  errorMsg.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'rewrite',
      text: selectedText,
      tone: selectedTone,
      apiKey: apiKey
    });

    if (response.success) {
      rewrittenText = response.data.rewritten;
      usage = response.data.usage;
      updateUsageBadge();
      showResult();
    } else {
      showError(response.error || 'Rewrite failed');
      if (response.error?.includes('daily free limit') || response.error?.includes('API key')) {
        settingsPanel.classList.remove('hidden');
      }
    }
  } catch (e) {
    showError('Failed to rewrite. Please check your connection and try again.');
  }

  setLoading(rewriteBtn, rewriteLoader, false);
}

function showResult() {
  resultBox.textContent = rewrittenText;
  resultTone.textContent = selectedTone;
  resultSection.classList.remove('hidden');
  // Scroll to result
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

// --- Copy ---
async function handleCopy() {
  if (!rewrittenText) return;

  try {
    await navigator.clipboard.writeText(rewrittenText);
    const originalText = copyBtn.textContent;
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => {
      copyBtn.textContent = originalText;
      copyBtn.classList.remove('copied');
    }, 2000);
  } catch (e) {
    showError('Failed to copy. Please try again.');
  }
}

// --- Settings ---
async function handleSaveKey() {
  const key = apiKeyInput.value.trim();
  if (!key) {
    showError('Please enter a valid API key.');
    return;
  }
  if (!key.startsWith('sk-')) {
    showError('Invalid DeepSeek API key. Keys should start with "sk-".');
    return;
  }

  try {
    await chrome.runtime.sendMessage({ action: 'setApiKey', apiKey: key });
    apiKey = key;
    errorMsg.classList.add('hidden');
    saveKeyBtn.textContent = 'Saved!';
    saveKeyBtn.style.background = '#10b981';
    setTimeout(() => {
      saveKeyBtn.textContent = 'Save Key';
      saveKeyBtn.style.background = '';
    }, 2000);
  } catch (e) {
    showError('Failed to save API key.');
  }
}

async function handleResetUsage() {
  const keys = await chrome.storage.local.get(null);
  const usageKeys = Object.keys(keys).filter(k => k.startsWith('usage-'));
  await chrome.storage.local.remove(usageKeys);
  await loadUsage();
  errorMsg.classList.add('hidden');
  resetUsageBtn.textContent = 'Usage Reset!';
  setTimeout(() => {
    resetUsageBtn.textContent = 'Reset Daily Usage';
  }, 2000);
}

// --- UI Helpers ---
function updateUsageBadge() {
  const { used, limit, canUse } = usage;
  usageBadge.textContent = `${used}/${limit} today`;
  if (!canUse) {
    usageBadge.classList.add('warning');
  } else {
    usageBadge.classList.remove('warning');
  }
}

function setLoading(button, loader, isLoading) {
  if (isLoading) {
    button.classList.add('loading');
  } else {
    button.classList.remove('loading');
  }
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
}