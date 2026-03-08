import { useEffect, useRef, useState, useCallback } from 'react';

const W = 1280, H = 720, GROUND = 560, GRAVITY = 0.7, FRICTION = 0.85, WALK_SPEED = 5, JUMP_FORCE = -14, ROUND_TIME = 99, MAX_ROUNDS = 3;

type FState = 'idle'|'walk'|'walkBack'|'jump'|'crouch'|'punch'|'kick'|'heavy'|'uppercut'|'block'|'hit'|'ko';
type Particle = {x:number;y:number;vx:number;vy:number;life:number;maxLife:number;color:string;size:number};

interface Fighter {
  x:number;y:number;vx:number;vy:number;hp:number;state:FState;frame:number;stateTimer:number;
  facing:1|-1;grounded:boolean;combo:number;comboTimer:number;special:number;
  name:string;color:string;accent:string;skin:string;isAI:boolean;wins:number;aiTimer:number;walkCycle:number;idleBob:number;
}

const ATTACKS: Record<string,{frames:number;dmg:number;kx:number;ky:number;hitFrame:number;range:number;hh:number;sp:number}> = {
  punch:{frames:18,dmg:6,kx:4,ky:-2,hitFrame:6,range:60,hh:40,sp:5},
  kick:{frames:22,dmg:8,kx:6,ky:-3,hitFrame:8,range:70,hh:50,sp:7},
  heavy:{frames:30,dmg:14,kx:10,ky:-6,hitFrame:14,range:80,hh:60,sp:12},
  uppercut:{frames:26,dmg:12,kx:3,ky:-14,hitFrame:10,range:55,hh:70,sp:15},
};

const mkFighter = (x:number,name:string,color:string,accent:string,skin:string,isAI:boolean):Fighter => ({
  x,y:GROUND,vx:0,vy:0,hp:100,state:'idle',frame:0,stateTimer:0,facing:1,grounded:true,
  combo:0,comboTimer:0,special:0,name,color,accent,skin,isAI,wins:0,aiTimer:0,walkCycle:0,idleBob:Math.random()*Math.PI*2
});

