
import React, { useState, useEffect, useRef } from 'react';
import { Bot, X, Loader2, Sparkles, TrendingUp, Target, AlertCircle, Key, Mic, Volume2 } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { User } from 'firebase/auth';
import { getUserProfile, getTodayAttendance, getReminders, addReminder, addInteractionByAi, finalizeCheckoutByAi } from '../services/dbService';

interface Props {
    user: User;
}

// Declaration for AI Studio environment methods
declare global {
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }
  interface Window {
    // Fix: Added 'readonly' modifier to aistudio property to match identical modifiers in all declarations
    readonly aistudio: AIStudio;
  }
}

// Audio Utilities
function encode(bytes: Uint8Array) {
    let binary = '';
    const len = bytes.byteLength;
    for (let i = 0; i < len; i++) {
        binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
}

function decode(base64: string) {
    const binaryString = atob(base64);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
}

async function decodeAudioData(
    data: Uint8Array,
    ctx: AudioContext,
    sampleRate: number,
    numChannels: number,
): Promise<AudioBuffer> {
    const dataInt16 = new Int16Array(data.buffer);
    const frameCount = dataInt16.length / numChannels;
    const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

    for (let channel = 0; channel < numChannels; channel++) {
        const channelData = buffer.getChannelData(channel);
        for (let i = 0; i < frameCount; i++) {
            channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
        }
    }
    return buffer;
}

function createBlob(data: Float32Array): { data: string, mimeType: string } {
    const l = data.length;
    const int16 = new Int16Array(l);
    for (let i = 0; i < l; i++) {
        int16[i] = data[i] * 32768;
    }
    return {
        data: encode(new Uint8Array(int16.buffer)),
        mimeType: 'audio/pcm;rate=16000',
    };
}

export const LiveAIOverlay: React.FC<Props> = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    const [needKey, setNeedKey] = useState(false);
    
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const sessionRef = useRef<any>(null);
    const audioContexts = useRef<{ input?: AudioContext, output?: AudioContext }>({});
    const nextStartTimeRef = useRef(0);
    const activeSources = useRef(new Set<AudioBufferSourceNode>());

    const toggleAI = async () => {
        if (isOpen) {
            stopSession();
            setIsOpen(false);
        } else {
            setIsOpen(true);
            setErrorMsg(null);
            checkAndStart();
        }
    };

    const checkAndStart = async () => {
        setIsConnecting(true);
        try {
            // Check if key is already selected in AI Studio environment
            if (window.aistudio) {
                const hasKey = await window.aistudio.hasSelectedApiKey();
                if (!hasKey) {
                    setNeedKey(true);
                    setIsConnecting(false);
                    return;
                }
            }
            setNeedKey(false);
            startSession();
        } catch (e) {
            // Fallback for direct browser use
            startSession();
        }
    };

    const handleOpenKeySelector = async () => {
        if (window.aistudio) {
            await window.aistudio.openSelectKey();
            setNeedKey(false);
            startSession();
        }
    };

    const stopSession = () => {
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) {}
            sessionRef.current = null;
        }
        activeSources.current.forEach(s => { try { s.stop(); } catch (e) {} });
        activeSources.current.clear();
        if (audioContexts.current.input) try { audioContexts.current.input.close(); } catch(e){}
        if (audioContexts.current.output) try { audioContexts.current.output.close(); } catch(e){}
        audioContexts.current = {};
        setIsListening(false);
        setIsSpeaking(false);
        setIsConnecting(false);
        nextStartTimeRef.current = 0;
    };

    const startSession = async () => {
        setIsConnecting(true);
        setErrorMsg(null);
        
        try {
            // Obtain User Media first (Mobile Requirement)
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            } catch (micError: any) {
                throw new Error("กรุณาอนุญาตให้ใช้งานไมโครโฟนในการตั้งค่าโทรศัพท์");
            }

            const profile = await getUserProfile(user.uid);
            const systemInstruction = `
                คุณคือ "Happy Joby AI Coach" ผู้ช่วยอัจฉริยะแบบเรียลไทม์
                หน้าที่: รับฟังรายงานการขาย, ช่วยวิเคราะห์ดีล, และบันทึกข้อมูลเข้าสู่ระบบ
                บริบทปัจจุบัน: ผู้ใช้งานชื่อ ${profile?.name || user.email}, เขตพื้นที่ ${profile?.area || 'ทั่วไป'}
                ตอบกลับเป็นภาษาไทยที่สุภาพ กระชับ และเป็นธรรมชาติ
            `;

            // Initialize AI (Always new instance as per rules)
            const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            
            // Audio Setup for Mobile Safari compatibility
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
            const outputCtx = new AudioContextClass({ sampleRate: 24000 });
            
            // Force resume (Crucial for Mobile)
            if (inputCtx.state === 'suspended') await inputCtx.resume();
            if (outputCtx.state === 'suspended') await outputCtx.resume();
            
            audioContexts.current = { input: inputCtx, output: outputCtx };

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Puck' } } },
                    systemInstruction: systemInstruction,
                },
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsListening(true);
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(s => s?.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputCtx) {
                            setIsSpeaking(true);
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer;
                            source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => {
                                activeSources.current.delete(source);
                                if (activeSources.current.size === 0) setIsSpeaking(false);
                            });
                            source.start(nextStartTimeRef.current);
                            nextStartTimeRef.current += audioBuffer.duration;
                            activeSources.current.add(source);
                        }

                        if (message.serverContent?.interrupted) {
                            activeSources.current.forEach(s => s.stop());
                            activeSources.current.clear();
                            nextStartTimeRef.current = 0;
                            setIsSpeaking(false);
                        }
                    },
                    onerror: (e: any) => { 
                        const msg = e?.message || "";
                        if (msg.includes("Requested entity was not found") || msg.includes("API Key")) {
                            setNeedKey(true);
                        } else {
                            setErrorMsg("เกิดข้อผิดพลาด: " + msg); 
                        }
                        stopSession(); 
                    },
                    onclose: () => { if (!errorMsg) stopSession(); }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (error: any) {
            setErrorMsg(error.message);
            setIsConnecting(false);
        }
    };

    // Drag Interaction Logic
    const onMouseDown = (e: React.MouseEvent | React.TouchEvent) => {
        setIsDragging(true);
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;
        dragOffset.current = { x: clientX - position.x, y: clientY - position.y };
    };

    useEffect(() => {
        const onMouseMove = (e: MouseEvent | TouchEvent) => {
            if (!isDragging) return;
            const clientX = 'touches' in e ? e.touches[0].clientX : (e as MouseEvent).clientX;
            const clientY = 'touches' in e ? e.touches[0].clientY : (e as MouseEvent).clientY;
            const newX = Math.max(20, Math.min(window.innerWidth - 80, clientX - dragOffset.current.x));
            const newY = Math.max(20, Math.min(window.innerHeight - 80, clientY - dragOffset.current.y));
            setPosition({ x: newX, y: newY });
        };
        const onMouseUp = () => setIsDragging(false);
        if (isDragging) {
            window.addEventListener('mousemove', onMouseMove);
            window.addEventListener('mouseup', onMouseUp);
            window.addEventListener('touchmove', onMouseMove);
            window.addEventListener('touchend', onMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchmove', onMouseMove);
            window.removeEventListener('touchend', onMouseUp);
        };
    }, [isDragging]);

    return (
        <>
            <div 
                className={`fixed z-[1000] cursor-grab active:cursor-grabbing transition-transform ${isDragging ? '' : 'duration-300'}`}
                style={{ left: position.x, top: position.y }}
                onMouseDown={onMouseDown}
                onTouchStart={onMouseDown}
            >
                <button 
                    onClick={toggleAI}
                    className={`group relative w-16 h-16 rounded-full flex items-center justify-center shadow-2xl transition-all border-4 overflow-hidden
                        ${isOpen ? 'bg-rose-500 border-white/30 scale-95 rotate-90' : 'bg-slate-900 border-cyan-500/50 hover:scale-110'}
                    `}
                >
                    <div className="absolute inset-0 bg-gradient-to-br from-cyan-400/20 to-blue-600/20 animate-pulse"></div>
                    {isOpen ? <X className="text-white" size={28} /> : <Bot className="text-cyan-400 group-hover:text-white transition-colors" size={32} />}
                    {!isOpen && <div className="absolute inset-[-4px] border border-cyan-500/30 rounded-full animate-ping pointer-events-none"></div>}
                </button>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-[#020617]/98 backdrop-blur-3xl flex flex-col animate-enter p-8 text-white safe-area-padding">
                    <div className="max-w-xl mx-auto w-full flex-1 flex flex-col items-center justify-center space-y-12 text-center">
                        
                        <div className="flex flex-col items-center space-y-6">
                            <div className="relative">
                                <div className={`absolute -inset-16 bg-cyan-500/20 rounded-full blur-[80px] transition-all duration-1000 ${isSpeaking ? 'scale-150 opacity-60' : 'scale-100 opacity-20'}`}></div>
                                <div className={`w-36 h-36 rounded-[48px] bg-gradient-to-br from-slate-800 to-slate-900 border-2 border-white/10 flex items-center justify-center relative shadow-2xl ${isSpeaking ? 'animate-pulse' : ''}`}>
                                    <Bot size={72} className={`${isSpeaking ? 'text-cyan-400' : 'text-slate-400'} transition-colors duration-500`} />
                                    {isConnecting && <div className="absolute inset-0 flex items-center justify-center bg-slate-900/60 rounded-[48px]"><Loader2 className="animate-spin text-white" size={48} /></div>}
                                    {(errorMsg || needKey) && <div className="absolute -bottom-2 -right-2 bg-rose-500 p-2.5 rounded-full border-4 border-slate-900 shadow-xl animate-bounce"><AlertCircle size={24} className="text-white" /></div>}
                                </div>
                            </div>
                            
                            <div className="space-y-2">
                                <h2 className="text-4xl font-black tracking-tighter">AI ELITE COACH</h2>
                                <div className="flex items-center justify-center gap-2">
                                    <span className={`w-2 h-2 rounded-full ${isListening ? 'bg-emerald-500 animate-pulse' : 'bg-slate-700'}`}></span>
                                    <p className={`font-bold text-xs uppercase tracking-[0.3em] ${errorMsg || needKey ? 'text-rose-400' : 'text-slate-400'}`}>
                                        {needKey ? 'Identity Check Required' : errorMsg ? 'Link Error' : isConnecting ? 'Initializing Link...' : isSpeaking ? 'Coach is responding' : 'Ready for voice command'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {needKey ? (
                            <div className="bg-white/5 border border-white/10 p-8 rounded-[40px] text-center max-w-sm space-y-6 animate-enter">
                                <Key className="mx-auto text-cyan-400" size={40} />
                                <div className="space-y-2">
                                    <p className="text-slate-200 font-bold text-lg leading-tight">เชื่อมต่อเพื่อเริ่มต้นใช้งาน</p>
                                    <p className="text-slate-500 text-sm leading-relaxed">กรุณากดปุ่มด้านล่างเพื่อเลือก API Key ของคุณ และเริ่มการสนทนากับโค้ชอัจฉริยะ</p>
                                </div>
                                <button 
                                    onClick={handleOpenKeySelector}
                                    className="w-full py-5 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-xl shadow-cyan-500/20 active:scale-95 flex items-center justify-center gap-3"
                                >
                                    Select Key to Connect
                                </button>
                                <p className="text-[10px] text-slate-600 italic leading-relaxed">
                                    * สภาพแวดล้อมที่ Deploy แล้วจำเป็นต้องระบุคีย์ผ่าน AI Studio <br/>เพื่อความปลอดภัยและการเชื่อมต่อที่เสถียร
                                </p>
                            </div>
                        ) : errorMsg ? (
                            <div className="bg-rose-500/10 border border-rose-500/30 p-8 rounded-[40px] text-center max-w-sm space-y-6 animate-enter">
                                <p className="text-rose-400 text-sm font-medium leading-relaxed font-bold">{errorMsg}</p>
                                <button onClick={checkAndStart} className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs transition-all shadow-lg active:scale-95">Re-establish Connection</button>
                            </div>
                        ) : (
                            <div className="h-32 flex items-center justify-center gap-3 w-full max-w-xs">
                                {Array.from({ length: 20 }).map((_, i) => (
                                    <div 
                                        key={i} 
                                        className={`w-1.5 bg-gradient-to-t from-cyan-600 to-blue-400 rounded-full transition-all duration-300 ${isSpeaking ? 'animate-[bounce_0.6s_infinite]' : isListening ? 'opacity-40' : 'opacity-10'}`} 
                                        style={{ 
                                            height: isSpeaking ? `${30 + Math.random() * 70}%` : '8px', 
                                            animationDelay: `${i * 0.05}s` 
                                        }}
                                    ></div>
                                ))}
                            </div>
                        )}

                        {!needKey && !errorMsg && (
                            <div className="grid grid-cols-2 gap-4 w-full">
                                <div className="bg-white/5 border border-white/10 p-5 rounded-[28px] flex flex-col items-center gap-2">
                                    <Mic className="text-emerald-500" size={24} />
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Input Active</div>
                                </div>
                                <div className="bg-white/5 border border-white/10 p-5 rounded-[28px] flex flex-col items-center gap-2">
                                    <Volume2 className="text-cyan-500" size={24} />
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Speaker Sync</div>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="mt-auto flex justify-center py-12">
                        <button onClick={toggleAI} className="bg-white/10 hover:bg-white/20 px-12 py-5 rounded-[24px] border border-white/10 font-black text-xs uppercase tracking-[0.25em] transition-all active:scale-95">
                            DISCONNECT SESSION
                        </button>
                    </div>
                </div>
            )}
            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes bounce { 
                    0%, 100% { transform: scaleY(1); } 
                    50% { transform: scaleY(1.8); } 
                }
                .safe-area-padding {
                    padding-top: env(safe-area-inset-top);
                    padding-bottom: env(safe-area-inset-bottom);
                }
            ` }} />
        </>
    );
};
