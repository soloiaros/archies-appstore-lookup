"use client";

import {
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { geoNaturalEarth1, geoPath } from "d3-geo";

import { feature } from "topojson-client";

import type { FeatureCollection } from "geojson";

import type { MapPlace } from "@/lib/site/place";

const WIDTH = 960;
const HEIGHT = 480;

type Tip = {
  id: string;
  x: number;
  y: number;
  label: string;
  detail: string | null;
  n: number;
};

type Dot = MapPlace & {
  x: number;
  y: number;
  radius: number;
};

function landFeatures(world: unknown): FeatureCollection {
  const topology = world as {
    objects: { countries: object };
  };

  return feature(
    // world-atlas JSON is a Topology; typings are stricter than the runtime shape.
    topology as never,
    topology.objects.countries as never,
  ) as unknown as FeatureCollection;
}

function clientToSvg(
  svg: SVGSVGElement,
  clientX: number,
  clientY: number,
) {
  const rect = svg.getBoundingClientRect();

  if (rect.width <= 0 || rect.height <= 0) {
    return null;
  }

  return {
    x: ((clientX - rect.left) / rect.width) * WIDTH,
    y: ((clientY - rect.top) / rect.height) * HEIGHT,
  };
}

function nearestDot(dots: Dot[], x: number, y: number) {
  let best: Dot | null = null;
  let bestDist = Infinity;

  for (const dot of dots) {
    const dx = dot.x - x;
    const dy = dot.y - y;
    const dist = dx * dx + dy * dy;

    if (dist < bestDist) {
      bestDist = dist;
      best = dot;
    }
  }

  return best;
}

function tipFromDot(dot: Dot): Tip {
  return {
    id: dot.id,
    x: dot.x,
    y: dot.y,
    label: dot.label,
    detail: dot.detail,
    n: dot.n,
  };
}

export function VisitorMap({ places }: { places: MapPlace[] }) {
  const reactId = useId();
  const svgRef = useRef<SVGSVGElement | null>(null);
  const touchTracking = useRef(false);
  const [landPath, setLandPath] = useState("");
  const [tip, setTip] = useState<Tip | null>(null);

  const projection = useMemo(
    () => geoNaturalEarth1()
      .scale(168)
      .translate([WIDTH / 2, HEIGHT / 2 + 16]),
    [],
  );

  const path = useMemo(() => geoPath(projection), [projection]);

  useEffect(() => {
    let cancelled = false;

    void import("world-atlas/countries-110m.json").then((mod) => {
      if (cancelled) {
        return;
      }

      const world = (mod as { default: unknown }).default ?? mod;
      const collection = landFeatures(world);
      setLandPath(path(collection) ?? "");
    });

    return () => {
      cancelled = true;
    };
  }, [path]);

  const dots = useMemo(() => {
    return places.flatMap((place) => {
      const point = projection([place.lon, place.lat]);

      if (!point) {
        return [];
      }

      const radius = Math.min(5.5, 2.2 + Math.sqrt(place.n) * 0.55);

      return [{
        ...place,
        x: point[0],
        y: point[1],
        radius,
      }];
    });
  }, [places, projection]);

  function revealNearest(clientX: number, clientY: number) {
    const svg = svgRef.current;

    if (!svg || dots.length === 0) {
      return;
    }

    const point = clientToSvg(svg, clientX, clientY);

    if (!point) {
      return;
    }

    const nearest = nearestDot(dots, point.x, point.y);

    if (!nearest) {
      return;
    }

    setTip((current) => {
      const next = tipFromDot(nearest);

      if (
        current
        && current.id === next.id
        && current.x === next.x
        && current.y === next.y
      ) {
        return current;
      }

      return next;
    });
  }

  function onPointerMove(event: React.PointerEvent<SVGSVGElement>) {
    if (event.pointerType !== "mouse" && !touchTracking.current) {
      return;
    }

    revealNearest(event.clientX, event.clientY);
  }

  function onPointerDown(event: React.PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse") {
      return;
    }

    touchTracking.current = true;
    event.currentTarget.setPointerCapture(event.pointerId);
    revealNearest(event.clientX, event.clientY);
  }

  function endTouchTracking(event: React.PointerEvent<SVGSVGElement>) {
    if (event.pointerType === "mouse") {
      return;
    }

    touchTracking.current = false;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setTip(null);
  }

  if (places.length === 0) {
    return <p className="board-note">No places in this window yet.</p>;
  }

  return (
    <div className="visitor-map">
      <svg
        ref={svgRef}
        className="visitor-map-svg"
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label="Visitor locations on a world map"
        onPointerMove={onPointerMove}
        onPointerDown={onPointerDown}
        onPointerUp={endTouchTracking}
        onPointerCancel={endTouchTracking}
        onPointerLeave={() => {
          if (!touchTracking.current) {
            setTip(null);
          }
        }}
      >
        <title>Visitor map</title>
        <path
          className="visitor-map-land"
          d={landPath}
        />

        {dots.map((dot) => {
          const active = tip?.id === dot.id;

          return (
            <circle
              key={`${reactId}-${dot.id}`}
              className={
                active
                  ? "visitor-map-dot is-nearest"
                  : "visitor-map-dot"
              }
              cx={dot.x}
              cy={dot.y}
              r={active ? Math.max(dot.radius, 4.2) : dot.radius}
              tabIndex={0}
              aria-label={[
                dot.label,
                dot.detail,
                `${dot.n} visitor${dot.n === 1 ? "" : "s"}`,
              ].filter(Boolean).join(", ")}
              onFocus={() => setTip(tipFromDot(dot))}
              onBlur={() => setTip(null)}
            />
          );
        })}
      </svg>

      {tip ? (
        <div
          className="visitor-map-tip"
          style={{
            left: `${(tip.x / WIDTH) * 100}%`,
            top: `${(tip.y / HEIGHT) * 100}%`,
          }}
        >
          <strong>{tip.label}</strong>
          {tip.detail ? <span>{tip.detail}</span> : null}
          <em>
            {tip.n.toLocaleString("en-US")}
            {" "}
            visitor
            {tip.n === 1 ? "" : "s"}
          </em>
        </div>
      ) : null}
    </div>
  );
}
