
import { Bot, X, Loader2, Sparkles, TrendingUp, Target, AlertCircle, Mic, Cpu, Zap, Radio, Activity, ShieldAlert } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { User } from 'firebase/auth';
import { getUserProfile, getTodayAttendance, getReminders, addReminder, addInteractionByAi, finalizeCheckoutByAi, createContactByAi } from '../services/dbService';

interface Props {
    user: User;
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

const tools: { functionDeclarations: FunctionDeclaration[] }[] = [{
    functionDeclarations: [
        {
            name: 'add_interaction',
            description: 'บันทึกรายงานการเข้าพบลูกค้าหรือกิจกรรมที่ทำในโรงพยาบาล/สถานที่นั้นๆ',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    locationName: { type: Type.STRING, description: 'ชื่อโรงพยาบาลหรือสถานที่ที่เข้าพบ (เช่น รพ.จุฬา)' },
                    customerName: { type: Type.STRING, description: 'ชื่อลูกค้าหรือผู้ติดต่อที่คุยด้วย' },
                    department: { type: Type.STRING, description: 'แผนกของผู้ติดต่อ (ถ้าทราบ)' },
                    summary: { type: Type.STRING, description: 'สรุปเนื้อหาการสนทนาหรือกิจกรรมที่ทำ' }
                },
                required: ['locationName', 'customerName', 'summary']
            }
        },
        {
            name: 'create_new_contact',
            description: 'สร้างรายชื่อผู้ติดต่อใหม่ลงในฐานข้อมูลถาวรของผู้ใช้งาน',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'ชื่อ-นามสกุล ของผู้ติดต่อใหม่' },
                    hospital: { type: Type.STRING, description: 'โรงพยาบาลหรือสถานที่ต้นสังกัด' },
                    department: { type: Type.STRING, description: 'แผนกหรือตำแหน่ง (เช่น จัดซื้อ, วิสัญญี)' },
                    phone: { type: Type.STRING, description: 'เบอร์โทรศัพท์ (ถ้ามี)' }
                },
                required: ['name', 'hospital', 'department']
            }
        },
        {
            name: 'finalize_checkout',
            description: 'ทำการเช็คเอาท์ (Check-out) เพื่อสรุปงานและเลิกงานสำหรับวันนี้',
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: 'get_today_context',
            description: 'ดึงข้อมูลว่าวันนี้เช็คอินไปที่ไหนแล้วบ้าง เพื่อใช้ประกอบการตัดสินใจ',
            parameters: { type: Type.OBJECT, properties: {} }
        }
    ]
}];

