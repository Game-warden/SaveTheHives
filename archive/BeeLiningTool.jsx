import React, { useState, useEffect, useRef, useCallback } from 'react';

function degreesToRadians(degrees) { return degrees * Math.PI / 180; }
function radiansToDegrees(radians) { return radians * 180 / Math.PI; }

function calculateDistanceYards(lat1, lon1, lat2, lon2) {
    const R = 6371e3;
    const p1 = lat1 * Math.PI / 180, p2 = lat2 * Math.PI / 180;
    const dp = (lat2 - lat1) * Math.PI / 180, dl = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
    return (2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) * R) * 1.09361;
}

function calculateBearing(lat1, lon1, lat2, lon2) {
    const p1 = degreesToRadians(lat1), p2 = degreesToRadians(lat2);
    const dl = degreesToRadians(lon2 - lon1);
    const y = Math.sin(dl) * Math.cos(p2);
    const x = Math.cos(p1) * Math.sin(p2) - Math.sin(p1) * Math.cos(p2) * Math.cos(dl);
    return (radiansToDegrees(Math.atan2(y, x)) + 360) % 360;
}

function computeIntersection(lat1, lon1, brng1, lat2, lon2, brng2) {
    const phi1 = degreesToRadians(lat1), lambda1 = degreesToRadians(lon1);
    const phi2 = degreesToRadians(lat2), lambda2 = degreesToRadians(lon2);
    const theta13 = degreesToRadians(brng1), theta23 = degreesToRadians(brng2);
    const deltaPhi = phi2 - phi1, deltaLambda = lambda2 - lambda1;
    const d12 = 2 * Math.asin(Math.sqrt(Math.sin(deltaPhi / 2) ** 2 + Math.cos(phi1) * Math.cos(phi2) * Math.sin(deltaLambda / 2) ** 2));
    if (d12 === 0) return null;
    const tA = Math.acos((Math.sin(phi2) - Math.sin(phi1) * Math.cos(d12)) / (Math.sin(d12) * Math.cos(phi1)));
    const tB = Math.acos((Math.sin(phi1) - Math.sin(phi2) * Math.cos(d12)) / (Math.sin(d12) * Math.cos(phi2)));
    const t12 = Math.sin(lambda2 - lambda1) > 0 ? tA : 2 * Math.PI - tA;
    const t21 = Math.sin(lambda2 - lambda1) > 0 ? 2 * Math.PI - tB : tB;
    const a1 = theta13 - t12, a2 = t21 - theta23;
    if (Math.sin(a1) * Math.sin(a2) < 0) return null;
    const a3 = Math.acos(-Math.cos(a1) * Math.cos(a2) + Math.sin(a1) * Math.sin(a2) * Math.cos(d12));
    const d13 = Math.atan2(Math.sin(d12) * Math.sin(a1) * Math.sin(a2), Math.cos(a2) + Math.cos(a1) * Math.cos(a3));
    const p3 = Math.asin(Math.sin(phi1) * Math.cos(d13) + Math.cos(phi1) * Math.sin(d13) * Math.cos(theta13));
    const dl13 = Math.atan2(Math.sin(theta13) * Math.sin(d13) * Math.cos(phi1), Math.cos(d13) - Math.sin(phi1) * Math.sin(p3));
    let l3 = (lambda1 + dl13 + 3 * Math.PI) % (2 * Math.PI) - Math.PI;
    return { lat: radiansToDegrees(p3), lng: radiansToDegrees(l3) };
}

