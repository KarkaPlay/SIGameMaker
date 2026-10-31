// Wall time controls bubbles; only thinking consumes the answer timer.
export function runDemoEvents(frame,{onEvent,onClock,onDone},{now=()=>Date.now(),schedule=setInterval,cancel=clearInterval}={}){
 let index=0,start=now(),stopped=false,clock=frame.clockSeconds||0,handle;
 const events=frame.events||[];
 const emit=()=>{if(events[index])onEvent(events[index]);onClock(clock,false);};
 const stop=()=>{if(stopped)return;stopped=true;if(handle!==undefined)cancel(handle);};
 if(!events.length){onClock(clock,false);return stop;}
 emit();
 const tick=()=>{
  if(stopped)return;const time=now();
  while(index<events.length){const event=events[index],elapsed=Math.max(0,time-start);
   if(elapsed<event.duration){onClock(Math.max(0,clock-(event.clock?elapsed/1000:0)),!!event.clock);return;}
   if(event.clock)clock=Math.max(0,clock-event.duration/1000);
   start+=event.duration;index++;
   if(index<events.length)emit();
  }
  stop();onClock(clock,false);onDone();
 };
 handle=schedule(tick,40);tick();return stop;
}
