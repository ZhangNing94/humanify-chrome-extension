// Humanify - Background Service Worker
// One-Click mode: built-in API key, 3 free rewrites/day
// Issues #8, #9, #11, #12 combined

const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';
const FREE_DAILY_LIMIT = 3;
const MODEL = 'deepseek-chat';

// --- Built-in API Key (base64 obfuscated) ---
const BUILT_IN_KEY_B64 = 'c2stODc4Nzc1YmQtaXdXNHI5MXhBRGk3WktZVlQ4WDFZeTRjSGY2ZE9qbA==';
function _builtinKey() {
  return atob(BUILT_IN_KEY_B64);
}

// --- AI Detection Patterns ---
const AI_PATTERNS = [
  { pattern: /\b(delve|delve into|delve into the)\b/gi, weight: 3, label: 'AI favorite: "delve"' },
  { pattern: /\btapestry\b/gi, weight: 3, label: 'AI favorite: "tapestry"' },
  { pattern: /\bfoster(?:ing|s|ed)?\b/gi, weight: 2, label: 'AI favorite: "foster"' },
  { pattern: /\bbolster(?:ing|s|ed)?\b/gi, weight: 2, label: 'AI favorite: "bolster"' },
  { pattern: /\bpivotal\b/gi, weight: 2, label: 'AI favorite: "pivotal"' },
  { pattern: /\brealm\b/gi, weight: 2, label: 'AI favorite: "realm"' },
  { pattern: /\bunderscore(?:s|d)?\b/gi, weight: 2, label: 'AI favorite: "underscore"' },
  { pattern: /\bleverage\b/gi, weight: 2, label: 'AI favorite: "leverage"' },
  { pattern: /\bsynergy\b/gi, weight: 3, label: 'AI buzzword: "synergy"' },
  { pattern: /\bin today'?s (?:digital )?(?:age|landscape|world|era)\b/gi, weight: 4, label: 'AI cliche opening' },
  { pattern: /\bit is (?:important|crucial|essential|worth noting) (?:to|that)\b/gi, weight: 3, label: 'AI qualifier phrase' },
  { pattern: /\ba testament to\b/gi, weight: 3, label: 'AI phrase: "a testament to"' },
  { pattern: /\bnavigate the complexit(?:y|ies)\b/gi, weight: 3, label: 'AI phrase: "navigate the complexity"' },
  { pattern: /\bin (?:today|conclusion|summary)\b/gi, weight: 2, label: 'AI structure marker' },
  { pattern: /\bfurthermore\b/gi, weight: 3, label: 'Overly formal: "furthermore"' },
  { pattern: /\bmoreover\b/gi, weight: 3, label: 'Overly formal: "moreover"' },
  { pattern: /\bnevertheless\b/gi, weight: 2, label: 'Formal: "nevertheless"' },
  { pattern: /\bconsequently\b/gi, weight: 2, label: 'Formal: "consequently"' },
  { pattern: /\bhence\b/gi, weight: 2, label: 'Formal: "hence"' },
  { pattern: /\bthus\b/gi, weight: 1, label: 'Formal: "thus"' },
  { pattern: /\b(?:deeply|crucially|fundamentally|profoundly)\s+(?:important|significant|meaningful|impactful)\b/gi, weight: 3, label: 'AI emphasis phrase' },
  { pattern: /\bgame-chang(?:ing|er)\b/gi, weight: 3, label: 'AI buzzword: "game-changer"' },
  { pattern: /\bcutting-edge\b/gi, weight: 2, label: 'AI buzzword: "cutting-edge"' },
  { pattern: /\bparadigm shift\b/gi, weight: 3, label: 'AI buzzword: "paradigm shift"' },
  { pattern: /\b(?:firstly|secondly|thirdly)\b/gi, weight: 2, label: 'AI enumeration pattern' },
  { pattern: /\bin this (?:article|essay|piece|blog post)\b/gi, weight: 2, label: 'Self-referential' },
  { pattern: /\blet'?s (?:dive|explore|unpack|break down)\b/gi, weight: 3, label: 'AI hook phrase' },
];

const AI_SENTENCE_PATTERNS = [
  { pattern: /\bBy\s+(?:leveraging|utilizing|employing|harnessing|incorporating)\b/gi, weight: 3, label: 'AI sentence starter' },
  { pattern: /\u2014/g, weight: 1, label: 'Em dash usage' },
];

// --- Usage Tracking ---
function getTodayKey() {
  const now = new Date();
  return `usage-${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

async function getUsageCount() {
  const todayKey = getTodayKey();
  const data = await chrome.storage.local.get(todayKey);
  return data[todayKey] || 0;
}

async function incrementUsage() {
  const todayKey = getTodayKey();
  const count = await getUsageCount();
  await chrome.storage.local.set({ [todayKey]: count + 1 });
  return count + 1;
}

async function canUse() {
  const count = await getUsageCount();
  return { canUse: count < FREE_DAILY_LIMIT, used: count, limit: FREE_DAILY_LIMIT };
}

// --- API Key (One-Click mode) ---
// User's own key stored as base64 in chrome.storage.local
async function getEffectiveApiKey() {
  const data = await chrome.storage.local.get('deepseekApiKey');
  if (data.deepseekApiKey) {
    try { return atob(data.deepseekApiKey); } catch(e) { return _builtinKey(); }
  }
  return _builtinKey();
}

// --- AI Detection Engine ---
function detectAI(text) {
  const results = [];
  let totalWeight = 0;
  const maxPossibleWeight = AI_PATTERNS.reduce((sum, p) => sum + p.weight, 0) +
    AI_SENTENCE_PATTERNS.reduce((sum, p) => sum + p.weight, 0);

  for (const { pattern, weight, label } of AI_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      const matchWeight = Math.min(weight * matches.length, weight * 4);
      totalWeight += matchWeight;
      results.push({ label, count: matches.length, weight: matchWeight, examples: matches.slice(0, 3).join(', ') });
    }
  }

  for (const { pattern, weight, label } of AI_SENTENCE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      const matchWeight = Math.min(weight * matches.length, weight * 4);
      totalWeight += matchWeight;
      results.push({ label, count: matches.length, weight: matchWeight });
    }
  }

  const sentences = text.split(/[.!?]+\s*/).filter(s => s.trim().length > 0);
  let heuristicScore = 0;

  if (sentences.length >= 3) {
    const lengths = sentences.map(s => s.split(/\s+/).length);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    const variance = lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / lengths.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev < 3 && avgLen > 15 && sentences.length >= 3) {
      heuristicScore += 4;
      results.push({ label: 'Unusually consistent sentence lengths', count: 1, weight: 4 });
    }
  }

  const contractionCount = (text.match(/\b(?:don't|won't|can't|isn't|aren't|wasn't|weren't|didn't|doesn't|it's|that's|I'm|you're|we're|they're|she's|he's|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|we'd|they'd)\b/gi) || []).length;
  const wordCount = text.split(/\s+/).length;
  const expectedContractions = Math.floor(wordCount / 50);
  if (contractionCount < expectedContractions && wordCount > 80) {
    heuristicScore += 3;
    results.push({ label: 'Very few contractions (AI hallmark)', count: contractionCount, weight: 3 });
  }

  const patternScore = maxPossibleWeight > 0 ? (totalWeight / maxPossibleWeight) * 70 : 0;
  const heuristicMaxScore = 15;
  const heuristicNormalized = heuristicMaxScore > 0 ? Math.min(heuristicScore / heuristicMaxScore, 1) * 30 : 0;
  let score = Math.min(Math.round(patternScore + heuristicNormalized), 100);

  if (wordCount < 30) {
    score = Math.min(score, 50);
    results.push({ label: 'Text too short for reliable detection', count: wordCount, weight: 0 });
  }

  return { score, results, wordCount };
}

// --- DeepSeek API Client ---
async function rewriteWithDeepSeek(text, tone, apiKey) {
  const toneInstructions = {
    casual: 'Use conversational language, contractions (e.g., "it\'s", "don\'t"), short sentences, and a friendly tone. Write like you\'re talking to a friend. Use informal expressions, rhetorical questions, and occasional humor where appropriate. Vary sentence length for natural rhythm.',
    formal: 'Use professional language appropriate for business or academic contexts. Avoid contractions and slang. Maintain a polished, respectful tone. Use varied but controlled sentence structures.',
    neutral: 'Balance between casual and formal. Use moderate sentence length and natural vocabulary. Aim for a conversational yet polished tone. Use some contractions but avoid slang.'
  };

  const systemPrompt = `You are Humanify, an expert at rewriting AI-generated text to sound like natural human writing.

CRITICAL RULES:
1. NEVER use these AI-telltale words: delve, tapestry, foster, bolster, pivotal, realm, underscore, leverage, synergy, furthermore, moreover, nevertheless, consequently
2. NEVER start sentences with "By leveraging/utilizing/employing/harnessing"
3. NEVER use phrases like "in today's digital landscape", "it is important to note", "a testament to", "navigate the complexities"
4. Do NOT add new information, examples, or explanations not in the original
5. Preserve ALL facts, numbers, names, and key points exactly
6. Keep approximately the same length as the original
7. Vary sentence structure - mix short and long sentences
8. Use active voice whenever possible
9. ${toneInstructions[tone] || toneInstructions.neutral}

FORMAT: Return ONLY the rewritten text. No explanations, no markdown, no quotes around the response.`;

  const response = await fetch(DEEPSEEK_API_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: `Rewrite this AI-generated text to sound like a human wrote it:\n\n${text}` }
      ],
      temperature: 0.8,
      max_tokens: 2048,
      top_p: 0.95
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(`API error ${response.status}: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// --- Message Handlers ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true;
});

async function handleMessage(request, sender, sendResponse) {
  try {
    switch (request.action) {
      case 'detect': {
        const result = detectAI(request.text);
        sendResponse({ success: true, data: result });
        break;
      }

      case 'rewrite': {
        // Check usage limit
        const usage = await canUse();
        if (!usage.canUse) {
          sendResponse({
            success: false,
            error: 'Daily free limit reached',
            usage
          });
          return;
        }

        // Get effective API key (built-in or user's own)
        const apiKey = await getEffectiveApiKey();
        const rewritten = await rewriteWithDeepSeek(request.text, request.tone || 'neutral', apiKey);
        const newCount = await incrementUsage();
        const newUsage = { used: newCount, limit: FREE_DAILY_LIMIT, canUse: newCount < FREE_DAILY_LIMIT };

        sendResponse({ success: true, data: { rewritten, usage: newUsage } });
        break;
      }

      case 'getUsage': {
        const usage = await canUse();
        sendResponse({ success: true, data: usage });
        break;
      }

      case 'getApiKey': {
        // Return decoded key for display in popup
        const data = await chrome.storage.local.get('deepseekApiKey');
        const displayKey = data.deepseekApiKey ? (() => { try { return atob(data.deepseekApiKey); } catch(e) { return ''; } })() : '';
        sendResponse({ success: true, data: displayKey });
        break;
      }

      case 'setApiKey': {
        // Store as base64 (input is raw key string from popup)
        const rawKey = request.apiKey;
        const encoded = btoa(rawKey);
        await chrome.storage.local.set({ deepseekApiKey: encoded });
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown action: ${request.action}` });
    }
  } catch (error) {
    sendResponse({ success: false, error: error.message });
  }
}

// --- Installation ---
chrome.runtime.onInstalled.addListener(() => {
  console.log('Humanify extension installed - One-Click mode ready');
});