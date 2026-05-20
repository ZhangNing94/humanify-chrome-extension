// Humanify Popup — Main UI logic
// Issues #8, #9, #11, #12 combined

// --- DOM References ---
const textPreview = document.getElementById('textPreview');
const analyzeBtn = document.getElementById('analyzeBtn');
const rewriteBtn = document.getElementById('rewriteBtn');
const rewriteSection = document.getElementById('rewriteSection');
const resultSection = document.getElementById('resultSection');
const resultBox = document.getElementById('resultBox');
const resultTone = document.getElementById('resultTone');
const copyBtn = document.getElementById('copyBtn');
const replaceBtn = document.getElementById('replaceBtn');
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
const upgradeBanner = document.getElementById('upgradeBanner');
const upgradeBtn = document.getElementById('upgradeBtn');
const notNowBtn = document.getElementById('notNowBtn');

// --- State ---
let selectedText = '';
let selectedTone = 'casual';
let detectionResult = null;
let rewrittenText = '';
let originalText = '';
let usage = { used: 0, limit: 3, canUse: true };

// --- Initialization ---
document.addEventListener('DOMContentLoaded', async () => {
  await loadUsage();
  await getSelectedText();
  setupEventListeners();
});

async function loadUsage() {
  try {
    const response = await chrome.runtime.sendMessage({ action: 'getUsage' });
    if (response.success) {
      usage = response.data;
      updateUsageBadge();
    }
  } catch (e) { /* ignore */ }
}

async function getSelectedText() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { analyzeBtn.disabled = false; return; }
    const response = await chrome.tabs.sendMessage(tab.id, { action: 'getSelectedText' });
    if (response?.text) {
      selectedText = response.text;
      textPreview.value = selectedText;
    }
  } catch (e) { /* Content script may not be ready */ }
  analyzeBtn.disabled = false;
  analyzeBtn.style.opacity = '1';
}

// --- Event Listeners ---
function setupEventListeners() {
  analyzeBtn.addEventListener('click', handleAnalyze);
  rewriteBtn.addEventListener('click', handleRewrite);
  rerewriteBtn.addEventListener('click', handleRewrite);
  copyBtn.addEventListener('click', handleCopy);
  replaceBtn.addEventListener('click', handleReplace);
  saveKeyBtn.addEventListener('click', handleSaveKey);
  settingsToggle.addEventListener('click', toggleSettings);
  resetUsageBtn.addEventListener('click', handleResetUsage);
  upgradeBtn.addEventListener('click', handleUpgrade);
  notNowBtn.addEventListener('click', () => upgradeBanner.classList.remove('visible'));
  toneBtns.forEach(btn => {
    btn.addEventListener('click', () => selectTone(btn.dataset.tone));
  });
}

function selectTone(tone) {
  selectedTone = tone;
  toneBtns.forEach(btn => btn.classList.toggle('active', btn.dataset.tone === tone));
}

function toggleSettings() { settingsPanel.classList.toggle('hidden'); }

// --- Analyze ---
async function handleAnalyze() {
  selectedText = textPreview.value.trim();
  if (!selectedText) return;
  originalText = selectedText;
  setLoading(analyzeBtn, analyzeLoader, true);
  errorMsg.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({ action: 'detect', text: selectedText });
    if (response.success) {
      detectionResult = response.data;
      showScore(detectionResult.score);
      rewriteSection.classList.remove('hidden');
    } else {
      showError(response.error || 'Analysis failed');
    }
  } catch (e) {
    showError('Something went wrong. Please try again.');
  }
  setLoading(analyzeBtn, analyzeLoader, false);
}

function showScore(score) {
  let level, label;
  if (score >= 70) { level = 'high'; label = 'Likely AI'; }
  else if (score >= 40) { level = 'medium'; label = 'Possibly AI'; }
  else { level = 'low'; label = 'Likely Human'; }
  aiScore.className = `ai-score ${level}`;
  aiScore.textContent = `${score}% — ${label}`;
}

