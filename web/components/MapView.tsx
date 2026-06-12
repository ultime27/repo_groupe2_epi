"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import DeckGL from "@deck.gl/react";
import { PathLayer, ScatterplotLayer } from "@deck.gl/layers";
import { TripsLayer } from "@deck.gl/geo-layers";
import { type Color } from "@deck.gl/core";
import { Map } from "react-map-gl/maplibre";
import "maplibre-gl/dist/maplibre-gl.css";

import type { NetworkResponse, RouteResponse, TripPoint } from "@/lib/types";

const MAP_STYLE = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";
const PLAY_SECONDS = 24;

const NETWORK_COLOR: Color = [86, 99, 122];
const HEAD_STROKE: Color = [255, 255, 255];

const PALETTE: Color[] = [
  [124, 198, 255],
  [255, 180, 84],
  [126, 231, 135],
  [245, 130, 200],
  [255, 99, 99],
  [180, 150, 255],
  [120, 220, 232],
  [255, 221, 87],
];

const INITIAL_VIEW = {
  longitude: -73.6,
  latitude: 45.55,
  zoom: 10.5,
  pitch: 0,
  bearing: 0,
};

interface Props {
  network: NetworkResponse | null;
  route: RouteResponse | null;
  playing: boolean;
  resetNonce: number;
  autoReplay: boolean;
  speed: number;
  onFinished: () => void;
}

function fitView(
  bbox: [number, number, number, number],
  width: number,
  height: number
) {
  const [minX, minY, maxX, maxY] = bbox;
  const longitude = (minX + maxX) / 2;
  const latitude = (minY + maxY) / 2;
  const WORLD = 512;
  const PAD = 0.9;
  const mercY = (lat: number) => {
    const s = Math.sin((lat * Math.PI) / 180);
    return 0.5 - (0.25 * Math.log((1 + s) / (1 - s))) / Math.PI;
  };
  const lngFraction = Math.max((maxX - minX) / 360, 1e-9);
  const latFraction = Math.max(Math.abs(mercY(maxY) - mercY(minY)), 1e-9);
  const zoomX = Math.log2((Math.max(width, 1) * PAD) / (WORLD * lngFraction));
  const zoomY = Math.log2((Math.max(height, 1) * PAD) / (WORLD * latFraction));
  const zoom = Math.min(zoomX, zoomY, 18);
  return { longitude, latitude, zoom: Math.max(zoom, 1), pitch: 0, bearing: 0 };
}

function posAtTime(trip: TripPoint[], t: number): [number, number] {
  if (trip.length === 0) return [0, 0];
  if (t <= trip[0][2]) return [trip[0][0], trip[0][1]];
  const last = trip[trip.length - 1];
  if (t >= last[2]) return [last[0], last[1]];
  let lo = 0;
  let hi = trip.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (trip[mid][2] < t) lo = mid + 1;
    else hi = mid;
  }
  const a = trip[lo - 1];
  const b = trip[lo];
  const span = b[2] - a[2] || 1;
  const f = (t - a[2]) / span;
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}