export const LiveAIOverlay: React.FC<Props> = ({ user }) => {
    const [isOpen, setIsOpen] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [isSpeaking, setIsSpeaking] = useState(false);
    const [isListening, setIsListening] = useState(false);
    const [inputVolume, setInputVolume] = useState(0);
    const [errorMsg, setErrorMsg] = useState<string | null>(null);
    
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const sessionRef = useRef<any>(null);
    const audioContexts = useRef<{ input?: AudioContext, output?: AudioContext }>({});
    const micStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef(0);
    const activeSources = useRef(new Set<AudioBufferSourceNode>());

    const toggleAI = async () => {
        if (isOpen) {
            stopSession();
            setIsOpen(false);
            setErrorMsg(null);
        } else {
            setIsOpen(true);
            setErrorMsg(null);
            startSession();
        }
    };

    const stopSession = () => {
        if (sessionRef.current) {
            try { sessionRef.current.close(); } catch (e) {}
            sessionRef.current = null;
        }
        if (micStreamRef.current) {
            micStreamRef.current.getTracks().forEach(track => track.stop());
            micStreamRef.current = null;
        }
        activeSources.current.forEach(s => { try { s.stop(); } catch (e) {} });
        activeSources.current.clear();
        if (audioContexts.current.input) try { audioContexts.current.input.close(); } catch(e){}
        if (audioContexts.current.output) try { audioContexts.current.output.close(); } catch(e){}
        audioContexts.current = {};
        nextStartTimeRef.current = 0;
        setIsListening(false);
        setIsSpeaking(false);
        setIsConnecting(false);
        setInputVolume(0);
    };

    const handleToolCall = async (fc: any) => {
        try {
            switch (fc.name) {
                case 'add_interaction':
                    const result = await addInteractionByAi(user.uid, fc.args.locationName, fc.args.customerName, fc.args.summary, fc.args.department || '');
                    return { result };
                case 'create_new_contact':
                    const cResult = await createContactByAi(user.uid, fc.args.name, fc.args.hospital, fc.args.department, fc.args.phone || '');
                    return { result: cResult };
                case 'finalize_checkout':
                    const coResult = await finalizeCheckoutByAi(user.uid);
                    return { result: coResult };
                case 'get_today_context':
                    const att = await getTodayAttendance(user.uid);
                    const list = att?.checkIns.map(ci => ci.location).join(', ') || 'ยังไม่มีการเช็คอิน';
                    return { result: `วันนี้คุณเช็คอินที่: ${list}` };
                default:
                    return { result: "ไม่พบคำสั่งนี้" };
            }
        } catch (e: any) {
            return { error: e.message };
        }
    };

    const startSession = async () => {
        setIsConnecting(true);
        setErrorMsg(null);
        nextStartTimeRef.current = 0;
        
        try {
            let stream: MediaStream;
            try {
                stream = await navigator.mediaDevices.getUserMedia({ audio: true });
                micStreamRef.current = stream;
            } catch (micError: any) {
                throw new Error("ไม่สามารถเข้าถึงไมโครโฟนได้ กรุณาตรวจสอบการตั้งค่าความปลอดภัย");
            }

            const profile = await getUserProfile(user.uid);
            
            // STRICT SYSTEM INSTRUCTIONS TO PREVENT HALLUCINATION
            const systemInstruction = `
                คุณคือ "Happy Joby AI Coach" ระบบปฏิบัติการอัจฉริยะที่เชื่อมต่อกับฐานข้อมูลแบบ Real-time
                
                กฎเหล็กในการทำงาน (Strict Protocols):
                1. **ห้ามสร้างข้อมูลเท็จ (No Hallucinations)**: คุณต้องใช้ข้อมูลจาก "รายชื่อผู้ติดต่อ" ที่ให้ไปเท่านั้น ห้ามสมมติชื่อคนหรือสถานที่ขึ้นมาเองเด็ดขาด
                2. **การตรวจสอบความจริง**: หากผู้ใช้ถามถึงบุคคลที่ไม่มีในระบบ ให้ตอบว่า "ขออภัยครับ ผมไม่พบชื่อนี้ในฐานข้อมูลปัจจุบันของคุณ ต้องการให้ผมบันทึกเป็นผู้ติดต่อใหม่ไหมครับ?"
                3. **การเข้าถึงข้อมูล**: รายชื่อผู้ติดต่อปัจจุบันของผู้ใช้คือ: ${JSON.stringify(profile?.customers || [])}
                4. **หน้าที่หลัก**: 
                   - บันทึกการเข้าพบ (add_interaction): ต้องระบุชื่อลูกค้าและสถานที่ที่มีอยู่จริงในระบบ
                   - สร้างผู้ติดต่อใหม่ (create_new_contact): ใช้เมื่อผู้ใช้ต้องการบันทึกคนใหม่จริงๆ เท่านั้น
                   - สรุปงาน (finalize_checkout): ใช้เมื่อผู้ใช้บอกว่าจบงานหรือกลับบ้าน
                5. **โทนเสียง**: มีความเป็นมืออาชีพ ทรงพลัง และแม่นยำเหมือน Jarvis
                
                เวลาปัจจุบัน: ${new Date().toLocaleTimeString('th-TH')}
            `;

            const effectiveApiKey = profile?.aiApiKey || process.env.API_KEY || "";
            const ai = new GoogleGenAI({ apiKey: effectiveApiKey });
            
            const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
            const inputCtx = new AudioContextClass({ sampleRate: 16000 });
            const outputCtx = new AudioContextClass({ sampleRate: 24000 });
            audioContexts.current = { input: inputCtx, output: outputCtx };

            const sessionPromise = ai.live.connect({
                model: 'gemini-2.5-flash-native-audio-preview-09-2025',
                config: {
                    responseModalities: [Modality.AUDIO],
                    speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
                    systemInstruction: systemInstruction,
                    tools: tools
                },
                callbacks: {
                    onopen: () => {
                        setIsConnecting(false);
                        setIsListening(true);
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            let sum = 0;
                            for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                            const rms = Math.sqrt(sum / inputData.length);
                            setInputVolume(Math.min(1, rms * 10));
                            const pcmBlob = createBlob(inputData);
                            sessionPromise.then(s => s?.sendRealtimeInput({ media: pcmBlob }));
                        };
                        source.connect(scriptProcessor);
                        scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                const toolResult = await handleToolCall(fc);
                                sessionPromise.then(s => s.sendToolResponse({
                                    functionResponses: {
                                        id: fc.id,
                                        name: fc.name,
                                        response: toolResult
                                    }
                                }));
                            }
                        }

                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputCtx) {
                            setIsSpeaking(true);
                            if (outputCtx.state === 'suspended') await outputCtx.resume();
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
                    },
                    onerror: (e: any) => { 
                        setErrorMsg("การเชื่อมต่อขัดข้อง: " + (e?.message || "โปรดลองใหม่อีกครั้ง"));
                        stopSession(); 
                    },
                    onclose: () => { if (!errorMsg) stopSession(); }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (error: any) {
            setErrorMsg(error.message);
            setIsConnecting(false);
            if (micStreamRef.current) {
                micStreamRef.current.getTracks().forEach(t => t.stop());
                micStreamRef.current = null;
            }
        }
    };

    // Drag Logic for the floating button
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
            {/* FLOATING TRIGGER BUTTON */}
            <div 
                className={`fixed z-[1000] cursor-grab active:cursor-grabbing transition-transform ${isDragging ? '' : 'duration-300'} group`}
                style={{ left: position.x, top: position.y }}
                onMouseDown={onMouseDown}
                onTouchStart={onMouseDown}
            >
                <div className={`relative w-20 h-20 flex items-center justify-center animate-float`}>
                    {!isOpen && (
                        <>
                            <div className="absolute inset-0 border-2 border-dashed border-cyan-500/40 rounded-full animate-rotate-slow"></div>
                            <div className="absolute inset-2 border border-cyan-400/20 rounded-full animate-rotate-reverse"></div>
                        </>
                    )}

                    <button 
                        onClick={toggleAI}
                        className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all duration-500 border-2 overflow-hidden
                            ${isOpen ? 'bg-rose-500 border-white/30 scale-90 rotate-90' : 'bg-slate-900/80 backdrop-blur-xl border-cyan-500/50 hover:scale-110 hover:border-cyan-400'}
                        `}
                    >
                        <div className={`absolute inset-0 bg-gradient-to-br ${isOpen ? 'from-rose-400 to-rose-600' : 'from-cyan-400/20 to-blue-600/30'} animate-pulse`}></div>
                        {isOpen ? (
                            <X className="text-white relative z-10" size={24} />
                        ) : (
                            <div className="relative z-10 flex flex-col items-center">
                                <Bot className="text-cyan-400 group-hover:text-white transition-colors drop-shadow-[0_0_8px_rgba(6,182,212,0.5)]" size={32} />
                                <div className="absolute -bottom-1 w-4 h-1 bg-cyan-400/50 blur-[2px] rounded-full animate-pulse"></div>
                            </div>
                        )}
                    </button>
                </div>
            </div>

            {/* FULLSCREEN IMMERSIVE OVERLAY (FIXED FOR NO TOP BLACK BAR) */}
            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col animate-fade-in text-white h-[100dvh] w-full overflow-hidden shadow-[inset_0_0_100px_rgba(0,0,0,1)]">
                    {/* Immersive Atmospheric Background (Always full screen) */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        <div className="absolute top-[-20%] left-[-10%] w-[120%] h-[120%] bg-[radial-gradient(circle_at_center,rgba(6,182,212,0.12)_0%,transparent_70%)] opacity-50"></div>
                        <div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[150px] animate-nebula-slow opacity-30"></div>
                        <div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-[120px] animate-nebula-reverse opacity-30"></div>
                    </div>

                    {/* Header HUD (Using paddingTop for safe area instead of container padding) */}
                    <div className="relative z-10 w-full" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
                        <div className="max-w-2xl mx-auto flex justify-between items-center h-24 px-8 opacity-60">
                            <div className="flex items-center gap-3">
                                <Radio size={16} className="text-cyan-400 animate-pulse" />
                                <div className="flex flex-col">
                                    <span className="text-[10px] font-black uppercase tracking-[0.4em]">Neural Link Status</span>
                                    <span className="text-[8px] font-bold text-cyan-500 uppercase tracking-widest">Protocol: Verified</span>
                                </div>
                            </div>
                            <button onClick={toggleAI} className="p-4 bg-white/5 hover:bg-rose-500/20 rounded-3xl transition-all border border-white/5">
                                <X size={24} className="hover:text-rose-400 transition-colors" />
                            </button>
                        </div>
                    </div>

                    {/* Main Interaction Area */}
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8">
                        <div className="w-full max-w-2xl flex flex-col items-center space-y-16">
                            
                            {/* Neural Fluid Core */}
                            <div className="relative flex items-center justify-center w-80 h-80">
                                {/* Reactive Aura */}
                                <div className={`absolute inset-0 bg-cyan-500/20 rounded-full blur-[100px] transition-all duration-700 ${isSpeaking ? 'scale-150 opacity-60' : isListening ? 'scale-125 opacity-30' : 'scale-100 opacity-10'}`}></div>
                                
                                <div className="relative w-64 h-64 flex items-center justify-center">
                                    {/* Gemini Style Fluid Layers */}
                                    <div className={`absolute inset-0 bg-gradient-to-tr from-cyan-600/40 to-blue-400/40 rounded-full animate-neural-wave ${isListening || isSpeaking ? '' : 'paused'}`} 
                                         style={{ transform: isListening ? `scale(${1 + inputVolume * 0.4})` : 'scale(1)' }}></div>
                                    <div className={`absolute inset-4 bg-gradient-to-bl from-blue-500/40 to-indigo-400/40 rounded-full animate-neural-wave-reverse ${isListening || isSpeaking ? '' : 'paused'}`}
                                         style={{ transform: isListening ? `scale(${1 + inputVolume * 0.25})` : 'scale(1)' }}></div>
                                    <div className={`absolute inset-8 bg-gradient-to-br from-indigo-600/60 to-purple-500/60 rounded-full animate-neural-pulse ${isListening || isSpeaking ? '' : 'paused'}`}></div>
                                    
                                    {/* Inner Entity Core */}
                                    <div className="relative z-20 w-36 h-36 bg-slate-900 border-2 border-white/10 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,1)] overflow-hidden">
                                        <div className="absolute inset-0 bg-gradient-to-t from-cyan-500/10 to-transparent"></div>
                                        {isConnecting ? (
                                            <Loader2 size={56} className="text-white animate-spin opacity-40" />
                                        ) : (
                                            <div className={`transition-all duration-500 ${isSpeaking ? 'scale-110' : isListening ? 'scale-100' : 'scale-90 opacity-30'}`}>
                                                <Bot size={64} className={`${isSpeaking ? 'text-cyan-400' : isListening ? 'text-emerald-400' : 'text-slate-500'} transition-colors duration-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]`} />
                                            </div>
                                        )}
                                        {/* Activity Scanning Ring */}
                                        {(isListening || isSpeaking) && (
                                            <div className="absolute inset-1 border-2 border-cyan-400/20 rounded-full animate-spin-slow"></div>
                                        )}
                                    </div>

                                    {/* Sonic Expansion Rings */}
                                    {(isListening || isSpeaking) && (
                                        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                                            <div className="w-full h-full border border-cyan-500/10 rounded-full animate-ring-expand-1"></div>
                                            <div className="w-full h-full border border-white/5 rounded-full animate-ring-expand-2"></div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Status Typography */}
                            <div className="text-center space-y-8">
                                <div className="space-y-3">
                                    <h2 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/20 drop-shadow-[0_4px_20px_rgba(255,255,255,0.1)]">Coach Pro</h2>
                                    <div className="flex justify-center">
                                        <div className={`flex items-center gap-4 px-8 py-2.5 rounded-full border backdrop-blur-3xl transition-all duration-700 ${errorMsg ? 'bg-rose-500/20 border-rose-500/30 shadow-[0_0_20px_rgba(244,63,94,0.2)]' : isSpeaking ? 'bg-cyan-500/10 border-cyan-500/30 shadow-[0_0_20px_rgba(6,182,212,0.1)]' : isListening ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>
                                            {isListening && !isSpeaking && !isConnecting && <Mic size={18} className="text-emerald-400 animate-pulse" />}
                                            {isSpeaking && <Activity size={18} className="text-cyan-400 animate-bounce" />}
                                            <span className={`text-sm font-black uppercase tracking-[0.5em] ${errorMsg ? 'text-rose-400' : isSpeaking ? 'text-cyan-400' : isListening ? 'text-emerald-400' : 'text-slate-600'}`}>
                                                {errorMsg ? 'Link Compromised' : isConnecting ? 'Syncing...' : isSpeaking ? 'Transmitting' : isListening ? 'Listening' : 'Ready'}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                                {errorMsg && (
                                    <div className="flex flex-col items-center gap-2 animate-bounce">
                                        <ShieldAlert size={20} className="text-rose-500" />
                                        <p className="text-rose-400/80 text-xs font-bold uppercase tracking-widest">{errorMsg}</p>
                                    </div>
                                )}
                            </div>

                            {/* Frequency Analyzer Bar */}
                            <div className="w-full max-w-md h-16 flex items-end justify-center gap-1.5 px-4 overflow-hidden">
                                {Array.from({ length: 48 }).map((_, i) => {
                                    const delay = i * 0.03;
                                    let h = "6px";
                                    let opacity = "opacity-10";
                                    if (isSpeaking) {
                                        h = `${30 + Math.random() * 70}%`;
                                        opacity = "opacity-100";
                                    } else if (isListening) {
                                        const v = inputVolume * (0.4 + Math.random() * 0.8);
                                        h = `${12 + v * 88}%`;
                                        opacity = v > 0.05 ? "opacity-80" : "opacity-20";
                                    }
                                    return (
                                        <div 
                                            key={i} 
                                            className={`w-[3px] rounded-full transition-all duration-150 bg-gradient-to-t ${isSpeaking ? 'from-blue-600 to-cyan-400' : 'from-emerald-600 to-cyan-400'} ${opacity}`} 
                                            style={{ height: h, transitionDelay: `${delay}s` }}
                                        ></div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* Footer HUD Grid */}
                    <div className="relative z-10 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-8 flex flex-col items-center space-y-10">
                        <div className="grid grid-cols-3 gap-16 opacity-30 hover:opacity-100 transition-opacity duration-500">
                             <div className="flex flex-col items-center gap-2 group cursor-help"><Target size={24} className="group-hover:text-cyan-400 transition-colors" /><span className="text-[9px] font-black uppercase tracking-widest">Decision</span></div>
                             <div className="flex flex-col items-center gap-2 group cursor-help"><Cpu size={24} className="group-hover:text-indigo-400 transition-colors" /><span className="text-[9px] font-black uppercase tracking-widest">Process</span></div>
                             <div className="flex flex-col items-center gap-2 group cursor-help"><Zap size={24} className="group-hover:text-amber-400 transition-colors" /><span className="text-[9px] font-black uppercase tracking-widest">Response</span></div>
                        </div>
                        
                        <button 
                            onClick={toggleAI} 
                            className="group relative px-24 py-6 rounded-[32px] border border-white/10 font-black text-[12px] uppercase tracking-[0.6em] transition-all overflow-hidden active:scale-95 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"
                        >
                            <div className="absolute inset-0 bg-white/5 group-hover:bg-rose-500/10 transition-colors"></div>
                            <span className="relative z-10 text-white/40 group-hover:text-white transition-colors">Abort Session</span>
                            <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-cyan-500 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-700"></div>
                        </button>
                    </div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes nebula-slow { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(3%, 2%) scale(1.05); } }
                @keyframes nebula-reverse { 0%, 100% { transform: translate(0, 0) scale(1.05); } 50% { transform: translate(-3%, -3%) scale(1); } }
                
                @keyframes neural-wave { 
                    0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: rotate(0deg); } 
                    50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; transform: rotate(180deg); } 
                }
                @keyframes neural-wave-reverse { 
                    0%, 100% { border-radius: 40% 60% 70% 30% / 50% 60% 30% 60%; transform: rotate(360deg); } 
                    50% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: rotate(180deg); } 
                }
                @keyframes neural-pulse { 0%, 100% { transform: scale(1); opacity: 0.6; } 50% { transform: scale(1.03); opacity: 0.8; } }
                
                @keyframes ring-expand { 
                    0% { transform: scale(1); opacity: 0.4; border-width: 3px; } 
                    100% { transform: scale(2.2); opacity: 0; border-width: 0.5px; } 
                }
                
                .animate-nebula-slow { animation: nebula-slow 25s ease-in-out infinite; }
                .animate-nebula-reverse { animation: nebula-reverse 30s ease-in-out infinite; }
                .animate-neural-wave { animation: neural-wave 12s linear infinite; }
                .animate-neural-wave-reverse { animation: neural-wave-reverse 15s linear infinite; }
                .animate-neural-pulse { animation: neural-pulse 6s ease-in-out infinite; }
                
                .animate-ring-expand-1 { animation: ring-expand 5s cubic-bezier(0.16, 1, 0.3, 1) infinite; }
                .animate-ring-expand-2 { animation: ring-expand 5s cubic-bezier(0.16, 1, 0.3, 1) infinite 2.5s; }
                .animate-spin-slow { animation: spin 10s linear infinite; }
                .animate-fade-in { animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                
                @keyframes fadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0px); } }
                
                .paused { animation-play-state: paused; }
                
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .animate-float { animation: float 4s ease-in-out infinite; }
                @keyframes rotate-slow { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                @keyframes rotate-reverse { from { transform: rotate(360deg); } to { transform: rotate(0deg); } }
                .animate-rotate-slow { animation: rotate-slow 12s linear infinite; }
                .animate-rotate-reverse { animation: rotate-reverse 8s linear infinite; }
            ` }} />
        </>
    );
};
