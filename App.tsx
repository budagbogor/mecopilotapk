import React, { useState, useRef, useEffect } from 'react';
import { getMechanicAdvice, MediaInput } from './services/geminiService';
import { decodeVin, VinData } from './services/vinService';
import { MechanicResponse, Message } from './types';
import JobCard from './components/JobCard';

// Extend Window interface for Web Speech API
declare global {
  interface Window {
    webkitSpeechRecognition: any;
  }
}

const DEMO_PROMPT = "Mitsubishi Pajero Sport 2021, rem bunyi berdecit dan pedal agak dalam.";

const App: React.FC = () => {
  const [input, setInput] = useState(DEMO_PROMPT);
  const [messages, setMessages] = useState<Message[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadingText, setLoadingText] = useState("Menganalisa...");
  const [currentJob, setCurrentJob] = useState<MechanicResponse | null>(null);
  
  // Settings & API Key State
  const [showSettings, setShowSettings] = useState(false);
  const [userApiKey, setUserApiKey] = useState('');
  
  // VIN Decoder State
  const [vinInput, setVinInput] = useState('');
  const [isDecoding, setIsDecoding] = useState(false);
  const [decodedVehicle, setDecodedVehicle] = useState<VinData | null>(null);

  // Media State (Image/Audio)
  const [selectedMedia, setSelectedMedia] = useState<MediaInput | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isListening, setIsListening] = useState(false); // For Voice Typing
  
  const fileInputRef = useRef<HTMLInputElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const recognitionRef = useRef<any>(null); // Speech Recognition
  
  // Auto-scroll
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollToBottom = () => messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  useEffect(() => scrollToBottom(), [messages]);

  // Load API Key from local storage on mount
  useEffect(() => {
    const storedKey = localStorage.getItem('mechanic_app_fuel');
    if (storedKey) {
      setUserApiKey(storedKey);
    }
  }, []);

  // Save Settings Handler
  const saveSettings = () => {
    if (userApiKey.trim()) {
      localStorage.setItem('mechanic_app_fuel', userApiKey.trim());
    } else {
      localStorage.removeItem('mechanic_app_fuel');
    }
    setShowSettings(false);
    alert("Konfigurasi API AI berhasil disimpan.");
  };

  // Dynamic Loading Text Effect
  useEffect(() => {
    let interval: any;
    if (isLoading) {
      const texts = [
        "Membaca Sensor Input...",
        "Menganalisa Gejala...",
        "Mencari Kode DTC Database...",
        "Mencocokkan Kasus Serupa (Global)...",
        "Mengambil Data Spesifikasi...",
        "Menyusun Laporan..."
      ];
      let i = 0;
      setLoadingText(texts[0]);
      interval = setInterval(() => {
        i = (i + 1) % texts.length;
        setLoadingText(texts[i]);
      }, 1500);
    }
    return () => clearInterval(interval);
  }, [isLoading]);

  // Initialize Speech Recognition
  useEffect(() => {
    if ('webkitSpeechRecognition' in window) {
      const recognition = new window.webkitSpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'id-ID'; // Bahasa Indonesia

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        setInput(prev => {
          const separator = prev && prev !== DEMO_PROMPT ? " " : "";
          return (prev === DEMO_PROMPT ? "" : prev) + separator + transcript;
        });
        setIsListening(false);
      };

      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      
      recognitionRef.current = recognition;
    }
  }, []);

  const handleVinDecode = async () => {
    if (!vinInput.trim()) return;
    setIsDecoding(true);
    setDecodedVehicle(null);
    try {
      const data: VinData | null = await decodeVin(vinInput);
      if (data) {
        setDecodedVehicle(data);
        const vehicleString = `Kendaraan: ${data.year} ${data.make} ${data.model} ${data.engine ? `(${data.engine})` : ''}`;
        setInput(prev => {
          if (prev.includes(data.model)) return prev;
          if (prev === DEMO_PROMPT) return `${vehicleString}, `;
          return `${vehicleString}\n${prev}`;
        });
      } else {
        alert("VIN tidak ditemukan.");
      }
    } catch (e) { console.error(e); } finally { setIsDecoding(false); }
  };

  // --- CLEAR HISTORY ---
  const handleClearHistory = () => {
    if (window.confirm("Hapus semua riwayat percakapan dan kembali ke awal?")) {
      setMessages([]);
      setInput(DEMO_PROMPT);
      setCurrentJob(null);
      setDecodedVehicle(null);
      setVinInput('');
      setSelectedMedia(null);
    }
  };

  // --- IMAGE HANDLING ---
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setSelectedMedia({
          data: reader.result as string,
          mimeType: file.type // e.g. 'image/jpeg'
        });
      };
      reader.readAsDataURL(file);
    }
  };

  // --- AUDIO RECORDING (DIAGNOSIS) ---
  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      mediaRecorderRef.current = recorder;
      audioChunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) audioChunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' }); // Chrome records as webm/opus
        const reader = new FileReader();
        reader.onloadend = () => {
          setSelectedMedia({
            data: reader.result as string,
            mimeType: 'audio/webm' // Gemini supports this
          });
        };
        reader.readAsDataURL(audioBlob);
        
        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      recorder.start();
      setIsRecording(true);
    } catch (err) {
      console.error("Error accessing microphone:", err);
      alert("Tidak dapat mengakses mikrofon. Pastikan izin diberikan.");
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
    }
  };

  // --- VOICE TYPING ---
  const toggleListening = () => {
    if (!recognitionRef.current) {
      alert("Browser Anda tidak mendukung fitur Voice Input.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
    } else {
      recognitionRef.current.start();
      setIsListening(true);
    }
  };

  // --- SUBMIT ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() && !selectedMedia) return;
    if (isLoading) return;

    const userText = input.trim();
    const mediaType = selectedMedia ? (selectedMedia.mimeType.startsWith('image') ? 'FOTO' : 'AUDIO') : null;
    
    let mediaInstruction = "";
    if (mediaType === 'FOTO') mediaInstruction = "SAYA MENGUNGGAH GAMBAR: Analisis visual komponen/kerusakan.";
    if (mediaType === 'AUDIO') mediaInstruction = "SAYA MENGUNGGAH REKAMAN SUARA MESIN: Analisis jenis bunyi (knocking/hissing/grinding) dan prediksi sumber kerusakan.";

    // Force ALL data categories
    const compositePrompt = `${userText}\n\n[USER REQUEST] Output: FULL STANDARD REPORT (Diagnosa, KASUS SERUPA / GLOBAL DATABASE, Parts, Estimasi Biaya Dealer, DTC, Wiring, TSB, SOP, Torsi, Tools, Video). \n\nPENTING: ${mediaInstruction} Perhatikan konteks kendaraan.`;

    // Reset UI
    setInput('');
    setDecodedVehicle(null);
    setVinInput(''); 
    const tempMedia = selectedMedia;
    setSelectedMedia(null);
    
    // Add User Message
    const userMsg: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: `${userText} ${mediaType ? `[Lampiran ${mediaType}]` : ''}`,
      timestamp: new Date()
    };
    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Pass userApiKey to service
      const result = await getMechanicAdvice(compositePrompt, tempMedia, userApiKey);
      setCurrentJob(result);

      const aiMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: `Analisis ${mediaType || 'Data'} Selesai. Menampilkan Laporan Lengkap.`,
        data: result,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
      console.error(error);
      const errorMessage = error.message.includes("API Key") 
        ? "API Key tidak valid atau belum dikonfigurasi. Silakan atur di menu Pengaturan." 
        : "Maaf, terjadi kesalahan analisis. Periksa koneksi atau API Key Anda.";
        
      const errorMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-screen bg-slate-950 text-slate-200 overflow-hidden selection:bg-blue-500/30 print:h-auto print:overflow-visible print:block">
      
      {/* SETTINGS MODAL */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
           <div className="bg-slate-900 border border-slate-700 w-full max-w-md rounded-2xl shadow-2xl p-6 relative animate-fade-in">
              <button 
                onClick={() => setShowSettings(false)}
                className="absolute top-4 right-4 text-slate-500 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
              
              <div className="flex items-center mb-6">
                <div className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center mr-3 border border-slate-700">
                   <svg className="w-6 h-6 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                </div>
                <h2 className="text-xl font-bold text-white">System Settings</h2>
              </div>

              <div className="space-y-4">
                 <div className="bg-slate-800/50 p-4 rounded-lg border border-slate-800">
                    <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">
                       AI Fuel (API Key)
                    </label>
                    <input 
                       type="password"
                       value={userApiKey}
                       onChange={(e) => setUserApiKey(e.target.value)}
                       placeholder="Masukkan Google Gemini API Key..."
                       className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 focus:outline-none font-mono"
                    />
                    <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                       Key ini akan disimpan secara lokal di browser Anda. Aplikasi akan menggunakan key ini untuk memproses diagnosa. 
                       <br/><a href="https://aistudio.google.com/app/apikey" target="_blank" rel="noreferrer" className="text-blue-400 hover:underline">Dapatkan Gemini API Key di sini.</a>
                    </p>
                 </div>
                 
                 <div className="flex justify-end gap-3 pt-2">
                    <button 
                      onClick={() => setShowSettings(false)}
                      className="px-4 py-2 rounded text-sm font-medium text-slate-400 hover:text-white transition-colors"
                    >
                       Batal
                    </button>
                    <button 
                      onClick={saveSettings}
                      className="px-4 py-2 rounded bg-blue-600 text-white text-sm font-bold hover:bg-blue-500 transition-colors shadow-lg shadow-blue-900/20"
                    >
                       Simpan Konfigurasi
                    </button>
                 </div>
              </div>
           </div>
        </div>
      )}

      {/* Sidebar (Chat) - HIDDEN IN PRINT */}
      <div className={`flex flex-col w-full md:w-[400px] lg:w-[450px] border-r border-slate-800 bg-slate-900 flex-shrink-0 ${currentJob ? 'hidden md:flex' : 'flex'} print:hidden`}>
        
        {/* App Header */}
        <header className="p-4 border-b border-slate-800 flex items-center justify-between bg-slate-900 sticky top-0 z-10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 bg-gradient-to-br from-blue-600 to-indigo-700 rounded-lg flex items-center justify-center shadow-lg shadow-blue-900/20">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
            </div>
            <div>
              <h1 className="font-bold text-white leading-tight">Mechanic Co-Pilot</h1>
              <div className="flex items-center space-x-1">
                <span className="text-[10px] text-blue-400 font-bold bg-blue-900/30 px-1 rounded">SUPER-APP</span>
                <span className="text-[10px] text-emerald-400 font-bold bg-emerald-900/30 px-1 rounded">MULTIMODAL</span>
              </div>
            </div>
          </div>
          
          <div className="flex items-center gap-1">
            {/* Settings Button */}
            <button 
              onClick={() => setShowSettings(true)}
              className="p-2 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
              title="Pengaturan API & Sistem"
            >
               <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
            </button>
            {/* Clear History Button */}
            {messages.length > 0 && (
              <button 
                onClick={handleClearHistory}
                className="p-2 text-slate-500 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors"
                title="Hapus Riwayat & Reset"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </button>
            )}
          </div>
        </header>

        {/* Chat Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-slate-500 opacity-60">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                 <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              <p className="text-sm text-center max-w-[200px]">
                Gunakan Suara, Foto, atau Teks untuk mendiagnosa kendaraan.
              </p>
            </div>
          )}
          
          {messages.map((msg) => (
            <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl p-4 ${
                msg.role === 'user' 
                  ? 'bg-blue-600 text-white rounded-br-none' 
                  : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
              }`}>
                <p className="text-sm leading-relaxed whitespace-pre-wrap">{msg.content}</p>
                <div className={`text-[10px] mt-2 opacity-50 ${msg.role === 'user' ? 'text-blue-100' : 'text-slate-400'}`}>
                  {msg.timestamp.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                </div>
              </div>
            </div>
          ))}
          {isLoading && (
             <div className="flex justify-start">
               <div className="bg-slate-800 border border-slate-700 rounded-2xl rounded-bl-none p-4 flex flex-col space-y-2">
                 <div className="flex items-center space-x-2">
                   <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '0ms'}}></div>
                   <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '150ms'}}></div>
                   <div className="w-2 h-2 bg-blue-500 rounded-full animate-bounce" style={{animationDelay: '300ms'}}></div>
                 </div>
                 <span className="text-xs text-slate-400 animate-pulse font-mono">{loadingText}</span>
               </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Area */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/90 backdrop-blur-sm">
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            
            {/* VIN Decoder */}
            <div className={`flex gap-2 p-1.5 rounded-xl border transition-all duration-300 ${
              decodedVehicle 
                ? 'bg-emerald-950/20 border-emerald-500/50 shadow-[0_0_15px_rgba(16,185,129,0.1)]' 
                : 'bg-slate-800/50 border-slate-800'
            }`}>
               <div className="relative flex-1">
                 <input 
                    type="text"
                    value={vinInput}
                    onChange={(e) => setVinInput(e.target.value)}
                    placeholder="Masukkan Nomor Rangka (VIN)..."
                    className="w-full bg-transparent text-white placeholder-slate-500 rounded-lg border-none focus:ring-0 py-1.5 pl-3 pr-3 text-xs font-mono uppercase"
                    maxLength={17}
                 />
               </div>
               <button 
                  type="button"
                  onClick={handleVinDecode}
                  disabled={isDecoding || vinInput.length < 5}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors flex items-center disabled:opacity-50 disabled:cursor-not-allowed ${
                    decodedVehicle 
                      ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                      : 'bg-slate-700 hover:bg-emerald-600 text-white'
                  }`}
               >
                  {isDecoding ? <span className="animate-spin mr-1">↻</span> : null}
                  {decodedVehicle ? 'Decoded' : 'Auto-Fill'}
               </button>
            </div>

            {/* ACTIVE CONTEXT BADGES (Moved out of input) */}
            {(decodedVehicle || selectedMedia) && (
              <div className="flex gap-2 flex-wrap">
                {decodedVehicle && (
                  <div className="flex items-center bg-emerald-900/40 border border-emerald-500/30 text-emerald-300 text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm">
                      <svg className="w-3.5 h-3.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                      {decodedVehicle.year} {decodedVehicle.model}
                      <button onClick={() => setDecodedVehicle(null)} type="button" className="ml-2 hover:text-emerald-100 border-l border-emerald-700/50 pl-2 transition-colors">✕</button>
                  </div>
                )}

                {selectedMedia && (
                  <div className={`flex items-center border text-xs font-bold px-3 py-1.5 rounded-lg shadow-sm ${
                    selectedMedia.mimeType.startsWith('image') 
                    ? 'bg-blue-900/40 border-blue-500/30 text-blue-300' 
                    : 'bg-rose-900/40 border-rose-500/30 text-rose-300'
                  }`}>
                      {selectedMedia.mimeType.startsWith('image') ? (
                         <svg className="w-3.5 h-3.5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      ) : (
                         <svg className="w-3.5 h-3.5 mr-2 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                      )}
                      {selectedMedia.mimeType.startsWith('image') ? 'Foto Terlampir' : 'Audio Terlampir'}
                      <button onClick={() => setSelectedMedia(null)} type="button" className="ml-2 hover:text-white border-l border-white/20 pl-2 transition-colors">✕</button>
                  </div>
                )}
              </div>
            )}

            {/* Main Input Textarea */}
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={isListening ? "Mendengarkan..." : "Deskripsikan keluhan kendaraan, suara mesin, atau kode error..."}
              className={`w-full bg-slate-950 text-white placeholder-slate-500 rounded-xl border transition-all p-4 text-sm resize-none h-32 focus:shadow-lg focus:shadow-blue-900/10 custom-scrollbar ${isListening ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-700 focus:border-blue-500 focus:ring-1 focus:ring-blue-500'}`}
              onKeyDown={(e) => {
                if(e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />

            {/* TOOLBAR (Buttons relocated here) */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-900/50 p-2 rounded-xl border border-slate-800">
                
                {/* Left: Input Tools */}
                <div className="flex gap-2 w-full md:w-auto">
                     {/* Voice */}
                     <button
                       type="button"
                       onClick={toggleListening}
                       className={`flex-1 md:flex-none flex items-center justify-center p-2.5 rounded-lg border transition-all ${isListening ? 'bg-emerald-600 border-emerald-500 text-white animate-pulse' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50'}`}
                       title="Dikte Suara"
                     >
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                       </svg>
                     </button>

                     {/* Audio Record */}
                     <button
                       type="button"
                       onMouseDown={startRecording}
                       onMouseUp={stopRecording}
                       onTouchStart={startRecording}
                       onTouchEnd={stopRecording}
                       className={`flex-1 md:flex-none flex items-center justify-center p-2.5 rounded-lg border transition-all ${isRecording ? 'bg-rose-600 border-rose-500 text-white shadow-lg shadow-rose-900/50 scale-105' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50'}`}
                       title="Tahan untuk Rekam Mesin"
                     >
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
                       </svg>
                     </button>

                     {/* Image Upload */}
                     <input type="file" accept="image/*" ref={fileInputRef} onChange={handleImageUpload} className="hidden" />
                     <button
                       type="button"
                       onClick={() => fileInputRef.current?.click()}
                       className={`flex-1 md:flex-none flex items-center justify-center p-2.5 rounded-lg border transition-all ${selectedMedia?.mimeType.startsWith('image') ? 'bg-blue-900/30 border-blue-500 text-blue-400' : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-blue-400 hover:border-blue-500/50'}`}
                       title="Upload Foto"
                     >
                       <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                         <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                       </svg>
                     </button>
                </div>

                {/* Info Text */}
                <div className="text-[10px] text-slate-500 font-medium hidden md:block">
                   {isRecording ? <span className="text-rose-500 font-bold animate-pulse">● SEDANG MEREKAM SUARA MESIN...</span> : "Ready: Full Standard Report"}
                </div>

                {/* Submit Button */}
                <button
                  type="submit"
                  disabled={isLoading || (!input.trim() && !selectedMedia)}
                  className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white px-6 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-900/30 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>Analisa Lengkap</span>
                  <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                     <path d="M10.894 2.553a1 1 0 00-1.788 0l-7 14a1 1 0 001.169 1.409l5-1.429A1 1 0 009 15.571V11a1 1 0 112 0v4.571a1 1 0 00.725.962l5 1.428a1 1 0 001.17-1.408l-7-14z" />
                  </svg>
                </button>
            </div>
          </form>
        </div>
      </div>

      {/* Main Content */}
      <main className={`flex-1 flex flex-col h-full bg-slate-950 overflow-hidden relative ${!currentJob ? 'hidden md:flex' : 'flex'} print:h-auto print:overflow-visible print:block`}>
        <div className="absolute inset-0 z-0 opacity-10 pointer-events-none print:hidden" style={{backgroundImage: `radial-gradient(circle at 1px 1px, #3b82f6 1px, transparent 0)`, backgroundSize: '40px 40px'}}></div>

        <div className="md:hidden p-4 border-b border-slate-800 flex items-center bg-slate-900 z-10 print:hidden">
           <button onClick={() => setCurrentJob(null)} className="text-slate-400 flex items-center">
             <svg className="h-5 w-5 mr-1" viewBox="0 0 20 20" fill="currentColor"><path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
             Back to Chat
           </button>
        </div>

        {currentJob ? (
          <div className="flex-1 overflow-y-auto p-4 md:p-6 z-10 custom-scrollbar print:overflow-visible print:h-auto print:p-0">
            <div className="w-full">
              <JobCard data={currentJob} />
            </div>
          </div>
        ) : (
          <div className="flex-1 flex flex-col items-center justify-center z-10 text-slate-600 p-8 text-center print:hidden">
            <div className="w-24 h-24 rounded-full bg-slate-900 border border-slate-800 flex items-center justify-center mb-6 shadow-2xl">
               <svg className="h-10 w-10 text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>
            </div>
            <h2 className="text-2xl md:text-3xl font-bold text-slate-500 mb-2">Mechanic Co-Pilot</h2>
            <p className="max-w-md mx-auto mb-6">Asisten Multimodal untuk Mekanik Profesional.</p>
            
            <div className="grid grid-cols-2 gap-4 max-w-sm">
                <div className="flex flex-col items-center p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                    <svg className="w-6 h-6 text-blue-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" /></svg>
                    <span className="text-xs text-slate-400 font-bold uppercase">Visual Diagnosis</span>
                </div>
                <div className="flex flex-col items-center p-3 bg-slate-900/50 rounded-lg border border-slate-800">
                    <svg className="w-6 h-6 text-rose-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" /></svg>
                    <span className="text-xs text-slate-400 font-bold uppercase">Audio Analysis</span>
                </div>
            </div>
          </div>
        )}
      </main>

    </div>
  );
};

export default App;