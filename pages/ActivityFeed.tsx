
import React, { useEffect, useState, useRef, useMemo } from 'react';
import { User } from 'firebase/auth';
import { ActivityPost, UserProfile, PostComment } from '../types';
import { 
    getActivityPosts, createActivityPost, toggleLikePost, 
    deleteActivityPost, addCommentToPost, updateActivityPost,
    addHospital, getUserProfile
} from '../services/dbService';
import { GlassCard } from '../components/GlassCard';
import { 
    Heart, MessageCircle, Share2, Plus, Camera, X, 
    Loader2, Trash2, Send, Image as ImageIcon,
    ChevronLeft, ChevronRight, Edit3, MoreHorizontal, AlertCircle,
    MapPin, Search, Building, Check
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

const ActivityFeed: React.FC<Props> = ({ user, userProfile: initialProfile }) => {
    const [posts, setPosts] = useState<ActivityPost[]>([]);
    const [loading, setLoading] = useState(true);
    const [showModal, setShowModal] = useState(false);
    const [modalMode, setModalMode] = useState<'create' | 'edit'>('create');
    const [editingPostId, setEditingPostId] = useState<string | null>(null);
    const [profile, setProfile] = useState<UserProfile | null>(initialProfile);
    
    // Form State
    const [caption, setCaption] = useState('');
    const [postImages, setPostImages] = useState<string[]>([]);
    const [location, setLocation] = useState('');
    const [locationSearch, setLocationSearch] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = useState(false);
    
    const fileInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

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

    const refreshProfile = async () => {
        const p = await getUserProfile(user.uid);
        setProfile(p);
    };

    useEffect(() => {
        loadPosts();
        
        const handleClickOutside = (event: MouseEvent) => { 
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsDropdownOpen(false); 
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const processFile = (file: File): Promise<string> => {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 800;
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
                    resolve(canvas.toDataURL('image/jpeg', 0.6));
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
        setLocation('');
        setLocationSearch('');
        setShowModal(true);
    };

    const handleOpenEdit = (post: ActivityPost) => {
        setModalMode('edit');
        setEditingPostId(post.id);
        setCaption(post.caption);
        setPostImages(post.imageUrls || []);
        setLocation(post.location || '');
        setLocationSearch(post.location || '');
        setShowModal(true);
        setOpenMenuId(null);
    };

    const filteredLocations = useMemo(() => {
        const list = profile?.hospitals || [];
        if (!locationSearch) return list;
        return list.filter(h => h.toLowerCase().includes(locationSearch.toLowerCase()));
    }, [profile?.hospitals, locationSearch]);

    const handleSelectLocation = (loc: string) => {
        setLocation(loc);
        setLocationSearch(loc);
        setIsDropdownOpen(false);
    };

    const handleAddNewLocation = async () => {
        if (!locationSearch.trim()) return;
        try {
            await addHospital(user.uid, locationSearch.trim());
            await refreshProfile();
            handleSelectLocation(locationSearch.trim());
        } catch (e) {
            alert("เพิ่มสถานที่ล้มเหลว");
        }
    };

    const handleSubmit = async () => {
        if (postImages.length === 0 || !caption) return;
        
        const totalSize = postImages.reduce((sum, img) => sum + img.length, 0);
        if (totalSize > 900000) { 
            alert("ขนาดรูปภาพรวมกันใหญ่เกินไป กรุณาลดจำนวนรูปหรือเลือกรูปที่เล็กลง");
            return;
        }

        setIsSubmitting(true);
        try {
            if (modalMode === 'create') {
                await createActivityPost({
                    userId: user.uid,
                    userName: profile?.name || user.email?.split('@')[0] || 'Unknown',
                    userPhoto: profile?.photoBase64,
                    imageUrls: postImages,
                    caption,
                    location: location || undefined
                });
            } else if (editingPostId) {
                await updateActivityPost(editingPostId, {
                    caption,
                    imageUrls: postImages,
                    location: location || undefined
                });
            }
            setShowModal(false);
            await loadPosts();
        } catch (e: any) { 
            console.error("Post Submission Error:", e);
            alert("ไม่สามารถดำเนินการได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง");
        } 
        finally { setIsSubmitting(false); }
    };

    // Corrected handleLike function and completion of component
    const handleLike = async (post: ActivityPost) => {
        const isLiked = (post.likes || []).includes(user.uid);
        // Optimistically update the UI
        setPosts(posts.map(p => p.id === post.id ? {
            ...p,
            likes: isLiked ? p.likes.filter(id => id !== user.uid) : [...p.likes, user.uid]
        } : p));

        try {
            await toggleLikePost(post.id, user.uid, isLiked);
        } catch (error) {
            console.error("Like update failed:", error);
            // Re-sync with server if error
            loadPosts();
        }
    };

    const handleAddComment = async (postId: string) => {
        const text = commentTexts[postId];
        if (!text?.trim()) return;

        try {
            await addCommentToPost(postId, {
                userId: user.uid,
                userName: profile?.name || user.email?.split('@')[0] || 'Unknown',
                userPhoto: profile?.photoBase64,
                text: text.trim(),
            } as any);
            setCommentTexts({ ...commentTexts, [postId]: '' });
            await loadPosts();
        } catch (e) {
            console.error("Comment error", e);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!window.confirm("ยืนยันการลบโพสต์นี้?")) return;
        try {
            await deleteActivityPost(postId);
            await loadPosts();
        } catch (e) {
            console.error("Delete error", e);
        }
    };

    if (loading && posts.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="animate-spin text-cyan-500 mb-4" size={40} />
                <p className="text-slate-500 text-sm font-medium">กำลังโหลดฟีดกิจกรรม...</p>
            </div>
        );
    }

    return (
        <div className="max-w-2xl mx-auto space-y-6 pb-32">
            <div className="flex justify-between items-center px-2 pt-6">
                <div>
                    <h1 className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">Activity Feed</h1>
                    <p className="text-slate-500 text-sm font-medium">แชร์เรื่องราวการทำงานของคุณ</p>
                </div>
                <button 
                    onClick={handleOpenCreate}
                    className="p-3.5 bg-cyan-600 text-white rounded-2xl shadow-lg shadow-cyan-600/30 active:scale-95 transition-all"
                >
                    <Plus size={24} />
                </button>
            </div>

            <div className="space-y-8">
                {posts.map((post) => (
                    <GlassCard key={post.id} className="p-0 overflow-hidden border-slate-200 dark:border-white/5 shadow-xl">
                        {/* Post Header */}
                        <div className="p-4 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-400 to-blue-500 overflow-hidden border border-white dark:border-slate-800 shadow-sm">
                                    {post.userPhoto ? (
                                        <img src={post.userPhoto} className="w-full h-full object-cover" alt={post.userName} />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center text-white font-bold">
                                            {post.userName.charAt(0)}
                                        </div>
                                    )}
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900 dark:text-white text-sm leading-tight">
                                        {post.userName}
                                    </div>
                                    {post.location && (
                                        <div className="flex items-center gap-1 text-[10px] text-slate-500 font-medium mt-0.5">
                                            <MapPin size={10} className="text-cyan-500" />
                                            {post.location}
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {post.userId === user.uid && (
                                <div className="relative">
                                    <button 
                                        onClick={() => setOpenMenuId(openMenuId === post.id ? null : post.id)}
                                        className="p-2 text-slate-400 hover:bg-slate-100 dark:hover:bg-white/5 rounded-xl transition-all"
                                    >
                                        <MoreHorizontal size={20} />
                                    </button>
                                    
                                    {openMenuId === post.id && (
                                        <div className="absolute top-full right-0 mt-2 w-40 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 py-2 animate-enter">
                                            <button 
                                                onClick={() => handleOpenEdit(post)}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-white/5"
                                            >
                                                <Edit3 size={16} className="text-cyan-500" /> แก้ไข
                                            </button>
                                            <button 
                                                onClick={() => handleDeletePost(post.id)}
                                                className="w-full flex items-center gap-3 px-4 py-2 text-sm font-bold text-rose-500 hover:bg-rose-50 dark:hover:bg-rose-950/20 border-t dark:border-white/5"
                                            >
                                                <Trash2 size={16} /> ลบ
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Images */}
                        <div className="aspect-square bg-slate-100 dark:bg-slate-950">
                            <ImageCarousel images={post.imageUrls} />
                        </div>

                        {/* Actions */}
                        <div className="p-4">
                            <div className="flex items-center gap-4 mb-3">
                                <button 
                                    onClick={() => handleLike(post)}
                                    className={`flex items-center gap-1.5 transition-all active:scale-90 ${
                                        post.likes.includes(user.uid) ? 'text-rose-500' : 'text-slate-400 hover:text-rose-500'
                                    }`}
                                >
                                    <Heart size={24} className={post.likes.includes(user.uid) ? 'fill-current' : ''} />
                                    <span className="text-xs font-black">{post.likes.length}</span>
                                </button>
                                <button 
                                    onClick={() => setExpandedComments({ ...expandedComments, [post.id]: !expandedComments[post.id] })}
                                    className="flex items-center gap-1.5 text-slate-400 hover:text-cyan-500"
                                >
                                    <MessageCircle size={24} />
                                    <span className="text-xs font-black">{post.comments.length}</span>
                                </button>
                            </div>

                            <p className="text-sm text-slate-800 dark:text-slate-200 font-medium leading-relaxed">
                                <span className="font-bold mr-2">{post.userName}</span>
                                {post.caption}
                            </p>

                            <div className="mt-2 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                                {new Date(post.timestamp.seconds * 1000).toLocaleDateString('th-TH', { 
                                    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' 
                                })}
                            </div>

                            {/* Comments Section */}
                            {(expandedComments[post.id] || post.comments.length > 0) && (
                                <div className="mt-4 pt-4 border-t border-slate-100 dark:border-white/5 space-y-3">
                                    {post.comments.slice(expandedComments[post.id] ? 0 : -2).map((comment, cIdx) => (
                                        <div key={cIdx} className="flex gap-2">
                                            <span className="font-bold text-xs text-slate-900 dark:text-white shrink-0">{comment.userName}</span>
                                            <p className="text-xs text-slate-600 dark:text-slate-400">{comment.text}</p>
                                        </div>
                                    ))}
                                    
                                    {!expandedComments[post.id] && post.comments.length > 2 && (
                                        <button 
                                            onClick={() => setExpandedComments({ ...expandedComments, [post.id]: true })}
                                            className="text-[10px] font-bold text-slate-400 hover:text-cyan-500 uppercase tracking-widest"
                                        >
                                            ดูความคิดเห็นทั้งหมด {post.comments.length} รายการ
                                        </button>
                                    )}

                                    <div className="flex items-center gap-2 mt-2">
                                        <input 
                                            type="text"
                                            value={commentTexts[post.id] || ''}
                                            onChange={(e) => setCommentTexts({ ...commentTexts, [post.id]: e.target.value })}
                                            placeholder="เพิ่มความคิดเห็น..."
                                            className="flex-1 bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-white/5 rounded-xl px-3 py-2 text-xs outline-none focus:border-cyan-500/50"
                                        />
                                        <button 
                                            onClick={() => handleAddComment(post.id)}
                                            disabled={!commentTexts[post.id]?.trim()}
                                            className="p-2 text-cyan-600 dark:text-cyan-400 disabled:opacity-30"
                                        >
                                            <Send size={18} />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </GlassCard>
                ))}
                
                {posts.length === 0 && !loading && (
                    <div className="text-center py-20 bg-white/30 dark:bg-slate-900/30 rounded-[40px] border-2 border-dashed border-slate-200 dark:border-white/10">
                        <ImageIcon size={48} className="mx-auto text-slate-300 mb-4 opacity-30" />
                        <p className="text-slate-400 italic">ยังไม่มีกิจกรรมแชร์ในขณะนี้</p>
                    </div>
                )}
            </div>

            {/* Modal for Create/Edit */}
            {showModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60 backdrop-blur-md p-4 overflow-y-auto">
                    <div className="w-full max-w-lg my-auto">
                        <GlassCard className="p-8 border-cyan-500/30 bg-white dark:bg-slate-900 shadow-2xl relative overflow-visible">
                            <button onClick={() => setShowModal(false)} className="absolute top-4 right-4 text-slate-400 hover:text-rose-500"><X size={24}/></button>
                            <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-6">
                                {modalMode === 'create' ? 'แชร์กิจกรรมใหม่' : 'แก้ไขโพสต์'}
                            </h2>
                            
                            <div className="space-y-6">
                                {/* Image Preview / Upload */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">รูปภาพ (สูงสุด 3 รูป)</label>
                                    <div className="flex gap-2">
                                        {postImages.map((img, idx) => (
                                            <div key={idx} className="relative w-24 h-24 rounded-xl overflow-hidden border border-slate-200 dark:border-white/10 group">
                                                <img src={img} className="w-full h-full object-cover" alt="Preview" />
                                                <button onClick={() => removeImage(idx)} className="absolute top-1 right-1 p-1 bg-black/40 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity"><X size={12}/></button>
                                            </div>
                                        ))}
                                        {postImages.length < 3 && (
                                            <button 
                                                onClick={() => fileInputRef.current?.click()}
                                                className="w-24 h-24 rounded-xl border-2 border-dashed border-slate-200 dark:border-white/10 flex flex-col items-center justify-center text-slate-400 hover:text-cyan-500 hover:border-cyan-500/50 transition-all bg-slate-50 dark:bg-black/20"
                                            >
                                                <Camera size={24} />
                                                <span className="text-[8px] font-bold mt-1 uppercase">เพิ่มรูป</span>
                                            </button>
                                        )}
                                        <input type="file" ref={fileInputRef} onChange={handleFileChange} accept="image/*" multiple className="hidden" />
                                    </div>
                                </div>

                                {/* Caption */}
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">คำบรรยาย</label>
                                    <textarea 
                                        value={caption} 
                                        onChange={e => setCaption(e.target.value)}
                                        rows={3}
                                        className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl p-4 text-slate-900 dark:text-white font-medium outline-none focus:border-cyan-500 transition-all"
                                        placeholder="วันนี้คุณทำอะไรมาบ้าง?"
                                    />
                                </div>

                                {/* Location */}
                                <div className="space-y-2 relative" ref={dropdownRef}>
                                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">สถานที่ (Optional)</label>
                                    <div className="relative">
                                        <Search className="absolute left-3 top-3 text-slate-400" size={16} />
                                        <input 
                                            value={locationSearch} 
                                            onChange={e => { setLocationSearch(e.target.value); setIsDropdownOpen(true); }}
                                            onFocus={() => setIsDropdownOpen(true)}
                                            className="w-full bg-slate-50 dark:bg-black/30 border border-slate-200 dark:border-white/10 rounded-2xl py-3 pl-10 pr-4 text-slate-900 dark:text-white outline-none focus:border-cyan-500 transition-all"
                                            placeholder="เลือกสถานพยาบาล..."
                                        />
                                        {isDropdownOpen && (
                                            <div className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-2xl shadow-2xl z-50 max-h-48 overflow-y-auto ring-1 ring-black/5">
                                                {filteredLocations.map((loc, idx) => (
                                                    <button key={idx} onClick={() => handleSelectLocation(loc)} className="w-full text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-white/5 text-sm flex items-center justify-between border-b border-slate-100 dark:border-white/5 last:border-0 transition-colors">
                                                        <div className="flex items-center gap-2">
                                                            <Building size={14} className="text-cyan-500" />
                                                            <span className="text-slate-900 dark:text-white">{loc}</span>
                                                        </div>
                                                        {location === loc && <Check size={14} className="text-cyan-500" />}
                                                    </button>
                                                ))}
                                                {locationSearch && !profile?.hospitals.includes(locationSearch) && (
                                                    <button onClick={handleAddNewLocation} className="w-full text-left px-4 py-3 bg-cyan-50 dark:bg-cyan-900/20 text-cyan-600 dark:text-cyan-400 text-xs font-bold border-t border-slate-100 dark:border-white/5">
                                                        + เพิ่มสถานพยาบาลใหม่: "{locationSearch}"
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <button 
                                    onClick={handleSubmit}
                                    disabled={isSubmitting || postImages.length === 0 || !caption}
                                    className="w-full bg-cyan-600 py-4 rounded-2xl font-black text-white shadow-xl shadow-cyan-600/30 flex items-center justify-center gap-2 active:scale-95 transition-all disabled:opacity-50"
                                >
                                    {isSubmitting ? <Loader2 className="animate-spin" /> : <><Send size={20} /> {modalMode === 'create' ? 'โพสต์เลย' : 'บันทึกการแก้ไข'}</>}
                                </button>
                            </div>
                        </GlassCard>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ActivityFeed;
