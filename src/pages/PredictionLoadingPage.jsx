import { useEffect, useRef, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { usePropensity } from "../context/PropensityContext";
import { fetchProperties, runPreliminaryPredictions, runFinalPredictions } from "../services/api";

/* ── Icons ────────────────────────────────────────────────────────────────── */
const MapPin      = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>;
const ImageIcon   = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>;
const Target      = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="6"/><circle cx="12" cy="12" r="2"/></svg>;
const ShieldAlert = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>;
const Database    = () => <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>;

const PROCESSING_GIF = "https://media.tenor.com/On7kvXhzmL4AAAAj/loading-gif.gif";
const CANVAS_W = 1550;
const CANVAS_H = 780;

/* ═══════════════════════════════════════════════════════════════════════════
   RUN 1  — Submission Details + Broker + Quote Propensity only
   ═══════════════════════════════════════════════════════════════════════════ */

const R1_DIVISIONS = [
  { id: "div2", label: "Submission Details", nodes: ["submission","exclusion"],                      x: 825, y: 70,  w: 310, h: 250 },
  { id: "div3", label: "Quote Propensity",   nodes: ["riskScore","propensityScore","propensityLevel"],x: 825, y: 370, w: 310, h: 330 },
  { id: "div4", label: "Broker Profiles",    nodes: ["broker"],                                      x: 415, y: 370, w: 310, h: 100 },
];

const R1_NODES = [
  { id: "broker",          label: "Broker Data",                                   icon: Database,    x: 445, y: 410, div: "div4" },
  { id: "submission",      label: "Submission Details",                            icon: Database,    x: 855, y: 110, div: "div2" },
  { id: "exclusion",       label: "Excluding Properties based on configured rules", icon: ShieldAlert, x: 855, y: 210, div: "div2" },
  { id: "riskScore",       label: "Running ML modeling with submission data",      icon: Target,      x: 855, y: 410, div: "div3" },
  { id: "propensityScore", label: "Underwriting Propensity Score",                 icon: Target,      x: 855, y: 520, div: "div3" },
  { id: "propensityLevel", label: "Propensity Level (High/Medium/Low)",            icon: Target,      x: 855, y: 610, div: "div3" },
];

const R1_EDGES = [
  { id: "su-ex",     from: "submission",      to: "exclusion" },
  { id: "rs-ps",     from: "riskScore",       to: "propensityScore" },
  { id: "ps-pl",     from: "propensityScore", to: "propensityLevel" },
  { id: "div2-div3", from: "div2",            to: "div3", isDivEdge: true },
  { id: "div4-div3", from: "div4",            to: "div3", isDivEdge: true },
];

const R1_STEPS = [
  { text: "Loading broker data (past performance)...",       show: ["broker"],           waitTime: 700  },
  { text: "Processing submission details...",                show: ["submission"],        waitTime: 700  },
  { text: "Evaluating property exclusions...",               show: ["exclusion"],         edges: ["su-ex"],                 waitTime: 1000 },
  { text: "Running ML modeling with submission data...",     show: ["riskScore"],         edges: ["div2-div3","div4-div3"], waitTime: 2000 },
  { text: "Evaluating underwriting propensity score...",     show: ["propensityScore"],   edges: ["rs-ps"],                 waitTime: 1800 },
  { text: "Determining propensity level...",                 show: ["propensityLevel"],   edges: ["ps-pl"],                 waitTime: 2500 },
];

function getR1Division(id)  { return R1_DIVISIONS.find(d => d.id === id); }
function getR1NodeOrDiv(id) { return R1_NODES.find(n => n.id === id) || getR1Division(id); }

function generateCurve(fromObj, toObj, divLookup = getR1Division) {
  const fromW = fromObj.w || 250, fromH = fromObj.h || 46;
  const toW   = toObj.w   || 250, toH   = toObj.h   || 46;
  let fromX = fromObj.x, toX = toObj.x;
  if (fromObj.div && toObj.div && fromObj.div !== toObj.div) {
    const fd = divLookup(fromObj.div), td = divLookup(toObj.div);
    if (fd) fromX = fd.x;
    if (td) toX   = td.x;
  }
  const fCX=fromX+fromW/2, fCY=fromObj.y+fromH/2;
  const tCX=toX+toW/2,     tCY=toObj.y+toH/2;
  let startX,startY,endX,endY,startDir,endDir;
  const special={
    "imagery-frontRoof":true,"imagery-threat":true,
    "objectDetect-vulnerability":true,"proximity-vulnerability":true,
  };
  if (special[`${fromObj.id}-${toObj.id}`]) {
    startX=fCX; startY=fromObj.y+fromH; startDir="down";
    endX=tCX;   endY=toObj.y;           endDir="up";
  } else {
    const dx=tCX-fCX, dy=tCY-fCY;
    if (Math.abs(dx)>Math.abs(dy)) {
      if(dx>0){startX=fromX+fromW;startY=fCY;startDir="right";endX=toX;    endY=tCY;endDir="left";}
      else    {startX=fromX;      startY=fCY;startDir="left"; endX=toX+toW;endY=tCY;endDir="right";}
    } else {
      if(dy>0){startX=fCX;startY=fromObj.y+fromH;startDir="down";endX=tCX;endY=toObj.y;    endDir="up";}
      else    {startX=fCX;startY=fromObj.y;       startDir="up";  endX=tCX;endY=toObj.y+toH;endDir="down";}
    }
  }
  const O=60;
  let c1x=startX,c1y=startY,c2x=endX,c2y=endY;
  if(startDir==="left")c1x-=O; if(startDir==="right")c1x+=O;
  if(startDir==="up")  c1y-=O; if(startDir==="down") c1y+=O;
  if(endDir==="left")  c2x-=O; if(endDir==="right")  c2x+=O;
  if(endDir==="up")    c2y-=O; if(endDir==="down")   c2y+=O;
  return `M ${startX} ${startY} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${endX} ${endY}`;
}

/* ═══════════════════════════════════════════════════════════════════════════
   RUN 2  — Full workflow diagram
   ═══════════════════════════════════════════════════════════════════════════ */

const R2_PI_NODES = [
  { id: "address",       label: "Property Address",                                          icon: MapPin,      x: 1080, y: 70  },
  { id: "imagery",       label: "Imagery and spatial data from 10+ leading companies",        icon: ImageIcon,   x: 1080, y: 170 },
  { id: "frontRoof",     label: "Property front and roof images",                             icon: ImageIcon,   x: 930,  y: 290 },
  { id: "objectDetect",  label: "Key roof feature detection using object detection",          icon: Target,      x: 930,  y: 410 },
  { id: "threat",        label: "Proximity to threat zones",                                  icon: ShieldAlert, x: 1200, y: 290 },
  { id: "proximity",     label: "Proximity analysis",                                         icon: MapPin,      x: 1200, y: 410 },
  { id: "vulnerability", label: "Property vulnerability score · Wildfire & hurricane scores", icon: ShieldAlert, x: 1080, y: 530 },
];

const R2_QP_NODES = [
  { id: "riskScore",       label: "Property Risk Score",               icon: Target, x: 425, y: 440 },
  { id: "propensityScore", label: "Underwriting Propensity Score",     icon: Target, x: 425, y: 550 },
  { id: "propensityLevel", label: "Propensity Level (High/Medium/Low)",icon: Target, x: 425, y: 640 },
];

const R2_PI_EDGE_PAIRS = [
  ["address",      "imagery"],
  ["imagery",      "frontRoof"],
  ["imagery",      "threat"],
  ["frontRoof",    "objectDetect"],
  ["threat",       "proximity"],
  ["objectDetect", "vulnerability"],
  ["proximity",    "vulnerability"],
];

const R2_QP_EDGE_PAIRS = [
  ["riskScore", "propensityScore"],
  ["propensityScore", "propensityLevel"],
];

const R2_TIMING = {
  address:         { vis:4,  act:4,  done:5  },
  imagery:         { vis:5,  act:5,  done:6  },
  frontRoof:       { vis:6,  act:6,  done:7  },
  threat:          { vis:6,  act:6,  done:7  },
  objectDetect:    { vis:7,  act:7,  done:8  },
  proximity:       { vis:7,  act:7,  done:8  },
  vulnerability:   { vis:8,  act:8,  done:9  },
  riskScore:       { vis:9,  act:9,  done:10 },
  propensityScore: { vis:10, act:10, done:11 },
  propensityLevel: { vis:11, act:11, done:12 },
};

function r2State(id, step) {
  const t = R2_TIMING[id];
  if (!t || step < t.vis) return null;
  if (step >= t.done) return "completed";
  if (step === t.act) return "active";
  return "idle";
}

const R2_ANIM = [
  { wait: 600,  status: "Analysing first-run results…" },
  { wait: 1000, status: "Routing submissions by propensity tier…" },
  { wait: 1000, status: "Sending Low Propensity to BPO via Intelligent Triage…" },
  { wait: 800,  status: "Initiating Property Insights pipeline…" },
  { wait: 1000, status: "Receiving property address…" },
  { wait: 1800, status: "Fetching imagery and spatial data from 10+ companies…" },
  { wait: 3200, status: "Acquiring front/roof images & analysing threat proximity…" },
  { wait: 2800, status: "Detecting structural features & running proximity analysis…" },
  { wait: 1800, status: "Calculating combined property vulnerability score…" },
  { wait: 2200, status: "Computing property risk score…" },
  { wait: 2000, status: "Evaluating underwriting propensity score…" },
  { wait: 2800, status: "Determining final propensity level…" },
  { wait: 700,  status: "Classification complete — High / Medium / Low" },
];

function Run2Canvas({ animStep }) {
  const s = animStep;
  const findNode = (id) => R2_PI_NODES.find(n=>n.id===id) || R2_QP_NODES.find(n=>n.id===id);

  const NodeEl = ({ id, x, y }) => {
    const state = r2State(id, s);
    if (!state) return null;
    const node = findNode(id);
    const isActive = state === "active";
    const isDone   = state === "completed";
    return (
      <div
        className={`node fade-in ${isActive?"processing":isDone?"completed":""}`}
        style={{ position:"absolute", left:x, top:y }}
      >
        <div className="node-icon-wrapper"><node.icon /></div>
        <div className="node-label">{node.label}</div>
        {isActive && <div className="node-gif"><img src={PROCESSING_GIF} alt="processing" /></div>}
        {isDone && !isActive && (
          <div className="node-gif node-check">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
          </div>
        )}
      </div>
    );
  };

  const eC = (done) => `path-base ${done ? "path-completed":"path-progress-flow"}`;
  const eM = (done) => `url(#${done ? "r2-done":"r2-prog"})`;

  const piEdge = (fromId, toId) => {
    const toT  = R2_TIMING[toId];
    const fromT= R2_TIMING[fromId];
    if (!toT || s < toT.vis) return null;
    const fromObj = findNode(fromId), toObj = findNode(toId);
    if (!fromObj || !toObj) return null;
    const done = s >= toT.done;
    return <path key={`${fromId}-${toId}`} d={generateCurve(fromObj, toObj)} className={eC(done)} markerEnd={eM(done)} />;
  };

  const qpEdge = (fromId, toId) => {
    const toT = R2_TIMING[toId];
    if (!toT || s < toT.vis) return null;
    const fromObj = findNode(fromId), toObj = findNode(toId);
    if (!fromObj || !toObj) return null;
    const done = s >= toT.done;
    return <path key={`${fromId}-${toId}`} d={generateCurve(fromObj, toObj)} className={eC(done)} markerEnd={eM(done)} />;
  };

  return (
    <div style={{ position:"absolute", top:0, left:0, width:CANVAS_W, height:CANVAS_H }}>
      <svg style={{ position:"absolute", width:"100%", height:"100%", pointerEvents:"none" }}>
        <defs>
          <marker id="r2-prog" viewBox="0 0 10 10" markerWidth="4.5" markerHeight="4.5" refX="7" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#3b82f6"/></marker>
          <marker id="r2-done" viewBox="0 0 10 10" markerWidth="4.5" markerHeight="4.5" refX="7" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#2563eb"/></marker>
        </defs>

        {s>=1 && (
          <line x1="308" y1="50" x2="308" y2="710"
            stroke="#d1d5db" strokeWidth="1.5" strokeDasharray="8 5"
          />
        )}
        {s>=2 && <>
          <path d="M 110 100 L 110 430" className={eC(s>=3)} markerEnd={eM(s>=3)} />
          <text x="125" y="265" fill="black" fontSize="14" fontWeight="500">Intelligent Triage</text>
        </>}
        {s>=3 && (
          <path d="M 675 70 L 900 70" className={eC(s>=9)} markerEnd={eM(s>=9)} />
        )}
        {s>=10 && <>
          <path d="M 550 100 L 550 370" className={eC(s>=12)} markerEnd={eM(s>=12)} />
          <text x="560" y="235" fill="black" fontSize="14" fontWeight="500">Preliminary propensity scores</text>
        </>}
        {s>=10 && <>
          <path d="M 1205 576 L 1205 663 L 685 663" className={eC(s>=12)} markerEnd={eM(s>=12)} />
          <text x="945" y="655" fill="black" fontSize="14" fontWeight="500" textAnchor="middle">Property vulnerability scores</text>
        </>}
        {R2_PI_EDGE_PAIRS.map(([f,t]) => piEdge(f, t))}
        {R2_QP_EDGE_PAIRS.map(([f,t]) => qpEdge(f, t))}
      </svg>

      {s>=1 && (
        <div style={{ position:"absolute", left:10, top:-35, whiteSpace:"nowrap" }} className="fade-in">
          <h2 className="text-[17px] font-bold text-gray-800">Triaging Low Propensity Submissions</h2>
        </div>
      )}
      {s>=1 && (
        <div style={{ position:"absolute", left:490, top:-35, whiteSpace:"nowrap" }} className="fade-in">
          <h2 className="text-[17px] font-bold text-gray-800">Vulnerability Assessment and Recalculation of Propensity Levels for Medium/High Propensity Submissions</h2>
        </div>
      )}

      {s>=1 && (
        <div className={`division-box fade-in ${s>=2?"completed":"processing"}`}
             style={{ position:"absolute", left:20, top:40, width:180, height:60, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div className="division-label" style={{ position:"static", fontSize:14 }}>Low Propensity Submissions</div>
        </div>
      )}
      {s>=1 && (
        <div className={`division-box fade-in ${s>=9?"completed":"processing"}`}
             style={{ position:"absolute", left:425, top:40, width:250, height:60, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div className="division-label" style={{ position:"static", fontSize:14 }}>Medium / High Submissions</div>
        </div>
      )}
      {s>=2 && (
        <div className={`division-box fade-in ${s>=3?"completed":"processing"}`}
             style={{ position:"absolute", left:20, top:430, width:180, height:60, display:"flex", alignItems:"center", justifyContent:"center" }}>
          <div className="division-label" style={{ position:"static", fontSize:14 }}>BPO Team</div>
        </div>
      )}
      {s>=3 && (
        <div
          className={`division-box fade-in ${s>=9?"completed":"processing"}`}
          style={{ position:"absolute", left:900, top:30, width:620, height:600 }}
        >
          <div className="division-label">Property Insights</div>
        </div>
      )}
      {R2_PI_NODES.map(n => <NodeEl key={n.id} id={n.id} x={n.x} y={n.y} />)}
      {s>=9 && (
        <div
          className={`division-box fade-in ${s>=12?"completed":"processing"}`}
          style={{ position:"absolute", left:415, top:400, width:270, height:320 }}
        >
          <div className="division-label">Quote Propensity</div>
        </div>
      )}
      {R2_QP_NODES.map(n => <NodeEl key={n.id} id={n.id} x={n.x} y={n.y} />)}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════════ */
export default function PredictionLoadingPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const isRerun  = new URLSearchParams(location.search).get("mode") === "rerun";

  const {
    properties: ctxProperties, setProperties,
    excludedIds,
    run1Properties,
    setRun1Properties, setRun1ShapGlobal,
    setRun2Properties,
    lowThreshold,
  } = usePropensity();

  /* Run 1 state */
  const [visibleNodes,    setVisibleNodes]    = useState([]);
  const [displayTexts,    setDisplayTexts]    = useState({});
  const [activeWaitNodes, setActiveWaitNodes] = useState([]);
  const [completedNodes,  setCompletedNodes]  = useState([]);
  const [statusText,      setStatusText]      = useState("Initializing pipeline…");
  const [r1Finished,      setR1Finished]      = useState(false);

  /* Run 2 state */
  const [animStep,   setAnimStep]   = useState(0);
  const [r2Status,   setR2Status]   = useState(R2_ANIM[0].status);
  const [r2Finished, setR2Finished] = useState(false);

  const [scale, setScale] = useState(1);
  const canvasWrapRef = useRef(null);

  /* Responsive scale */
  useEffect(() => {
    const HEADER_H = 60, PAD = 24;
    const compute = (w, h) => {
      const sx = (w  - PAD*2) / CANVAS_W;
      const sy = (h  - HEADER_H - PAD*2) / CANVAS_H;
      setScale(Math.min(sx, sy, 1));
    };
    compute(window.innerWidth, window.innerHeight);
    if (!canvasWrapRef.current) return;
    const obs = new ResizeObserver(entries => {
      const { width, height } = entries[0].contentRect;
      if (width > 0) compute(width, height);
    });
    obs.observe(canvasWrapRef.current);
    return () => obs.disconnect();
  }, []);

  /* Run 1 typewriter helper */
  const typeText = (step) => new Promise(resolve => {
    let i=0;
    if (step.show?.length>0) setDisplayTexts({});
    const maxLen = step.texts
      ? Math.max(...Object.values(step.texts).map(t=>t.length))
      : (step.text ? step.text.length : 0);
    if (maxLen===0) { setTimeout(resolve, 600); return; }
    const iv = setInterval(() => {
      if (step.show?.length>0) {
        const nxt={};
        if (step.texts) { for(const [nId,txt] of Object.entries(step.texts)) nxt[nId]=txt.slice(0,i); }
        else { step.show.forEach(nId=>{ nxt[nId]=step.text.slice(0,i); }); }
        setDisplayTexts(nxt);
      }
      setStatusText((step.text||(step.texts?Object.values(step.texts)[0]:"")).slice(0,i));
      i++;
      if (i>maxLen) { clearInterval(iv); setTimeout(resolve,600); }
    }, 15);
  });

  const animateEdge = () => new Promise(resolve => {
    let p=0;
    const iv=setInterval(()=>{ p+=4; if(p>=100){clearInterval(iv);resolve();} },15);
  });

  /* Run 1 animation + API call */
  useEffect(() => {
    if (isRerun) return;
    let alive = true;

    // Fire the ML API call concurrently with the animation
    const apiPromise = fetchProperties()
      .then(props => {
        if (alive) setProperties(props);
        return runPreliminaryPredictions(props, {}, {});
      })
      .catch(err => {
        console.warn('Run 1 API failed, using mock data:', err.message);
        return null;
      });

    const run = async () => {
      const done = [];
      for (const step of R1_STEPS) {
        if (!alive) break;
        if (step.show?.length>0) { setActiveWaitNodes(step.show); setVisibleNodes(prev=>[...prev,...step.show]); }
        await typeText(step);
        if (step.edges) await Promise.all(step.edges.map(animateEdge));
        if (step.waitTime) await new Promise(r=>setTimeout(r,step.waitTime));
        if (step.show?.length>0) {
          done.push(...step.show);
          setCompletedNodes([...done]);
          setActiveWaitNodes([]);
        }
      }
      if (alive) {
        // Wait for API to finish before showing "Next"
        const result = await apiPromise;
        if (result && alive) {
          const preds = result.predictions ?? [];
          const locals = result.shap_local ?? [];
          setRun1Properties(preds.map((p, i) => {
            const sl = locals[i] ?? {};
            const shap_values = Object.entries(sl).map(([feature, val]) => ({
              feature,
              val,
              value: p[feature] ?? null
            }));
            return { ...p, shap_local: sl, shap_values };
          }));
          setRun1ShapGlobal(
            (result.shap_global ?? []).map(s => ({ feature: s.feature, contribution: s.mean_abs_shap ?? s.contribution ?? 0 }))
          );
        }
        setR1Finished(true);
      }
    };
    run();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  /* Run 2 animation + API call */
  useEffect(() => {
    if (!isRerun) return;
    let alive = true;

    // Enrich rows with Run 1 preliminary scores before sending
    const rows = ctxProperties.map(base => {
      const r1 = run1Properties.find(p => p.submission_id === base.submission_id);
      return {
        submission_id: base.submission_id,
        address: base.Property_address || base.address || '',
        property_state: base.Property_state || base.state || '',
        quote_propensity: r1?.quote_propensity ?? 0,
        quote_propensity_label: r1?.quote_propensity_label ?? '',
      };
    });
    const apiPromise = runFinalPredictions(rows, excludedIds, {}, {})
      .catch(err => { console.warn('Run 2 API failed:', err.message); return null; });

    const run = async () => {
      for (let i=0; i<R2_ANIM.length; i++) {
        if (!alive) break;
        setAnimStep(i);
        setR2Status(R2_ANIM[i].status);
        await new Promise(r=>setTimeout(r, R2_ANIM[i].wait));
      }
      if (alive) {
        const result = await apiPromise;
        if (result && alive) {
          setRun2Properties(result.predictions ?? []);
        }
        setR2Finished(true);
      }
    };
    run();
    return () => { alive = false; };
  }, []); // eslint-disable-line

  /* ── Render ── */
  return (
    <div className="bg-gray-50 flex flex-col w-full" style={{ minHeight:"100vh", display:"flex", flexDirection:"column", overflow:"hidden" }}>

      {/* Header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between w-full" style={{ flexShrink:0 }}>
        <div className="flex items-center gap-3">
          <div className="h-4 w-px bg-gray-300"/>
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {isRerun ? "Re-Running AI Predictions" : "Running AI Predictions"}
            </h1>
            {!isRerun && (
              <p className="text-xs text-gray-500 mt-0.5">
                Processing initial evaluation pass — Submission Details, Broker Profiles & Quote Propensity
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-3 py-1.5 shadow-sm max-w-md">
          <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse shrink-0"/>
          <p className="text-xs text-gray-600 truncate font-medium">{isRerun ? r2Status : statusText}</p>
        </div>
      </div>

      {/* Scaled canvas */}
      <div ref={canvasWrapRef} style={{ flex:1, display:"flex", alignItems:"flex-start", justifyContent:"center", overflow:"hidden", padding:"40px 12px 12px 12px", position:"relative" }}>

        {/* Run 2 — View Results button */}
        {r2Finished && (
          <div style={{ position:"absolute", bottom:24, right:24, zIndex:50 }} className="fade-in">
            <button
              onClick={() => navigate("/triage")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:-translate-y-0.5 transition-all focus:ring-4 focus:ring-indigo-100"
            >
              View Results
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </div>
        )}

        {/* Run 1 — Next button */}
        {r1Finished && !isRerun && (
          <div style={{ position:"absolute", bottom:24, right:24, zIndex:50 }} className="fade-in">
            <button
              onClick={() => navigate("/prediction-results")}
              className="flex items-center gap-2 bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-lg font-bold shadow-lg hover:-translate-y-0.5 transition-all focus:ring-4 focus:ring-indigo-100"
            >
              Next
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3"/>
              </svg>
            </button>
          </div>
        )}

        <div style={{ width:CANVAS_W*scale, height:CANVAS_H*scale, position:"relative", flexShrink:0 }}>
          <div style={{ position:"absolute", top:0, left:0, width:CANVAS_W, height:CANVAS_H, transform:`scale(${scale})`, transformOrigin:"top left" }}>

            {isRerun ? (
              <Run2Canvas animStep={animStep} />
            ) : (
              <>
                <svg style={{ position:"absolute", width:"100%", height:"100%", pointerEvents:"none" }}>
                  <defs>
                    <marker id="r1-prog" viewBox="0 0 10 10" markerWidth="4.5" markerHeight="4.5" refX="7" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#3b82f6"/></marker>
                    <marker id="r1-done" viewBox="0 0 10 10" markerWidth="4.5" markerHeight="4.5" refX="7" refY="5" orient="auto"><path d="M 0 0 L 10 5 L 0 10 Z" fill="#2563eb"/></marker>
                  </defs>
                  {R1_EDGES.map(edge => {
                    if (edge.isDivEdge) { if (!visibleNodes.includes("riskScore")) return null; }
                    else { if (!visibleNodes.includes(edge.from)||!visibleNodes.includes(edge.to)) return null; }
                    const fromObj=getR1NodeOrDiv(edge.from), toObj=getR1NodeOrDiv(edge.to);
                    if (!fromObj||!toObj) return null;
                    const pathD = generateCurve(fromObj, toObj);
                    let done=false;
                    if (edge.isDivEdge) {
                      const fd=getR1Division(edge.from), td=getR1Division(edge.to);
                      done = fd.nodes.every(n=>completedNodes.includes(n)) && td.nodes.every(n=>completedNodes.includes(n));
                    } else { done=completedNodes.includes(edge.from)&&completedNodes.includes(edge.to); }
                    return (
                      <path key={edge.id} d={pathD}
                        className={`path-base ${done?"path-completed":"path-progress-flow"}`}
                        markerEnd={`url(#${done?"r1-done":"r1-prog"})`}
                      />
                    );
                  })}
                </svg>

                {/* Divisions */}
                {R1_DIVISIONS.map(div => {
                  const isVis  = visibleNodes.some(n=>div.nodes.includes(n));
                  if (!isVis) return null;
                  const isProc = activeWaitNodes.some(n=>div.nodes.includes(n));
                  const isDone = div.nodes.every(n=>completedNodes.includes(n));
                  return (
                    <div key={div.id} className={`division-box fade-in ${isProc?"processing":isDone?"completed":""}`}
                         style={{ left:div.x, top:div.y, width:div.w, height:div.h, position:"absolute" }}>
                      <div className="division-label">{div.label}</div>
                    </div>
                  );
                })}

                {/* Nodes */}
                {R1_NODES.map(node => {
                  if (!visibleNodes.includes(node.id)) return null;
                  const isProc = activeWaitNodes.includes(node.id);
                  const isDone = completedNodes.includes(node.id);
                  return (
                    <div key={node.id} className={`node fade-in ${isProc?"processing":isDone?"completed":""}`}
                         style={{ left:node.x, top:node.y, position:"absolute" }}>
                      <div className="node-icon-wrapper"><node.icon /></div>
                      <div className="node-label">{isProc?(displayTexts[node.id]||""):node.label}</div>
                      {isProc && <div className="node-gif"><img src={PROCESSING_GIF} alt="processing"/></div>}
                      {isDone && !isProc && (
                        <div className="node-gif node-check">
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg>
                        </div>
                      )}
                    </div>
                  );
                })}
              </>
            )}

          </div>
        </div>
      </div>
    </div>
  );
}
