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

    let baseStyles = "backdrop-blur-xl rounded-3xl p-5 transition-all duration-500 ease-out border relative overflow-hidden";
    
    let variantStyles = "";
    switch(variant) {
        case 'highlight':
            variantStyles = "bg-slate-900/60 border-cyan-500/30 shadow-[0_0_30px_-10px_rgba(6,182,212,0.3)]";
            break;
        case 'danger':
            variantStyles = "bg-rose-950/30 border-rose-500/20";
            break;
        default:
            variantStyles = "bg-slate-900/40 border-white/5 shadow-xl";
    }

    return (
        <div 
            onClick={onClick}
            className={`
                ${baseStyles}
                ${variantStyles}
                ${shouldHover ? 'hover:bg-slate-800/50 hover:scale-[1.01] hover:border-white/10 cursor-pointer' : ''}
                ${className}
            `}
        >
            {/* Inner sheen effect */}
            <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-50 pointer-events-none" />
            
            {/* Content relative z-index to sit above sheen */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
};