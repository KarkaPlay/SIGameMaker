// Use elapsed time so a throttled background tab does not extend the countdown.
export function countdown(seconds,onTick,onEnd,{now=()=>Date.now(),schedule=setInterval,cancel=clearInterval}={}){
 const deadline=now()+seconds*1000;
 let stopped=false;
 const stop=()=>{stopped=true;cancel(handle);};
 const tick=()=>{if(stopped)return;const left=Math.max(0,Math.ceil((deadline-now())/1000));onTick(left);if(!left){stop();onEnd();}};
 const handle=schedule(tick,100);
 tick();
 return stop;
}
