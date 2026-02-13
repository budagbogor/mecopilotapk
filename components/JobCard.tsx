import React, { useState, useEffect } from 'react';
import { MechanicResponse } from '../types';

interface JobCardProps {
  data: MechanicResponse;
}

const JobCard: React.FC<JobCardProps> = ({ data }) => {
  const [imgError, setImgError] = useState(false);
  const [expandedDtcIndices, setExpandedDtcIndices] = useState<Set<number>>(new Set());
  const [expandedCaseIndices, setExpandedCaseIndices] = useState<Set<number>>(new Set([0])); // Open first case by default
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [showEstimate, setShowEstimate] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);

  // Load voices on mount
  useEffect(() => {
    if ('speechSynthesis' in window) {
      const loadVoices = () => {
        const availableVoices = window.speechSynthesis.getVoices();
        setVoices(availableVoices);
      };
      
      loadVoices();
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
  }, []);

  // Helper to clean vehicle info for search queries
  const getSearchableVehicle = () => {
    if (!data.vehicle_info) return "";
    return data.vehicle_info.split(' ').slice(0, 3).join(' ');
  };

  const cleanVehicleName = getSearchableVehicle();

  // Stable seed for consistent image
  const stringToSeed = (str: string) => {
    let hash = 0;
    if (str.length === 0) return hash;
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return Math.abs(hash);
  };

  const seed = stringToSeed(cleanVehicleName);
  const vehicleImageUrl = `https://image.pollinations.ai/prompt/realistic%20automotive%20photography%20of%20${encodeURIComponent(cleanVehicleName)}%20car%20studio%20lighting%20side%20profile%20on%20dark%20background?width=320&height=180&nologo=true&seed=${seed}`;

  const toggleDtc = (index: number) => {
    const newSet = new Set(expandedDtcIndices);
    if (newSet.has(index)) { newSet.delete(index); } else { newSet.add(index); }
    setExpandedDtcIndices(newSet);
  };

  const toggleCase = (index: number) => {
    const newSet = new Set(expandedCaseIndices);
    if (newSet.has(index)) { newSet.delete(index); } else { newSet.add(index); }
    setExpandedCaseIndices(newSet);
  };

  // --- PRINT FUNCTION ---
  const handlePrint = () => {
    // Open all accordions before printing so content is visible
    const allDtc = new Set(data.dtc_list?.map((_, i) => i) || []);
    const allCases = new Set(data.similar_cases?.map((_, i) => i) || []);
    setExpandedDtcIndices(allDtc);
    setExpandedCaseIndices(allCases);
    setShowEstimate(true);

    // Give React a moment to render the expanded state, then print
    setTimeout(() => {
      window.print();
    }, 300);
  };

  // --- NATURAL TEXT TO SPEECH (Voice Selection Logic) ---
  const handleSpeak = () => {
    if ('speechSynthesis' in window) {
      if (isSpeaking) {
        window.speechSynthesis.cancel();
        setIsSpeaking(false);
        return;
      }

      // Construct a conversational narrative script
      const greeting = `Halo, ini ringkasan diagnosa untuk kendaraan ${data.vehicle_info}.`;
      const problemIntro = `Berdasarkan analisa, indikasi masalah utama terletak pada komponen ${data.component_name}.`;
      const diagnosisDetail = data.diagnosis.length > 0 
        ? `Diagnosa teknis menunjukkan adanya: ${data.diagnosis[0]}.` 
        : `Diagnosa awal perlu pemeriksaan fisik lebih lanjut.`;
      const solutionOverview = `Untuk mengatasinya, ${data.manual_summary}`;
      const dtcMention = data.dtc_list && data.dtc_list.length > 0
        ? `Perhatikan juga bahwa terdeteksi kode error ${data.dtc_list[0].code}, yang berarti ${data.dtc_list[0].definition}.`
        : "";
      const costMention = data.cost_estimation
        ? `Sebagai gambaran, estimasi total biaya perbaikan di bengkel resmi berkisar di angka ${data.cost_estimation.total_estimate}.`
        : "Estimasi biaya belum tersedia secara spesifik.";
      const closing = "Selamat bekerja, dan utamakan keselamatan.";

      const textToRead = `${greeting} ${problemIntro} ${diagnosisDetail} ${solutionOverview}. ${dtcMention} ${costMention} ${closing}`;

      const utterance = new SpeechSynthesisUtterance(textToRead);
      utterance.lang = 'id-ID';
      
      // --- VOICE SELECTION STRATEGY (MALE PREFERRED) ---
      const idVoices = voices.filter(v => v.lang.includes('id-ID') || v.lang.includes('id_ID'));
      
      // Prioritize explicit MALE voices (e.g. "Microsoft Ardi")
      let selectedVoice = idVoices.find(v => 
        v.name.includes('Ardi') || 
        v.name.toLowerCase().includes('male') || 
        v.name.toLowerCase().includes('pria')
      );

      // Fallback to any ID voice if specific male not found
      if (!selectedVoice && idVoices.length > 0) {
        selectedVoice = idVoices[0];
      }

      if (selectedVoice) {
        utterance.voice = selectedVoice;
        utterance.pitch = 1.0;
        utterance.rate = 1.0;
      }

      utterance.onend = () => setIsSpeaking(false);
      utterance.onerror = () => setIsSpeaking(false);

      window.speechSynthesis.speak(utterance);
      setIsSpeaking(true);
    } else {
      alert("Browser tidak mendukung Text-to-Speech.");
    }
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg shadow-2xl overflow-hidden font-sans text-sm md:text-base animate-fade-in pb-10 print:bg-white print:text-black print:border-none print:shadow-none print:pb-0 print:overflow-visible">
      
      {/* Header / Vehicle Info */}
      <div className="relative bg-blue-950/40 border-b border-blue-800/50 p-4 overflow-hidden print:bg-white print:border-b-2 print:border-black print:p-0 print:mb-6">
        {/* Background gradient hidden in print */}
        <div className="absolute inset-0 bg-gradient-to-r from-slate-900 via-slate-900/90 to-blue-900/20 z-0 print:hidden"></div>
        
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:flex-row print:items-end">
          <div className="flex items-center gap-4 print:w-full">
             {/* Vehicle Thumbnail */}
             <div className="flex-shrink-0 w-20 h-14 md:w-28 md:h-16 bg-slate-800 rounded-md border border-slate-600 overflow-hidden shadow-lg relative group print:border print:border-gray-300 print:bg-white">
                {!imgError ? (
                  <img 
                    src={vehicleImageUrl} 
                    alt={cleanVehicleName}
                    className="w-full h-full object-cover transform group-hover:scale-110 transition-transform duration-700 print:scale-100"
                    onError={() => setImgError(true)}
                    loading="lazy"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center bg-slate-800 text-slate-500 print:bg-gray-100">
                    <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M19 19H5V5h14v14z" /></svg>
                  </div>
                )}
             </div>

             <div className="flex-grow">
                <div className="hidden print:block text-xs font-bold text-gray-500 mb-1">MECHANIC CO-PILOT REPORT</div>
                <h2 className="text-blue-300 text-[10px] font-bold uppercase tracking-widest mb-0.5 print:text-gray-600 print:text-xs">Vehicle Identification</h2>
                <h1 className="text-lg md:text-2xl font-bold text-white tracking-tight leading-none print:text-black print:text-3xl">{data.vehicle_info}</h1>
                <div className="md:hidden mt-1 inline-block bg-slate-800 border border-slate-700 rounded px-1.5 py-0.5 text-[10px] text-slate-300 font-mono print:hidden">
                  {data.component_id}
                </div>
                <div className="hidden print:block text-sm mt-1 text-gray-600">
                   Date: {new Date().toLocaleDateString('id-ID', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                </div>
             </div>
          </div>

          <div className="hidden md:block text-right print:block">
             <div className="text-slate-400 text-[10px] uppercase tracking-wider font-semibold print:text-gray-500">Component ID</div>
             <div className="text-cyan-400 font-mono font-bold text-lg tracking-wide drop-shadow-sm print:text-black print:text-xl">{data.component_id}</div>
          </div>
        </div>
      </div>

      {/* Mobile Banner (Hidden in Print) */}
      <div className="md:hidden bg-slate-800/50 p-3 border-b border-slate-700 flex justify-between items-center backdrop-blur-sm print:hidden">
         <span className="text-slate-400 text-xs font-medium">Active Job</span>
         <span className="text-white font-bold text-sm truncate ml-2">{data.component_name}</span>
      </div>

      <div className="p-4 md:p-6 space-y-8 print:p-0 print:space-y-6">
        
        {/* Component Name & Summary + Actions */}
        <section className="relative break-inside-avoid">
          <div className="flex items-center justify-between mb-2">
             <div className="flex items-center space-x-2">
                <h2 className="text-2xl font-bold text-white print:text-black print:text-xl print:uppercase print:border-b print:border-black print:pb-1 print:w-full">
                  DIAGNOSTIC REPORT: {data.component_name}
                </h2>
             </div>
             
             {/* Toolbar Buttons (Hidden in Print) */}
             <div className="flex gap-2 print:hidden">
                {/* Print Button */}
                <button 
                  onClick={handlePrint}
                  className="flex items-center px-3 py-1.5 rounded-full text-xs font-bold bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white transition-all border border-slate-700"
                  title="Cetak Laporan PDF"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
                  </svg>
                  Print PDF
                </button>

                {/* TTS Button */}
                <button 
                  onClick={handleSpeak}
                  className={`flex items-center px-3 py-1.5 rounded-full text-xs font-bold transition-all ${isSpeaking ? 'bg-emerald-600 text-white animate-pulse' : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-emerald-400 border border-slate-700'}`}
                >
                  {isSpeaking ? (
                    <>
                      <span className="mr-2">Stop Bicara</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z" /></svg>
                    </>
                  ) : (
                    <>
                      <span className="mr-2">Baca Hasil</span>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" /></svg>
                    </>
                  )}
                </button>
             </div>
          </div>
          {/* Summary */}
          <p className="text-slate-300 italic border-l-2 border-blue-500 pl-4 py-1 leading-relaxed print:text-black print:not-italic print:border-l-4 print:border-black print:pl-4 print:text-justify">
            <span className="font-bold print:block mb-1 hidden text-black">SUMMARY:</span>
            "{data.manual_summary}"
          </p>
        </section>

        {/* Diagnosis & Safety Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-8 break-inside-avoid">
           <section className="print:border print:border-gray-300 print:p-4 print:rounded-lg">
              <h3 className="flex items-center text-amber-400 font-bold mb-2 uppercase tracking-wide text-xs print:text-black print:text-sm print:border-b print:border-gray-200 print:pb-2">
                Diagnosis Points
              </h3>
              <ul className="list-disc list-inside space-y-1 text-slate-200 ml-1 text-sm print:text-black">
                {data.diagnosis.map((diag, idx) => (
                  <li key={idx}>{diag}</li>
                ))}
              </ul>
           </section>
           
           {data.safety_warning.length > 0 && (
             <section className="bg-red-950/20 border border-red-900/50 p-3 rounded print:bg-white print:border print:border-gray-300 print:p-4">
                <h3 className="text-red-500 font-bold uppercase text-xs mb-2 print:text-black print:text-sm print:border-b print:border-gray-200 print:pb-2">
                   Safety Procedures
                </h3>
                <ul className="space-y-1 text-red-200/90 text-sm print:text-black">
                  {data.safety_warning.map((warn, idx) => (
                    <li key={idx} className="flex items-start">
                       <span className="mr-2 text-red-500 print:text-black">•</span> {warn}
                    </li>
                  ))}
                </ul>
             </section>
           )}
        </div>

        {/* --- GLOBAL SIMILAR CASES --- */}
        {data.similar_cases && data.similar_cases.length > 0 && (
          <section className="relative break-inside-avoid">
             <div className="flex items-center gap-2 mb-3 print:mb-2 print:mt-4">
               <div className="w-8 h-8 rounded-lg bg-teal-900/40 border border-teal-500/50 flex items-center justify-center print:hidden">
                  <svg className="w-5 h-5 text-teal-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" /></svg>
               </div>
               <div>
                  <h3 className="text-teal-400 font-bold uppercase tracking-wide text-xs print:text-black print:text-base print:border-b-2 print:border-black print:w-full">
                    Global Similar Cases & Fixes
                  </h3>
                  <div className="text-[10px] text-slate-400 print:hidden">Database Repair Manual & Forum Global</div>
               </div>
             </div>

             <div className="space-y-4 print:space-y-6">
                {data.similar_cases.map((kasus, idx) => (
                   <div key={idx} className={`bg-slate-800/60 border ${expandedCaseIndices.has(idx) ? 'border-teal-500/60 shadow-[0_0_15px_rgba(20,184,166,0.1)]' : 'border-slate-700'} rounded-lg overflow-hidden transition-all duration-300 print:bg-white print:border print:border-gray-300 print:shadow-none break-inside-avoid`}>
                      {/* Case Header */}
                      <button onClick={() => toggleCase(idx)} className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 text-left hover:bg-slate-700/30 transition-colors print:p-2 print:bg-gray-100 print:border-b print:border-gray-200">
                         <div className="flex-1 mb-2 md:mb-0">
                           <div className="flex items-center gap-2 mb-1">
                             <span className="bg-teal-900/40 text-teal-300 text-[10px] font-bold px-2 py-0.5 rounded border border-teal-800 uppercase tracking-wider print:bg-gray-200 print:text-black print:border-gray-400">
                                {kasus.relevance_score}
                             </span>
                             {kasus.related_dtc && kasus.related_dtc.length > 0 && (
                               <div className="flex gap-1">
                                 {kasus.related_dtc.map((d, i) => (
                                   <span key={i} className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded border border-slate-700 print:bg-white print:text-black print:border-gray-400">{d}</span>
                                 ))}
                               </div>
                             )}
                           </div>
                           <h4 className="text-white font-bold text-sm md:text-base print:text-black">{kasus.case_name}</h4>
                         </div>
                         <div className={`transform transition-transform duration-300 ${expandedCaseIndices.has(idx) ? 'rotate-180' : ''} print:hidden`}>
                            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                         </div>
                      </button>

                      {/* Case Details */}
                      {(expandedCaseIndices.has(idx) || true) && ( // Force true for printing logic handled in handlePrint via state, but here we render always if printing could be handled via CSS. For simplicity we rely on state.
                         <div className={`p-4 pt-0 border-t border-slate-700/50 bg-slate-900/30 animate-fade-in print:bg-white print:p-4 print:border-none ${expandedCaseIndices.has(idx) ? 'block' : 'hidden print:block'}`}>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-4 print:grid-cols-2 print:gap-4">
                               {/* Left: Technical Info */}
                               <div className="space-y-4">
                                  <div className="bg-slate-900/80 p-3 rounded border border-slate-800 print:bg-white print:border print:border-gray-200">
                                     <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 print:text-gray-500">Gejala Cocok</div>
                                     <p className="text-slate-200 text-sm italic print:text-black">"{kasus.symptoms_match}"</p>
                                  </div>
                                  
                                  <div>
                                     <div className="text-[10px] text-red-400 uppercase font-bold mb-1 flex items-center print:text-black">
                                       <svg className="w-3 h-3 mr-1 print:hidden" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                       Culprit (Biang Kerok)
                                     </div>
                                     <div className="text-white font-bold text-lg border-l-2 border-red-500 pl-3 py-1 bg-red-900/10 print:bg-gray-100 print:text-black print:border-black">
                                        {kasus.culprit_component}
                                     </div>
                                  </div>

                                  <div>
                                     <div className="text-[10px] text-teal-400 uppercase font-bold mb-2 print:text-black">Langkah Penanganan (FIX)</div>
                                     <ol className="list-decimal list-outside ml-4 space-y-2 text-sm text-slate-200 print:text-black">
                                        {kasus.solution_steps.map((step, sIdx) => (
                                           <li key={sIdx} className="pl-1">{step}</li>
                                        ))}
                                     </ol>
                                  </div>
                               </div>

                               {/* Right: Media & Visualization */}
                               <div className="space-y-4 print:border-l print:border-gray-200 print:pl-4">
                                  
                                  {/* Video Link */}
                                  {kasus.video_ref && (
                                     <div className="print:hidden">
                                       <a 
                                         href={kasus.video_ref.url} 
                                         target="_blank" 
                                         rel="noreferrer"
                                         className="flex items-center justify-center p-3 rounded bg-red-900/20 border border-red-900/50 hover:bg-red-900/40 hover:border-red-500/50 transition-all group"
                                       >
                                          <div className="w-8 h-8 bg-red-600 text-white rounded-full flex items-center justify-center mr-3 shadow-lg group-hover:scale-110 transition-transform">
                                             <svg className="w-4 h-4 ml-0.5" fill="currentColor" viewBox="0 0 20 20"><path d="M6.3 2.841A1.5 1.5 0 004 4.11V15.89a1.5 1.5 0 002.3 1.269l9.344-5.89a1.5 1.5 0 000-2.538L6.3 2.84z" /></svg>
                                          </div>
                                          <div>
                                             <div className="text-[10px] text-red-400 font-bold uppercase">Tonton Video Panduan</div>
                                             <div className="text-white text-xs font-medium truncate max-w-[180px]">{kasus.video_ref.title}</div>
                                          </div>
                                       </a>
                                     </div>
                                  )}
                                  {/* Print only video link text */}
                                  <div className="hidden print:block text-xs text-gray-500">
                                     <span className="font-bold">Video Reference:</span> {kasus.video_ref.url}
                                  </div>
                               </div>
                            </div>
                         </div>
                      )}
                   </div>
                ))}
             </div>
          </section>
        )}

        {/* DTC & Wiring Grid */}
        {(data.dtc_list?.length > 0 || data.wiring_diagram_desc) && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-6 break-inside-avoid">
            {/* DTC Codes */}
            {data.dtc_list?.length > 0 && (
              <section className="print:border print:border-gray-300 print:rounded print:p-2">
                <h3 className="flex items-center text-purple-400 font-bold mb-2 uppercase tracking-wide text-xs print:text-black print:text-sm print:mb-3">
                   OBD-II DTC Codes
                </h3>
                <div className="space-y-2">
                  {data.dtc_list.map((dtc, idx) => (
                    <div key={idx} className="bg-slate-800/80 border border-purple-500/30 rounded overflow-hidden print:bg-white print:border-gray-300 print:mb-2">
                       <button onClick={() => toggleDtc(idx)} className="w-full flex items-center justify-between p-3 text-left hover:bg-slate-700/50 transition-colors print:p-2 print:border-b print:border-gray-200">
                          <div className="flex items-center">
                            <span className="bg-purple-900/50 text-purple-200 font-mono font-bold px-2 py-0.5 rounded text-xs border border-purple-700 mr-2 print:bg-gray-200 print:text-black print:border-gray-400">{dtc.code}</span>
                            <span className="font-bold text-slate-200 text-xs print:text-black">{dtc.definition}</span>
                          </div>
                          <svg className={`w-4 h-4 text-slate-400 transform transition-transform ${expandedDtcIndices.has(idx) ? 'rotate-180' : ''} print:hidden`} fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                       </button>
                       <div className={`p-3 pt-0 border-t border-slate-700/50 bg-slate-900/50 text-xs space-y-2 animate-fade-in print:bg-white print:text-black print:p-2 print:block ${expandedDtcIndices.has(idx) ? 'block' : 'hidden print:block'}`}>
                            <div className="print:mt-1"><span className="text-slate-400 font-bold block print:text-gray-600">Penyebab:</span> <span className="text-slate-200 print:text-black">{dtc.possible_cause}</span></div>
                            <div><span className="text-slate-400 font-bold block print:text-gray-600">Gejala:</span> <span className="text-slate-200 print:text-black">{dtc.symptoms}</span></div>
                            <div className="bg-emerald-900/20 p-2 rounded border border-emerald-900/30 text-emerald-200 mt-1 print:bg-gray-100 print:text-black print:border-gray-300">
                              <span className="font-bold text-emerald-400 print:text-black">Fix:</span> {dtc.fix_suggestion}
                            </div>
                         </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* Wiring Diagram */}
            {data.wiring_diagram_desc && (
               <section className="print:border print:border-gray-300 print:rounded print:p-2">
                 <h3 className="flex items-center text-yellow-400 font-bold mb-2 uppercase tracking-wide text-xs print:text-black print:text-sm">
                    Wiring & Electrical
                 </h3>
                 <div className="bg-slate-800/50 border border-yellow-700/30 rounded p-3 print:bg-white print:border-none print:p-0">
                    <p className="text-slate-200 text-sm mb-3 whitespace-pre-wrap print:text-black">{data.wiring_diagram_desc}</p>
                    {/* RESTORED: Clickable Search Button */}
                    <a 
                      href={`https://www.google.com/search?tbm=isch&q=${encodeURIComponent((data.wiring_search_keywords || data.vehicle_info + " wiring diagram"))}`}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex items-center px-3 py-1.5 bg-yellow-900/30 text-yellow-400 border border-yellow-700/50 rounded text-xs font-bold hover:bg-yellow-900/50 transition-colors print:hidden"
                    >
                      <svg className="w-4 h-4 mr-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                      Cari Diagram Gambar
                    </a>
                 </div>
               </section>
            )}
          </div>
        )}

        {/* SOP Steps */}
        <section className="break-inside-avoid">
          <h3 className="flex items-center text-sky-400 font-bold mb-4 uppercase tracking-wide text-xs print:text-black print:text-sm print:border-b print:border-black print:pb-1">
             Repair Procedure (SOP)
          </h3>
          <div className="relative border-l border-slate-700 ml-3 space-y-6 print:border-l-2 print:border-gray-300 print:space-y-4">
            {data.sop_steps.map((instruction, idx) => {
              const stepNumber = idx + 1;
              return (
                <div key={idx} className="pl-6 relative group break-inside-avoid">
                  <div className="absolute -left-[13px] top-0 w-6 h-6 rounded-full bg-slate-900 border border-slate-600 flex items-center justify-center text-sky-500 font-bold text-xs group-hover:border-sky-500 group-hover:bg-sky-950 transition-colors print:bg-white print:text-black print:border-black">
                    {stepNumber}
                  </div>
                  <div className="pt-0.5">
                     <p className="text-slate-200 text-sm md:text-base leading-relaxed print:text-black">{instruction}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

        {/* TSB & Recalls (RESTORED CLICKABLE LINKS) */}
        {data.tsb_list?.length > 0 && (
          <section className="bg-orange-950/20 border border-orange-900/30 rounded p-4 print:bg-white print:border print:border-gray-300 break-inside-avoid">
            <h3 className="text-orange-500 font-bold uppercase text-xs mb-2 print:text-black print:text-sm">Technical Service Bulletins (TSB)</h3>
            <ul className="space-y-2">
              {data.tsb_list.map((tsb, idx) => (
                <li key={idx} className="text-xs text-orange-200 print:text-black">
                  <div className="flex items-start">
                    {/* RESTORED: Clickable TSB ID */}
                    <a 
                      href={`https://www.google.com/search?q=${encodeURIComponent(tsb.id + " " + data.vehicle_info + " TSB")}`} 
                      target="_blank" 
                      rel="noreferrer"
                      className="font-bold border border-orange-700 px-1 rounded mr-2 bg-orange-900/20 whitespace-nowrap hover:bg-orange-800 hover:text-white transition-colors cursor-pointer print:bg-gray-200 print:border-gray-400 print:text-black print:no-underline"
                      title="Cari detail TSB di Google"
                    >
                      {tsb.id}
                    </a>
                    <span className="print:text-black">{tsb.summary}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Video Tutorials (RESTORED: Clickable Links) */}
        {data.video_tutorials?.length > 0 && (
          <section className="break-inside-avoid">
             <h3 className="flex items-center text-red-500 font-bold mb-4 uppercase tracking-wide text-xs print:text-black print:text-sm print:border-b print:border-gray-300 print:pb-1">
                Video Tutorials
             </h3>
             <div className="grid grid-cols-1 gap-3 print:grid-cols-2">
               {data.video_tutorials.map((video, idx) => (
                 <a 
                    key={idx} 
                    href={video.url}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center bg-slate-800 p-3 rounded hover:bg-slate-700 transition-colors group print:bg-white print:border print:border-gray-200 print:no-underline"
                 >
                    <div className="w-10 h-10 bg-red-900/20 rounded flex items-center justify-center text-red-500 mr-3 print:hidden">
                       <svg className="w-5 h-5 group-hover:scale-110 transition-transform" fill="currentColor" viewBox="0 0 20 20"><path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6zM14.553 7.106A1 1 0 0014 8v4a1 1 0 00.553.894l2 1A1 1 0 0018 13V7a1 1 0 00-1.447-.894l-2 1z" /></svg>
                    </div>
                    <div className="flex flex-col">
                      <span className="text-slate-300 text-sm font-medium group-hover:text-white print:text-black">{video.title}</span>
                      <span className="text-[10px] text-gray-500 truncate max-w-[200px] print:block">{video.url}</span>
                    </div>
                 </a>
               ))}
             </div>
          </section>
        )}

        {/* Maintenance / Spare Parts (MOVED TO BOTTOM) */}
        {data.maintenance_data && data.maintenance_data.length > 0 && (
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 print:bg-white print:border-none print:p-0 break-inside-avoid">
             <h3 className="flex items-center text-pink-400 font-bold mb-4 uppercase tracking-wide text-xs print:text-black print:text-sm print:border-b print:border-black print:pb-1">
                Data Servis & Sparepart (Maintenance)
            </h3>
            <div className="space-y-4 print:grid print:grid-cols-2 print:gap-4 print:space-y-0">
              {data.maintenance_data.map((item, idx) => (
                <div key={idx} className="bg-slate-900/50 border border-slate-700 rounded-lg p-4 hover:border-pink-500/30 transition-colors print:bg-white print:border-gray-300 break-inside-avoid">
                   {/* Top Row: Item & Spec */}
                   <div className="flex justify-between items-start mb-3">
                      <div>
                         <div className="text-white font-bold text-base print:text-black">{item.item}</div>
                         <div className="text-slate-400 text-sm print:text-gray-600">{item.spec}</div>
                      </div>
                      <div className="text-pink-300 font-mono font-bold bg-pink-900/20 px-2 py-1 rounded text-sm whitespace-nowrap print:bg-gray-200 print:text-black">
                         {item.value}
                      </div>
                   </div>
                   
                   <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t border-slate-800 pt-3 print:border-gray-200">
                      {/* OEM Info */}
                      <div>
                         <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 print:text-gray-500">OEM / Original</div>
                         {item.oem_part_number ? (
                            <div className="flex items-center">
                               {/* RESTORED: Clickable OEM Part Number */}
                               <a 
                                 href={`https://www.google.com/search?q=${encodeURIComponent(item.oem_part_number + " " + (item.oem_brand || "genuine part"))}`}
                                 target="_blank"
                                 rel="noreferrer"
                                 className="bg-slate-800 text-slate-200 font-mono text-xs px-2 py-1 rounded border border-slate-600 mr-2 hover:bg-slate-700 hover:text-white hover:border-slate-500 transition-colors print:bg-gray-100 print:text-black print:border-gray-300 print:no-underline"
                                 title="Cari Part ini"
                               >
                                  {item.oem_part_number}
                               </a>
                               <span className="text-xs text-slate-400 print:text-gray-600">{item.oem_brand || "Genuine"}</span>
                            </div>
                         ) : (
                            <span className="text-xs text-slate-500 italic">OEM N/A</span>
                         )}
                      </div>

                      {/* Aftermarket Info */}
                      <div>
                         <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 print:text-gray-500">Aftermarket</div>
                         {item.aftermarket_parts && item.aftermarket_parts.length > 0 ? (
                            <ul className="space-y-1">
                               {item.aftermarket_parts.map((aft, aIdx) => (
                                  <li key={aIdx} className="flex justify-between text-xs items-center">
                                     <span className="text-slate-300 print:text-black">
                                       <span className="font-semibold text-slate-200 print:text-black">{aft.brand}</span>
                                     </span>
                                     <span className="text-emerald-400 font-mono print:text-black">{aft.estimated_price}</span>
                                  </li>
                               ))}
                            </ul>
                         ) : (
                            <span className="text-xs text-slate-500 italic">None</span>
                         )}
                      </div>
                   </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Torque Specs (MOVED TO BOTTOM) */}
        {data.torque_specs && data.torque_specs.length > 0 && (
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 print:bg-white print:border-none print:p-0 break-inside-avoid">
             <h3 className="flex items-center text-emerald-400 font-bold mb-4 uppercase tracking-wide text-xs print:text-black print:text-sm print:border-b print:border-black print:pb-1">
                Torque Specifications
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse print:border print:border-gray-300">
                <thead>
                  <tr className="text-slate-400 border-b border-slate-600 text-xs uppercase print:text-black print:bg-gray-100 print:border-gray-300">
                    <th className="py-2 px-2 font-medium w-1/2 print:p-2">Part</th>
                    <th className="py-2 px-2 font-medium w-1/4 print:p-2">Size</th>
                    <th className="py-2 px-2 font-medium text-right w-1/4 print:p-2">Value</th>
                  </tr>
                </thead>
                <tbody className="text-sm">
                  {data.torque_specs.map((spec, idx) => (
                    <tr key={idx} className="border-b border-slate-700/50 hover:bg-slate-700/30 group print:border-gray-300">
                      <td className="py-3 px-2 text-slate-200 font-medium align-middle print:text-black print:p-2">
                        <div className="flex items-center justify-between">
                          <a 
                             href={`https://www.google.com/search?q=${encodeURIComponent(data.vehicle_info + " " + spec.part + " torque spec")}`}
                             target="_blank"
                             rel="noreferrer"
                             className="hover:text-emerald-400 hover:underline decoration-emerald-500/50 underline-offset-4 transition-all cursor-pointer print:no-underline print:text-black block w-full"
                             title="Cari detail spesifikasi torsi di Google"
                          >
                            {spec.part}
                          </a>
                        </div>
                      </td>
                      <td className="py-3 px-2 text-slate-400 text-xs font-mono align-middle print:text-black print:p-2">
                        {spec.size || "-"}
                      </td>
                      <td className="py-3 px-2 text-emerald-300 font-mono text-right align-middle print:text-black print:font-bold print:p-2">{spec.value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* Tools List (MOVED TO BOTTOM) */}
        {data.tools_list && data.tools_list.length > 0 && (
          <section className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 print:bg-white print:border-none print:p-0 break-inside-avoid">
            <h3 className="flex items-center text-indigo-400 font-bold mb-4 uppercase tracking-wide text-xs print:text-black print:text-sm print:border-b print:border-black print:pb-1">
              Required Tools
            </h3>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3 print:grid-cols-3">
              {data.tools_list.map((tool, idx) => (
                <li key={idx} className="flex items-center justify-between text-slate-300 text-sm bg-slate-900/50 px-3 py-2 rounded border border-slate-800 group hover:border-indigo-500/50 transition-colors print:bg-white print:text-black print:border-gray-300">
                  <div className="flex items-center overflow-hidden flex-1">
                     <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full mr-2 flex-shrink-0 print:bg-black"></span>
                     <span className="truncate text-slate-200 print:text-black">{tool}</span>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        )}

        {/* Commercial Estimates (MOVED TO BOTTOM) */}
        {(data.estimated_work_time || data.cost_estimation) && (
          <section className="bg-slate-800/50 rounded-lg border border-slate-700 overflow-hidden print:bg-white print:border print:border-gray-300 break-inside-avoid">
             {/* Toggle hidden in print, always show content */}
             <div className="hidden print:block p-4 border-b border-gray-200 font-bold text-black uppercase text-sm">
               Estimasi Biaya & Waktu (Dealer Standard)
             </div>

             {!showEstimate ? (
                <button 
                  onClick={() => setShowEstimate(true)}
                  className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-slate-900 to-slate-800 hover:to-slate-700 transition-all group print:hidden"
                >
                    <div className="flex items-center text-green-400 font-bold uppercase tracking-wide text-xs">
                        <div className="w-8 h-8 rounded-full bg-green-900/30 flex items-center justify-center mr-3 border border-green-500/30 group-hover:border-green-400 transition-colors">
                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        </div>
                        Buka Estimasi Biaya & Waktu
                    </div>
                    <svg className="w-5 h-5 text-slate-500 group-hover:text-white transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                </button>
             ) : (
               <div className="p-4 animate-fade-in print:p-4">
                 <button 
                   onClick={() => setShowEstimate(false)}
                   className="w-full flex items-center justify-between mb-4 text-green-400 font-bold uppercase tracking-wide text-xs hover:text-green-300 transition-colors print:hidden"
                 >
                    <span className="flex items-center">
                        <svg className="w-4 h-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                        Estimasi Biaya & Waktu (Dealer Standard)
                    </span>
                    <svg className="w-5 h-5 text-slate-500 hover:text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                 </button>
                 
                 <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    {/* Time */}
                    <div className="bg-slate-900 p-3 rounded border border-slate-800 print:bg-white print:border-gray-300">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 print:text-gray-500">Flat Rate</div>
                        <div className="text-white font-mono font-bold print:text-black">{data.estimated_work_time || "-"}</div>
                    </div>
                    {/* Hourly Rate */}
                    <div className="bg-slate-900 p-3 rounded border border-slate-800 print:bg-white print:border-gray-300">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 print:text-gray-500">Labor Rate</div>
                        <div className="text-white font-mono font-bold text-sm print:text-black">{data.cost_estimation?.hourly_rate || "-"}</div>
                    </div>
                    {/* Parts */}
                    <div className="bg-slate-900 p-3 rounded border border-slate-800 print:bg-white print:border-gray-300">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 print:text-gray-500">Parts Cost</div>
                        <div className="text-white font-mono font-bold text-sm print:text-black">{data.cost_estimation?.parts_total || "-"}</div>
                    </div>
                    {/* Labor */}
                    <div className="bg-slate-900 p-3 rounded border border-slate-800 print:bg-white print:border-gray-300">
                        <div className="text-[10px] text-slate-400 uppercase font-bold mb-1 print:text-gray-500">Labor Cost</div>
                        <div className="text-white font-mono font-bold text-sm print:text-black">{data.cost_estimation?.labor_cost || "-"}</div>
                    </div>
                 </div>

                 {/* Total Banner */}
                 <div className="flex items-center justify-between bg-gradient-to-r from-green-900/40 to-slate-900 border border-green-900/50 p-4 rounded-lg print:bg-gray-100 print:border-gray-300 print:shadow-none">
                    <div className="flex items-center">
                       <div className="w-10 h-10 bg-green-500/20 rounded-full flex items-center justify-center mr-3 text-green-400 print:hidden">
                          <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                       </div>
                       <div>
                         <div className="text-xs text-green-300 font-bold uppercase tracking-wider print:text-black">Total Estimasi</div>
                         <div className="text-[10px] text-slate-400 print:text-gray-500">Termasuk PPN (Estimasi)</div>
                       </div>
                    </div>
                    <div className="text-xl md:text-2xl font-mono font-bold text-white tracking-tight print:text-black">
                      {data.cost_estimation?.total_estimate || "N/A"}
                    </div>
                 </div>
               </div>
             )}
          </section>
        )}

      </div>
      
      {/* Footer / Status */}
      <div className="bg-slate-950 p-3 flex justify-between items-center border-t border-slate-800 px-6 print:bg-white print:border-t-2 print:border-black print:mt-4 print:py-4">
        <span className="text-xs text-slate-500 font-mono print:text-black print:text-[10px]">
           GENERATED BY MECHANIC CO-PILOT SUPER-APP v3.9
        </span>
        <span className="text-xs text-emerald-500 font-bold flex items-center print:text-black">
          <span className="w-2 h-2 bg-emerald-500 rounded-full mr-1.5 animate-pulse print:hidden"></span>
          OEM VERIFIED
        </span>
      </div>
    </div>
  );
};

export default JobCard;