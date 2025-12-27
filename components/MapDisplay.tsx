
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
            <div style="position: relative; width: 56px; height: 56px;">
                 <!-- White Border Ring -->
                <div style="
                    position: absolute;
                    top: 0; left: 0;
                    width: 56px; height: 56px; 
                    border-radius: 50%; 
                    background: white;
                    box-shadow: 0 4px 15px rgba(0,0,0,0.4);
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
                    bottom: -8px;
                    left: 50%;
                    transform: translateX(-50%);
                    width: 0; 
                    height: 0; 
                    border-left: 8px solid transparent;
                    border-right: 8px solid transparent;
                    border-top: 12px solid white;
                    z-index: 49;
                    filter: drop-shadow(0 2px 2px rgba(0,0,0,0.1));
                "></div>

                <!-- Pulse Animation Ring (Blue Aura) -->
                 <div style="
                    position: absolute;
                    top: -4px; left: -4px;
                    width: 64px; height: 64px;
                    border-radius: 50%;
                    border: 2px solid rgba(6, 182, 212, 0.6);
                    animation: pulse-ring 2s infinite;
                    z-index: 10;
                    pointer-events: none;
                "></div>
            </div>
        `,
        iconSize: [56, 64],
        iconAnchor: [28, 64],
        popupAnchor: [0, -68]
    });
};

export const MapDisplay: React.FC<MapDisplayProps> = ({ lat, lng, popupText, markers = [], className = "h-48 w-full rounded-xl", zoom = 15 }) => {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className={`${className} bg-slate-800 animate-pulse border border-white/10`}></div>;

    const allMarkers = markers.length > 0 ? markers : [{lat, lng, text: popupText || "Current Location"}];

    return (
        <div className={`${className} overflow-hidden shadow-2xl border border-white/20 relative z-0`}>
            <MapContainer 
                center={[lat, lng]} 
                zoom={zoom} 
                scrollWheelZoom={true} 
                zoomControl={false}
                style={{ height: "100%", width: "100%", background: '#0f172a' }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap lat={lat} lng={lng} zoom={zoom} />
                
                {allMarkers.map((m, idx) => (
                    <React.Fragment key={idx}>
                        {/* Zone Radius Circle (The blue circle) */}
                        <Circle 
                            center={[m.lat, m.lng]}
                            radius={500} // 500 meters radius zone
                            pathOptions={{ 
                                fillColor: '#06b6d4', 
                                fillOpacity: 0.1, 
                                color: '#06b6d4', 
                                weight: 1, 
                                opacity: 0.3 
                            }}
                        />
                        
                        {/* Custom Avatar Marker (ALWAYS used, never DefaultIcon) */}
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
