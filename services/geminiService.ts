import { GoogleGenAI, Type, Schema } from "@google/genai";
import { MechanicResponse } from "../types";
import { Capacitor, CapacitorHttp } from '@capacitor/core';

// --- NVIDIA FALLBACK CONFIGURATION ---
const NVIDIA_API_KEY = "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";
// Use Proxy path instead of direct URL to avoid CORS
const NVIDIA_BASE_URL = "/api/nvidia";
const NVIDIA_MODEL = "meta/llama-3.1-405b-instruct";

// Unified Schema
const mechanicResponseSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    vehicle_info: {
      type: Type.STRING,
      description: "Identifikasi Kendaraan (Merk/Model/Tahun/Mesin)",
    },
    component_id: {
      type: Type.STRING,
      description: "ID Komponen atau Kode Part Utama.",
    },
    component_name: {
      type: Type.STRING,
      description: "Nama Komponen dalam BAHASA INGGRIS TEKNIS (cth: 'Brake Caliper Assembly').",
    },
    diagnosis: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Daftar kemungkinan diagnosa dalam BAHASA INDONESIA yang jelas dan lugas.",
    },
    similar_cases: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          case_name: { type: Type.STRING, description: "Judul kasus serupa (Bahasa Indonesia)." },
          relevance_score: { type: Type.STRING, description: "Tingkat kecocokan (cth: 'Sangat Relevan - 95%')." },
          related_dtc: { type: Type.ARRAY, items: { type: Type.STRING } },
          culprit_component: { type: Type.STRING, description: "Komponen biang kerok utama (Technical English)." },
          symptoms_match: { type: Type.STRING, description: "Gejala yang mirip dalam Bahasa Indonesia." },
          solution_steps: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Langkah penanganan dalam Bahasa Indonesia yang instruktif." },
          video_ref: {
            type: Type.OBJECT,
            properties: { title: { type: Type.STRING }, url: { type: Type.STRING } },
            required: ["title", "url"]
          },
          image_search_keywords: { type: Type.STRING, description: "Keyword spesifik visual part rusak/lokasi untuk digenerate." }
        },
        required: ["case_name", "relevance_score", "related_dtc", "culprit_component", "symptoms_match", "solution_steps", "video_ref", "image_search_keywords"]
      },
      description: "Cari 1-2 Kasus Serupa (Real World Cases) dari database repair manual global/forum mekanik.",
    },
    dtc_list: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          code: { type: Type.STRING },
          definition: { type: Type.STRING, description: "Definisi dalam Bahasa Indonesia." },
          possible_cause: { type: Type.STRING, description: "Penyebab dalam Bahasa Indonesia." },
          related_components: { type: Type.STRING },
          symptoms: { type: Type.STRING, description: "Gejala dalam Bahasa Indonesia." },
          fix_suggestion: { type: Type.STRING, description: "Saran perbaikan dalam Bahasa Indonesia." }
        },
        required: ["code", "definition", "possible_cause", "related_components", "symptoms", "fix_suggestion"]
      },
      description: "Daftar kode error (DTC).",
    },
    tsb_list: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          summary: { type: Type.STRING }
        },
        required: ["id", "summary"]
      },
      description: "TSB/Recall.",
    },
    manual_summary: {
      type: Type.STRING,
      description: "Ringkasan repair manual (Bahasa Indonesia). To-the-point.",
    },
    wiring_diagram_desc: {
      type: Type.STRING,
      description: "Deskripsi tekstual jalur kabel & pinout dalam Bahasa Indonesia.",
    },
    wiring_search_keywords: {
      type: Type.STRING,
      description: "Keyword pencarian gambar wiring.",
    },
    maintenance_data: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          item: { type: Type.STRING },
          spec: { type: Type.STRING },
          value: { type: Type.STRING },
          oem_part_number: { type: Type.STRING, description: "Nomor Part Original (OEM)" },
          oem_brand: { type: Type.STRING, description: "Merk Original (misal: Toyota Genuine Parts)" },
          aftermarket_parts: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                brand: { type: Type.STRING },
                part_number: { type: Type.STRING },
                estimated_price: { type: Type.STRING }
              },
              required: ["brand", "part_number", "estimated_price"]
            },
            description: "Daftar 2-3 opsi part aftermarket populer dan estimasi harganya."
          }
        },
        required: ["item", "spec", "value"]
      },
      description: "Data spesifikasi perawatan, termasuk part number OEM dan alternatif Aftermarket.",
    },
    torque_specs: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          part: { type: Type.STRING },
          value: { type: Type.STRING },
          size: { type: Type.STRING },
        },
        required: ["part", "value"]
      },
      description: "Tabel torsi.",
    },
    tools_list: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Daftar tools (English Terms).",
    },
    safety_warning: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Prosedur keselamatan dalam Bahasa Indonesia.",
    },
    sop_steps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "Langkah perbaikan. Langsung ke inti teknis (Bahasa Indonesia).",
    },
    video_tutorials: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          url: { type: Type.STRING },
        },
        required: ["title", "url"],
      },
      description: "Link video tutorial.",
    },
    estimated_work_time: {
      type: Type.STRING,
      description: "Estimasi waktu (Flat Rate Time).",
    },
    cost_estimation: {
      type: Type.OBJECT,
      properties: {
        parts_total: { type: Type.STRING },
        labor_cost: { type: Type.STRING },
        hourly_rate: { type: Type.STRING, description: "Tarif jasa per jam rata-rata bengkel resmi untuk merk ini (cth: Rp 225.000/Jam)." },
        total_estimate: { type: Type.STRING },
      },
      required: ["parts_total", "labor_cost", "hourly_rate", "total_estimate"],
      description: "Estimasi biaya dealer.",
    }
  },
  required: [
    "vehicle_info",
    "component_id",
    "component_name",
    "diagnosis",
    "similar_cases",
    "dtc_list",
    "tsb_list",
    "wiring_diagram_desc",
    "wiring_search_keywords",
    "manual_summary",
    "maintenance_data",
    "torque_specs",
    "tools_list",
    "safety_warning",
    "sop_steps",
    "video_tutorials",
    "estimated_work_time",
    "cost_estimation"
  ],
};

