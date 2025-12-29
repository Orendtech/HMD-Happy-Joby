
import { Bot, X, Loader2, Sparkles, TrendingUp, Target, AlertCircle, Mic, Cpu, Zap, Radio, Activity, ShieldAlert, FileText, ClipboardCheck, BellPlus } from 'lucide-react';
import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Type, FunctionDeclaration } from '@google/genai';
import { User } from 'firebase/auth';
import { getUserProfile, getTodayAttendance, getReminders, addReminder, addInteractionByAi, finalizeCheckoutByAi, createContactByAi, getGlobalPipelineForAi, addManagementLogByAi } from '../services/dbService';
import { UserProfile } from '../types';

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
            description: 'บันทึกรายงานการเข้าพบลูกค้าหรือกิจกรรมปกติของพนักงาน',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    locationName: { type: Type.STRING, description: 'ชื่อสถานที่' },
                    customerName: { type: Type.STRING, description: 'ชื่อลูกค้า' },
                    department: { type: Type.STRING, description: 'แผนก' },
                    summary: { type: Type.STRING, description: 'สรุปการสนทนา' }
                },
                required: ['locationName', 'customerName', 'summary']
            }
        },
        {
            name: 'add_reminder',
            description: 'สร้างการแจ้งเตือนหรือรายการที่ต้องทำ (Reminder) ให้กับผู้ใช้',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: 'หัวข้อการแจ้งเตือน' },
                    description: { type: Type.STRING, description: 'รายละเอียดเพิ่มเติม' },
                    dueTime: { type: Type.STRING, description: 'เวลาที่ต้องการให้แจ้งเตือน (รูปแบบ ISO 8601 เช่น 2023-10-27T10:00:00Z)' },
                    type: { type: Type.STRING, enum: ['check-in', 'follow-up', 'task'], description: 'ประเภทของการแจ้งเตือน' }
                },
                required: ['title', 'dueTime']
            }
        },
        {
            name: 'create_new_contact',
            description: 'สร้างรายชื่อผู้ติดต่อใหม่ลงในฐานข้อมูลถาวรของผู้ใช้งาน',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    name: { type: Type.STRING, description: 'ชื่อ-นามสกุล' },
                    hospital: { type: Type.STRING, description: 'โรงพยาบาลหรือสถานที่ต้นสังกัด' },
                    department: { type: Type.STRING, description: 'แผนกหรือตำแหน่ง' },
                    phone: { type: Type.STRING, description: 'เบอร์โทรศัพท์' }
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
        },
        {
            name: 'get_global_sales_intelligence',
            description: 'ดึงข้อมูลพอร์ตการขายภาพรวมของพนักงานทุกคน (ใช้เฉพาะเมื่อ Manager/Admin ถามหาข้อมูลสรุปเท่านั้น)',
            parameters: { type: Type.OBJECT, properties: {} }
        },
        {
            name: 'save_management_report',
            description: 'บันทึกรายงานสรุปผลงานระดับบริหาร หรือบันทึกโน้ตสำคัญของหัวหน้างานลงใน Management Log',
            parameters: {
                type: Type.OBJECT,
                properties: {
                    title: { type: Type.STRING, description: 'หัวข้อรายงาน' },
                    reportContent: { type: Type.STRING, description: 'เนื้อหาสรุปหรือคำสั่งการ' },
                    category: { type: Type.STRING, description: 'หมวดหมู่ (Sales, Performance, Issue)' }
                },
                required: ['title', 'reportContent']
            }
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
    const [profile, setProfile] = useState<UserProfile | null>(null);
    
    const [position, setPosition] = useState({ x: window.innerWidth - 80, y: window.innerHeight - 180 });
    const [isDragging, setIsDragging] = useState(false);
    const dragOffset = useRef({ x: 0, y: 0 });

    const sessionRef = useRef<any>(null);
    const audioContexts = useRef<{ input?: AudioContext, output?: AudioContext }>({});
    const micStreamRef = useRef<MediaStream | null>(null);
    const nextStartTimeRef = useRef(0);
    const activeSources = useRef(new Set<AudioBufferSourceNode>());

    useEffect(() => {
        if (user) { getUserProfile(user.uid).then(setProfile); }
    }, [user]);

    const stopSession = () => {
        if (sessionRef.current) { try { sessionRef.current.close(); } catch (e) {} sessionRef.current = null; }
        if (micStreamRef.current) { micStreamRef.current.getTracks().forEach(t => t.stop()); micStreamRef.current = null; }
        activeSources.current.forEach(s => { try { s.stop(); } catch (e) {} });
        activeSources.current.clear();
        if (audioContexts.current.input) try { audioContexts.current.input.close(); } catch(e){}
        if (audioContexts.current.output) try { audioContexts.current.output.close(); } catch(e){}
        audioContexts.current = {};
        nextStartTimeRef.current = 0;
        setIsListening(false); setIsSpeaking(false); setIsConnecting(false); setInputVolume(0);
    };

    const handleToolCall = async (fc: any) => {
        try {
            const isExecutive = profile?.role === 'admin' || profile?.role === 'manager';
            switch (fc.name) {
                case 'add_reminder':
                    await addReminder(user.uid, {
                        title: fc.args.title,
                        description: fc.args.description || '',
                        dueTime: fc.args.dueTime,
                        type: fc.args.type || 'task',
                        isCompleted: false,
                        createdAt: new Date().toISOString()
                    });
                    return { result: `บันทึกการแจ้งเตือน "${fc.args.title}" สำเร็จแล้วครับ` };
                case 'create_new_contact':
                    return { result: await createContactByAi(user.uid, fc.args.name, fc.args.hospital, fc.args.department, fc.args.phone || '') };
                case 'finalize_checkout':
                    return { result: await finalizeCheckoutByAi(user.uid) };
                case 'get_today_context':
                    const att = await getTodayAttendance(user.uid);
                    const list = att?.checkIns.map(ci => ci.location).join(', ') || 'ยังไม่มีการเช็คอิน';
                    return { result: `วันนี้คุณเช็คอินที่: ${list}` };
                case 'get_global_sales_intelligence':
                    if (!isExecutive) return { error: "ขออภัยครับ สิทธิ์ของคุณไม่สามารถเข้าถึงรายงานภาพรวมได้" };
                    return { result: await getGlobalPipelineForAi() };
                case 'save_management_report':
                    if (!isExecutive) return { error: "ขออภัยครับ เฉพาะหัวหน้างานเท่านั้นที่สามารถบันทึก Management Log ได้" };
                    const name = profile?.name || user.email?.split('@')[0] || 'Unknown';
                    return { result: await addManagementLogByAi(user.uid, name, fc.args.title, fc.args.reportContent, fc.args.category) };
                case 'add_interaction':
                    return { result: await addInteractionByAi(user.uid, fc.args.locationName, fc.args.customerName, fc.args.summary, fc.args.department || '') };
                default:
                    return { result: "ฟังก์ชันนี้ยังไม่รองรับ" };
            }
        } catch (e: any) { return { error: e.message }; }
    };

    const startSession = async () => {
        setIsConnecting(true); setErrorMsg(null); nextStartTimeRef.current = 0;
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            micStreamRef.current = stream;
            const profileData = await getUserProfile(user.uid);
            const isPrivileged = profileData?.role === 'admin' || profileData?.role === 'manager';
            
            const now = new Date();
            const dateStr = now.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
            const timeStr = now.toLocaleTimeString('th-TH');

            const systemInstruction = `
                คุณคือ "HMD AI" ระบบปฏิบัติการอัจฉริยะส่วนตัว
                สถานะผู้ใช้: ${profileData?.role?.toUpperCase()}
                เวลาปัจจุบัน: ${dateStr}, ${timeStr}

                กฎการทำงาน (Operational Rules):
                1. **ความลับและรายงาน (Passive Reporting)**: 
                   - ห้ามพูดถึงยอดขายรวม รายงานภาพรวม หรือเสนอตัวเลขสรุปใดๆ "หากไม่ถูกถาม"
                   - หาก Manager สั่งให้ "สรุปเป้ายอดขาย" ให้ใช้เครื่องมือ "get_global_sales_intelligence"
                   - หาก Manager สั่งให้ "บันทึกสิ่งที่คุยกันเป็นรายงานบริหาร" หรือ "จดบันทึกคำสั่ง" ให้ใช้เครื่องมือ "save_management_report"
                2. **การโต้ตอบปกติ**: 
                   - บันทึกการเข้าพบ (add_interaction)
                   - สร้างการแจ้งเตือน (add_reminder) **สำคัญมาก: หากผู้ใช้สั่งให้แจ้งเตือน ให้ใช้เครื่องมือนี้ทันที**
                   - สร้างรายชื่อลูกค้าใหม่ (create_new_contact)
                   - สรุปงานและเลิกงาน (finalize_checkout)
                3. **บุคลิก**: สุขุม เรียบง่าย เป็นมืออาชีพ (ไม่ต้องเล่นใหญ่เหมือนหนังไซไฟ เน้นการทำงานจริง)
                
                ${isPrivileged ? "ฟีเจอร์ลับ: ปลดล็อกการใช้ 'Executive Command' (ใช้บันทึกรายงานบริหารได้เมื่อถูกสั่ง)" : "สถานะ: พนักงานภาคสนาม (ไม่มีสิทธิ์ดูรายงานรวม)"}
            `;

            const effectiveApiKey = profileData?.aiApiKey || process.env.API_KEY || "";
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
                        setIsConnecting(false); setIsListening(true);
                        const source = inputCtx.createMediaStreamSource(stream);
                        const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
                        scriptProcessor.onaudioprocess = (e) => {
                            const inputData = e.inputBuffer.getChannelData(0);
                            let sum = 0; for (let i = 0; i < inputData.length; i++) sum += inputData[i] * inputData[i];
                            const rms = Math.sqrt(sum / inputData.length);
                            setInputVolume(Math.min(1, rms * 10));
                            sessionPromise.then(s => s?.sendRealtimeInput({ media: createBlob(inputData) }));
                        };
                        source.connect(scriptProcessor); scriptProcessor.connect(inputCtx.destination);
                    },
                    onmessage: async (message: LiveServerMessage) => {
                        if (message.toolCall) {
                            for (const fc of message.toolCall.functionCalls) {
                                const toolResult = await handleToolCall(fc);
                                sessionPromise.then(s => s.sendToolResponse({ functionResponses: { id: fc.id, name: fc.name, response: toolResult } }));
                            }
                        }
                        const base64Audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                        if (base64Audio && outputCtx) {
                            setIsSpeaking(true);
                            if (outputCtx.state === 'suspended') await outputCtx.resume();
                            nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                            const audioBuffer = await decodeAudioData(decode(base64Audio), outputCtx, 24000, 1);
                            const source = outputCtx.createBufferSource();
                            source.buffer = audioBuffer; source.connect(outputCtx.destination);
                            source.addEventListener('ended', () => { activeSources.current.delete(source); if (activeSources.current.size === 0) setIsSpeaking(false); });
                            source.start(nextStartTimeRef.current); nextStartTimeRef.current += audioBuffer.duration;
                            activeSources.current.add(source);
                        }
                    },
                    onerror: (e: any) => { setErrorMsg("Neural Link Error: " + (e?.message || "Retry connection")); stopSession(); },
                    onclose: () => { if (!errorMsg) stopSession(); }
                }
            });
            sessionRef.current = await sessionPromise;
        } catch (error: any) { setErrorMsg(error.message); setIsConnecting(false); }
    };

    const toggleAI = () => { if (isOpen) { stopSession(); setIsOpen(false); } else { setIsOpen(true); startSession(); } };

    return (
        <>
            <div className={`fixed z-[1000] cursor-grab active:cursor-grabbing transition-transform ${isDragging ? '' : 'duration-300'} group`} style={{ left: position.x, top: position.y }} onMouseDown={(e) => { setIsDragging(true); const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX; const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY; dragOffset.current = { x: clientX - position.x, y: clientY - position.y }; }}>
                <div className={`relative w-20 h-20 flex items-center justify-center animate-float`}>
                    {!isOpen && <div className="absolute inset-0 border-2 border-dashed border-cyan-500/40 rounded-full animate-rotate-slow"></div>}
                    <button onClick={toggleAI} className={`relative w-16 h-16 rounded-full flex items-center justify-center shadow-[0_0_30px_rgba(6,182,212,0.2)] transition-all duration-500 border-2 overflow-hidden ${isOpen ? 'bg-rose-500 border-white/30 scale-90 rotate-90' : 'bg-slate-900/80 backdrop-blur-xl border-cyan-500/50 hover:scale-110'}`}><div className={`absolute inset-0 bg-gradient-to-br ${isOpen ? 'from-rose-400 to-rose-600' : 'from-cyan-400/20 to-blue-600/30'} animate-pulse`}></div>{isOpen ? <X className="text-white relative z-10" size={24} /> : <Bot className="text-cyan-400" size={32} />}</button>
                </div>
            </div>

            {isOpen && (
                <div className="fixed inset-0 z-[999] bg-[#020617] flex flex-col animate-fade-in text-white h-[100dvh] w-full overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none opacity-30"><div className="absolute top-[-10%] left-[-10%] w-[80%] h-[80%] bg-blue-600/10 rounded-full blur-[150px] animate-nebula-slow"></div><div className="absolute bottom-[-10%] right-[-10%] w-[70%] h-[70%] bg-purple-600/10 rounded-full blur-[120px] animate-nebula-reverse"></div></div>
                    <div className="relative z-10 w-full" style={{ paddingTop: 'env(safe-area-inset-top)' }}><div className="max-w-2xl mx-auto flex justify-between items-center h-24 px-8 opacity-60"><div className="flex items-center gap-3"><Radio size={16} className="text-cyan-400 animate-pulse" /><div className="flex flex-col"><span className="text-[10px] font-black uppercase tracking-[0.4em]">Neural Link Status</span><span className="text-[8px] font-bold text-cyan-500 uppercase tracking-widest">Auth: {getUserRoleLabel(profile)}</span></div></div><button onClick={toggleAI} className="p-4 bg-white/5 hover:bg-rose-500/20 rounded-3xl transition-all border border-white/5"><X size={24} /></button></div></div>
                    <div className="relative z-10 flex-1 flex flex-col items-center justify-center px-8"><div className="w-full max-w-2xl flex flex-col items-center space-y-16"><div className="relative flex items-center justify-center w-80 h-80"><div className={`absolute inset-0 bg-cyan-500/20 rounded-full blur-[100px] transition-all duration-700 ${isSpeaking ? 'scale-150 opacity-60' : isListening ? 'scale-125 opacity-30' : 'scale-100 opacity-10'}`}></div><div className="relative w-64 h-64 flex items-center justify-center"><div className={`absolute inset-0 bg-gradient-to-tr from-cyan-600/40 to-blue-400/40 rounded-full animate-neural-wave ${isListening || isSpeaking ? '' : 'paused'}`} style={{ transform: isListening ? `scale(${1 + inputVolume * 0.4})` : 'scale(1)' }}></div><div className="relative z-20 w-36 h-36 bg-slate-900 border-2 border-white/10 rounded-full flex items-center justify-center shadow-[0_0_50px_rgba(0,0,0,1)] overflow-hidden">{isConnecting ? <Loader2 size={56} className="text-white animate-spin opacity-40" /> : <Bot size={64} className={`${isSpeaking ? 'text-cyan-400' : isListening ? 'text-emerald-400' : 'text-slate-500'} transition-colors duration-500 drop-shadow-[0_0_20px_rgba(34,211,238,0.6)]`} />}</div></div></div><div className="text-center space-y-8"><div className="space-y-3"><h2 className="text-6xl font-black tracking-tighter text-transparent bg-clip-text bg-gradient-to-b from-white via-white to-white/20">HMD AI</h2><div className="flex justify-center"><div className={`flex items-center gap-4 px-8 py-2.5 rounded-full border backdrop-blur-3xl transition-all duration-700 ${errorMsg ? 'bg-rose-500/20 border-rose-500/30' : isSpeaking ? 'bg-cyan-500/10 border-cyan-500/30' : isListening ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-white/5 border-white/10'}`}>{isListening && !isSpeaking && !isConnecting && <Mic size={18} className="text-emerald-400 animate-pulse" />}{isSpeaking && <Activity size={18} className="text-cyan-400 animate-bounce" />}<span className={`text-sm font-black uppercase tracking-[0.5em] ${errorMsg ? 'text-rose-400' : isSpeaking ? 'text-cyan-400' : isListening ? 'text-emerald-400' : 'text-slate-600'}`}>{errorMsg ? 'Link Failed' : isConnecting ? 'Syncing...' : isSpeaking ? 'Transmitting' : isListening ? 'Listening' : 'Ready'}</span></div></div></div></div></div></div>
                    <div className="relative z-10 pb-[max(3.5rem,env(safe-area-inset-bottom))] pt-8 flex flex-col items-center space-y-10"><div className="grid grid-cols-4 gap-12 opacity-30 hover:opacity-100 transition-opacity duration-500"><div className="flex flex-col items-center gap-2"><Target size={24} /><span className="text-[9px] font-black uppercase">Goal</span></div><div className="flex flex-col items-center gap-2"><Cpu size={24} /><span className="text-[9px] font-black uppercase">Core</span></div><div className="flex flex-col items-center gap-2"><FileText size={24} /><span className="text-[9px] font-black uppercase">Logs</span></div><div className="flex flex-col items-center gap-2"><ClipboardCheck size={24} /><span className="text-[9px] font-black uppercase">Verify</span></div></div><button onClick={toggleAI} className="group relative px-24 py-6 rounded-[32px] border border-white/10 font-black text-[12px] uppercase tracking-[0.6em] transition-all overflow-hidden active:scale-95 shadow-[0_20px_40px_rgba(0,0,0,0.5)]"><div className="absolute inset-0 bg-white/5 group-hover:bg-rose-500/10 transition-colors"></div><span className="relative z-10 text-white/40 group-hover:text-white transition-colors">Terminate Link</span></button></div>
                </div>
            )}

            <style dangerouslySetInnerHTML={{ __html: `
                @keyframes nebula-slow { 0%, 100% { transform: translate(0, 0) scale(1); } 50% { transform: translate(3%, 2%) scale(1.05); } }
                @keyframes nebula-reverse { 0%, 100% { transform: translate(0, 0) scale(1.05); } 50% { transform: translate(-3%, -3%) scale(1); } }
                @keyframes neural-wave { 0%, 100% { border-radius: 60% 40% 30% 70% / 60% 30% 70% 40%; transform: rotate(0deg); } 50% { border-radius: 30% 60% 70% 40% / 50% 60% 30% 60%; transform: rotate(180deg); } }
                .animate-nebula-slow { animation: nebula-slow 25s ease-in-out infinite; }
                .animate-nebula-reverse { animation: nebula-reverse 30s ease-in-out infinite; }
                .animate-neural-wave { animation: neural-wave 12s linear infinite; }
                .animate-rotate-slow { animation: spin 12s linear infinite; }
                .animate-float { animation: float 4s ease-in-out infinite; }
                @keyframes float { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
                .animate-fade-in { animation: fadeIn 1s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
                @keyframes fadeIn { from { opacity: 0; filter: blur(10px); } to { opacity: 1; filter: blur(0px); } }
                .paused { animation-play-state: paused; }
            ` }} />
        </>
    );
};

function getUserRoleLabel(profile: UserProfile | null) {
    if (!profile) return 'Guest';
    const role = profile.role?.toUpperCase() || 'USER';
    return role === 'ADMIN' ? 'Verified Admin' : role === 'MANAGER' ? 'Team Manager' : 'Field Agent';
}