const RagdollArena = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const st = useRef({
    fighters:[mkFighter(300,'KAZUYA','#c22','#f44','#e8b878',false),mkFighter(980,'HEIHACHI','#22c','#44f','#d4a86a',true)],
    particles:[] as Particle[], screenShake:0, round:1, timer:ROUND_TIME*60,
    roundState:'intro' as 'intro'|'fight'|'ko', introTimer:120, koTimer:0,
    keys:new Set<string>(), hitSparks:[] as {x:number;y:number;timer:number}[],
    comboText:[] as {text:string;x:number;y:number;timer:number;color:string}[],
  });
  const [hud,setHud]=useState({p1hp:100,p2hp:100,timer:99,round:1,p1sp:0,p2sp:0,p1w:0,p2w:0,rs:'intro',p1c:0,p2c:0});

  const drawFighter = useCallback((ctx:CanvasRenderingContext2D,f:Fighter,t:number)=>{
    ctx.save();ctx.translate(f.x,f.y);ctx.scale(f.facing,1);
    const bob=f.state==='idle'?Math.sin(f.idleBob+t*0.05)*3:0;
    const ap=f.stateTimer>0?f.frame/f.stateTimer:0;
    ctx.fillStyle='rgba(0,0,0,0.3)';ctx.beginPath();ctx.ellipse(0,0,35,8,0,0,Math.PI*2);ctx.fill();
    ctx.lineWidth=7;ctx.lineCap='round';ctx.strokeStyle=f.color;
    const ls=f.state==='crouch'?20:14;
    let ll=0,rl=0,co=0;
    if(f.state==='crouch'){co=25;ll=0.6;rl=-0.6;}
    else if(f.state==='walk'||f.state==='walkBack'){ll=Math.sin(f.walkCycle)*0.5;rl=Math.sin(f.walkCycle+Math.PI)*0.5;}
    else if(f.state==='kick'){rl=ap<0.4?-ap*3:ap<0.7?-1.2+(ap-0.4)*8:1.2-(ap-0.7)*4;}
    else if(f.state==='jump'){ll=-0.3;rl=0.3;}
    const legs:number[][]=[[-ls,ll],[ls,rl]];
    legs.forEach(([sp,ang])=>{
      ctx.lineWidth=7;ctx.beginPath();ctx.moveTo(sp,-co);
      const fx2=sp+Math.sin(ang)*35,fy2=-co+40+Math.cos(ang)*5;
      ctx.lineTo(fx2,fy2);ctx.stroke();
      ctx.lineWidth=5;ctx.beginPath();ctx.moveTo(fx2,fy2);ctx.lineTo(fx2+10,fy2+2);ctx.stroke();
    });
    const ty=-(50+bob-co);const th=f.state==='crouch'?30:50;
    ctx.fillStyle=f.color;ctx.beginPath();ctx.roundRect(-18,ty,36,th,6);ctx.fill();
    ctx.fillStyle=f.accent;ctx.fillRect(-18,ty+th-8,36,8);
    ctx.strokeStyle=f.accent;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,ty+8);ctx.lineTo(0,ty+th-12);ctx.stroke();
    ctx.lineWidth=6;ctx.lineCap='round';
    let la=0,ra=0,lf=0.3,rf=0.3,ae=0;
    if(f.state==='idle'){la=Math.sin(t*0.03)*0.1-0.3;ra=Math.sin(t*0.03+1)*0.1+0.3;lf=0.8;rf=0.8;}
    else if(f.state==='walk'||f.state==='walkBack'){la=Math.sin(f.walkCycle+Math.PI)*0.4;ra=Math.sin(f.walkCycle)*0.4;}
    else if(f.state==='punch'){
      if(ap<0.3){ra=-0.5-ap;rf=1.2;}else if(ap<0.5){ra=0.2;rf=0.1;ae=30;}else{ra=0.2-(ap-0.5)*0.5;ae=Math.max(0,30*(1-(ap-0.5)*2));}
      la=-0.5;lf=1;
    }else if(f.state==='heavy'){
      if(ap<0.4){ra=-1.5+ap;la=-1.2;}else if(ap<0.6){ra=0.8;la=0.5;ae=40;}else{ra=0.8-(ap-0.6)*2;la=0.5-(ap-0.6);ae=Math.max(0,40*(1-(ap-0.6)*2.5));}
    }else if(f.state==='uppercut'){
      if(ap<0.35){ra=0.5+ap*2;rf=1.2;}else if(ap<0.55){ra=-1.8;rf=0.2;ae=15;}else{ra=-1.8+(ap-0.55)*3;ae=Math.max(0,15*(1-(ap-0.55)*2));}
      la=-0.3;
    }else if(f.state==='block'){la=-0.8;ra=-0.6;lf=1.2;rf=1.2;}
    else if(f.state==='hit'){la=0.5;ra=0.8;}else if(f.state==='jump'){la=-0.8;ra=-0.6;}
    const sy=ty+5;ctx.strokeStyle=f.skin;
    const lex=-18-Math.cos(la)*22,ley=sy+Math.sin(la)*22+15;
    ctx.beginPath();ctx.moveTo(-18,sy);ctx.lineTo(lex,ley);ctx.lineTo(lex-Math.cos(la-lf)*20,ley+Math.sin(la-lf)*20+8);ctx.stroke();
    const rex=18+Math.cos(ra)*22+ae*0.3,rey=sy+Math.sin(ra)*22+15;
    ctx.beginPath();ctx.moveTo(18,sy);ctx.lineTo(rex,rey);ctx.lineTo(rex+Math.cos(ra+rf)*20+ae*0.7,rey+Math.sin(ra+rf)*20+8);ctx.stroke();
    if(['punch','heavy','uppercut'].includes(f.state)&&ap>0.25&&ap<0.65){
      const fxP=rex+Math.cos(ra+rf)*20+ae*0.7,fyP=rey+Math.sin(ra+rf)*20+8;
      ctx.fillStyle=f.accent;ctx.beginPath();ctx.arc(fxP,fyP,6,0,Math.PI*2);ctx.fill();
    }
    const hy=ty-18,ht=f.state==='hit'?0.2:f.state==='block'?-0.1:0;
    ctx.save();ctx.translate(0,hy);ctx.rotate(ht);
    ctx.fillStyle=f.color;ctx.beginPath();ctx.arc(0,-2,17,Math.PI,0);ctx.fill();
    ctx.fillStyle=f.skin;ctx.beginPath();ctx.arc(0,0,15,0,Math.PI*2);ctx.fill();
    const eo=f.state==='hit'?2:0;
    if(f.state==='ko'){
      ctx.lineWidth=2;ctx.strokeStyle='#111';
      [-6,6].forEach(ex=>{ctx.beginPath();ctx.moveTo(ex-3,-4);ctx.lineTo(ex+3,0);ctx.stroke();ctx.beginPath();ctx.moveTo(ex+3,-4);ctx.lineTo(ex-3,0);ctx.stroke();});
    }else{
      ctx.fillStyle='#111';ctx.fillRect(-8+eo,-5,4,5);ctx.fillRect(4+eo,-5,4,5);
      ctx.fillStyle='#fff';ctx.fillRect(-7+eo,-4,2,2);ctx.fillRect(5+eo,-4,2,2);
    }
    ctx.strokeStyle='#333';ctx.lineWidth=2;ctx.beginPath();
    if(f.state==='hit'||f.state==='ko')ctx.arc(0,8,5,0,Math.PI);else{ctx.moveTo(-3,7);ctx.lineTo(3,7);}
    ctx.stroke();
    ctx.fillStyle=f.accent;ctx.fillRect(-16,-8,32,5);
    ctx.restore();ctx.restore();
  },[]);

  const spawnHit = useCallback((x:number,y:number,color:string,count:number)=>{
    const s=st.current;
    for(let i=0;i<count;i++) s.particles.push({x,y,vx:(Math.random()-0.5)*12,vy:(Math.random()-0.8)*10,life:20+Math.random()*15,maxLife:35,color:Math.random()>0.5?color:'#fff',size:3+Math.random()*5});
    s.hitSparks.push({x,y,timer:8});s.screenShake=6;
  },[]);

  useEffect(()=>{
    const canvas=canvasRef.current;if(!canvas)return;
    const ctx=canvas.getContext('2d')!;const s=st.current;
    const kd=(e:KeyboardEvent)=>{s.keys.add(e.key.toLowerCase());e.preventDefault();};
    const ku=(e:KeyboardEvent)=>{s.keys.delete(e.key.toLowerCase());e.preventDefault();};
    window.addEventListener('keydown',kd);window.addEventListener('keyup',ku);
    let fc=0,aid=0;
    const ss=(f:Fighter,state:FState,dur?:number)=>{if(f.state==='ko')return;f.state=state;f.frame=0;f.stateTimer=dur||0;};
    const ca=(f:Fighter)=>['idle','walk','walkBack','crouch'].includes(f.state);
    const doAtk=(f:Fighter,t:string)=>{const a=ATTACKS[t];if(a&&ca(f))ss(f,t as FState,a.frames);};

    const runAI=(bot:Fighter,pl:Fighter)=>{
      if(bot.state==='ko'||bot.state==='hit')return;
      bot.aiTimer--;if(bot.aiTimer>0)return;
      const d=Math.abs(bot.x-pl.x),fp=(pl.x>bot.x&&bot.facing===1)||(pl.x<bot.x&&bot.facing===-1);
      if(['punch','kick','heavy','uppercut'].includes(pl.state)&&d<120&&Math.random()>0.35){
        if(Math.random()>0.5){ss(bot,'block');bot.aiTimer=20+Math.random()*15|0;return;}
        bot.vx=-bot.facing*8;bot.aiTimer=15;return;
      }
      if(d<80&&fp&&ca(bot)){
        const r=Math.random();
        if(r<0.3)doAtk(bot,'punch');else if(r<0.55)doAtk(bot,'kick');else if(r<0.75)doAtk(bot,'heavy');else if(r<0.85)doAtk(bot,'uppercut');else ss(bot,'block');
        bot.aiTimer=8+Math.random()*12|0;
      }else if(d<200){
        if(Math.random()>0.3&&fp)ss(bot,'walk');
        else if(bot.grounded&&Math.random()>0.5){bot.vy=JUMP_FORCE;bot.grounded=false;bot.vx=bot.facing*4;}
        bot.aiTimer=10+Math.random()*20|0;
      }else{ss(bot,'walk');bot.aiTimer=15+Math.random()*25|0;}
    };

    const tick=()=>{
      fc++;const[p1,p2]=s.fighters;
      if(s.roundState==='intro'){s.introTimer--;if(s.introTimer<=0)s.roundState='fight';}
      if(s.roundState==='ko'){
        s.koTimer--;
        if(s.koTimer<=0){
          s.round++;if(p1.wins>=2||p2.wins>=2||s.round>MAX_ROUNDS){s.round=1;p1.wins=0;p2.wins=0;}
          [p1,p2].forEach((f,i)=>{f.x=i===0?300:980;f.y=GROUND;f.vx=0;f.vy=0;f.hp=100;f.special=0;ss(f,'idle');f.grounded=true;});
          s.roundState='intro';s.introTimer=90;s.timer=ROUND_TIME*60;
        }
      }
      if(s.roundState!=='fight'){
        if(fc%3===0)setHud({p1hp:p1.hp,p2hp:p2.hp,timer:Math.ceil(s.timer/60),round:s.round,p1sp:p1.special,p2sp:p2.special,p1w:p1.wins,p2w:p2.wins,rs:s.roundState,p1c:p1.combo,p2c:p2.combo});
        return;
      }
      s.timer--;if(s.timer<=0){if(p1.hp>=p2.hp){p1.wins++;ss(p2,'ko');}else{p2.wins++;ss(p1,'ko');}s.roundState='ko';s.koTimer=120;}
      if(ca(p1)||p1.state==='block'){
        if(s.keys.has('j'))doAtk(p1,'punch');
        else if(s.keys.has('k'))doAtk(p1,'kick');
        else if(s.keys.has('l'))doAtk(p1,'heavy');
        else if(s.keys.has('u'))doAtk(p1,'uppercut');
        else if(s.keys.has('s')&&s.keys.has('shift'))ss(p1,'block');
        else if(s.keys.has('s'))ss(p1,'crouch');
        else if(s.keys.has('w')&&p1.grounded){p1.vy=JUMP_FORCE;p1.grounded=false;ss(p1,'jump');}
        else if(s.keys.has('a')){p1.vx=-WALK_SPEED;if(p1.grounded)ss(p1,p1.facing===-1?'walk':'walkBack');}
        else if(s.keys.has('d')){p1.vx=WALK_SPEED;if(p1.grounded)ss(p1,p1.facing===1?'walk':'walkBack');}
        else if(p1.grounded)ss(p1,'idle');
      }
      runAI(p2,p1);
      s.fighters.forEach((f,idx)=>{
        const o=s.fighters[1-idx];
        if(ca(f))f.facing=o.x>f.x?1:-1;
        if(f.stateTimer>0){f.frame++;if(f.frame>=f.stateTimer&&f.state!=='ko')ss(f,'idle');}
        if(!f.grounded){f.vy+=GRAVITY;f.y+=f.vy;if(f.y>=GROUND){f.y=GROUND;f.vy=0;f.grounded=true;if(f.state==='jump')ss(f,'idle');}}
        f.x+=f.vx;f.vx*=FRICTION;
        if(f.state==='walk'){f.x+=f.facing*WALK_SPEED;f.walkCycle+=0.15;}
        else if(f.state==='walkBack'){f.x-=f.facing*WALK_SPEED*0.7;f.walkCycle+=0.12;}
        f.x=Math.max(40,Math.min(W-40,f.x));f.idleBob+=0.06;
        if(f.comboTimer>0){f.comboTimer--;if(f.comboTimer<=0)f.combo=0;}
        const ad=ATTACKS[f.state];
        if(ad&&f.frame===ad.hitFrame){
          const hx=f.x+f.facing*ad.range,hy2=f.y-50;
          if(Math.abs(hx-o.x)<50&&Math.abs(hy2-(o.y-50))<ad.hh){
            if(o.state==='block'){o.vx=f.facing*ad.kx*0.5;spawnHit(o.x-f.facing*20,o.y-60,'#88f',5);s.screenShake=3;}
            else{
              let dmg=ad.dmg;f.combo++;f.comboTimer=45;
              if(f.combo>1)dmg=Math.max(2,dmg*(1-f.combo*0.08));
              o.hp=Math.max(0,o.hp-dmg);o.vx=f.facing*ad.kx;o.vy=ad.ky;
              if(ad.ky<-5)o.grounded=false;
              ss(o,'hit',20);f.special=Math.min(100,f.special+ad.sp);
              spawnHit(o.x,o.y-50,f.accent,12+f.combo*3);
              if(f.combo>1)s.comboText.push({text:`${f.combo} HIT${f.combo>2?'!':''}`,x:o.x,y:o.y-90,timer:40,color:f.accent});
              if(o.hp<=0){ss(o,'ko');f.wins++;s.roundState='ko';s.koTimer=150;s.screenShake=15;spawnHit(o.x,o.y-50,'#ff0',30);}
            }
          }
        }
      });
      s.particles=s.particles.filter(p=>{p.x+=p.vx;p.y+=p.vy;p.vy+=0.3;p.vx*=0.97;p.life--;return p.life>0;});
      s.hitSparks=s.hitSparks.filter(h=>{h.timer--;return h.timer>0;});
      s.comboText=s.comboText.filter(c=>{c.timer--;c.y-=1;return c.timer>0;});
      if(s.screenShake>0)s.screenShake*=0.85;
      if(fc%3===0)setHud({p1hp:p1.hp,p2hp:p2.hp,timer:Math.ceil(s.timer/60),round:s.round,p1sp:p1.special,p2sp:p2.special,p1w:p1.wins,p2w:p2.wins,rs:s.roundState,p1c:p1.combo,p2c:p2.combo});
    };

    const render=()=>{
      tick();
      const sx2=s.screenShake>0.5?(Math.random()-0.5)*s.screenShake*2:0;
      const sy2=s.screenShake>0.5?(Math.random()-0.5)*s.screenShake*2:0;
      ctx.save();ctx.translate(sx2,sy2);
      const sg=ctx.createLinearGradient(0,0,0,GROUND);
      sg.addColorStop(0,'#0a0a1a');sg.addColorStop(0.5,'#141430');sg.addColorStop(1,'#1a1a3a');
      ctx.fillStyle=sg;ctx.fillRect(0,0,W,GROUND);
      ctx.fillStyle='rgba(255,255,255,0.4)';
      for(let i=0;i<50;i++)ctx.fillRect((i*137.5)%W,(i*73.1)%(GROUND*0.6),1+(i%3),1+(i%3));
      ctx.fillStyle='rgba(200,200,230,0.15)';ctx.beginPath();ctx.arc(1050,100,60,0,Math.PI*2);ctx.fill();
      ctx.fillStyle='#111128';ctx.beginPath();ctx.moveTo(0,GROUND);
      for(let x=0;x<=W;x+=60)ctx.lineTo(x,GROUND-80-Math.sin(x*0.008)*60-Math.sin(x*0.015)*30);
      ctx.lineTo(W,GROUND);ctx.fill();
      ctx.fillStyle='#0d0d22';ctx.fillRect(520,GROUND-200,240,200);
      ctx.beginPath();ctx.moveTo(500,GROUND-200);ctx.lineTo(640,GROUND-280);ctx.lineTo(780,GROUND-200);ctx.fill();
      for(let i=0;i<4;i++){ctx.fillStyle='#0f0f28';ctx.fillRect(540+i*55,GROUND-180,15,180);}
      const gg=ctx.createLinearGradient(0,GROUND,0,H);gg.addColorStop(0,'#2a1a0a');gg.addColorStop(1,'#0f0a05');
      ctx.fillStyle=gg;ctx.fillRect(0,GROUND,W,H-GROUND);
      ctx.strokeStyle='#4a3520';ctx.lineWidth=3;ctx.beginPath();ctx.moveTo(0,GROUND);ctx.lineTo(W,GROUND);ctx.stroke();
      s.fighters.forEach(f=>drawFighter(ctx,f,fc));
      s.hitSparks.forEach(h=>{
        ctx.strokeStyle=`rgba(255,255,200,${h.timer/8})`;ctx.lineWidth=3;
        for(let i=0;i<6;i++){const a=(i/6)*Math.PI*2+fc*0.3,l=(8-h.timer)*6;
          ctx.beginPath();ctx.moveTo(h.x+Math.cos(a)*5,h.y+Math.sin(a)*5);ctx.lineTo(h.x+Math.cos(a)*l,h.y+Math.sin(a)*l);ctx.stroke();}
      });
      s.particles.forEach(p=>{ctx.globalAlpha=p.life/p.maxLife;ctx.fillStyle=p.color;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(p.life/p.maxLife),0,Math.PI*2);ctx.fill();});
      ctx.globalAlpha=1;
      s.comboText.forEach(c=>{
        const a=c.timer/40;ctx.save();ctx.translate(c.x,c.y);ctx.scale(1+(1-a)*0.5,1+(1-a)*0.5);
        ctx.font='bold 28px monospace';ctx.textAlign='center';ctx.fillStyle=c.color;ctx.globalAlpha=a;ctx.fillText(c.text,0,0);ctx.restore();
      });
      if(s.roundState==='intro'){
        const p=1-s.introTimer/90;
        ctx.fillStyle=`rgba(0,0,0,${0.5*(1-p)})`;ctx.fillRect(0,0,W,H);
        ctx.save();ctx.translate(W/2,H/2-40);ctx.scale(0.5+p*0.5,0.5+p*0.5);
        ctx.font='bold 72px monospace';ctx.textAlign='center';ctx.fillStyle='#fff';ctx.globalAlpha=Math.min(1,p*3);
        ctx.fillText(`ROUND ${s.round}`,0,0);
        if(p>0.6){ctx.font='bold 48px monospace';ctx.fillStyle='#f44';ctx.globalAlpha=(p-0.6)*2.5;ctx.fillText('FIGHT!',0,60);}
        ctx.restore();
      }
      if(s.roundState==='ko'){
        const p=1-s.koTimer/150;ctx.save();ctx.translate(W/2,H/2-30);ctx.scale(p<0.2?p*5:1,p<0.2?p*5:1);
        ctx.font='bold 96px monospace';ctx.textAlign='center';
        ctx.fillStyle='#000';ctx.fillText('K.O.',3,3);ctx.fillStyle='#f22';ctx.fillText('K.O.',0,0);ctx.restore();
      }
      ctx.restore();
      aid=requestAnimationFrame(render);
    };
    aid=requestAnimationFrame(render);
    return()=>{cancelAnimationFrame(aid);window.removeEventListener('keydown',kd);window.removeEventListener('keyup',ku);};
  },[drawFighter,spawnHit]);

  return(
    <div className="relative w-full h-full flex items-center justify-center bg-black">
      <canvas ref={canvasRef} width={W} height={H} className="max-w-full max-h-full"/>
      <div className="absolute top-0 left-0 right-0 pointer-events-none" style={{maxWidth:W,margin:'0 auto'}}>
        <div className="flex items-start justify-between p-4 gap-4">
          <div className="flex-1">
            <div className="text-xs font-bold text-red-400 mb-1 font-mono tracking-wider">{st.current.fighters[0].name}</div>
            <div className="h-6 bg-black/70 border border-red-900 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-200" style={{width:`${hud.p1hp}%`,background:'linear-gradient(180deg,#f44,#a22)'}}/>
            </div>
            <div className="h-2 bg-black/50 border border-yellow-900/50 mt-1 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-300" style={{width:`${hud.p1sp}%`,background:hud.p1sp>=100?'#ff0':'linear-gradient(90deg,#a80,#ff0)'}}/>
            </div>
            <div className="flex gap-1 mt-1">{[0,1].map(i=><div key={i} className={`w-3 h-3 rounded-full border ${i<hud.p1w?'bg-red-500 border-red-400':'border-red-900/50'}`}/>)}</div>
          </div>
          <div className="text-center px-4">
            <div className="text-4xl font-bold text-white font-mono tabular-nums min-w-[60px]">{hud.timer}</div>
            <div className="text-[10px] text-white/50 font-mono">ROUND {hud.round}</div>
          </div>
          <div className="flex-1">
            <div className="text-xs font-bold text-blue-400 mb-1 font-mono tracking-wider text-right">{st.current.fighters[1].name}</div>
            <div className="h-6 bg-black/70 border border-blue-900 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-200 ml-auto" style={{width:`${hud.p2hp}%`,background:'linear-gradient(180deg,#44f,#22a)'}}/>
            </div>
            <div className="h-2 bg-black/50 border border-yellow-900/50 mt-1 rounded-sm overflow-hidden">
              <div className="h-full transition-all duration-300 ml-auto" style={{width:`${hud.p2sp}%`,background:hud.p2sp>=100?'#ff0':'linear-gradient(90deg,#ff0,#a80)'}}/>
            </div>
            <div className="flex gap-1 mt-1 justify-end">{[0,1].map(i=><div key={i} className={`w-3 h-3 rounded-full border ${i<hud.p2w?'bg-blue-500 border-blue-400':'border-blue-900/50'}`}/>)}</div>
          </div>
        </div>
        {hud.p1c>1&&<div className="absolute left-8 top-28 text-2xl font-bold text-red-400 font-mono animate-pulse">{hud.p1c} HITS!</div>}
        {hud.p2c>1&&<div className="absolute right-8 top-28 text-2xl font-bold text-blue-400 font-mono animate-pulse">{hud.p2c} HITS!</div>}
      </div>
      <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-white/30 text-xs font-mono pointer-events-none text-center">
        WASD Move/Jump • J Punch • K Kick • L Heavy • U Uppercut • S+Shift Block
      </div>
    </div>
  );
};

export default RagdollArena;
