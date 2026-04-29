import { useEffect, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

/* --- Icons --- */
const MapPin = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>;
const ImageIcon = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><circle cx="8.5" cy="8.5" r="1.5"></circle><polyline points="21 15 16 10 5 21"></polyline></svg>;
const Target = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"></circle><circle cx="12" cy="12" r="6"></circle><circle cx="12" cy="12" r="2"></circle></svg>;
const ShieldAlert = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></svg>;
const Database = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>;

const PROCESSING_GIF = "https://media.tenor.com/On7kvXhzmL4AAAAj/loading-gif.gif";

/* --- Canvas size that all x/y coordinates are based on --- */
const CANVAS_W = 1600;
const CANVAS_H = 780;

/* ---------------- NODES & DIVISIONS ---------------- */
const DIVISIONS = [
  { id: "div1", label: "Property Insights", nodes: ["address", "imagery", "frontRoof", "objectDetect", "threat", "proximity", "vulnerability"], x: 90, y: 110, w: 610, h: 630 },
  { id: "div2", label: "Submission Details", nodes: ["submission", "exclusion"], x: 790, y: 110, w: 310, h: 250 },
  { id: "div3", label: "Quote Propensity", nodes: ["riskScore", "propensityScore", "propensityLevel"], x: 790, y: 410, w: 310, h: 330 },
  { id: "div4", label: "Broker Profiles", nodes: ["broker"], x: 1190, y: 410, w: 310, h: 100 }
];

const nodes = [
  /* Division 1 */
  { id: "address", label: "Property Address", icon: MapPin, x: 270, y: 150, div: "div1" },
  { id: "imagery", label: "Imagery and spatial data from 10+ leading companies", icon: ImageIcon, x: 270, y: 250, div: "div1" },
  { id: "frontRoof", label: "Property front and roof images", icon: ImageIcon, x: 120, y: 370, div: "div1" },
  { id: "objectDetect", label: "Key roof feature detection using object detection algorithms", icon: Target, x: 120, y: 490, div: "div1" },
  { id: "threat", label: "Proximity to threat zones", icon: ShieldAlert, x: 420, y: 370, div: "div1" },
  { id: "proximity", label: "Proximity analysis", icon: MapPin, x: 420, y: 490, div: "div1" },
  {
    id: "vulnerability",
    label: (
      <div style={{ textAlign: "left", lineHeight: "1.4" }}>
        <ul style={{ margin: 0, paddingLeft: "15px" }}>
          <li>Property vulnerability score</li>
          <li>Wildfire and hurricane scores</li>
        </ul>
      </div>
    ),
    icon: ShieldAlert, x: 270, y: 610, div: "div1"
  },

  /* Division 4 */
  { id: "broker", label: "Broker Data", icon: Database, x: 1220, y: 450, div: "div4" },

  /* Division 2 */
  { id: "submission", label: "Submission Details", icon: Database, x: 820, y: 150, div: "div2" },
  { id: "exclusion", label: "Excluding Properties based on configured rules", icon: ShieldAlert, x: 820, y: 250, div: "div2" },

  /* Division 3 */
  { id: "riskScore", label: "Property Risk Score", icon: Target, x: 820, y: 450, div: "div3" },
  { id: "propensityScore", label: "Underwriting Propensity Score", icon: Target, x: 820, y: 560, div: "div3" },
  { id: "propensityLevel", label: "Propensity Level (High/Medium/Low)", icon: Target, x: 820, y: 650, div: "div3" },
];

/* ---------------- EDGES ---------------- */
const edges = [
  { id: "a-i", from: "address", to: "imagery" },
  { id: "i-fr", from: "imagery", to: "frontRoof" },
  { id: "fr-od", from: "frontRoof", to: "objectDetect" },
  { id: "i-th", from: "imagery", to: "threat" },
  { id: "th-pr", from: "threat", to: "proximity" },
  { id: "od-v", from: "objectDetect", to: "vulnerability" },
  { id: "pr-v", from: "proximity", to: "vulnerability" },
  { id: "su-ex", from: "submission", to: "exclusion" },
  { id: "rs-ps", from: "riskScore", to: "propensityScore" },
  { id: "ps-pl", from: "propensityScore", to: "propensityLevel" },
  { id: "div1-div3", from: "div1", to: "div3", isDivEdge: true },
  { id: "div2-div3", from: "div2", to: "div3", isDivEdge: true },
  { id: "div4-div3", from: "div4", to: "div3", isDivEdge: true },
];

/* ---------------- STEPS ---------------- */
const steps = [
  { text: "Receiving property address...", show: ["address"], waitTime: 1000 },
  { text: "Fetching Imagery and spatial data from 10+ leading companies...", show: ["imagery"], edges: ["a-i"], waitTime: 2000 },
  { texts: { frontRoof: "Acquiring property front & roof images...", threat: "Analyzing proximity to threat zones..." }, show: ["frontRoof", "threat"], edges: ["i-fr", "i-th"], waitTime: 4000 },
  { texts: { objectDetect: "Detecting key structural features...", proximity: "Running proximity analysis..." }, show: ["objectDetect", "proximity"], edges: ["fr-od", "th-pr"], waitTime: 3000 },
  { text: "Calculating combined property vulnerability score...", show: ["vulnerability"], edges: ["od-v", "pr-v"], waitTime: 1800 },
  { text: "Loading broker data (past performance)...", show: ["broker"], waitTime: 600 },
  { text: "Processing submission details...", show: ["submission"], waitTime: 600 },
  { text: "Evaluating property exclusions...", show: ["exclusion"], edges: ["su-ex"], waitTime: 1000 },
  { text: "Computing property risk score...", show: ["riskScore"], edges: ["div1-div3", "div2-div3", "div4-div3"], waitTime: 2500 },
  { text: "Evaluating underwriting propensity score...", show: ["propensityScore"], edges: ["rs-ps"], waitTime: 2200 },
  { text: "Determining propensity level...", show: ["propensityLevel"], edges: ["ps-pl"], waitTime: 4000 },
];

/* ---------------- HELPERS ---------------- */
function getDivision(id) { return DIVISIONS.find(d => d.id === id); }
function getNodeOrDiv(id) { return nodes.find(n => n.id === id) || getDivision(id); }

function generateCurve(fromObj, toObj) {
  const fromW = fromObj.w || 250;
  const fromH = fromObj.h || 46;
  const toW = toObj.w || 250;
  const toH = toObj.h || 46;

  let fromX = fromObj.x, fromY = fromObj.y;
  let toX = toObj.x, toY = toObj.y;

  if (fromObj.div && toObj.div && fromObj.div !== toObj.div) {
    fromX = getDivision(fromObj.div).x;
    toX = getDivision(toObj.div).x;
  }

  const fCX = fromX + fromW / 2, fCY = fromY + fromH / 2;
  const tCX = toX + toW / 2, tCY = toY + toH / 2;

  let startX, startY, endX, endY, startDir, endDir;

  const special = {
    "imagery-frontRoof": true, "imagery-threat": true,
    "objectDetect-vulnerability": true, "proximity-vulnerability": true,
  };

  const key = `${fromObj.id}-${toObj.id}`;
  if (special[key]) {
    startX = fCX; startY = fromY + fromH; startDir = "down";
    endX = tCX; endY = toY; endDir = "up";
  } else {
    const dx = tCX - fCX, dy = tCY - fCY;
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > 0) { startX = fromX + fromW; startY = fCY; startDir = "right"; endX = toX; endY = tCY; endDir = "left"; }
      else { startX = fromX; startY = fCY; startDir = "left"; endX = toX + toW; endY = tCY; endDir = "right"; }
    } else {
      if (dy > 0) { startX = fCX; startY = fromY + fromH; startDir = "down"; endX = tCX; endY = toY; endDir = "up"; }
      else { startX = fCX; startY = fromY; startDir = "up"; endX = tCX; endY = toY + toH; endDir = "down"; }
    }
  }

  const OFF = 60;
  let c1x = startX, c1y = startY, c2x = endX, c2y = endY;
  if (startDir === "left") c1x -= OFF; if (startDir === "right") c1x += OFF;
  if (startDir === "up") c1y -= OFF; if (startDir === "down") c1y += OFF;
  if (endDir === "left") c2x -= OFF; if (endDir === "right") c2x += OFF;
  if (endDir === "up") c2y -= OFF; if (endDir === "down") c2y += OFF;

  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
}

