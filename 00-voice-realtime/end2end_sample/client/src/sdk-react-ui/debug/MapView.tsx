/**
 * MapView - 地图视图组件
 * 纯 UI 组件，不依赖任何 Context
 */

import React, { useEffect, useState, useRef, useMemo } from 'react';

interface Area {
  id: string;
  name: string;
  x?: number;
  y?: number;
  area_sqm?: number;
  product_types?: string[];
  description?: string;
  brands?: string[];
}

interface NavigationPath {
  from: string;
  to: string;
  duration_ms?: number;
}

interface RobotPosition {
  x: number;
  y: number;
  theta?: number;
}

interface MapViewProps {
  /** 区域列表 */
  areas: Area[];
  /** 当前位置 */
  currentPosition: RobotPosition;
  /** 导航路径 */
  navigationPath?: NavigationPath | null;
  /** 导航完成回调 */
  onNavigationComplete?: () => void;
  /** 区域点击回调 */
  onAreaClick?: (areaId: string) => void;
}

const MapView: React.FC<MapViewProps> = ({
  areas,
  currentPosition,
  navigationPath,
  onNavigationComplete,
  onAreaClick
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [selectedArea, setSelectedArea] = useState<string | null>(null);
  const [navigationTrail, setNavigationTrail] = useState<Array<{ x: number; y: number }>>([]);
  const [toPos, setToPos] = useState<{ x: number; y: number } | null>(null);

  // 地图平移和缩放状态
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState<{ x: number; y: number } | null>(null);
  const [lastDistance, setLastDistance] = useState(0);
  const svgRef = useRef<SVGSVGElement>(null);

  // 计算地图边界
  const bounds = useMemo(() => {
    if (areas.length === 0 && (currentPosition.x === 0 && currentPosition.y === 0)) {
      return { minX: 0, minY: 0, width: 100, height: 100, viewBox: "0 0 100 100" };
    }

    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
    let hasValidCoords = false;

    areas.forEach(a => {
      if (a.x !== undefined && a.y !== undefined) {
        minX = Math.min(minX, a.x);
        maxX = Math.max(maxX, a.x);
        minY = Math.min(minY, a.y);
        maxY = Math.max(maxY, a.y);
        hasValidCoords = true;
      }
    });

    if (currentPosition) {
      minX = Math.min(minX, currentPosition.x);
      maxX = Math.max(maxX, currentPosition.x);
      minY = Math.min(minY, currentPosition.y);
      maxY = Math.max(maxY, currentPosition.y);
      hasValidCoords = true;
    }

    if (!hasValidCoords) return { minX: 0, minY: 0, width: 100, height: 100, viewBox: "0 0 100 100" };

    const paddingX = (maxX - minX) * 0.2 || 10;
    const paddingY = (maxY - minY) * 0.2 || 10;

    const finalMinX = minX - paddingX;
    const finalMinY = minY - paddingY;
    const finalWidth = (maxX - minX) + paddingX * 2;
    const finalHeight = (maxY - minY) + paddingY * 2;

    return {
      minX: finalMinX,
      minY: finalMinY,
      width: finalWidth,
      height: finalHeight,
      viewBox: `${finalMinX} ${finalMinY} ${finalWidth} ${finalHeight}`
    };
  }, [areas, currentPosition]);

  // 处理导航路径
  useEffect(() => {
    if (navigationPath && navigationPath.to) {
      const targetArea = areas.find(a => a.id === navigationPath.to || a.name === navigationPath.to);

      if (!targetArea || targetArea.x === undefined || targetArea.y === undefined) {
        console.warn(`未找到目标位置: ${navigationPath.to}`);
        return;
      }

      const to = { x: targetArea.x, y: targetArea.y };
      setToPos(to);
      setIsAnimating(true);
    } else {
      setIsAnimating(false);
      setToPos(null);
      setNavigationTrail([]);
    }
  }, [navigationPath, areas]);

  // 更新导航轨迹
  useEffect(() => {
    if (navigationPath && currentPosition) {
      setNavigationTrail(prev => {
        const last = prev[prev.length - 1];
        if (!last || Math.hypot(currentPosition.x - last.x, currentPosition.y - last.y) > 0.5) {
          return [...prev, { x: currentPosition.x, y: currentPosition.y }];
        }
        return prev;
      });
    }
  }, [currentPosition, navigationPath]);

  const handleAreaClick = (areaId: string) => {
    setSelectedArea(areaId);
    onAreaClick?.(areaId);
  };

  // 触摸和鼠标事件处理
  const getDistance = (p1: React.Touch, p2: React.Touch): number => {
    const dx = p1.clientX - p2.clientX;
    const dy = p1.clientY - p2.clientY;
    return Math.sqrt(dx * dx + dy * dy);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1) {
      const touch = e.touches[0];
      setPanStart({ x: touch.clientX, y: touch.clientY });
      setIsPanning(true);
    } else if (e.touches.length === 2) {
      setIsPanning(false);
      const distance = getDistance(e.touches[0], e.touches[1]);
      setLastDistance(distance);
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    e.preventDefault();

    if (e.touches.length === 1 && panStart && isPanning) {
      const touch = e.touches[0];
      const deltaX = touch.clientX - panStart.x;
      const deltaY = touch.clientY - panStart.y;

      setTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      setPanStart({ x: touch.clientX, y: touch.clientY });
    } else if (e.touches.length === 2) {
      const distance = getDistance(e.touches[0], e.touches[1]);

      if (lastDistance > 0) {
        const scale = distance / lastDistance;
        const newScale = Math.max(0.5, Math.min(3, transform.scale * scale));

        setTransform(prev => ({
          ...prev,
          scale: newScale
        }));
      }

      setLastDistance(distance);
      setIsPanning(false);
    }
  };

  const handleTouchEnd = () => {
    setIsPanning(false);
    setPanStart(null);
    setLastDistance(0);
  };

  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? 0.9 : 1.1;
    const newScale = Math.max(0.5, Math.min(3, transform.scale * delta));

    setTransform(prev => ({
      ...prev,
      scale: newScale
    }));
  };

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setPanStart({ x: e.clientX, y: e.clientY });
      setIsPanning(true);
    }
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPanning && panStart) {
      const deltaX = e.clientX - panStart.x;
      const deltaY = e.clientY - panStart.y;

      setTransform(prev => ({
        ...prev,
        x: prev.x + deltaX,
        y: prev.y + deltaY
      }));

      setPanStart({ x: e.clientX, y: e.clientY });
    }
  };

  const handleMouseUp = () => {
    setIsPanning(false);
    setPanStart(null);
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex flex-col h-full bg-white border border-slate-100 rounded-xl overflow-hidden">
        <div className="bg-slate-900 px-4 py-3 border-b border-slate-800">
          <h3 className="text-white font-bold text-lg flex items-center gap-2 m-0">
            <span>🗺️</span>
            <span>店铺地图</span>
          </h3>
        </div>

        <div
          className="flex-1 p-0 relative bg-slate-50 overflow-hidden touch-none select-none"
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        >
          <svg
            ref={svgRef}
            viewBox={bounds.viewBox}
            style={{
              width: '100%',
              height: '100%',
              transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
              transformOrigin: 'center',
              transition: 'transform 0.1s ease-out'
            }}
            className="border cursor-move bg-slate-50"
          >
            <defs>
              <pattern id="grid" width="10" height="10" patternUnits="userSpaceOnUse">
                <path d="M 10 0 L 0 0 0 10" fill="none" stroke="#e2e8f0" strokeWidth="0.5" />
              </pattern>
              <pattern id="grid-large" width="50" height="50" patternUnits="userSpaceOnUse">
                <rect width="50" height="50" fill="url(#grid)" />
                <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#cbd5e1" strokeWidth="1" />
              </pattern>

              <linearGradient id="navigationGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.3" />
                <stop offset="50%" stopColor="#0ea5e9" stopOpacity="0.6" />
                <stop offset="100%" stopColor="#06b6d4" stopOpacity="0.3" />
              </linearGradient>

              <linearGradient id="trailGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#10b981" stopOpacity="0" />
                <stop offset="100%" stopColor="#10b981" stopOpacity="0.5" />
              </linearGradient>

              <filter id="glow">
                <feGaussianBlur stdDeviation="1.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <filter id="dotGlow">
                <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>

              <style>{`
                @keyframes pulse-glow {
                  0%, 100% { r: 3; opacity: 1; }
                  50% { r: 5; opacity: 0.3; }
                }
                @keyframes blink-target {
                  0%, 100% { opacity: 1; }
                  50% { opacity: 0.4; }
                }
                .pulse-glow { animation: pulse-glow 1.5s ease-in-out infinite; }
                .blink-target { animation: blink-target 1s ease-in-out infinite; }
              `}</style>
            </defs>

            <rect x={bounds.minX} y={bounds.minY} width={bounds.width} height={bounds.height} fill="url(#grid-large)" />

            {/* 导航线路 */}
            {isAnimating && toPos && (
              <line
                x1={currentPosition.x}
                y1={currentPosition.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke="url(#navigationGradient)"
                strokeWidth="0.5"
                strokeDasharray="4,6"
                opacity="0.8"
              />
            )}

            {/* 导航轨迹 */}
            {navigationTrail.length > 1 && (
              <polyline
                points={navigationTrail.map(p => `${p.x},${p.y}`).join(' ')}
                fill="none"
                stroke="url(#trailGradient)"
                strokeWidth="0.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity="0.6"
              />
            )}

            {/* 区域点 */}
            {areas.map((area) => {
              if (area.x === undefined || area.y === undefined) return null;

              return (
                <g key={area.id} onClick={() => handleAreaClick(area.id)} style={{ cursor: 'pointer' }}>
                  <circle
                    cx={area.x}
                    cy={area.y}
                    r={selectedArea === area.id ? '1.5' : '1'}
                    fill={selectedArea === area.id ? '#f97316' : '#1f2937'}
                    stroke="#fff"
                    strokeWidth="0.2"
                    filter="url(#dotGlow)"
                  />
                  <text
                    x={area.x}
                    y={area.y + 2}
                    fontSize="1.5"
                    fill="#1e293b"
                    textAnchor="middle"
                    fontWeight="bold"
                    pointerEvents="none"
                    style={{ textShadow: '0 1px 2px rgba(255,255,255,0.8)' }}
                  >
                    {area.name}
                  </text>
                </g>
              );
            })}

            {/* 机器人位置 */}
            {currentPosition && (
              <g
                pointerEvents="none"
                transform={`translate(${currentPosition.x}, ${currentPosition.y}) rotate(${(currentPosition.theta || 0) * 180 / Math.PI})`}
              >
                <g transform="rotate(90)">
                  <path
                    d="M 0 0 L -2.5 -4 A 5 5 0 0 1 2.5 -4 Z"
                    fill="#3b82f6"
                    opacity="0.2"
                  />
                  <path
                    d="M 0 -2 L 1.5 1.5 L 0 0.8 L -1.5 1.5 Z"
                    fill="#dc3545"
                    stroke="#fff"
                    strokeWidth="0.2"
                  />
                </g>
                <circle cx="0" cy="0" r="1.2" fill="#dc3545" stroke="#fff" strokeWidth="0.3" />
                <circle cx="0" cy="0" r="0.5" fill="#fff" opacity="0.8" />
                <text
                  x="0"
                  y="-2.5"
                  fontSize="2"
                  textAnchor="middle"
                  fontWeight="bold"
                  filter={isAnimating ? 'url(#glow)' : 'none'}
                >
                  📍
                </text>
              </g>
            )}

            {/* 目标指示 */}
            {isAnimating && toPos && (
              <g transform={`translate(${toPos.x}, ${toPos.y})`} pointerEvents="none">
                <circle cx="0" cy="0" r="2" fill="#06b6d4" opacity="0.15" className="pulse-glow" />
                <circle
                  cx="0"
                  cy="0"
                  r="1.5"
                  fill="none"
                  stroke="#0ea5e9"
                  strokeWidth="0.3"
                  strokeDasharray="1,1"
                  className="blink-target"
                />
              </g>
            )}
          </svg>
        </div>
      </div>
    </div>
  );
};

export default MapView;