// --- Rewrite ---
async function handleRewrite() {
  selectedText = textPreview.value.trim();
  if (!selectedText) return;
  if (!originalText) originalText = selectedText;
  setLoading(rewriteBtn, rewriteLoader, true);
  errorMsg.classList.add('hidden');

  try {
    const response = await chrome.runtime.sendMessage({
      action: 'rewrite',
      text: selectedText,
      tone: selectedTone
    });

    if (response.success) {
      rewrittenText = response.data.rewritten;
      usage = response.data.usage;
      updateUsageBadge();
      showResult();
    } else {
      // Human-friendly error messages (Issue #9)
      const err = response.error || '';
      let friendlyMsg = err;
      if (err.includes('401') || err.includes('Invalid') || err.includes('invalid') || err.includes('API key')) {
        friendlyMsg = 'Key expired. Go to Settings to update it.';
      } else if (err.includes('429') || err.includes('rate limit') || err.includes('Rate limit')) {
        friendlyMsg = 'Used too fast, wait a moment and try again.';
      } else if (err.includes('402') || err.includes('balance') || err.includes('insufficient')) {
        friendlyMsg = 'API credits ran out. Try again later or use your own key.';
      } else if (err.includes('daily free limit') || err.includes('Daily free limit')) {
        friendlyMsg = '3/3 free today! Want more? Check out Pro.';
        showUpgradePrompt();
        return;
      } else {
        friendlyMsg = 'Something went wrong. Please try again.';
      }
      showError(friendlyMsg);
    }
  } catch (e) {
    showError('Something went wrong. Please try again.');
  }
  setLoading(rewriteBtn, rewriteLoader, false);
}

function showResult() {
  resultBox.textContent = rewrittenText;
  resultTone.textContent = selectedTone;
  resultSection.classList.remove('hidden');
  resultSection.scrollIntoView({ behavior: 'smooth' });
}

// --- Copy ---
async function handleCopy() {
  if (!rewrittenText) return;
  try {
    await navigator.clipboard.writeText(rewrittenText);
    copyBtn.textContent = 'Copied!';
    copyBtn.classList.add('copied');
    setTimeout(() => { copyBtn.textContent = 'Copy'; copyBtn.classList.remove('copied'); }, 2000);
  } catch (e) { showError('Copy failed.'); }
}

// --- Replace (Issue #9) ---
async function handleReplace() {
  if (!rewrittenText) return;
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab) { showError('No active tab found.'); return; }
    await chrome.tabs.sendMessage(tab.id, {
      action: 'replaceText',
      originalText: originalText,
      newText: rewrittenText
    });
    // Brief visual feedback
    replaceBtn.textContent = 'Replaced!';
    replaceBtn.style.background = '#6ee7b7';
    setTimeout(() => { replaceBtn.textContent = 'Replace'; replaceBtn.style.background = ''; }, 1500);
  } catch (e) {
    showError('Could not replace text on this page.');
  }
}

// --- Upgrade ---
function handleUpgrade() {
  chrome.tabs.create({ url: 'https://humanify.lemonsqueezy.com/checkout/buy/xxx' });
}

function showUpgradePrompt() {
  upgradeBanner.classList.add('visible');
  const bannerText = upgradeBanner.querySelector('.upgrade-banner-text');
  bannerText.textContent = `Want more? You've used ${usage.limit}/${usage.limit} free rewrites today`;
}

// --- Settings ---
// API key encoded as base64 in background.js
async function handleSaveKey() {
  const key = apiKeyInput.value.trim();
  if (!key) { showError('Please enter a valid API key.'); return; }
  if (!key.startsWith('sk-')) { showError('Invalid key. Keys should start with "sk-".'); return; }
  try {
    // Send raw key — background.js handles base64 encoding
    await chrome.runtime.sendMessage({ action: 'setApiKey', apiKey: key });
    errorMsg.classList.add('hidden');
    saveKeyBtn.textContent = 'Saved!';
    saveKeyBtn.style.background = '#10b981';
    setTimeout(() => { saveKeyBtn.textContent = 'Save Key'; saveKeyBtn.style.background = ''; }, 2000);
  } catch (e) { showError('Failed to save key.'); }
}

async function handleResetUsage() {
  const keys = await chrome.storage.local.get(null);
  const usageKeys = Object.keys(keys).filter(k => k.startsWith('usage-'));
  await chrome.storage.local.remove(usageKeys);
  await loadUsage();
  errorMsg.classList.add('hidden');
  upgradeBanner.classList.remove('visible');
  resetUsageBtn.textContent = 'Usage Reset!';
  setTimeout(() => { resetUsageBtn.textContent = 'Reset Daily Usage'; }, 2000);
}

// --- UI Helpers ---
function updateUsageBadge() {
  const { used, limit, canUse } = usage;
  usageBadge.textContent = `${used}/${limit} free today`;
  if (!canUse) { usageBadge.classList.add('warning'); showUpgradePrompt(); }
  else { usageBadge.classList.remove('warning'); }
}

function setLoading(button, loader, isLoading) {
  button.classList.toggle('loading', isLoading);
  if (isLoading) button.disabled = true;
  else button.disabled = false;
}

function showError(message) {
  errorMsg.textContent = message;
  errorMsg.classList.remove('hidden');
}