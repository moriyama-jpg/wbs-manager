import { useState, useCallback, useRef, useEffect } from 'react'
import {
  supabase,
  fetchProjects, createProject, updateProject, deleteProject, subscribeProjects,
} from './lib/supabase'

const PHASE_COLORS = ['#1B5FAD','#0F7B5A','#6B4EA6','#B45309','#0E6B8A','#7C3B3B']
const FM = "'JetBrains Mono','Fira Code','Courier New',monospace"
const C = {
  bg:'#F2F5F9', surface:'#FFFFFF', surfaceAlt:'#F7F9FC', hover:'#EEF3FA',
  border:'#DDE3EC', borderMd:'#C4CCDA',
  accent:'#1B5FAD', accentBg:'#EBF2FC', accentHov:'#154D90',
  text:'#1A2540', textSub:'#4B5A72', textMuted:'#8A97AA',
  success:'#0F7B5A', successBg:'#ECFAF5',
  warning:'#A05C07', warningBg:'#FFF8EC',
  danger:'#B91C1C', dangerBg:'#FEF2F2',
  done:'#B0B8C8', doneBg:'#F0F2F5',
  shadow:'0 1px 3px rgba(26,37,64,0.08)',
  shadowMd:'0 4px 16px rgba(26,37,64,0.10)',
}
const STATUS = {
  planning:{label:'企画中',color:C.warning,bg:C.warningBg,dot:'#E9A835'},
  active:  {label:'進行中',color:C.accent, bg:C.accentBg, dot:C.accent},
  review:  {label:'レビュー中',color:'#6B4EA6',bg:'#F5F0FF',dot:'#6B4EA6'},
  done:    {label:'完了',color:C.success,bg:C.successBg,dot:C.success},
  hold:    {label:'保留',color:C.textMuted,bg:C.surfaceAlt,dot:C.textMuted},
}

const newId = () => Math.random().toString(36).slice(2, 9)
const fmtDate = d => new Date(d).toLocaleDateString('ja-JP',{month:'short',day:'numeric'})

