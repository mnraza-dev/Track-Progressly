'use client';
import { createContext,useContext,useEffect,useMemo,useRef,useId } from 'react';
import { cn } from '@/lib/utils';
import type {SceneKind,SceneOptions,SceneRegistration} from './types';
import type {StudioRenderer} from './engine';
type Context={register:(id:string,registration:SceneRegistration)=>()=>void;reset:(id:string)=>void;rotate:(id:string,amount:number)=>void};
const SceneContext=createContext<Context|null>(null);
export function SceneProvider({children}:{children:React.ReactNode}){
 const canvas=useRef<HTMLCanvasElement>(null);const engine=useRef<StudioRenderer|null>(null);const registrations=useRef(new Map<string,SceneRegistration>());
 const context=useMemo<Context>(()=>({register:(id,registration)=>{registrations.current.set(id,registration);engine.current?.register(id,registration);return()=>{registrations.current.delete(id);engine.current?.remove(id);};},reset:id=>engine.current?.reset(id),rotate:(id,amount)=>engine.current?.rotate(id,amount)}),[]);
 useEffect(()=>{let cancelled=false;let instance:StudioRenderer|null=null;const idle=window.setTimeout(async()=>{try{const {StudioRenderer}=await import('./engine');if(cancelled||!canvas.current)return;instance=new StudioRenderer(canvas.current);engine.current=instance;registrations.current.forEach((r,id)=>instance!.register(id,r));}catch{if(canvas.current)canvas.current.dataset.engine='fallback';}},50);return()=>{cancelled=true;window.clearTimeout(idle);instance?.dispose();engine.current=null;};},[]);
 return <SceneContext.Provider value={context}>{children}<canvas ref={canvas} className="studio-webgl" aria-hidden="true" data-engine="loading"/></SceneContext.Provider>;
}
export function SceneArtwork({kind,progress=0,interactive=false,className,label}:{kind:SceneKind;progress?:number;interactive?:boolean;className?:string;label:string}){
 const context=useContext(SceneContext);const element=useRef<HTMLDivElement>(null);const id=useId();
 const options=useMemo<SceneOptions>(()=>({kind,progress,interactive}),[kind,progress,interactive]);
 useEffect(()=>{if(!element.current||!context)return;return context.register(id,{element:element.current,options});},[context,id,options]);
 return <div ref={element} className={cn('scene-artwork',`scene-${kind}`,className)} data-three-scene={kind} role="img" aria-label={label} tabIndex={interactive?0:undefined} onKeyDown={event=>{if(!interactive)return;if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();context?.rotate(id,event.key==='ArrowLeft'?-.2:.2);}if(event.key==='Home')context?.reset(id);}}><div className="scene-fallback" aria-hidden="true"><span/><span/><span/></div>{interactive&&<button className="scene-reset" aria-label="Reset 3D view" onClick={()=>context?.reset(id)} title="Reset view"><svg width="14" height="14" viewBox="0 0 20 20" fill="none"><path d="M4 8a6 6 0 1 1 0 5M4 3v5h5" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"/></svg></button>}</div>;
}