const SYSTEM_INSTRUCTION = `
Role:
Anda adalah "Master AI Mechanic" dengan akses ke database pengetahuan global.

Instruction (LANGUAGE STYLE - VERY IMPORTANT):
- GUNAKAN BAHASA INDONESIA yang JELAS, LUWES, dan MUDAH DIPAHAMI untuk semua penjelasan, langkah perbaikan, gejala, dan solusi.
- GUNAKAN BAHASA INGGRIS TEKNIS (Standard Automotive) HANYA UNTUK: Nama Komponen (Parts), Nama Sensor, Alat (Tools), dan Kode DTC.
- JANGAN menerjemahkan istilah teknis yang baku (misal: "Crankshaft Position Sensor" jangan diubah jadi "Sensor Posisi Poros Engkol", tetap gunakan "Crankshaft Position Sensor").

Instruction (SIMILAR CASES & DTC RESEARCH):
- RISET MENDALAM: Gunakan referensi "CarParts.com – OBD2 Codes List & Guide" sebagai acuan utama jika terdeteksi Kode Error (DTC).
- Jika input mengandung DTC, WAJIB sertakan analisa solusi spesifik dari referensi tersebut ke dalam bagian 'similar_cases'.
- Jelaskan solusi DTC tersebut dalam Bahasa Indonesia yang mudah dimengerti mekanik lokal.
- Cari referensi kasus nyata yang relevan.
- Berikan jawaban yang sifatnya "FIX" atau solusi pasti.

Instruction (VIDEO LINKS - STRICT):
- TUGAS UTAMA: Pastikan Link Video bisa dibuka (Aktif).
- JIKA ANDA TAHU URL Video YouTube spesifik yang valid (cth: channel ChrisFix, ScannerDanner), gunakan itu.
- JIKA TIDAK YAKIN 100%, ATAU UNTUK MENGHINDARI LINK MATI/BROKEN: Gunakan format Link Pencarian YouTube:
  Format: "https://www.youtube.com/results?search_query=" + [Keywords Spesifik Kerusakan & Mobil]
  Contoh: "https://www.youtube.com/results?search_query=Toyota+Innova+Diesel+P0093+Fix"
- DILARANG mengarang/hallucinate ID video YouTube acak yang akan menghasilkan 404 (Halaman Kosong).

Analysis Policy:
1. Analisa Text/Image/Audio.
2. Prioritas spek kendaraan Indonesia.
3. Respon padat dan solutif.

Output format:
JSON only.
`;

