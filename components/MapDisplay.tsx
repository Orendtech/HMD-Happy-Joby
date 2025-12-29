import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import { divIcon } from 'leaflet';

interface MapDisplayProps {
    lat: number;
    lng: number;
    popupText?: string;
    markers?: Array<{lat: number, lng: number, text: string, photo?: string}>;
    className?: string;
    zoom?: number;
}

const RecenterMap: React.FC<{lat: number, lng: number, zoom: number}> = ({lat, lng, zoom}) => {
    const map = useMap();
    useEffect(() => {
        map.setView([lat, lng], zoom);
    }, [lat, lng, zoom, map]);
    return null;
}

// Function to generate the Avatar Icon HTML (Handles both Photo and Initials)
const createAvatarIcon = (photoUrl?: string, label?: string) => {
    const isPhoto = !!photoUrl;
    
    // Fallback initials if no photo
    const name = label?.split('@')[0]?.trim() || '?';
    const initial = name.charAt(0).toUpperCase();

    // Inner Content: Image OR Gradient Initials
    const inner = isPhoto 
        ? `<img src="${photoUrl}" style="width: 100%; height: 100%; object-fit: cover; display: block;" />`
        : `<div style="width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; background: linear-gradient(135deg, #06b6d4, #3b82f6); color: white; font-weight: 800; font-size: 18px;">${initial}</div>`;

    return divIcon({
        className: 'custom-avatar-marker',
        html: `
            <div style="position: relative; width: 64px; height: 72px; animation: marker-float 3s ease-in-out infinite;">
                 <!-- White Border Ring (Avatar Holder) -->
                <div style="
                    position: absolute;
                    top: 4px; left: 4px;
                    width: 56px; height: 56px; 
                    border-radius: 50%; 
                    background: white;
                    box-shadow: 0 4px 20px rgba(0,0,0,0.5), 0 0 10px rgba(6, 182, 212, 0.3);
                    z-index: 50;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    padding: 3px;
                ">
                    <!-- Inner Content (Image or Initials) -->
                    <div style="
                        width: 100%; height: 100%; 
                        border-radius: 50%; 
                        overflow: hidden; 
                        background: #1e293b;
                        position: relative;
                    ">
                        ${inner}
                    </div>
                </div>
                
                <!-- Pointer Triangle (Clean White) -->
                <div style="
                    position: absolute;
                    bottom: 4px;
                    left: 32px;
                    transform: translateX(-50%);
                    width: 0; 
                    height: 0; 
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-top: 12px solid white;
                    z-index: 49;
                    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.2));
                "></div>

                <!-- Primary Pulse Animation Ring (Blue Aura) -->
                 <div style="
                    position: absolute;
                    top: 0; left: 0;
                    width: 64px; height: 64px;
                    border-radius: 50%;
                    border: 3px solid rgba(6, 182, 212, 0.8);
                    animation: pulse-ring 2.5s infinite;
                    z-index: 10;
                    pointer-events: none;
                "></div>

                <!-- Secondary Delayed Pulse Ring -->
                <div style="
                    position: absolute;
                    top: 0; left: 0;
                    width: 64px; height: 64px;
                    border-radius: 50%;
                    border: 2px solid rgba(59, 130, 246, 0.6);
                    animation: pulse-ring 2.5s infinite 1.25s;
                    z-index: 9;
                    pointer-events: none;
                "></div>

                <!-- Subtle Center Shadow (On Ground) -->
                <div style="
                    position: absolute;
                    bottom: -2px; left: 16px;
                    width: 32px; height: 8px;
                    background: rgba(0,0,0,0.2);
                    border-radius: 50%;
                    filter: blur(4px);
                    z-index: 1;
                "></div>
            </div>
        `,
        iconSize: [64, 72],
        iconAnchor: [32, 72],
        popupAnchor: [0, -76]
    });
};

export const MapDisplay: React.FC<MapDisplayProps> = ({ lat, lng, popupText, markers = [], className = "h-48 w-full rounded-xl", zoom = 15 }) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className={`${className} bg-slate-800 animate-pulse border border-white/10`}></div>;

    const allMarkers = markers.length > 0 ? markers : [{lat, lng, text: popupText || "Current Location"}];
    const isDarkMode = document.documentElement.classList.contains('dark');

    // CartoDB tiles are much sharper and have high-res @2x versions
    const tileUrl = isDarkMode 
        ? "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        : "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png";

    return (
        <div className={`${className} overflow-hidden shadow-2xl border border-white/20 relative z-0`}>
            <MapContainer 
                center={[lat, lng]} 
                zoom={zoom} 
                scrollWheelZoom={true} 
                zoomControl={false}
                style={{ height: "100%", width: "100%", background: isDarkMode ? '#111827' : '#f3f4f6' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://carto.com/attributions">CARTO</a>'
                    url={tileUrl}
                    detectRetina={true}
                    maxZoom={20}
                />
                <RecenterMap lat={lat} lng={lng} zoom={zoom} />
                
                {allMarkers.map((m, idx) => (
                    <React.Fragment key={idx}>
                        <Circle 
                            center={[m.lat, m.lng]}
                            radius={500}
                            pathOptions={{ 
                                fillColor: '#06b6d4', 
                                fillOpacity: 0.1, 
                                color: '#06b6d4', 
                                weight: 1, 
                                opacity: 0.3 
                            }}
                        />
                        <Marker position={[m.lat, m.lng]} icon={createAvatarIcon(m.photo, m.text)}>
                            <Popup className="font-sans text-slate-900 font-bold">
                                {m.text}
                            </Popup>
                        </Marker>
                    </React.Fragment>
                ))}
            </MapContainer>
        </div>
    );
};