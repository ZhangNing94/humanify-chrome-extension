// Humanify - Background Service Worker
// Handles Groq API calls, AI detection, usage tracking

const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
const FREE_DAILY_LIMIT = 5;
const MODEL = 'llama-3.3-70b-versatile';

// --- AI Detection Patterns ---
// Words and phrases highly characteristic of AI-generated text
const AI_PATTERNS = [
  // Overused AI transition words
  { pattern: /\b(delve|delve into|delve into the)\b/gi, weight: 3, label: 'AI favorite: "delve"' },
  { pattern: /\btapestry\b/gi, weight: 3, label: 'AI favorite: "tapestry"' },
  { pattern: /\bfoster(?:ing|s|ed)?\b/gi, weight: 2, label: 'AI favorite: "foster"' },
  { pattern: /\bbolster(?:ing|s|ed)?\b/gi, weight: 2, label: 'AI favorite: "bolster"' },
  { pattern: /\bpivotal\b/gi, weight: 2, label: 'AI favorite: "pivotal"' },
  { pattern: /\brealm\b/gi, weight: 2, label: 'AI favorite: "realm"' },
  { pattern: /\bunderscore(?:s|d)?\b/gi, weight: 2, label: 'AI favorite: "underscore"' },
  { pattern: /\bleverage\b/gi, weight: 2, label: 'AI favorite: "leverage"' },
  { pattern: /\bsynergy\b/gi, weight: 3, label: 'AI buzzword: "synergy"' },

  // AI-typical phrases
  { pattern: /\bin today'?s (?:digital )?(?:age|landscape|world|era)\b/gi, weight: 4, label: 'AI cliche opening' },
  { pattern: /\bit is (?:important|crucial|essential|worth noting) (?:to|that)\b/gi, weight: 3, label: 'AI qualifier phrase' },
  { pattern: /\ba testament to\b/gi, weight: 3, label: 'AI phrase: "a testament to"' },
  { pattern: /\bnavigate the complexit(?:y|ies)\b/gi, weight: 3, label: 'AI phrase: "navigate the complexity"' },
  { pattern: /\bin (?:today|conclusion|summary)\b/gi, weight: 2, label: 'AI structure marker' },

  // Overly formal/stiff constructions
  { pattern: /\bfurthermore\b/gi, weight: 3, label: 'Overly formal: "furthermore"' },
  { pattern: /\bmoreover\b/gi, weight: 3, label: 'Overly formal: "moreover"' },
  { pattern: /\bnevertheless\b/gi, weight: 2, label: 'Formal: "nevertheless"' },
  { pattern: /\bconsequently\b/gi, weight: 2, label: 'Formal: "consequently"' },
  { pattern: /\bhence\b/gi, weight: 2, label: 'Formal: "hence"' },
  { pattern: /\bthus\b/gi, weight: 1, label: 'Formal: "thus"' },

  // AI's love for certain adjectives
  { pattern: /\b(?:deeply|crucially|fundamentally|profoundly)\s+(?:important|significant|meaningful|impactful)\b/gi, weight: 3, label: 'AI emphasis phrase' },
  { pattern: /\bgame-chang(?:ing|er)\b/gi, weight: 3, label: 'AI buzzword: "game-changer"' },
  { pattern: /\bcutting-edge\b/gi, weight: 2, label: 'AI buzzword: "cutting-edge"' },
  { pattern: /\bparadigm shift\b/gi, weight: 3, label: 'AI buzzword: "paradigm shift"' },

  // Structural AI tells
  { pattern: /\b(?:firstly|secondly|thirdly)\b/gi, weight: 2, label: 'AI enumeration pattern' },
  { pattern: /\bin this (?:article|essay|piece|blog post)\b/gi, weight: 2, label: 'Self-referential' },
  { pattern: /\blet'?s (?:dive|explore|unpack|break down)\b/gi, weight: 3, label: 'AI hook phrase' },
];

// AI typical sentence structures (multi-line)
const AI_SENTENCE_PATTERNS = [
  // Sentences starting with "By [verb-ing]"
  { pattern: /\bBy\s+(?:leveraging|utilizing|employing|harnessing|incorporating)\b/gi, weight: 3, label: 'AI sentence starter' },
  // Em dash overuse (AI loves em dashes)
  { pattern: /\\u2014/g, weight: 1, label: 'Em dash usage' },
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

// --- AI Detection Engine ---
function detectAI(text) {
  const results = [];
  let totalWeight = 0;
  const maxPossibleWeight = AI_PATTERNS.reduce((sum, p) => sum + p.weight, 0)
    + AI_SENTENCE_PATTERNS.reduce((sum, p) => sum + p.weight, 0);

  // Check word/phrase patterns
  for (const { pattern, weight, label } of AI_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      const matchWeight = Math.min(weight * matches.length, weight * 4); // Cap per pattern
      totalWeight += matchWeight;
      results.push({
        label,
        count: matches.length,
        weight: matchWeight,
        examples: matches.slice(0, 3).join(', ')
      });
    }
  }

  // Check sentence structure patterns
  for (const { pattern, weight, label } of AI_SENTENCE_PATTERNS) {
    const matches = text.match(pattern);
    if (matches) {
      const matchWeight = Math.min(weight * matches.length, weight * 4);
      totalWeight += matchWeight;
      results.push({
        label,
        count: matches.length,
        weight: matchWeight
      });
    }
  }

  // Additional heuristics
  const sentences = text.split(/[.!?]+\\s*/).filter(s => s.trim().length > 0);
  let heuristicScore = 0;

  // Check average sentence length (AI tends toward medium-long consistent sentences)
  if (sentences.length >= 3) {
    const lengths = sentences.map(s => s.split(/\\s+/).length);
    const avgLen = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    // Calculate variance
    const variance = lengths.reduce((sum, l) => sum + (l - avgLen) ** 2, 0) / lengths.length;
    const stdDev = Math.sqrt(variance);

    // Very low variance = suspiciously consistent sentence length
    if (stdDev < 3 && avgLen > 15 && sentences.length >= 3) {
      heuristicScore += 4;
      results.push({ label: 'Unusually consistent sentence lengths', count: 1, weight: 4 });
    }
  }

  // Check for lack of contractions (AI rarely uses contractions)
  const contractionCount = (text.match(/\b(?:don't|won't|can't|isn't|aren't|wasn't|weren't|didn't|doesn't|it's|that's|I'm|you're|we're|they're|she's|he's|I've|you've|we've|they've|I'll|you'll|we'll|they'll|I'd|you'd|we'd|they'd)\b/gi) || []).length;
  const wordCount = text.split(/\\s+/).length;
  const expectedContractions = Math.floor(wordCount / 50); // Roughly 1 per 50 words in human text
  if (contractionCount < expectedContractions && wordCount > 80) {
    heuristicScore += 3;
    results.push({ label: 'Very few contractions (AI hallmark)', count: contractionCount, weight: 3 });
  }

  // Calculate score (0-100 scale)
  const patternScore = maxPossibleWeight > 0 ? (totalWeight / maxPossibleWeight) * 70 : 0;
  const heuristicMaxScore = 15; // tuned
  const heuristicNormalized = heuristicMaxScore > 0 ? Math.min(heuristicScore / heuristicMaxScore, 1) * 30 : 0;
  let score = Math.min(Math.round(patternScore + heuristicNormalized), 100);

  // Adjust: very short text is harder to judge
  if (wordCount < 30) {
    score = Math.min(score, 50); // Cap confidence for short texts
    results.push({ label: 'Text too short for reliable detection', count: wordCount, weight: 0 });
  }

  return { score, results, wordCount };
}

// --- Groq API Client ---
async function rewriteWithGroq(text, tone, apiKey) {
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

  const response = await fetch(GROQ_API_URL, {
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
    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your Groq API key in settings.');
    }
    if (response.status === 429) {
      throw new Error('Groq API rate limit exceeded. Please wait a moment and try again.');
    }
    throw new Error(`Groq API error: ${error.error?.message || response.statusText}`);
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// --- Message Handlers ---
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  handleMessage(request, sender, sendResponse);
  return true; // Keep channel open for async response
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
        const apiKey = request.apiKey;
        if (!apiKey) {
          sendResponse({ success: false, error: 'Please set your Groq API key in settings.' });
          return;
        }

        // Check usage limit
        const usage = await canUse();
        if (!usage.canUse) {
          sendResponse({
            success: false,
            error: `Daily free limit reached (${usage.used}/${usage.limit}). Upgrade to Pro for unlimited rewrites.`,
            usage
          });
          return;
        }

        const rewritten = await rewriteWithGroq(request.text, request.tone || 'neutral', apiKey);
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
        const data = await chrome.storage.local.get('groqApiKey');
        sendResponse({ success: true, data: data.groqApiKey || null });
        break;
      }

      case 'setApiKey': {
        await chrome.storage.local.set({ groqApiKey: request.apiKey });
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
  console.log('Humanify extension installed');
});