export interface MediaInput {
  data: string; // Base64 string
  mimeType: string; // e.g., 'image/jpeg' or 'audio/wav'
}

// Helper: Call Nvidia AI
async function getNvidiaAdvice(input: string, media: MediaInput | null, systemInstruction: string): Promise<MechanicResponse> {
  // Serialize Schema for Nvidia/Llama Prompt
  const schemaStr = JSON.stringify(mechanicResponseSchema, null, 2);
  const enhancedSystemPrompt = `${systemInstruction}\n\nIMPORTANT: You must respond with PURE JSON matching this schema:\n${schemaStr}\n\nDo not include any markdown formatting or text outside the JSON.`;

  const messages: any[] = [
    { role: "system", content: enhancedSystemPrompt }
  ];

  const userContent: any[] = [{ type: "text", text: input }];

  if (media) {
    if (media.mimeType.startsWith('image')) {
      userContent.push({
        type: "image_url",
        image_url: {
          url: `data:${media.mimeType};base64,${media.data}`
        }
      });
    } else {
      // Audio not directly supported in this Llama endpoint usually, append note
      userContent[0].text += "\n\n[Note: Audio input was provided but not supported in fallback mode. Please rely on text description.]";
    }
  }

  messages.push({ role: "user", content: userContent });

  // Check if running on Native Android/iOS
  if (Capacitor.isNativePlatform()) {
    // Use Native HTTP to bypass CORS
    const response = await CapacitorHttp.post({
      url: `https://integrate.api.nvidia.com/v1/chat/completions`,
      headers: {
        "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      data: {
        model: NVIDIA_MODEL,
        messages: messages,
        temperature: 0.2,
        max_tokens: 4096,
        stream: false
      }
    });

    if (response.status !== 200) {
      throw new Error(`Nvidia API Error (${response.status}): ${JSON.stringify(response.data)}`);
    }

    // CapacitorHttp returns data already parsed as JSON usually, but let's be safe
    const data = response.data;
    const content = data.choices[0]?.message?.content;
    if (!content) throw new Error("No content from Nvidia API (Native)");

    try {
      const cleanJson = content.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanJson) as MechanicResponse;
    } catch (e) {
      console.error("Failed to parse Nvidia JSON response", content);
      throw new Error("Failed to parse AI response (Fallback Mode).");
    }

  } else {
    // Web Mode (Use Proxy)
    const response = await fetch(`${NVIDIA_BASE_URL}/chat/completions`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${NVIDIA_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: NVIDIA_MODEL,
        messages: messages,
        temperature: 0.2,
        max_tokens: 4096,
        stream: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Nvidia API Error (${response.status}): ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) throw new Error("No content from Nvidia API");

    // Clean and parse
    try {
      const cleanJson = content.replace(/```json|```/g, "").trim();
      return JSON.parse(cleanJson) as MechanicResponse;
    } catch (e) {
      console.error("Failed to parse Nvidia JSON response", content);
      throw new Error("Failed to parse AI response (Fallback Mode).");
    }
  }
}

export const getMechanicAdvice = async (input: string, media?: MediaInput | null, customApiKey?: string): Promise<MechanicResponse> => {
  // Use custom key if provided, otherwise fallback to env
  const apiKey = customApiKey || process.env.API_KEY;

  // FALLBACK LOGIC
  if (!apiKey) {
    console.warn("Gemini API Key missing. Attempting Nvidia Fallback...");
    return getNvidiaAdvice(input, media || null, SYSTEM_INSTRUCTION);
  }

  const ai = new GoogleGenAI({ apiKey });

  try {
    const parts: any[] = [{ text: input }];

    if (media) {
      // Strip generic base64 headers if present to get clean data
      const cleanData = media.data.replace(/^data:(image|audio)\/[a-z0-9.-]+;base64,/, "");

      parts.push({
        inlineData: {
          mimeType: media.mimeType,
          data: cleanData
        }
      });
    }

    const response = await ai.models.generateContent({
      model: "gemini-3-flash-preview",
      contents: { parts: parts },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: mechanicResponseSchema,
        temperature: 0.2,
        thinkingConfig: { thinkingBudget: 0 }
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response from AI");
    }

    return JSON.parse(text) as MechanicResponse;

  } catch (error) {
    console.error("Error fetching mechanic advice:", error);
    throw error;
  }
};