export default function BeeLiningTool({ onCalculate, onClose, onClear, targetIntersection, onSightingsUpdate, onSightingCapture }) {
    const [step, setStep] = useState(0);
    const [sightingA, setSightingA] = useState(null);
    const [currentPos, setCurrentPos] = useState(null);
    const [heading, setHeading] = useState(0);
    const watchId = useRef(null);

    const walkDistance = sightingA && currentPos ? calculateDistanceYards(sightingA.lat, sightingA.lng, currentPos.lat, currentPos.lng) : 0;

    useEffect(() => {
        if (onSightingsUpdate) onSightingsUpdate({ a: sightingA, current: currentPos });
    }, [sightingA, currentPos, onSightingsUpdate]);

    const startSensors = () => {
        if (typeof DeviceOrientationEvent?.requestPermission === 'function') {
            DeviceOrientationEvent.requestPermission().then(res => { if (res === 'granted') window.addEventListener('deviceorientation', h => setHeading(h.webkitCompassHeading || 360 - h.alpha)); });
        } else {
            window.addEventListener('deviceorientation', h => setHeading(h.webkitCompassHeading || 360 - h.alpha));
        }
        if (navigator.geolocation) watchId.current = navigator.geolocation.watchPosition(p => setCurrentPos({ lat: p.coords.latitude, lng: p.coords.longitude }), null, { enableHighAccuracy: true });
        setStep(1);
    };

    const handleClear = () => {
        setStep(0);
        setSightingA(null);
        if (onClear) onClear();
    };

    if (step === 0) return (
        <div className="bg-white p-6 rounded-t-3xl shadow-2xl border-t border-[#7d6d52]/20">
            <button onClick={startSensors} className="w-full bg-[#7d6d52] text-white py-4 rounded-xl font-bold text-lg shadow-lg active:scale-95 transition-transform">Start Bee Hunt Wizard</button>
            <p className="text-center text-[10px] text-[#7d6d52]/60 mt-3 font-bold uppercase tracking-widest">Privacy Protected • Session Only</p>
        </div>
    );

    return (
        <div className="bg-white p-6 rounded-t-3xl shadow-2xl border-t border-[#7d6d52]/20 animate-in slide-in-from-bottom duration-300">
            {/* GUIDANCE BANNER */}
            <div className="bg-[#7d6d52]/10 p-2 rounded-lg mb-4 text-center">
                <p className="text-[10px] font-black text-[#7d6d52] uppercase tracking-widest">
                    {step === 1 && "Align with Bee Flight Path"}
                    {step === 2 && "Walk 20 Yards Away (Follow Blue Dash Line)"}
                    {step === 3 && "Face Flight Path Again"}
                    {step === 4 && "Bee Home Located!"}
                </p>
            </div>

            <div className="flex justify-between items-start mb-4">
                <h4 className="font-black text-xs uppercase tracking-tighter text-[#7d6d52]">{step === 4 ? "🎯 Tracking Hive" : "🐝 Bee Hunt Active"}</h4>
                <button onClick={handleClear} className="text-[10px] font-bold text-red-500 uppercase border border-red-500/20 px-2 py-1 rounded">Reset</button>
            </div>

            {step === 1 && (
                <div className="flex flex-col items-center">
                    <div className="text-4xl font-black text-[#7d6d52] mb-1">{Math.round(heading)}°</div>
                    <button onClick={() => { setSightingA({ ...currentPos, bearing: heading }); onSightingCapture(currentPos); setStep(2); }} disabled={!currentPos} className="w-full bg-blue-600 text-white py-4 rounded-xl font-black mt-4 shadow-lg">Lock Sighting A</button>
                </div>
            )}

            {step === 2 && (
                <div className="flex flex-col items-center">
                    <div className={`text-4xl font-black mb-1 ${walkDistance >= 20 ? 'text-green-600' : 'text-[#7d6d52]'}`}>{Math.round(walkDistance)}yds</div>
                    <button onClick={() => setStep(3)} className={`w-full py-4 rounded-xl font-black mt-4 shadow-lg transition-all ${walkDistance >= 20 ? 'bg-green-600 text-white animate-bounce' : 'bg-gray-200 text-gray-400'}`}>I'm in Position</button>
                </div>
            )}

            {step === 3 && (
                <div className="flex flex-col items-center">
                    <div className="text-4xl font-mono font-black text-[#7d6d52] mb-1">{Math.round(heading)}°</div>
                    <button onClick={() => {
                        const i = computeIntersection(sightingA.lat, sightingA.lng, sightingA.bearing, currentPos.lat, currentPos.lng, heading);
                        if (!i) return; onCalculate(i); setStep(4);
                    }} className="w-full bg-purple-600 text-white py-4 rounded-xl font-black shadow-lg mt-4">Lock Sighting B</button>
                </div>
            )}

            {step === 4 && targetIntersection && currentPos && (
                <div className="flex items-center justify-between bg-[#7d6d52]/5 p-4 rounded-xl border border-[#7d6d52]/10">
                    <div className="flex flex-col">
                        <p className="text-3xl font-black text-[#7d6d52]">{Math.round(calculateDistanceYards(currentPos.lat, currentPos.lng, targetIntersection.lat, targetIntersection.lng))}<span className="text-sm ml-1 opacity-50">yds</span></p>
                        <p className="text-[10px] font-bold uppercase text-[#7d6d52]/40">Follow Purple Line</p>
                    </div>
                    <div className="w-16 h-16 rounded-full bg-white shadow-inner flex items-center justify-center border border-[#7d6d52]/10">
                        <div style={{ transform: `rotate(${calculateBearing(currentPos.lat, currentPos.lng, targetIntersection.lat, targetIntersection.lng) - heading}deg)` }} className="text-3xl text-purple-600 transition-transform duration-200">⬆</div>
                    </div>
                </div>
            )}
            <button onClick={onClose} className="w-full text-[10px] font-bold text-[#7d6d52]/40 uppercase mt-4 py-1">Minimize Tools</button>
        </div>
    );
}
