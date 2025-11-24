import React from 'react';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    onClick?: () => void;
    hoverEffect?: boolean;
    variant?: 'default' | 'highlight' | 'danger';
}

export const GlassCard: React.FC<GlassCardProps> = ({ 
    children, 
    className = "", 
    onClick, 
    hoverEffect,
    variant = 'default'
}) => {
    const shouldHover = hoverEffect || !!onClick;

    // Apple Style: Softer transitions, cleaner blurs, subtle borders
    let baseStyles = "backdrop-blur-2xl rounded-[32px] p-6 transition-all duration-300 ease-out border relative overflow-hidden";
    
    let variantStyles = "";
    switch(variant) {
        case 'highlight':
            // Cyan tint
            variantStyles = "bg-white/90 dark:bg-slate-900/80 border-cyan-100 dark:border-cyan-500/30 shadow-[0_8px_30px_rgb(6,182,212,0.15)]";
            break;
        case 'danger':
            // Rose tint
            variantStyles = "bg-white/90 dark:bg-rose-950/30 border-rose-100 dark:border-rose-500/20 shadow-[0_8px_30px_rgb(225,29,72,0.1)]";
            break;
        default:
            // Standard Card: Clean White in Light, Deep Dark in Night
            variantStyles = "bg-white/70 dark:bg-slate-900/60 border-white/50 dark:border-white/10 shadow-[0_4px_20px_rgb(0,0,0,0.03)] dark:shadow-2xl";
    }

    return (
        <div 
            onClick={onClick}
            className={`
                ${baseStyles}
                ${variantStyles}
                ${shouldHover ? 'hover:bg-white dark:hover:bg-slate-800/80 hover:scale-[1.02] hover:shadow-[0_10px_40px_rgb(0,0,0,0.08)] cursor-pointer' : ''}
                ${className}
            `}
        >
            {/* Inner sheen effect (Subtle) */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/40 to-transparent opacity-50 dark:opacity-10 pointer-events-none" />
            
            {/* Content */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};