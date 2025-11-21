import React, { useEffect, useState } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Icon } from 'leaflet';

// Fixed: Use CDN URLs for Leaflet assets instead of direct imports
// to prevent "Unexpected token" or 404 errors in browser environment
const DefaultIcon = new Icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    tooltipAnchor: [16, -28],
    shadowSize: [41, 41]
});

interface MapDisplayProps {
    lat: number;
    lng: number;
    popupText?: string;
    markers?: Array<{lat: number, lng: number, text: string}>;
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

export const MapDisplay: React.FC<MapDisplayProps> = ({ lat, lng, popupText, markers = [], className = "h-48 w-full rounded-xl", zoom = 15 }) => {
    // Ensure we don't break SSR or mounting issues
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) return <div className={`${className} bg-gray-200 animate-pulse`}></div>;

    const allMarkers = markers.length > 0 ? markers : [{lat, lng, text: popupText || "Current Location"}];

    return (
        <div className={`${className} overflow-hidden shadow-inner border border-white/30 relative z-0`}>
            <MapContainer 
                center={[lat, lng]} 
                zoom={zoom} 
                scrollWheelZoom={true} 
                style={{ height: "100%", width: "100%" }}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <RecenterMap lat={lat} lng={lng} zoom={zoom} />
                {allMarkers.map((m, idx) => (
                    <Marker key={idx} position={[m.lat, m.lng]} icon={DefaultIcon}>
                        <Popup>
                            {m.text}
                        </Popup>
                    </Marker>
                ))}
            </MapContainer>
        </div>
    );
};