/* ================================================================ */
export default function PipelineAnimation() {
  const navigate = useNavigate();
  const location = useLocation();
  const submissionId = location.state?.submissionId;

  const [visibleNodes, setVisibleNodes] = useState([]);
  // edgeProgress removed — edges animate via CSS class, no value needed
  const [displayTexts, setDisplayTexts] = useState({});
  const [activeWaitNodes, setActiveWaitNodes] = useState([]);
  const [completedNodes, setCompletedNodes] = useState([]);
  const [scale, setScale] = useState(1);

  /* --- compute scale on mount and resize --- */
  useEffect(() => {
    const HEADER_H = 60;
    const PADDING = 24;

    function computeScale() {
      const availW = window.innerWidth - PADDING * 2;
      const availH = window.innerHeight - HEADER_H - PADDING * 2;
      const sx = availW / CANVAS_W;
      const sy = availH / CANVAS_H;
      setScale(Math.min(sx, sy, 1));
    }

    computeScale();
    window.addEventListener("resize", computeScale);
    return () => window.removeEventListener("resize", computeScale);
  }, []);

  /* --- typewriter --- */
  const typeText = (step) => new Promise(resolve => {
    let i = 0;
    if (step.show?.length > 0) setDisplayTexts({});
    const maxLen = step.texts
      ? Math.max(...Object.values(step.texts).map(t => t.length))
      : (step.text ? step.text.length : 0);

    if (maxLen === 0) { setTimeout(resolve, 600); return; }

    const iv = setInterval(() => {
      if (step.show?.length > 0) {
        const nxt = {};
        if (step.texts) { for (const [nId, txt] of Object.entries(step.texts)) nxt[nId] = txt.slice(0, i); }
        else { step.show.forEach(nId => { nxt[nId] = step.text.slice(0, i); }); }
        setDisplayTexts(nxt);
      }
      i++;
      if (i > maxLen) { clearInterval(iv); setTimeout(resolve, 600); }
    }, 15);
  });

  /* --- edge draw (timing only — visual handled by CSS class) --- */
  const animateEdge = (id) => new Promise(resolve => {
    let p = 0;
    const iv = setInterval(() => {
      p += 4;
      if (p >= 100) { clearInterval(iv); resolve(); }
    }, 15);
  });

  /* --- main flow --- */
  const runFlow = async () => {
    for (const step of steps) {
      if (step.show?.length > 0) {
        setActiveWaitNodes(step.show);
        setVisibleNodes(prev => [...prev, ...step.show]);
      }
      await typeText(step);
      if (step.edges) await Promise.all(step.edges.map(animateEdge));
      if (step.waitTime) await new Promise(r => setTimeout(r, step.waitTime));
      if (step.show?.length > 0) setCompletedNodes(prev => [...prev, ...step.show]);
    }
    setActiveWaitNodes([]);
    await new Promise(r => setTimeout(r, 2500));
    navigate('/comparison', { state: { submissionId } });
  };

  // ✅ useEffect placed AFTER runFlow declaration to avoid ReferenceError
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { runFlow(); }, []);

  /* ================================================================ */
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/30 to-slate-50" style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* Shared header — matches TriagePage, DecisionComparison, etc. */}
      <div className="bg-white/80 backdrop-blur-sm border-b border-gray-200/50" style={{ flexShrink: 0 }}>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/')}
              title="Home"
              className="text-gray-400 hover:text-blue-600 transition-colors flex-shrink-0"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
              </svg>
            </button>
            <div>
              <h1 className="text-xl font-bold text-gray-900">AI Risk Intelligence Pipeline</h1>
              <p className="text-xs text-gray-500 mt-0.5">Processing multi-layer underwriting signals in real time.</p>
            </div>
          </div>
          <button
            onClick={() => navigate(-1)}
            className="flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-blue-600 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Back
          </button>
        </div>
      </div>

      {/* Scaled canvas wrapper — centres the diagram and scales it to fit */}
      <div style={{
        flex: 1,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
        padding: 12,
      }}>
        {/*
          Two-layer trick:
          - Outer div has the VISUAL (scaled) dimensions → flexbox centres this correctly
          - Inner div is the full canvas, scaled from top-left origin
        */}
        <div style={{
          width: CANVAS_W * scale,
          height: CANVAS_H * scale,
          position: 'relative',
          flexShrink: 0,
        }}>
          <div style={{
            position: 'absolute',
            top: 0, left: 0,
            width: CANVAS_W,
            height: CANVAS_H,
            transform: `scale(${scale})`,
            transformOrigin: 'top left',
          }}>

            {/* SVG edges */}
            <svg style={{ position: 'absolute', width: '100%', height: '100%', pointerEvents: 'none' }}>
              <defs>
                <marker id="arrowhead-progress" viewBox="0 0 10 10" markerWidth="4.5" markerHeight="4.5" refX="7" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#3b82f6" /></marker>
                <marker id="arrowhead-completed" viewBox="0 0 10 10" markerWidth="4.5" markerHeight="4.5" refX="7" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#2563eb" /></marker>
              </defs>

              {edges.map(edge => {
                if (edge.isDivEdge) {
                  if (!visibleNodes.includes("riskScore")) return null;
                } else {
                  if (!visibleNodes.includes(edge.from) || !visibleNodes.includes(edge.to)) return null;
                }

                const fromObj = getNodeOrDiv(edge.from);
                const toObj = getNodeOrDiv(edge.to);
                if (!fromObj || !toObj) return null;

                const pathD = generateCurve(fromObj, toObj);

                let isCompleted = false;
                if (edge.isDivEdge) {
                  const fd = getDivision(edge.from), td = getDivision(edge.to);
                  isCompleted = fd.nodes.every(n => completedNodes.includes(n)) &&
                    td.nodes.every(n => completedNodes.includes(n));
                } else {
                  isCompleted = completedNodes.includes(edge.from) && completedNodes.includes(edge.to);
                }

                return (
                  <path
                    key={edge.id}
                    d={pathD}
                    className={`path-base ${isCompleted ? 'path-completed' : 'path-progress-flow'}`}
                    markerEnd={`url(#${isCompleted ? 'arrowhead-completed' : 'arrowhead-progress'})`}
                  />
                );
              })}
            </svg>

            {/* Divisions */}
            {DIVISIONS.map(div => {
              const isVisible = visibleNodes.some(n => div.nodes.includes(n));
              if (!isVisible) return null;
              const isProcessing = activeWaitNodes.some(n => div.nodes.includes(n));
              const isCompleted = div.nodes.every(n => completedNodes.includes(n));

              return (
                <div
                  key={div.id}
                  className={`division-box fade-in ${isProcessing ? 'processing' : isCompleted ? 'completed' : ''}`}
                  style={{ left: div.x, top: div.y, width: div.w, height: div.h, position: 'absolute' }}
                >
                  <div className="division-label">{div.label}</div>
                </div>
              );
            })}

            {/* Nodes */}
            {nodes.map(node => {
              const isVisible = visibleNodes.includes(node.id);
              if (!isVisible) return null;
              const isProcessing = activeWaitNodes.includes(node.id);
              const isCompleted = completedNodes.includes(node.id);

              return (
                <div
                  key={node.id}
                  className={`node fade-in ${isProcessing ? 'processing' : isCompleted ? 'completed' : ''}`}
                  style={{ left: node.x, top: node.y, position: 'absolute' }}
                >
                  <div className="node-icon-wrapper"><node.icon /></div>
                  <div className="node-label">
                    {isProcessing ? (displayTexts[node.id] || "") : node.label}
                  </div>
                  {isProcessing && (
                    <div className="node-gif"><img src={PROCESSING_GIF} alt="processing" /></div>
                  )}
                  {isCompleted && !isProcessing && (
                    <div className="node-gif node-check">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                  )}
                </div>
              );
            })}

          </div>{/* end inner scaled canvas */}
        </div>{/* end outer sized wrapper */}

      </div>{/* end flex centering container */}
    </div>
  );
}