function parseDate(str) {
  if (!str) return null
  const m = str.match(/(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/)
  if (!m) return null
  return new Date(+m[1], +m[2]-1, +m[3])
}
function dateDiff(a, b) {
  if (!a || !b) return 0
  return Math.max(0, Math.round((b - a) / 86400000))
}

function countStats(phases=[]) {
  return {
    phases: phases.length,
    tasks:    phases.reduce((s,ph)=>s+(ph.tasks?.length||0),0),
    subtasks: phases.reduce((a,ph)=>(ph.tasks||[]).reduce((b,tk)=>b+(tk.subtasks?.length||0),a),0),
    done:     phases.reduce((a,ph)=>(ph.tasks||[]).reduce((b,tk)=>b+(tk.subtasks||[]).filter(s=>s.done).length,a),0),
    totalSubs:phases.reduce((a,ph)=>(ph.tasks||[]).reduce((b,tk)=>b+(tk.subtasks?.length||0),a),0),
  }
}
function parseDays(str) {
  if (!str) return 5
  const m = str.match(/(\d+)/); if(!m) return 5
  const n = parseInt(m[1])
  if(/週|week/i.test(str)) return n*5
  if(/ヶ月|ヵ月|month/i.test(str)) return n*20
  return n
}
function toCSV(phases) {
  const rows = []
  phases.forEach((ph,pi)=>{
    rows.push([`${pi+1}`,'フェーズ',ph.name,ph.owner||'',ph.duration||'',ph.done?'完了':''])
    ;(ph.tasks||[]).forEach((tk,ti)=>{
      rows.push([`${pi+1}.${ti+1}`,'タスク',tk.name,tk.owner||'',tk.duration||'',tk.done?'完了':'',tk.memo||''])
      ;(tk.subtasks||[]).forEach((st,si)=>
        rows.push([`${pi+1}.${ti+1}.${si+1}`,'サブタスク',st.name,st.owner||'',st.duration||'',st.done?'完了':'',st.memo||''])
      )
    })
  })
  return 'WBSコード,レベル,タスク名,担当者,期間,状態,メモ\n'+rows.map(r=>r.map(v=>`"${v}"`).join(',')).join('\n')
}

// ── UI Parts ──────────────────────────────────────────────────────────────────
function Spinner({size=32}) {
  return (
    <div style={{display:'flex',flexDirection:'column',alignItems:'center',padding:'60px 0',gap:14}}>
      <div style={{width:size,height:size,border:`3px solid ${C.border}`,borderTop:`3px solid ${C.accent}`,borderRadius:'50%',animation:'spin 0.8s linear infinite'}}/>
      <div style={{fontFamily:FM,fontSize:11,color:C.textMuted,letterSpacing:'0.15em'}}>AIがWBSを分析中...</div>
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  )
}

function Badge({color,children,small}) {
  return <span style={{background:color+'18',color,border:`1px solid ${color}35`,borderRadius:3,padding:small?'1px 5px':'1px 7px',fontSize:small?9:10,fontFamily:FM,fontWeight:600}}>{children}</span>
}

function StatusBadge({status,onChange}) {
  const s = STATUS[status]||STATUS.planning
  const [open,setOpen] = useState(false)
  return (
    <div style={{position:'relative',display:'inline-block'}} onClick={e=>e.stopPropagation()}>
      <button onClick={()=>setOpen(o=>!o)} style={{display:'flex',alignItems:'center',gap:5,background:s.bg,border:`1px solid ${s.color}40`,color:s.color,borderRadius:20,padding:'3px 10px',cursor:onChange?'pointer':'default',fontSize:11,fontWeight:600,lineHeight:1.4}}>
        <span style={{width:6,height:6,borderRadius:'50%',background:s.dot,flexShrink:0}}/>
        {s.label}{onChange&&<span style={{fontSize:9,opacity:0.7}}>▾</span>}
      </button>
      {open&&onChange&&(
        <div style={{position:'absolute',top:'calc(100% + 4px)',left:0,background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,boxShadow:C.shadowMd,zIndex:200,minWidth:110,overflow:'hidden'}}>
          {Object.entries(STATUS).map(([k,v])=>(
            <button key={k} onClick={()=>{onChange(k);setOpen(false)}} style={{display:'flex',alignItems:'center',gap:7,width:'100%',background:status===k?C.accentBg:'transparent',border:'none',padding:'8px 12px',cursor:'pointer',fontSize:12,color:status===k?C.accent:C.text}}
              onMouseEnter={e=>e.currentTarget.style.background=C.hover}
              onMouseLeave={e=>e.currentTarget.style.background=status===k?C.accentBg:'transparent'}
            ><span style={{width:7,height:7,borderRadius:'50%',background:v.dot,flexShrink:0}}/>{v.label}</button>
          ))}
        </div>
      )}
    </div>
  )
}

function Checkbox({checked,onChange,disabled}) {
  return (
    <div onClick={e=>{e.stopPropagation();if(!disabled)onChange(!checked)}} style={{
      width:16,height:16,borderRadius:3,border:`2px solid ${checked?C.success:C.borderMd}`,
      background:checked?C.success:'transparent',display:'flex',alignItems:'center',justifyContent:'center',
      cursor:disabled?'not-allowed':'pointer',flexShrink:0,transition:'all 0.15s',
    }}>
      {checked&&<span style={{color:'#fff',fontSize:10,lineHeight:1,fontWeight:700}}>✓</span>}
    </div>
  )
}

function IconBtn({children,onClick,title,danger,disabled}) {
  const [hov,setHov] = useState(false)
  if(disabled) return null
  return (
    <button title={title} onClick={onClick}
      style={{background:hov?(danger?C.dangerBg:C.accentBg):'transparent',border:`1px solid ${hov?(danger?C.danger:C.accent):C.border}`,color:hov?(danger?C.danger:C.accent):(danger?C.danger:C.textMuted),borderRadius:3,width:22,height:22,fontSize:11,cursor:'pointer',display:'flex',alignItems:'center',justifyContent:'center',transition:'all 0.15s',padding:0,flexShrink:0}}
      onMouseEnter={()=>setHov(true)} onMouseLeave={()=>setHov(false)}
    >{children}</button>
  )
}
function RowActions({onEdit,onAdd,onDelete,addLabel,done}) {
  if(done) return null
  return (
    <div style={{display:'flex',gap:3}} onClick={e=>e.stopPropagation()}>
      <IconBtn title="編集" onClick={onEdit}>✎</IconBtn>
      {onAdd&&<IconBtn title={addLabel} onClick={onAdd}>＋</IconBtn>}
      <IconBtn title="削除" onClick={onDelete} danger>✕</IconBtn>
    </div>
  )
}
const addBtnStyle={background:'transparent',border:`1px dashed ${C.border}`,color:C.textMuted,borderRadius:3,padding:'5px 14px',fontSize:11,cursor:'pointer',marginTop:3,fontFamily:'inherit',transition:'all 0.15s',display:'block',width:'100%',textAlign:'left'}
function Field({label,children}) {
  return <div style={{marginBottom:14}}><label style={{display:'block',fontFamily:FM,fontSize:9,color:C.textMuted,letterSpacing:'0.15em',marginBottom:5}}>{label}</label>{children}</div>
}
const inputStyle={width:'100%',background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:4,padding:'9px 12px',color:C.text,fontSize:13,outline:'none',fontFamily:'inherit',transition:'border-color 0.15s'}

function MiniGantt({phases}) {
  if(!phases?.length) return null
  const totals=phases.map(ph=>(ph.tasks||[]).reduce((s,t)=>s+parseDays(t.duration),0)||parseDays(ph.duration)||8)
  const grand=totals.reduce((a,b)=>a+b,0)||1
  return (
    <div style={{display:'flex',height:8,borderRadius:4,overflow:'hidden',gap:1,margin:'10px 0 4px'}}>
      {phases.map((ph,i)=><div key={ph.id} style={{width:`${(totals[i]/grand)*100}%`,background:ph.done?C.done:PHASE_COLORS[i%PHASE_COLORS.length],borderRadius:2,minWidth:2}} title={ph.name}/>)}
    </div>
  )
}

function EditModal({item,onSave,onClose}) {
  const [name,setName]=useState(item.name||'')
  const [duration,setDuration]=useState(item.duration||'')
  const [owner,setOwner]=useState(item.owner||'')
  return (
    <div style={{position:'fixed',inset:0,background:'rgba(26,37,64,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:2000,backdropFilter:'blur(2px)'}} onClick={onClose}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:28,width:420,maxWidth:'90vw',boxShadow:C.shadowMd}} onClick={e=>e.stopPropagation()}>
        <div style={{fontFamily:FM,fontSize:10,color:C.accent,marginBottom:16,letterSpacing:'0.2em'}}>EDIT ITEM</div>
        {[['タスク名 *',name,setName],['期間（例: 3日、2週間）',duration,setDuration],['担当者',owner,setOwner]].map(([l,v,s])=>(
          <Field key={l} label={l}><input value={v} onChange={e=>s(e.target.value)} style={inputStyle} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/></Field>
        ))}
        <div style={{display:'flex',gap:8,marginTop:20,justifyContent:'flex-end'}}>
          <button onClick={onClose} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:5,padding:'8px 18px',cursor:'pointer',fontSize:13}}>キャンセル</button>
          <button onClick={()=>onSave({name,duration,owner})} disabled={!name.trim()} style={{background:C.accent,border:'none',color:'#fff',borderRadius:5,padding:'8px 22px',cursor:'pointer',fontSize:13,fontWeight:700,opacity:name.trim()?1:0.5}}>保存</button>
        </div>
      </div>
    </div>
  )
}

// ── TREE VIEW ─────────────────────────────────────────────────────────────────
function TreeView({phases,onEdit,onAdd,onDelete,onMove,onToggleDone}) {
  const [collapsed,setCollapsed]=useState({})
  const toggle=id=>setCollapsed(p=>({...p,[id]:!p[id]}))
  const dragSrc=useRef(null)
  const [dropTarget,setDropTarget]=useState(null)
  const [dragging,setDragging]=useState(false)

  const startDrag=(e,src)=>{
    dragSrc.current=src;setDragging(true);e.dataTransfer.effectAllowed='move'
    const g=e.currentTarget.cloneNode(true)
    g.style.cssText='position:fixed;top:-999px;background:#fff;border:1px solid #c4ccda;border-radius:4px;padding:6px 12px;font-size:12px;pointer-events:none;max-width:300px;box-shadow:0 4px 12px rgba(0,0,0,.15)'
    document.body.appendChild(g);e.dataTransfer.setDragImage(g,0,0);setTimeout(()=>document.body.removeChild(g),0)
  }
  const endDrag=()=>{dragSrc.current=null;setDragging(false);setDropTarget(null)}
  const pos=(e,el)=>{const r=el.getBoundingClientRect();return(e.clientY-r.top)/r.height<0.5?'before':'after'}
  const isSelf=(s,t)=>{
    if(!s)return false
    if(s.type==='task'&&t.type==='task')return s.pi===t.pi&&s.ti===t.ti
    if(s.type==='subtask'&&t.type==='subtask')return s.pi===t.pi&&s.ti===t.ti&&s.si===t.si
    return false
  }
  const drop=(e,tgt)=>{e.preventDefault();const s=dragSrc.current;if(!s||isSelf(s,tgt))return;onMove(s,{...tgt,pos:pos(e,e.currentTarget)});setDropTarget(null)}
  const dropInto=(e,tgt)=>{e.preventDefault();const s=dragSrc.current;if(!s||s.type!=='subtask')return;onMove(s,{...tgt,type:'task',pos:'into'});setDropTarget(null)}
  const dline=color=>({position:'absolute',left:0,right:0,height:2,background:color||C.accent,borderRadius:2,zIndex:10,boxShadow:`0 0 4px ${(color||C.accent)}80`})

  return (
    <div style={{userSelect:dragging?'none':'auto'}}>
      <style>{`.dh{opacity:0;transition:opacity .15s;cursor:grab;color:${C.textMuted};font-size:14px;padding:0 4px 0 0;user-select:none}.dh:active{cursor:grabbing}.dr:hover .dh{opacity:1}.dr.dg{opacity:0.4}.add-row:hover{background:${C.accentBg}!important;border-color:${C.accent}!important;color:${C.accent}!important}.done-row{opacity:0.55}`}</style>
      {phases.map((ph,pi)=>{
        const pc=PHASE_COLORS[pi%PHASE_COLORS.length]
        const dph=dropTarget?.type==='phase-into'&&dropTarget.pi===pi
        return(
          <div key={ph.id} style={{marginBottom:8}}>
            <div style={{display:'flex',alignItems:'center',gap:9,background:ph.done?C.doneBg:dph?C.accentBg:C.surface,border:`1px solid ${dph?pc:C.border}`,borderLeft:`4px solid ${ph.done?C.done:pc}`,borderRadius:5,padding:'9px 13px',cursor:'pointer',boxShadow:C.shadow,transition:'all .15s'}}
              onClick={()=>toggle(ph.id)}
              onMouseEnter={e=>e.currentTarget.style.background=ph.done?C.doneBg:C.surfaceAlt}
              onMouseLeave={e=>e.currentTarget.style.background=ph.done?C.doneBg:dph?C.accentBg:C.surface}
              onDragOver={e=>{if(dragSrc.current?.type==='task'){e.preventDefault();setDropTarget({type:'phase-into',pi})}}}
              onDragLeave={()=>setDropTarget(null)}
              onDrop={e=>{e.preventDefault();const s=dragSrc.current;if(s?.type==='task')onMove(s,{type:'task',pi,ti:(phases[pi].tasks||[]).length,pos:'after'});setDropTarget(null)}}
            >
              <Checkbox checked={!!ph.done} onChange={v=>onToggleDone('phase',pi,null,null,v)}/>
              <span style={{fontFamily:FM,fontSize:10,color:ph.done?C.done:pc,minWidth:18}}>{collapsed[ph.id]?'▶':'▼'}</span>
              <Badge color={ph.done?C.done:pc}>{pi+1}</Badge>
              <span style={{fontWeight:700,fontSize:13,flex:1,color:ph.done?C.done:C.text,textDecoration:ph.done?'line-through':'none'}}>{ph.name}</span>
              {ph.duration&&<span style={{fontSize:11,color:C.textMuted,fontFamily:FM}}>⏱ {ph.duration}</span>}
              {ph.owner&&<span style={{fontSize:11,color:C.textSub}}>👤 {ph.owner}</span>}
              <RowActions done={ph.done} onEdit={()=>onEdit('phase',pi)} onAdd={()=>onAdd('task',pi)} onDelete={()=>onDelete('phase',pi)} addLabel="タスク追加"/>
            </div>
            {!collapsed[ph.id]&&(
              <div style={{marginLeft:18,marginTop:2}}>
                {(ph.tasks||[]).map((tk,ti)=>{
                  const dThis=dragging&&dragSrc.current?.type==='task'&&dragSrc.current.pi===pi&&dragSrc.current.ti===ti
                  const dt=dropTarget
                  const dBefore=dt?.type==='task'&&dt.pi===pi&&dt.ti===ti&&dt.pos==='before'
                  const dAfter=dt?.type==='task'&&dt.pi===pi&&dt.ti===ti&&dt.pos==='after'
                  const dInto=dt?.type==='task-into'&&dt.pi===pi&&dt.ti===ti
                  return(
                    <div key={tk.id} style={{marginBottom:2,position:'relative'}}>
                      {dBefore&&<div style={{...dline(pc),top:-1}}/>}
                      <div className={`dr${dThis?' dg':''}${tk.done?' done-row':''}`} draggable={!tk.done} onDragStart={e=>startDrag(e,{type:'task',pi,ti})} onDragEnd={endDrag}
                        onDragOver={e=>{e.preventDefault();if(dragSrc.current?.type==='task')setDropTarget({type:'task',pi,ti,pos:pos(e,e.currentTarget)});else if(dragSrc.current?.type==='subtask')setDropTarget({type:'task-into',pi,ti})}}
                        onDragLeave={()=>setDropTarget(null)}
                        onDrop={e=>{if(dragSrc.current?.type==='task')drop(e,{type:'task',pi,ti});else if(dragSrc.current?.type==='subtask')dropInto(e,{pi,ti})}}
                        style={{display:'flex',alignItems:'center',gap:8,background:tk.done?C.doneBg:dInto?C.accentBg:C.surface,border:dInto?`1px solid ${pc}`:`1px solid ${C.border}`,borderLeft:`3px solid ${tk.done?C.done:pc}70`,borderRadius:4,padding:'7px 12px',cursor:'default',boxShadow:C.shadow,transition:'all .1s'}}
                        onClick={()=>toggle(tk.id)}
                        onMouseEnter={e=>e.currentTarget.style.background=tk.done?C.doneBg:C.surfaceAlt}
                        onMouseLeave={e=>e.currentTarget.style.background=tk.done?C.doneBg:dInto?C.accentBg:C.surface}
                      >
                        {!tk.done&&<span className="dh" onClick={e=>e.stopPropagation()}>⠿</span>}
                        <Checkbox checked={!!tk.done} onChange={v=>onToggleDone('task',pi,ti,null,v)}/>
                        <span style={{fontFamily:FM,fontSize:9,color:C.textMuted,minWidth:16,cursor:'pointer'}}>{collapsed[tk.id]?'▶':'▼'}</span>
                        <span style={{fontFamily:FM,fontSize:9,color:C.textMuted,minWidth:30}}>{`${pi+1}.${ti+1}`}</span>
                        <span style={{fontWeight:600,fontSize:13,flex:1,color:tk.done?C.done:C.text,textDecoration:tk.done?'line-through':'none'}}>{tk.name}</span>
                        {tk.duration&&<span style={{fontSize:11,color:C.textMuted,fontFamily:FM}}>⏱ {tk.duration}</span>}
                        {tk.owner&&<span style={{fontSize:11,color:C.textSub}}>👤 {tk.owner}</span>}
                        <RowActions done={tk.done} onEdit={()=>onEdit('task',pi,ti)} onAdd={()=>onAdd('subtask',pi,ti)} onDelete={()=>onDelete('task',pi,ti)} addLabel="サブタスク追加"/>
                      </div>
                      {dAfter&&<div style={{...dline(pc),bottom:-1}}/>}
                      {!collapsed[tk.id]&&(
                        <div style={{marginLeft:18,marginTop:1}}>
                          {(tk.subtasks||[]).map((st,si)=>{
                            const dT2=dragging&&dragSrc.current?.type==='subtask'&&dragSrc.current.pi===pi&&dragSrc.current.ti===ti&&dragSrc.current.si===si
                            const s=dropTarget
                            const sBef=s?.type==='subtask'&&s.pi===pi&&s.ti===ti&&s.si===si&&s.pos==='before'
                            const sAft=s?.type==='subtask'&&s.pi===pi&&s.ti===ti&&s.si===si&&s.pos==='after'
                            return(
                              <div key={st.id} style={{position:'relative',marginBottom:1}}>
                                {sBef&&<div style={{...dline(pc+'aa'),top:-1}}/>}
                                <div className={`dr${dT2?' dg':''}${st.done?' done-row':''}`} draggable={!st.done} onDragStart={e=>startDrag(e,{type:'subtask',pi,ti,si})} onDragEnd={endDrag}
                                  onDragOver={e=>{e.preventDefault();setDropTarget({type:'subtask',pi,ti,si,pos:pos(e,e.currentTarget)})}}
                                  onDragLeave={()=>setDropTarget(null)} onDrop={e=>drop(e,{type:'subtask',pi,ti,si})}
                                  style={{display:'flex',alignItems:'center',gap:8,background:st.done?C.doneBg:C.surfaceAlt,border:`1px solid ${C.border}`,borderLeft:`2px solid ${st.done?C.done:pc}45`,borderRadius:3,padding:'5px 12px',transition:'background .1s'}}
                                  onMouseEnter={e=>e.currentTarget.style.background=st.done?C.doneBg:C.hover}
                                  onMouseLeave={e=>e.currentTarget.style.background=st.done?C.doneBg:C.surfaceAlt}
                                >
                                  {!st.done&&<span className="dh" onClick={e=>e.stopPropagation()}>⠿</span>}
                                  <Checkbox checked={!!st.done} onChange={v=>onToggleDone('subtask',pi,ti,si,v)}/>
                                  <span style={{fontFamily:FM,fontSize:9,color:C.borderMd,minWidth:12}}>◦</span>
                                  <span style={{fontFamily:FM,fontSize:9,color:C.textMuted,minWidth:40}}>{`${pi+1}.${ti+1}.${si+1}`}</span>
                                  <span style={{fontSize:12,flex:1,color:st.done?C.done:C.textSub,textDecoration:st.done?'line-through':'none'}}>{st.name}</span>
                                  {st.duration&&<span style={{fontSize:10,color:C.textMuted,fontFamily:FM}}>⏱ {st.duration}</span>}
                                  {st.owner&&<span style={{fontSize:10,color:C.textMuted}}>👤 {st.owner}</span>}
                                  <RowActions done={st.done} onEdit={()=>onEdit('subtask',pi,ti,si)} onDelete={()=>onDelete('subtask',pi,ti,si)}/>
                                </div>
                                {sAft&&<div style={{...dline(pc+'aa'),bottom:-1}}/>}
                              </div>
                            )
                          })}
                          {!tk.done&&<button className="add-row" onClick={()=>onAdd('subtask',pi,ti)} style={addBtnStyle}>＋ サブタスク追加</button>}
                        </div>
                      )}
                    </div>
                  )
                })}
                {!ph.done&&<button className="add-row" onClick={()=>onAdd('task',pi)} style={addBtnStyle}>＋ タスク追加</button>}
              </div>
            )}
          </div>
        )
      })}
      <button className="add-row" onClick={()=>onAdd('phase')} style={{...addBtnStyle,borderColor:C.accent+'55',color:C.accent}}>＋ フェーズ追加</button>
    </div>
  )
}

// ── TABLE VIEW ────────────────────────────────────────────────────────────────
function TableView({phases,onToggleDone,onUpdateMemo}) {
  const [editMemo,setEditMemo]=useState(null) // {id, value}
  const rows=[]
  phases.forEach((ph,pi)=>{
    rows.push({level:0,code:`${pi+1}`,id:ph.id,name:ph.name,duration:ph.duration,owner:ph.owner,color:PHASE_COLORS[pi%PHASE_COLORS.length],done:ph.done,memo:'',nodeKey:{type:'phase',pi}})
    ;(ph.tasks||[]).forEach((tk,ti)=>{
      rows.push({level:1,code:`${pi+1}.${ti+1}`,id:tk.id,name:tk.name,duration:tk.duration,owner:tk.owner,color:PHASE_COLORS[pi%PHASE_COLORS.length],done:tk.done,memo:tk.memo||'',nodeKey:{type:'task',pi,ti}})
      ;(tk.subtasks||[]).forEach((st,si)=>
        rows.push({level:2,code:`${pi+1}.${ti+1}.${si+1}`,id:st.id,name:st.name,duration:st.duration,owner:st.owner,color:PHASE_COLORS[pi%PHASE_COLORS.length],done:st.done,memo:st.memo||'',nodeKey:{type:'subtask',pi,ti,si}})
      )
    })
  })
  const lv=[
    {label:'フェーズ',bg:C.accentBg,color:C.accent},
    {label:'タスク',bg:C.successBg,color:C.success},
    {label:'サブタスク',bg:'#F5F3FF',color:'#6B4EA6'},
  ]
  return(
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:13}}>
        <thead><tr style={{background:C.surfaceAlt,borderBottom:`2px solid ${C.borderMd}`}}>
          {['','コード','レベル','タスク名','担当者','期間','メモ'].map(h=>(
            <th key={h} style={{textAlign:'left',padding:'9px 10px',fontFamily:FM,fontSize:10,color:C.textMuted,letterSpacing:'0.1em',fontWeight:500,whiteSpace:'nowrap'}}>{h}</th>
          ))}
        </tr></thead>
        <tbody>
          {rows.map((r,i)=>{
            const bg=r.done?C.doneBg:r.level===0?C.surface:r.level===1?'#FAFBFD':C.surfaceAlt
            const isEditingMemo=editMemo?.id===r.id
            return(
              <tr key={r.id+i} style={{borderBottom:`1px solid ${C.border}`,background:bg,transition:'background .1s',opacity:r.done?0.65:1}}
                onMouseEnter={e=>e.currentTarget.style.background=r.done?C.doneBg:C.hover}
                onMouseLeave={e=>e.currentTarget.style.background=bg}
              >
                <td style={{padding:'6px 10px'}} onClick={e=>e.stopPropagation()}>
                  <Checkbox checked={!!r.done} onChange={v=>{const{type,pi,ti,si}=r.nodeKey;onToggleDone(type,pi,ti??null,si??null,v)}} disabled={false}/>
                </td>
                <td style={{padding:'7px 10px',fontFamily:FM,fontSize:10,color:r.done?C.done:r.color,fontWeight:600}}>{r.code}</td>
                <td style={{padding:'7px 10px'}}><span style={{...lv[r.level],border:`1px solid ${lv[r.level].color}30`,borderRadius:3,padding:'1px 7px',fontSize:10,fontFamily:FM,fontWeight:600,opacity:r.done?0.5:1}}>{lv[r.level].label}</span></td>
                <td style={{padding:'7px 10px',paddingLeft:`${10+r.level*18}px`,fontWeight:r.level===0?700:r.level===1?600:400,color:r.done?C.done:r.level===2?C.textSub:C.text,textDecoration:r.done?'line-through':'none'}}>{r.name}</td>
                <td style={{padding:'7px 10px',color:C.textSub,fontSize:12}}>{r.owner||'—'}</td>
                <td style={{padding:'7px 10px',color:C.textMuted,fontFamily:FM,fontSize:11,whiteSpace:'nowrap'}}>{r.duration||'—'}</td>
                <td style={{padding:'4px 8px',minWidth:160}}>
                  {r.level>0&&(
                    isEditingMemo?(
                      <div style={{display:'flex',gap:4,alignItems:'flex-start'}}>
                        <textarea value={editMemo.value} onChange={e=>setEditMemo({...editMemo,value:e.target.value})}
                          style={{...inputStyle,padding:'4px 8px',fontSize:11,minHeight:52,resize:'vertical',flex:1}}
                          autoFocus onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                        />
                        <button onClick={()=>{const{type,pi,ti,si}=r.nodeKey;onUpdateMemo(type,pi,ti,si,editMemo.value);setEditMemo(null)}}
                          style={{background:C.accent,border:'none',color:'#fff',borderRadius:4,padding:'4px 8px',cursor:'pointer',fontSize:11,whiteSpace:'nowrap'}}>保存</button>
                        <button onClick={()=>setEditMemo(null)} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:4,padding:'4px 8px',cursor:'pointer',fontSize:11}}>✕</button>
                      </div>
                    ):(
                      <div onClick={()=>!r.done&&setEditMemo({id:r.id,value:r.memo})}
                        style={{fontSize:11,color:r.memo?C.textSub:C.textMuted,cursor:r.done?'default':'pointer',padding:'4px 6px',borderRadius:3,border:`1px solid transparent`,minHeight:28,lineHeight:1.5,
                          transition:'all 0.15s',...(!r.done&&{':hover':{borderColor:C.border}})}}
                        onMouseEnter={e=>{if(!r.done)e.currentTarget.style.borderColor=C.border}}
                        onMouseLeave={e=>e.currentTarget.style.borderColor='transparent'}
                      >
                        {r.memo||<span style={{color:C.border}}>{r.done?'':'＋ メモを追加'}</span>}
                      </div>
                    )
                  )}
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── GANTT VIEW ────────────────────────────────────────────────────────────────
function GanttView({phases,onUpdateDate,projectName}) {
  // Compute date range
  const allDates=[]
  phases.forEach(ph=>(ph.tasks||[]).forEach(tk=>{
    if(tk.startDate)allDates.push(parseDate(tk.startDate))
    if(tk.endDate)allDates.push(parseDate(tk.endDate))
  }))
  const hasRealDates=allDates.filter(Boolean).length>=2
  const minDate=hasRealDates?new Date(Math.min(...allDates.filter(Boolean))):null
  const maxDate=hasRealDates?new Date(Math.max(...allDates.filter(Boolean))):null
  const totalDays=hasRealDates?Math.max(dateDiff(minDate,maxDate),1):null

  // Fallback estimated layout
  let cursor=0;const estItems=[]
  phases.forEach((ph,pi)=>{
    const phD=(ph.tasks||[]).reduce((s,t)=>s+parseDays(t.duration),0)||parseDays(ph.duration)||10
    estItems.push({pi,ti:null,days:phD,start:cursor,color:PHASE_COLORS[pi%PHASE_COLORS.length],level:0,label:ph.name,code:`${pi+1}`,done:ph.done})
    let tc=cursor
    ;(ph.tasks||[]).forEach((tk,ti)=>{const d=parseDays(tk.duration)||5;estItems.push({pi,ti,days:d,start:tc,color:PHASE_COLORS[pi%PHASE_COLORS.length],level:1,label:tk.name,code:`${pi+1}.${ti+1}`,done:tk.done,startDate:tk.startDate,endDate:tk.endDate,id:tk.id});tc+=d})
    cursor+=phD
  })
  const estTotal=cursor||20
  const weeks=Math.ceil(estTotal/5)
  const colW=Math.max(500,estTotal*18)

  return(
    <div style={{overflowX:'auto'}}>
      <div style={{minWidth:colW+320}}>
        {/* Header */}
        <div style={{display:'flex',marginLeft:320,borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
          {Array.from({length:weeks},(_,i)=>(
            <div key={i} style={{width:colW/weeks,textAlign:'center',fontFamily:FM,fontSize:9,color:C.textMuted,padding:'5px 0',borderRight:`1px solid ${C.border}`,flexShrink:0}}>W{i+1}</div>
          ))}
        </div>
        {estItems.map((item,i)=>{
          const barLeft=(item.start/estTotal)*100
          const barW=(item.days/estTotal)*100
          return(
            <div key={i} style={{display:'flex',alignItems:'center',marginBottom:item.level===0?6:2}}>
              {/* Label + date inputs */}
              <div style={{width:320,flexShrink:0,paddingLeft:item.level*16+8,paddingRight:8,boxSizing:'border-box'}}>
                <div style={{fontSize:item.level===0?12:11,fontWeight:item.level===0?700:400,color:item.done?C.done:item.level===0?C.text:C.textSub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:item.done?'line-through':'none',marginBottom:item.level===1?2:0}}>
                  <span style={{fontFamily:FM,fontSize:9,color:item.done?C.done:item.color,marginRight:4}}>{item.code}</span>{item.label}
                </div>
                {item.level===1&&(
                  <div style={{display:'flex',gap:4,alignItems:'center'}}>
                    <input value={item.startDate||''} onChange={e=>onUpdateDate(item.pi,item.ti,'startDate',e.target.value)}
                      placeholder="開始 YYYY/MM/DD" style={{fontSize:9,fontFamily:FM,border:`1px solid ${C.border}`,borderRadius:3,padding:'2px 5px',width:100,color:C.textSub,background:C.surfaceAlt,outline:'none'}}
                      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                    />
                    <span style={{fontSize:9,color:C.textMuted}}>〜</span>
                    <input value={item.endDate||''} onChange={e=>onUpdateDate(item.pi,item.ti,'endDate',e.target.value)}
                      placeholder="完了 YYYY/MM/DD" style={{fontSize:9,fontFamily:FM,border:`1px solid ${C.border}`,borderRadius:3,padding:'2px 5px',width:100,color:C.textSub,background:C.surfaceAlt,outline:'none'}}
                      onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}
                    />
                  </div>
                )}
              </div>
              {/* Bar */}
              <div style={{position:'relative',flex:1,height:item.level===0?26:item.level===1?32:20,background:C.surfaceAlt,borderRadius:2,border:`1px solid ${C.border}`}}>
                {Array.from({length:weeks},(_,i)=><div key={i} style={{position:'absolute',left:`${(i/weeks)*100}%`,top:0,bottom:0,borderLeft:`1px solid ${C.border}`}}/>)}
                {/* Estimated bar */}
                <div style={{position:'absolute',left:`${barLeft}%`,width:`${barW}%`,top:item.level===0?3:item.level===1?8:2,height:item.level===0?20:item.level===1?16:16,background:item.done?(C.done+'88'):(item.level===0?item.color:item.color+'70'),borderRadius:3,display:'flex',alignItems:'center',paddingLeft:6,overflow:'hidden',boxSizing:'border-box',opacity:0.5}}>
                  <span style={{fontSize:9,color:'#fff',fontFamily:FM}}>{item.days}d</span>
                </div>
                {/* Real date bar (if dates set) */}
                {item.level===1&&item.startDate&&item.endDate&&(()=>{
                  const sd=parseDate(item.startDate),ed=parseDate(item.endDate)
                  if(!sd||!ed)return null
                  const realLeft=minDate?((sd-minDate)/((maxDate-minDate)||1))*100:barLeft
                  const realW=minDate?((ed-sd)/((maxDate-minDate)||1))*100:barW
                  return(
                    <div style={{position:'absolute',left:`${Math.max(0,realLeft)}%`,width:`${Math.max(1,realW)}%`,top:item.level===1?8:2,height:16,background:item.done?C.done:item.color,borderRadius:3,display:'flex',alignItems:'center',paddingLeft:6,overflow:'hidden',boxSizing:'border-box',zIndex:2}}>
                      <span style={{fontSize:9,color:'#fff',fontFamily:FM,whiteSpace:'nowrap'}}>{dateDiff(sd,ed)}d</span>
                    </div>
                  )
                })()}
              </div>
            </div>
          )
        })}
        <div style={{marginTop:8,fontSize:11,color:C.textMuted,paddingLeft:8}}>薄いバー: 期間から推計 ／ 濃いバー: 入力した日付ベース</div>
      </div>
    </div>
  )
}

// ── ALL PROJECTS GANTT ────────────────────────────────────────────────────────
function AllProjectsGantt({projects}) {
  if(!projects.length)return<div style={{padding:40,textAlign:'center',color:C.textMuted}}>プロジェクトがありません</div>

  const allItems=[]
  projects.forEach((proj,projIdx)=>{
    const phases=proj.wbs?.phases||[]
    if(!phases.length)return
    const pcolor=PHASE_COLORS[projIdx%PHASE_COLORS.length]
    allItems.push({type:'project',label:proj.name,color:pcolor,done:proj.status==='done'})
    let cursor=0
    phases.forEach((ph,pi)=>{
      const phD=(ph.tasks||[]).reduce((s,t)=>s+parseDays(t.duration),0)||parseDays(ph.duration)||10
      allItems.push({type:'phase',label:ph.name,code:`${pi+1}`,color:pcolor,days:phD,start:cursor,done:ph.done})
      let tc=cursor
      ;(ph.tasks||[]).forEach((tk,ti)=>{
        const d=parseDays(tk.duration)||5
        allItems.push({type:'task',label:tk.name,code:`${pi+1}.${ti+1}`,color:pcolor,days:d,start:tc,done:tk.done,startDate:tk.startDate,endDate:tk.endDate})
        tc+=d
      })
      cursor+=phD
    })
  })

  const maxDays=Math.max(...allItems.filter(r=>r.type!=='project').map(r=>(r.start||0)+(r.days||0)),20)
  const weeks=Math.ceil(maxDays/5)
  const colW=Math.max(600,maxDays*14)

  return(
    <div style={{overflowX:'auto'}}>
      <div style={{minWidth:colW+260}}>
        <div style={{display:'flex',marginLeft:260,borderBottom:`1px solid ${C.border}`,marginBottom:4}}>
          {Array.from({length:weeks},(_,i)=>(
            <div key={i} style={{width:colW/weeks,textAlign:'center',fontFamily:FM,fontSize:9,color:C.textMuted,padding:'5px 0',borderRight:`1px solid ${C.border}`,flexShrink:0}}>W{i+1}</div>
          ))}
        </div>
        {allItems.map((item,i)=>{
          if(item.type==='project'){
            return(
              <div key={i} style={{display:'flex',alignItems:'center',marginBottom:2,marginTop:i>0?10:0}}>
                <div style={{width:260,flexShrink:0,paddingLeft:8,paddingRight:8,boxSizing:'border-box'}}>
                  <div style={{fontSize:12,fontWeight:700,color:item.done?C.done:item.color,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>📁 {item.label}</div>
                </div>
                <div style={{flex:1,height:2,background:item.color+'30',borderRadius:1}}/>
              </div>
            )
          }
          const barLeft=((item.start||0)/maxDays)*100
          const barW=((item.days||0)/maxDays)*100
          return(
            <div key={i} style={{display:'flex',alignItems:'center',marginBottom:2}}>
              <div style={{width:260,flexShrink:0,paddingLeft:item.type==='task'?32:18,paddingRight:8,boxSizing:'border-box'}}>
                <div style={{fontSize:item.type==='phase'?11:10,color:item.done?C.done:item.type==='phase'?C.text:C.textSub,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',textDecoration:item.done?'line-through':'none'}}>
                  <span style={{fontFamily:FM,fontSize:8,color:item.done?C.done:item.color,marginRight:4}}>{item.code}</span>{item.label}
                </div>
              </div>
              <div style={{position:'relative',flex:1,height:item.type==='phase'?20:16,background:C.surfaceAlt,borderRadius:2,border:`1px solid ${C.border}`}}>
                {Array.from({length:weeks},(_,j)=><div key={j} style={{position:'absolute',left:`${(j/weeks)*100}%`,top:0,bottom:0,borderLeft:`1px solid ${C.border}`}}/>)}
                <div style={{position:'absolute',left:`${barLeft}%`,width:`${Math.max(0.5,barW)}%`,top:item.type==='phase'?2:2,height:item.type==='phase'?16:12,background:item.done?C.done:item.type==='phase'?item.color:item.color+'80',borderRadius:2,display:'flex',alignItems:'center',paddingLeft:4,overflow:'hidden',boxSizing:'border-box'}}>
                  <span style={{fontSize:8,color:'#fff',fontFamily:FM,whiteSpace:'nowrap'}}>{item.days}d</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── CONFIRM DIALOG ────────────────────────────────────────────────────────────
function ConfirmDialog({message,onOk,onCancel}) {
  return(
    <div style={{position:'fixed',inset:0,background:'rgba(26,37,64,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:3000,backdropFilter:'blur(2px)'}} onClick={onCancel}>
      <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:28,width:360,maxWidth:'90vw',boxShadow:C.shadowMd}} onClick={e=>e.stopPropagation()}>
        <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:10}}>確認</div>
        <div style={{fontSize:13,color:C.textSub,marginBottom:24,lineHeight:1.6}}>{message}</div>
        <div style={{display:'flex',gap:8,justifyContent:'flex-end'}}>
          <button onClick={onCancel} style={{background:C.bg,border:`1px solid ${C.border}`,color:C.textSub,borderRadius:5,padding:'8px 18px',cursor:'pointer',fontSize:13}}>キャンセル</button>
          <button onClick={onOk} style={{background:C.danger,border:'none',color:'#fff',borderRadius:5,padding:'8px 22px',cursor:'pointer',fontSize:13,fontWeight:700}}>削除する</button>
        </div>
      </div>
    </div>
  )
}

// ── WBS EDITOR ────────────────────────────────────────────────────────────────
function WBSEditor({project,onBack,onSave,currentUser}) {
  const [step,setStep]=useState(project.wbs?.phases?.length?'result':'input')
  const [pName,setPName]=useState(project.name||'')
  const [pDesc,setPDesc]=useState(project.description||'')
  const [wbs,setWbs]=useState(project.wbs||{phases:[]})
  const [view,setView]=useState('tree')
  const [error,setError]=useState('')
  const [editModal,setEditModal]=useState(null)
  const [copied,setCopied]=useState(false)
  const [loading,setLoading]=useState(false)
  const saveTimer=useRef(null)

  useEffect(()=>{
    if(!wbs.phases?.length)return
    clearTimeout(saveTimer.current)
    saveTimer.current=setTimeout(()=>{
      onSave({...project,name:pName,description:pDesc,wbs,updated_at:new Date().toISOString()})
    },1000)
    return()=>clearTimeout(saveTimer.current)
  },[wbs])

  const generate=useCallback(async()=>{
    if(!pName.trim())return
    setLoading(true);setError('')
    try{
      const res=await fetch('/api/generate-wbs',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({projectName:pName,projectDesc:pDesc})})
      const data=await res.json()
      if(!res.ok)throw new Error(data.error||'WBSの生成に失敗しました')
      const parsed=data.wbs
      parsed.phases=parsed.phases.map(ph=>({...ph,id:ph.id||newId(),done:false,tasks:(ph.tasks||[]).map(tk=>({...tk,id:tk.id||newId(),done:false,memo:'',startDate:'',endDate:'',subtasks:(tk.subtasks||[]).map(st=>({...st,id:st.id||newId(),done:false,memo:''}))}))}))
      setWbs(parsed)
      onSave({...project,name:pName,description:pDesc,wbs:parsed,status:project.status==='planning'?'active':project.status,updated_at:new Date().toISOString()})
      setStep('result')
    }catch(e){setError('生成に失敗しました: '+e.message)}
    finally{setLoading(false)}
  },[pName,pDesc,project])

  const upd=fn=>setWbs(p=>{const n=JSON.parse(JSON.stringify(p));fn(n);return n})
  const handleEdit=(type,pi,ti,si)=>{
    let item={}
    if(type==='phase')item=wbs.phases[pi]
    else if(type==='task')item=wbs.phases[pi].tasks[ti]
    else item=wbs.phases[pi].tasks[ti].subtasks[si]
    setEditModal({type,pi,ti,si,item})
  }
  const handleSave=({name,duration,owner})=>{
    const{type,pi,ti,si}=editModal
    upd(n=>{
      if(type==='phase')Object.assign(n.phases[pi],{name,duration,owner})
      else if(type==='task')Object.assign(n.phases[pi].tasks[ti],{name,duration,owner})
      else Object.assign(n.phases[pi].tasks[ti].subtasks[si],{name,duration,owner})
    })
    setEditModal(null)
  }
  const handleAdd=(type,pi,ti)=>{
    upd(n=>{
      if(type==='phase')n.phases.push({id:newId(),name:'新しいフェーズ',duration:'',owner:'',done:false,tasks:[]})
      else if(type==='task')n.phases[pi].tasks.push({id:newId(),name:'新しいタスク',duration:'',owner:'',done:false,memo:'',startDate:'',endDate:'',subtasks:[]})
      else n.phases[pi].tasks[ti].subtasks.push({id:newId(),name:'新しいサブタスク',duration:'',owner:'',done:false,memo:''})
    })
  }
  const handleDelete=(type,pi,ti,si)=>{
    upd(n=>{
      if(type==='phase')n.phases.splice(pi,1)
      else if(type==='task')n.phases[pi].tasks.splice(ti,1)
      else n.phases[pi].tasks[ti].subtasks.splice(si,1)
    })
  }
  const handleMove=useCallback((src,tgt)=>{
    upd(n=>{
      if(src.type==='task'){
        const[mv]=n.phases[src.pi].tasks.splice(src.ti,1)
        let dp=tgt.pi,dt=tgt.ti
        if(tgt.pos==='into'){n.phases[dp].tasks.push(mv);return}
        if(src.pi===dp&&src.ti<dt)dt--
        n.phases[dp].tasks.splice(Math.max(0,tgt.pos==='after'?dt+1:dt),0,mv)
      }else if(src.type==='subtask'){
        const[mv]=n.phases[src.pi].tasks[src.ti].subtasks.splice(src.si,1)
        let dt=tgt.ti,ds=tgt.si
        if(tgt.pos==='into'){n.phases[tgt.pi].tasks[dt].subtasks.push(mv);return}
        if(src.pi===tgt.pi&&src.ti===tgt.ti&&src.si<ds)ds--
        n.phases[tgt.pi].tasks[dt].subtasks.splice(Math.max(0,tgt.pos==='after'?ds+1:ds),0,mv)
      }
    })
  },[])

  const handleToggleDone=(type,pi,ti,si,val)=>{
    upd(n=>{
      if(type==='phase'){
        n.phases[pi].done=val
        // cascade to children
        ;(n.phases[pi].tasks||[]).forEach(tk=>{tk.done=val;(tk.subtasks||[]).forEach(st=>st.done=val)})
      }else if(type==='task'){
        n.phases[pi].tasks[ti].done=val
        ;(n.phases[pi].tasks[ti].subtasks||[]).forEach(st=>st.done=val)
        // check if all tasks done → phase done
        if(val&&n.phases[pi].tasks.every(t=>t.done))n.phases[pi].done=true
        else if(!val)n.phases[pi].done=false
      }else{
        n.phases[pi].tasks[ti].subtasks[si].done=val
        if(val&&n.phases[pi].tasks[ti].subtasks.every(s=>s.done))n.phases[pi].tasks[ti].done=true
        else if(!val)n.phases[pi].tasks[ti].done=false
      }
    })
  }

  const handleUpdateMemo=(type,pi,ti,si,memo)=>{
    upd(n=>{
      if(type==='task')n.phases[pi].tasks[ti].memo=memo
      else if(type==='subtask')n.phases[pi].tasks[ti].subtasks[si].memo=memo
    })
  }

  const handleUpdateDate=(pi,ti,field,val)=>{
    upd(n=>{n.phases[pi].tasks[ti][field]=val})
  }

  const st=countStats(wbs.phases)
  const progress=st.totalSubs>0?Math.round((st.done/st.totalSubs)*100):0

  return(
    <div style={{minHeight:'100vh',background:C.bg}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 24px',display:'flex',alignItems:'center',gap:0,position:'sticky',top:0,zIndex:100,boxShadow:C.shadow}}>
        <button onClick={onBack} style={{background:'transparent',border:'none',color:C.textMuted,cursor:'pointer',padding:'16px 12px 16px 0',fontSize:13,display:'flex',alignItems:'center',gap:5,transition:'color .15s'}}
          onMouseEnter={e=>e.currentTarget.style.color=C.accent} onMouseLeave={e=>e.currentTarget.style.color=C.textMuted}>← ダッシュボード</button>
        <span style={{color:C.border,margin:'0 8px'}}>/</span>
        <span style={{fontSize:14,fontWeight:600,color:C.text,flex:1}}>{pName||'新規プロジェクト'}</span>
        {step==='result'&&st.totalSubs>0&&(
          <div style={{display:'flex',alignItems:'center',gap:8,marginRight:12}}>
            <div style={{width:80,height:6,background:C.border,borderRadius:3,overflow:'hidden'}}>
              <div style={{width:`${progress}%`,height:'100%',background:progress===100?C.success:C.accent,borderRadius:3,transition:'width 0.3s'}}/>
            </div>
            <span style={{fontSize:11,color:C.textMuted,fontFamily:FM}}>{progress}%</span>
          </div>
        )}
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <StatusBadge status={project.status||'planning'} onChange={s=>onSave({...project,status:s,updated_at:new Date().toISOString()})}/>
          <span style={{fontSize:11,color:C.textMuted}}>{currentUser?.email}</span>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'28px 24px'}}>
        {!loading&&step==='input'&&(
          <div style={{maxWidth:640,margin:'0 auto'}}>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:28,boxShadow:C.shadowMd}}>
              <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:20}}>プロジェクト情報を入力してWBSを生成</div>
              <Field label="プロジェクト名 *"><input value={pName} onChange={e=>setPName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!e.shiftKey&&generate()} placeholder="プロジェクト名を入力..." style={inputStyle} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/></Field>
              <Field label="プロジェクト概要（任意）"><textarea value={pDesc} onChange={e=>setPDesc(e.target.value)} rows={4} placeholder="目的・対象範囲・期間・制約条件など" style={{...inputStyle,resize:'vertical',lineHeight:1.7}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/></Field>
              {error&&<div style={{background:C.dangerBg,border:`1px solid ${C.danger}40`,borderRadius:4,padding:'10px 14px',marginBottom:14,color:C.danger,fontSize:12}}>{error}</div>}
              <button disabled={!pName.trim()} onClick={generate} style={{width:'100%',background:pName.trim()?C.accent:C.borderMd,border:'none',color:pName.trim()?'#fff':C.textMuted,borderRadius:5,padding:'13px',fontSize:13,fontWeight:700,cursor:pName.trim()?'pointer':'not-allowed',transition:'all 0.2s'}}>WBSを生成する →</button>
            </div>
          </div>
        )}
        {loading&&<Spinner/>}

        {!loading&&step==='result'&&(
          <>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderLeft:`4px solid ${C.accent}`,borderRadius:6,padding:'14px 20px',marginBottom:18,display:'flex',flexWrap:'wrap',gap:16,alignItems:'center',boxShadow:C.shadow}}>
              <div style={{flex:1,minWidth:200}}>
                <div style={{fontSize:17,fontWeight:700,color:C.text,marginBottom:3}}>{wbs.projectName||pName}</div>
                <div style={{fontSize:12,color:C.textSub}}>{wbs.summary}</div>
              </div>
              <div style={{display:'flex',gap:20}}>
                {[['フェーズ',st.phases],['タスク',st.tasks],['完了',`${st.done}/${st.totalSubs}`],['期間',wbs.totalDuration||'—']].map(([l,v])=>(
                  <div key={l} style={{textAlign:'center'}}>
                    <div style={{fontFamily:FM,fontSize:9,color:C.textMuted,letterSpacing:'0.1em',marginBottom:2}}>{l}</div>
                    <div style={{fontSize:18,fontWeight:700,color:C.accent}}>{v}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{display:'flex',alignItems:'center',marginBottom:12,gap:8,flexWrap:'wrap'}}>
              <div style={{display:'flex',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,overflow:'hidden',boxShadow:C.shadow}}>
                {[['tree','🌲 ツリー'],['table','📊 テーブル'],['gantt','📅 ガント']].map(([v,l])=>(
                  <button key={v} onClick={()=>setView(v)} style={{background:view===v?C.accent:'transparent',color:view===v?'#fff':C.textSub,border:'none',padding:'7px 16px',cursor:'pointer',fontSize:12,transition:'all .15s',fontFamily:'inherit'}}
                    onMouseEnter={e=>{if(view!==v){e.currentTarget.style.background=C.accentBg;e.currentTarget.style.color=C.accent}}}
                    onMouseLeave={e=>{if(view!==v){e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.textSub}}}
                  >{l}</button>
                ))}
              </div>
              <button onClick={()=>setStep('input')} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.textSub,borderRadius:5,padding:'7px 12px',cursor:'pointer',fontSize:12}}>再生成</button>
              <div style={{marginLeft:'auto',display:'flex',gap:8}}>
                <button onClick={()=>{navigator.clipboard.writeText(toCSV(wbs.phases));setCopied(true);setTimeout(()=>setCopied(false),2000)}} style={{background:copied?C.success:C.surface,border:`1px solid ${copied?C.success:C.border}`,color:copied?'#fff':C.textSub,borderRadius:5,padding:'7px 14px',cursor:'pointer',fontSize:12,transition:'all 0.2s'}}>{copied?'✓ コピー済み':'CSVコピー'}</button>
                <button onClick={()=>{const b=new Blob(['\uFEFF'+toCSV(wbs.phases)],{type:'text/csv;charset=utf-8'});const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download=`WBS_${pName}.csv`;a.click();URL.revokeObjectURL(u)}} style={{background:C.accent,border:'none',color:'#fff',borderRadius:5,padding:'7px 14px',cursor:'pointer',fontSize:12,boxShadow:'0 2px 6px rgba(27,95,173,0.25)'}}>↓ CSVダウンロード</button>
              </div>
            </div>

            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:16,boxShadow:C.shadow}}>
              {view==='tree'&&<TreeView phases={wbs.phases} onEdit={handleEdit} onAdd={handleAdd} onDelete={handleDelete} onMove={handleMove} onToggleDone={handleToggleDone}/>}
              {view==='table'&&<TableView phases={wbs.phases} onToggleDone={handleToggleDone} onUpdateMemo={handleUpdateMemo}/>}
              {view==='gantt'&&<GanttView phases={wbs.phases} onUpdateDate={handleUpdateDate} projectName={pName}/>}
            </div>
          </>
        )}
      </div>
      {editModal&&<EditModal item={editModal.item} onSave={handleSave} onClose={()=>setEditModal(null)}/>}
    </div>
  )
}

// ── DASHBOARD ─────────────────────────────────────────────────────────────────
function Dashboard({projects,onCreate,onOpen,onUpdateStatus,onDelete,currentUser,onLogout}) {
  const [search,setSearch]=useState('')
  const [filterStatus,setFilterStatus]=useState('all')
  const [sortBy,setSortBy]=useState('updated_at')
  const [deleteConfirm,setDeleteConfirm]=useState(null)
  const [dashView,setDashView]=useState('cards') // 'cards' | 'allgantt'

  const filtered=projects
    .filter(p=>(filterStatus==='all'||p.status===filterStatus)&&(p.name.toLowerCase().includes(search.toLowerCase())||p.description?.toLowerCase().includes(search.toLowerCase())))
    .sort((a,b)=>{
      if(sortBy==='name')return a.name.localeCompare(b.name,'ja')
      if(sortBy==='status')return(a.status||'').localeCompare(b.status||'')
      return new Date(b.updated_at||0)-new Date(a.updated_at||0)
    })

  const totalTasks=projects.reduce((s,p)=>s+countStats(p.wbs?.phases).tasks,0)
  const byStatus=Object.fromEntries(Object.keys(STATUS).map(k=>[k,projects.filter(p=>p.status===k).length]))

  return(
    <div style={{minHeight:'100vh',background:C.bg}}>
      <div style={{background:C.surface,borderBottom:`1px solid ${C.border}`,padding:'0 32px',position:'sticky',top:0,zIndex:100,boxShadow:C.shadow}}>
        <div style={{maxWidth:1200,margin:'0 auto',display:'flex',alignItems:'center',gap:12,height:56}}>
          <div style={{display:'flex',alignItems:'center',gap:10}}>
            <div style={{width:28,height:28,background:C.accent,borderRadius:6,display:'flex',alignItems:'center',justifyContent:'center',fontSize:14,color:'#fff',fontWeight:700}}>W</div>
            <span style={{fontSize:15,fontWeight:700,color:C.text}}>WBS Manager</span>
          </div>
          <div style={{height:20,width:1,background:C.border,margin:'0 4px'}}/>
          <div style={{display:'flex',background:C.surfaceAlt,border:`1px solid ${C.border}`,borderRadius:5,overflow:'hidden'}}>
            <button onClick={()=>setDashView('cards')} style={{background:dashView==='cards'?C.accent:'transparent',color:dashView==='cards'?'#fff':C.textSub,border:'none',padding:'5px 12px',cursor:'pointer',fontSize:11,transition:'all .15s'}}>📁 プロジェクト一覧</button>
            <button onClick={()=>setDashView('allgantt')} style={{background:dashView==='allgantt'?C.accent:'transparent',color:dashView==='allgantt'?'#fff':C.textSub,border:'none',padding:'5px 12px',cursor:'pointer',fontSize:11,transition:'all .15s'}}>📅 全体ガント</button>
          </div>
          <div style={{marginLeft:'auto',display:'flex',alignItems:'center',gap:10}}>
            <span style={{fontSize:12,color:C.textMuted}}>{currentUser?.email}</span>
            <button onClick={onLogout} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:5,padding:'5px 12px',cursor:'pointer',fontSize:11,transition:'all .15s'}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=C.danger;e.currentTarget.style.color=C.danger}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=C.border;e.currentTarget.style.color=C.textMuted}}
            >ログアウト</button>
            <button onClick={onCreate} style={{background:C.accent,border:'none',color:'#fff',borderRadius:5,padding:'7px 16px',cursor:'pointer',fontSize:12,fontWeight:700}}>＋ 新規プロジェクト</button>
          </div>
        </div>
      </div>

      <div style={{maxWidth:1200,margin:'0 auto',padding:'28px 32px'}}>
        {dashView==='allgantt'?(
          <div>
            <div style={{fontSize:15,fontWeight:700,color:C.text,marginBottom:16}}>全プロジェクト ガントチャート</div>
            <div style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,padding:16,boxShadow:C.shadow}}>
              <AllProjectsGantt projects={projects.filter(p=>p.wbs?.phases?.length)}/>
            </div>
          </div>
        ):(
          <>
            {/* Stats */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(160px,1fr))',gap:12,marginBottom:24}}>
              {[
                {label:'プロジェクト総数',value:projects.length,icon:'📁',color:C.accent,bg:C.accentBg},
                {label:'進行中',value:byStatus.active||0,icon:'⚡',color:C.accent,bg:C.accentBg},
                {label:'完了',value:byStatus.done||0,icon:'✅',color:C.success,bg:C.successBg},
                {label:'総タスク数',value:totalTasks,icon:'📋',color:'#6B4EA6',bg:'#F5F0FF'},
                {label:'保留中',value:byStatus.hold||0,icon:'⏸',color:C.textMuted,bg:C.surfaceAlt},
              ].map(({label,value,icon,color,bg})=>(
                <div key={label} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:'16px 18px',boxShadow:C.shadow,display:'flex',alignItems:'center',gap:12}}>
                  <div style={{width:38,height:38,background:bg,borderRadius:8,display:'flex',alignItems:'center',justifyContent:'center',fontSize:18,flexShrink:0}}>{icon}</div>
                  <div>
                    <div style={{fontFamily:FM,fontSize:9,color:C.textMuted,letterSpacing:'0.1em',marginBottom:3}}>{label}</div>
                    <div style={{fontSize:22,fontWeight:700,color}}>{value}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div style={{display:'flex',gap:10,marginBottom:20,flexWrap:'wrap',alignItems:'center'}}>
              <div style={{position:'relative',flex:'1 1 220px'}}>
                <span style={{position:'absolute',left:10,top:'50%',transform:'translateY(-50%)',color:C.textMuted,fontSize:14}}>🔍</span>
                <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="プロジェクトを検索..." style={{...inputStyle,paddingLeft:32,background:C.surface}} onFocus={e=>e.target.style.borderColor=C.accent} onBlur={e=>e.target.style.borderColor=C.border}/>
              </div>
              <div style={{display:'flex',background:C.surface,border:`1px solid ${C.border}`,borderRadius:6,overflow:'hidden',boxShadow:C.shadow}}>
                {[['all','すべて'],...Object.entries(STATUS).map(([k,v])=>[k,v.label])].map(([k,l])=>(
                  <button key={k} onClick={()=>setFilterStatus(k)} style={{background:filterStatus===k?C.accent:'transparent',color:filterStatus===k?'#fff':C.textSub,border:'none',padding:'6px 13px',cursor:'pointer',fontSize:11,transition:'all .15s',fontFamily:'inherit',whiteSpace:'nowrap'}}>{l}</button>
                ))}
              </div>
              <select value={sortBy} onChange={e=>setSortBy(e.target.value)} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:5,padding:'6px 10px',fontSize:11,color:C.textSub,cursor:'pointer',outline:'none'}}>
                <option value="updated_at">更新順</option>
                <option value="name">名前順</option>
                <option value="status">ステータス順</option>
              </select>
            </div>

            {/* Cards */}
            {projects.length===0?(
              <div style={{textAlign:'center',padding:'80px 0',color:C.textMuted}}>
                <div style={{fontSize:48,marginBottom:16}}>📂</div>
                <div style={{fontSize:16,fontWeight:600,color:C.textSub,marginBottom:8}}>プロジェクトがまだありません</div>
                <button onClick={onCreate} style={{background:C.accent,border:'none',color:'#fff',borderRadius:6,padding:'12px 24px',cursor:'pointer',fontSize:14,fontWeight:700}}>＋ 新規プロジェクト作成</button>
              </div>
            ):filtered.length===0?(
              <div style={{textAlign:'center',padding:'60px 0',color:C.textMuted}}>
                <div style={{fontSize:36,marginBottom:12}}>🔍</div>
                <div style={{fontSize:14,color:C.textSub}}>該当するプロジェクトが見つかりません</div>
              </div>
            ):(
              <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(320px,1fr))',gap:16}}>
                {filtered.map(proj=>{
                  const st=countStats(proj.wbs?.phases)
                  const progress=st.totalSubs>0?Math.round((st.done/st.totalSubs)*100):0
                  return(
                    <div key={proj.id} style={{background:C.surface,border:`1px solid ${C.border}`,borderRadius:8,padding:0,boxShadow:C.shadow,cursor:'pointer',transition:'all .15s',overflow:'hidden',display:'flex',flexDirection:'column'}}
                      onClick={()=>onOpen(proj.id)}
                      onMouseEnter={e=>{e.currentTarget.style.boxShadow=C.shadowMd;e.currentTarget.style.transform='translateY(-1px)'}}
                      onMouseLeave={e=>{e.currentTarget.style.boxShadow=C.shadow;e.currentTarget.style.transform='none'}}
                    >
                      <div style={{height:4,background:`linear-gradient(90deg,${PHASE_COLORS[0]},${PHASE_COLORS[1]},${PHASE_COLORS[2]})`,opacity:proj.status==='done'?0.4:1}}/>
                      <div style={{padding:'16px 18px',flex:1,display:'flex',flexDirection:'column'}}>
                        <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:8,marginBottom:8}}>
                          <div style={{flex:1,minWidth:0}}>
                            <div style={{fontSize:14,fontWeight:700,color:C.text,marginBottom:4,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{proj.name}</div>
                            <div style={{fontSize:11,color:C.textMuted,lineHeight:1.5,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{proj.description||proj.wbs?.summary||'概要なし'}</div>
                          </div>
                          <div onClick={e=>e.stopPropagation()}><StatusBadge status={proj.status||'planning'} onChange={s=>onUpdateStatus(proj.id,s)}/></div>
                        </div>
                        {proj.wbs?.phases?.length>0&&<MiniGantt phases={proj.wbs.phases}/>}
                        {/* Progress bar */}
                        {st.totalSubs>0&&(
                          <div style={{marginTop:6}}>
                            <div style={{display:'flex',justifyContent:'space-between',marginBottom:3}}>
                              <span style={{fontSize:9,color:C.textMuted,fontFamily:FM}}>進捗</span>
                              <span style={{fontSize:9,color:progress===100?C.success:C.accent,fontFamily:FM,fontWeight:600}}>{progress}%</span>
                            </div>
                            <div style={{height:4,background:C.border,borderRadius:2,overflow:'hidden'}}>
                              <div style={{width:`${progress}%`,height:'100%',background:progress===100?C.success:C.accent,borderRadius:2,transition:'width 0.3s'}}/>
                            </div>
                          </div>
                        )}
                        <div style={{display:'flex',gap:16,marginTop:8}}>
                          {[['フェーズ',st.phases],['タスク',st.tasks],['サブタスク',st.subtasks]].map(([l,v])=>(
                            <div key={l} style={{textAlign:'center'}}>
                              <div style={{fontFamily:FM,fontSize:8,color:C.textMuted,marginBottom:1}}>{l}</div>
                              <div style={{fontSize:15,fontWeight:700,color:v>0?C.accent:C.borderMd}}>{v}</div>
                            </div>
                          ))}
                          {proj.wbs?.totalDuration&&<div style={{marginLeft:'auto',textAlign:'right'}}>
                            <div style={{fontFamily:FM,fontSize:8,color:C.textMuted,marginBottom:1}}>期間</div>
                            <div style={{fontSize:12,fontWeight:600,color:C.textSub}}>{proj.wbs.totalDuration}</div>
                          </div>}
                        </div>
                        <div style={{borderTop:`1px solid ${C.border}`,marginTop:10,paddingTop:10,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                          <span style={{fontSize:10,color:C.textMuted}}>更新: {proj.updated_at?fmtDate(proj.updated_at):'—'}</span>
                          <div style={{display:'flex',gap:6}} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>setDeleteConfirm(proj.id)} style={{background:'transparent',border:`1px solid ${C.border}`,color:C.textMuted,borderRadius:4,padding:'4px 10px',cursor:'pointer',fontSize:11,transition:'all .15s'}}
                              onMouseEnter={e=>{e.currentTarget.style.background=C.dangerBg;e.currentTarget.style.color=C.danger}}
                              onMouseLeave={e=>{e.currentTarget.style.background='transparent';e.currentTarget.style.color=C.textMuted}}
                            >削除</button>
                            <button onClick={()=>onOpen(proj.id)} style={{background:C.accentBg,border:`1px solid ${C.accent}40`,color:C.accent,borderRadius:4,padding:'4px 12px',cursor:'pointer',fontSize:11,fontWeight:600,transition:'all .15s'}}
                              onMouseEnter={e=>{e.currentTarget.style.background=C.accent;e.currentTarget.style.color='#fff'}}
                              onMouseLeave={e=>{e.currentTarget.style.background=C.accentBg;e.currentTarget.style.color=C.accent}}
                            >開く →</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </>
        )}
      </div>
      {deleteConfirm&&<ConfirmDialog message="このプロジェクトを削除しますか？この操作は取り消せません。" onOk={()=>{onDelete(deleteConfirm);setDeleteConfirm(null)}} onCancel={()=>setDeleteConfirm(null)}/>}
    </div>
  )
}

// ── ROOT ──────────────────────────────────────────────────────────────────────
export default function WBSApp({session}) {
  const [projects,setProjects]=useState([])
  const [activeId,setActiveId]=useState(null)
  const [loaded,setLoaded]=useState(false)

  useEffect(()=>{
    fetchProjects().then(data=>{setProjects(data);setLoaded(true)}).catch(err=>{console.error(err);setLoaded(true)})
  },[])

  useEffect(()=>{
    const unsubscribe=subscribeProjects(()=>{
      fetchProjects().then(setProjects).catch(console.error)
    })
    return unsubscribe
  },[])

  const handleCreate=async()=>{
    const proj=await createProject({name:'新規プロジェクト',description:'',status:'planning',wbs:{phases:[]},created_by:session.user.id})
    setProjects(p=>[proj,...p]);setActiveId(proj.id)
  }

  const handleSave=useCallback(async(proj)=>{
    const updated=await updateProject(proj.id,{name:proj.name,description:proj.description,status:proj.status,wbs:proj.wbs})
    setProjects(p=>p.map(x=>x.id===proj.id?updated:x))
  },[])

  const handleUpdateStatus=(id,status)=>{
    updateProject(id,{status}).then(updated=>setProjects(p=>p.map(x=>x.id===id?updated:x))).catch(console.error)
  }

  const handleDelete=async(id)=>{
    await deleteProject(id);setProjects(p=>p.filter(x=>x.id!==id));if(activeId===id)setActiveId(null)
  }

  const handleLogout=()=>supabase.auth.signOut()

  if(!loaded)return(
    <div style={{minHeight:'100vh',background:C.bg,display:'flex',alignItems:'center',justifyContent:'center'}}>
      <Spinner size={36}/>
    </div>
  )

  const activeProject=projects.find(p=>p.id===activeId)
  if(activeId&&activeProject)return(
    <WBSEditor key={activeId} project={activeProject} onBack={()=>setActiveId(null)} onSave={handleSave} currentUser={session.user}/>
  )

  return(
    <Dashboard projects={projects} onCreate={handleCreate} onOpen={id=>setActiveId(id)} onUpdateStatus={handleUpdateStatus} onDelete={handleDelete} currentUser={session.user} onLogout={handleLogout}/>
  )
}
