import React, { useEffect, useRef, useCallback, useState } from 'react';
import maplibregl from 'maplibre-gl';
import * as turf from '@turf/turf';
import 'maplibre-gl/dist/maplibre-gl.css';

const ICONS = { TREE: '🌲', GROUND: '⛰️', BUILDING: '🏠', BEEHIVE: '🐝' };

const MapComponent = ({ hives, flyTo, zoomLevel = 14, onMapLoad, dcaLayer }) => {
  const mapContainer = useRef(null);
  const map = useRef(null);
  const markers = useRef([]);
  const [isMapLoaded, setIsMapLoaded] = useState(false);

  useEffect(() => {
    if (map.current) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => initMap([pos.coords.longitude, pos.coords.latitude]),
      () => initMap([-78.6382, 35.7796]), // Fallback to Raleigh, NC
      { enableHighAccuracy: true }
    );

    function initMap(center) {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            's': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'], tileSize: 256 },
            'h': { type: 'raster', tiles: ['https://mt1.google.com/vt/lyrs=h&x={x}&y={y}&z={z}'], tileSize: 256 }
          },
          layers: [{ id: 's', type: 'raster', source: 's' }, { id: 'h', type: 'raster', source: 'h', paint: { 'raster-opacity': 0.35 } }]
        },
        center: center, zoom: 12, attributionControl: false
      });
      map.current.on('load', () => {
        map.current.addSource('rings', { type: 'geojson', data: { type: 'FeatureCollection', features: [] } });
        map.current.addLayer({ id: 'rf', type: 'fill', source: 'rings', paint: { 'fill-color': '#76ff03', 'fill-opacity': 0.04 } });
        map.current.addLayer({ id: 'rl', type: 'line', source: 'rings', paint: { 'line-color': '#76ff03', 'line-width': 1, 'line-opacity': 0.2, 'line-dasharray': [2, 2] } });
        setIsMapLoaded(true);
        if (onMapLoad) onMapLoad(map.current);
      });
    }
  }, []);

  useEffect(() => {
    if (map.current && flyTo) {
      map.current.flyTo({ center: flyTo, zoom: zoomLevel });
      // V107: Force-close any open popups when flying to a marked ID
      const openPopups = document.querySelectorAll('.maplibregl-popup');
      openPopups.forEach(popup => popup.remove());
    }
  }, [flyTo, zoomLevel]);

  useEffect(() => {
    if (!map.current || !isMapLoaded) return;

    // 1. ALWAYS CLEAR EXISTING MARKERS FIRST (Fixes Ghosting on 0/1154)
    markers.current.forEach(m => m.remove());
    markers.current = [];

    // Clear DCA Overlays
    if (map.current.getLayer('dca-heat')) map.current.removeLayer('dca-heat');
    if (map.current.getSource('dca-source')) map.current.removeSource('dca-source');

    // 2. Additive Overlays - Early exit if no new hives to map
    if (hives.length === 0) {
      if (map.current.getSource('rings')) map.current.getSource('rings').setData({ type: 'FeatureCollection', features: [] });
      return;
    }

    // V77 Geospatial Guard
    const validHives = hives.filter(h => Number.isFinite(Number(h.lng)) && Number.isFinite(Number(h.lat)));

    // Additive Overlays
    const ringData = validHives.map(h => turf.circle([Number(h.lng), Number(h.lat)], 3, { units: 'miles' }));
    if (map.current.getSource('rings')) map.current.getSource('rings').setData({ type: 'FeatureCollection', features: ringData });

    markers.current = validHives.map(hive => {
      const el = document.createElement('div');
      el.className = 'hive-marker';

      const note = (hive.note || "").toLowerCase();
      let type = 'BEEHIVE';
      if (/tree|pine|oak|snag|wood|forest/i.test(note)) type = 'TREE';
      else if (/ground|dirt|soil|earth|mound/i.test(note)) type = 'GROUND';
      else if (/building|house|wall|structure|roof|shed/i.test(note)) type = 'BUILDING';
      else if (/box|hive|nuc|feral|langstroth/i.test(note)) type = 'BEEHIVE';

      const healthColor =
        hive.derivedStatus === 'healthy' ? '#22c55e' : // Green
          hive.derivedStatus === 'warning' ? '#eab308' : // Yellow
            hive.derivedStatus === 'at-risk' ? '#ef4444' : // Red
              '#9ca3af'; // Gray (Needs Audit)

      el.style.cssText = `display:flex; align-items:center; justify-content:center; width:22px; height:22px; border-radius:4px; background:white; border:2px solid ${healthColor}; box-shadow:0 4px 10px rgba(0,0,0,0.5); cursor:pointer; font-size:14px; z-index:5;`;
      el.innerText = ICONS[type];

      const p = new maplibregl.Popup({ offset: 12, closeOnClick: true }).setHTML(`<div style="background:#222; color:#ffcc00; padding:8px; font-weight:bold; font-family:sans-serif; border-radius:4px;">${hive.date || '2026'}<br/>${hive.note}</div>`);

      return new maplibregl.Marker({ element: el })
        .setLngLat([Number(hive.lng), Number(hive.lat)]) // Final Geospatial Array Enforcement Guard
        .setPopup(p).addTo(map.current);
    });

    // IMPLEMENT DCA HEATMAP BASED ON HEALTHY HIVES [cite: 2026-02-26]
    if (dcaLayer) {
      const features = validHives.map(h => ({
        type: 'Feature',
        properties: { status: h.derivedStatus },
        geometry: { type: 'Point', coordinates: [Number(h.lng), Number(h.lat)] }
      }));

      map.current.addSource('dca-source', { type: 'geojson', data: { type: 'FeatureCollection', features } });
      map.current.addLayer({
        id: 'dca-heat',
        type: 'heatmap',
        source: 'dca-source',
        paint: {
          'heatmap-weight': [
            'match',
            ['get', 'status'],
            'healthy', 1,
            0
          ],
          'heatmap-intensity': 1,
          'heatmap-color': ['interpolate', ['linear'], ['heatmap-density'], 0, 'rgba(0,0,255,0)', 0.5, 'rgba(255,204,0,0.5)', 1, 'rgba(255,0,0,0.8)'],
          'heatmap-radius': 50 // Represents the "Flyway Radius"
        }
      });
    }
  }, [hives, isMapLoaded, dcaLayer]);

  return <div ref={mapContainer} className="map-workspace w-full relative" style={{ height: '80vh' }} />;
};

export default MapComponent;
