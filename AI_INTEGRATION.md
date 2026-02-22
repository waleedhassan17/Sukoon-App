# AI Model Integration Guide - Sukoon App

## Overview

This guide shows how to integrate your AI model with the Sukoon app without modifying the build system. The app is fully prepared for AI integration.

---

## Current Architecture

```
User Input Flow:
┌─────────────────┐
│  Voice Input    │ ← User speaks or types
└────────┬────────┘
         │
         ↓
┌─────────────────────────┐
│ Web Speech API / Input  │ ← Transcription to text
└────────┬────────────────┘
         │
         ↓
┌──────────────────────────┐
│ [AI Model Integration]   │ ← YOUR CODE GOES HERE
│ Analyze & Generate       │
│ Personalized Response    │
└────────┬─────────────────┘
         │
         ↓
┌─────────────────────┐
│ Display Result      │ ← Show AI output to user
└─────────────────────┘
```

---

## Integration Steps

### Step 1: Create AI Service Module

Create a new file: `lib/aiModel.ts`

```typescript
// lib/aiModel.ts
import { Platform } from 'react-native';

interface AIRequest {
  text: string;
  context?: string; // Optional: user context, preferences
  language?: string;
}

interface AIResponse {
  response: string;
  confidence?: number;
  timestamp: number;
}

class AIModelService {
  private apiEndpoint: string = 'YOUR_AI_API_ENDPOINT';
  private apiKey: string = 'YOUR_API_KEY';
  private isInitialized: boolean = false;

  /**
   * Initialize AI model (called once on app start)
   */
  async initialize(): Promise<void> {
    try {
      console.log('[AI] Initializing AI model...');
      
      // Option 1: Load local model (on-device)
      // await this.loadLocalModel();
      
      // Option 2: Connect to remote API
      await this.validateConnection();
      
      this.isInitialized = true;
      console.log('[AI] Model initialized successfully');
    } catch (error) {
      console.error('[AI] Initialization failed:', error);
      throw error;
    }
  }

  /**
   * Analyze user input and generate response
   */
  async analyzeInput(request: AIRequest): Promise<AIResponse> {
    if (!this.isInitialized) {
      throw new Error('AI model not initialized');
    }

    try {
      // Remove whitespace
      const cleanText = request.text.trim();
      if (!cleanText) {
        return {
          response: 'Please provide some text to analyze.',
          confidence: 0,
          timestamp: Date.now(),
        };
      }

      // Call your AI API or local model
      const response = await this.callAIModel(cleanText, request.context);

      return {
        response,
        confidence: 0.95, // AI confidence score
        timestamp: Date.now(),
      };
    } catch (error) {
      console.error('[AI] Analysis error:', error);
      throw error;
    }
  }

  /**
   * Call your AI API
   */
  private async callAIModel(text: string, context?: string): Promise<string> {
    // Example 1: REST API
    const payload = {
      text,
      context: context || 'spiritual_guidance',
      language: 'en',
      model: 'sukoon-v1',
    };

    const response = await fetch(this.apiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`);
    }

    const data = await response.json();
    return data.response || data.text || 'Unable to generate response';

    // Example 2: On-device model (TensorFlow Lite, ONNX Runtime, etc)
    // return await this.localModel.predict(text);

    // Example 3: OpenAI / Hugging Face API
    // return await this.callRemoteModel(text);
  }

  /**
   * Validate API connection
   */
  private async validateConnection(): Promise<void> {
    try {
      const response = await fetch(this.apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({ text: 'test', validate: true }),
      });

      if (!response.ok) {
        throw new Error(`Connection failed: ${response.status}`);
      }
    } catch (error) {
      console.warn('[AI] Connection validation failed:', error);
      // Continue anyway - API might be temporarily unavailable
    }
  }

  /**
   * Load local ML model (optional)
   * Example: TensorFlow Lite, ONNX Runtime, etc
   */
  private async loadLocalModel(): Promise<void> {
    // TODO: Implement based on your ML framework
    // Example with TensorFlow Lite:
    // const model = await tflite.loadModel({
    //   model: require('./models/sukoon-model.tflite'),
    // });
    // this.localModel = model;
  }

  /**
   * Get model status
   */
  getStatus(): { initialized: boolean; endpoint: string } {
    return {
      initialized: this.isInitialized,
      endpoint: this.apiEndpoint,
    };
  }
}

// Export singleton instance
export const aiModel = new AIModelService();
export type { AIRequest, AIResponse };
```

### Step 2: Update Voice Input Component

Edit: `components/VoiceInputButton.tsx`

Find the section where text is captured from voice input and add AI processing:

```typescript
// In VoiceInputButton.tsx, in the handleSpeechResult function:

import { aiModel, type AIResponse } from '../lib/aiModel';

async function handleSpeechResult(text: string) {
  try {
    // Display transcribed text immediately
    setDisplayText(text);
    
    // 🔥 NEW: Process with AI model
    console.log('[Voice] Sending to AI model:', text);
    const aiResponse: AIResponse = await aiModel.analyzeInput({
      text,
      context: 'user_query', // or 'spiritual_guidance', etc
      language: 'en',
    });

    console.log('[Voice] AI Response:', aiResponse);

    // Update input with AI response
    setInputValue(aiResponse.response);
    setDisplayText(aiResponse.response);

    // Optional: Show confidence if high enough
    if (aiResponse.confidence && aiResponse.confidence < 0.7) {
      console.warn('[Voice] Low confidence response:', aiResponse.confidence);
    }

  } catch (error) {
    console.error('[Voice] AI processing failed:', error);
    // Fall back to showing original transcription
    setInputValue(text);
    setDisplayText(text);
    // Show error to user
    Alert.alert('Processing Error', 'Could not process your input with AI model');
  }
}
```

### Step 3: Initialize AI Model on App Start

Edit: `app/_layout.tsx` (root layout)

```typescript
// In app/_layout.tsx

