
import React, { useEffect, useState, useRef } from 'react';
import { User } from 'firebase/auth';
import { ActivityPost, UserProfile, PostComment } from '../types';
import { 
    getActivityPosts, createActivityPost, toggleLikePost, 
    deleteActivityPost, addCommentToPost, updateActivityPost 
} from '../services/dbService';
import { GlassCard } from '../components/GlassCard';
import { 
    Heart, MessageCircle, Share2, Plus, Camera, X, 
    Loader2, Trash2, Send, Image as ImageIcon,
    ChevronLeft, ChevronRight, Edit3, MoreHorizontal
} from 'lucide-react';

interface Props {
    user: User;
    userProfile: UserProfile | null;
}

const ImageCarousel: React.FC<{ images: string[] }> = ({ images }) => {
    const [currentIndex, setCurrentIndex] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
        const width = e.currentTarget.offsetWidth;
        const newIndex = Math.round(e.currentTarget.scrollLeft / width);
        if (newIndex !== currentIndex) setCurrentIndex(newIndex);
    };

    if (images.length === 1) {
        return <img src={images[0]} className="w-full h-full object-cover" alt="Post" />;
    }

    return (
        <div className="relative w-full h-full group">
            <div 
                ref={scrollRef}
                onScroll={handleScroll}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory no-scrollbar"
            >
                {images.map((img, idx) => (
                    <div key={idx} className="flex-shrink-0 w-full h-full snap-center">
                        <img src={img} className="w-full h-full object-cover" alt={`Slide ${idx + 1}`} />
                    </div>
                ))}
            </div>
            
            {/* Pagination Dots */}
            <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5 z-10">
                {images.map((_, idx) => (
                    <div 
                        key={idx} 
                        className={`h-1.5 rounded-full transition-all duration-300 ${
                            idx === currentIndex ? 'w-4 bg-white shadow-md' : 'w-1.5 bg-white/50'
                        }`}
                    />
                ))}
            </div>

            {currentIndex > 0 && (
                <button 
                    onClick={() => scrollRef.current?.scrollBy({ left: -scrollRef.current.offsetWidth, behavior: 'smooth' })}
                    className="absolute left-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <ChevronLeft size={20} />
                </button>
            )}
            {currentIndex < images.length - 1 && (
                <button 
                    onClick={() => scrollRef.current?.scrollBy({ left: scrollRef.current.offsetWidth, behavior: 'smooth' })}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-2 bg-black/20 hover:bg-black/40 text-white rounded-full backdrop-blur-md opacity-0 group-hover:opacity-100 transition-opacity"
                >
                    <ChevronRight size={20} />
                </button>
            )}
        </div>
    );
};

