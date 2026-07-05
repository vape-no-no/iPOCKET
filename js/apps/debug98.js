/* ════════ DEBUG CONSOLE (Secret) ════════ */
function initDebug98() {
  const c = window.content;
  c.style.cssText = 'width:100%;height:100%;display:flex;flex-direction:column;overflow:hidden;background:#0a0a0a;';

  const titleBar = document.createElement('div');
  titleBar.style.cssText = 'flex-shrink:0;background:#c0c0c0;padding:2px 6px;font-family:var(--pixel-font);font-size:16px;color:#000;border-bottom:2px solid #808080;';
  titleBar.textContent = '🐛 iPOCKET Debug Console v8.0';
  c.appendChild(titleBar);

  const out = document.createElement('div');
  out.style.cssText = 'flex:1;overflow-y:auto;-webkit-overflow-scrolling:touch;padding:6px 8px;font-family:"Share Tech Mono",monospace;font-size:0.7rem;color:#00ff41;line-height:1.7;background:#0a0a0a;';
  c.appendChild(out);

  const inputRow = document.createElement('div');
  inputRow.style.cssText = 'flex-shrink:0;display:flex;align-items:center;gap:6px;padding:5px 8px;background:#111;border-top:1px solid #333;';
  inputRow.innerHTML = '<span style="color:#00ff41;font-family:Share Tech Mono,monospace;font-size:.7rem;white-space:nowrap;">> </span>';
  const inp = document.createElement('input');
  inp.type='text'; inp.autocomplete='off'; inp.autocapitalize='off';
  inp.style.cssText = 'flex:1;background:transparent;border:none;outline:none;color:#00ff41;font-family:"Share Tech Mono",monospace;font-size:.7rem;caret-color:#00ff41;';
  inputRow.appendChild(inp);
  c.appendChild(inputRow);

  function print(text, col) {
    const d = document.createElement('div');
    d.style.color = col || '#00ff41';
    d.textContent = text;
    out.appendChild(d);
    out.scrollTop = out.scrollHeight;
  }

  const s = POS.get();
  const b = navigator;
  print('iPOCKET OS Debug Console', '#00ffcc');
  print('Type \'help\' for commands.', '#aaa');
  print('');
  print('Battery: checking...', '#aaa');
  print('Memory: ' + (performance?.memory ? Math.round(performance.memory.usedJSHeapSize/1048576) + ' MB' : 'N/A'), '#aaa');
  print('OS: iPOCKET v8.0.0', '#aaa');
  print('User Agent: ' + navigator.userAgent.slice(0,60) + '...', '#555');
  print('');

  const CMDS = {
    help: ()=>{
      print('Commands:', '#00ffcc');
      ['scan','status','clear','theme [retro|hacker|modern]','xp','notif [msg]','glitch','about'].forEach(cmd=>print('  '+cmd,'#aaa'));
    },
    scan: ()=>{
      print('Scanning system...','#ffff00');
      setTimeout(()=>print('No threats found.','#00ff41'),600);
      setTimeout(()=>print('All systems nominal.','#00ff41'),1100);
    },
    status: ()=>{
      print('=== System Status ===','#00ffcc');
      print('Level: '+s.level,'#fff');
      print('XP: '+s.xp+'/'+POS.getXPProgress().needed,'#fff');
      print('Apps opened: '+(s.appsOpened||0),'#fff');
      print('Games played: '+(s.gamesPlayed||0),'#fff');
      print('Achievements: '+Object.keys(s.achievements||{}).length,'#fff');
      print('Boot count: '+(s.bootCount||0),'#fff');
      print('Theme: '+OS.getTheme(),'#fff');
    },
    clear: ()=>{ out.innerHTML=''; },
    xp: ()=>{
      POS.addXP(50,'debug');
      print('+50 XP added (debug mode)','#ffd700');
    },
    glitch: ()=>{
      print('Initiating glitch sequence...','#ff4444');
      const body = document.getElementById('desktop');
      if(body){
        body.style.animation='none';
        const frames=[
          'invert(1) hue-rotate(90deg)',
          'saturate(10)',
          'invert(1)',
          'blur(3px) saturate(4)',
          'none',
        ];
        frames.forEach((f,i)=>setTimeout(()=>{ body.style.filter=f; if(f==='none') body.style.animation=''; },i*120));
      }
    },
    about: ()=>{
      print('iPOCKET OS v8.0','#00ffcc');
      print('A Pocket OS with Retro Power.','#aaa');
      print('Built with HTML, CSS & JavaScript.','#aaa');
    },
  };

  inp.addEventListener('keydown', e=>{
    if(e.key!=='Enter')return;
    const val=inp.value.trim();
    inp.value='';
    if(!val)return;
    print('> '+val,'#888');
    const parts=val.split(' ');
    const cmd=parts[0].toLowerCase();
    if(cmd==='theme'&&parts[1]){
      OS.applyTheme(parts[1]);
      print('Theme set to '+parts[1],'#00ff41');
    } else if(cmd==='notif'&&parts.slice(1).join(' ')){
      const msg=parts.slice(1).join(' ');
      pushNotification('Debug',msg,'🐛');
      print('Notification pushed.','#00ff41');
    } else if(CMDS[cmd]){
      CMDS[cmd]();
    } else {
      print('Unknown command: '+cmd,'#ff5252');
    }
  });

  setTimeout(()=>inp.focus(),200);
  POS.trackAppOpen('debug');
}
