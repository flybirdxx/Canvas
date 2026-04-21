import React, { useState } from 'react';
import { Sparkles, Loader2, ImagePlus } from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import { v4 as uuidv4 } from 'uuid';
import { GoogleGenAI } from '@google/genai';

declare global {
  interface Window {
    aistudio?: {
      hasSelectedApiKey: () => Promise<boolean>;
      openSelectKey: () => Promise<void>;
    };
  }
}

export function AIPromptBar() {
  const { addElement, stageConfig, setSelection, setActiveTool, deleteElements } = useCanvasStore();
  const [prompt, setPrompt] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleGenerate = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!prompt.trim() || isGenerating) return;

    setIsGenerating(true);
    let tempId: string | null = null;
    
    try {
      const width = 512;
      const height = 512;
      
      // Calculate drop pos ahead of time to render the skeleton frame
      const x = (-stageConfig.x + window.innerWidth / 2) / stageConfig.scale - width / 2;
      const y = (-stageConfig.y + window.innerHeight / 2) / stageConfig.scale - height / 2;

      tempId = uuidv4();
      addElement({
        id: tempId,
        type: 'aigenerating',
        x,
        y,
        width,
        height
      } as any);

      // Check if user has selected a key for Gemini 3 Image
      if (window.aistudio && window.aistudio.hasSelectedApiKey) {
        const hasKey = await window.aistudio.hasSelectedApiKey();
        if (!hasKey) {
          await window.aistudio.openSelectKey();
        }
      }

      // Initialize GenAI
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
      
      const response = await ai.models.generateContent({
        model: 'gemini-3.1-flash-image-preview',
        contents: {
          parts: [{ text: prompt.trim() }]
        },
        config: {
          imageConfig: {
            aspectRatio: "1:1",
            imageSize: "512px"
          }
        }
      });
      
      let imageUrl = '';
      const parts = response.candidates?.[0]?.content?.parts || [];
      for (const part of parts) {
        if (part.inlineData) {
          const base64EncodeString = part.inlineData.data;
          // Fallback to image/png if mimeType is not provided
          const mimeType = part.inlineData.mimeType || 'image/png';
          imageUrl = `data:${mimeType};base64,${base64EncodeString}`;
          break;
        }
      }

      if (!imageUrl) {
        throw new Error("No image data returned from Gemini");
      }

      // Remove the skeleton frame
      deleteElements([tempId]);
      tempId = null;

      const finalId = uuidv4();
      addElement({
        id: finalId,
        type: 'image',
        x,
        y,
        width,
        height,
        src: imageUrl
      } as any);
      
      setActiveTool('select');
      setSelection([finalId]);
      setPrompt('');
    } catch (error) {
      console.error("Failed to generate image", error);
      alert("生成图像失败请重试。");
      if (tempId) {
        deleteElements([tempId]);
      }
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex items-center bg-white/95 backdrop-blur-xl shadow-[0_12px_40px_rgb(0,0,0,0.12)] border border-purple-200/60 rounded-full px-2 py-2 w-[600px] z-30 transition-all focus-within:shadow-[0_12px_40px_rgb(147,51,234,0.15)] focus-within:border-purple-300">
      <div className="flex items-center justify-center pl-4 pr-3 text-purple-600 bg-purple-50 h-8 rounded-full ml-1">
        <Sparkles className="w-4 h-4" />
      </div>
      <form onSubmit={handleGenerate} className="flex-1 flex items-center ml-2">
        <input 
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="输入画面描述，例如：一只坐在星空下的赛博朋克小猫..."
          className="flex-1 bg-transparent border-none text-[14px] text-gray-800 focus:outline-none focus:ring-0 px-2 placeholder-gray-400 font-medium"
          disabled={isGenerating}
        />
        <button 
          type="submit"
          disabled={isGenerating || !prompt.trim()}
          className="ml-2 flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white rounded-full text-[13px] font-bold transition-all disabled:opacity-60 disabled:cursor-not-allowed shadow-sm hover:shadow-md hover:-translate-y-0.5 active:translate-y-0"
        >
          {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImagePlus className="w-4 h-4" />}
          {isGenerating ? 'AI 配置与绘制中...' : '生成图像'}
        </button>
      </form>
    </div>
  );
}