const ActivityFeed: React.FC<Props> = ({ user, userProfile }) => {
    const [posts, setPosts] = useState<ActivityPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    
    // Form State
    const [caption, setCaption] = useState('');
    const [postImages, setPostImages] = useState<string[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Comments State
    const [commentTexts, setCommentTexts] = useState<Record<string, string>>({});
    const [expandedComments, setExpandedComments] = useState<Record<string, boolean>>({});
    const [openMenuId, setOpenMenuId] = useState<string | null>(null);

    const loadPosts = async () => {
        setLoading(true);
        const data = await getActivityPosts();
        setPosts(data);
        setLoading(false);
    };

    useEffect(() => {
        loadPosts();
    }, []);

    const processFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 1080;
                    let width = img.width;
                    let height = img.height;
                    if (width > MAX_WIDTH) {
                        height *= MAX_WIDTH / width;
                        width = MAX_WIDTH;
                    }
                    canvas.width = width;
                    canvas.height = height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, width, height);
                    resolve(canvas.toDataURL('image/jpeg', 0.8));
                };
            };
            reader.readAsDataURL(file);
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;
        const remainingSlots = 3 - postImages.length;
        const filesToProcess = files.slice(0, remainingSlots);
        if (files.length > remainingSlots) {
            alert("สามารถเลือกรูปภาพได้สูงสุด 3 รูปเท่านั้น");
        }
        const newImages = await Promise.all(filesToProcess.map(processFile));
        setPostImages(prev => [...prev, ...newImages]);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const removeImage = (index: number) => {
        setPostImages(prev => prev.filter((_, i) => i !== index));
    };

    const handleOpenCreate = () => {
        setModalMode('create');
        setCaption('');
        setPostImages([]);
        setShowModal(true);
    };

    const handleOpenEdit = (post: ActivityPost) => {
        setModalMode('edit');
        setEditingPostId(post.id);
        setCaption(post.caption);
        setPostImages(post.imageUrls || []);
        setShowModal(true);
        setOpenMenuId(null);
    };

    const handleSubmit = async () => {
        if (postImages.length === 0 || !caption) return;
        setIsSubmitting(true);
        try {
            if (modalMode === 'create') {
                await createActivityPost({
                    userId: user.uid,
                    userName: userProfile?.name || user.email?.split('@')[0] || 'Unknown',
                    userPhoto: userProfile?.photoBase64,
                    imageUrls: postImages,
                    caption
                });
            } else if (editingPostId) {
                await updateActivityPost(editingPostId, {
                    caption,
                    imageUrls: postImages
                });
            }
            setShowModal(false);
            await loadPosts();
        } catch (e) { alert("ไม่สามารถดำเนินการได้"); } 
        finally { setIsSubmitting(false); }
    };

    const handleLike = async (post: ActivityPost) => {
        const isLiked = (post.likes || []).includes(user.uid);
        setPosts(posts.map(p => p.id === post.id ? {
            ...p,
            likes: isLiked ? p.likes.filter(id => id !== user.uid) : [...(p.likes || []), user.uid]
        } : p));
        await toggleLikePost(post.id, user.uid, isLiked);
    };

    const handleAddComment = async (postId: string) => {
        const text = commentTexts[postId];
        if (!text?.trim()) return;
        
        const newComment: any = {
            id: crypto.randomUUID(),
            userId: user.uid,
            userName: userProfile?.name || user.email?.split('@')[0] || 'Unknown',
            userPhoto: userProfile?.photoBase64,
            text
        };

        setPosts(posts.map(p => p.id === postId ? {
            ...p,
            comments: [...(p.comments || []), { ...newComment, timestamp: { toDate: () => new Date() } } as any]
        } : p));
        
        setCommentTexts(prev => ({ ...prev, [postId]: '' }));
        await addCommentToPost(postId, newComment);
    };

    const handleShare = async (post: ActivityPost) => {
        const shareData = {
            title: `กิจกรรมของ ${post.userName}`,
            text: post.caption,
            url: window.location.href
        };
        if (navigator.share) {
            try { await navigator.share(shareData); } catch (err) { console.debug("Share cancelled"); }
        } else {
            try {
                await navigator.clipboard.writeText(window.location.href);
                alert("คัดลอกลิงก์เรียบร้อยแล้ว");
            } catch (err) { alert("ไม่สามารถแชร์ได้"); }
        }
    };

    const handleDelete = async (postId: string) => {
        if (!window.confirm("ต้องการลบโพสต์นี้ใช่หรือไม่? การกระทำนี้ไม่สามารถย้อนกลับได้")) return;
        setOpenMenuId(null);
        try {
            await deleteActivityPost(postId);
            await loadPosts();
        } catch (e) { alert("ไม่สามารถลบโพสต์ได้"); }
    };

    return (
        <div className="max-w-xl mx-auto pb-28 pt-4 px-4 space-y-6">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-3xl font-black text-slate-900 dark:text-white tracking-tight">กิจกรรม</h2>
                    <p className="text-slate-500 text-sm font-medium">แชร์ช่วงเวลาดีๆ กับทีม</p>
                </div>
                <button 
                    onClick={handleOpenCreate}
                    className="p-3.5 bg-gradient-to-br from-cyan-500 to-blue-600 text-white rounded-2xl shadow-lg shadow-cyan-500/20 active:scale-95 transition-all"
                >
                    <Plus size={24} />
                </button>
            </div>

            {loading && (
                <div className="flex flex-col items-center justify-center py-20 gap-4">
                    <Loader2 className="animate-spin text-cyan-500" size={40} />
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Loading Feed...</span>
                </div>
            )}

            {!loading && posts.length === 0 && (
                <div className="py-20 text-center space-y-4 opacity-50">
                    <ImageIcon className="mx-auto text-slate-300" size={60} />
                    <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">ยังไม่มีความเคลื่อนไหวในขณะนี้</p>
                </div>
            )}

            <div className="space-y-8">
                {posts.map((post) => {
                    const isLiked = (post.likes || []).includes(user.uid);
                    const isOwnPost = post.userId === user.uid;
                    const commentCount = (post.comments || []).length;
                    const isCommentsExpanded = expandedComments[post.id];
                    const isMenuOpen = openMenuId === post.id;

                    return (
                        <div key={post.id} className="animate-enter">
                            <GlassCard className="p-0 overflow-hidden border-white/50 dark:border-white/5 shadow-2xl">
                                {/* Post Header */}
                                <div className="p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 border-2 border-white dark:border-slate-700 shadow-sm overflow-hidden shrink-0">
                                            {post.userPhoto ? (
                                                <img src={post.userPhoto} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center bg-cyan-500 text-white font-bold text-lg uppercase">
                                                    {post.userName.charAt(0)}
                                                </div>
                                            )}
                                        </div>
                                        <div>
                                            <div className="font-black text-slate-900 dark:text-white text-sm">{post.userName}</div>
                                            <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight">
                                                {post.timestamp.toDate().toLocaleDateString('th-TH', { day: 'numeric', month: 'short' })} • 
                                                {post.timestamp.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })}
                                            </div>
                                        </div>
                                    </div>
                                    
                                    <div className="relative">
                                        <button 
                                            onClick={() => setOpenMenuId(isMenuOpen ? null : post.id)}
                                            className="p-2 text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors"
                                        >
                                            <MoreHorizontal size={20} />
                                        </button>
                                        
                                        {isMenuOpen && (
                                            <div className="absolute right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 py-2 overflow-hidden animate-enter">
                                                {isOwnPost && (
                                                    <>
                                                        <button onClick={() => handleOpenEdit(post)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                            <Edit3 size={16} className="text-cyan-500" /> แก้ไข
                                                        </button>
                                                        <button onClick={() => handleDelete(post.id)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 transition-colors border-t dark:border-white/5">
                                                            <Trash2 size={16} /> ลบโพสต์
                                                        </button>
                                                    </>
                                                )}
                                                {!isOwnPost && (
                                                    <button onClick={() => handleShare(post)} className="w-full flex items-center gap-3 px-4 py-3 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5 transition-colors">
                                                        <Share2 size={16} className="text-indigo-500" /> แชร์
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                {/* Carousel Content */}
                                <div className="aspect-square w-full relative bg-slate-100 dark:bg-slate-950 overflow-hidden">
                                    <ImageCarousel images={post.imageUrls || []} />
                                </div>

                                {/* Post Interactions */}
                                <div className="p-4 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-5">
                                            <button 
                                                onClick={() => handleLike(post)}
                                                className={`transition-all active:scale-150 ${isLiked ? 'text-rose-500 scale-110' : 'text-slate-400 hover:text-rose-400'}`}
                                            >
                                                <Heart size={26} fill={isLiked ? "currentColor" : "none"} />
                                            </button>
                                            <button 
                                                onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: !prev[post.id] }))}
                                                className={`transition-colors ${isCommentsExpanded ? 'text-cyan-500' : 'text-slate-400 hover:text-cyan-500'}`}
                                            >
                                                <MessageCircle size={26} />
                                            </button>
                                            <button onClick={() => handleShare(post)} className="text-slate-400 hover:text-indigo-500 transition-colors"><Share2 size={24} /></button>
                                        </div>
                                        <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                            {(post.likes || []).length} Likes
                                        </div>
                                    </div>

                                    <div className="pt-1">
                                        <p className="text-sm text-slate-800 dark:text-slate-200 leading-relaxed font-medium">
                                            <span className="font-black mr-2 text-slate-900 dark:text-white">{post.userName}</span>
                                            {post.caption}
                                        </p>
                                    </div>

                                    {commentCount > 0 && !isCommentsExpanded && (
                                        <button 
                                            onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: true }))}
                                            className="text-xs font-bold text-slate-400 hover:text-cyan-500 transition-colors"
                                        >
                                            ดูคอมเม้นต์ทั้งหมด {commentCount} รายการ
                                        </button>
                                    )}

                                    {isCommentsExpanded && (
                                        <div className="space-y-3 pt-2 border-t dark:border-white/5 animate-enter">
                                            {(post.comments || []).map((comment, cIdx) => (
                                                <div key={comment.id || cIdx} className="flex gap-2">
                                                    <div className="w-6 h-6 rounded-full overflow-hidden shrink-0 bg-slate-100 dark:bg-slate-800">
                                                        {comment.userPhoto ? <img src={comment.userPhoto} className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center bg-slate-400 text-white text-[8px] font-bold">{comment.userName.charAt(0)}</div>}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className="text-xs text-slate-700 dark:text-slate-300">
                                                            <span className="font-black text-slate-900 dark:text-white mr-1.5">{comment.userName}</span>
                                                            {comment.text}
                                                        </p>
                                                        <span className="text-[8px] font-bold text-slate-400 uppercase">
                                                            {comment.timestamp?.toDate ? comment.timestamp.toDate().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : 'เมื่อสักครู่'}
                                                        </span>
                                                    </div>
                                                </div>
                                            ))}
                                            <button 
                                                onClick={() => setExpandedComments(prev => ({ ...prev, [post.id]: false }))}
                                                className="text-[10px] font-black text-slate-400 uppercase tracking-widest pt-1"
                                            >
                                                ซ่อนคอมเม้นต์
                                            </button>
                                        </div>
                                    )}

                                    <div className="pt-2 flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-full overflow-hidden shrink-0 border border-slate-100 dark:border-slate-800">
                                            {userProfile?.photoBase64 ? <img src={userProfile.photoBase64} className="w-full h-full object-cover" /> : <div className="w-full h-full bg-slate-200 flex items-center justify-center text-slate-400 font-bold text-xs">{user.email?.charAt(0)}</div>}
                                        </div>
                                        <div className="flex-1 relative">
                                            <input 
                                                type="text" 
                                                value={commentTexts[post.id] || ''}
                                                onChange={(e) => setCommentTexts(prev => ({ ...prev, [post.id]: e.target.value }))}
                                                onKeyPress={(e) => e.key === 'Enter' && handleAddComment(post.id)}
                                                placeholder="เขียนคอมเม้นต์..."
                                                className="w-full bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-full py-1.5 px-4 text-xs text-slate-900 dark:text-white outline-none focus:border-cyan-500/50 transition-all pr-10"
                                            />
                                            <button 
                                                onClick={() => handleAddComment(post.id)}
                                                disabled={!commentTexts[post.id]?.trim()}
                                                className="absolute right-3 top-1/2 -translate-y-1/2 text-cyan-500 hover:text-cyan-400 transition-colors disabled:opacity-0"
                                            >
                                                <Send size={14} />
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </GlassCard>
                        </div>
                    );
                })}
            </div>

            {/* Post Modal (Create / Edit) */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 animate-enter">
                    <GlassCard className="w-full max-w-md relative border-cyan-500/30 shadow-2xl p-0 overflow-hidden bg-white dark:bg-slate-900">
                        <div className="p-4 border-b dark:border-white/5 flex items-center justify-between">
                            <h3 className="text-lg font-black text-slate-900 dark:text-white flex items-center gap-2">
                                {modalMode === 'create' ? <Camera className="text-cyan-500" size={20} /> : <Edit3 className="text-cyan-500" size={20} />}
                                {modalMode === 'create' ? 'โพสต์กิจกรรมใหม่' : 'แก้ไขโพสต์'}
                            </h3>
                            <button onClick={() => setShowModal(false)} className="p-2 text-slate-400 hover:text-rose-500 transition-colors">
                                <X size={24} />
                            </button>
                        </div>

                        <div className="p-6 space-y-6">
                            <div className="space-y-2">
                                <div className="flex justify-between items-center ml-1">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">รูปภาพกิจกรรม ({postImages.length}/3)</label>
                                    {postImages.length < 3 && (
                                        <button 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="text-[10px] font-black text-cyan-500 uppercase tracking-widest flex items-center gap-1 hover:text-cyan-400 transition-colors"
                                        >
                                            <Plus size={12} /> เพิ่มรูปภาพ
                                        </button>
                                    )}
                                </div>

                                <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar">
                                    {postImages.map((img, idx) => (
                                        <div key={idx} className="relative flex-shrink-0 w-24 h-24 rounded-2xl overflow-hidden border border-slate-200 dark:border-white/10 group animate-enter">
                                            <img src={img} className="w-full h-full object-cover" />
                                            <button 
                                                onClick={() => removeImage(idx)}
                                                className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full backdrop-blur-md hover:bg-rose-500 transition-colors"
                                            >
                                                <X size={12} />
                                            </button>
                                        </div>
                                    ))}
                                    
                                    {postImages.length < 3 && (
                                        <div 
                                            onClick={() => fileInputRef.current?.click()}
                                            className="flex-shrink-0 w-24 h-24 rounded-2xl border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center gap-1 cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-slate-400"
                                        >
                                            <Plus size={20} />
                                            <span className="text-[8px] font-bold">เพิ่มรูป</span>
                                        </div>
                                    )}
                                </div>
                                <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">คำอธิบาย (Caption)</label>
                                <textarea 
                                    value={caption}
                                    onChange={(e) => setCaption(e.target.value)}
                                    placeholder="เล่าเรื่องราวสักนิด..."
                                    className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 transition-all resize-none text-sm h-32"
                                />
                            </div>

                            <div className="flex gap-3">
                                <button 
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || postImages.length === 0 || !caption}
                                    className="flex-1 py-4 bg-gradient-to-r from-cyan-600 to-blue-700 text-white font-black rounded-2xl shadow-xl shadow-blue-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send size={20} /> {modalMode === 'create' ? 'แชร์สู่ฟีด' : 'อัปเดตโพสต์'}</>}
                                </button>
                            </div>
                        </div>
                    </GlassCard>
                </div>
            )}
        </div>
    );
};

export default ActivityFeed;