import { aiModel } from '../lib/aiModel';
import { useEffect } from 'react';

export default function RootLayout() {
  useEffect(() => {
    // Initialize AI model when app starts
    aiModel.initialize()
      .then(() => console.log('[App] AI model ready'))
      .catch(err => console.error('[App] AI init failed:', err));
  }, []);

  return (
    // ... rest of layout
  );
}
```

### Step 4: Update Environment Variables (Optional)

Create `.env.local`:

```bash
# .env.local
EXPO_PUBLIC_AI_ENDPOINT=https://your-api.example.com/api/analyze
EXPO_PUBLIC_AI_KEY=your-api-key-here
```

Then use in `lib/aiModel.ts`:

```typescript
private apiEndpoint: string = process.env.EXPO_PUBLIC_AI_ENDPOINT || '';
private apiKey: string = process.env.EXPO_PUBLIC_AI_KEY || '';
```

---

## Testing Your Integration

### 1. Local Testing (Web)

```bash
cd ~/Sukoon/Sukoon-App

# Start dev server
npx expo start --web

# Test voice + AI in browser
# Say something → AI processes → Response shown
```

### 2. Device Testing

```bash
# Build and test on Android device
./build-debug.sh

# Then install:
adb install -r Sukoon-debug.apk

# Test on device
# Check logs: adb logcat | grep "\[AI\]"
```

### 3. Debugging

```bash
# View AI logs
adb logcat | grep "\[Voice\]"
adb logcat | grep "\[AI\]"

# Check API connectivity
curl -X POST https://your-api.example.com/api/analyze \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_KEY" \
  -d '{"text":"test"}'
```

---

## Example Implementations

### Using OpenAI API

```typescript
private async callAIModel(text: string): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${this.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4',
      messages: [{
        role: 'system',
        content: 'You are a helpful spiritual guidance assistant.',
      }, {
        role: 'user',
        content: text,
      }],
      max_tokens: 150,
    }),
  });

  const data = await response.json();
  return data.choices[0].message.content;
}
```

### Using Hugging Face API

```typescript
private async callAIModel(text: string): Promise<string> {
  const response = await fetch(
    'https://api-inference.huggingface.co/models/gpt2',
    {
      headers: { Authorization: `Bearer ${this.apiKey}` },
      method: 'POST',
      body: JSON.stringify({ inputs: text }),
    },
  );
  
  const result = await response.json();
  return result[0].generated_text;
}
```

### Using On-Device TensorFlow Lite

```typescript
import * as tf from '@tensorflow/tfjs';
import { bundleResourceIO } from '@tensorflow/tfjs-react-native';

private async loadLocalModel(): Promise<void> {
  const modelJson = require('./models/model.json');
  const modelWeights = require('./models/model.weights.bin');
  
  this.localModel = await tf.loadLayersModel(
    bundleResourceIO(modelJson, modelWeights)
  );
}

private async callAIModel(text: string): Promise<string> {
  // Tokenize input
  const tokens = this.tokenize(text);
  
  // Run inference
  const prediction = this.localModel.predict(tf.tensor2d([tokens]));
  
  // Decode output
  return this.decodeTokens(prediction);
}
```

---

## Building After AI Integration

### Build Debug APK

```bash
./build-debug.sh

# Follow prompts to submit to EAS
# Download when ready
# Install: adb install -r Sukoon-debug.apk
```

### Build Release APK

```bash
./build-release.sh

# Follow prompts to update version
# Submit to EAS
# Download when ready
# Install: adb install -r Sukoon-v1.1.0.apk
```

**No Gradle changes needed** - your changes to `lib/aiModel.ts` and components are automatically bundled.

---

## Performance Optimization

### Caching Responses

```typescript
private cache = new Map<string, AIResponse>();

async analyzeInput(request: AIRequest): Promise<AIResponse> {
  const key = request.text.toLowerCase();
  
  // Check cache
  if (this.cache.has(key)) {
    return this.cache.get(key)!;
  }
  
  // Get from AI
  const response = await this.callAIModel(request.text);
  
  // Store in cache
  this.cache.set(key, response);
  
  return response;
}
```

### Async Processing

```typescript
// Don't block UI while processing
async handleSpeechResult(text: string) {
  setDisplayText(text); // Show immediately
  
  // Process AI async
  aiModel.analyzeInput({ text }).then(response => {
    setInputValue(response.response);
  });
}
```

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| API timeout | Increase fetch timeout, add retry logic |
| Network error | Check WIFI, use platform-specific debugging |
| Low confidence | Adjust prompts, use better training data |
| Slow response | Add loading spinner, use caching |
| Model too large | Use quantization, on-device inference |

---

## Next Steps

1. ✅ Create `lib/aiModel.ts`
2. ✅ Update `components/VoiceInputButton.tsx`
3. ✅ Initialize in `app/_layout.tsx`
4. ✅ Test on web: `npx expo start --web`
5. ✅ Build debug APK: `./build-debug.sh`
6. ✅ Test on device and validate AI responses
7. ✅ Build release: `./build-release.sh`
8. ✅ Deploy to Play Store (when ready)

---

## References

- **OpenAI API**: https://platform.openai.com/docs
- **Hugging Face**: https://huggingface.co/inference-api
- **TensorFlow Lite**: https://www.tensorflow.org/lite
- **ONNX Runtime**: https://onnxruntime.ai/

---

**Last Updated**: February 21, 2026  
**Status**: Ready for Integration ✅