export function MapView({ network, route, playing, resetNonce, autoReplay, speed: speedMult, onFinished }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const fittedSector = useRef<string | null>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [viewState, setViewState] = useState<any>(INITIAL_VIEW);
  const [currentTime, setCurrentTime] = useState(0);
  const timeRef = useRef(0);
  const onFinishedRef = useRef(onFinished);
  useEffect(() => {
    onFinishedRef.current = onFinished;
  }, [onFinished]);
  const speedRef = useRef(speedMult);
  useEffect(() => {
    speedRef.current = speedMult;
  }, [speedMult]);

  useEffect(() => {
    const el = wrapRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.clientWidth, h: el.clientHeight });
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!network || size.w < 2 || size.h < 2) return;
    if (fittedSector.current === network.sector) return;
    fittedSector.current = network.sector;
    setViewState(fitView(network.bbox, size.w, size.h));
  }, [network, size]);

  const subTrips = useMemo(() => route?.trips ?? [], [route]);

  const animDuration = useMemo(() => {
    let m = 0;
    for (const s of subTrips) if (s.length) m = Math.max(m, s[s.length - 1][2]);
    return m;
  }, [subTrips]);

  useEffect(() => {
    timeRef.current = 0;
    setCurrentTime(0);
  }, [route, resetNonce]);

  useEffect(() => {
    if (!playing || animDuration <= 0) return;
    let raf = 0;
    let last = 0;
    const base = animDuration / PLAY_SECONDS;
    const tick = (ts: number) => {
      if (!last) last = ts;
      const dt = (ts - last) / 1000;
      last = ts;
      let n = timeRef.current + dt * base * speedRef.current;
      if (n >= animDuration) {
        if (autoReplay) {
          n = n % animDuration;
        } else {
          timeRef.current = animDuration;
          setCurrentTime(animDuration);
          onFinishedRef.current();
          return;
        }
      }
      timeRef.current = n;
      setCurrentTime(n);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [playing, animDuration, autoReplay]);

  const tripData = useMemo(
    () =>
      subTrips.map((s) => ({
        path: s.map((p) => [p[0], p[1]]),
        timestamps: s.map((p) => p[2]),
      })),
    [subTrips]
  );

  const heads = useMemo(
    () => subTrips.map((s) => posAtTime(s, currentTime)),
    [subTrips, currentTime]
  );

  const layers = [
    network &&
      new PathLayer({
        id: "network",
        data: network.paths,
        getPath: (d: any) => d,
        getColor: NETWORK_COLOR,
        widthUnits: "pixels",
        getWidth: 1.4,
        widthMinPixels: 1,
        capRounded: true,
        jointRounded: true,
        pickable: false,
      }),
    network &&
      network.major_paths &&
      network.major_paths.length > 0 &&
      new PathLayer({
        id: "major-roads",
        data: network.major_paths,
        getPath: (d: any) => d,
        getColor: [255, 90, 90] as Color,
        widthUnits: "pixels",
        getWidth: 2.4,
        widthMinPixels: 1.5,
        capRounded: true,
        jointRounded: true,
        pickable: false,
          }),
    network &&
      network.critical_pois &&
      network.critical_pois.length > 0 &&
      new ScatterplotLayer({
        id: "critical-halo",
        data: network.critical_pois,
        getPosition: (d: any) => d,
        getRadius: 9,
        radiusUnits: "pixels",
        getFillColor: [255, 64, 64, 55] as Color,
      }),
    network &&
      network.critical_pois &&
      network.critical_pois.length > 0 &&
      new ScatterplotLayer({
        id: "critical-pois",
        data: network.critical_pois,
        getPosition: (d: any) => d,
        getRadius: 5,
        radiusUnits: "pixels",
        getFillColor: [255, 64, 64] as Color,
        stroked: true,
        lineWidthMinPixels: 1.5,
        getLineColor: HEAD_STROKE,
      }),
    route &&
      new TripsLayer({
        id: "plowed",
        data: tripData,
        getPath: (d: any) => d.path,
        getTimestamps: (d: any) => d.timestamps,
        getColor: (_d: any, info: any) => PALETTE[info.index % PALETTE.length],
        widthUnits: "pixels",
        getWidth: 3,
        widthMinPixels: 2,
        capRounded: true,
        jointRounded: true,
        fadeTrail: false,
        currentTime,
      }),
    heads.length > 0 &&
      new ScatterplotLayer({
        id: "plow-halo",
        data: heads,
        getPosition: (d: any) => d,
        getRadius: 10,
        radiusUnits: "pixels",
        getFillColor: (_d: any, info: any) => {
          const c = PALETTE[info.index % PALETTE.length];
          return [c[0], c[1], c[2], 70] as Color;
        },
      }),
    heads.length > 0 &&
      new ScatterplotLayer({
        id: "plow",
        data: heads,
        getPosition: (d: any) => d,
        getRadius: 5,
        radiusUnits: "pixels",
        getFillColor: (_d: any, info: any) => PALETTE[info.index % PALETTE.length],
        stroked: true,
        lineWidthMinPixels: 2,
        getLineColor: HEAD_STROKE,
      }),
  ].filter(Boolean);

  const pct =
    animDuration > 0 ? Math.min(100, (currentTime / animDuration) * 100) : 0;

  return (
    <div ref={wrapRef} style={{ position: "absolute", inset: 0 }}>
      <DeckGL
        viewState={viewState}
        onViewStateChange={(e: any) => setViewState(e.viewState)}
        controller={true}
        layers={layers}
      >
        <Map mapStyle={MAP_STYLE} />
      </DeckGL>

      <div className="legend">
        <div className="item">
          <span className="swatch" style={{ background: "#56637a" }} />
          Rues a deneiger
        </div>
        <div className="item">
          <span
            className="swatch"
            style={{ background: "linear-gradient(90deg,#7cc6ff,#ffb454,#7ee787)" }}
          />
          Tournee (1 couleur / engin)
        </div>
        <div className="item">
          <span
            className="swatch"
            style={{ background: "#fff", width: 10, height: 10, borderRadius: "50%" }}
          />
          Deneigeuses
        </div>
        <div className="item">
          <span className="swatch" style={{ background: "#ff5a5a" }} />
          Routes principales
        </div>
        <div className="item">
          <span
            className="swatch"
            style={{ background: "#ff4040", width: 10, height: 10, borderRadius: "50%" }}
          />
          Batiments prioritaires
        </div>
      </div>

      {route && <div className="progress" style={{ width: `${pct}%` }} />}
    </div>
  );
}